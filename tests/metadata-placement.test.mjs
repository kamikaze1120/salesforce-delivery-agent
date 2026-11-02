import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import { randomBytes } from 'node:crypto';
import {artifactsSchema,sourceFormat,deployDestination,lightningAppFiles,injectPlacement,seal} from '../lib/core.mjs';
import {handler} from '../lib/handler.mjs';
process.env.APP_ORIGIN='http://localhost:3000';
process.env.SUPABASE_URL='https://unit-test.supabase.co';
process.env.SUPABASE_ANON_KEY='anon';
process.env.SUPABASE_SERVICE_ROLE_KEY='service';
process.env.ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
async function hrequest(op, body, headers = {}) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = body ? 'POST' : 'GET'; req.url = '/api/service?op=' + op; req.headers = headers;
  let response = {headers:{}, status:0, body:null};
  const res = {setHeader(k,v){response.headers[k]=v;}, set statusCode(s){response.status=s;}, end(b){response.body=b?JSON.parse(b):null;}};
  await handler(req, res); return response;
}
const anObject=label=>({path:'objects/Invoice__c.object',content:`<?xml version="1.0" encoding="UTF-8"?>\n<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><label>${label}</label><nameField><label>Invoice Number</label><type>AutoNumber</type><displayFormat>INV-{0000}</displayFormat></nameField><sharingModel>ReadWrite</sharingModel></CustomObject>`});
const apexOnly=[{path:'classes/Foo.cls',content:'public with sharing class Foo {}'},{path:'classes/Foo.cls-meta.xml',content:'<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>65.0</apiVersion><status>Active</status></ApexClass>'}];

const tab={path:'tabs/Invoice__c.tab',content:'<?xml version="1.0" encoding="UTF-8"?>\n<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata"><customObject>true</customObject><motif>Custom20: Airplane</motif></CustomTab>'};
const app={path:'applications/Delivery_Console.app',content:'<?xml version="1.0" encoding="UTF-8"?>\n<CustomApplication xmlns="http://soap.sforce.com/2006/04/metadata"><label>Delivery Console</label><navType>Standard</navType><uiType>Lightning</uiType><formFactors>Large</formFactors><tabs>Invoice__c</tabs></CustomApplication>'};
const trigger=[{path:'triggers/InvoiceTrigger.trigger',content:'trigger InvoiceTrigger on Invoice__c (before insert) {}'},{path:'triggers/InvoiceTrigger.trigger-meta.xml',content:'<ApexTrigger xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>65.0</apiVersion><status>Active</status></ApexTrigger>'}];

test('generator accepts Lightning tab, application, and Apex trigger metadata in the manifest',()=>{
  const release=artifactsSchema({files:[tab,app,...trigger]});
  const manifest=release.files.find(f=>f.path==='package.xml').content;
  assert.match(manifest,/<members>Invoice__c<\/members>[\s\S]*<name>CustomTab<\/name>/);
  assert.match(manifest,/<members>Delivery_Console<\/members>[\s\S]*<name>CustomApplication<\/name>/);
  assert.match(manifest,/<members>InvoiceTrigger<\/members>[\s\S]*<name>ApexTrigger<\/name>/);
});

test('an Apex trigger requires its metadata companion file',()=>{
  assert.throws(()=>artifactsSchema({files:[trigger[0]]}),/metadata companion/);
});

test('source format maps tab, application, and trigger paths correctly',()=>{
  const out=sourceFormat([tab,app,...trigger],'force-app/main/default');
  assert.ok(out.find(f=>f.path==='force-app/main/default/tabs/Invoice__c.tab-meta.xml'));
  assert.ok(out.find(f=>f.path==='force-app/main/default/applications/Delivery_Console.app-meta.xml'));
  assert.ok(out.find(f=>f.path==='force-app/main/default/triggers/InvoiceTrigger.trigger'));
  assert.ok(out.find(f=>f.path==='force-app/main/default/triggers/InvoiceTrigger.trigger-meta.xml'));
});

test('deploy destination defaults to setup-only and normalizes unknown types',()=>{
  assert.deepEqual(deployDestination(undefined),{type:'setup_only'});
  assert.deepEqual(deployDestination({type:'whatever'}),{type:'setup_only'});
  assert.deepEqual(deployDestination({type:'setup_only'}),{type:'setup_only'});
});

test('deploy destination derives a safe API name from a new app label',()=>{
  assert.deepEqual(deployDestination({type:'new_app',label:'Delivery Console'}),{type:'new_app',label:'Delivery Console',apiName:'Delivery_Console'});
});

