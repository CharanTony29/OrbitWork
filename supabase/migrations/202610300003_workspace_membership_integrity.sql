alter table public.workspace_members add column if not exists organization_id uuid;

update public.workspace_members wm
set organization_id = w.organization_id
from public.workspaces w
where wm.workspace_id = w.id and wm.organization_id is null;

alter table public.workspace_members alter column organization_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspace_members_org_workspace_fkey') then
    alter table public.workspace_members
      add constraint workspace_members_org_workspace_fkey
      foreign key (organization_id, workspace_id)
      references public.workspaces(organization_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspace_members_org_member_fkey') then
    alter table public.workspace_members
      add constraint workspace_members_org_member_fkey
      foreign key (organization_id, user_id)
      references public.organization_members(organization_id, user_id) on delete cascade;
  end if;
end;
$$;
