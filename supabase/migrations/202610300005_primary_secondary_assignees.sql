alter table public.tasks
  add column primary_assignee_id uuid references auth.users(id) on delete set null,
  add column secondary_assignee_id uuid references auth.users(id) on delete set null,
  add constraint tasks_assignees_distinct check (
    primary_assignee_id is null or secondary_assignee_id is null or primary_assignee_id <> secondary_assignee_id
  );

with ranked as (
  select project_id, task_id, user_id,
    row_number() over (partition by project_id, task_id order by assigned_at, user_id) as position
  from public.task_assignees
)
update public.tasks t set primary_assignee_id = ranked.user_id
from ranked where ranked.project_id = t.project_id and ranked.task_id = t.id and ranked.position = 1;

with ranked as (
  select project_id, task_id, user_id,
    row_number() over (partition by project_id, task_id order by assigned_at, user_id) as position
  from public.task_assignees
)
update public.tasks t set secondary_assignee_id = ranked.user_id
from ranked where ranked.project_id = t.project_id and ranked.task_id = t.id and ranked.position = 2;

create index tasks_primary_assignee_idx on public.tasks(primary_assignee_id) where primary_assignee_id is not null;
create index tasks_secondary_assignee_idx on public.tasks(secondary_assignee_id) where secondary_assignee_id is not null;

create or replace function public.validate_task_assignees()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  task_organization uuid;
begin
  select w.organization_id into task_organization
  from public.projects p join public.workspaces w on w.id = p.workspace_id
  where p.id = new.project_id;

  if task_organization is null then raise exception 'Task project not found'; end if;
  if new.primary_assignee_id is not null and not exists (
    select 1 from public.organization_members om
    where om.organization_id = task_organization and om.user_id = new.primary_assignee_id and om.status = 'active'
  ) then raise exception 'Primary assignee must be an active organization member'; end if;
  if new.secondary_assignee_id is not null and not exists (
    select 1 from public.organization_members om
    where om.organization_id = task_organization and om.user_id = new.secondary_assignee_id and om.status = 'active'
  ) then raise exception 'Secondary assignee must be an active organization member'; end if;
  return new;
end;
$$;

create trigger tasks_validate_assignees
before insert or update of primary_assignee_id, secondary_assignee_id on public.tasks
for each row execute function public.validate_task_assignees();

revoke all on function public.set_task_assignees(uuid, uuid, uuid[]) from public;
revoke all on function public.set_task_assignees(uuid, uuid, uuid[]) from authenticated;
