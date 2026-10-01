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
