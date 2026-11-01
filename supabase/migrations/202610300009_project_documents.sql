create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body_markdown text not null default '' check (char_length(body_markdown) <= 500000),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_document_versions (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.project_documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  body_markdown text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_documents_project_updated_idx on public.project_documents(project_id, updated_at desc);
create index project_document_versions_doc_created_idx on public.project_document_versions(document_id, created_at desc);

create or replace function public.snapshot_project_document()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'Documents cannot be moved between projects by this operation';
  end if;
  new.created_by := old.created_by;
  if old.title is distinct from new.title or old.body_markdown is distinct from new.body_markdown then
    insert into public.project_document_versions(document_id, project_id, title, body_markdown, changed_by)
    values (old.id, old.project_id, old.title, old.body_markdown, old.updated_by);
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger project_documents_snapshot before update on public.project_documents for each row execute function public.snapshot_project_document();

alter table public.project_documents enable row level security;
alter table public.project_document_versions enable row level security;
create policy "project_documents_read_accessible" on public.project_documents for select to authenticated using (public.can_access_project(project_id));
create policy "project_documents_create_editors" on public.project_documents for insert to authenticated with check (created_by = (select auth.uid()) and updated_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));
create policy "project_documents_update_editors" on public.project_documents for update to authenticated using (public.can_edit_project_tasks(project_id)) with check (updated_by = (select auth.uid()) and public.can_edit_project_tasks(project_id));
create policy "project_documents_delete_managers" on public.project_documents for delete to authenticated using (public.can_manage_project(project_id));
create policy "project_document_versions_read_accessible" on public.project_document_versions for select to authenticated using (public.can_access_project(project_id));
