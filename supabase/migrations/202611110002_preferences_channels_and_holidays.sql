-- 202611110002_preferences_channels_and_holidays.sql
-- 1. Per-user project tab & table column preferences (isolated per user, available to all roles incl. viewers)
-- 2. Organization country code for automatic public holiday imports
-- 3. Project team channel posts & file storage + notification/email constraint extensions

-- 1. Per-user preferences
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  project_tab_order jsonb not null default '["list","board","calendar","gantt","workload","whiteboard","flowchart","channel"]'::jsonb,
  list_column_order jsonb not null default '["title","status","priority","assignees","start_date","due_date","hours","tags"]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_own_all" on public.user_preferences;
create policy "user_preferences_own_all" on public.user_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. Country code on organizations for auto-importing public holidays
alter table public.organizations
  add column if not exists country_code text;

-- 3. Project channel posts & file storage (all accessible project/workspace/org members participate automatically)
create table if not exists public.project_channel_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  mentioned_user_ids uuid[] not null default '{}',
  referenced_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_channel_posts_project_idx
  on public.project_channel_posts (project_id, created_at desc);

drop trigger if exists project_channel_posts_updated_at on public.project_channel_posts;
create trigger project_channel_posts_updated_at
  before update on public.project_channel_posts
  for each row execute function public.set_updated_at();

alter table public.project_channel_posts enable row level security;

drop policy if exists "channel_posts_select_project_members" on public.project_channel_posts;
create policy "channel_posts_select_project_members" on public.project_channel_posts
  for select to authenticated
  using (public.can_access_project(project_id));

drop policy if exists "channel_posts_insert_project_members" on public.project_channel_posts;
create policy "channel_posts_insert_project_members" on public.project_channel_posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_access_project(project_id));

drop policy if exists "channel_posts_update_author_or_manager" on public.project_channel_posts;
create policy "channel_posts_update_author_or_manager" on public.project_channel_posts
  for update to authenticated
  using (public.can_access_project(project_id) and (author_id = (select auth.uid()) or public.can_manage_project(project_id)))
  with check (public.can_access_project(project_id) and (author_id = (select auth.uid()) or public.can_manage_project(project_id)));

drop policy if exists "channel_posts_delete_author_or_manager" on public.project_channel_posts;
create policy "channel_posts_delete_author_or_manager" on public.project_channel_posts
  for delete to authenticated
  using (public.can_access_project(project_id) and (author_id = (select auth.uid()) or public.can_manage_project(project_id)));

create table if not exists public.project_channel_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  post_id uuid references public.project_channel_posts(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0 and file_size_bytes <= 20971520),
  file_bytes bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists project_channel_files_post_idx
  on public.project_channel_files (post_id);
create index if not exists project_channel_files_project_idx
  on public.project_channel_files (project_id, created_at desc);

alter table public.project_channel_files enable row level security;

drop policy if exists "channel_files_select_project_members" on public.project_channel_files;
create policy "channel_files_select_project_members" on public.project_channel_files
  for select to authenticated
  using (public.can_access_project(project_id));

drop policy if exists "channel_files_insert_project_members" on public.project_channel_files;
create policy "channel_files_insert_project_members" on public.project_channel_files
  for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and public.can_access_project(project_id));

drop policy if exists "channel_files_update_uploader_or_manager" on public.project_channel_files;
create policy "channel_files_update_uploader_or_manager" on public.project_channel_files
  for update to authenticated
  using (public.can_access_project(project_id) and (uploaded_by = (select auth.uid()) or public.can_manage_project(project_id)))
  with check (public.can_access_project(project_id) and (uploaded_by = (select auth.uid()) or public.can_manage_project(project_id)));

drop policy if exists "channel_files_delete_uploader_or_manager" on public.project_channel_files;
create policy "channel_files_delete_uploader_or_manager" on public.project_channel_files
  for delete to authenticated
  using (public.can_access_project(project_id) and (uploaded_by = (select auth.uid()) or public.can_manage_project(project_id)));

-- 4. Expand notifications check constraint & allow project members to insert mention/completion alerts
alter table if exists public.notifications drop constraint if exists notifications_event_type_check;
alter table if exists public.notifications add constraint notifications_event_type_check
  check (event_type in (
    'task_assigned',
    'task_reassigned',
    'task_unassigned',
    'task_commented',
    'task_status_changed',
    'task_completed',
    'task_due_reminder',
    'task_mentioned',
    'channel_mentioned'
  ));

drop policy if exists "notifications_insert_project_member" on public.notifications;
create policy "notifications_insert_project_member" on public.notifications
  for insert to authenticated
  with check (actor_id = (select auth.uid()) and public.can_access_project(project_id));

-- Allow recipient to mark individual notification read as well
drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- 5. Expand email_logs email_type check constraint
alter table if exists public.email_logs drop constraint if exists email_logs_email_type_check;
alter table if exists public.email_logs add constraint email_logs_email_type_check
  check (email_type in (
    'task_assigned',
    'task_unassigned',
    'task_completed',
    'task_due_reminder',
    'task_mentioned',
    'channel_mentioned',
    'custom'
  ));
