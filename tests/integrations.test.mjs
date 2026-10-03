import test from 'node:test';
import assert from 'node:assert/strict';
import {commitArtifacts,deploy,deploymentStatus,createStory,jiraPreflight,verifyModel} from '../lib/integrations.mjs';
import {artifactsSchema,jiraDefaults} from '../lib/core.mjs';
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

const jiraConfig={url:'https://team.atlassian.net',projectKey:'CRM',issueTypeId:'10001',email:'owner@example.test',token:'synthetic'};
const testStory={id:'STORY-1',title:'Synthetic request',description:'Create a request.',requirements:['REQ-1'],acceptance:['Request exists.']};
test('Jira paginates metadata and blocks missing required defaults before any write checkpoint',async()=>{
  const old=global.fetch;let writes=0,checkpoints=0;
  global.fetch=async(url,opts={})=>{
    const u=String(url);
    if(u.includes('/search/jql'))return Response.json({issues:[]});
    if(u.includes('/issuetypes/10001'))return Response.json({fields:[{fieldId:'customfield_10010',name:'Business unit',required:true,operations:['set']},{fieldId:'labels',operations:['set']}],total:2});
    if(u.includes('startAt=0'))return Response.json({issueTypes:[{id:'10000',name:'Task'}],total:2});
    if(u.includes('startAt=1'))return Response.json({issueTypes:[{id:'10001',name:'Story'}],total:2});
    writes++;return Response.json({key:'CRM-1'});
  };
  try{
    await assert.rejects(()=>createStory(jiraConfig,testStory,wid,async()=>checkpoints++),/Business unit/);
    assert.equal(checkpoints,0);assert.equal(writes,0);
  }finally{global.fetch=old;}
});
test('Jira includes configured defaults and checkpoints immediately before issue creation',async()=>{
  const old=global.fetch;const events=[];
  global.fetch=async(url,opts={})=>{
    const u=String(url);
    if(u.includes('/search/jql'))return Response.json({issues:[]});
    if(u.includes('/issuetypes/10001'))return Response.json({fields:[{fieldId:'customfield_10010',name:'Business unit',required:true,operations:['set']},{fieldId:'labels',operations:['set']}],total:2});
    if(u.includes('/issuetypes'))return Response.json({issueTypes:[{id:'10001',name:'Story'}],total:1});
    events.push('write');const fields=JSON.parse(opts.body).fields;
    assert.deepEqual(fields.customfield_10010,{id:'42'});assert.equal(fields.project.key,'CRM');assert.match(fields.labels[0],/^sfda-/);
    return Response.json({key:'CRM-1'});
  };
  try{
    await createStory({...jiraConfig,fieldDefaults:{customfield_10010:{id:'42'}}},testStory,wid,async()=>events.push('checkpoint'));
    assert.deepEqual(events,['checkpoint','write']);
    assert.throws(()=>jiraDefaults({project:{key:'OTHER'}}),/Unsupported/);
    assert.throws(()=>jiraDefaults('{bad'),/JSON/);
  }finally{global.fetch=old;}
});
test('LLM verification makes a synthetic JSON request and rejects incompatible output',async()=>{
  const old=global.fetch;let correct=true;
  global.fetch=async(url,opts)=>{
    const body=JSON.parse(opts.body);assert.deepEqual(body.response_format,{type:'json_object'});assert.deepEqual(JSON.parse(body.messages[1].content),{connectionTest:true});
    return Response.json({model:'test-model',usage:{total_tokens:12},choices:[{finish_reason:'stop',message:{content:JSON.stringify(correct?{connectionTest:'ok'}:{other:'value'})}}]});
  };
  try{
    const config={provider:'openai',model:'test-model',token:'synthetic'};
    assert.equal((await verifyModel(config)).usage.total_tokens,12);
    correct=false;await assert.rejects(()=>verifyModel(config),/expected JSON/);
  }finally{global.fetch=old;}
});
