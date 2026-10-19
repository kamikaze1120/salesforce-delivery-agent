import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mcpMode,mcpPolicy,deliveryTools,reconciliationTools} from '../runner/mcp-policy.mjs';
import {SalesforceMcp} from '../runner/mcp-client.mjs';
const id='0Af000000000001AAA',other='0Af000000000002AAA',artifactHash='a'.repeat(64);
const target={name:'dev',orgId:'00D000000000001AAA',kind:'developer',url:'https://example.my.salesforce.com'};
const manifest=()=>({version:1,pipelineId:'12345678-1234-1234-1234-123456789abc',stage:'dev',orgId:target.orgId,targetKind:target.kind,targetUrl:target.url,artifactHash,runId:'123',operations:[{kind:'validation',phase:'submitted',id,artifactHash,runId:'123'}]});
test('reconciliation policy permits only exact journal status reads and org inspection',()=>{
 const m=manifest(),p=mcpPolicy('reconciliation',target,m);
 assert.deepEqual(p.tools(),reconciliationTools);
 p.authorize('inspect_org');p.authorize('deployment_status',{id});
 for(const name of ['validate_metadata','deploy_metadata','run_apex_tests','arbitrary'])assert.throws(()=>p.authorize(name),/not allowed/);
 for(const args of [{id:other},{id:id.slice(0,15)},{id:id.slice(0,15)+'BBB'}])assert.throws(()=>p.authorize('deployment_status',args),/outside/);
 for(const args of [{},{id:'../escape'},{id,orgId:target.orgId},null,[]])assert.throws(()=>p.authorize('deployment_status',args));
 assert.throws(()=>p.authorize('inspect_org',{query:'SELECT Secret FROM Org'}),/Unexpected/);
 m.operations.push({...m.operations[0],id:other});p.tools().push('deploy_metadata');
 assert.throws(()=>p.authorize('deployment_status',{id:other}),/outside/);
 assert.throws(()=>p.authorize('deploy_metadata'),/not allowed/);
});
test('reconciliation fails closed on missing, stale or mismatched journal context',()=>{
 for(const change of [m=>m.version=2,m=>m.pipelineId='bad',m=>m.runId=123,m=>m.stage='qa',m=>m.orgId='00D000000000002AAA',m=>m.targetUrl='https://other.my.salesforce.com',m=>m.targetKind='sandbox',m=>m.artifactHash='bad',m=>m.operations=[],m=>m.operations[0].phase='intent',m=>delete m.operations[0].id,m=>m.operations[0].artifactHash='b'.repeat(64),m=>m.operations[0].runId='456',m=>m.operations.push({...m.operations[0],kind:'deployment'}),m=>m.operations.push({...m.operations[0],id:other})]){
  const m=manifest();change(m);assert.throws(()=>mcpPolicy('reconciliation',target,m));
 }
 assert.throws(()=>mcpPolicy('reconciliation',target));
 assert.throws(()=>mcpPolicy('reconciliation',{...target,kind:'production'},manifest()));
});
test('delivery mode retains its tools and invalid modes do not fall back to write access',()=>{
 assert.equal(mcpMode(undefined),'delivery');
 for(const value of ['','reconcile',null,{},'DELIVERY'])assert.throws(()=>mcpMode(value));
 const p=mcpPolicy('delivery',target);assert.deepEqual(p.tools(),deliveryTools);
 p.authorize('validate_metadata');p.authorize('deploy_metadata');p.authorize('run_apex_tests',{classes:['ExampleTest']});
 assert.throws(()=>p.authorize('run_apex_tests',{classes:['../escape']}));
 assert.throws(()=>p.authorize('deploy_metadata',{files:[]}));
});
test('reconciliation client refuses a server that advertises write tools and blocks writes locally',async()=>{
 const client=Object.create(SalesforceMcp.prototype);client.mode='reconciliation';client.process={stdin:{write(){}}};
 client.request=async(method)=>method==='tools/list'?{tools:deliveryTools.map(name=>({name}))}:{};
 await assert.rejects(client.initialize(),/unexpected tools/);
 client.request=async()=>{throw new Error('must not reach transport');};
 await assert.rejects(client.call('deploy_metadata'),/cannot execute/);
});
test('real MCP subprocess limits tools, verifies org identity and reads only saved IDs with offline transport',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mcp-readonly-test-'));let client;
 try{
  // Synthetic CLI identity only. No Salesforce credentials or network are used.
  await writeFile(join(dir,'sf'),'#!/bin/sh\nprintf \'%s\\n\' \'{"result":{"instanceUrl":"https://example.my.salesforce.com","accessToken":"synthetic-test-token"}}\'\n',{mode:0o700});
  await writeFile(join(dir,'target.json'),JSON.stringify(target));
  await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest()));
  await writeFile(join(dir,'offline.mjs'),`
   globalThis.fetch=async(url,options)=>{
    if(!String(url).startsWith('https://example.my.salesforce.com/services/'))throw new Error('Unexpected destination');
    if(String(url).includes('/query?'))return new Response(JSON.stringify({records:[{Id:process.env.TEST_ORG_ID,IsSandbox:false,OrganizationType:'Developer Edition'}]}));
    if(options.headers.SOAPAction!=='checkDeployStatus'||!options.body.includes('<met:asyncProcessId>${id}</met:asyncProcessId>'))throw new Error('Unexpected Salesforce operation');
    return new Response('<result><done>true</done><success>true</success><status>Succeeded</status></result>');
   };
  `);
  const env={PATH:dir,HOME:dir,NODE_OPTIONS:'--import='+pathToFileURL(join(dir,'offline.mjs')).href,TEST_ORG_ID:target.orgId,DELIVERY_MCP_MODE:'reconciliation',DELIVERY_TARGET_FILE:join(dir,'target.json'),DELIVERY_RECONCILIATION_FILE:join(dir,'manifest.json')};
  client=new SalesforceMcp(env);
  // No DELIVERY_ARTIFACT_FILE: recovery must not need a deployable package.
  await client.initialize();
  const org=await client.call('inspect_org');assert.equal(org.Id,target.orgId);
  const status=await client.call('deployment_status',{id});assert.equal(status.done,true);assert.equal(status.success,true);
  const list=await client.request('tools/list');assert.deepEqual(list.tools.map(t=>t.name),reconciliationTools);
  for(const name of ['deploy_metadata','validate_metadata','run_apex_tests'])await assert.rejects(client.request('tools/call',{name,arguments:{}}),/MCP operation failed/);
  await assert.rejects(client.request('tools/call',{name:'deployment_status',arguments:{id:other}}),/MCP operation failed/);
  client.close();client=new SalesforceMcp({...env,TEST_ORG_ID:'00D000000000002AAA'});
  await client.initialize();
  await assert.rejects(client.call('deployment_status',{id}),/MCP operation failed/);
 }finally{client?.close();await rm(dir,{recursive:true,force:true});}
});
