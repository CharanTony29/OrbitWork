alter table public.profiles add column if not exists email text not null default '';

update public.profiles p
set email = coalesce(u.email, ''),
    display_name = coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Team member'
    )
from auth.users u
where p.id = u.id;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Team member'
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.set_task_assignees(
  target_project uuid,
  target_task uuid,
  assignee_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  target_organization uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if not public.can_edit_project_tasks(target_project) then raise exception 'Task edit permission required'; end if;
  if not exists (select 1 from public.tasks t where t.id = target_task and t.project_id = target_project) then
    raise exception 'Task not found in project';
  end if;
  select w.organization_id into target_organization
  from public.projects p join public.workspaces w on w.id = p.workspace_id
  where p.id = target_project;
  if coalesce(array_length(assignee_ids, 1), 0) > 50 then raise exception 'Too many assignees'; end if;
  if exists (
    select 1 from unnest(coalesce(assignee_ids, array[]::uuid[])) as requested(user_id)
    where not exists (
      select 1 from public.organization_members om
      where om.organization_id = target_organization and om.user_id = requested.user_id and om.status = 'active'
    )
  ) then raise exception 'Assignees must be active organization members'; end if;

  delete from public.task_assignees where project_id = target_project and task_id = target_task;
  insert into public.task_assignees (project_id, task_id, user_id, assigned_by)
  select target_project, target_task, requested.user_id, actor_id
  from (select distinct user_id from unnest(coalesce(assignee_ids, array[]::uuid[])) as ids(user_id)) requested;
end;
$$;

revoke all on function public.set_task_assignees(uuid, uuid, uuid[]) from public;
grant execute on function public.set_task_assignees(uuid, uuid, uuid[]) to authenticated;
