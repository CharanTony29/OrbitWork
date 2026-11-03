-- Migration: Allow Workspace Members to Edit Project Tasks and Upload Attachments
-- Previously, can_edit_project_tasks only allowed wm.role in ('admin', 'manager'), which blocked standard workspace members from creating/editing tasks and uploading attachments.

create or replace function public.can_edit_project_tasks(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    join public.workspaces w on w.id = p.workspace_id
    join public.organization_members om on om.organization_id = w.organization_id and om.user_id = (select auth.uid()) and om.status = 'active'
    left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = (select auth.uid()) and wm.status = 'active'
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = (select auth.uid())
    where p.id = target_project and (
      om.role in ('owner', 'admin') or 
      wm.role in ('admin', 'manager', 'member') or 
      pm.role in ('manager', 'member')
    )
  );
$$;

revoke all on function public.can_edit_project_tasks(uuid) from public;
grant execute on function public.can_edit_project_tasks(uuid) to authenticated;
