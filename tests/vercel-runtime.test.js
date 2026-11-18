import { expect,it } from 'vitest';
import { once } from 'node:events';
import { createVercelRuntime } from '../services/vercel/runtime.mjs';
import { createChatHandler, configuredRuntime } from '../services/vercel/chat-handler.mjs';
import { createRedisSimulator } from '../services/redis/simulator.mjs';
import { createTurnstileSimulator } from '../services/cloudflare-turnstile/simulator.mjs';
import { createSseDecoder } from '../protocol/info-card-v1.mjs';
const fixture=()=>({accessKey:'test-access',redis:createRedisSimulator({key:'fixture'}),turnstile:createTurnstileSimulator({siteKey:'site',secretKey:'secret',demoToken:'token'}),retrieve:async()=>[{id:'source-1',title:'说明',url:'https://docs.example.com/',text:'测试资料'}],generate:async()=>JSON.stringify({answer:'参考说明。[1]',info_card:[{id:'source-1',used:true,order:1}]}),overview:()=>''});
async function withServer(services,run,options){
 const server=createVercelRuntime({chatHandler:createChatHandler(()=>services,options)});server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const ask=(body={message:'问题'},token='test-access')=>fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
 try{await run(ask,base);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
it('实际HTTP只提供后端接口，SSE可完整解码并且不会生成UI',async()=>withServer(fixture(),async(ask,base)=>{
 const response=await ask({message:'中文问题🙂',request_id:'fixture-id'}),decoder=createSseDecoder();
 for await(const chunk of response.body)decoder.push(chunk);
 expect(decoder.finish()).toMatchObject({request_id:'fixture-id',text:'参考说明。[1]',cards:[{id:'source-1',title:'说明'}]});
 expect((await fetch(base+'/')).status).toBe(404);
 expect((await ask({message:'问题'},'bad')).status).toBe(401);
 expect((await ask({message:'问题',turnstile_token:'bad'})).status).toBe(403);
 expect((await ask({message:'问题',system:'do not forward'})).status).toBe(400);
 expect((await ask({message:'问题',request_id:'fixture-id'})).status).toBe(409);
}));
it('伪造来源失败时不泄露上游内容，也不发送正文或成功卡片',async()=>{
 const services=fixture();services.generate=async()=>JSON.stringify({answer:'private-invalid[1]',info_card:[{id:'invented',used:true,order:1}]});
 await withServer(services,async ask=>{const response=await ask(),body=await response.text();expect(body).toContain('event: error');expect(body).not.toMatch(/private-invalid|event: info_card|event: text_delta/);});
 expect(services.redis.snapshot().active).toBe(0);
});
it('无响应依赖到期后关闭流并释放并发锁',async()=>{
 const services=fixture();services.retrieve=()=>new Promise(()=>{});
 await withServer(services,async ask=>{const response=await ask(),body=await response.text();expect(body).toContain('TIMEOUT');},{timeoutMs:25});
 expect(services.redis.snapshot().active).toBe(0);
});
it('空配置不会偷偷采用作者的Vector、LLM或服务',()=>expect(()=>configuredRuntime({})).toThrow('VERCEL_SIMULATOR_NOT_CONFIGURED'));
it('模拟协调层覆盖去重、并发、限流、保守预算和跨日重置',()=>{
 let now=0;const redis=createRedisSimulator({key:'fixture',now:()=>now,requestsPerMinute:2,dailyBudget:30});
 const acquire=(id,n=10)=>redis.acquire({client:'test',requestId:id,reservation:n});
 const release=acquire('a');expect(()=>acquire('a')).toThrow('DUPLICATE_REQUEST');expect(()=>acquire('b')).toThrow('CONCURRENT_REQUEST');release();release();
 acquire('b')();expect(()=>acquire('c')).toThrow('RATE_LIMITED');now=61000;expect(()=>acquire('c',11)).toThrow('BUDGET_EXHAUSTED');
 expect(redis.snapshot()).toMatchObject({active:0,reservedBudget:20});now=86400000;acquire('c',30)();expect(redis.snapshot().requests).toBe(1);
});
