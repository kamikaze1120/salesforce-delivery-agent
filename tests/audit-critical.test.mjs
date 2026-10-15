import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {handler} from '../lib/handler.mjs';
import {artifactsSchema,seal} from '../lib/core.mjs';
import {deploymentStatus} from '../lib/integrations.mjs';

const id='00000000-0000-4000-8000-000000000001';
process.env.APP_ORIGIN='https://delivery.example';
process.env.SUPABASE_URL='https://unit-test.supabase.co';
process.env.SUPABASE_ANON_KEY='anon';
process.env.SUPABASE_SERVICE_ROLE_KEY='service';
process.env.ENCRYPTION_KEY=randomBytes(32).toString('base64');

test('runner POST reaches identity verification without browser origin; GET and invalid identities fail closed',async()=>{
 const old=global.fetch;let writes=0,reads=0;
 global.fetch=async(url,options={})=>{
  assert.equal(options.method,'GET');reads++;
  const u=String(url);
  if(u.includes('/workspaces?'))return Response.json([{id,connection_version:1}]);
  if(u.includes('/jobs?'))return Response.json([{id,workspace_id:id,data:{pipeline:{id,connectionVersion:1,createdAt:new Date().toISOString()}}}]);
  if(u.includes('/connections?'))return Response.json([{revision:id,encrypted_config:seal({owner:'owner',repo:'repo',token:'synthetic'},`${id}:github`)}]);
  writes++;throw new Error('Unexpected request');
 };
 async function request(method,authorization){let status,body;await handler({method,url:'/api/service?op=runner',headers:{authorization},body:{workspaceId:id,jobId:id,pipelineId:id,stage:'dev',action:'context'}},{setHeader(){},set statusCode(v){status=v;},end(v){body=JSON.parse(v);}});return {status,body};}
 try{
  assert.equal((await request('GET')).status,405);
  assert.equal((await request('POST')).status,401);
  assert.equal((await request('POST','Bearer invalid')).status,401);
  assert.ok(reads>0);assert.equal(writes,0);
 }finally{global.fetch=old;}
});

async function status(xml){const old=global.fetch;global.fetch=async()=>new Response(xml);try{return await deploymentStatus({instanceUrl:'https://unit.my.salesforce.com',accessToken:'synthetic'},'0Af000000000001');}finally{global.fetch=old;}}
const envelope=result=>`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><m:checkDeployStatusResponse xmlns:m="http://soap.sforce.com/2006/04/metadata"><m:result>${result}</m:result></m:checkDeployStatusResponse></s:Body></s:Envelope>`;

test('component success cannot override failed overall deployment',async()=>{
 const result=await status(envelope('<details><componentSuccesses><success>true</success></componentSuccesses><componentFailures><fullName>Broken</fullName><problem>Compile failure</problem></componentFailures></details><done>true</done><success>false</success><status>Failed</status><numberComponentErrors>1</numberComponentErrors>'));
 assert.equal(result.success,false);assert.equal(result.componentErrors,1);assert.equal(result.messages[0].problem,'Compile failure');
});
test('only unambiguous successful terminal result with no errors passes',async()=>{
 const base='<done>true</done><success>true</success><status>Succeeded</status>';
 assert.equal((await status(envelope(base))).success,true);
 for(const extra of ['<numberTestErrors>1</numberTestErrors>','<numberComponentErrors>1</numberComponentErrors>','<details><runTestResult><failures><message>assertion failed</message></failures></runTestResult></details>'])assert.equal((await status(envelope(base+extra))).success,false);
 assert.equal((await status(envelope(base.replace('Succeeded','Failed')))).success,false);
 await assert.rejects(()=>status(envelope(base+'<success>false</success>')),/ambiguous/);
 await assert.rejects(()=>status('<result><done>true</done>'),/Malformed/);
 await assert.rejects(()=>status('<!DOCTYPE result [<!ENTITY x "true">]><result/>'),/Unsafe/);
});
test('coverage is scoped to overall deployment test results',async()=>{
 const r=await status(envelope('<details><runTestResult><numTestsRun>3</numTestsRun><codeCoverage><name>Demo</name><numLocations>10</numLocations><numLocationsNotCovered>2</numLocationsNotCovered></codeCoverage></runTestResult></details><done>true</done><success>true</success><status>Succeeded</status>'));
 assert.equal(r.testsRun,3);assert.equal(r.coverage[0].uncovered,2);
});

const artifact=content=>artifactsSchema({files:[{path:'permissionsets/Demo.permissionset',content}]});
test('permission policy handles namespace aliases, numeric booleans, entities and duplicate values',()=>{
 for(const prefix of ['', 'm:'])for(const enabled of ['true','1']){
  assert.throws(()=>artifact(`<PermissionSet xmlns:m="http://soap.sforce.com/2006/04/metadata"><${prefix}userPermissions><${prefix}enabled>${enabled}</${prefix}enabled><${prefix}name>ModifyAllData</${prefix}name></${prefix}userPermissions></PermissionSet>`),/administration/);
 }
 assert.throws(()=>artifact('<PermissionSet><userPermissions><enabled>true</enabled><name>ModifyAll&#68;ata</name></userPermissions></PermissionSet>'),/administration/);
 assert.throws(()=>artifact('<PermissionSet><userPermissions><enabled>false</enabled><enabled>true</enabled><name>ModifyAllData</name></userPermissions></PermissionSet>'),/ambiguous/);
 assert.throws(()=>artifact('<PermissionSet><objectPermissions><modifyAllRecords>true</modifyAllRecords></objectPermissions></PermissionSet>'),/broad object/);
 assert.doesNotThrow(()=>artifact('<PermissionSet><userPermissions><enabled>false</enabled><name>ModifyAllData</name></userPermissions></PermissionSet>'));
});
