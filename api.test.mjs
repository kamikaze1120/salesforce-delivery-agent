import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {handler} from '../lib/handler.mjs';
import {seal} from '../lib/core.mjs';
import {sandboxIdentity} from '../lib/integrations.mjs';
import {membership,lock} from '../lib/store.mjs';
process.env.APP_ORIGIN='http://localhost:3000';process.env.SUPABASE_URL='https://unit-test.supabase.co';process.env.SUPABASE_ANON_KEY='anon';process.env.SUPABASE_SERVICE_ROLE_KEY='service';process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');
const wid='00000000-0000-4000-8000-000000000001';
async function request(op,body,headers={}){
  const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);req.method=body?'POST':'GET';req.url='/api/service?op='+op;req.headers=headers;
  let response={headers:{},status:0,body:null};const res={setHeader(k,v){response.headers[k]=v;},set statusCode(s){response.status=s;},end(b){response.body=b?JSON.parse(b):null;}};
  await handler(req,res);return response;
}
test('mutation routes reject missing or cross-site origins before authentication',async()=>{
  let calls=0;const old=global.fetch;global.fetch=async()=>{calls++;throw new Error('unexpected');};
  try{const r=await request('createWorkspace',{name:'Team'},{origin:'https://evil.test'});assert.equal(r.status,403);assert.equal(calls,0);}finally{global.fetch=old;}
});
test('unauthenticated data and GET mutation requests fail closed',async()=>{
  assert.equal((await request('status')).status,401);
  assert.equal((await request('deploy')).status,405);
});
test('membership cannot be borrowed from another workspace or escalated',async()=>{
  const old=global.fetch;global.fetch=async url=>{assert.match(String(url),new RegExp(`workspace_id=eq.${wid}`));return new Response(JSON.stringify([{role:'viewer'}]));};
  try{await assert.rejects(()=>membership({id:'user'},wid,['owner']),/permission/);}finally{global.fetch=old;}
});
test('concurrent job operations cannot both acquire the lock',async()=>{
  const old=global.fetch;global.fetch=async()=>new Response('[]');
  try{await assert.rejects(()=>lock({id:wid,workspace_id:wid,busy:false,version:1}),/another session/);}finally{global.fetch=old;}
});
test('production Salesforce targets are blocked based on org identity, not URL text',async()=>{
  const old=global.fetch;global.fetch=async()=>new Response(JSON.stringify({records:[{Id:'00D000000000001',Name:'Production',IsSandbox:false}]}));
  try{await assert.rejects(()=>sandboxIdentity({instanceUrl:'https://team--dev.sandbox.my.salesforce.com',accessToken:'test'}),/only operates in Salesforce sandboxes/);}finally{global.fetch=old;}
});
test('production action never reaches an external release endpoint',async()=>{
  const old=global.fetch;let writeCalls=0;
  const job={id:wid,workspace_id:wid,version:0,busy:false,stage:'sandbox_complete',data:{connectionVersion:0}};
  global.fetch=async(url,opts={})=>{
    const u=String(url);if(u.includes('/auth/v1/user'))return new Response(JSON.stringify({id:'user',email:'user@test.example'}));
    if(u.includes('/members?'))return new Response(JSON.stringify([{role:'owner'}]));
    if(u.includes('/workspaces?'))return new Response(JSON.stringify([{id:wid,connection_version:0}]));
    if(u.includes('/jobs?'))return new Response(JSON.stringify([opts.method==='PATCH'?{...job,version:1,busy:true}:job]));
    writeCalls++;throw new Error('unexpected endpoint');
  };
  const cookie=seal({access_token:'test',expires:Date.now()+600000},'session');
  try{const result=await request('production',{workspaceId:wid,jobId:wid},{origin:'http://localhost:3000',cookie:'sfda_session='+cookie});assert.equal(result.status,403);assert.match(result.body.error,/Production promotion is disabled/);assert.equal(writeCalls,0);}finally{global.fetch=old;}
});

test('a failed Jira write is checkpointed before dispatch and cannot be unlocked as a blind retry',async()=>{
  const old=global.fetch;const events=[];
  const plan={stories:[{id:'S1',title:'Build field',description:'Create field',acceptance:['Field exists'],requirements:['R1']}]};
  const {hash}=await import('../lib/core.mjs');
  let job={id:wid,workspace_id:wid,version:0,busy:false,stage:'approved',data:{connectionVersion:0,plan,planApproval:{hash:hash(plan)}}};
  const config={url:'https://team.atlassian.net',projectKey:'CRM',issueTypeId:'10001',email:'a@example.com',token:'test'};
  global.fetch=async(url,opts={})=>{
    const u=String(url),body=opts.body?JSON.parse(opts.body):null;
    if(u.includes('/auth/v1/user'))return Response.json({id:'user',email:'user@test.example'});
    if(u.includes('/members?'))return Response.json([{role:'owner'}]);
    if(u.includes('/workspaces?'))return Response.json([{id:wid,connection_version:0}]);
    if(u.includes('/connections?'))return Response.json([{revision:wid,encrypted_config:seal(config,`${wid}:jira`)}]);
    if(u.includes('/rpc/claim_job')){job={...job,busy:true,version:job.version+1,active_operation:body.p_operation,lease_until:new Date(Date.now()+600000).toISOString()};return Response.json([job]);}
    if(u.includes('/rpc/finish_job')){events.push('finish');job={...job,data:body.p_data,stage:body.p_stage,busy:false,version:job.version+1};return Response.json([job]);}
    if(u.includes('/jobs?')){if(opts.method==='PATCH'){events.push('checkpoint');job={...job,...body};}return Response.json([job]);}
    if(u.includes('/search/jql'))return Response.json({issues:[]});
    if(u==='https://team.atlassian.net/rest/api/3/issue'){events.push('external-write');throw new Error('connection lost');}
    throw new Error('Unexpected endpoint: '+u);
  };
  const headers={origin:process.env.APP_ORIGIN,cookie:'sfda_session='+seal({access_token:'test',expires:Date.now()+600000},'session')};
  try{
    const response=await request('jira',{workspaceId:wid,jobId:wid},headers);
    assert.equal(response.status,502);assert.deepEqual(events,['checkpoint','external-write','finish']);
    assert.equal(job.data.paused,true);assert.equal(job.data.operation.phase,'write_started');
    const recovery=await request('reconcile',{workspaceId:wid,jobId:wid,note:'An operator looked at the remote system.'},headers);
    assert.equal(recovery.status,409);assert.match(recovery.body.error,/unknown/);
  }finally{global.fetch=old;}
});
