import {collectQuality} from './quality-adapters.mjs';
import {qualityPolicy} from '../lib/quality-policy.mjs';
import {runQualitySuites,verifyQualitySources} from './quality-suites.mjs';
import {evaluateLicense} from './license.mjs';
import {runSecurity} from './security.mjs';
import {qualityGate} from '../lib/quality.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assert,hash} from '../lib/core.mjs';
import {SalesforceMcp} from './mcp-client.mjs';
import {runBrowserTests} from './browser-tests.mjs';
const exec=promisify(execFile),e=process.env;
const app=new URL(e.DELIVERY_APP_ORIGIN);assert(app.protocol==='https:'&&app.origin===e.DELIVERY_APP_ORIGIN,'Set the exact trusted app origin.');
const base={workspaceId:e.DELIVERY_WORKSPACE,jobId:e.DELIVERY_JOB,pipelineId:e.DELIVERY_PIPELINE,stage:e.DELIVERY_STAGE};
async function api(action,extra={}){
  const oidc=new URL(e.ACTIONS_ID_TOKEN_REQUEST_URL);oidc.searchParams.set('audience',app.origin);
  const idResponse=await fetch(oidc,{headers:{Authorization:`Bearer ${e.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},redirect:'error'});
  assert(idResponse.ok,'GitHub runner identity unavailable.');const token=(await idResponse.json()).value;
  const response=await fetch(app.origin+'/api/service?op=runner',{method:'POST',redirect:'error',signal:AbortSignal.timeout(250000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...base,action,...extra})});
  const result=await response.json();assert(response.ok,result.error||'Pipeline API failed.');return result;
}
const context=await api('context');
const {target,artifacts,testSuite,manualEvidence}=context;
const reviewedQuality=qualityPolicy(context.qualityPolicy,context.qualityPolicy?.planHash,context.policy.stages);
assert(hash(artifacts.files)===artifacts.hash,'Package integrity failed.');
const dir=await mkdtemp(join(tmpdir(),'delivery-'));let mcp,writePending=false,knownFailure=false,qualityBlocked=false;
const evidence={artifactHash:artifacts.hash,orgId:target.orgId,status:'unknown',tests:[]};
async function boundary(){
  const control=await api('control');
  if(control.allowed!==true||control.artifactHash!==artifacts.hash){qualityBlocked=true;throw new Error('Delivery paused or stopped at an action boundary.');}
}
async function perform(kind,tool,waitFor){
  await boundary();
  if(!await verifyQualitySources(reviewedQuality,artifacts,target,mcp)){qualityBlocked=true;throw new Error('Reviewed quality baseline changed or is unavailable.');}
  const inventory=await mcp.call('inspect_capabilities');
  evidence.license=evaluateLicense(reviewedQuality,artifacts,target,inventory);
  const preflight=await api('qualityPreflight',{inventory});
  if(evidence.license.status!=='passed'||preflight.license.status!=='passed'){qualityBlocked=true;throw new Error('Destination license preflight blocked. Inspect required capabilities and capacity.');}
  // Record intent before submission, and ID before polling. Never retry submissions.
  await api('operation',{operation:{kind,phase:'intent'}});
  writePending=true;
  const submitted=await mcp.call(tool);
  evidence[kind]={id:submitted.id,done:false,success:false};
  await api('operation',{operation:{kind,phase:'submitted',id:submitted.id}});
  evidence[kind]=await waitFor(submitted.id);
  await api('operation',{operation:{kind,phase:'completed',id:submitted.id,success:evidence[kind].success}});
  writePending=false;
}

try{
  evidence.security=await runSecurity(artifacts);
  if(evidence.security.status!=='passed'){
    qualityBlocked=true;
    evidence.quality=collectQuality({artifacts,cases:context.requirementCases,testSuite,tests:[],security:evidence.security});
    throw new Error('Security preflight blocked: '+evidence.security.reason);
  }
  await boundary();
  assert(e.SF_CLIENT_ID&&e.SF_USERNAME&&e.SF_JWT_PRIVATE_KEY,'Configure Salesforce JWT credentials for this environment.');
  const browserScenarios=testSuite.scenarios.filter(s=>s.kind==='browser');
  assert(!browserScenarios.length||e.SF_BROWSER_STATE,'Provide a dedicated test-user browser session for browser tests.');
  for(const s of testSuite.scenarios.filter(s=>s.kind==='manual')){
    const record=manualEvidence[s.id];assert(record&&record.artifactHash===artifacts.hash&&record.testHash===testSuite.hash,'Manual acceptance evidence is missing or stale.');
    evidence.tests.push({id:s.id,kind:'manual',passed:true,reviewer:record.userId});
  }
  if(target.name==='production')assert(browserScenarios.every(s=>s.steps.every(a=>['goto','assertVisible','assertText'].includes(a.action))),'Production test suite includes a write. Use a read-only smoke suite before enabling production.');
  await writeFile(join(dir,'jwt.key'),e.SF_JWT_PRIVATE_KEY,{mode:0o600});
  await writeFile(join(dir,'target.json'),JSON.stringify(target),{mode:0o600});
  await writeFile(join(dir,'artifacts.json'),JSON.stringify(artifacts),{mode:0o600});
  // Each hosted job has a fresh home. Auth output is never logged or uploaded.
  const cleanEnv={PATH:e.PATH,HOME:dir,SF_DISABLE_TELEMETRY:'true',SFDX_DISABLE_TELEMETRY:'true'};
  const auth=await exec('sf',['org','login','jwt','--username',e.SF_USERNAME,'--client-id',e.SF_CLIENT_ID,'--jwt-key-file',join(dir,'jwt.key'),'--instance-url',target.url,'--alias','delivery-target','--json'],{env:cleanEnv,timeout:120000,maxBuffer:2e6});
  assert(JSON.parse(auth.stdout).status===0,'Salesforce JWT login failed.');
  mcp=new SalesforceMcp({...cleanEnv,DELIVERY_TARGET_FILE:join(dir,'target.json'),DELIVERY_ARTIFACT_FILE:join(dir,'artifacts.json')});
  await mcp.initialize();await mcp.call('inspect_org');
  async function waitFor(id){for(let n=0;n<240;n++){const result=await mcp.call('deployment_status',{id});if(result.done)return {...result,id};await new Promise(r=>setTimeout(r,15000));}throw new Error('Salesforce result timeout. Reconciliation required.');}
  await perform('validation','validate_metadata',waitFor);
  if(!evidence.validation.success){knownFailure=true;throw new Error('Salesforce check-only validation failed.');}
  await perform('deployment','deploy_metadata',waitFor);
  if(!evidence.deployment.success){knownFailure=true;throw new Error('Salesforce deployment reported failure and rollback.');}
  for(const scenario of testSuite.scenarios.filter(s=>s.kind==='apex')){
    await boundary();
    const result=await mcp.call('run_apex_tests',{classes:scenario.apexClasses});
    evidence.tests.push({id:scenario.id,kind:'apex',passed:result.passed,summary:result.summary,tests:result.tests});
  }
  if(browserScenarios.length)evidence.tests.push(...await runBrowserTests(browserScenarios,target,JSON.parse(e.SF_BROWSER_STATE),{beforeStep:boundary}));
  if(!evidence.tests.every(t=>t.passed)){knownFailure=true;throw new Error('Acceptance tests failed.');}
  evidence.suites=await runQualitySuites(reviewedQuality,artifacts,target,mcp,boundary,{browserState:e.SF_BROWSER_STATE?JSON.parse(e.SF_BROWSER_STATE):undefined});
  evidence.license=evaluateLicense(reviewedQuality,artifacts,target,await mcp.call('inspect_capabilities'));
  evidence.quality=collectQuality({qualityPolicy:reviewedQuality,target,suites:evidence.suites,license:evidence.license,artifacts,validation:evidence.validation,cases:context.requirementCases,testSuite,tests:evidence.tests,security:evidence.security});
  const quality=qualityGate(evidence.quality,artifacts.hash);
  if(!quality.passed){qualityBlocked=true;throw new Error('Quality gate blocked: '+quality.checks.filter(c=>c.status==='blocked').map(c=>c.category).join(', '));}
  evidence.status='passed';evidence.reason='Salesforce validation, deployment and all reviewed scenarios passed.';
}catch(error){
  evidence.status=writePending?'unknown':qualityBlocked?'blocked':knownFailure?'failed':'unknown';
  evidence.reason=knownFailure||qualityBlocked?error.message:'Configuration, authentication, tooling or an ambiguous operation blocked the stage. Inspect the environment and reconcile before retrying.';
}finally{mcp?.close();await rm(dir,{recursive:true,force:true});}
const report=await api('report',{evidence});
console.log(JSON.stringify({stage:base.stage,status:evidence.status,pipelineId:base.pipelineId}));
if(report.repairEligible){await api('repair');console.log('A bounded repair was committed and a new pipeline started from the first environment.');}
if(evidence.status!=='passed')process.exitCode=1;
