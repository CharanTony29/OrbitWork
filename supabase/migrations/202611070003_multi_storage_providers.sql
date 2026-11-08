-- 202611070003_multi_storage_providers.sql
-- Enables Built-in direct storage, SharePoint, OneDrive, and External Cloud Links.
-- Users are never blocked from uploading files even if Google Drive is not connected.

-- 1. Update task_attachments check constraint to support multiple storage providers
alter table public.task_attachments drop constraint if exists task_attachments_storage_provider_check;

alter table public.task_attachments add constraint task_attachments_storage_provider_check
  check (storage_provider in ('google_drive', 'built_in', 'sharepoint', 'onedrive', 'external_link'));

-- 2. Create attachment_files table for built-in direct storage
create table if not exists public.attachment_files (
  id uuid primary key references public.task_attachments(id) on delete cascade,
  file_bytes bytea not null,
  created_at timestamptz not null default now()
);

alter table public.attachment_files enable row level security;

drop policy if exists "attachment_files_read_permitted" on public.attachment_files;
create policy "attachment_files_read_permitted" on public.attachment_files
  for select to authenticated
  using (
    exists (
      select 1 from public.task_attachments ta
      where ta.id = attachment_files.id and public.can_access_project(ta.project_id)
    )
  );

drop policy if exists "attachment_files_insert_editors" on public.attachment_files;
create policy "attachment_files_insert_editors" on public.attachment_files
  for insert to authenticated
  with check (
    exists (
      select 1 from public.task_attachments ta
      where ta.id = attachment_files.id and public.can_edit_project_tasks(ta.project_id)
    )
  );

drop policy if exists "attachment_files_delete_editors" on public.attachment_files;
create policy "attachment_files_delete_editors" on public.attachment_files
  for delete to authenticated
  using (
    exists (
      select 1 from public.task_attachments ta
      where ta.id = attachment_files.id and (ta.uploaded_by = (select auth.uid()) or public.can_manage_project(ta.project_id))
    )
  );
