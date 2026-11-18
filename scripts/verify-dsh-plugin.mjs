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
for(const file of ['info-card-v1.mjs','evidence-v1.mjs','structured-answer.mjs'])assert.deepEqual(fs.readFileSync(new URL('../protocol/'+file,import.meta.url)),fs.readFileSync(path.join(pluginRoot,'protocol',file)),file+' copies differ');
const {fetchEvidence}=await import(pathToFileURL(path.join(pluginRoot,'lib/evidence-client.mjs')).href);
const {createVercelRuntime}=await import('../services/vercel/runtime.mjs');
const {createEvidenceHandler}=await import('../services/vercel/evidence-handler.mjs');
const retrieval=createVercelRuntime({evidenceHandler:createEvidenceHandler(()=>({accessKey:'fixture-only',turnstile:{verify:()=>({success:true}),fixtureToken:()=>''},redis:{acquire:()=>()=>{}},retrieve:async()=>[{id:'test-1',title:'Fixture',url:'https://docs.example.com/setup',text:'evidence only'}],overview:()=>''}))});
retrieval.listen(0,'127.0.0.1');await once(retrieval,'listening');
try{const result=await fetchEvidence({endpoint:'http://127.0.0.1:'+retrieval.address().port+'/api/retrieve',accessToken:'fixture-only'},'question');assert.equal(result.sources[0].text,'evidence only');}finally{await new Promise(resolve=>retrieval.close(resolve));}
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
