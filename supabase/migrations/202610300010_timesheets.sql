create type public.timesheet_state as enum ('submitted', 'approved', 'rejected');

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  week_start date not null check (extract(isodow from week_start) = 1),
  status public.timesheet_state not null default 'submitted',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 2000),
  created_at timestamptz not null default now(),
  unique (project_id, user_id, week_start)
);

alter table public.time_entries add column timesheet_id uuid references public.timesheets(id) on delete set null;
alter table public.timesheets add constraint timesheets_id_project_user_unique unique (id, project_id, user_id);
alter table public.time_entries add constraint time_entries_timesheet_owner_fkey foreign key (timesheet_id, project_id, user_id)
  references public.timesheets(id, project_id, user_id) on delete set null (timesheet_id);
create index timesheets_project_week_idx on public.timesheets(project_id, week_start desc, status);
create index time_entries_timesheet_idx on public.time_entries(timesheet_id) where timesheet_id is not null;
alter table public.timesheets enable row level security;

create policy "timesheets_read_self_or_project_manager" on public.timesheets for select to authenticated
using (public.can_access_project(project_id) and (user_id = (select auth.uid()) or public.can_manage_project(project_id)));

create or replace function public.validate_time_entry_timesheet_week()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sheet_week date;
begin
  if new.timesheet_id is null then return new; end if;
  select week_start into sheet_week from public.timesheets where id = new.timesheet_id;
  if sheet_week is null or sheet_week <> date_trunc('week', new.started_at at time zone 'UTC')::date then
    raise exception 'Time entry must belong to the timesheet for its UTC week';
  end if;
  return new;
end;
$$;
create trigger time_entries_validate_timesheet before insert or update of timesheet_id, started_at on public.time_entries for each row execute function public.validate_time_entry_timesheet_week();

alter policy "time_entries_create_self_editors" on public.time_entries
with check (
  user_id = (select auth.uid()) and public.can_edit_project_tasks(project_id)
  and not exists (
    select 1 from public.timesheets ts where ts.project_id = time_entries.project_id and ts.user_id = (select auth.uid())
      and ts.week_start = date_trunc('week', time_entries.started_at at time zone 'UTC')::date and ts.status in ('submitted', 'approved')
  )
);

alter policy "time_entries_update_self_or_manager" on public.time_entries
using (
  (user_id = (select auth.uid()) and (timesheet_id is null or exists (select 1 from public.timesheets ts where ts.id = time_entries.timesheet_id and ts.status = 'rejected')))
  or public.can_manage_project(project_id)
)
with check (
  public.can_edit_project_tasks(project_id)
  and ((user_id = (select auth.uid()) and (timesheet_id is null or exists (select 1 from public.timesheets ts where ts.id = time_entries.timesheet_id and ts.status = 'rejected'))) or public.can_manage_project(project_id))
);

alter policy "time_entries_delete_self_or_manager" on public.time_entries
using (
  (user_id = (select auth.uid()) and (timesheet_id is null or exists (select 1 from public.timesheets ts where ts.id = time_entries.timesheet_id and ts.status = 'rejected')))
  or public.can_manage_project(project_id)
);

create or replace function public.submit_project_timesheet(target_project uuid, target_week date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  week_end date;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if extract(isodow from target_week) <> 1 then raise exception 'Week must start on Monday'; end if;
  if not public.can_edit_project_tasks(target_project) then raise exception 'Project access denied'; end if;
  week_end := target_week + 7;
  if not exists (select 1 from public.time_entries te where te.project_id = target_project and te.user_id = (select auth.uid()) and te.started_at >= (target_week::timestamp at time zone 'UTC') and te.started_at < (week_end::timestamp at time zone 'UTC') and te.ended_at is not null) then
    raise exception 'No completed time entries for this week';
  end if;
  insert into public.timesheets(project_id, user_id, week_start, status, submitted_at, reviewed_by, reviewed_at, review_note)
  values (target_project, (select auth.uid()), target_week, 'submitted', now(), null, null, '')
  on conflict (project_id, user_id, week_start) do update set status = 'submitted', submitted_at = now(), reviewed_by = null, reviewed_at = null, review_note = ''
  where public.timesheets.status = 'rejected'
  returning id into new_id;
  if new_id is null then raise exception 'Timesheet is already submitted or approved'; end if;
  update public.time_entries set timesheet_id = new_id
  where project_id = target_project and user_id = (select auth.uid()) and started_at >= (target_week::timestamp at time zone 'UTC') and started_at < (week_end::timestamp at time zone 'UTC') and ended_at is not null;
  return new_id;
end;
$$;

create or replace function public.review_project_timesheet(target_timesheet uuid, decision text, note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_project uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid review decision'; end if;
  if char_length(note) > 2000 then raise exception 'Review note is too long'; end if;
  select project_id into target_project from public.timesheets where id = target_timesheet;
  if target_project is null or not public.can_manage_project(target_project) then raise exception 'Timesheet access denied'; end if;
  update public.timesheets set status = decision::public.timesheet_state, reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = note
  where id = target_timesheet and status = 'submitted';
  if not found then raise exception 'Only submitted timesheets can be reviewed'; end if;
end;
$$;
revoke all on function public.submit_project_timesheet(uuid, date) from public;
revoke all on function public.review_project_timesheet(uuid, text, text) from public;
grant execute on function public.submit_project_timesheet(uuid, date) to authenticated;
grant execute on function public.review_project_timesheet(uuid, text, text) to authenticated;
