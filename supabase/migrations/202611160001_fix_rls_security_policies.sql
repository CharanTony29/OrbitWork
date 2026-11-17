-- 202611160001_fix_rls_security_policies.sql
-- Harden Row-Level Security: replace overly permissive `using (true)` policies
-- with scoped user and project/workspace membership checks.
-- Self-contained: creates tables if not present, then hardens RLS policies.

-- ======================================================================
-- 1. email_logs scoped RLS
-- ======================================================================
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_id uuid references auth.users(id) on delete set null,
  subject text not null,
  email_type text not null default 'custom' check (email_type in ('task_assigned', 'task_due_reminder', 'task_mentioned', 'custom')),
  task_id uuid references public.tasks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  status text not null default 'sent',
  error_message text,
  sent_at timestamptz not null default now()
);

alter table if exists public.email_logs enable row level security;

drop policy if exists "email_logs_read_authenticated" on public.email_logs;
drop policy if exists "email_logs_read_scoped" on public.email_logs;
drop policy if exists "email_logs_insert_scoped" on public.email_logs;

create policy "email_logs_read_scoped" on public.email_logs
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    or (project_id is not null and public.can_access_project(project_id))
  );

create policy "email_logs_insert_scoped" on public.email_logs
  for insert to authenticated
  with check (
    recipient_id = (select auth.uid())
    or (project_id is not null and public.can_access_project(project_id))
  );

-- ======================================================================
-- 2. custom_ai_agents scoped RLS
-- ======================================================================
create table if not exists public.custom_ai_agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  trigger_type text not null default 'manual' check (trigger_type in ('on_subtask_created', 'on_task_created', 'on_status_change', 'manual')),
  action_type text not null default 'custom_agent' check (action_type in ('auto_assign_parent', 'generate_checklist', 'estimate_time', 'custom_agent')),
  system_instructions text not null default '',
  enabled boolean not null default true,
  runs_count integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.custom_ai_agents enable row level security;

drop policy if exists "Allow read custom_ai_agents for authenticated users" on public.custom_ai_agents;
drop policy if exists "Allow insert custom_ai_agents for authenticated users" on public.custom_ai_agents;
drop policy if exists "Allow update custom_ai_agents for authenticated users" on public.custom_ai_agents;
drop policy if exists "Allow delete custom_ai_agents for authenticated users" on public.custom_ai_agents;
drop policy if exists "custom_ai_agents_select" on public.custom_ai_agents;
drop policy if exists "custom_ai_agents_insert" on public.custom_ai_agents;
drop policy if exists "custom_ai_agents_update" on public.custom_ai_agents;
drop policy if exists "custom_ai_agents_delete" on public.custom_ai_agents;

create policy "custom_ai_agents_select" on public.custom_ai_agents
  for select to authenticated
  using (
    (project_id is not null and public.can_access_project(project_id))
    or (workspace_id is not null and public.can_access_workspace(workspace_id))
    or (organization_id is not null and public.is_active_org_member(organization_id))
    or created_by = (select auth.uid())
  );

create policy "custom_ai_agents_insert" on public.custom_ai_agents
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (project_id is not null and public.can_edit_project_tasks(project_id))
      or (workspace_id is not null and public.can_manage_workspace(workspace_id))
      or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin','manager']::public.organization_role[]))
    )
  );

create policy "custom_ai_agents_update" on public.custom_ai_agents
  for update to authenticated
  using (
    (project_id is not null and public.can_edit_project_tasks(project_id))
    or (workspace_id is not null and public.can_manage_workspace(workspace_id))
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin','manager']::public.organization_role[]))
    or created_by = (select auth.uid())
  )
  with check (
    (project_id is not null and public.can_edit_project_tasks(project_id))
    or (workspace_id is not null and public.can_manage_workspace(workspace_id))
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin','manager']::public.organization_role[]))
    or created_by = (select auth.uid())
  );

create policy "custom_ai_agents_delete" on public.custom_ai_agents
  for delete to authenticated
  using (
    (project_id is not null and public.can_edit_project_tasks(project_id))
    or (workspace_id is not null and public.can_manage_workspace(workspace_id))
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin','manager']::public.organization_role[]))
    or created_by = (select auth.uid())
  );

-- ======================================================================
-- 3. custom_ai_agent_logs scoped RLS
-- ======================================================================
create table if not exists public.custom_ai_agent_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.custom_ai_agents(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'success' check (status in ('success', 'failed', 'skipped')),
  summary text not null default '',
  created_at timestamptz not null default now()
);

alter table if exists public.custom_ai_agent_logs enable row level security;

drop policy if exists "Allow read custom_ai_agent_logs for authenticated users" on public.custom_ai_agent_logs;
drop policy if exists "Allow insert custom_ai_agent_logs for authenticated users" on public.custom_ai_agent_logs;
drop policy if exists "custom_ai_agent_logs_select" on public.custom_ai_agent_logs;
drop policy if exists "custom_ai_agent_logs_insert" on public.custom_ai_agent_logs;

create policy "custom_ai_agent_logs_select" on public.custom_ai_agent_logs
  for select to authenticated
  using (
    (project_id is not null and public.can_access_project(project_id))
    or exists (
      select 1 from public.custom_ai_agents a
      where a.id = custom_ai_agent_logs.agent_id
        and (
          (a.project_id is not null and public.can_access_project(a.project_id))
          or (a.workspace_id is not null and public.can_access_workspace(a.workspace_id))
          or (a.organization_id is not null and public.is_active_org_member(a.organization_id))
          or a.created_by = (select auth.uid())
        )
    )
  );

create policy "custom_ai_agent_logs_insert" on public.custom_ai_agent_logs
  for insert to authenticated
  with check (
    (project_id is not null and public.can_edit_project_tasks(project_id))
    or exists (
      select 1 from public.custom_ai_agents a
      where a.id = custom_ai_agent_logs.agent_id
        and (
          (a.project_id is not null and public.can_edit_project_tasks(a.project_id))
          or (a.workspace_id is not null and public.can_manage_workspace(a.workspace_id))
          or (a.organization_id is not null and public.has_org_role(a.organization_id, array['owner','admin','manager']::public.organization_role[]))
          or a.created_by = (select auth.uid())
        )
    )
  );
