import { once } from 'node:events';
import { createVercelRuntime } from '../services/vercel/runtime.mjs';
import { createSseDecoder } from '../protocol/info-card-v1.mjs';
const structured=process.argv.includes('--json');
const message=process.argv.slice(2).filter(arg=>arg!=='--json').join(' ').trim();
if(!message)throw new Error('用法：npm run ask -- "问题" [--json]');
const server=createVercelRuntime();server.listen(0,'127.0.0.1');await once(server,'listening');
try {
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.VERCEL_DEMO_API_KEY||''}`},body:JSON.stringify({message})});
  if(!response.ok)throw new Error(`参考处理链拒绝请求（HTTP ${response.status}）；检查自己的.env配置。`);
  const decoder=structured?createSseDecoder():null;
  for await(const chunk of response.body){if(decoder)decoder.push(chunk);else process.stdout.write(chunk);}
  if(decoder){const result=decoder.finish();console.log(JSON.stringify({answer:result.text,info_card:result.all_cards},null,2));}
} finally {await new Promise(resolve=>server.close(resolve));}
