-- Apply once to an existing v0.3 database before enabling CI/CD.
begin;
create or replace function public.replace_connection(p_workspace uuid,p_version integer,p_type text,p_config text,p_verified boolean,p_actor uuid,p_email text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform 1 from workspaces where id=p_workspace and connection_version=p_version for update;
  if not found then return false; end if;
  if exists(select 1 from jobs where workspace_id=p_workspace and
    (busy or data->'pipeline'->>'status' in ('queued','running','awaiting_business_approval') or stage in ('validating','deploying') or data->>'reconciliationRequired'='true')) then return false; end if;
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
