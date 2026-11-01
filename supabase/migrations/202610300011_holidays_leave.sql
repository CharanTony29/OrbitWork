create type public.leave_request_status as enum ('pending', 'approved', 'rejected');

create table public.organization_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  holiday_date date not null,
  location text not null default '' check (char_length(location) <= 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, holiday_date, name, location)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  leave_type text not null check (leave_type in ('vacation', 'sick', 'personal', 'other')),
  start_date date not null,
  end_date date not null,
  request_note text not null default '' check (char_length(request_note) <= 2000),
  status public.leave_request_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '' check (char_length(review_note) <= 2000),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index organization_holidays_date_idx on public.organization_holidays(organization_id, holiday_date);
create index leave_requests_org_dates_idx on public.leave_requests(organization_id, start_date, end_date);
create index leave_requests_user_status_idx on public.leave_requests(user_id, status, created_at desc);
alter table public.organization_holidays enable row level security;
alter table public.leave_requests enable row level security;

create or replace function public.can_review_leave(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_org_role(target_org, array['owner','admin','manager']::public.organization_role[])
    or exists (
      select 1 from public.workspace_members wm join public.workspaces w on w.id = wm.workspace_id
      join public.organization_members om on om.organization_id = w.organization_id and om.user_id = wm.user_id and om.status = 'active'
      where w.organization_id = target_org and wm.user_id = (select auth.uid()) and wm.status = 'active' and wm.role in ('admin','manager')
    );
$$;

create policy "holidays_read_org_members" on public.organization_holidays for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[]));
create policy "holidays_create_org_admins" on public.organization_holidays for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "holidays_update_org_admins" on public.organization_holidays for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "holidays_delete_org_admins" on public.organization_holidays for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy "leave_read_self_or_reviewer" on public.leave_requests for select to authenticated
using (user_id = (select auth.uid()) or public.can_review_leave(organization_id));
create policy "leave_create_self" on public.leave_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and exists (
  select 1 from public.organization_members om where om.organization_id = leave_requests.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
));

create or replace function public.review_leave_request(target_request uuid, decision text, note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid leave decision'; end if;
  if char_length(note) > 2000 then raise exception 'Review note is too long'; end if;
  select organization_id into target_org from public.leave_requests where id = target_request;
  if target_org is null or not public.can_review_leave(target_org) then raise exception 'Leave request access denied'; end if;
  update public.leave_requests set status = decision::public.leave_request_status, reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = note
  where id = target_request and status = 'pending';
  if not found then raise exception 'Only pending requests can be reviewed'; end if;
end;
$$;
revoke all on function public.can_review_leave(uuid) from public;
revoke all on function public.review_leave_request(uuid, text, text) from public;
grant execute on function public.can_review_leave(uuid) to authenticated;
grant execute on function public.review_leave_request(uuid, text, text) to authenticated;