test('deploy destination rejects labels that cannot form a valid API name',()=>{
  assert.throws(()=>deployDestination({type:'new_app',label:'9 Bad'}));
  assert.throws(()=>deployDestination({type:'new_app',label:''}));
  assert.throws(()=>deployDestination({type:'new_app',label:'has#symbol'}));
});

test('setup-only placement generates no app or tab metadata',()=>{
  assert.deepEqual(lightningAppFiles({type:'setup_only'},['Invoice__c']),[]);
});

test('new-app placement builds one application plus a tab per custom object, referencing each tab',()=>{
  const dest=deployDestination({type:'new_app',label:'Delivery Console'});
  const files=lightningAppFiles(dest,['Invoice__c','Payment__c']);
  assert.equal(files.length,3);
  assert.ok(files.find(f=>f.path==='tabs/Invoice__c.tab'));
  assert.ok(files.find(f=>f.path==='tabs/Payment__c.tab'));
  const appFile=files.find(f=>f.path==='applications/Delivery_Console.app');
  assert.ok(appFile);
  assert.match(appFile.content,/<label>Delivery Console<\/label>/);
  assert.match(appFile.content,/<tabs>Invoice__c<\/tabs>/);
  assert.match(appFile.content,/<tabs>Payment__c<\/tabs>/);
  assert.match(appFile.content,/<uiType>Lightning<\/uiType>/);
  // The whole set must pass the generator manifest validation.
  assert.doesNotThrow(()=>artifactsSchema({files}));
});

test('new-app placement requires at least one custom object to tab',()=>{
  const dest=deployDestination({type:'new_app',label:'Delivery Console'});
  assert.throws(()=>lightningAppFiles(dest,[]),/at least one/i);
});

test('placement injection leaves setup-only artifacts unchanged',()=>{
  const output=artifactsSchema({files:[anObject('Invoice')]});
  const same=injectPlacement(output,{type:'setup_only'});
  assert.equal(same.hash,output.hash);
});

test('placement injection adds a Lightning app and an object tab to the generated artifacts',()=>{
  const output=artifactsSchema({files:[anObject('Invoice')]});
  const injected=injectPlacement(output,deployDestination({type:'new_app',label:'Delivery Console'}));
  assert.ok(injected.files.find(f=>f.path==='applications/Delivery_Console.app'));
  assert.ok(injected.files.find(f=>f.path==='tabs/Invoice__c.tab'));
  assert.notEqual(injected.hash,output.hash);
  assert.match(injected.files.find(f=>f.path==='package.xml').content,/<name>CustomApplication<\/name>/);
});

test('placement injection into a new app with no custom objects is rejected',()=>{
  const output=artifactsSchema({files:apexOnly});
  assert.throws(()=>injectPlacement(output,deployDestination({type:'new_app',label:'Delivery Console'})),/at least one/i);
});

test('handler: setDeployDestination stores a normalized new-app destination on the job',async()=>{
  const old=global.fetch; const wid='00000000-0000-4000-8000-000000000002';
  let finished=null;
  const baseJob={id:wid, workspace_id:wid, version:0, busy:false, stage:'approved',
    data:{connectionVersion:0, orgContext:{org:{id:'00D000000000001'}}}};
  global.fetch=async(url,opts={})=>{
    const u=String(url), body=opts.body?JSON.parse(opts.body):null;
    if(u.includes('/auth/v1/user'))return Response.json({id:'owner', email:'owner@test.example'});
    if(u.includes('/members?'))return Response.json([{role:'owner'}]);
    if(u.includes('/workspaces?'))return Response.json([{id:wid, connection_version:0, sod_mode:'warn'}]);
    if(u.includes('/rpc/claim_job'))return Response.json([{...baseJob, busy:true, version:1}]);
    if(u.includes('/rpc/finish_job')){finished={stage:body.p_stage, data:body.p_data}; return Response.json([{...baseJob, busy:false, version:2, stage:body.p_stage, data:body.p_data}]);}
    if(u.includes('/audit_events'))return Response.json([]);
    if(u.includes('/jobs?'))return Response.json([baseJob]);
    throw new Error('Unexpected endpoint: '+u);
  };
  const headers={origin:process.env.APP_ORIGIN, cookie:'sfda_session='+seal({access_token:'test', expires:Date.now()+600000}, 'session')};
  try{
    const r=await hrequest('setDeployDestination', {workspaceId:wid, jobId:wid, destination:{type:'new_app', label:'Delivery Console'}}, headers);
    assert.equal(r.status,200);
    assert.deepEqual(finished.data.deployDestination,{type:'new_app', label:'Delivery Console', apiName:'Delivery_Console'});
  }finally{global.fetch=old;}
});
