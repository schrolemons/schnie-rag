import {expect,it} from 'vitest';
import {once} from 'node:events';
import {createVercelRuntime} from '../services/vercel/runtime.mjs';
import {createEvidenceHandler} from '../services/vercel/evidence-handler.mjs';
import {configuredEvidenceRuntime} from '../services/vercel/chat-handler.mjs';
import {createRedisSimulator} from '../services/redis/simulator.mjs';
import {createTurnstileSimulator} from '../services/cloudflare-turnstile/simulator.mjs';
const services=()=>({accessKey:'test-key',redis:createRedisSimulator({key:'test-redis'}),turnstile:createTurnstileSimulator({siteKey:'site',secretKey:'secret',demoToken:'token'}),retrieve:async()=>[{id:'source-1',title:'公开资料',url:'https://docs.example.com/',text:'资料正文'}],overview:()=> '资料总览'});
it('只检索接口通过真实HTTP返回有界证据，不调用LLM',async()=>{
 const server=createVercelRuntime({evidenceHandler:createEvidenceHandler(services)});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const ask=(token='test-key')=>fetch(`http://127.0.0.1:${server.address().port}/api/retrieve`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({message:'问题',request_id:'evidence-test-1'})});
  const r=await ask();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({protocol:'info-card-evidence',version:1,request_id:'evidence-test-1',sources:[{id:'source-1',text:'资料正文'}],overview:'资料总览'});
  expect((await ask('wrong')).status).toBe(401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
it('检索服务可以在完全没有LLM凭据时配置',()=>{
 const runtime=configuredEvidenceRuntime({VERCEL_DEMO_API_KEY:'test',UPSTASH_VECTOR_REST_URL:'https://vector.example.com',UPSTASH_VECTOR_REST_TOKEN:'test-token',UPSTASH_VECTOR_NAMESPACE:'kb-test',CLOUDFLARE_TURNSTILE_SITE_KEY:'site',CLOUDFLARE_TURNSTILE_SECRET_KEY:'secret',CLOUDFLARE_TURNSTILE_DEMO_TOKEN:'token',REDIS_SIMULATOR_KEY:'key'});
 expect(typeof runtime.retrieve).toBe('function');expect(runtime.generate).toBeUndefined();
});
