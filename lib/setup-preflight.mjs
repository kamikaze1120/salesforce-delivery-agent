import {connection,db} from './store.mjs';
import {sfTokens,sandboxIdentity,jiraPreflight,verifyModel} from './integrations.mjs';
import {verifyPipeline} from './pipeline.mjs';

export async function setupPreflight(ws,{getConnection=connection,query=db,checkSalesforce=async c=>sandboxIdentity(await sfTokens(ws,c)),checkJira=jiraPreflight,checkModel=verifyModel,checkPipeline=verifyPipeline}={}){
 const checks=[];
 async function probe(id,remediation,fn){try{await fn();checks.push({id,status:'passed',remediation:null});}catch(error){checks.push({id,status:'failed',remediation:error?.setupCode==='pipeline_disabled'?'CI/CD is disabled. Configure distinct Dev, QA, UAT and production orgs, protected GitHub environments, reviewed runner SHA and JWT credentials before enabling it.':remediation});}}
 await probe('database','Apply the documented database schema and CI/CD migration to this Supabase project.',async()=>{if(await query('rpc/pipeline_schema_version','','POST',{})!==1)throw Error('migration');});
 await probe('target_locks','Apply database migration 004_target_locks.sql before any deployment.',async()=>{if(await query('rpc/target_lock_schema_version','','POST',{})!==1)throw Error('migration');});
 await probe('salesforce','Authorize the configured development org and verify its expected identity and API access.',async()=>checkSalesforce((await getConnection(ws,'salesforce')).config));
 await probe('jira','Check the project key, issue type, required field defaults and Jira credential permissions.',async()=>checkJira((await getConnection(ws,'jira')).config));
 await probe('model','Select an available model with JSON output support and a working provider credential.',async()=>checkModel((await getConnection(ws,'llm')).config));
 await probe('pipeline','Install delivery, production and reconciliation workflows; review the runner commit, distinct org identities, branch rules and environment reviewers.',async()=>{const c=(await getConnection(ws,'github')).config;if(!c.pipeline?.enabled)throw Object.assign(new Error('Pipeline disabled'),{setupCode:'pipeline_disabled'});return checkPipeline(c);});
 checks.push({id:'runner_environment',status:'unknown',remediation:'Run Salesforce setup verification in GitHub Actions for each non-production environment and inspect its job summary. This report does not yet ingest runner evidence. Server-side checks cannot verify JWT private keys, browser sessions, installed tools or live QA/UAT/production org identity.'});
 return {version:1,workspaceId:ws.id,connectionVersion:ws.connection_version,checkedAt:new Date().toISOString(),status:checks.some(c=>c.status==='failed')?'failed':'unknown',checks};
}
