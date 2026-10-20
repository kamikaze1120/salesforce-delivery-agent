// Read-only worker. No metadata submission, tests, repair, or promotion.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assert,hash} from '../lib/core.mjs';
import {mcpPolicy} from './mcp-policy.mjs';
import {SalesforceMcp} from './mcp-client.mjs';
const e=process.env,exec=promisify(execFile);
async function main(){
 const app=new URL(e.DELIVERY_APP_ORIGIN);assert(app.protocol==='https:'&&app.origin===e.DELIVERY_APP_ORIGIN,'Invalid trusted app origin.');
 const base={workspaceId:e.DELIVERY_WORKSPACE,jobId:e.DELIVERY_JOB,pipelineId:e.DELIVERY_PIPELINE,stage:e.DELIVERY_STAGE,reconciliationId:e.DELIVERY_RECONCILIATION};
 async function api(action,extra={}){
  const url=new URL(e.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience',app.origin);
  const tokenResponse=await fetch(url,{headers:{Authorization:`Bearer ${e.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(30000)});
  assert(tokenResponse.ok,'Runner identity unavailable.');const {value}=await tokenResponse.json();
  const response=await fetch(app.origin+'/api/service?op=runner',{method:'POST',redirect:'error',signal:AbortSignal.timeout(250000),headers:{Authorization:`Bearer ${value}`,'Content-Type':'application/json'},body:JSON.stringify({...base,action,...extra})});
  assert(response.ok,'Reconciliation API rejected this request.');return response.json();
 }
 const {target,manifest,contextHash}=await api('recoveryContext');
 assert(hash({target,manifest})===contextHash,'Recovery context integrity failed.');mcpPolicy('reconciliation',target,manifest);
 assert(e.SF_CLIENT_ID&&e.SF_USERNAME&&e.SF_JWT_PRIVATE_KEY,'Missing environment authentication.');
 const dir=await mkdtemp(join(tmpdir(),'reconciliation-'));let mcp;
 try{
  for(const [name,content] of [['jwt.key',e.SF_JWT_PRIVATE_KEY],['target.json',JSON.stringify(target)],['manifest.json',JSON.stringify(manifest)]])await writeFile(join(dir,name),content,{mode:0o600});
  const cleanEnv={PATH:e.PATH,HOME:dir,SF_DISABLE_TELEMETRY:'true',SFDX_DISABLE_TELEMETRY:'true'};
  const auth=await exec('sf',['org','login','jwt','--username',e.SF_USERNAME,'--client-id',e.SF_CLIENT_ID,'--jwt-key-file',join(dir,'jwt.key'),'--instance-url',target.url,'--alias','delivery-target','--json'],{env:cleanEnv,timeout:120000,maxBuffer:2e6});
  assert(JSON.parse(auth.stdout).status===0,'Authentication failed.');
  mcp=new SalesforceMcp({...cleanEnv,DELIVERY_MCP_MODE:'reconciliation',DELIVERY_TARGET_FILE:join(dir,'target.json'),DELIVERY_RECONCILIATION_FILE:join(dir,'manifest.json')});
  await mcp.initialize();await mcp.call('inspect_org');
  // One observation per ID. In-progress operations remain unresolved for a later reviewed request.
  const results=[];
  for(const op of manifest.operations){const result=await mcp.call('deployment_status',{id:op.id});results.push({kind:op.kind,id:op.id,done:result.done,success:result.success,status:result.status});}
  const report=await api('recoveryReport',{observation:{contextHash,results}});
  console.log(JSON.stringify({reconciliationId:base.reconciliationId,status:report.status,terminal:report.terminal}));
 }finally{mcp?.close();await rm(dir,{recursive:true,force:true});}
}
try{await main();}catch{console.error('Read-only reconciliation stopped. Inspect the saved request and runner status; recovery remains blocked.');process.exitCode=1;}
