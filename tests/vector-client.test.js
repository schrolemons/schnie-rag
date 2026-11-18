import { afterEach,expect,it,vi } from 'vitest';
import { createVectorRetriever } from '../services/upstash-vector/client.mjs';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('真实Upstash SDK使用部署者端口、鉴权、namespace及可取消请求，来源具备协议编号',async()=>{
 vi.stubEnv('VECTOR_EMBEDDING_MODE','upstash-data');
 const send=vi.fn(async()=>Response.json({result:[{id:'chunk',score:.9,metadata:{schema:3,retrievalMode:'dense',category:'docs',title:'配置说明',text:'配置步骤',url:'https://docs.example.com/setup',articleId:'article-1',articleHash:'hash'}}]}));
 vi.stubGlobal('fetch',send);
 const signal=new AbortController().signal;
 const retrieve=createVectorRetriever({UPSTASH_VECTOR_REST_URL:'https://vector.example.com',UPSTASH_VECTOR_REST_TOKEN:'test-vector-token',UPSTASH_VECTOR_NAMESPACE:'kb-independent'});
 const sources=await retrieve({message:'配置',signal});
 expect(sources).toMatchObject([{id:'source-1',title:'配置说明',url:'https://docs.example.com/setup'}]);
 const [url,options]=send.mock.calls[0];expect(url).toContain('https://vector.example.com/');expect(url).toContain('kb-independent');
 expect(JSON.parse(options.body)).toMatchObject({data:'配置',includeMetadata:true,topK:16});expect(options.signal).toBe(signal);expect(options.headers.Authorization??options.headers.authorization).toBe('Bearer test-vector-token');
});
it('未配置真实账号时不自动模拟Vector',()=>expect(()=>createVectorRetriever({})).toThrow('UPSTASH_VECTOR_NOT_CONFIGURED'));
