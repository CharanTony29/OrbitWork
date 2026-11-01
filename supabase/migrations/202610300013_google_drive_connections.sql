create table public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  connected_by uuid not null references auth.users(id) on delete restrict,
  refresh_token_ciphertext text not null,
  token_key_version smallint not null default 1,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.google_drive_connections enable row level security;
create policy "drive_connection_read_org_members" on public.google_drive_connections for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin','manager','member','viewer']::public.organization_role[]));
create policy "drive_connection_create_admins" on public.google_drive_connections for insert to authenticated
with check (connected_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "drive_connection_update_admins" on public.google_drive_connections for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "drive_connection_delete_admins" on public.google_drive_connections for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
