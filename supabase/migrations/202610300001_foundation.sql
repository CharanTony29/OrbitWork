create extension if not exists pgcrypto with schema extensions;

create type public.organization_role as enum ('owner', 'admin', 'manager', 'member', 'viewer');
create type public.membership_status as enum ('active', 'inactive');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  department text,
  designation text,
  contact_information text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '',
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  is_system boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  custom_role_id uuid,
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  foreign key (organization_id, custom_role_id) references public.organization_roles(organization_id, id) on delete set null (custom_role_id),
  check (role <> 'owner' or custom_role_id is null)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  icon text,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid,
  email text not null check (char_length(email) <= 254),
  role public.organization_role not null default 'member' check (role <> 'owner'),
  status public.invitation_status not null default 'pending',
  token_hash text unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  foreign key (organization_id, workspace_id) references public.workspaces(organization_id, id) on delete cascade
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id text not null,
  action text not null check (char_length(action) between 1 and 80),
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id, status);
create index workspaces_organization_idx on public.workspaces(organization_id, created_at desc);
create index workspace_members_user_idx on public.workspace_members(user_id, status);
create index invitations_pending_idx on public.invitations(organization_id, status, expires_at);
create index audit_events_organization_created_idx on public.audit_events(organization_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_active_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.organization_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = any(allowed_roles)
  );
$$;

create or replace function public.can_access_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspaces w
    join public.organization_members om on om.organization_id = w.organization_id
    left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = (select auth.uid())
    where w.id = target_workspace and om.user_id = (select auth.uid()) and om.status = 'active'
      and (om.role in ('owner', 'admin') or (wm.user_id is not null and wm.status = 'active'))
  );
$$;

create or replace function public.create_organization(organization_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid := gen_random_uuid();
  base_slug text;
  candidate_slug text;
  suffix integer := 0;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(organization_name)) < 2 or char_length(trim(organization_name)) > 100 then
    raise exception 'Organization name must be between 2 and 100 characters';
  end if;
  base_slug := trim(both '-' from regexp_replace(lower(trim(organization_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'organization'; end if;
  candidate_slug := base_slug;
  while exists (select 1 from public.organizations o where o.slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  end loop;
  insert into public.organizations (id, name, slug, created_by)
  values (new_id, trim(organization_name), candidate_slug, current_user_id);
  insert into public.organization_members (organization_id, user_id, role)
  values (new_id, current_user_id, 'owner');
  insert into public.audit_events (organization_id, actor_id, entity_type, entity_id, action)
  values (new_id, current_user_id, 'organization', new_id::text, 'created');
  return new_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_roles enable row level security;
alter table public.organization_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_read_self_or_colleagues" on public.profiles for select to authenticated
using (id = (select auth.uid()) or exists (
  select 1 from public.organization_members mine
  join public.organization_members theirs on theirs.organization_id = mine.organization_id
  where mine.user_id = (select auth.uid()) and mine.status = 'active'
    and theirs.user_id = profiles.id and theirs.status = 'active'
));
create policy "profiles_update_self" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "organizations_read_members" on public.organizations for select to authenticated
using (public.is_active_org_member(id));
create policy "organizations_update_admins" on public.organizations for update to authenticated
using (public.has_org_role(id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(id, array['owner','admin']::public.organization_role[]));
create policy "organizations_delete_owner" on public.organizations for delete to authenticated
using (public.has_org_role(id, array['owner']::public.organization_role[]));

create policy "org_members_read_org" on public.organization_members for select to authenticated
using (public.is_active_org_member(organization_id));
create policy "org_members_add_admins" on public.organization_members for insert to authenticated
with check (role <> 'owner' and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "org_members_update_admins" on public.organization_members for update to authenticated
using (role <> 'owner' and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (role <> 'owner' and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "org_members_remove_admins_or_self" on public.organization_members for delete to authenticated
using (role <> 'owner' and (user_id = (select auth.uid()) or public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));

create policy "org_roles_read_members" on public.organization_roles for select to authenticated
using (public.is_active_org_member(organization_id));
create policy "org_roles_manage_admins" on public.organization_roles for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy "workspaces_read_permitted" on public.workspaces for select to authenticated
using (public.can_access_workspace(id));
create policy "workspaces_create_admins" on public.workspaces for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "workspaces_update_admins" on public.workspaces for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "workspaces_delete_admins" on public.workspaces for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy "workspace_members_read_permitted" on public.workspace_members for select to authenticated
using (public.can_access_workspace(workspace_id));
create policy "workspace_members_manage_admins" on public.workspace_members for all to authenticated
using (exists (select 1 from public.workspaces w where w.id = workspace_id and public.has_org_role(w.organization_id, array['owner','admin']::public.organization_role[])))
with check (exists (select 1 from public.workspaces w where w.id = workspace_id and public.has_org_role(w.organization_id, array['owner','admin']::public.organization_role[])));

create policy "invitations_read_admins" on public.invitations for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy "invitations_create_admins" on public.invitations for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]) and invited_by = (select auth.uid()));
create policy "invitations_update_admins" on public.invitations for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy "audit_events_read_members" on public.audit_events for select to authenticated
using (public.is_active_org_member(organization_id));
revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;
revoke all on function public.is_active_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
revoke all on function public.can_access_workspace(uuid) from public;
grant execute on function public.is_active_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;
grant execute on function public.can_access_workspace(uuid) to authenticated;
