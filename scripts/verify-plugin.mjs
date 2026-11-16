/** Cross-check a separately installed plugin client against the real HTTP adapter.
 * External Redis/Vector/model calls are replaced explicitly; no credentials are used.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createKnowledgeHandler } from '../api/knowledge.js';
import { createChatHandler } from '../api/chat.js';
import { createLocalServer } from '../server/local-server.mjs';
import { SOURCE_IDS } from '../lib/source-sites.js';

const clientPath=process.argv[2];
if(!clientPath)throw new Error('Usage: node scripts/verify-plugin.mjs /path/to/plugin/lib/knowledge-client.js');
const {createKnowledgeClient}=await import(pathToFileURL(path.resolve(clientPath)).href);
const cache=new Map();
const redis={get:async key=>cache.get(key)??null,set:async(key,value)=>{cache.set(key,value);return 'OK';},eval:async()=>1};
const limiter={limit:async()=>({success:true})};
const index={query:async()=>[{score:.95,metadata:{schema:3,retrievalMode:'dense',category:SOURCE_IDS[0],site:SOURCE_IDS[0],articleId:'synthetic',articleHash:'v1',title:'Installation guide',section:'Start',url:'https://docs.example.com/start',text:'Run the setup command.'}}],fetch:async()=>[]};
const provide=()=>({redis,index,minute:limiter,daily:limiter});
let modelCalls=0;
const model=async()=>{modelCalls++;return new Response('data: {"choices":[{"delta":{"content":"Run the setup command.［1］"}}]}\n\ndata: [DONE]\n\n');};
const overview=()=> '# Knowledge overview\n1 synthetic document';
const server=createLocalServer({knowledgeHandler:createKnowledgeHandler(provide,overview),chatHandler:createChatHandler(provide,model,overview)});
server.listen(0,'127.0.0.1');await once(server,'listening');
try{
 const origin=`http://127.0.0.1:${server.address().port}`;
 const client=createKnowledgeClient({endpoint:origin+'/api/knowledge'});
 const result=await client.search({query:'setup',site:SOURCE_IDS[0],messages:['must-not-be-uploaded'],apiKey:'must-not-be-uploaded'});
 assert.equal(result.sources.length,1);assert.equal(result.sources[0].title,'Installation guide');
 assert.match(result.sources[0].id,/^[a-f0-9]{16}$/);assert.equal(modelCalls,0);
 assert.match((await client.overview()).overview,/1 synthetic document/);assert.equal(modelCalls,0);
 await assert.rejects(createKnowledgeClient().search({query:'setup'}),{code:'NOT_CONFIGURED'});
 const response=await fetch(origin+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),messages:[{role:'user',content:'How do I start?'}]})});
 const body=await response.text();assert.equal(response.status,200);assert.match(body,/event: sources/);assert.match(body,/setup command/);assert.match(body,/\[DONE\]/);assert.equal(modelCalls,1);
 console.log(JSON.stringify({ok:true,transport:'real loopback HTTP',checks:['plugin search contract','overview contract','no default endpoint','no model call for retrieval','chat SSE'],externalServices:'explicit synthetic substitutes'}));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
