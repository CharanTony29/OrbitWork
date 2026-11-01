-- Migration: User Approval Workflow
-- Adds approval_status to profiles, updates handle_new_user, and grants admin management policies

-- 1. Add approval_status column to public.profiles
alter table public.profiles add column if not exists approval_status text not null default 'pending';

-- 2. Mark existing profiles as approved so existing team members continue to have access
update public.profiles set approval_status = 'approved' where approval_status = 'pending';

-- 3. Update handle_new_user trigger function
-- Auto-approve if user was invited to an organization/workspace; otherwise mark 'pending'
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  is_invited boolean := false;
  initial_status text := 'pending';
begin
  select exists (
    select 1 from public.invitations
    where lower(email) = lower(new.email) and status = 'pending'
  ) into is_invited;

  if is_invited then
    initial_status := 'approved';
  end if;

  insert into public.profiles (id, display_name, email, approval_status)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Team member'
    ),
    coalesce(new.email, ''),
    initial_status
  )
  on conflict (id) do update set
    email = excluded.email,
    approval_status = case
      when public.profiles.approval_status = 'approved' then 'approved'
      else excluded.approval_status
    end;
  return new;
end;
$$;

-- 4. RLS policies for admins to view and approve/reject pending registrations
drop policy if exists "profiles_read_pending_admins" on public.profiles;
create policy "profiles_read_pending_admins" on public.profiles for select to authenticated
using (
  approval_status in ('pending', 'rejected') and exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin')
  )
);

drop policy if exists "profiles_manage_approval_admins" on public.profiles;
create policy "profiles_manage_approval_admins" on public.profiles for update to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin')
  )
) with check (
  exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin')
  )
);
