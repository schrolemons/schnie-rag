// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {importSites} from '../scripts/import-sites.js';
const roots=[];
afterEach(()=>{for(const root of roots.splice(0)){if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('knowledge-import-'))throw Error('Unexpected cleanup path');fs.rmSync(root,{recursive:true,force:true});}});
function setup(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-import-'));roots.push(root);const project=path.join(root,'app'),sources=path.join(root,'sources'),repo=path.join(sources,'handbook');fs.mkdirSync(project,{recursive:true});fs.mkdirSync(repo,{recursive:true});return {root,project,sources,repo};}
const site={id:'handbook',name:'Handbook',repository:'example-owner/handbook',branch:'main',url:'https://docs.example.com/',contentDir:'.'};
it('普通Markdown仓库可从根目录采集，不依赖固定站点ID或Hexo结构',async()=>{
 const {project,sources,repo}=setup();
 fs.writeFileSync(path.join(repo,'README.md'),'---\ntitle: Getting Started\nurl: https://docs.example.com/start\n---\nPublic instructions.');
 fs.writeFileSync(path.join(repo,'private.md'),'---\nprivate: true\n---\nDO-NOT-EXPORT');
 const result=await importSites({projectRoot:project,sourcesDir:sources,sites:[site]});
 expect(result.articleCount).toBe(1);
 expect(fs.readFileSync(path.join(project,'src/content/handbook/README.md'),'utf8')).toContain('Public instructions');
 expect(fs.existsSync(path.join(project,'src/content/handbook/private.md'))).toBe(false);
});
it('contentDir不能逃逸到来源仓库外',async()=>{
 const {project,sources}=setup();
 await expect(importSites({projectRoot:project,sourcesDir:sources,sites:[{...site,contentDir:'..'}]})).rejects.toThrow(/仓库/);
 expect(fs.existsSync(path.join(project,'generated/source-manifest.json'))).toBe(false);
});
it('源目录junction不能把仓库外文件带入公开资料',async()=>{
 const {root,project,sources,repo}=setup(),outside=path.join(root,'outside');fs.mkdirSync(outside);
 fs.writeFileSync(path.join(outside,'private.md'),'private outside material');
 fs.symlinkSync(outside,path.join(repo,'source'),'junction');
 await expect(importSites({projectRoot:project,sourcesDir:sources,sites:[{...site,contentDir:'source'}]})).rejects.toThrow(/链接/);
 expect(fs.existsSync(path.join(project,'generated/source-manifest.json'))).toBe(false);
});
