-- Allow any role except 'viewer' to edit tasks, documents, and whiteboards
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
      -- Any role except viewer can edit project tasks, documents, and whiteboards
      coalesce(pm.role, wm.role, om.role) != 'viewer'
    )
  );
$$;

revoke all on function public.can_edit_project_tasks(uuid) from public;
grant execute on function public.can_edit_project_tasks(uuid) to authenticated;

-- Ensure project_documents allows any non-viewer to create and update
drop policy if exists "project_documents_create_editors" on public.project_documents;
create policy "project_documents_create_editors" on public.project_documents for insert to authenticated with check (
  created_by = (select auth.uid()) and updated_by = (select auth.uid()) and public.can_edit_project_tasks(project_id)
);

drop policy if exists "project_documents_update_editors" on public.project_documents;
create policy "project_documents_update_editors" on public.project_documents for update to authenticated using (
  public.can_edit_project_tasks(project_id)
) with check (
  updated_by = (select auth.uid()) and public.can_edit_project_tasks(project_id)
);
