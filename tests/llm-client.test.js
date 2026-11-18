import { expect,it,vi } from 'vitest';
import { createLlmClient } from '../services/vercel/llm.mjs';
const options={endpoint:'https://llm.example.com/v1/chat/completions',apiKey:'fixture',model:'configured-model'};
it('使用部署者模型与结构化输出，检索数据位于数据消息',async()=>{
 const send=vi.fn(async()=>Response.json({choices:[{message:{content:'{"answer":"ok","info_card":[]}'}}]}));
 const generate=createLlmClient({...options,fetcher:send});
 await expect(generate({message:'question',sources:[],overview:'overview'})).resolves.toContain('answer');
 const body=JSON.parse(send.mock.calls[0][1].body);expect(body).toMatchObject({model:'configured-model',stream:false,response_format:{type:'json_object'}});expect(JSON.parse(body.messages[1].content).question).toBe('question');
});
it('响应超过上限时在读取阶段停止并取消流',async()=>{
 let cancelled=false;const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(128*1024));},cancel(){cancelled=true;}});
 const generate=createLlmClient({...options,fetcher:async()=>new Response(body)});
 await expect(generate({message:'question',sources:[]})).rejects.toThrow('LLM_RESPONSE_TOO_LARGE');expect(cancelled).toBe(true);
});
it('拒绝URL内凭据和非回环明文HTTP',()=>{
 for(const endpoint of ['https://' + 'user:password' + '@llm.example.com/','http://llm.example.com/'])expect(()=>createLlmClient({...options,endpoint})).toThrow('LLM_ENDPOINT_INVALID');
});
it('显式配置DeepSeek兼容思考模式，不将推理内容当作回答',async()=>{
 const send=vi.fn(async()=>Response.json({choices:[{message:{content:'{"answer":"ok","info_card":[]}',reasoning_content:'must-not-be-used'}}]}));
 const generate=createLlmClient({...options,thinkingMode:'disabled',fetcher:send});
 await generate({message:'question',sources:[]});
 expect(JSON.parse(send.mock.calls[0][1].body).thinking).toEqual({type:'disabled'});
});
