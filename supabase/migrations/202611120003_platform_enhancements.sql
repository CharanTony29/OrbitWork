-- 202611120003_platform_enhancements.sql
-- Comprehensive migration for:
-- 1. Manual user presence status LOV + expiration
-- 2. Organization reporting hierarchy (manager_id on organization_members)
-- 3. Leave requests Out-of-Office & urgent/high task delegation fields
-- 4. Org-level notifications (nullable project_id, action_url, expanded event types)
-- 5. Project Goals (milestones, achievements, key performer, completion tracking)
-- 6. Planner & Meeting Rooms

-- ---------------------------------------------------------------------------
-- 1. User presence status & expiration on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists presence_status text not null default 'available',
  add column if not exists presence_expires_at timestamptz,
  add column if not exists status_message text not null default '';

alter table if exists public.profiles drop constraint if exists profiles_presence_status_check;
alter table if exists public.profiles add constraint profiles_presence_status_check
  check (presence_status in ('available', 'busy', 'dnd', 'brb', 'away', 'offline'));

-- ---------------------------------------------------------------------------
-- 2. Organization Hierarchy (manager_id on organization_members)
-- ---------------------------------------------------------------------------
alter table public.organization_members
  add column if not exists manager_id uuid references auth.users(id) on delete set null;

create index if not exists organization_members_manager_idx
  on public.organization_members (organization_id, manager_id);

-- Allow organization owners to manage reporting hierarchy safely
drop policy if exists "org_members_owner_update_hierarchy" on public.organization_members;
create policy "org_members_owner_update_hierarchy" on public.organization_members
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner']::public.organization_role[]));

-- ---------------------------------------------------------------------------
-- 3. Leave Requests: Out-of-Office, Delegate, Delegated Tasks, Immediate Manager
-- ---------------------------------------------------------------------------
alter table public.leave_requests
  add column if not exists out_of_office boolean not null default false,
  add column if not exists delegate_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delegated_task_ids uuid[] not null default '{}',
  add column if not exists manager_id uuid references auth.users(id) on delete set null;

-- Update leave select RLS & review_leave_request RPC so an employee's immediate
-- reporting manager can view and review their leave request even if their org
-- role is 'member'.
drop policy if exists "leave_read_self_or_reviewer" on public.leave_requests;
create policy "leave_read_self_or_reviewer" on public.leave_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or manager_id = (select auth.uid())
    or delegate_user_id = (select auth.uid())
    or public.can_review_leave(organization_id)
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = leave_requests.organization_id
        and om.user_id = leave_requests.user_id
        and om.manager_id = (select auth.uid())
        and om.status = 'active'
    )
  );

create or replace function public.review_leave_request(target_request uuid, decision text, note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_org uuid;
  req_user uuid;
  req_manager uuid;
  member_manager uuid;
  is_allowed boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid leave decision'; end if;
  if char_length(note) > 2000 then raise exception 'Review note is too long'; end if;

  select organization_id, user_id, manager_id
    into target_org, req_user, req_manager
  from public.leave_requests where id = target_request;

  if target_org is null then raise exception 'Leave request not found'; end if;

  select om.manager_id into member_manager
  from public.organization_members om
  where om.organization_id = target_org and om.user_id = req_user;

  is_allowed := public.can_review_leave(target_org)
    or req_manager = (select auth.uid())
    or member_manager = (select auth.uid());

  if not is_allowed then raise exception 'Leave request access denied'; end if;

  update public.leave_requests
  set status = decision::public.leave_request_status,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = note
  where id = target_request and status = 'pending';
  if not found then raise exception 'Only pending requests can be reviewed'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Notifications: allow org-level notifications & new event types
-- ---------------------------------------------------------------------------
alter table public.notifications
  alter column project_id drop not null,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists action_url text;

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
    'channel_mentioned',
    'leave_requested',
    'leave_reviewed',
    'task_delegated',
    'goal_completed',
    'meeting_scheduled'
  ));

drop policy if exists "notifications_read_self" on public.notifications;
create policy "notifications_read_self" on public.notifications
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    and (project_id is null or public.can_access_project(project_id))
  );

drop policy if exists "notifications_insert_project_member" on public.notifications;
create policy "notifications_insert_project_member" on public.notifications
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (
      (project_id is not null and public.can_access_project(project_id))
      or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[]))
    )
  );

-- Update email_logs event check if present
alter table if exists public.email_logs drop constraint if exists email_logs_email_type_check;
alter table if exists public.email_logs add constraint email_logs_email_type_check
  check (email_type in (
    'task_assigned',
    'task_unassigned',
    'task_completed',
    'task_due_reminder',
    'task_mentioned',
    'channel_mentioned',
    'leave_requested',
    'leave_reviewed',
    'task_delegated',
    'meeting_scheduled',
    'custom'
  ));

-- ---------------------------------------------------------------------------
-- 5. Project Goals (Milestones, Achievements, Key Performer)
-- ---------------------------------------------------------------------------
create table if not exists public.project_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  target_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  key_performer_id uuid references auth.users(id) on delete set null,
  milestones jsonb not null default '[]'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_goals_project_idx
  on public.project_goals (project_id, created_at desc);

drop trigger if exists project_goals_updated_at on public.project_goals;
create trigger project_goals_updated_at
  before update on public.project_goals
  for each row execute function public.set_updated_at();

alter table public.project_goals enable row level security;

drop policy if exists "project_goals_select" on public.project_goals;
create policy "project_goals_select" on public.project_goals
  for select to authenticated
  using (public.can_access_project(project_id));

drop policy if exists "project_goals_insert" on public.project_goals;
create policy "project_goals_insert" on public.project_goals
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));

drop policy if exists "project_goals_update" on public.project_goals;
create policy "project_goals_update" on public.project_goals
  for update to authenticated
  using (public.can_edit_project_tasks(project_id))
  with check (public.can_edit_project_tasks(project_id));

drop policy if exists "project_goals_delete" on public.project_goals;
create policy "project_goals_delete" on public.project_goals
  for delete to authenticated
  using (public.can_edit_project_tasks(project_id));

-- ---------------------------------------------------------------------------
-- 6. Planner & Meeting Rooms
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  room_name text not null default 'Focus Room' check (char_length(room_name) between 1 and 120),
  room_code text not null check (char_length(room_code) between 3 and 80),
  meeting_url text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  participant_ids uuid[] not null default '{}',
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_org_start_idx
  on public.meetings (organization_id, start_time);
create index if not exists meetings_organizer_idx
  on public.meetings (organizer_id, start_time);

drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;

drop policy if exists "meetings_select_members" on public.meetings;
create policy "meetings_select_members" on public.meetings
  for select to authenticated
  using (
    organizer_id = (select auth.uid())
    or (select auth.uid()) = any(participant_ids)
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[]))
    or (project_id is not null and public.can_access_project(project_id))
  );

drop policy if exists "meetings_insert_members" on public.meetings;
create policy "meetings_insert_members" on public.meetings
  for insert to authenticated
  with check (
    organizer_id = (select auth.uid())
    and (
      organization_id is null
      or public.has_org_role(organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[])
    )
  );

drop policy if exists "meetings_update_organizer" on public.meetings;
create policy "meetings_update_organizer" on public.meetings
  for update to authenticated
  using (
    organizer_id = (select auth.uid())
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  )
  with check (
    organizer_id = (select auth.uid())
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  );

drop policy if exists "meetings_delete_organizer" on public.meetings;
create policy "meetings_delete_organizer" on public.meetings
  for delete to authenticated
  using (
    organizer_id = (select auth.uid())
    or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  );
