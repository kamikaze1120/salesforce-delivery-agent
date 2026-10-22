-- Apply after 003_pipeline.sql. Global org locks intentionally do not expire automatically.
begin;
create table if not exists public.target_org_locks (
 org_id text primary key check (org_id ~ '^00D[A-Za-z0-9]{12}$'),
 workspace_id uuid not null references public.workspaces(id),
 job_id uuid not null references public.jobs(id),
 scope text not null check (length(scope) between 1 and 200),
 artifact_hash text not null,
 acquired_at timestamptz not null default now(),
 heartbeat_at timestamptz not null default now(),
 lease_until timestamptz not null default now()+interval '10 minutes'
);
create table if not exists public.target_org_lock_events (
 id bigint generated always as identity primary key,
 org_id text not null, workspace_id uuid not null, job_id uuid not null,
 scope text not null, action text not null, at timestamptz not null default now()
);
alter table public.target_org_locks enable row level security;
alter table public.target_org_lock_events enable row level security;
revoke all on public.target_org_locks,public.target_org_lock_events from public,anon,authenticated;
grant all on public.target_org_locks,public.target_org_lock_events to service_role;

create or replace function public.acquire_target_org(p_workspace uuid,p_job uuid,p_org text,p_scope text,p_artifact text)
returns boolean language plpgsql security definer set search_path=public as $$
declare d jsonb; changed integer;
begin
 select data into d from jobs where id=p_job and workspace_id=p_workspace and busy=true for update;
 if not found or d->'artifacts'->>'hash' is distinct from p_artifact then return false; end if;
 if not (left(coalesce(d->'orgContext'->'org'->>'id',''),15)=left(p_org,15) or exists(select 1 from jsonb_array_elements(coalesce(d->'pipeline'->'policy'->'stages','[]'::jsonb)) s where left(s->>'orgId',15)=left(p_org,15))) then return false; end if;
 insert into target_org_locks(org_id,workspace_id,job_id,scope,artifact_hash)
 values(left(p_org,15),p_workspace,p_job,p_scope,p_artifact)
 on conflict(org_id) do update set heartbeat_at=now(),lease_until=now()+interval '10 minutes'
 where target_org_locks.workspace_id=p_workspace and target_org_locks.job_id=p_job and target_org_locks.scope=p_scope and target_org_locks.artifact_hash=p_artifact;
 get diagnostics changed=row_count;
 if changed=1 then insert into target_org_lock_events(org_id,workspace_id,job_id,scope,action) values(left(p_org,15),p_workspace,p_job,p_scope,'acquire_or_heartbeat'); end if;
 return changed=1;
end; $$;

create or replace function public.release_target_org(p_workspace uuid,p_job uuid,p_org text,p_scope text)
returns boolean language plpgsql security definer set search_path=public as $$
declare d jsonb; s jsonb; safe boolean:=false; changed integer;
begin
 select data into d from jobs where id=p_job and workspace_id=p_workspace and busy=false for update;
 if not found then return false; end if;
 if p_scope like 'pipeline:%' then
  for s in select value from jsonb_array_elements(coalesce(d->'pipeline'->'stages','[]'::jsonb)) loop
   if p_scope='pipeline:'||(d->'pipeline'->>'id')||':'||(s->>'name')||':'||(s->>'runId') then
    safe:=s->>'status' in ('passed','failed','blocked') and not exists(select 1 from jsonb_array_elements(coalesce(s->'operations','[]'::jsonb)) o where o->>'phase' is distinct from 'completed');
   end if;
  end loop;
 elsif p_scope='direct:'||(d->'targetLock'->>'id') then
  safe:=coalesce((d->(d->'targetLock'->>'field')->'result'->>'done')::boolean,false) and d->'operation'->>'phase'='response_recorded';
 end if;
 if safe is distinct from true then return false; end if;
 delete from target_org_locks where org_id=left(p_org,15) and workspace_id=p_workspace and job_id=p_job and scope=p_scope;
 get diagnostics changed=row_count;
 if changed=1 then insert into target_org_lock_events(org_id,workspace_id,job_id,scope,action) values(left(p_org,15),p_workspace,p_job,p_scope,'release_verified_terminal'); end if;
 return changed=1;
end; $$;
create or replace function public.target_lock_schema_version() returns integer language sql security definer set search_path=public as $$select 1;$$;
revoke all on function public.acquire_target_org(uuid,uuid,text,text,text),public.release_target_org(uuid,uuid,text,text),public.target_lock_schema_version() from public,anon,authenticated;
grant execute on function public.acquire_target_org(uuid,uuid,text,text,text),public.release_target_org(uuid,uuid,text,text),public.target_lock_schema_version() to service_role;
commit;
