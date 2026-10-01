import test from 'node:test';
import assert from 'node:assert/strict';
import {commitArtifacts,deploy,deploymentStatus,createStory} from '../lib/integrations.mjs';
import {artifactsSchema} from '../lib/core.mjs';
const wid='00000000-0000-4000-8000-000000000001';
const artifacts=artifactsSchema({files:[{path:'classes/Request.cls',content:'public with sharing class Request {}'},{path:'classes/Request.cls-meta.xml',content:'<ApexClass></ApexClass>'}]});
test('Git commits create a new isolated branch without updating the base ref',async()=>{
  const old=global.fetch,calls=[];const replies=[{object:{sha:'base'}},{tree:{sha:'base-tree'}},{sha:'tree'},{sha:'new-commit'},{ref:'refs/heads/sfda/'+wid}];
  global.fetch=async(url,opts={})=>{calls.push({url:String(url),method:opts.method||'GET',body:opts.body?JSON.parse(opts.body):null});return new Response(JSON.stringify(replies.shift()));};
  try{const result=await commitArtifacts({owner:'team',repo:'repo',url:'https://github.com/team/repo',branch:'main',sourcePath:'force-app/main/default',token:'test'},artifacts,wid,'Request');assert.equal(result.branch,'sfda/'+wid);assert.equal(calls.filter(c=>c.method==='PATCH').length,0);assert.equal(calls.at(-1).body.ref,'refs/heads/sfda/'+wid);assert.match(calls[2].body.tree[0].path,/force-app\/main\/default\/classes/);}finally{global.fetch=old;}
});
test('sandbox validation sends check-only, rollback, and local test options',async()=>{
  const old=global.fetch;let soap='';global.fetch=async(url,opts={})=>{if(String(url).includes('/query?'))return new Response(JSON.stringify({records:[{Id:'00D000000000001',Name:'Dev',IsSandbox:true}]}));soap=opts.body;return new Response('<deployResponse><result><id>0Af000000000001</id></result></deployResponse>');};
  try{const result=await deploy({instanceUrl:'https://team--dev.sandbox.my.salesforce.com',accessToken:'test'},artifacts,true);assert.equal(result.checkOnly,true);assert.match(soap,/<met:checkOnly>true/);assert.match(soap,/<met:testLevel>RunLocalTests/);assert.match(soap,/<met:rollbackOnError>true/);}finally{global.fetch=old;}
});
test('Salesforce status surfaces real failures rather than claiming success',async()=>{
  const old=global.fetch;global.fetch=async()=>new Response('<result><done>true</done><success>false</success><status>Failed</status><numberTestErrors>1</numberTestErrors><componentFailures><fullName>Request</fullName><problem>Missing field</problem></componentFailures></result>');
  try{const result=await deploymentStatus({instanceUrl:'https://team--dev.sandbox.my.salesforce.com',accessToken:'test'},'0Af000000000001');assert.equal(result.success,false);assert.equal(result.testErrors,1);assert.equal(result.messages[0].problem,'Missing field');}finally{global.fetch=old;}
});
test('Jira retries recover a marked issue without creating another one',async()=>{
  const old=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response(JSON.stringify({issues:[{key:'CRM-12'}]}));};
  try{const result=await createStory({url:'https://team.atlassian.net',projectKey:'CRM',email:'user@test.example',token:'test'}, {id:'STORY-1'},wid);assert.equal(result.key,'CRM-12');assert.equal(result.recovered,true);assert.equal(calls,1);}finally{global.fetch=old;}
});
test('reviewed revisions advance only the recorded delivery branch with force disabled',async()=>{
  const old=global.fetch,calls=[],branch='sfda/'+wid;
  const replies=[{object:{sha:'previous'}},{tree:{sha:'base-tree'}},{sha:'tree'},{sha:'next'},{}];
  global.fetch=async(url,opts={})=>{calls.push({url:String(url),method:opts.method,body:opts.body?JSON.parse(opts.body):null});return new Response(JSON.stringify(replies.shift()));};
  try{await commitArtifacts({owner:'team',repo:'repo',url:'https://github.com/team/repo',branch:'main',sourcePath:'force-app/main/default',token:'test'},artifacts,wid,'Revision',{branch,commit:'previous'});assert.equal(calls.at(-1).method,'PATCH');assert.equal(calls.at(-1).body.force,false);assert.match(calls.at(-1).url,/sfda%2F/);}finally{global.fetch=old;}
});
