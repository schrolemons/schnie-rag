// @vitest-environment node
import {afterEach,expect,it} from 'vitest';
import {createLocalServer} from '../server/local-server.mjs';
let server;afterEach(async()=>{if(server)await new Promise(resolve=>server.close(resolve));});
it('暴露本地健康状态，不假称已连接外部依赖',async()=>{server=createLocalServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const result=await fetch('http://127.0.0.1:'+server.address().port+'/health');expect(await result.json()).toMatchObject({ok:true,externalServicesChecked:false});});
it('拒绝无效JSON，避免进入模型调用',async()=>{server=createLocalServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const result=await fetch('http://127.0.0.1:'+server.address().port+'/api/chat',{method:'POST',body:'{',headers:{'content-type':'application/json'}});expect(result.status).toBe(400);});
