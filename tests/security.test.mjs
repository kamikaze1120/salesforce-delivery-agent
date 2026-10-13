import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {hash} from '../lib/core.mjs';
import {evaluateSecurity,securityScope,securityPolicy,runSecurity} from '../runner/security.mjs';
import {collectQuality} from '../runner/quality-adapters.mjs';
const pkg=(files=[{path:'classes/Safe.cls',content:'public with sharing class Safe {}'}])=>({files,hash:hash(files)});
const report=()=>({versions:{'code-analyzer':'5.0.0',pmd:'7.0.0'},violationCounts:{total:0,sev1:0,sev2:0,sev3:0,sev4:0,sev5:0},violations:[]});
const observation=a=>({artifactHash:a.hash,policy:securityPolicy,exitCode:0,selector:'pmd:Security',suppressionsDisabled:true,targets:['classes/Safe.cls'],pluginVersion:'5.0.0',report:report()});
test('Apex security evidence binds exact source, tool, policy and complete target list',()=>{
 const a=pkg(),o=observation(a);assert.equal(evaluateSecurity(a,o).status,'passed');
 for(const changes of [{artifactHash:'stale'},{exitCode:1},{policy:'weaker'},{selector:'Recommended'},{suppressionsDisabled:false},{targets:[]},{pluginVersion:'latest'}])assert.equal(evaluateSecurity(a,{...o,...changes}).status,'blocked');
 a.files[0].content+=' // modified';assert.equal(evaluateSecurity(a,o).status,'blocked');
});
test('unsupported metadata, traversal, duplicates, empty packages and suppression markers never pass',()=>{
 for(const path of ['../Safe.cls','classes/../../Safe.cls','flows/F.flow','objects/A.object','permissionsets/P.permissionset','code-analyzer.yml','lwc/x/x.js'])assert.equal(securityScope(pkg([{path,content:'x'}])).status,'blocked');
 assert.equal(securityScope(pkg([])).status,'blocked');
 assert.equal(securityScope(pkg([...pkg().files,...pkg().files])).status,'blocked');
 for(const content of ['// NOPMD',"@SuppressWarnings('PMD')",'// code-analyzer-suppress'])assert.equal(securityScope(pkg([{path:'classes/Safe.cls',content}])).status,'blocked');
});
test('missing versions, inconsistent counts and malformed findings block',()=>{
 const a=pkg();for(const mutate of [r=>delete r.versions.pmd,r=>r.violationCounts.total=1,r=>r.violationCounts.sev1=-1,r=>r.violations.push({severity:0}),r=>r.violationCounts.sev2='0']){const o=observation(a);mutate(o.report);assert.equal(evaluateSecurity(a,o).status,'blocked');}
});
test('every security severity fails; returned evidence excludes source excerpts',()=>{
 const a=pkg();for(let severity=1;severity<=5;severity++){
 const o=observation(a);o.report.violations=[{engine:'pmd',rule:'ApexCRUDViolation',severity,tags:['Security'],primaryLocationIndex:0,locations:[{file:'classes/Safe.cls',startLine:1}],message:'secret source excerpt'}];o.report.violationCounts.total=1;o.report.violationCounts['sev'+severity]=1;
 const r=evaluateSecurity(a,o);assert.equal(r.status,'failed');assert.equal(r.artifactHash,a.hash);assert.ok(r.reportHash);assert.ok(!JSON.stringify(r).includes('secret source excerpt'));
 }
});
test('runner isolates scanner credentials, uses fixed options, reads its report and cleans workspace',async()=>{
 const root=await mkdtemp(join(tmpdir(),'security-test-'));const home=join(root,'delivery-analyzer-home');await mkdir(home);await writeFile(join(home,'delivery-analyzer-pin.json'),JSON.stringify({version:'5.0.0'}));let scannedDir;
 try{
 const r=await runSecurity(pkg(),{env:{RUNNER_TEMP:root,CODE_ANALYZER_VERSION:'5.0.0',PATH:process.env.PATH,SF_JWT_PRIVATE_KEY:'secret',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'secret'},exec:async(binary,args,options)=>{
  scannedDir=options.cwd;assert.equal(options.env.SF_JWT_PRIVATE_KEY,undefined);assert.equal(options.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,undefined);assert.equal(options.env.HOME,home);assert.ok(args.includes('--no-suppressions'));assert.equal(args[args.indexOf('--rule-selector')+1],'pmd:Security');assert.equal(await readFile(join(scannedDir,'classes/Safe.cls'),'utf8'),pkg().files[0].content);
  await writeFile(args[args.indexOf('--output-file')+1],JSON.stringify(report()));return {stdout:''};
 }});assert.equal(r.status,'passed');await assert.rejects(readFile(join(scannedDir,'report.json')));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing setup and scanner failures cannot yield a pass',async()=>{
 assert.equal((await runSecurity(pkg(),{env:{}})).status,'blocked');
 const root=await mkdtemp(join(tmpdir(),'security-failure-'));const home=join(root,'delivery-analyzer-home');await mkdir(home);await writeFile(join(home,'delivery-analyzer-pin.json'),JSON.stringify({version:'5.0.0'}));
 try{for(const exec of [async()=>{throw new Error('timeout');},async()=>({stdout:'success'})])assert.equal((await runSecurity(pkg(),{env:{RUNNER_TEMP:root,CODE_ANALYZER_VERSION:'5.0.0'},exec})).status,'blocked');}finally{await rm(root,{recursive:true,force:true});}
});
test('quality collection rejects security evidence for a different release',()=>{
 const a=pkg(),security=evaluateSecurity(a,observation(a));const input={artifacts:a,cases:[],testSuite:{scenarios:[]},tests:[]};
 assert.equal(collectQuality({...input,security}).checks.security.status,'passed');security.artifactHash='old';assert.equal(collectQuality({...input,security}).checks.security.status,'blocked');
});
