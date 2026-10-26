import {assert,origin,uuid} from '../lib/core.mjs';

export const deliveryTools=['inspect_org','validate_metadata','deploy_metadata','deployment_status','run_apex_tests','inspect_capabilities','inspect_apex_source'];
export const setupTools=['inspect_org'];
export const reconciliationTools=['inspect_org','deployment_status'];
const deploymentId=id=>typeof id==='string'&&/^0Af[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(id);
export function mcpMode(value){
 const mode=value===undefined?'delivery':value;
 assert(['delivery','reconciliation','setup'].includes(mode),'Unsupported MCP execution mode.');
 return mode;
}
// A manifest is a constrained snapshot, NOT authentication or authorization.
// A future authenticated worker must obtain it from the persisted server journal.
export function mcpPolicy(modeValue,target,manifest){
 const mode=mcpMode(modeValue),allowed=new Set(mode==='delivery'?deliveryTools:mode==='setup'?setupTools:reconciliationTools);
 const ids=new Set();
 if(mode==='setup'){
  assert(['dev','qa','uat'].includes(target?.name)&&['sandbox','developer'].includes(target.kind),'Setup verification is non-production only.');
  assert(/^00D[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(target.orgId),'Expected setup org ID required.');
  assert(origin(target.url,'Salesforce')===target.url,'Exact setup origin required.');
 }
 if(mode==='reconciliation'){
  assert(manifest&&manifest.version===1,'A versioned reconciliation manifest is required.');
  uuid(manifest.pipelineId);
  assert(typeof manifest.artifactHash==='string'&&/^[a-f0-9]{64}$/.test(manifest.artifactHash),'Invalid reconciliation artifact hash.');
  assert(typeof manifest.runId==='string'&&/^[1-9][0-9]*$/.test(manifest.runId),'Invalid original runner identity.');
  assert(['dev','qa','uat','production'].includes(target?.name)&&manifest.stage===target.name,'Reconciliation stage mismatch.');
  assert(/^00D[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(target.orgId)&&manifest.orgId===target.orgId,'Reconciliation org mismatch.');
  assert(['sandbox','developer','production'].includes(target.kind)&&(target.name==='production')===(target.kind==='production'),'Invalid reconciliation org kind.');
  assert(manifest.targetUrl===origin(target.url,'Salesforce')&&manifest.targetKind===target.kind,'Reconciliation target mismatch.');
  assert(Array.isArray(manifest.operations)&&manifest.operations.length>0&&manifest.operations.length<=2,'Saved submitted operations are required.');
  const kinds=new Set(),recordIds=new Set();
  for(const op of manifest.operations){
   assert(['validation','deployment'].includes(op.kind)&&!kinds.has(op.kind),'Invalid or duplicate operation kind.');
   assert(op.phase==='submitted'&&deploymentId(op.id),'Only saved submitted operation IDs can be reconciled.');
   assert(op.artifactHash===manifest.artifactHash&&op.runId===manifest.runId,'Operation belongs to another artifact or runner.');
   assert(!recordIds.has(op.id.slice(0,15)),'Duplicate reconciliation operation ID.');
   kinds.add(op.kind);recordIds.add(op.id.slice(0,15));ids.add(op.id);
  }
 }
 // Copy IDs into an inaccessible set: later mutation of the input cannot widen access.
 return {
  mode,
  tools:()=>[...allowed],
  authorize(name,args={}){
   assert(allowed.has(name),'Tool is not allowed in this MCP mode.');
   assert(args&&typeof args==='object'&&!Array.isArray(args),'Tool arguments must be an object.');
   if(name==='deployment_status'){
    assert(Object.keys(args).length===1&&deploymentId(args.id),'A valid Salesforce deployment ID is required.');
    if(mode==='reconciliation')assert(ids.has(args.id),'Operation ID is outside the reconciliation journal.');
   }else if(['run_apex_tests','inspect_apex_source'].includes(name)){
    assert(Object.keys(args).length===1&&Array.isArray(args.classes)&&args.classes.length>0&&args.classes.length<=50&&args.classes.every(n=>typeof n==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(n)),'Invalid Apex classes.');
   }else assert(Object.keys(args).length===0,'Unexpected tool arguments.');
  }
 };
}
