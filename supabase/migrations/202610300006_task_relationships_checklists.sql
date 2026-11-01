create type public.task_link_type as enum ('blocks', 'blocked_by', 'related', 'duplicate');

alter table public.tasks add column recurrence_rule jsonb
  check (recurrence_rule is null or jsonb_typeof(recurrence_rule) = 'object');

create table public.task_dependencies (
  project_id uuid not null,
  task_id uuid not null,
  linked_task_id uuid not null,
  relation public.task_link_type not null default 'related',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, linked_task_id, relation),
  check (task_id <> linked_task_id),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade,
  foreign key (project_id, linked_task_id) references public.tasks(project_id, id) on delete cascade
);

create table public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid not null,
  title text not null default 'Checklist' check (char_length(title) between 1 and 100),
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, task_id, id),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid not null,
  checklist_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  is_complete boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade,
  foreign key (project_id, task_id, checklist_id) references public.task_checklists(project_id, task_id, id) on delete cascade
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null default 'application/octet-stream' check (char_length(mime_type) <= 150),
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  storage_provider text not null default 'google_drive' check (storage_provider in ('google_drive', 'external_link')),
  external_file_id text not null,
  external_url text,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (project_id, task_id) references public.tasks(project_id, id) on delete cascade
);

create index task_dependencies_project_idx on public.task_dependencies(project_id, task_id);
create index task_checklists_task_idx on public.task_checklists(project_id, task_id, position);
create index checklist_items_order_idx on public.checklist_items(checklist_id, position);
create index task_attachments_task_idx on public.task_attachments(project_id, task_id, created_at desc);

alter table public.task_dependencies enable row level security;
alter table public.task_checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.task_attachments enable row level security;

create policy "dependencies_read_accessible" on public.task_dependencies for select to authenticated
using (public.can_access_project(project_id));
create policy "dependencies_manage_editors" on public.task_dependencies for all to authenticated
using (public.can_edit_project_tasks(project_id))
with check (created_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));

create policy "checklists_read_accessible" on public.task_checklists for select to authenticated
using (public.can_access_project(project_id));
create policy "checklists_manage_editors" on public.task_checklists for all to authenticated
using (public.can_edit_project_tasks(project_id))
with check (created_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));

create policy "checklist_items_read_accessible" on public.checklist_items for select to authenticated
using (public.can_access_project(project_id));
create policy "checklist_items_create_editors" on public.checklist_items for insert to authenticated
with check (created_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));
create policy "checklist_items_update_editors" on public.checklist_items for update to authenticated
using (public.can_edit_project_tasks(project_id))
with check (public.can_edit_project_tasks(project_id));
create policy "checklist_items_delete_editors" on public.checklist_items for delete to authenticated
using (public.can_edit_project_tasks(project_id));

create policy "attachments_read_accessible" on public.task_attachments for select to authenticated
using (public.can_access_project(project_id));
create policy "attachments_create_editors" on public.task_attachments for insert to authenticated
with check (uploaded_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));
create policy "attachments_delete_uploader_or_manager" on public.task_attachments for delete to authenticated
using (uploaded_by = (select auth.uid()) or public.can_manage_project(project_id));
