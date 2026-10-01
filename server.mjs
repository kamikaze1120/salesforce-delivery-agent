import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler } from './lib/handler.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'public');
const port=Number(process.env.PORT||3000);
process.env.APP_ORIGIN ||= `http://localhost:${port}`;
const headers={'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};
createServer(async(req,res)=>{
  for(const [k,v]of Object.entries(headers))res.setHeader(k,v);
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/service')return handler(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;return res.end();}
  const pathname=url.pathname==='/'?'/index.html':url.pathname;
  const path=resolve(root,'.'+pathname);
  if(!path.startsWith(root+'/')){res.statusCode=403;return res.end();}
  try{const bytes=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:bytes);}
  catch{res.statusCode=404;res.end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log(`Delivery Studio: http://localhost:${port}`));
