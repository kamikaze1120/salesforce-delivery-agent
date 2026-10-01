import { randomUUID } from 'node:crypto';
import { AppError, assert, seal, unseal, uuid } from './core.mjs';

export function configured() {
  return ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ENCRYPTION_KEY','APP_ORIGIN'].every(k => Boolean(process.env[k]));
}
function base() {
  assert(configured(), 'Complete the server setup in .env.local or Vercel environment variables first.', 503);
  const url = new URL(process.env.SUPABASE_URL);
  assert(url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') && !url.username && !url.password && !url.search && !url.hash, 'Use a hosted Supabase project URL.', 503);
  return url.origin;
}
export async function db(table, query = '', method = 'GET', body, upsert = false) {
  const response = await fetch(`${base()}/rest/v1/${table}${query ? '?' + query : ''}`, { method, redirect:'error', signal:AbortSignal.timeout(20000), headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', Prefer:'return=representation'+(upsert?',resolution=merge-duplicates':'')}, ...(body ? {body:JSON.stringify(body)} : {}) });
  if (!response.ok) throw new AppError('Database operation failed. Check the database schema and server configuration.', 503);
  const text=await response.text();return text?JSON.parse(text):[];
}
export async function authRequest(path, body, token) {
  const response = await fetch(`${base()}/auth/v1/${path}`, {method:body ? 'POST' : 'GET', redirect:'error', signal:AbortSignal.timeout(20000), headers:{apikey:process.env.SUPABASE_ANON_KEY, 'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
  if (!response.ok) throw new AppError('Sign-in failed. Check your credentials, email confirmation, and account settings.', 401);
  return response.json();
}
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split(/=(.*)/s)).filter(s => s[0])); }
export function setSession(res, session) {
  const value = session ? seal({access_token:session.access_token,refresh_token:session.refresh_token,expires:Date.now() + session.expires_in * 1000}, 'session') : '';
  const secure = process.env.APP_ORIGIN?.startsWith('https:') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sfda_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session ? 2592000 : 0}${secure}`);
}
export async function currentUser(req, res) {
  const raw = cookies(req).sfda_session;
  assert(raw, 'Sign in to continue.', 401);
  let session = unseal(raw, 'session');
  if (session.expires < Date.now() + 30000) {
    session = await authRequest('token?grant_type=refresh_token', {refresh_token:session.refresh_token}); setSession(res, session);
  }
  const user = await authRequest('user', null, session.access_token);
  assert(user?.id, 'Session expired. Sign in again.', 401);
  return {id:user.id, email:user.email};
}
export async function membership(user, workspaceId, roles = ['owner','reviewer','developer','viewer']) {
  uuid(workspaceId);
  const rows = await db('members', `workspace_id=eq.${workspaceId}&user_id=eq.${user.id}&select=role`);
  assert(rows[0] && roles.includes(rows[0].role), 'You do not have permission for this workspace action.', 403);
  return rows[0].role;
}
export async function workspace(user, id, roles) {
  await membership(user, id, roles);
  const [row] = await db('workspaces', `id=eq.${id}`); assert(row, 'Workspace not found.', 404); return row;
}
export async function jobFor(user, workspaceId, jobId, roles) {
  const ws = await workspace(user, workspaceId, roles); uuid(jobId);
  const [job] = await db('jobs', `id=eq.${jobId}&workspace_id=eq.${workspaceId}`); assert(job, 'Delivery not found.', 404);
  return {ws, job};
}
export async function audit(workspaceId, user, action, details = {}) {
  await db('audit_events', '', 'POST', {id:randomUUID(), workspace_id:workspaceId, actor_id:user.id, actor_email:user.email, action, details});
}
export async function lock(job, operation) {
  assert(!job.busy, 'Another operation is running. Refresh its status before trying again.', 409);
  const rows=await db('rpc/claim_job','','POST',{p_workspace:job.workspace_id,p_job:job.id,p_version:job.version,p_operation:operation});
  assert(rows.length===1,'The delivery changed in another session. Refresh before continuing.',409);
  return rows[0];
}
export async function checkpoint(job,stage,data) {
  const rows=await db('jobs',`id=eq.${job.id}&workspace_id=eq.${job.workspace_id}&version=eq.${job.version}&busy=eq.true`,'PATCH',{stage,data,version:job.version+1,updated_at:new Date().toISOString()});
  assert(rows.length===1,'Delivery state changed. Reconcile before retrying.',409);
  Object.assign(job,rows[0]);
}
export async function updateJob(job,stage,data,user,action) {
  const rows=await db('rpc/finish_job','','POST',{p_workspace:job.workspace_id,p_job:job.id,p_version:job.version,p_stage:stage,p_data:data,p_actor:user.id,p_email:user.email,p_action:action});
  assert(rows.length===1,'Delivery state changed. Reconcile the external operation before retrying.',409);
  return rows[0];
}
export async function replaceConnection(ws,type,config,user,verified=false) {
  const saved=await db('rpc/replace_connection','','POST',{p_workspace:ws.id,p_version:ws.connection_version,p_type:type,p_config:seal(config,`${ws.id}:${type}`),p_verified:verified,p_actor:user.id,p_email:user.email});
  assert(saved===true,'Settings changed or a delivery is running or awaiting reconciliation. Resolve it and refresh before editing connections.',409);
}
export async function connection(ws, type) {
  assert(['salesforce','jira','github','copado','llm'].includes(type),'Unsupported connection.');
  const [row] = await db('connections', `workspace_id=eq.${ws.id}&type=eq.${type}`);
  assert(row, `Configure the ${type} connection first.`, 409);
  const config=unseal(row.encrypted_config, `${ws.id}:${type}`);
  Object.defineProperty(config,'_revision',{value:row.revision,enumerable:false,configurable:true});
  return {row,config};
}
export async function saveConnection(ws,type,config,verified=false,revision=config._revision) {
  assert(revision,'Reload the connection before saving.',409);
  const rows=await db('connections',`workspace_id=eq.${ws.id}&type=eq.${type}&revision=eq.${uuid(revision)}`,'PATCH',{encrypted_config:seal(config,`${ws.id}:${type}`),verified,revision:randomUUID(),updated_at:new Date().toISOString()});
  assert(rows.length===1,'Connection changed in another session. Refresh before continuing.',409);
  Object.defineProperty(config,'_revision',{value:rows[0].revision,enumerable:false,configurable:true});
}
