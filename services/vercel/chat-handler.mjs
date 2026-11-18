import { randomUUID, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { encodeEvent } from '../../protocol/info-card-v1.mjs';
import { validateModelAnswer } from './structured-answer.mjs';
import { createTurnstileSimulator } from '../cloudflare-turnstile/simulator.mjs';
import { createRedisSimulator } from '../redis/simulator.mjs';
import { createVectorRetriever } from '../upstash-vector/client.mjs';
import { createLlmClient } from './llm.mjs';
import { readContentOverview } from '../../server/content-overview.js';
import { withinDeadline } from '../../server/retrieval.js';

let runtime;
export function configuredRuntime(env = process.env) {
  if (env !== process.env) return makeRuntime(env);
  return runtime ||= makeRuntime(env);
}
function makeRuntime(env) {
  if (!env.VERCEL_DEMO_API_KEY) throw new Error('VERCEL_SIMULATOR_NOT_CONFIGURED');
  return {
    accessKey: env.VERCEL_DEMO_API_KEY,
    turnstile: createTurnstileSimulator({ siteKey:env.CLOUDFLARE_TURNSTILE_SITE_KEY, secretKey:env.CLOUDFLARE_TURNSTILE_SECRET_KEY, demoToken:env.CLOUDFLARE_TURNSTILE_DEMO_TOKEN }),
    redis: createRedisSimulator({ key:env.REDIS_SIMULATOR_KEY }),
    retrieve: createVectorRetriever(env),
    generate: createLlmClient({ endpoint:env.LLM_API_URL, apiKey:env.LLM_API_KEY, model:env.LLM_MODEL }),
    overview: readContentOverview,
  };
}
const equal = (a,b) => { const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y); };
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    if (Buffer.byteLength(JSON.stringify(req.body)) > 16000) throw new Error('INPUT_INVALID');
    return req.body;
  }
  let text='',bytes=0;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) text=String(req.body);
  else { const chunks=[]; for await (const chunk of req) { bytes+=chunk.length; if(bytes>16000) throw new Error('INPUT_INVALID'); chunks.push(Buffer.from(chunk)); } text=Buffer.concat(chunks).toString('utf8'); }
  if (Buffer.byteLength(text)>16000) throw new Error('INPUT_INVALID');
  try { return JSON.parse(text); } catch { throw new Error('INPUT_INVALID'); }
}
function json(res,status,code,message) { res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({code,message})); }
export function createChatHandler(provide = configuredRuntime, { timeoutMs = 60000 } = {}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    if (req.method!=='POST') return json(res,405,'METHOD_NOT_ALLOWED','使用POST提交问题。');
    const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),timeoutMs);
    const disconnect=()=>{if(!res.writableEnded)abort.abort();}; res.on('close',disconnect);
    let release, seq=0, requestId=randomUUID(), started=false;
    const emit=async(type,payload)=>{ if(abort.signal.aborted)throw new Error('ABORTED'); const frame=encodeEvent(type,{request_id:requestId,seq:seq++,...payload});if(!res.write(frame))await once(res,'drain',{signal:abort.signal}); };
    try {
      const services=provide();
      if(!equal(req.headers.authorization||'',`Bearer ${services.accessKey}`)) return json(res,401,'UNAUTHORIZED','请求未获授权。');
      const body=await readBody(req);
      if(!body || Object.keys(body).some(key=>!['message','request_id','turnstile_token'].includes(key)) || typeof body.message!=='string' || !body.message.trim() || body.message.length>8000) return json(res,400,'INPUT_INVALID','问题格式无效或长度超过限制。');
      if(body.request_id!==undefined && (typeof body.request_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.request_id))) return json(res,400,'INPUT_INVALID','请求编号格式无效。');
      requestId=body.request_id||requestId;
      const challenge=services.turnstile.verify(body.turnstile_token??services.turnstile.fixtureToken());
      if(!challenge.success)return json(res,403,'TURNSTILE_REJECTED','模拟验证令牌不匹配。');
      release=services.redis.acquire({client:req.socket?.remoteAddress||'reference-client',requestId,reservation:Buffer.byteLength(body.message)+64000});
      res.statusCode=200;res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.setHeader('X-Reference-Mode','simulated-infrastructure');started=true;
      await emit('meta',{protocol:'info-card-sse',version:1});
      await emit('status',{stage:'retrieving'});
      const sources=await withinDeadline(services.retrieve({message:body.message.trim(),signal:abort.signal}),abort.signal);
      await emit('status',{stage:'generating'});
      const raw=await withinDeadline(services.generate({message:body.message.trim(),sources,overview:services.overview(),signal:abort.signal}),abort.signal);
      const answer=validateModelAnswer(raw,sources);
      const chars=[...answer.answer];
      // Structured JSON is validated before content delivery. These are delivery
      // chunks, not a claim of token-by-token streaming from the model provider.
      for(let i=0;i<chars.length;i+=96)await emit('text_delta',{text:chars.slice(i,i+96).join('')});
      await emit('info_card',{info_card:answer.info_card});
      await emit('done',{text_length:chars.length,card_count:answer.info_card.filter(card=>card.used).length});
      res.end();
    } catch(error) {
      if(res.destroyed)return;
      if(abort.signal.aborted) {
        if(started) { res.write(encodeEvent('error',{request_id:requestId,seq:seq++,code:'TIMEOUT',message:'处理超时；本次回答未完成。'}));res.end(); }
        else json(res,504,'TIMEOUT','处理超时。');
        return;
      }
      const code=/^[A-Z_]+$/.test(error.message)?error.message:'SERVICE_UNAVAILABLE';
      if(started){await emit('error',{code,message:'处理未完成；未采用本次引用，请检查配置或重新发起请求。'}).catch(()=>{});res.end();}
      else json(res,['RATE_LIMITED','CONCURRENT_REQUEST','BUDGET_EXHAUSTED'].includes(code)?429:code==='DUPLICATE_REQUEST'?409:code==='INPUT_INVALID'?400:503,code,'参考服务未就绪或请求未通过检查。');
    } finally {clearTimeout(timer);res.off('close',disconnect);release?.();}
  };
}
