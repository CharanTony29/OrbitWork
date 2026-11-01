create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 100000),
  description text not null default '' check (char_length(description) <= 2000),
  billable boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade,
  check ((ended_at is null and duration_minutes is null) or (ended_at is not null and ended_at > started_at))
);

create unique index one_running_timer_per_user on public.time_entries(user_id) where ended_at is null;
create index time_entries_project_user_started_idx on public.time_entries(project_id, user_id, started_at desc);
create index time_entries_task_idx on public.time_entries(task_id, started_at desc);
alter table public.time_entries enable row level security;

create policy "time_entries_read_accessible" on public.time_entries for select to authenticated
using (public.can_access_project(project_id));
create policy "time_entries_create_self_editors" on public.time_entries for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_edit_project_tasks(project_id));
create policy "time_entries_update_self_or_manager" on public.time_entries for update to authenticated
using (user_id = (select auth.uid()) or public.can_manage_project(project_id))
with check (public.can_edit_project_tasks(project_id) and (user_id = (select auth.uid()) or public.can_manage_project(project_id)));
create policy "time_entries_delete_self_or_manager" on public.time_entries for delete to authenticated
using (user_id = (select auth.uid()) or public.can_manage_project(project_id));
