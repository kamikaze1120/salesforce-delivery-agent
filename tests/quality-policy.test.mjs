import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../lib/core.mjs';
import {qualityPolicy,qualityBinding,requireQualityBinding,protectQualitySources} from '../lib/quality-policy.mjs';
import {evaluateQualitySuites,runQualitySuites,parseQualityMetrics,verifyQualitySources} from '../runner/quality-suites.mjs';
import {evaluateLicense} from '../runner/license.mjs';
import {metadataSecurity} from '../runner/metadata-security.mjs';
import {runSecurity} from '../runner/security.mjs';
import {collectQuality} from '../runner/quality-adapters.mjs';
const planHash='a'.repeat(64),sourceHash='b'.repeat(64),target={name:'dev',orgId:'00D000000000001AAA'};
const artifacts={hash:'c'.repeat(64),files:[]};
const base={stages:['dev'],className:'ExistingTests',sourceHash,expected:'Approved business assertion remains true'};
export function fixture(){return {version:1,planHash,reviewReference:'Approved review record QUALITY-42',targets:{dev:target.orgId},security:['crud','fls','sharing'].flatMap(dimension=>['allow','deny'].map(access=>({...base,id:dimension+access,method:dimension+access,dimension,access}))),performance:[{...base,id:'Bulk',method:'bulk',workload:'Insert 200 synthetic records and check business effects',records:200,budgets:{runtimeMs:1000,cpuMs:300,queries:10,dml:2,records:200}}],regression:[{...base,id:'Existing',method:'existing'}],license:[{id:'Edition',kind:'edition',allowed:['Developer Edition'],reason:'Prototype in an explicitly approved development edition',source:'https://developer.salesforce.com/docs',reviewedOn:'2026-10-01'}]};}
const observations=p=>[...p.security,...p.performance,...p.regression].map(c=>({...qualityBinding(p,artifacts,target),className:c.className,method:c.method,sourceHash,outcome:'Pass',runtimeMs:500,metrics:{cpuMs:100,queries:2,dml:1,records:200}}));
const inventory=()=>({orgId:target.orgId,stage:'dev',checkedAt:new Date().toISOString(),edition:'Developer Edition',evidence:{}});
test('reviewed quality policy binds plan, targets, workload and all access dimensions',()=>{
 const p=fixture();assert.deepEqual(qualityPolicy(p,planHash,[target]),p);
 for(const change of [p=>p.planHash='wrong',p=>p.targets.dev='other',p=>p.security.pop(),p=>p.performance[0].budgets.cpuMs=-1,p=>p.performance[0].budgets.records=0,p=>p.performance[0].budgets={records:200},p=>p.regression=[],p=>p.regression[0].sourceHash='old',p=>p.regression.push(p.regression[0]),p=>p.license[0].source='https://evil.example/']){
  const x=fixture();change(x);assert.throws(()=>qualityPolicy(x,planHash,[target]));
 }
});
test('quality suites require exact methods and measured budgets; no aggregate or skipped pass',()=>{
 const p=fixture(),o=observations(p);assert.equal(evaluateQualitySuites(p,artifacts,target,o).performance.status,'passed');
 for(const change of [o=>o.pop(),o=>o.push(o.at(-1)),o=>o.at(-1).outcome='Skip',o=>o.at(-1).sourceHash='stale',o=>o.at(-1).orgId='other',o=>o.at(-1).policyHash='old']){
  const changed=observations(p);change(changed);assert.equal(evaluateQualitySuites(p,artifacts,target,changed).regression.status,'blocked');
 }
 const perf=o.find(x=>x.method==='bulk');perf.metrics.cpuMs=301;assert.equal(evaluateQualitySuites(p,artifacts,target,o).performance.status,'failed');
 delete perf.metrics.cpuMs;assert.equal(evaluateQualitySuites(p,artifacts,target,o).performance.status,'blocked');
 perf.metrics.cpuMs=1;perf.metrics.records=199;assert.equal(evaluateQualitySuites(p,artifacts,target,o).performance.status,'failed');
 o.at(-1).outcome='Fail';assert.equal(evaluateQualitySuites(p,artifacts,target,o).regression.status,'failed');
});
test('baseline executor checks source before and after tests and honors pause boundaries',async()=>{
 const p=fixture();let calls=[];
 const mcp={call:async(name)=>{calls.push(name);return name==='inspect_apex_source'?{sources:[{className:'ExistingTests',hash:sourceHash}]}:{passed:true,tests:observations(p).map(o=>({ApexClass:{Name:o.className},MethodName:o.method,Outcome:'Pass',RunTime:o.runtimeMs,qualityMetrics:o.metrics}))};}};
 const result=await runQualitySuites(p,artifacts,target,mcp,async()=>{});assert.equal(result.regression.status,'passed');assert.deepEqual(calls,['inspect_apex_source','run_apex_tests','inspect_apex_source']);
 let called=false;await assert.rejects(runQualitySuites(p,artifacts,target,{call:()=>{called=true;}},async()=>{throw new Error('paused');}),/paused/);assert.equal(called,false);
 let n=0;const drift={call:async name=>name==='inspect_apex_source'?{sources:[{hash:++n===1?sourceHash:'drift'}]}:await mcp.call(name)};assert.equal((await runQualitySuites(p,artifacts,target,drift,async()=>{})).regression.status,'blocked');
});
test('numeric telemetry rejects duplicate, truncated, wrong-method and malformed logs and excludes secrets',()=>{
 const marker='12:00|USER_DEBUG|[10]|DEBUG|DELIVERY_QUALITY_V1:'+JSON.stringify({method:'bulk',cpuMs:10,queries:2,dml:1,records:200,secret:'must not escape'});
 assert.deepEqual(parseQualityMetrics(marker,'bulk'),{cpuMs:10,queries:2,dml:1,records:200});
 for(const log of [marker+'\n'+marker,marker+'\nMAXIMUM DEBUG LOG SIZE REACHED',marker.replace('"cpuMs":10','"cpuMs":"10"'),'not a user log DELIVERY_QUALITY_V1:{}'])assert.equal(parseQualityMetrics(log,'bulk'),null);
 assert.equal(parseQualityMetrics(marker,'other'),null);
});
test('destination license evidence rejects stale, future, foreign, missing and incomplete facts',()=>{
 const p=fixture(),i=inventory();assert.equal(evaluateLicense(p,artifacts,target,i).status,'passed');
 for(const x of [{...i,orgId:'other'},{...i,stage:'qa'},{...i,checkedAt:new Date(Date.now()-300001).toISOString()},{...i,checkedAt:new Date(Date.now()+10000).toISOString()},{...i,edition:null}])assert.equal(evaluateLicense(p,artifacts,target,x).status,'blocked');
 assert.equal(evaluateLicense(p,artifacts,target,{...i,edition:'Enterprise Edition'}).status,'failed');
 p.license.push({id:'Feature',kind:'featureLicense',key:'Sales Feature',minAvailable:1,source:p.license[0].source,reviewedOn:p.license[0].reviewedOn,reason:'Required feature for this release'});
 assert.equal(evaluateLicense(p,artifacts,target,i).status,'blocked');
 i.evidence.featureLicenses={status:'observed',value:{records:[{MasterLabel:'Sales Feature',Status:'Active',TotalLicenses:3,UsedLicenses:2}],truncated:false}};
 assert.equal(evaluateLicense(p,artifacts,target,i).status,'passed');i.evidence.featureLicenses.value.records[0].UsedLicenses=3;assert.equal(evaluateLicense(p,artifacts,target,i).status,'failed');
 i.evidence.featureLicenses.value.truncated=true;assert.equal(evaluateLicense(p,artifacts,target,i).status,'blocked');
});
test('license rules evaluate concrete capacity and effective API-user access separately',()=>{
 const p=fixture(),i=inventory(),common={source:p.license[0].source,reviewedOn:p.license[0].reviewedOn,reason:'Required operational capacity and read access'};
 p.license.push({...common,id:'Api',kind:'limit',key:'DailyApiRequests',minRemaining:100},{...common,id:'AccountRead',kind:'objectAccess',key:'Account',permissions:['queryable']});
 i.evidence={limits:{status:'observed',value:{DailyApiRequests:{Remaining:100}}},objects:{status:'observed',value:{records:[{name:'Account',queryable:true}]}}};
 assert.equal(evaluateLicense(p,artifacts,target,i).status,'passed');i.evidence.limits.value.DailyApiRequests.Remaining='100';assert.equal(evaluateLicense(p,artifacts,target,i).status,'blocked');i.evidence.limits.value.DailyApiRequests.Remaining=99;assert.equal(evaluateLicense(p,artifacts,target,i).status,'failed');
});
test('structural security accepts constrained metadata and rejects broad access or unsupported extensions',async()=>{
 const object={path:'objects/Test__c.object',content:'<CustomObject><label>Test</label><sharingModel>Private</sharingModel><fields><fullName>Name__c</fullName><type>Text</type></fields></CustomObject>'};
 const permission={path:'permissionsets/Reader.permissionset',content:'<PermissionSet><label>Reader</label><fieldPermissions><field>Test__c.Name__c</field><editable>false</editable><readable>true</readable></fieldPermissions></PermissionSet>'};
 metadataSecurity(object);metadataSecurity(permission);
 for(const content of [object.content.replace('Private','ReadWrite'),object.content.replace('</CustomObject>','<sharingRules>x</sharingRules></CustomObject>'),object.content.replace('Text','Formula')])assert.throws(()=>metadataSecurity({...object,content}));
 assert.throws(()=>metadataSecurity({...permission,content:'<PermissionSet><userPermissions><name>ApiEnabled</name><enabled>1</enabled></userPermissions></PermissionSet>'}));
 const files=[object,permission],a={files,hash:hash(files)};assert.equal((await runSecurity(a,{env:{}})).status,'passed');
 assert.throws(()=>metadataSecurity({path:'flows/X.flow',content:'<Flow/>'}));
});
test('combined gate requires both static and runtime security with exact policy destination binding',()=>{
 const p=fixture(),suites=evaluateQualitySuites(p,artifacts,target,observations(p)),license=evaluateLicense(p,artifacts,target,inventory());
 const input={qualityPolicy:p,target,suites,license,artifacts,cases:[],testSuite:{scenarios:[]},tests:[],security:{artifactHash:artifacts.hash,status:'passed'}};
 const quality=collectQuality(input);requireQualityBinding(quality,p,artifacts.hash,target);
 assert.throws(()=>requireQualityBinding(quality,p,artifacts.hash,{...target,name:'qa'}));
 assert.equal(collectQuality({...input,security:{...input.security,status:'failed'}}).checks.security.status,'failed');
 assert.equal(collectQuality({...input,license:{...license,policyHash:'stale'}}).checks.license.status,'blocked');
 assert.throws(()=>requireQualityBinding({...quality,checks:{...quality.checks,security:{...quality.checks.security,status:'not_applicable'}}},p,artifacts.hash,target));
});

