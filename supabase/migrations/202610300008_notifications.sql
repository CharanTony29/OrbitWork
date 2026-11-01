create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  event_type text not null check (event_type in ('task_assigned', 'task_reassigned', 'task_commented', 'task_status_changed')),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_recipient_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
create policy "notifications_read_self" on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()) and public.can_access_project(project_id));

create or replace function public.notify_task_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  notify_user uuid;
  event_name text;
  event_message text;
begin
  if tg_op = 'INSERT' then
    event_name := 'task_assigned';
    event_message := 'You were assigned to task ' || new.generated_key || ': ' || new.title;
    for notify_user in select distinct user_id from unnest(array[new.primary_assignee_id, new.secondary_assignee_id]) as recipients(user_id) where user_id is not null and user_id <> new.created_by loop
      insert into public.notifications(recipient_id, actor_id, project_id, task_id, event_type, message) values (notify_user, new.created_by, new.project_id, new.id, event_name, event_message);
    end loop;
    return new;
  end if;

  if old.status_id is distinct from new.status_id then
    event_name := 'task_status_changed';
    event_message := 'Status changed for task ' || new.generated_key || ': ' || new.title;
    for notify_user in select distinct user_id from unnest(array[new.primary_assignee_id, new.secondary_assignee_id]) as recipients(user_id) where user_id is not null and user_id <> coalesce((select auth.uid()), new.created_by) loop
      insert into public.notifications(recipient_id, actor_id, project_id, task_id, event_type, message) values (notify_user, auth.uid(), new.project_id, new.id, event_name, event_message);
    end loop;
  end if;
  if old.primary_assignee_id is distinct from new.primary_assignee_id or old.secondary_assignee_id is distinct from new.secondary_assignee_id then
    event_name := 'task_reassigned';
    event_message := 'You were assigned to task ' || new.generated_key || ': ' || new.title;
    for notify_user in select distinct user_id from unnest(array[new.primary_assignee_id, new.secondary_assignee_id]) as recipients(user_id) where user_id is not null and user_id <> coalesce((select auth.uid()), new.created_by) loop
      insert into public.notifications(recipient_id, actor_id, project_id, task_id, event_type, message) values (notify_user, auth.uid(), new.project_id, new.id, event_name, event_message);
    end loop;
  end if;
  return new;
end;
$$;

create trigger tasks_notify_insert after insert on public.tasks for each row execute function public.notify_task_event();
create trigger tasks_notify_update after update of status_id, primary_assignee_id, secondary_assignee_id on public.tasks for each row execute function public.notify_task_event();

create or replace function public.notify_task_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  task_key text;
  task_title text;
  assignee uuid;
begin
  select generated_key, title into task_key, task_title from public.tasks where id = new.task_id and project_id = new.project_id;
  for assignee in select distinct user_id from unnest(array[(select primary_assignee_id from public.tasks where id = new.task_id), (select secondary_assignee_id from public.tasks where id = new.task_id)]) as recipients(user_id) where user_id is not null and user_id <> new.author_id loop
    insert into public.notifications(recipient_id, actor_id, project_id, task_id, event_type, message)
    values (assignee, new.author_id, new.project_id, new.task_id, 'task_commented', 'New comment on task ' || task_key || ': ' || task_title);
  end loop;
  return new;
end;
$$;
create trigger task_comments_notify after insert on public.task_comments for each row execute function public.notify_task_comment();

create or replace function public.mark_my_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where recipient_id = (select auth.uid()) and read_at is null;
$$;
revoke all on function public.mark_my_notifications_read() from public;
grant execute on function public.mark_my_notifications_read() to authenticated;
