alter table public.tasks
  add column if not exists task_type text not null default 'task';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_task_type_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_task_type_check
      check (task_type in (
        'task',
        'improvement',
        'enhancement',
        'bug',
        'defect',
        'error',
        'issue',
        'milestone',
        'epic',
        'story',
        'subtask',
        'support_request',
        'research'
      ));
  end if;
end $$;
