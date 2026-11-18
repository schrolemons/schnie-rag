import {randomUUID} from 'node:crypto';
import {configuredEvidenceRuntime,readBody,equal,json} from './chat-handler.mjs';
import {withinDeadline} from '../../server/retrieval.js';
import {validateEvidence} from '../../protocol/evidence-v1.mjs';
export function createEvidenceHandler(provide=configuredEvidenceRuntime,{timeoutMs=25000}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return json(res,405,'METHOD_NOT_ALLOWED','使用POST提交问题。');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
  const disconnect=()=>{if(!res.writableEnded)abort.abort();};res.on('close',disconnect);let release;
  try{
   const services=provide();
   if(!equal(req.headers.authorization||'',`Bearer ${services.accessKey}`))return json(res,401,'UNAUTHORIZED','请求未获授权。');
   const body=await readBody(req);
   if(!body||Object.keys(body).some(k=>!['message','request_id','turnstile_token'].includes(k))||typeof body.message!=='string'||!body.message.trim()||body.message.length>8000||(body.request_id!==undefined&&(typeof body.request_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.request_id))))return json(res,400,'INPUT_INVALID','问题或请求编号格式无效。');
   if(!services.turnstile.verify(body.turnstile_token??services.turnstile.fixtureToken()).success)return json(res,403,'TURNSTILE_REJECTED','模拟验证令牌不匹配。');
   const request_id=body.request_id||randomUUID();
   release=services.redis.acquire({client:req.socket?.remoteAddress||'reference-client',requestId:request_id,reservation:Buffer.byteLength(body.message)+64000});
   const found=await withinDeadline(services.retrieve({message:body.message.trim(),signal:abort.signal}),abort.signal);
   const value=validateEvidence({protocol:'info-card-evidence',version:1,request_id,sources:found.map(s=>({id:s.id,title:s.title,url:s.url,text:s.text})),overview:services.overview()});
   res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));
  }catch(error){
   if(res.destroyed)return;
   const code=abort.signal.aborted?'TIMEOUT':/^[A-Z_]+$/.test(error.message)?error.message:'SERVICE_UNAVAILABLE';
   json(res,code==='TIMEOUT'?504:['RATE_LIMITED','CONCURRENT_REQUEST','BUDGET_EXHAUSTED'].includes(code)?429:code==='DUPLICATE_REQUEST'?409:code==='INPUT_INVALID'?400:503,code,'检索未完成，未调用任何生成模型。');
  }finally{clearTimeout(timer);res.off('close',disconnect);release?.();}
 };
}
