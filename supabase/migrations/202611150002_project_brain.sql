-- 202611150002_project_brain.sql
-- Orbitwork Project Brain: Decisions, Brain Snapshots & Actionable Recommendations

-- 1. Project Decisions (Project Memory)
create table if not exists public.project_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  decision_date date not null default current_date,
  reason text not null default '' check (char_length(reason) <= 5000),
  impact text not null default '' check (char_length(impact) <= 5000),
  status text not null default 'accepted' check (status in ('proposed', 'accepted', 'superseded', 'deprecated', 'rejected')),
  related_tasks uuid[] not null default '{}',
  related_documents uuid[] not null default '{}',
  tags text[] not null default '{}',
  decided_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_decisions_project on public.project_decisions(project_id, decision_date desc);

-- 2. Project Brain Snapshots (Health & Analysis Cache)
create table if not exists public.project_brain_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  health_score integer not null check (health_score between 0 and 100),
  health_status text not null check (health_status in ('healthy', 'needs_attention', 'at_risk', 'critical')),
  category_scores jsonb not null default '{}'::jsonb,
  summary text not null default '',
  why_at_risk jsonb not null default '[]'::jsonb,
  key_risks jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  dependency_insights jsonb not null default '{}'::jsonb,
  workload_insights jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_brain_snapshots_project on public.project_brain_snapshots(project_id, created_at desc);

-- 3. Project Recommendations (Safe, user-confirmed actions)
create table if not exists public.project_recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 5000),
  reason text not null default '',
  expected_benefit text not null default '',
  possible_risk text not null default '',
  action_type text not null check (action_type in ('reschedule_task', 'reassign_task', 'remove_dependency', 'adjust_deadline', 'change_priority', 'mark_milestone', 'custom')),
  action_payload jsonb not null default '{}'::jsonb,
  affected_entities jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'applied', 'rejected', 'dismissed')),
  applied_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_recommendations_project on public.project_recommendations(project_id, status, created_at desc);

-- Enable Row Level Security
alter table public.project_decisions enable row level security;
alter table public.project_brain_snapshots enable row level security;
alter table public.project_recommendations enable row level security;

-- Policies for project_decisions
create policy "project_decisions_select" on public.project_decisions
  for select to authenticated
  using (public.can_access_project(project_id));

create policy "project_decisions_insert" on public.project_decisions
  for insert to authenticated
  with check (public.can_edit_project_tasks(project_id));

create policy "project_decisions_update" on public.project_decisions
  for update to authenticated
  using (public.can_edit_project_tasks(project_id))
  with check (public.can_edit_project_tasks(project_id));

create policy "project_decisions_delete" on public.project_decisions
  for delete to authenticated
  using (public.can_edit_project_tasks(project_id));

-- Policies for project_brain_snapshots
create policy "project_brain_snapshots_select" on public.project_brain_snapshots
  for select to authenticated
  using (public.can_access_project(project_id));

create policy "project_brain_snapshots_insert" on public.project_brain_snapshots
  for insert to authenticated
  with check (public.can_access_project(project_id));

-- Policies for project_recommendations
create policy "project_recommendations_select" on public.project_recommendations
  for select to authenticated
  using (public.can_access_project(project_id));

create policy "project_recommendations_insert" on public.project_recommendations
  for insert to authenticated
  with check (public.can_edit_project_tasks(project_id));

create policy "project_recommendations_update" on public.project_recommendations
  for update to authenticated
  using (public.can_edit_project_tasks(project_id))
  with check (public.can_edit_project_tasks(project_id));

create policy "project_recommendations_delete" on public.project_recommendations
  for delete to authenticated
  using (public.can_edit_project_tasks(project_id));
