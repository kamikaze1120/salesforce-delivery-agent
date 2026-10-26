import test from 'node:test';
import assert from 'node:assert/strict';
import {setupConfiguration} from '../runner/setup-config.mjs';
import {mcpPolicy} from '../runner/mcp-policy.mjs';
import {verifyPipeline} from '../lib/pipeline.mjs';
const target={name:'dev',kind:'sandbox',orgId:'00D000000000001',url:'https://example--dev.sandbox.my.salesforce.com'};
const env={GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REF_PROTECTED:'true',GITHUB_SHA:'a'.repeat(40),DELIVERY_STAGE:'dev',DELIVERY_SETUP_TARGETS:JSON.stringify({dev:target}),SALESFORCE_CLI_VERSION:'2.153.5',PLAYWRIGHT_VERSION:'1.56.1',CODE_ANALYZER_VERSION:'5.16.0',SF_CLIENT_ID:'synthetic',SF_USERNAME:'synthetic',SF_JWT_PRIVATE_KEY:'synthetic'};
test('setup accepts only protected manual non-production configuration and exact tools',()=>{
 assert.deepEqual(setupConfiguration(env),target);
 for(const change of [{GITHUB_REF_PROTECTED:'false'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'pull_request'},{DELIVERY_STAGE:'production'},{SF_JWT_PRIVATE_KEY:''},{SALESFORCE_CLI_VERSION:'latest'},{DELIVERY_SETUP_TARGETS:'invalid'},{DELIVERY_SETUP_TARGETS:JSON.stringify({dev:{...target,kind:'production'}})}])assert.throws(()=>setupConfiguration({...env,...change}));
});
test('setup MCP exposes only org identity and rejects all writes, tests and extra arguments',()=>{
 const p=mcpPolicy('setup',target);assert.deepEqual(p.tools(),['inspect_org']);p.authorize('inspect_org');
 for(const tool of ['validate_metadata','deploy_metadata','run_apex_tests','deployment_status','inspect_capabilities'])assert.throws(()=>p.authorize(tool));
 assert.throws(()=>p.authorize('inspect_org',{query:'untrusted'}));assert.throws(()=>mcpPolicy('setup',{...target,name:'production'}));
});
const config={pipeline:{enabled:true,ref:'main',trustedCommit:'a'.repeat(40),maxRepairs:0,stages:['dev','qa','uat','production'].map((name,i)=>({name,environment:name,orgId:'00D00000000000'+(i+1),kind:name==='production'?'production':'sandbox',url:`https://example-${name}.my.salesforce.com`}))}};
const protection={allow_force_pushes:{enabled:false},allow_deletions:{enabled:false},enforce_admins:{enabled:true},required_status_checks:{contexts:['test']},required_pull_request_reviews:{required_approving_review_count:1}};
const request=async(_c,path)=>path.startsWith('/git/')?{object:{sha:'a'.repeat(40)}}:path.endsWith('/protection')?protection:path.startsWith('/branches/')?{protected:true}:path.startsWith('/actions/')?{state:'active'}:{deployment_branch_policy:{protected_branches:true},protection_rules:[{type:'required_reviewers',prevent_self_review:true,reviewers:[{id:1}]}]};
test('pipeline rejects missing reconciliation and absent code reviews',async()=>{
 await verifyPipeline(config,request);
 await assert.rejects(verifyPipeline(config,async(c,p)=>p.includes('salesforce-reconciliation')?{state:'disabled_manually'}:request(c,p)),/reconciliation/);
 await assert.rejects(verifyPipeline(config,async(c,p)=>p.endsWith('/protection')?{...protection,required_pull_request_reviews:null}:request(c,p)),/code review/);
});
