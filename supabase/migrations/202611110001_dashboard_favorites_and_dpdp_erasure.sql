-- 202611110001_dashboard_favorites_and_dpdp_erasure.sql
-- 1. User favorites table (star documents, projects, tasks for quick dashboard access)
-- 2. Complete user data erasure helper (India DPDP Act right to erasure compliance)

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('document', 'project', 'task')),
  entity_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default '',
  subtitle text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

create index if not exists user_favorites_user_idx on public.user_favorites (user_id, created_at desc);

alter table public.user_favorites enable row level security;

drop policy if exists "user_favorites_own_all" on public.user_favorites;
create policy "user_favorites_own_all" on public.user_favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.erase_user_account_data(
  target_user_id uuid,
  target_email text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_rec record;
  successor_id uuid;
  clean_email text := lower(trim(coalesce(target_email, '')));
begin
  -- Authorization check: allow service_role or the user erasing their own account
  if auth.role() <> 'service_role' and (select auth.uid()) is distinct from target_user_id then
    raise exception 'Unauthorized account erasure attempt';
  end if;

  -- 1. Erase strictly personal communications, notifications, logs, favorites, time & leave records
  delete from public.user_favorites where user_id = target_user_id;
  delete from public.workspace_chat_messages where sender_id = target_user_id or recipient_id = target_user_id;
  delete from public.notifications where recipient_id = target_user_id;
  update public.notifications set actor_id = null where actor_id = target_user_id;

  delete from public.email_logs
  where recipient_id = target_user_id
     or (clean_email <> '' and lower(recipient_email) = clean_email);

  delete from public.leave_requests where user_id = target_user_id;
  update public.leave_requests set reviewed_by = null where reviewed_by = target_user_id;

  delete from public.timesheets where user_id = target_user_id;
  update public.timesheets set reviewed_by = null where reviewed_by = target_user_id;

  delete from public.time_entries where user_id = target_user_id;
  delete from public.task_comments where author_id = target_user_id;
  delete from public.task_assignees where user_id = target_user_id;

  update public.tasks set primary_assignee_id = null where primary_assignee_id = target_user_id;
  update public.tasks set secondary_assignee_id = null where secondary_assignee_id = target_user_id;
  update public.checklist_items set completed_by = null where completed_by = target_user_id;

  delete from public.invitations
  where (clean_email <> '' and lower(email) = clean_email);

  -- 2. For every organization where target_user_id created records or belongs:
  -- either delete sole-user orgs completely or reassign ownership/creator attribution to another active member
  for org_rec in
    select distinct o.id
    from public.organizations o
    left join public.organization_members om on om.organization_id = o.id
    where o.created_by = target_user_id or om.user_id = target_user_id
  loop
    select om.user_id into successor_id
    from public.organization_members om
    where om.organization_id = org_rec.id
      and om.user_id <> target_user_id
      and om.status = 'active'
    order by
      case om.role
        when 'owner' then 1
        when 'admin' then 2
        when 'manager' then 3
        when 'member' then 4
        else 5
      end,
      om.joined_at asc
    limit 1;

    if successor_id is null then
      -- Sole-user organization: erase all restrict-bound children first, then delete org
      delete from public.task_comments where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.task_attachments where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.task_dependencies where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.checklist_items where checklist_id in (
        select tc.id from public.task_checklists tc join public.projects p on p.id = tc.project_id join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.task_checklists where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.task_custom_field_values where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.custom_field_definitions where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.task_assignees where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.project_document_versions where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.project_documents where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.tasks where project_id in (
        select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      );
      delete from public.projects where workspace_id in (
        select w.id from public.workspaces w where w.organization_id = org_rec.id
      );
      delete from public.workspaces where organization_id = org_rec.id;
      delete from public.organization_holidays where organization_id = org_rec.id;
      delete from public.google_drive_connections where organization_id = org_rec.id;
      delete from public.invitations where organization_id = org_rec.id;
      delete from public.organization_roles where organization_id = org_rec.id;
      delete from public.organizations where id = org_rec.id;
    else
      -- Shared organization: transfer structural creator FKs inside this org to surviving admin/member
      update public.organizations set created_by = successor_id where id = org_rec.id and created_by = target_user_id;
      update public.organization_roles set created_by = successor_id where organization_id = org_rec.id and created_by = target_user_id;
      update public.workspaces set created_by = successor_id where organization_id = org_rec.id and created_by = target_user_id;
      update public.invitations set invited_by = successor_id where organization_id = org_rec.id and invited_by = target_user_id;
      update public.organization_holidays set created_by = successor_id where organization_id = org_rec.id and created_by = target_user_id;
      update public.google_drive_connections set connected_by = successor_id where organization_id = org_rec.id and connected_by = target_user_id;

      update public.projects set created_by = successor_id
      where workspace_id in (select id from public.workspaces where organization_id = org_rec.id)
        and created_by = target_user_id;

      update public.tasks set created_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and created_by = target_user_id;

      update public.task_assignees set assigned_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and assigned_by = target_user_id;

      update public.custom_field_definitions set created_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and created_by = target_user_id;

      update public.task_custom_field_values set updated_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and updated_by = target_user_id;

      update public.task_dependencies set created_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and created_by = target_user_id;

      update public.task_checklists set created_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and created_by = target_user_id;

      update public.checklist_items set created_by = successor_id
      where checklist_id in (
        select tc.id from public.task_checklists tc join public.projects p on p.id = tc.project_id join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id
      ) and created_by = target_user_id;

      update public.task_attachments set uploaded_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and uploaded_by = target_user_id;

      update public.project_documents set created_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and created_by = target_user_id;

      update public.project_documents set updated_by = successor_id
      where project_id in (select p.id from public.projects p join public.workspaces w on w.id = p.workspace_id where w.organization_id = org_rec.id)
        and updated_by = target_user_id;
    end if;
  end loop;

  -- 3. Remove remaining memberships & anonymize audit/activity trails
  delete from public.project_members where user_id = target_user_id;
  delete from public.workspace_members where user_id = target_user_id;
  delete from public.organization_members where user_id = target_user_id;

  update public.project_document_versions set changed_by = null where changed_by = target_user_id;
  update public.project_activity_events set actor_id = null where actor_id = target_user_id;
  update public.audit_events set actor_id = null, changes = '{}'::jsonb where actor_id = target_user_id;

  -- 4. Erase profile record completely
  delete from public.profiles where id = target_user_id;
end;
$$;

revoke all on function public.erase_user_account_data(uuid, text) from public;
grant execute on function public.erase_user_account_data(uuid, text) to service_role;
