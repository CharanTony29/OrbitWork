create type public.project_member_role as enum ('manager', 'member', 'viewer');
create type public.task_status_category as enum ('not_started', 'active', 'completed', 'cancelled');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  start_date date,
  due_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.project_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#87938b' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  category public.task_status_category not null default 'not_started',
  position integer not null default 0 check (position >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status_id uuid not null,
  parent_task_id uuid,
  title text not null check (char_length(title) between 1 and 240),
  description text not null default '' check (char_length(description) <= 10000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  start_date date,
  due_date date,
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes >= 0),
  progress smallint not null default 0 check (progress between 0 and 100),
  tags text[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  generated_key text generated always as ('TASK-' || upper(substr(id::text, 1, 8))) stored,
  foreign key (project_id, status_id) references public.project_statuses(project_id, id) on delete restrict,
  foreign key (project_id, parent_task_id) references public.tasks(project_id, id) on delete set null (parent_task_id),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table public.task_assignees (
  project_id uuid not null,
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid not null,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade
);

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  field_type text not null check (field_type in ('text', 'long_text', 'number', 'currency', 'date', 'datetime', 'dropdown', 'multi_select', 'checkbox', 'email', 'url', 'user', 'rating', 'formula', 'progress', 'duration')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, name)
);

create table public.task_custom_field_values (
  project_id uuid not null,
  task_id uuid not null,
  field_id uuid not null,
  value jsonb,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (task_id, field_id),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade,
  foreign key (project_id, field_id) references public.custom_field_definitions(project_id, id) on delete cascade
);

create index projects_workspace_created_idx on public.projects(workspace_id, created_at desc);
create index project_members_user_idx on public.project_members(user_id, project_id);
create index project_statuses_order_idx on public.project_statuses(project_id, position);
create index tasks_project_created_idx on public.tasks(project_id, created_at desc);
create index tasks_project_status_idx on public.tasks(project_id, status_id, created_at desc);
create index tasks_project_due_idx on public.tasks(project_id, due_date);
create index task_assignees_user_idx on public.task_assignees(user_id, task_id);
create index task_comments_task_created_idx on public.task_comments(task_id, created_at);
create index task_custom_values_field_idx on public.task_custom_field_values(field_id, task_id);

create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger task_comments_updated_at before update on public.task_comments for each row execute function public.set_updated_at();

create or replace function public.seed_project_statuses()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.project_statuses (project_id, name, color, category, position, is_default) values
    (new.id, 'New', '#87938B', 'not_started', 0, true),
    (new.id, 'In Progress', '#4689D8', 'active', 1, false),
    (new.id, 'On Hold', '#D7A43B', 'active', 2, false),
    (new.id, 'Completed', '#2E9B6D', 'completed', 3, false);
  return new;
end;
$$;

create trigger projects_seed_statuses after insert on public.projects for each row execute function public.seed_project_statuses();

create or replace function public.can_manage_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspaces w
    join public.organization_members om on om.organization_id = w.organization_id
    left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = (select auth.uid())
    where w.id = target_workspace and om.user_id = (select auth.uid()) and om.status = 'active'
      and (om.role in ('owner', 'admin') or (wm.status = 'active' and wm.role in ('admin', 'manager')))
  );
$$;

create or replace function public.can_access_project(target_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    join public.workspaces w on w.id = p.workspace_id
    join public.organization_members om on om.organization_id = w.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = (select auth.uid()) and wm.status = 'active'
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = (select auth.uid())
    where p.id = target_project and (om.role in ('owner', 'admin') or wm.user_id is not null or pm.user_id is not null)
  );
$$;

create or replace function public.can_manage_project(target_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    join public.workspaces w on w.id = p.workspace_id
    join public.organization_members om on om.organization_id = w.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = (select auth.uid()) and wm.status = 'active'
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = (select auth.uid())
    where p.id = target_project and (om.role in ('owner', 'admin') or wm.role in ('admin', 'manager') or pm.role = 'manager')
  );
