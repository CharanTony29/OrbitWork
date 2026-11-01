create table public.project_activity_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 80),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index project_activity_task_idx on public.project_activity_events(project_id, task_id, created_at desc);
alter table public.project_activity_events enable row level security;
create policy "project_activity_read_accessible" on public.project_activity_events for select to authenticated
using (public.can_access_project(project_id));

create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details)
    values (new.project_id, new.id, new.created_by, 'task_created', jsonb_build_object('title', new.title));
    return new;
  end if;
  if old.title is distinct from new.title then
    insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details) values (new.project_id, new.id, (select auth.uid()), 'title_changed', jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if old.status_id is distinct from new.status_id then
    insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details) values (new.project_id, new.id, (select auth.uid()), 'status_changed', jsonb_build_object('from', old.status_id, 'to', new.status_id));
  end if;
  if old.priority is distinct from new.priority then
    insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details) values (new.project_id, new.id, (select auth.uid()), 'priority_changed', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if old.start_date is distinct from new.start_date or old.due_date is distinct from new.due_date then
    insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details) values (new.project_id, new.id, (select auth.uid()), 'schedule_changed', jsonb_build_object('start_from', old.start_date, 'start_to', new.start_date, 'due_from', old.due_date, 'due_to', new.due_date));
  end if;
  if old.primary_assignee_id is distinct from new.primary_assignee_id or old.secondary_assignee_id is distinct from new.secondary_assignee_id then
    insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details) values (new.project_id, new.id, (select auth.uid()), 'assignees_changed', jsonb_build_object('primary_from', old.primary_assignee_id, 'primary_to', new.primary_assignee_id, 'secondary_from', old.secondary_assignee_id, 'secondary_to', new.secondary_assignee_id));
  end if;
  if old.description is distinct from new.description then
    insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details) values (new.project_id, new.id, (select auth.uid()), 'description_changed', '{}'::jsonb);
  end if;
  return new;
end;
$$;
create trigger tasks_log_insert after insert on public.tasks for each row execute function public.log_task_activity();
create trigger tasks_log_update after update of title, status_id, priority, start_date, due_date, primary_assignee_id, secondary_assignee_id, description on public.tasks for each row execute function public.log_task_activity();

create or replace function public.log_comment_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_activity_events(project_id, task_id, actor_id, event_type, details)
  values (new.project_id, new.task_id, new.author_id, 'comment_added', '{}'::jsonb);
  return new;
end;
$$;
create trigger task_comments_log_activity after insert on public.task_comments for each row execute function public.log_comment_activity();

create or replace function public.get_project_report_metrics(target_project uuid)
returns table(status_id uuid, status_name text, status_color text, task_count bigint, completed_count bigint, overdue_count bigint, estimated_minutes bigint, actual_minutes bigint)
language sql stable security invoker set search_path = '' as $$
  select s.id, s.name, s.color,
    count(t.id),
    count(t.id) filter (where s.category = 'completed'),
    count(t.id) filter (where t.due_date < current_date and s.category not in ('completed','cancelled')),
    coalesce(sum(t.estimate_minutes), 0)::bigint,
    coalesce(sum(coalesce(actual.minutes, 0)), 0)::bigint
  from public.project_statuses s
  left join public.tasks t on t.project_id = s.project_id and t.status_id = s.id
  left join lateral (
    select sum(te.duration_minutes)::bigint as minutes from public.time_entries te
    where te.project_id = s.project_id and te.task_id = t.id and te.ended_at is not null
  ) actual on true
  where s.project_id = target_project and public.can_access_project(target_project)
  group by s.id, s.name, s.color, s.position, s.category
  order by s.position;
$$;
revoke all on function public.get_project_report_metrics(uuid) from public;
grant execute on function public.get_project_report_metrics(uuid) to authenticated;
