import {qualityBinding} from '../lib/quality-policy.mjs';
const result=(status,reason,details={})=>({status,source:'Fresh destination REST capability inventory / reviewed Salesforce license rules',reason,...details});
export function evaluateLicense(policy,artifacts,target,inventory,now=Date.now()){
 const binding=qualityBinding(policy,artifacts,target),date=Date.parse(inventory?.checkedAt);
 if(inventory?.orgId!==target.orgId||inventory?.stage!==target.name||!Number.isFinite(date)||date>now||now-date>300000)return result('blocked','Destination inventory is missing, stale or belongs to another org.',binding);
 const rows=policy.license.map(r=>{
  const base={id:r.id,kind:r.kind,source:r.source,reviewedOn:r.reviewedOn,reason:r.reason};
  if(Date.parse(r.reviewedOn)>now)return {...base,status:'blocked',detail:'Rule review date is in the future.'};
  if(r.kind==='edition')return {...base,actual:inventory.edition,status:typeof inventory.edition!=='string'?'blocked':r.allowed.includes(inventory.edition)?'passed':'failed'};
  const key={userLicense:'userLicenses',featureLicense:'featureLicenses',packageLicense:'packageLicenses',limit:'limits',objectAccess:'objects',assignedFeature:'assignedFeatures',assignedPermissionSet:'assignedPermissionSets',connectedUserLicense:'connectedUser'}[r.kind];
  const probe=inventory.evidence?.[key];
  if(probe?.status!=='observed'||probe.value?.truncated)return {...base,status:'blocked',detail:'Capability inventory unreadable or incomplete.'};
  if(r.kind==='connectedUserLicense')return {...base,status:typeof probe.value?.license!=='string'?'blocked':probe.value.license===r.key?'passed':'failed',actual:probe.value?.license||null};
  if(['assignedFeature','assignedPermissionSet'].includes(r.kind))return {...base,key:r.key,status:(probe.value?.records||[]).some(x=>x.name===r.key)?'passed':'blocked',detail:'Connected runner user assignment only; other personas require separate access tests.'};
  if(r.kind==='limit'){
   const actual=probe.value?.[r.key]?.Remaining;
   return {...base,key:r.key,actual:typeof actual==='number'?actual:null,minimum:r.minRemaining,status:!Number.isFinite(actual)||actual<0?'blocked':actual>=r.minRemaining?'passed':'failed'};
  }
  const nameField={userLicense:'Name',featureLicense:'MasterLabel',packageLicense:'NamespacePrefix',objectAccess:'name'}[r.kind];
  const matches=(probe.value?.records||[]).filter(v=>v[nameField]===r.key);
  // Absence in an API-visible inventory is not a definitive contractual denial.
  if(matches.length!==1)return {...base,key:r.key,status:'blocked',detail:'Required capability not uniquely observable; administrator verification required.'};
  const item=matches[0];
  if(r.kind==='objectAccess')return {...base,key:r.key,permissions:r.permissions,status:r.permissions.some(p=>typeof item[p]!=='boolean')?'blocked':r.permissions.every(p=>item[p])?'passed':'failed',detail:'API-user object access only; does not prove metadata deployment or end-user entitlement.'};
  const total=item[r.kind==='packageLicense'?'AllowedLicenses':'TotalLicenses'],used=item.UsedLicenses;
  if(item.Status!=='Active'||(item.ExpirationDate&&(!Number.isFinite(Date.parse(item.ExpirationDate))||Date.parse(item.ExpirationDate)<=now)))return {...base,key:r.key,status:'blocked',detail:'License status/expiry requires administrator verification.'};
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(used)||total<0||used<0||used>total)return {...base,key:r.key,status:'blocked',detail:'Capacity is unavailable or uses an unsupported unlimited encoding.'};
  return {...base,key:r.key,available:total-used,minimum:r.minAvailable,status:total-used>=r.minAvailable?'passed':'failed'};
 });
 return result(!rows.length||rows.some(r=>r.status==='blocked')?'blocked':rows.every(r=>r.status==='passed')?'passed':'failed','All reviewed destination capability rules must pass; unknown never means licensed.',{...binding,checkedAt:inventory.checkedAt,rules:rows});
}
