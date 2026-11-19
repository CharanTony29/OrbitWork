-- 202611190002_attachment_rag_indexes.sql
-- Enables Full RAG (Retrieval-Augmented Generation) & Concept Search across
-- PPTX, DOCX, PDF, XLSX, and Orbitwork Documents.

create table if not exists public.attachment_rag_indexes (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.task_attachments(id) on delete cascade,
  project_id uuid not null,
  task_id uuid not null,
  file_name text not null,
  file_type text not null,
  extracted_text text not null,
  chunks jsonb not null default '[]'::jsonb,
  indexed_at timestamptz not null default now(),
  constraint attachment_rag_indexes_attachment_unique unique (attachment_id)
);

create index if not exists attachment_rag_indexes_project_idx on public.attachment_rag_indexes(project_id);
create index if not exists attachment_rag_indexes_task_idx on public.attachment_rag_indexes(task_id);

alter table public.attachment_rag_indexes enable row level security;

drop policy if exists "attachment_rag_read_permitted" on public.attachment_rag_indexes;
create policy "attachment_rag_read_permitted" on public.attachment_rag_indexes
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = attachment_rag_indexes.task_id and public.can_access_project(t.project_id)
    )
  );

drop policy if exists "attachment_rag_manage_permitted" on public.attachment_rag_indexes;
create policy "attachment_rag_manage_permitted" on public.attachment_rag_indexes
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = attachment_rag_indexes.task_id and public.can_edit_project_tasks(t.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = attachment_rag_indexes.task_id and public.can_edit_project_tasks(t.project_id)
    )
  );
