-- 202611080001_storage_integrations.sql
-- Enables Workspace and Organization Storage Integrations:
-- Local Storage (Built-in), Google Drive, Microsoft OneDrive, and Microsoft SharePoint.

-- 1. Create workspace_storage_configs table
create table if not exists public.workspace_storage_configs (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  active_provider text not null default 'local' check (active_provider in ('local', 'google_drive', 'onedrive', 'sharepoint')),
  onedrive_connected boolean not null default false,
  onedrive_account_email text,
  onedrive_folder text,
  onedrive_tenant_id text,
  onedrive_client_id text,
  onedrive_connected_at timestamptz,
  sharepoint_connected boolean not null default false,
  sharepoint_site_url text,
  sharepoint_library_name text,
  sharepoint_folder text,
  sharepoint_account_email text,
  sharepoint_tenant_id text,
  sharepoint_client_id text,
  sharepoint_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_storage_configs enable row level security;

-- 2. Create organization_storage_configs table
create table if not exists public.organization_storage_configs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  active_provider text not null default 'local' check (active_provider in ('local', 'google_drive', 'onedrive', 'sharepoint')),
  onedrive_connected boolean not null default false,
  onedrive_account_email text,
  onedrive_folder text,
  onedrive_tenant_id text,
  onedrive_client_id text,
  onedrive_connected_at timestamptz,
  sharepoint_connected boolean not null default false,
  sharepoint_site_url text,
  sharepoint_library_name text,
  sharepoint_folder text,
  sharepoint_account_email text,
  sharepoint_tenant_id text,
  sharepoint_client_id text,
  sharepoint_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_storage_configs enable row level security;

-- 3. RLS Policies for workspace_storage_configs
drop policy if exists "workspace_storage_read_permitted" on public.workspace_storage_configs;
create policy "workspace_storage_read_permitted" on public.workspace_storage_configs
  for select to authenticated
  using (
    public.can_access_workspace(workspace_id)
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_storage_configs.workspace_id
        and public.has_org_role(w.organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[])
    )
  );

drop policy if exists "workspace_storage_manage_permitted" on public.workspace_storage_configs;
create policy "workspace_storage_manage_permitted" on public.workspace_storage_configs
  for all to authenticated
  using (
    public.can_manage_workspace(workspace_id)
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_storage_configs.workspace_id
        and public.has_org_role(w.organization_id, array['owner','admin']::public.organization_role[])
    )
  )
  with check (
    public.can_manage_workspace(workspace_id)
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_storage_configs.workspace_id
        and public.has_org_role(w.organization_id, array['owner','admin']::public.organization_role[])
    )
  );

-- 4. RLS Policies for organization_storage_configs
drop policy if exists "org_storage_read_permitted" on public.organization_storage_configs;
create policy "org_storage_read_permitted" on public.organization_storage_configs
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[])
  );

drop policy if exists "org_storage_manage_permitted" on public.organization_storage_configs;
create policy "org_storage_manage_permitted" on public.organization_storage_configs
  for all to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
  )
  with check (
    public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
  );
