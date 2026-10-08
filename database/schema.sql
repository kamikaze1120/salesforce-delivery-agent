-- Run once in a NEW Supabase project's SQL Editor. All application data is server-only.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  owner_id uuid not null references auth.users(id),
  connection_version integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','reviewer','developer','viewer')),
  primary key (workspace_id,user_id)
);
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null check (type in ('salesforce','jira','github','copado','llm')),
  encrypted_config text not null,
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (workspace_id,type)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  stage text not null default 'intake' check (stage in ('intake','clarification','plan_review','approved','code_review','validated','validating','deploying','sandbox_deployed','sandbox_complete','failed')),
  data jsonb not null default '{}'::jsonb,
  busy boolean not null default false,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_workspace on public.jobs(workspace_id,created_at desc);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  actor_email text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_workspace on public.audit_events(workspace_id,created_at desc);
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.connections enable row level security;
alter table public.jobs enable row level security;
alter table public.audit_events enable row level security;
-- Deliberately no browser RLS policies. The authenticated backend enforces membership,
-- then uses its server-only service role. Never expose that key to the client.
revoke all on public.workspaces, public.members, public.connections, public.jobs, public.audit_events from anon, authenticated;
grant all on public.workspaces, public.members, public.connections, public.jobs, public.audit_events to service_role;

-- Create workspace and its owner membership in one transaction.
create function public.create_workspace(p_user uuid, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  insert into workspaces(name,owner_id) values(p_name,p_user) returning id into wid;
  insert into members(workspace_id,user_id,role) values(wid,p_user,'owner');
  return wid;
end;
$$;
revoke all on function public.create_workspace(uuid,text) from public, anon, authenticated;
grant execute on function public.create_workspace(uuid,text) to service_role;

-- Incrementing connections invalidates all outstanding approvals. Atomic counter.
create function public.bump_connection_version(p_workspace uuid) returns void
language sql security definer set search_path = public as $$
  update workspaces set connection_version = connection_version + 1 where id = p_workspace;
$$;
revoke all on function public.bump_connection_version(uuid) from public, anon, authenticated;
grant execute on function public.bump_connection_version(uuid) to service_role;

create table public.oauth_states (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);
alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon, authenticated;
grant all on public.oauth_states to service_role;
-- Schedule cleanup: delete from public.oauth_states where expires_at < now() - interval '1 day';

create table public.rate_limits (key text primary key, started_at timestamptz not null, count integer not null);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;
create function public.claim_rate_limit(p_key text,p_limit integer,p_window integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into rate_limits(key,started_at,count) values(p_key,now(),1)
  on conflict(key) do update set
    count = case when rate_limits.started_at < now() - make_interval(secs => p_window) then 1 else rate_limits.count+1 end,
    started_at = case when rate_limits.started_at < now() - make_interval(secs => p_window) then now() else rate_limits.started_at end
  returning count into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.claim_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_rate_limit(text,integer,integer) to service_role;

-- Upgrade v0.1 databases before deploying v0.2. Run in Supabase SQL Editor.
begin;
alter table public.jobs add column if not exists lease_until timestamptz;
alter table public.jobs add column if not exists active_operation text;
alter table public.connections add column if not exists revision uuid not null default gen_random_uuid();

-- Workspace row lock serializes connection edits with operation acquisition.
create or replace function public.claim_job(p_workspace uuid,p_job uuid,p_version integer,p_operation text)
returns setof public.jobs language plpgsql security definer set search_path=public as $$
begin
  perform 1 from workspaces where id=p_workspace for update;
  return query update jobs set busy=true,version=version+1,active_operation=p_operation,
    lease_until=now()+interval '10 minutes',updated_at=now()
    where id=p_job and workspace_id=p_workspace and version=p_version and busy=false returning *;
end; $$;

create or replace function public.replace_connection(p_workspace uuid,p_version integer,p_type text,p_config text,p_verified boolean,p_actor uuid,p_email text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform 1 from workspaces where id=p_workspace and connection_version=p_version for update;
  if not found then return false; end if;
  if exists(select 1 from jobs where workspace_id=p_workspace and
    (busy or stage in ('validating','deploying') or data->>'reconciliationRequired'='true')) then return false; end if;
  insert into connections(workspace_id,type,encrypted_config,verified) values(p_workspace,p_type,p_config,p_verified)
  on conflict(workspace_id,type) do update set encrypted_config=excluded.encrypted_config,verified=excluded.verified,revision=gen_random_uuid(),updated_at=now();
  update workspaces set connection_version=connection_version+1 where id=p_workspace;
  insert into audit_events(workspace_id,actor_id,actor_email,action,details) values(p_workspace,p_actor,p_email,'connection.saved',jsonb_build_object('type',p_type));
  return true;
end; $$;

-- State and corresponding audit event commit together.
create or replace function public.finish_job(p_workspace uuid,p_job uuid,p_version integer,p_stage text,p_data jsonb,p_actor uuid,p_email text,p_action text)
returns setof public.jobs language plpgsql security definer set search_path=public as $$
declare changed jobs;
begin
  update jobs set stage=p_stage,data=p_data,busy=false,lease_until=null,active_operation=null,version=version+1,updated_at=now()
  where id=p_job and workspace_id=p_workspace and version=p_version returning * into changed;
  if not found then return; end if;
  insert into audit_events(workspace_id,actor_id,actor_email,action,details) values(p_workspace,p_actor,p_email,p_action,jsonb_build_object('jobId',p_job,'stage',p_stage,'artifactHash',p_data->'artifacts'->>'hash'));
  return next changed;
end; $$;
revoke all on function public.claim_job(uuid,uuid,integer,text), public.replace_connection(uuid,integer,text,text,boolean,uuid,text), public.finish_job(uuid,uuid,integer,text,jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_job(uuid,uuid,integer,text), public.replace_connection(uuid,integer,text,text,boolean,uuid,text), public.finish_job(uuid,uuid,integer,text,jsonb,uuid,text,text) to service_role;
commit;

-- Apply once to an existing v0.3 database before enabling CI/CD.
begin;
create or replace function public.replace_connection(p_workspace uuid,p_version integer,p_type text,p_config text,p_verified boolean,p_actor uuid,p_email text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform 1 from workspaces where id=p_workspace and connection_version=p_version for update;
  if not found then return false; end if;
  if exists(select 1 from jobs where workspace_id=p_workspace and
    (busy or data->'pipeline'->>'status' in ('queued','running') or stage in ('validating','deploying') or data->>'reconciliationRequired'='true')) then return false; end if;
  insert into connections(workspace_id,type,encrypted_config,verified) values(p_workspace,p_type,p_config,p_verified)
  on conflict(workspace_id,type) do update set encrypted_config=excluded.encrypted_config,verified=excluded.verified,revision=gen_random_uuid(),updated_at=now();
  update workspaces set connection_version=connection_version+1 where id=p_workspace;
  insert into audit_events(workspace_id,actor_id,actor_email,action,details) values(p_workspace,p_actor,p_email,'connection.saved',jsonb_build_object('type',p_type));
  return true;
end; $$;

create or replace function public.pipeline_schema_version() returns integer
language sql security definer set search_path=public as $$ select 1; $$;
revoke all on function public.pipeline_schema_version() from public,anon,authenticated;
grant execute on function public.pipeline_schema_version() to service_role;
commit;
