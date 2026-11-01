-- Allow task_due_reminder and task_mentioned in notifications table
alter table if exists public.notifications drop constraint if exists notifications_event_type_check;
alter table if exists public.notifications add constraint notifications_event_type_check
  check (event_type in ('task_assigned', 'task_reassigned', 'task_commented', 'task_status_changed', 'task_due_reminder', 'task_mentioned'));

-- Optional audit table for email delivery logs
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_id uuid references auth.users(id) on delete set null,
  subject text not null,
  email_type text not null check (email_type in ('task_assigned', 'task_due_reminder', 'task_mentioned', 'custom')),
  task_id uuid references public.tasks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  status text not null default 'sent',
  error_message text,
  sent_at timestamptz not null default now()
);

alter table if exists public.email_logs enable row level security;
create policy "email_logs_read_authenticated" on public.email_logs for select to authenticated using (true);
