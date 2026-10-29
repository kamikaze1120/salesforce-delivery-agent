import {assert} from './core.mjs';

// These are the only capabilities implemented by the current web OAuth client.
// Hosted MCP, Einstein and browser sessions require separately reviewed adapters.
const profiles=Object.freeze({core:['api','refresh_token']});
export function requestedSalesforceScopes(profile='core'){
 assert(typeof profile==='string'&&Object.hasOwn(profiles,profile),'Unsupported Salesforce authorization profile.',409);
 return [...profiles[profile]];
}
export function salesforceScopeEvidence(requested,scopeResponse){
 assert(Array.isArray(requested)&&requested.length>0&&requested.every(s=>typeof s==='string'),'Invalid Salesforce requested scopes.',409);
 const expected=[...new Set(requested)].sort();
 if(scopeResponse===undefined||scopeResponse===null||scopeResponse===''){
  return {status:'unknown',requested:expected,granted:[],missing:[],reason:'OAuth token response did not include granted scopes; administrator verification is required.'};
 }
 assert(typeof scopeResponse==='string'&&scopeResponse.length<=2048,'Salesforce returned malformed OAuth scope evidence.',502);
 const granted=[...new Set(scopeResponse.split(/[\s,]+/).filter(Boolean))].sort();
 assert(granted.every(scope=>/^[a-zA-Z][a-zA-Z0-9_:-]*$/.test(scope)),'Invalid Salesforce OAuth grant evidence.',502);
 const missing=expected.filter(scope=>!granted.includes(scope));
 return {status:missing.length?'insufficient':'observed',requested:expected,granted,missing};
}
export function requireSalesforceScope(evidence,required){
 assert(evidence?.status==='observed'&&Array.isArray(evidence.granted)&&evidence.granted.includes(required),
  'Required Salesforce authorization grant is not verified. Reauthorize and confirm the connected app scopes.',409);
}
