-- Migration: Allow workspace members & project contributors to access workspace cloud storage and refresh tokens safely
-- Fixes issue where non-owner members uploading files caused OneDrive token refresh to fail under RLS, falling back to local Supabase storage.

-- 1. Update SELECT policy for workspace_storage_configs
drop policy if exists "workspace_storage_read_permitted" on public.workspace_storage_configs;
create policy "workspace_storage_read_permitted" on public.workspace_storage_configs
  for select to authenticated
  using (
    public.can_access_workspace(workspace_id)
    or exists (
      select 1 from public.projects p
      where p.workspace_id = workspace_storage_configs.workspace_id
        and public.can_access_project(p.id)
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_storage_configs.workspace_id
        and public.has_org_role(w.organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[])
    )
  );

-- 2. Security definer function to allow authorized workspace/project members to rotate and persist OAuth refresh tokens during live uploads
create or replace function public.update_workspace_storage_refresh_token(
  target_workspace uuid,
  new_token_ciphertext text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  has_access boolean := false;
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select (
    public.can_access_workspace(target_workspace)
    or exists (
      select 1 from public.projects p
      where p.workspace_id = target_workspace
        and public.can_access_project(p.id)
    )
  ) into has_access;

  if not has_access then
    raise exception 'Forbidden: caller cannot access workspace storage';
  end if;

  update public.workspace_storage_configs
  set onedrive_refresh_token_ciphertext = new_token_ciphertext,
      updated_at = now()
  where workspace_id = target_workspace;

  return true;
end;
$$;

revoke all on function public.update_workspace_storage_refresh_token(uuid, text) from public;
grant execute on function public.update_workspace_storage_refresh_token(uuid, text) to authenticated;

-- 3. Security definer function for organization-level storage refresh tokens
create or replace function public.update_organization_storage_refresh_token(
  target_org uuid,
  new_token_ciphertext text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_member boolean := false;
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select public.is_active_org_member(target_org) into is_member;
  if not is_member then
    raise exception 'Forbidden: caller is not an active organization member';
  end if;

  update public.organization_storage_configs
  set onedrive_refresh_token_ciphertext = new_token_ciphertext,
      updated_at = now()
  where organization_id = target_org;

  return true;
end;
$$;

revoke all on function public.update_organization_storage_refresh_token(uuid, text) from public;
grant execute on function public.update_organization_storage_refresh_token(uuid, text) to authenticated;
