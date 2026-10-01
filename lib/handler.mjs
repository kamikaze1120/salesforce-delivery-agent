import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { AppError, assert, string, cleanConfig, publicConfig, seal, unseal, hash, uuid, planSchema, artifactsSchema, requireStage, requireApproval, zip, origin } from './core.mjs';
import { configured, db, authRequest, currentUser, setSession, workspace, membership, jobFor, connection, saveConnection, audit, lock, updateJob, checkpoint, replaceConnection } from './store.mjs';
import { remote, github, jira, sfTokens, sandboxIdentity, inspectOrg, analyze, generate, createStory, commitArtifacts, deploy, deploymentStatus } from './integrations.mjs';

import { readiness, releaseChecks, sandboxApproval, requireSandboxApproval, canRecover } from './workflow.mjs';

const writeRoles = ['owner','developer'], reviewRoles = ['owner','reviewer'];
function json(res, status, data) { res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); }
export function checkOrigin(req) {
  assert(req.headers.origin === process.env.APP_ORIGIN, 'Request origin is not allowed.', 403);
}
async function readBody(req) {
  if (typeof req.body === 'string') {assert(Buffer.byteLength(req.body)<=2200000,'Request is too large.',413);try{return JSON.parse(req.body);}catch{throw new AppError('Invalid JSON request.');}}
  if (req.body && typeof req.body === 'object') {
    assert(Buffer.byteLength(JSON.stringify(req.body)) <= 2200000, 'Request is too large.', 413); return req.body;
  }
  let bytes = 0, parts = [];
  for await (const chunk of req) { bytes += chunk.length; assert(bytes <= 2200000, 'Request is too large.', 413); parts.push(chunk); }
  try { return JSON.parse(Buffer.concat(parts).toString() || '{}'); } catch { throw new AppError('Invalid JSON request.'); }
}
async function versionsMatch(ws, job) {
  const [fresh] = await db('workspaces', `id=eq.${ws.id}`);
  assert(fresh.connection_version === job.data.connectionVersion, 'Connection settings changed. Create a new delivery so its reviews target the current accounts.', 409);
}
async function limit(key, count, window=3600) {
  const allowed=await db('rpc/claim_rate_limit','','POST',{p_key:key,p_limit:count,p_window:window});
  assert(allowed===true,'Too many requests. Try again later.',429);
}
async function targetFor(ws, job) {
  await versionsMatch(ws, job);
  const {config} = await connection(ws,'salesforce');
  const sf = await sfTokens(ws, config); const identity = await sandboxIdentity(sf);
  assert(identity.id === job.data.orgContext?.org.id, 'The Salesforce target differs from the reviewed development org.', 409); return sf;
}
async function runAction(user, ws, original, op, b) {
  assert(op!=='production','Production promotion is disabled in this pilot. Use the Copado handoff bundle and your existing release approvals.',403);
  const job = await lock(original,op); let data = structuredClone(job.data); let stage=job.stage; let writeStarted=false;
  const beginWrite=async()=>{data.operation={id:randomUUID(),kind:op,phase:'write_started',at:new Date().toISOString()};await checkpoint(job,stage,data);writeStarted=true;};
  const recordWrite=async()=>{data.operation.phase='response_recorded';await checkpoint(job,stage,data);};
  try {
    assert(!data.paused || ['resume','poll'].includes(op), 'Delivery is paused for human intervention.', 409);
    if (['analyze','editPlan','approvePlan','jira','generate','editArtifacts','approveCode','git','validate','approveDeploy','deploy','poll','acceptance'].includes(op)) await versionsMatch(ws,job);
    if (op === 'pause' || op === 'resume') {
      if(op==='resume')assert(!data.reconciliationRequired,'Record human reconciliation before resuming an ambiguous operation.',409);
      data.paused = op === 'pause';
    }
    else if (op === 'analyze') {
      assert(['intake','clarification','plan_review'].includes(stage), 'The approved delivery cannot be reanalyzed. Create a new delivery for changed requirements.', 409);
      const {config: llm} = await connection(ws,'llm');
      const {config: salesforce} = await connection(ws,'salesforce');
      const sf = await sfTokens(ws, salesforce);
      const answers = b.answers || data.answers || {};
      assert(typeof answers === 'object' && !Array.isArray(answers) && Object.entries(answers).length <= 50, 'Invalid clarification answers.');
      for (const [q, a] of Object.entries(answers)) { string(q,'Question',1000); string(a,'Answer',5000); }
      data.answers = answers; data.orgContext = await inspectOrg(sf,data.brd);
      const result = await analyze(llm,data.brd,answers,data.orgContext);
      data.plan = result.output; data.generations = [...(data.generations || []), {id:randomUUID(),kind:'plan',model:result.model,usage:result.usage,at:new Date().toISOString()}];
      delete data.planApproval;
      stage = data.plan.questions.some(q => q.blocking) ? 'clarification' : 'plan_review';
    } else if (op === 'editPlan') {
      requireStage(job,'plan_review'); data.plan=planSchema(b.plan);
      assert(data.plan.requirements.every(r => data.brd.includes(r.source)), 'Requirement source text must occur in the BRD.');
      delete data.planApproval; stage=data.plan.questions.some(q => q.blocking) ? 'clarification' : 'plan_review';
    } else if (op === 'approvePlan') {
      requireStage(job,'plan_review'); assert(!data.plan.questions.some(q => q.blocking),'Resolve blocking questions first.');
      data.planApproval = {userId:user.id,at:new Date().toISOString(),hash:hash(data.plan),connectionVersion:data.connectionVersion}; stage='approved';
    } else if (op === 'jira') {
      assert(['approved','code_review','validated'].includes(stage),'Approve the plan before creating Jira stories.',409);
      assert(data.planApproval?.hash === hash(data.plan),'The plan approval is invalid.',409);
      const {config} = await connection(ws,'jira');
      data.jira ||= {};
      // One story per request; persist completion before the next story. Do not auto-retry writes.
      const story = data.plan.stories.find(s => !data.jira[s.id]); assert(story,'All Jira stories already exist.',409);
      await beginWrite(); data.jira[story.id] = await createStory(config,story,job.id); await recordWrite();
    } else if (op === 'generate') {
      requireStage(job,'approved'); assert(data.planApproval?.hash === hash(data.plan),'Approve the current plan.',409);
      const {config} = await connection(ws,'llm');
      const result=await generate(config,data); data.artifacts=result.output; data.approvals={};
      data.generations=[...(data.generations || []),{id:randomUUID(),kind:'code',model:result.model,usage:result.usage,at:new Date().toISOString()}]; stage='code_review';
    } else if (op === 'editArtifacts') {
      requireStage(job,'code_review');
      data.artifacts=artifactsSchema({files:b.files.filter(f => f.path !== 'package.xml'),notes:b.notes || data.artifacts.notes}, process.env.SALESFORCE_API_VERSION || '65.0'); data.approvals={}; delete data.validation;
    } else if (op === 'approveCode' || op === 'approveDeploy') {
      requireStage(job,op === 'approveCode' ? 'code_review' : 'validated');
      data.approvals ||= {}; data.approvals[op === 'approveCode' ? 'code' : 'sandbox']=op==='approveDeploy' ? sandboxApproval(data,user.id) : {userId:user.id,at:new Date().toISOString(),hash:data.artifacts.hash,connectionVersion:data.connectionVersion,orgId:data.orgContext.org.id};
    } else if (op === 'git') {
      assert(['code_review','validated'].includes(stage),'Generate and review code first.',409); requireApproval(job,'code');
      assert(data.git?.hash!==data.artifacts.hash,'This exact release is already committed.',409);
      const {config}=await connection(ws,'github'); await beginWrite(); data.git=await commitArtifacts(config,data.artifacts,job.id,job.title,data.git); delete data.approvals.sandbox; await recordWrite();
    } else if (op === 'validate' || op === 'deploy') {
      requireStage(job,op === 'validate' ? 'code_review' : 'validated'); requireApproval(job,'code');
      if (op === 'deploy') {
        requireSandboxApproval(data);
        const {config}=await connection(ws,'github');
        const head=await github(config,`/git/ref/heads/${encodeURIComponent(data.git.branch)}`);
        assert(head.object?.sha===data.git.commit,'The Git branch changed after review. Deployment is blocked.',409);
      }
      const sf = await targetFor(ws,job);
      if(op==='validate') delete data.approvals.sandbox;
      await beginWrite(); const pending=await deploy(sf,data.artifacts,op === 'validate');
      if (op === 'validate') data.validation=pending; else data.deployment=pending;
      stage=op === 'validate' ? 'validating' : 'deploying'; await recordWrite();
    } else if (op === 'poll') {
      assert(['validating','deploying'].includes(stage),'No Salesforce operation is pending.',409);
      const sf = await targetFor(ws,job), field=stage === 'validating' ? 'validation' : 'deployment';
      const result=await deploymentStatus(sf,data[field].id); data[field].result=result;
      if (result.done) stage=result.success ? (field === 'validation' ? 'validated' : 'sandbox_deployed') : 'code_review';
    } else if (op === 'acceptance') {
      requireStage(job,'sandbox_deployed');
      assert(Array.isArray(b.evidence) && b.evidence.length===data.plan.testPlan.length && b.evidence.length>0,'Record evidence for every acceptance scenario before completing the delivery.');
      const evidence=b.evidence.map((note,i)=>({scenario:data.plan.testPlan[i],note:string(note,'Acceptance test evidence',2000,10),reviewer:user.id,at:new Date().toISOString()}));
      data.acceptance=evidence;stage='sandbox_complete';
    } else if (op === 'production') {
      throw new AppError('Production promotion is disabled in this pilot. Use the Copado handoff bundle and your existing release approvals.',403);
    } else throw new AppError('Unknown delivery action.');
    delete data.lastError;
    return await updateJob(job,stage,data,user,op);
  } catch (error) {
    // An unknown write stays blocked. A recorded remote result retains its stage and ID.
    if (writeStarted && data.operation?.phase==='write_started') {
      data.paused=true; data.reconciliationRequired=true;
    }
    data.lastError=error instanceof AppError ? error.message : 'The operation failed. Review the state before retrying.';
    await updateJob(job,stage,data,user,op+'.failed');
    throw error;
  }
}

