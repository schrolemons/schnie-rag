import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pathToFileURL} from 'node:url';
import chat from '../api/chat.js';
import knowledge from '../api/knowledge.js';
import contentUpdate from '../api/content-update.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export function createLocalServer({ chatHandler=chat, knowledgeHandler=knowledge, contentUpdateHandler=contentUpdate }={}){
 return http.createServer(async(req,res)=>{
  res.status=code=>{res.statusCode=code;return res;};
  res.json=value=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));return res;};
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/health')return res.json({ok:true,mode:'local-adapter',externalServicesChecked:false});
   // The webhook must consume original bytes itself for HMAC validation.
   if(url.pathname==='/api/content-update')return await contentUpdateHandler(req,res);
   if(['/api/chat','/api/knowledge'].includes(url.pathname)){
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>24000)return res.status(413).json({error:'请求正文过长'});chunks.push(chunk);}
    const body=Buffer.concat(chunks).toString('utf8');
    try{req.body=body?JSON.parse(body):{};}catch{return res.status(400).json({error:'JSON格式不正确'});}
    return await(url.pathname==='/api/chat'?chatHandler:knowledgeHandler)(req,res);
   }
   const requested=decodeURIComponent(url.pathname);
   const target=path.resolve(root,'dist','.'+requested);
   const dist=path.resolve(root,'dist');
   if(target!==dist&&!target.startsWith(dist+path.sep))return res.status(403).json({error:'路径无效'});
   let filename=target;
   try{if((await fs.stat(filename)).isDirectory())filename=path.join(filename,'index.html');}catch{filename=path.join(dist,'index.html');}
   const data=await fs.readFile(filename);
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
   res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.end(data);
  }catch(error){
   if(res.headersSent)return res.end();
   res.status(503).json({error:'本地入口暂不可用，请先构建页面并检查配置。'});
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const port=Number(process.env.PORT||8787);createLocalServer().listen(port,'127.0.0.1',()=>console.log('Markdown RAG 本地入口：http://127.0.0.1:'+port));
}
