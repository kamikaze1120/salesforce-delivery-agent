import {assert,hash} from './core.mjs';
export function reviewedBrowserOrigins(raw=[]){
 assert(Array.isArray(raw)&&raw.length<=10,'At most ten exact Salesforce browser origins may be reviewed.');
 const origins=raw.map(value=>{
  assert(typeof value==='string','Invalid browser origin.');const u=new URL(value);
  assert(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.pathname==='/'&&!u.search&&!u.hash,'Browser allowlist entries must be exact HTTPS origins.');
  assert(/^[a-z0-9.-]+$/.test(u.hostname),'Browser origins must not contain wildcards.');
  assert(['salesforce.com','force.com','sfdcstatic.com','documentforce.com'].some(s=>u.hostname===s||u.hostname.endsWith('.'+s)),'Only reviewed Salesforce resource origins are supported.');return u.origin;
 });
 assert(new Set(origins).size===origins.length,'Duplicate browser origins.');return origins;
}
export function browserNetworkPolicy(target){
 const base=new URL(target.url),lightning=base.hostname.replace(/\.my\.salesforce\.com$/,'.lightning.force.com');
 const allowed=new Set([base.origin,`https://${lightning}`,...reviewedBrowserOrigins(target.browserOrigins)]),blocked=new Map();
 return {lightning,allows(value){
  try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&allowed.has(u.origin))return true;
   const key=hash(u.origin);if(blocked.size<20||blocked.has(key))blocked.set(key,(blocked.get(key)||0)+1);
  }catch{blocked.set('invalid_url',(blocked.get('invalid_url')||0)+1);}return false;
 },evidence(){return {policyHash:hash([...allowed].sort()),blockedOrigins:[...blocked].map(([originHash,requests])=>({originHash,requests})),status:blocked.size?'blocked':'passed'};}};
}
