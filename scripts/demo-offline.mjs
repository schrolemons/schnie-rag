import { once } from 'node:events';
import { createFixtureRuntime } from '../demo/fixture-runtime.mjs';
console.error('离线契约演示：Vector与LLM为显式替身，不代表真实云服务或模型已经验收。');
const server=createFixtureRuntime();server.listen(0,'127.0.0.1');await once(server,'listening');
try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer offline-fixture-key'},body:JSON.stringify({message:'如何安装？'})});for await(const chunk of response.body)process.stdout.write(chunk);}
finally{await new Promise(resolve=>server.close(resolve));}
