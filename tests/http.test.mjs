import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('local HTTP flow serves the app and protects API mutations and data',async()=>{
  const port=33000+Math.floor(Math.random()*1000),origin=`http://localhost:${port}`;
  const child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),APP_ORIGIN:origin,SUPABASE_URL:'',SUPABASE_ANON_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',ENCRYPTION_KEY:''},stdio:['ignore','pipe','pipe']});
  try{
    await Promise.race([once(child.stdout,'data'),once(child,'error').then(([e])=>{throw e;}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Server startup timeout')),5000).unref())]);
    const home=await fetch(origin);assert.equal(home.status,200);assert.match(await home.text(),/Delivery Studio/);assert.match(home.headers.get('Content-Security-Policy'),/script-src 'self'/);
    const script=await fetch(origin+'/app.js');assert.equal(script.status,200);assert.match(script.headers.get('Content-Type'),/javascript/);
    const health=await fetch(origin+'/api/service?op=health');assert.equal(health.status,200);assert.equal((await health.json()).configured,false);
    const status=await fetch(origin+'/api/service?op=status');assert.equal(status.status,401);
    const badOrigin=await fetch(origin+'/api/service?op=createWorkspace',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{"name":"Team"}'});assert.equal(badOrigin.status,403);
  }finally{child.kill();await once(child,'exit');}
});
