import {assert,origin} from '../lib/core.mjs';
export function setupConfiguration(e){
 assert(e.GITHUB_EVENT_NAME==='workflow_dispatch'&&e.GITHUB_REF==='refs/heads/main'&&e.GITHUB_REF_PROTECTED==='true','Run setup verification manually from protected main.');
 assert(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||''),'Runner commit is missing.');
 assert(['dev','qa','uat'].includes(e.DELIVERY_STAGE),'Only Dev, QA and UAT may be inspected.');
 let targets;try{targets=JSON.parse(e.DELIVERY_SETUP_TARGETS||'');}catch{throw Error('Set DELIVERY_SETUP_TARGETS to reviewed non-production targets.');}
 const target=targets[e.DELIVERY_STAGE];
 assert(target&&target.name===e.DELIVERY_STAGE&&['sandbox','developer'].includes(target.kind),'Non-production target configuration required.');
 assert(/^00D[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(target.orgId||''),'Expected Salesforce org ID required.');
 assert(origin(target.url,'Salesforce')===target.url,'Use the exact Salesforce My Domain origin without a trailing slash.');
 for(const key of ['SALESFORCE_CLI_VERSION','PLAYWRIGHT_VERSION','CODE_ANALYZER_VERSION'])assert(/^\d+\.\d+\.\d+$/.test(e[key]||''),`Set ${key} to an exact reviewed version.`);
 for(const key of ['SF_CLIENT_ID','SF_USERNAME','SF_JWT_PRIVATE_KEY'])assert(typeof e[key]==='string'&&e[key].trim(),`Configure ${key} in this GitHub environment.`);
 return {name:target.name,kind:target.kind,orgId:target.orgId,url:target.url};
}
