// Read-only evidence. Missing access is unknown, never proof of missing entitlement.
export async function scanCapabilities(request, org, userId) {
  const evidence = {};
  async function probe(key, source, read) {
    try { evidence[key] = {status:'observed',source,value:await read()}; }
    catch { evidence[key] = {status:'unknown',source,reason:'Not exposed or not readable by this connection. Ask an administrator to verify in Salesforce Setup.'}; }
  }
  async function inventory(object, wanted) {
    const describe = await request(`/sobjects/${object}/describe`);
    const fields = wanted.filter(f => describe.fields?.some(x=>x.name===f));
    if (!fields.length) throw new Error('No readable fields');
    const result = await request('/query?q='+encodeURIComponent(`SELECT ${fields.join(',')} FROM ${object} LIMIT 200`));
    return {fields,records:(result.records||[]).map(r=>Object.fromEntries(fields.map(f=>[f,r[f]]))),truncated:result.done!==true};
  }
  await probe('userLicenses','UserLicense',()=>inventory('UserLicense',['Id','Name','Status','TotalLicenses','UsedLicenses']));
  await probe('featureLicenses','PermissionSetLicense',()=>inventory('PermissionSetLicense',['MasterLabel','Status','TotalLicenses','UsedLicenses','ExpirationDate']));
  await probe('packageLicenses','PackageLicense',()=>inventory('PackageLicense',['NamespacePrefix','Status','AllowedLicenses','UsedLicenses','ExpirationDate']));
  await probe('limits','REST /limits',()=>request('/limits'));
  await probe('objects','REST /sobjects',async()=>({records:(await request('/sobjects')).sobjects?.map(o=>({name:o.name,createable:o.createable,updateable:o.updateable,deletable:o.deletable,queryable:o.queryable}))||[]}));
  await probe('connectedUser','User.Profile.UserLicense',async()=>{
    if (!/^005[a-zA-Z0-9]{12}([a-zA-Z0-9]{3})?$/.test(userId||'')) throw new Error('Missing identity');
    const r=await request('/query?q='+encodeURIComponent(`SELECT Profile.UserLicense.Name FROM User WHERE Id = '${userId}' LIMIT 1`));
    const name=r.records?.[0]?.Profile?.UserLicense?.Name;if(!name)throw new Error('Missing license');return {license:name};
  });
  return {version:1,checkedAt:new Date().toISOString(),orgId:org.id,edition:org.organizationType,environment:org.environment,evidence,
    guidance:[...(org.organizationType==='Developer Edition'?['Developer Edition is a development target. Its observed limits and licenses do not establish production entitlement. Check every destination separately.']:[]),
      'Object CRUD flags describe this API user’s data access, not permission to deploy metadata.',
      'Unknown or absent inventory is not proof a feature is unlicensed. Confirm assigned licenses, permissions and contract terms with your Salesforce administrator.',
      'Alternatives: use an available standard object or declarative feature; request the minimum appropriate permission or license; or prototype in Developer Edition and validate the intended destination. Alternatives require verification too.'],
    deployment:'unknown: only validation of the exact package in the destination can establish deployability'};
}
