-- Migration: Fix invitation acceptance idempotency and workspace member management RLS

-- 1. Support idempotent acceptance for invitations already accepted by the user
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
    for update;

  if not found then
    raise exception 'Invitation is invalid or expired';
  end if;

  if lower(invite.email) <> current_email then
    raise exception 'This invitation belongs to another email address';
  end if;

  -- If already accepted by this user, gracefully return the organization_id without failing
  if invite.status = 'accepted' then
    return invite.organization_id;
  end if;

  if invite.expires_at <= now() then
    raise exception 'Invitation is invalid or expired';
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


-- 2. Update can_manage_workspace to properly recognize workspace admins and managers
create or replace function public.can_manage_workspace(target_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE w.id = target_workspace
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.organizations o ON o.id = w.organization_id
    WHERE w.id = target_workspace
      AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = target_workspace
      AND w.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('admin', 'manager')
  );
$$;

revoke all on function public.can_manage_workspace(uuid) from public;
grant execute on function public.can_manage_workspace(uuid) to authenticated;


-- 3. Update workspace_members RLS policy to allow management by anyone with workspace manage rights
ALTER POLICY "workspace_members_manage_admins" ON public.workspace_members
USING (
  public.can_manage_workspace(workspace_id)
)
WITH CHECK (
  public.can_manage_workspace(workspace_id)
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = workspace_members.organization_id
      AND om.user_id = workspace_members.user_id
      AND om.status = 'active'
  )
);
