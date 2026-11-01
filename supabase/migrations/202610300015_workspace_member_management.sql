alter policy "workspace_members_manage_admins"
on public.workspace_members
using (public.can_manage_workspace(workspace_id))
with check (
  public.can_manage_workspace(workspace_id)
  and exists (
    select 1
    from public.organization_members om
    join public.workspaces w on w.organization_id = om.organization_id
    where w.id = workspace_members.workspace_id
      and om.user_id = workspace_members.user_id
      and om.status = 'active'
  )
);
