import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createChatHandler } from './chat-handler.mjs';
import { createEvidenceHandler } from './evidence-handler.mjs';
import contentUpdate from '../../api/content-update.js';
/** Executes the same Vercel handlers in a clearly labelled local simulator. */
export function createVercelRuntime({ chatHandler = createChatHandler(),evidenceHandler=createEvidenceHandler() } = {}) {
  return http.createServer(async(req,res) => {
    res.status=code=>{res.statusCode=code;return res;};
    res.json=value=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));return res;};
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname==='/health')return res.json({ok:true,role:'Vercel reference runtime',simulatedInfrastructure:['cloudflare-turnstile','redis','vercel-runtime'],externalServicesChecked:false});
      if(pathname==='/api/chat')return await chatHandler(req,res);
      if(pathname==='/api/retrieve')return await evidenceHandler(req,res);
      if(pathname==='/api/content-update')return await contentUpdate(req,res);
      return res.status(404).json({code:'NOT_FOUND',message:'此参考后端没有聊天页面。'});
    } catch { if(!res.headersSent)res.status(503).json({code:'SERVICE_UNAVAILABLE'});else res.end(); }
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const port=Number(process.env.PORT||8787);
  createVercelRuntime().listen(port,'127.0.0.1',()=>console.log(`Vercel处理链模拟执行器：http://127.0.0.1:${port}/api/chat（无UI；Vector与LLM需自行配置）`));
}
