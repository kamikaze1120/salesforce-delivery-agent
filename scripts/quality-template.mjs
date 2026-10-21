import {readFile} from 'node:fs/promises';
import {hash,assert} from '../lib/core.mjs';
// Deliberately incomplete: no invented org, source hash, workload or approval.
const path=process.argv[2];assert(path,'Usage: node scripts/quality-template.mjs path/to/handoff.json');
const handoff=JSON.parse(await readFile(path,'utf8'));assert(handoff.plan,'Expected handoff.json from the release bundle.');
const stages=['dev','qa','uat','production'];
const common={kind:'apex',stages,className:'REPLACE_WITH_REVIEWED_CLASS',sourceHash:'REPLACE_WITH_OBSERVED_SHA256',expected:'REPLACE_WITH_APPROVED_ASSERTIONS'};
const policy={version:1,planHash:hash(handoff.plan),reviewReference:'REPLACE_WITH_REVIEW_REFERENCE',targets:Object.fromEntries(stages.map(name=>[name,handoff.pipeline?.policy?.stages?.find(s=>s.name===name)?.orgId||'REPLACE_WITH_ORG_ID'])),security:['crud','fls','sharing'].flatMap(dimension=>['allow','deny'].map(access=>({...common,id:dimension+access,method:dimension+access,dimension,access}))),performance:[{...common,id:'BulkWorkload',method:'REPLACE_WITH_BULK_TEST',workload:'REPLACE_WITH_APPROVED_BUSINESS_VOLUME_AND_MEASUREMENT_SCOPE',records:null,budgets:{records:null,cpuMs:null,queries:null,dml:null,runtimeMs:null}}],regression:[{...common,id:'ExistingBehavior',method:'REPLACE_WITH_EXISTING_TEST'}],license:[{id:'Edition',kind:'edition',allowed:[],reason:'REPLACE_WITH_REQUIREMENT_AND_CAPABILITY_REASON',source:'https://developer.salesforce.com/docs',reviewedOn:'REPLACE_WITH_SOURCE_REVIEW_DATE'}]};
process.stdout.write(JSON.stringify(policy,null,2)+'\n');
process.stderr.write(`Review and complete every placeholder. Save as quality/policies/${policy.planHash}.json in the trusted runner repository. This template cannot pass validation.\n`);