test('pinned regression sources cannot be changed by generation or missing before deployment',async()=>{
 const p=fixture();assert.throws(()=>protectQualitySources(p,{files:[{path:'classes/ExistingTests.cls',content:'rewritten expectations'}]}));
 assert.equal(await verifyQualitySources(p,artifacts,target,{call:async()=>({sources:[]})}),false);
 assert.equal(await verifyQualitySources(p,artifacts,target,{call:async()=>({sources:[{className:'ExistingTests',hash:sourceHash}]})}),true);
});
test('reviewed browser baselines have real duration budgets and block without a session',async()=>{
 const p=fixture();p.performance=[{id:'PageLoad',kind:'browser',stages:['dev'],expected:'The reviewed page heading is visible',workload:'Load the page and assert the visible heading',steps:[{action:'goto',path:'/lightning/o/Account/list'},{action:'assertVisible',by:'text',target:'Accounts'}],budgets:{elapsedMs:2000}}];
 qualityPolicy(p,planHash,[target]);
 const mcp={call:async name=>name==='inspect_apex_source'?{sources:[{className:'ExistingTests',hash:sourceHash}]}:{passed:true,tests:observations(p).filter(x=>x.className).map(x=>({ApexClass:{Name:x.className},MethodName:x.method,Outcome:'Pass'}))}};
 assert.equal((await runQualitySuites(p,artifacts,target,mcp,async()=>{})).performance.status,'blocked');
 let runs=0;
 for(const [elapsedMs,expected] of [[1000,'passed'],[2001,'failed'],[undefined,'blocked']]){
  const r=await runQualitySuites(p,artifacts,target,mcp,async()=>{},{browserState:{cookies:[]},runBrowser:async()=>{runs++;return [{id:'PageLoad',passed:true,elapsedMs}];}});assert.equal(r.performance.status,expected);
 }
 assert.equal(runs,3);
 p.performance[0].steps[0].path='https://evil.example';assert.throws(()=>qualityPolicy(p,planHash,[target]));
});
test('license assignments are evaluated separately from org license inventory',()=>{
 const p=fixture(),i=inventory(),common={source:p.license[0].source,reviewedOn:p.license[0].reviewedOn,reason:'Runner requires this actual assignment'};
 p.license.push({...common,id:'AssignedFeature',kind:'assignedFeature',key:'Sales Feature'},{...common,id:'UserLicense',kind:'connectedUserLicense',key:'Salesforce'});
 qualityPolicy(p,planHash,[target]);
 i.evidence={assignedFeatures:{status:'observed',value:{records:[{name:'Sales Feature'}],truncated:false}},connectedUser:{status:'observed',value:{license:'Salesforce'}}};
 assert.equal(evaluateLicense(p,artifacts,target,i).status,'passed');i.evidence.assignedFeatures.value.records=[];assert.equal(evaluateLicense(p,artifacts,target,i).status,'blocked');
});

