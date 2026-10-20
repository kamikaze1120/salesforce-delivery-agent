// Project-owned MCP server: fixed Salesforce tools, no arbitrary shell or SOQL.
import readline from 'node:readline';
import {scanCapabilities} from '../lib/capabilities.mjs';
import {parseQualityMetrics} from './quality-suites.mjs';
import {mcpMode,mcpPolicy} from './mcp-policy.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {assert,origin,zip,xml,xmlValue,hash} from '../lib/core.mjs';
import {sf,metadata,deploymentStatus,remote,apiVersion} from '../lib/integrations.mjs';
const exec=promisify(execFile);
const target=JSON.parse(await readFile(process.env.DELIVERY_TARGET_FILE,'utf8'));
const mode=mcpMode(process.env.DELIVERY_MCP_MODE);
const manifest=mode==='reconciliation'?JSON.parse(await readFile(process.env.DELIVERY_RECONCILIATION_FILE,'utf8')):undefined;
const policy=mcpPolicy(mode,target,manifest);
// Recovery never loads a deployable artifact. Unknown modes fail before authentication.
const artifacts=mode==='delivery'?JSON.parse(await readFile(process.env.DELIVERY_ARTIFACT_FILE,'utf8')):undefined;
if(artifacts)assert(hash(artifacts.files)===artifacts.hash,'Artifact integrity check failed.');
const auth=JSON.parse((await exec('sf',['org','display','--target-org','delivery-target','--json'],{maxBuffer:2e6})).stdout).result;
const c={instanceUrl:origin(auth.instanceUrl,'Salesforce'),accessToken:auth.accessToken};
assert(c.accessToken,'Salesforce authentication is missing.');
const tools=[
  {name:'inspect_org',description:'Verify the configured org identity and edition.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'inspect_capabilities',description:'Read destination license, limit and API-user capability inventory.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'inspect_apex_source',description:'Read source hashes of explicitly named local Apex classes.',inputSchema:{type:'object',properties:{classes:{type:'array',items:{type:'string'}}},required:['classes'],additionalProperties:false}},
  {name:'validate_metadata',description:'Validate the immutable package with RunLocalTests and rollbackOnError.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'deploy_metadata',description:'Deploy only the immutable package to the configured, verified org.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'deployment_status',description:'Read a submitted metadata deployment result.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
  {name:'run_apex_tests',description:'Run explicitly named Apex tests in the configured org.',inputSchema:{type:'object',properties:{classes:{type:'array',items:{type:'string'}}},required:['classes'],additionalProperties:false}}
].filter(tool=>policy.tools().includes(tool.name));
async function identity(){
  const result=await sf(c,'/query?q='+encodeURIComponent('SELECT Id, Name, IsSandbox, OrganizationType FROM Organization LIMIT 1'));
  const org=result.records?.[0];assert(org?.Id?.slice(0,15)===target.orgId.slice(0,15),'Org ID mismatch.');
  const valid=target.kind==='sandbox'?org.IsSandbox===true:target.kind==='developer'?org.IsSandbox===false&&org.OrganizationType==='Developer Edition':target.kind==='production'&&target.name==='production'&&org.IsSandbox===false&&org.OrganizationType!=='Developer Edition';
  assert(valid,'Org type mismatch.');assert(c.instanceUrl===target.url,'Org instance URL mismatch.');return org;
}
async function call(name,args){
  policy.authorize(name,args);await identity();
  if(name==='inspect_org')return identity();
  if(name==='inspect_capabilities'){
    const org=await identity();let userId=auth.userId;
    // CLI versions do not consistently include userId in org display output.
    // Resolve only the authenticated username, never a model-supplied identity.
    if(!/^005[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(userId||'')&&/^[A-Za-z0-9._%+@-]{1,200}$/.test(auth.username||''))try{
      const user=await sf(c,'/query?q='+encodeURIComponent(`SELECT Id FROM User WHERE Username = '${auth.username}' LIMIT 1`));
      if(user.done===true&&user.records?.length===1)userId=user.records[0].Id;
    }catch{/* User-scoped probes remain unknown if identity cannot be read. */}
    return {...await scanCapabilities(path=>sf(c,path),{id:target.orgId,organizationType:org.OrganizationType,environment:target.kind},userId),stage:target.name};
  }
  if(name==='inspect_apex_source'){
    const query=`SELECT Name, Body FROM ApexClass WHERE NamespacePrefix = null AND Name IN (${args.classes.map(n=>"'"+n+"'").join(',')})`;
    const read=await sf(c,'/tooling/query?q='+encodeURIComponent(query));
    assert(read.done===true&&Array.isArray(read.records)&&read.records.every(r=>typeof r.Body==='string'),'Apex baseline source unavailable.');
    return {sources:read.records.map(r=>({className:r.Name,hash:hash(r.Body)}))};
  }
  if(name==='deployment_status')return deploymentStatus(c,args.id);
  if(name==='run_apex_tests'){
    assert(Array.isArray(args.classes)&&args.classes.length>0&&args.classes.length<=50&&args.classes.every(n=>/^[A-Za-z][A-Za-z0-9_]*$/.test(n)),'Invalid Apex classes.');
    const result=await exec('sf',['apex','run','test','--target-org','delivery-target',...args.classes.flatMap(n=>['--class-names',n]),'--wait','60','--result-format','json','--json'],{timeout:3700000,maxBuffer:5e6}).catch(e=>({stdout:e.stdout||'{}'}));
    const report=JSON.parse(result.stdout),tests=[],runId=report.result?.summary?.testRunId;
    if(!/^707[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(runId||''))return {passed:false,tests:[]};
    for(const row of report.result?.tests||[]){
      // Resolve method results/log ownership through Salesforce, not supplied telemetry IDs.
      if(!/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(row.Id||''))continue;
      const observed=await sf(c,'/tooling/query?q='+encodeURIComponent(`SELECT Id, ApexLogId, ApexClass.Name, ApexClass.NamespacePrefix, MethodName, Outcome, RunTime FROM ApexTestResult WHERE Id = '${row.Id}' AND AsyncApexJobId = '${runId}'`));
      if(observed.done!==true||observed.records?.length!==1)continue;
      const t=observed.records[0];if(!args.classes.includes(t.ApexClass?.Name)||t.ApexClass?.NamespacePrefix)continue;
      let qualityMetrics=null;
      if(/^07L[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(t.ApexLogId||''))try{
        const log=await remote(`${c.instanceUrl}/services/data/v${apiVersion()}/tooling/sobjects/ApexLog/${t.ApexLogId}/Body`,{headers:{Authorization:`Bearer ${c.accessToken}`}},'Salesforce test log',true);
        qualityMetrics=parseQualityMetrics(log,t.MethodName);
      }catch{/* Missing telemetry blocks any required performance metric. */}
      tests.push({testRunId:runId,resultId:t.Id,ApexClass:{Name:t.ApexClass.Name,NamespacePrefix:t.ApexClass.NamespacePrefix||null},MethodName:t.MethodName,Outcome:t.Outcome,RunTime:t.RunTime,qualityMetrics});
    }
    return {passed:report.status===0&&report.result?.summary?.outcome==='Passed'&&tests.length>0&&tests.every(t=>t.Outcome==='Pass'),tests};
  }
  const checkOnly=name==='validate_metadata';
  const payload=`<met:ZipFile>${zip(artifacts.files).toString('base64')}</met:ZipFile><met:DeployOptions><met:checkOnly>${checkOnly}</met:checkOnly><met:ignoreWarnings>false</met:ignoreWarnings><met:rollbackOnError>true</met:rollbackOnError><met:singlePackage>true</met:singlePackage><met:testLevel>RunLocalTests</met:testLevel></met:DeployOptions>`;
  const reply=await metadata(c,'deploy',payload),id=xmlValue(reply,'id');assert(/^[a-zA-Z0-9]{15,18}$/.test(id),'Missing deployment ID; outcome must be reconciled.');return {id,checkOnly,hash:artifacts.hash};
}
const lines=readline.createInterface({input:process.stdin});
for await(const line of lines){
  if(line.length>2e6)continue;
  let request;try{
    request=JSON.parse(line);if(request.id===undefined)continue;
    let result;
    if(request.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'delivery-studio-salesforce',version:'0.4.0'}};
    else if(request.method==='tools/list')result={tools};
    else if(request.method==='ping')result={};
    else if(request.method==='tools/call')result={content:[{type:'text',text:JSON.stringify(await call(request.params.name,request.params.arguments||{}))}]};
    else throw new Error('Unsupported MCP method.');
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\n');
  }catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request?.id??null,error:{code:-32000,message:'Salesforce MCP operation failed. Inspect org permissions, target configuration, or deployment status.'}})+'\n');}
}
