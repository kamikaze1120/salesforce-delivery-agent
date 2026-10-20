import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hash} from '../lib/core.mjs';
import {SalesforceMcp} from '../runner/mcp-client.mjs';
const target={name:'dev',orgId:'00D000000000001AAA',kind:'developer',url:'https://example.my.salesforce.com'};
test('real MCP transport reads baseline hashes, destination inventory and run-bound numeric metrics without leaking logs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mcp-quality-'));let client;
 try{
  const login={result:{instanceUrl:target.url,accessToken:'synthetic',userId:'005000000000001AAA'}};
  const testReport={status:0,result:{summary:{outcome:'Passed',testRunId:'707000000000001AAA'},tests:[{Id:'07M000000000001AAA'}]}};
  await writeFile(join(dir,'sf'),`#!/bin/sh\nif [ "$1" = "apex" ]; then\nprintf '%s\\n' '${JSON.stringify(testReport)}'\nelse\nprintf '%s\\n' '${JSON.stringify(login)}'\nfi\n`,{mode:0o700});
  await writeFile(join(dir,'target.json'),JSON.stringify(target));const files=[{path:'classes/ExistingTests.cls',content:'@IsTest class ExistingTests {}'}];
  await writeFile(join(dir,'artifacts.json'),JSON.stringify({files,hash:hash(files)}));
  await writeFile(join(dir,'offline.mjs'),`
   globalThis.fetch=async(url)=>{
    const u=decodeURIComponent(String(url));if(!u.startsWith('${target.url}/services/data/'))throw new Error('Unexpected destination');
    if(u.includes('FROM Organization'))return Response.json({done:true,records:[{Id:'${target.orgId}',IsSandbox:false,OrganizationType:'Developer Edition'}]});
    if(u.includes('FROM ApexClass'))return Response.json({done:true,records:[{Name:'ExistingTests',Body:'@IsTest class ExistingTests {}'}]});
    if(u.includes('FROM ApexTestResult')){
     if(!u.includes("AsyncApexJobId = '707000000000001AAA'"))throw new Error('Missing test-run binding');
     return Response.json({done:true,records:[{Id:'07M000000000001AAA',ApexClass:{Name:'ExistingTests'},MethodName:'bulk',Outcome:'Pass',RunTime:20,ApexLogId:'07L000000000001AAA'}]});
    }
    if(u.endsWith('/Body'))return new Response('secret log content\\n00:00|USER_DEBUG|[1]|DEBUG|DELIVERY_QUALITY_V1:{"method":"bulk","cpuMs":1,"queries":2,"dml":1,"records":200}');
    if(u.endsWith('/limits'))return Response.json({DailyApiRequests:{Remaining:100}});
    if(u.endsWith('/sobjects'))return Response.json({sobjects:[{name:'Account',queryable:true}]});
    if(u.endsWith('/describe'))return Response.json({fields:[{name:'Name'},{name:'Status'},{name:'TotalLicenses'},{name:'UsedLicenses'}]});
    if(u.includes('FROM User WHERE'))return Response.json({records:[{Profile:{UserLicense:{Name:'Salesforce'}}}]});
    return Response.json({done:true,records:[]});
   };
  `);
  client=new SalesforceMcp({PATH:dir,HOME:dir,NODE_OPTIONS:'--import='+pathToFileURL(join(dir,'offline.mjs')).href,DELIVERY_TARGET_FILE:join(dir,'target.json'),DELIVERY_ARTIFACT_FILE:join(dir,'artifacts.json')});
  await client.initialize();const sources=await client.call('inspect_apex_source',{classes:['ExistingTests']});assert.equal(sources.sources[0].hash,hash(files[0].content));assert.ok(!JSON.stringify(sources).includes('@IsTest'));
  const inventory=await client.call('inspect_capabilities');assert.equal(inventory.orgId,target.orgId);assert.equal(inventory.stage,'dev');assert.equal(inventory.evidence.connectedUser.value.license,'Salesforce');
  const result=await client.call('run_apex_tests',{classes:['ExistingTests']});assert.equal(result.passed,true);assert.deepEqual(result.tests[0].qualityMetrics,{cpuMs:1,queries:2,dml:1,records:200});assert.ok(!JSON.stringify(result).includes('secret'));
  await assert.rejects(client.call('inspect_apex_source',{classes:["X' OR Name != '"]}));
 }finally{client?.close();await rm(dir,{recursive:true,force:true});}
});