export async function handler(req,res) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  try {
    const url = new URL(req.url,'http://localhost'); const op=url.searchParams.get('op') || 'status';
    assert(['GET','POST'].includes(req.method),'Method not allowed.',405);
    if (op === 'health') { assert(req.method === 'GET','Method not allowed.',405); return json(res,200,{configured:configured(),signupEnabled:process.env.ALLOW_SIGNUP==='true',productionEnabled:false,version:'0.2.0'}); }
    if (req.method === 'POST') checkOrigin(req);
    else assert(['status','jobs','audit','download','sfCallback'].includes(op),'This action requires POST.',405);
    const b=req.method === 'POST' ? await readBody(req) : {};
    if (op === 'login' || op === 'signup') {
      const client=req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
      await limit('auth:'+hash((process.env.ENCRYPTION_KEY || '')+client),20,900);
      const email=string(b.email,'Email',200), password=string(b.password,'Password',200,8);
      if (op === 'signup') {
        assert(process.env.ALLOW_SIGNUP === 'true','Self-registration is disabled. Ask your administrator to create your account.',403);
        const domains=(process.env.SIGNUP_EMAIL_DOMAINS || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        assert(!domains.length || domains.includes(email.split('@')[1]?.toLowerCase()),'This email domain is not allowed to register.',403);
      }
      const session=await authRequest(op === 'login' ? 'token?grant_type=password' : 'signup',{email,password});
      if (session.access_token) setSession(res,session);
      return json(res,200,{confirmationRequired:!session.access_token});
    }
    if (op === 'logout') { setSession(res,null); return json(res,200,{ok:true}); }
    const user=await currentUser(req,res);
    if(['analyze','generate'].includes(op))await limit('llm:'+user.id,12);
    if (op === 'sfCallback') {
      const state=unseal(url.searchParams.get('state') || '', 'oauth');
      assert(state.userId === user.id && state.expires > Date.now(),'Salesforce authorization expired or does not match your account.',403);
      const [stored]=await db('oauth_states',`id=eq.${uuid(state.nonce)}&user_id=eq.${user.id}`);
      assert(stored && !stored.used && stored.expires_at > new Date().toISOString(),'Salesforce authorization has already been used or expired.',403);
      const consumed=await db('oauth_states',`id=eq.${state.nonce}&used=eq.false`,'PATCH',{used:true}); assert(consumed.length === 1,'Authorization state was already consumed.',403);
      const ws=await workspace(user,state.workspaceId,['owner']);
      assert(ws.connection_version === state.connectionVersion,'Connection settings changed during authorization. Start again.',409);
      const {config}=await connection(ws,'salesforce');
      const code=string(url.searchParams.get('code'),'Authorization code',4000);
      const tokens=await remote(`${config.url}/services/oauth2/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,code_verifier:state.verifier,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:`${process.env.APP_ORIGIN}/api/service?op=sfCallback`}).toString()},'Salesforce authorization');
      assert(tokens.access_token,'Salesforce did not return an access token.',502);
      const next={...config,accessToken:tokens.access_token,refreshToken:tokens.refresh_token,instanceUrl:origin(tokens.instance_url,'Salesforce'),tokenExpiresAt:Date.now()+600000};
      const identity=await sandboxIdentity(next); next.orgId=identity.id; next.orgName=identity.name;
      await replaceConnection(ws,'salesforce',next,user,true);
      res.statusCode=302; res.setHeader('Location','/?salesforce=connected'); return res.end();
    }
    if (op === 'status') {
      const members=await db('members',`user_id=eq.${user.id}&select=workspace_id,role`);
      const workspaces=[];
      for (const m of members) {
        const [ws]=await db('workspaces',`id=eq.${m.workspace_id}`);
        const rows=await db('connections',`workspace_id=eq.${ws.id}`);
        workspaces.push({...ws,role:m.role,connections:rows.map(r => ({type:r.type,verified:r.verified,updatedAt:r.updated_at,config:publicConfig(r.type,unseal(r.encrypted_config,`${ws.id}:${r.type}`))}))});
      }
      return json(res,200,{user,workspaces:workspaces.map(w=>({...w,readiness:readiness(w.connections)}))});
    }
    if (op === 'createWorkspace') {
      const name=string(b.name,'Workspace name',100);
      const id=await db('rpc/create_workspace','','POST',{p_user:user.id,p_name:name}); await audit(id,user,'workspace.created',{name}); return json(res,201,{id});
    }
    const workspaceId=b.workspaceId || url.searchParams.get('workspaceId');
    const ws=await workspace(user,workspaceId);
    if (op === 'jobs') {const jobs=await db('jobs',`workspace_id=eq.${ws.id}&order=created_at.desc&limit=100`);return json(res,200,{jobs:jobs.map(j=>({...j,releaseChecks:releaseChecks(j.data)}))});}
    if (op === 'audit') return json(res,200,{events:await db('audit_events',`workspace_id=eq.${ws.id}&order=created_at.desc&limit=100`)});
    if (op === 'saveConnection') {
      await membership(user,ws.id,['owner']); const config=cleanConfig(b.type,b.config);
      await replaceConnection(ws,b.type,config,user); return json(res,200,{ok:true});
    }
    if (op === 'verifyConnection') {
      await membership(user,ws.id,['owner']); let {config}=await connection(ws,b.type); let details;
      if (b.type === 'jira') {
        const project=await jira(config,`/project/${encodeURIComponent(config.projectKey)}`);
        const types=await jira(config,`/issue/createmeta/${encodeURIComponent(config.projectKey)}/issuetypes`);
        const issueTypes=types.issueTypes || types.values || [];
        assert(issueTypes.some(t => String(t.id) === config.issueTypeId),'Configured issue type is not available in this project.'); details={name:project.name,issueTypes};
      } else if (b.type === 'github') { const repo=await github(config,''); await github(config,`/git/ref/heads/${encodeURIComponent(config.branch)}`); details={name:repo.full_name,canPush:repo.permissions?.push === true}; assert(details.canPush,'The GitHub token needs write access to this repository.'); }
      else if (b.type === 'salesforce') {config=await sfTokens(ws,config);details=await sandboxIdentity(config);}
      else if (b.type === 'llm') { details={configured:true,message:'Credentials saved. Compatibility is checked on the first analysis; this avoids an unsolicited model call.'}; return json(res,200,{details}); }
      else return json(res,200,{details:{mode:'manual-handoff',message:'Copado automatic promotion is not connected in this pilot.'}});
      await saveConnection(ws,b.type,config,true); await audit(ws.id,user,'connection.verified',{type:b.type}); return json(res,200,{details});
    }
    if (op === 'authorizeSalesforce') {
      await membership(user,ws.id,['owner']); const {config}=await connection(ws,'salesforce');
      const nonce=randomUUID(),expires=Date.now()+600000;
      await db('oauth_states','','POST',{id:nonce,user_id:user.id,expires_at:new Date(expires).toISOString()});
      const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
      const state=seal({workspaceId:ws.id,userId:user.id,connectionVersion:ws.connection_version,nonce,expires,verifier},'oauth');
      const params=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:`${process.env.APP_ORIGIN}/api/service?op=sfCallback`,scope:'api refresh_token',state,code_challenge:challenge,code_challenge_method:'S256'});
      return json(res,200,{url:`${config.url}/services/oauth2/authorize?${params}`});
    }
    if (op === 'addMember') {
      await membership(user,ws.id,['owner']); const id=uuid(b.userId); assert(['reviewer','developer','viewer'].includes(b.role),'Choose reviewer, developer, or viewer.');
      assert(id !== ws.owner_id,'Owner role cannot be changed here.');
      const [existing]=await db('members',`workspace_id=eq.${ws.id}&user_id=eq.${id}`);
      if (existing) await db('members',`workspace_id=eq.${ws.id}&user_id=eq.${id}`,'PATCH',{role:b.role}); else await db('members','','POST',{workspace_id:ws.id,user_id:id,role:b.role});
      await audit(ws.id,user,'member.assigned',{userId:id,role:b.role}); return json(res,200,{ok:true});
    }
    if (op === 'createJob') {
      await membership(user,ws.id,writeRoles);
      const title=string(b.title,'Delivery title',200), brd=string(b.brd,'BRD',80000,30);
      const [job]=await db('jobs','','POST',{workspace_id:ws.id,created_by:user.id,title,data:{brd,answers:{},connectionVersion:ws.connection_version}});
      await audit(ws.id,user,'delivery.created',{jobId:job.id}); return json(res,201,{job});
    }
    const {job}=await jobFor(user,ws.id,b.jobId || url.searchParams.get('jobId'));
    if (op === 'download') {
      assert(job.data.artifacts,'Generate metadata first.',409);
      const {config:copado}=await connection(ws,'copado');
      const release={deliveryId:job.id,title:job.title,stage:job.stage,artifactHash:job.data.artifacts.hash,targetOrg:job.data.orgContext.org,plan:job.data.plan,jira:job.data.jira || {},git:job.data.git || null,validation:job.data.validation || null,deployment:job.data.deployment || null,approvals:job.data.approvals || {},copado,productionEnabled:false};
      const files=[...job.data.artifacts.files,{path:'handoff.json',content:JSON.stringify(release,null,2)}];
      res.setHeader('Content-Type','application/zip'); res.setHeader('Content-Disposition',`attachment; filename="salesforce-release-${job.id}.zip"`); return res.end(zip(files));
    }
    if (op === 'reconcile') {
      await membership(user,ws.id,reviewRoles);
      assert(job.busy || job.data.reconciliationRequired,'No reconciliation is required.',409);
      string(b.note,'Reconciliation note',2000,20);
      canRecover(job);
      const data={...job.data,paused:true,reconciliationRequired:false,reconciliationNote:b.note};
      return json(res,200,{job:await updateJob(job,job.stage,data,user,'delivery.reconciled')});
    }
    await membership(user,ws.id,['approvePlan','approveCode','approveDeploy','resume','acceptance'].includes(op) ? reviewRoles : op === 'poll' || op === 'pause' ? ['owner','reviewer','developer'] : writeRoles);
    const updated=await runAction(user,ws,job,op,b);
    return json(res,200,{job:{...updated,releaseChecks:releaseChecks(updated.data)}});
  } catch (error) {
    const status=error instanceof AppError ? error.status : 500;
    return json(res,status,{error:error instanceof AppError ? error.message : 'The server could not complete this operation. Check server configuration and try again after reviewing the delivery state.'});
  }
}
