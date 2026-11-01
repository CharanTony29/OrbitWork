-- Migration: Remove User Approval Workflow
-- Auto-approves all users immediately upon registration and removes admin approval gating

-- 1. Mark all existing profiles as approved
update public.profiles set approval_status = 'approved';

-- 2. Set default approval_status to 'approved'
alter table public.profiles alter column approval_status set default 'approved';

-- 3. Replace handle_new_user trigger to automatically approve every signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email, approval_status)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Team member'
    ),
    coalesce(new.email, ''),
    'approved'
  )
  on conflict (id) do update set
    email = excluded.email,
    approval_status = 'approved';
  return new;
end;
$$;

-- 4. Clean up pending admin policies
drop policy if exists "profiles_read_pending_admins" on public.profiles;
drop policy if exists "profiles_manage_approval_admins" on public.profiles;
