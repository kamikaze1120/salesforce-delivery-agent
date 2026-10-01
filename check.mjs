import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||entry.name==='node_modules')continue;const path=dir+'/'+entry.name;if(entry.isDirectory())await check(path);else if(/\.(mjs|js)$/.test(path)){const r=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(r.status)process.exit(r.status);}}}
await check('.');console.log('JavaScript syntax checks passed.');
