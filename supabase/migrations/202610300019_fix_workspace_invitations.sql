-- Migration: Fix Workspace Invitations & Auto-Acceptance
-- 1. Fix accept_organization_invitation to include organization_id when inserting into workspace_members
create or replace function public.accept_organization_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invite public.invitations%rowtype;
begin
  if current_user_id is null or current_email = '' then
    raise exception 'Sign in to accept this invitation';
  end if;

  select * into invite from public.invitations i
    where i.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
      and i.status = 'pending' and i.expires_at > now()
    for update;

  if not found then
    raise exception 'Invitation is invalid or expired';
  end if;

  if lower(invite.email) <> current_email then
    raise exception 'This invitation belongs to another email address';
  end if;

  -- 1. Insert into organization_members with the invited role
  insert into public.organization_members (organization_id, user_id, role, status)
    values (invite.organization_id, current_user_id, invite.role, 'active')
    on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';

  -- 2. Insert into workspace_members with organization_id and invited role
  if invite.workspace_id is not null then
    insert into public.workspace_members (organization_id, workspace_id, user_id, role, status)
      values (invite.organization_id, invite.workspace_id, current_user_id, invite.role, 'active')
      on conflict (workspace_id, user_id) do update set role = excluded.role, status = 'active';
  end if;

  -- 3. Mark invitation as accepted
  update public.invitations set status = 'accepted' where id = invite.id;

  -- 4. Record audit event
  insert into public.audit_events (organization_id, actor_id, entity_type, entity_id, action)
    values (invite.organization_id, current_user_id, 'invitation', invite.id::text, 'accepted');

  return invite.organization_id;
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public;
grant execute on function public.accept_organization_invitation(text) to authenticated;

-- 2. Function to auto-accept all pending invitations for the signed-in user
create or replace function public.accept_user_pending_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invite record;
  accepted_count integer := 0;
begin
  if current_user_id is null or current_email = '' then
    return 0;
  end if;

  for invite in
    select id, organization_id, workspace_id, role
    from public.invitations
    where lower(email) = current_email
      and status = 'pending'
      and expires_at > now()
    order by created_at asc
    for update
  loop
    -- Add to organization_members
    insert into public.organization_members (organization_id, user_id, role, status)
    values (invite.organization_id, current_user_id, invite.role, 'active')
    on conflict (organization_id, user_id) do update
    set role = excluded.role, status = 'active';

    -- Add to workspace_members if workspace is specified
    if invite.workspace_id is not null then
      insert into public.workspace_members (organization_id, workspace_id, user_id, role, status)
      values (invite.organization_id, invite.workspace_id, current_user_id, invite.role, 'active')
      on conflict (workspace_id, user_id) do update
      set role = excluded.role, status = 'active';
    end if;

    -- Mark invitation accepted
    update public.invitations set status = 'accepted' where id = invite.id;

    -- Record audit event
    insert into public.audit_events (organization_id, actor_id, entity_type, entity_id, action)
    values (invite.organization_id, current_user_id, 'invitation', invite.id::text, 'accepted');

    accepted_count := accepted_count + 1;
  end loop;

  return accepted_count;
end;
$$;

revoke all on function public.accept_user_pending_invitations() from public;
grant execute on function public.accept_user_pending_invitations() to authenticated;

-- 3. Update handle_new_user trigger to automatically assign invited organizations and workspaces on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invite record;
begin
  -- Insert or update profile
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

  -- Automatically process any pending invitations for this new user
  for invite in
    select id, organization_id, workspace_id, role
    from public.invitations
    where lower(email) = lower(coalesce(new.email, ''))
      and status = 'pending'
      and expires_at > now()
    order by created_at asc
  loop
    insert into public.organization_members (organization_id, user_id, role, status)
    values (invite.organization_id, new.id, invite.role, 'active')
    on conflict (organization_id, user_id) do update
    set role = excluded.role, status = 'active';

    if invite.workspace_id is not null then
      insert into public.workspace_members (organization_id, workspace_id, user_id, role, status)
      values (invite.organization_id, invite.workspace_id, new.id, invite.role, 'active')
      on conflict (workspace_id, user_id) do update
      set role = excluded.role, status = 'active';
    end if;

    update public.invitations set status = 'accepted' where id = invite.id;
  end loop;

  return new;
end;
$$;

-- 4. Backfill: Deduplicate using DISTINCT ON so multiple invites to the same org/workspace do not conflict
insert into public.organization_members (organization_id, user_id, role, status)
select distinct on (i.organization_id, p.id)
  i.organization_id, p.id, i.role, 'active'
from public.invitations i
join public.profiles p on lower(p.email) = lower(i.email)
order by i.organization_id, p.id, i.created_at desc
on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';

insert into public.workspace_members (organization_id, workspace_id, user_id, role, status)
select distinct on (i.workspace_id, p.id)
  i.organization_id, i.workspace_id, p.id, i.role, 'active'
from public.invitations i
join public.profiles p on lower(p.email) = lower(i.email)
where i.workspace_id is not null
order by i.workspace_id, p.id, i.created_at desc
on conflict (workspace_id, user_id) do update set role = excluded.role, status = 'active';

update public.invitations i
set status = 'accepted'
from public.profiles p
where lower(p.email) = lower(i.email) and i.status = 'pending';
