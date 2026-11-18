/** Explicit offline dependencies for protocol demonstrations only. */
import { createVercelRuntime } from '../services/vercel/runtime.mjs';
import { createChatHandler } from '../services/vercel/chat-handler.mjs';
import { createRedisSimulator } from '../services/redis/simulator.mjs';
import { createTurnstileSimulator } from '../services/cloudflare-turnstile/simulator.mjs';
export function createFixtureRuntime(){
 const services={accessKey:'offline-fixture-key',redis:createRedisSimulator({key:'fixture-redis'}),turnstile:createTurnstileSimulator({siteKey:'fixture-site',secretKey:'fixture-secret',demoToken:'fixture-token'}),
  retrieve:async()=>[{id:'example-1',title:'演示安装说明',url:'https://docs.example.com/setup',text:'演示资料：先安装依赖，再检查配置。'}],
  generate:async()=>JSON.stringify({answer:'演示资料要求先安装依赖，再检查配置。[1]',info_card:[{id:'example-1',used:true,order:1}]}),overview:()=> '仅有1篇虚构演示资料。'};
 return createVercelRuntime({chatHandler:createChatHandler(()=>services)});
}
