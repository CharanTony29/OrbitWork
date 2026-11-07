-- 202611070002_workspace_google_drive_storage.sql
-- Enables Workspace-level Google Drive Storage integration for Workspace Managers and Owners.
-- Each workspace can manage its own isolated Google Drive storage location.

-- 1. Add workspace_id, account_email, and folder_name to google_drive_connections
alter table public.google_drive_connections
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists account_email text,
  add column if not exists folder_name text;

-- 2. Drop the single organization_id unique constraint to allow multiple workspace connections per org
alter table public.google_drive_connections
  drop constraint if exists google_drive_connections_organization_id_key;

-- 3. Add scoped unique indexes
create unique index if not exists google_drive_connections_workspace_idx
  on public.google_drive_connections (workspace_id)
  where workspace_id is not null;

create unique index if not exists google_drive_connections_org_idx
  on public.google_drive_connections (organization_id)
  where workspace_id is null;

create index if not exists google_drive_connections_ws_lookup_idx
  on public.google_drive_connections (workspace_id, organization_id);

-- 4. Recreate RLS Policies to allow Workspace Managers & Owners to manage their workspace drive
drop policy if exists "drive_connection_read_org_members" on public.google_drive_connections;
drop policy if exists "drive_connection_read_permitted" on public.google_drive_connections;
drop policy if exists "drive_connection_create_admins" on public.google_drive_connections;
drop policy if exists "drive_connection_create_managers" on public.google_drive_connections;
drop policy if exists "drive_connection_update_admins" on public.google_drive_connections;
drop policy if exists "drive_connection_update_managers" on public.google_drive_connections;
drop policy if exists "drive_connection_delete_admins" on public.google_drive_connections;
drop policy if exists "drive_connection_delete_managers" on public.google_drive_connections;

create policy "drive_connection_read_permitted" on public.google_drive_connections
  for select to authenticated
  using (
    (workspace_id is null and public.has_org_role(organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[]))
    or
    (workspace_id is not null and (
      public.can_manage_workspace(workspace_id)
      or exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = google_drive_connections.workspace_id
          and wm.user_id = (select auth.uid())
          and wm.status = 'active'
      )
      or exists (
        select 1 from public.workspaces w
        where w.id = google_drive_connections.workspace_id
          and public.has_org_role(w.organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[])
      )
    ))
  );

create policy "drive_connection_create_managers" on public.google_drive_connections
  for insert to authenticated
  with check (
    connected_by = (select auth.uid()) and (
      (workspace_id is not null and public.can_manage_workspace(workspace_id))
      or
      (workspace_id is null and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
    )
  );

create policy "drive_connection_update_managers" on public.google_drive_connections
  for update to authenticated
  using (
    (workspace_id is not null and public.can_manage_workspace(workspace_id))
    or
    (workspace_id is null and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  )
  with check (
    (workspace_id is not null and public.can_manage_workspace(workspace_id))
    or
    (workspace_id is null and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  );

create policy "drive_connection_delete_managers" on public.google_drive_connections
  for delete to authenticated
  using (
    (workspace_id is not null and public.can_manage_workspace(workspace_id))
    or
    (workspace_id is null and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  );