$$;

create or replace function public.can_edit_project_tasks(target_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    join public.workspaces w on w.id = p.workspace_id
    join public.organization_members om on om.organization_id = w.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = (select auth.uid()) and wm.status = 'active'
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = (select auth.uid())
    where p.id = target_project and (om.role in ('owner', 'admin') or wm.role in ('admin', 'manager') or pm.role in ('manager', 'member'))
  );
$$;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.task_custom_field_values enable row level security;

create policy "projects_read_accessible" on public.projects for select to authenticated
using (public.can_access_project(id));
create policy "projects_create_workspace_managers" on public.projects for insert to authenticated
with check (created_by = (select auth.uid()) and public.can_manage_workspace(workspace_id));
create policy "projects_update_managers" on public.projects for update to authenticated
using (public.can_manage_project(id)) with check (public.can_manage_project(id));
create policy "projects_delete_managers" on public.projects for delete to authenticated
using (public.can_manage_project(id));

create policy "project_members_read_accessible" on public.project_members for select to authenticated
using (public.can_access_project(project_id));
create policy "project_members_manage_managers" on public.project_members for all to authenticated
using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

create policy "statuses_read_accessible" on public.project_statuses for select to authenticated
using (public.can_access_project(project_id));
create policy "statuses_manage_project" on public.project_statuses for all to authenticated
using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

create policy "tasks_read_accessible" on public.tasks for select to authenticated
using (public.can_access_project(project_id));
create policy "tasks_create_members" on public.tasks for insert to authenticated
with check (created_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));
create policy "tasks_update_members" on public.tasks for update to authenticated
using (public.can_edit_project_tasks(project_id)) with check (public.can_edit_project_tasks(project_id));
create policy "tasks_delete_editors" on public.tasks for delete to authenticated
using (public.can_edit_project_tasks(project_id));

create policy "task_assignees_read_accessible" on public.task_assignees for select to authenticated
using (public.can_access_project(project_id));
create policy "task_assignees_manage_editors" on public.task_assignees for all to authenticated
using (public.can_edit_project_tasks(project_id)) with check (assigned_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));

create policy "task_comments_read_accessible" on public.task_comments for select to authenticated
using (public.can_access_project(project_id));
create policy "task_comments_create_members" on public.task_comments for insert to authenticated
with check (author_id = (select auth.uid()) and public.can_edit_project_tasks(project_id));
create policy "task_comments_update_author_or_manager" on public.task_comments for update to authenticated
using (author_id = (select auth.uid()) or public.can_manage_project(project_id))
with check (author_id = (select auth.uid()) or public.can_manage_project(project_id));
create policy "task_comments_delete_author_or_manager" on public.task_comments for delete to authenticated
using (author_id = (select auth.uid()) or public.can_manage_project(project_id));

create policy "field_definitions_read_accessible" on public.custom_field_definitions for select to authenticated
using (public.can_access_project(project_id));
create policy "field_definitions_manage_project" on public.custom_field_definitions for all to authenticated
using (public.can_manage_project(project_id)) with check (created_by = (select auth.uid()) and public.can_manage_project(project_id));

create policy "task_field_values_read_accessible" on public.task_custom_field_values for select to authenticated
using (public.can_access_project(project_id));
create policy "task_field_values_manage_editors" on public.task_custom_field_values for all to authenticated
using (public.can_edit_project_tasks(project_id))
with check (updated_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));

revoke all on function public.can_manage_workspace(uuid) from public;
revoke all on function public.can_access_project(uuid) from public;
revoke all on function public.can_manage_project(uuid) from public;
revoke all on function public.can_edit_project_tasks(uuid) from public;
grant execute on function public.can_manage_workspace(uuid) to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;
grant execute on function public.can_edit_project_tasks(uuid) to authenticated;
