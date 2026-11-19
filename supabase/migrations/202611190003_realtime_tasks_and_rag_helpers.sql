-- 202611190003_realtime_tasks_and_rag_helpers.sql
-- 1. Adds tasks, task_assignees, and project_statuses to Supabase Realtime publication
--    for Groww-style continuous live auto-updating.
-- 2. Creates SECURITY DEFINER helpers for RAG attachment text extraction and indexing.

-- Realtime Publication for Tasks and Statuses
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
    ) then
      alter publication supabase_realtime add table public.tasks;
    end if;

    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_assignees'
    ) then
      alter publication supabase_realtime add table public.task_assignees;
    end if;

    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_statuses'
    ) then
      alter publication supabase_realtime add table public.project_statuses;
    end if;
  end if;
end $$;

-- RAG Security Definer Helper: Read attachment bytes safely
create or replace function public.get_attachment_raw_bytes(p_id uuid)
returns text
language sql
security definer
as $$
  select encode(file_bytes, 'hex') from public.attachment_files where id = p_id;
$$;
grant execute on function public.get_attachment_raw_bytes(uuid) to anon, authenticated;

-- RAG Security Definer Helper: Save parsed chunks safely to attachment_rag_indexes
create or replace function public.save_attachment_rag_index(
  p_attachment_id uuid,
  p_project_id uuid,
  p_task_id uuid,
  p_file_name text,
  p_file_type text,
  p_extracted_text text,
  p_chunks jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.attachment_rag_indexes (
    attachment_id,
    project_id,
    task_id,
    file_name,
    file_type,
    extracted_text,
    chunks,
    indexed_at
  )
  values (
    p_attachment_id,
    p_project_id,
    p_task_id,
    p_file_name,
    p_file_type,
    p_extracted_text,
    p_chunks,
    now()
  )
  on conflict (attachment_id) do update set
    project_id = excluded.project_id,
    task_id = excluded.task_id,
    file_name = excluded.file_name,
    file_type = excluded.file_type,
    extracted_text = excluded.extracted_text,
    chunks = excluded.chunks,
    indexed_at = now()
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.save_attachment_rag_index(uuid, uuid, uuid, text, text, text, jsonb) to anon, authenticated;
