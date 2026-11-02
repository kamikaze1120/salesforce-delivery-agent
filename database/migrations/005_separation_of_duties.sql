-- Apply after 004_target_locks.sql. Separation-of-duties approval policy (B44).
-- 'warn' (the default) records a self-approval without blocking it; 'enforce' rejects a
-- gate approved by the artifact's author or the prior approver, so a distinct reviewer is required.
-- The application treats a missing column / missing row value as 'warn', so this migration is
-- only required before switching a workspace to 'enforce'.
begin;
alter table public.workspaces add column if not exists sod_mode text not null default 'warn';
alter table public.workspaces drop constraint if exists workspaces_sod_mode_check;
alter table public.workspaces add constraint workspaces_sod_mode_check check (sod_mode in ('warn','enforce'));
commit;
