import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const roots=['api','server','lib','scripts'];let count=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(m?js)$/.test(e.name)){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);count++;}}}
for(const root of roots)walk(root);console.log('Syntax checked: '+count+' JavaScript files');