test('pipeline snapshots quality policy only from the exact protected runner commit before dispatch',async()=>{
 const {dispatchPipeline}=await import('../lib/pipeline.mjs');
 const sha='d'.repeat(40),plan={requirements:[{id:'REQ-1'}]},stages=['dev','qa','uat','production'].map((name,i)=>({name,environment:name,orgId:`00D00000000000${i+1}AAA`,kind:i===3?'production':'developer',url:`https://${name}.my.salesforce.com`}));
 const reviewed=fixture();reviewed.planHash=hash(plan);reviewed.targets=Object.fromEntries(stages.map(s=>[s.name,s.orgId]));for(const c of [...reviewed.security,...reviewed.performance,...reviewed.regression])c.stages=stages.map(s=>s.name);
 const config={owner:'owner',repo:'repo',token:'synthetic',pipeline:{enabled:true,trustedCommit:sha,ref:'main',stages,maxRepairs:1}};
 const data={plan,orgContext:{org:{id:stages[0].orgId}},artifacts,testSuite:{hash:'tests'},brd:'original',mockup:{hash:'mockup'},architecture:{hash:'architecture'},connectionVersion:0};
 const old=global.fetch;let contentPath,missing=false;global.fetch=async(url)=>{
  const u=String(url);
  if(u.endsWith('/git/ref/heads/main'))return Response.json({object:{sha}});
  if(u.endsWith('/branches/main'))return Response.json({protected:true});
  if(u.endsWith('/branches/main/protection'))return Response.json({allow_force_pushes:{enabled:false},allow_deletions:{enabled:false},enforce_admins:{enabled:true},required_status_checks:{contexts:['check']},required_pull_request_reviews:{required_approving_review_count:1}});
  if(u.includes('/environments/'))return Response.json({protection_rules:[{type:'required_reviewers',reviewers:[{id:1}],prevent_self_review:true}],deployment_branch_policy:{protected_branches:true}});
  if(u.includes('/actions/workflows/'))return Response.json({state:'active'});
  if(u.includes('/contents/quality/policies/')){contentPath=u;return missing?new Response('',{status:404}):Response.json({encoding:'base64',content:Buffer.from(JSON.stringify(reviewed)).toString('base64')});}
  throw new Error('Unexpected endpoint');
 };
 try{
  const run=await dispatchPipeline(config,{},{},data,{id:'reviewer'});assert.deepEqual(run.qualityPolicy,reviewed);assert.ok(contentPath.endsWith(`/quality/policies/${hash(plan)}.json?ref=${sha}`));
  missing=true;await assert.rejects(dispatchPipeline(config,{},{},data,{id:'reviewer'}),/HTTP 404/);
 }finally{global.fetch=old;}
});
