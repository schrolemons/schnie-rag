/** Optional cross-repository check. No cloud, profile, bot, or production data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { createFixtureRuntime } from '../demo/fixture-runtime.mjs';
const root=process.argv[2];
if(!root)throw Error('Usage: node scripts/verify-dsh-plugin.mjs /path/to/sse-dsh-plugin');
const pluginRoot=path.resolve(root);
assert.deepEqual(fs.readFileSync(new URL('../protocol/info-card-v1.mjs',import.meta.url)),fs.readFileSync(path.join(pluginRoot,'protocol/info-card-v1.mjs')),'Protocol copies differ');
const {InfoCardAdapter}=await import(pathToFileURL(path.join(pluginRoot,'lib/native-adapter.mjs')).href);
const server=createFixtureRuntime();server.listen(0,'127.0.0.1');await once(server,'listening');
try{
 const adapter=new InfoCardAdapter(()=>({endpoint:`http://127.0.0.1:${server.address().port}/api/chat`,accessToken:'offline-fixture-key'}));
 const chunks=[];
 for await(const chunk of adapter.stream({messages:[{role:'user',source:{kind:'user'},content:[{type:'text',text:'如何安装？'}]},{role:'user',source:{kind:'time-context'},content:[{type:'text',text:'host-only-context'}]}]}))chunks.push(chunk);
 assert.equal(chunks.filter(chunk=>chunk.type==='text-delta').map(chunk=>chunk.text).join(''),'演示资料要求先安装依赖，再检查配置。[1]');
 assert.equal(chunks.at(-1).replayState.response.info_card[0].id,'example-1');
 console.log(JSON.stringify({ok:true,checks:['identical protocol','actual Vercel handler over HTTP','DSH native adapter input/output','validated card metadata'],externalDependencies:'explicit offline fixtures'}));
}finally{await new Promise(resolve=>server.close(resolve));}
