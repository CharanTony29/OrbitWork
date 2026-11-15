-- 202611150001_custom_ai_agents.sql
-- Custom AI Task Agents & In-App Automations Engine

create table if not exists public.custom_ai_agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  trigger_type text not null check (trigger_type in ('on_subtask_created', 'on_task_created', 'on_status_change', 'manual')),
  action_type text not null default 'custom_agent' check (action_type in ('auto_assign_parent', 'generate_checklist', 'estimate_time', 'custom_agent')),
  system_instructions text not null default '',
  enabled boolean not null default true,
  runs_count integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_ai_agents_project on public.custom_ai_agents(project_id);
create index if not exists idx_custom_ai_agents_trigger on public.custom_ai_agents(trigger_type) where enabled = true;

create table if not exists public.custom_ai_agent_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.custom_ai_agents(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_ai_agent_logs_agent on public.custom_ai_agent_logs(agent_id);

-- Enable RLS
alter table public.custom_ai_agents enable row level security;
alter table public.custom_ai_agent_logs enable row level security;

-- Policies for custom_ai_agents
create policy "Allow read custom_ai_agents for authenticated users"
  on public.custom_ai_agents for select
  to authenticated
  using (true);

create policy "Allow insert custom_ai_agents for authenticated users"
  on public.custom_ai_agents for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Allow update custom_ai_agents for authenticated users"
  on public.custom_ai_agents for update
  to authenticated
  using (auth.uid() is not null);

create policy "Allow delete custom_ai_agents for authenticated users"
  on public.custom_ai_agents for delete
  to authenticated
  using (auth.uid() is not null);

-- Policies for custom_ai_agent_logs
create policy "Allow read custom_ai_agent_logs for authenticated users"
  on public.custom_ai_agent_logs for select
  to authenticated
  using (true);

create policy "Allow insert custom_ai_agent_logs for authenticated users"
  on public.custom_ai_agent_logs for insert
  to authenticated
  with check (auth.uid() is not null);
