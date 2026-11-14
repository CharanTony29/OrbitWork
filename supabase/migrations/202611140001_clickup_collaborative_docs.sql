-- 202611140001_clickup_collaborative_docs.sql
-- ClickUp-style collaborative documentation platform migration

-- 1. Main docs table (ClickUp Docs model: container for pages, wiki settings, publishing, workspace/project scope)
create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Untitled Document',
  icon text not null default '📄',
  cover_url text,
  description text not null default '',
  is_wiki boolean not null default false,
  is_protected boolean not null default false,
  is_private boolean not null default false,
  is_archived boolean not null default false,
  is_template boolean not null default false,
  template_category text,
  is_published boolean not null default false,
  public_slug text unique,
  published_at timestamptz,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Nested pages table (Arbitrary hierarchy, position, block JSON & markdown)
create table if not exists public.doc_pages (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  parent_page_id uuid references public.doc_pages(id) on delete cascade,
  title text not null default 'Untitled Page',
  icon text not null default '📄',
  cover_url text,
  position float8 not null default 1000.0,
  content_json jsonb not null default '[]'::jsonb,
  content_markdown text not null default '',
  page_type text not null default 'standard' check (page_type in ('standard', 'wiki', 'landing', 'documentation')),
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Version history snapshots
create table if not exists public.doc_page_versions (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.doc_pages(id) on delete cascade,
  doc_id uuid not null references public.docs(id) on delete cascade,
  title text not null,
  content_json jsonb not null default '[]'::jsonb,
  content_markdown text not null default '',
  version_number int not null default 1,
  changed_by uuid references auth.users(id) on delete set null,
  change_summary text not null default '',
  created_at timestamptz not null default now()
);

-- 4. Inline & page comments
create table if not exists public.doc_comments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  page_id uuid not null references public.doc_pages(id) on delete cascade,
  parent_comment_id uuid references public.doc_comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  selected_text text,
  block_id text,
  is_resolved boolean not null default false,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Document-level sharing & granular permissions
create table if not exists public.doc_members (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'commenter', 'viewer')),
  created_at timestamptz not null default now(),
  unique(doc_id, user_id)
);

-- 6. Document activity timeline
create table if not exists public.doc_activities (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  page_id uuid references public.doc_pages(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 7. Document linked tasks
create table if not exists public.doc_linked_tasks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  page_id uuid references public.doc_pages(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(page_id, task_id)
);

-- 8. Performance Indexes
create index if not exists docs_workspace_idx on public.docs (workspace_id, updated_at desc);
create index if not exists docs_project_idx on public.docs (project_id, updated_at desc);
create index if not exists docs_created_by_idx on public.docs (created_by);
create index if not exists docs_public_slug_idx on public.docs (public_slug);
create index if not exists doc_pages_doc_parent_idx on public.doc_pages (doc_id, parent_page_id, position);
create index if not exists doc_pages_updated_idx on public.doc_pages (updated_at desc);
create index if not exists doc_comments_page_idx on public.doc_comments (page_id, created_at asc);
create index if not exists doc_versions_page_idx on public.doc_page_versions (page_id, version_number desc);
create index if not exists doc_activities_doc_idx on public.doc_activities (doc_id, created_at desc);

-- 9. Security Definer Helper Functions
create or replace function public.can_access_doc(target_doc uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_workspace_id uuid;
  v_project_id uuid;
  v_created_by uuid;
  v_is_private boolean;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return false;
  end if;

  select workspace_id, project_id, created_by, is_private
    into v_workspace_id, v_project_id, v_created_by, v_is_private
  from public.docs where id = target_doc;

  if v_workspace_id is null then
    return false;
  end if;

  if v_created_by = v_uid then
    return true;
  end if;

  if exists (select 1 from public.doc_members where doc_id = target_doc and user_id = v_uid) then
    return true;
  end if;

  if not v_is_private and (
    public.can_access_workspace(v_workspace_id)
    or (v_project_id is not null and public.can_edit_project_tasks(v_project_id))
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_edit_doc(target_doc uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_workspace_id uuid;
  v_project_id uuid;
  v_created_by uuid;
  v_is_private boolean;
  v_is_protected boolean;
  v_uid uuid := (select auth.uid());
  v_member_role text;
begin
  if v_uid is null then
    return false;
  end if;

  select workspace_id, project_id, created_by, is_private, is_protected
    into v_workspace_id, v_project_id, v_created_by, v_is_private, v_is_protected
  from public.docs where id = target_doc;

  if v_workspace_id is null then
    return false;
  end if;

  if v_created_by = v_uid then
    return true;
  end if;

  select role into v_member_role from public.doc_members where doc_id = target_doc and user_id = v_uid;
  if v_member_role in ('owner', 'editor') then
    return true;
  end if;

  if v_is_protected or v_is_private then
    if public.can_manage_workspace(v_workspace_id) then
      return true;
    end if;
    return false;
  end if;

  return (
    public.can_access_workspace(v_workspace_id)
    or (v_project_id is not null and public.can_edit_project_tasks(v_project_id))
  );
end;
$$;

-- 10. Enable RLS
alter table public.docs enable row level security;
alter table public.doc_pages enable row level security;
alter table public.doc_page_versions enable row level security;
alter table public.doc_comments enable row level security;
alter table public.doc_members enable row level security;
alter table public.doc_activities enable row level security;
alter table public.doc_linked_tasks enable row level security;

-- Policies on docs
drop policy if exists "docs_select" on public.docs;
create policy "docs_select" on public.docs for select to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.doc_members dm
    where dm.doc_id = docs.id and dm.user_id = (select auth.uid())
  )
  or (
    not is_private and (
      public.can_access_workspace(workspace_id)
      or (project_id is not null and public.can_edit_project_tasks(project_id))
    )
  )
);

drop policy if exists "docs_insert" on public.docs;
create policy "docs_insert" on public.docs for insert to authenticated
with check (
  (created_by = (select auth.uid()) or created_by is null)
  and (
    public.can_access_workspace(workspace_id)
    or (project_id is not null and public.can_edit_project_tasks(project_id))
  )
);

drop policy if exists "docs_update" on public.docs;
create policy "docs_update" on public.docs for update to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.doc_members dm
    where dm.doc_id = docs.id and dm.user_id = (select auth.uid()) and dm.role in ('owner', 'editor')
  )
  or (
    not is_protected and not is_private and (
      public.can_access_workspace(workspace_id)
      or (project_id is not null and public.can_edit_project_tasks(project_id))
    )
  )
  or public.can_manage_workspace(workspace_id)
)
with check (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.doc_members dm
    where dm.doc_id = docs.id and dm.user_id = (select auth.uid()) and dm.role in ('owner', 'editor')
  )
  or (
    not is_protected and not is_private and (
      public.can_access_workspace(workspace_id)
      or (project_id is not null and public.can_edit_project_tasks(project_id))
    )
  )
  or public.can_manage_workspace(workspace_id)
);

drop policy if exists "docs_delete" on public.docs;
create policy "docs_delete" on public.docs for delete to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.doc_members dm
    where dm.doc_id = docs.id and dm.user_id = (select auth.uid()) and dm.role = 'owner'
  )
  or public.can_manage_workspace(workspace_id)
);

-- Policies on doc_pages
drop policy if exists "doc_pages_select" on public.doc_pages;
create policy "doc_pages_select" on public.doc_pages for select to authenticated
using (public.can_access_doc(doc_id));

drop policy if exists "doc_pages_insert" on public.doc_pages;
create policy "doc_pages_insert" on public.doc_pages for insert to authenticated
with check (public.can_edit_doc(doc_id));

drop policy if exists "doc_pages_update" on public.doc_pages;
create policy "doc_pages_update" on public.doc_pages for update to authenticated
using (public.can_edit_doc(doc_id))
with check (public.can_edit_doc(doc_id));

drop policy if exists "doc_pages_delete" on public.doc_pages;
create policy "doc_pages_delete" on public.doc_pages for delete to authenticated
using (public.can_edit_doc(doc_id));

-- Policies on doc_page_versions
drop policy if exists "doc_versions_select" on public.doc_page_versions;
create policy "doc_versions_select" on public.doc_page_versions for select to authenticated
using (public.can_access_doc(doc_id));

drop policy if exists "doc_versions_insert" on public.doc_page_versions;
create policy "doc_versions_insert" on public.doc_page_versions for insert to authenticated
with check (public.can_edit_doc(doc_id));

-- Policies on doc_comments
drop policy if exists "doc_comments_select" on public.doc_comments;
create policy "doc_comments_select" on public.doc_comments for select to authenticated
using (public.can_access_doc(doc_id));

drop policy if exists "doc_comments_insert" on public.doc_comments;
create policy "doc_comments_insert" on public.doc_comments for insert to authenticated
with check (public.can_access_doc(doc_id));

drop policy if exists "doc_comments_update" on public.doc_comments;
create policy "doc_comments_update" on public.doc_comments for update to authenticated
using (author_id = (select auth.uid()) or public.can_edit_doc(doc_id));

drop policy if exists "doc_comments_delete" on public.doc_comments;
create policy "doc_comments_delete" on public.doc_comments for delete to authenticated
using (author_id = (select auth.uid()) or public.can_edit_doc(doc_id));

-- Policies on doc_members
drop policy if exists "doc_members_select" on public.doc_members;
create policy "doc_members_select" on public.doc_members for select to authenticated
using (public.can_access_doc(doc_id));

drop policy if exists "doc_members_modify" on public.doc_members;
create policy "doc_members_modify" on public.doc_members for all to authenticated
using (public.can_edit_doc(doc_id));

-- Policies on doc_activities
drop policy if exists "doc_activities_select" on public.doc_activities;
create policy "doc_activities_select" on public.doc_activities for select to authenticated
using (public.can_access_doc(doc_id));

drop policy if exists "doc_activities_insert" on public.doc_activities;
create policy "doc_activities_insert" on public.doc_activities for insert to authenticated
with check (public.can_access_doc(doc_id));

-- Policies on doc_linked_tasks
drop policy if exists "doc_linked_tasks_select" on public.doc_linked_tasks;
create policy "doc_linked_tasks_select" on public.doc_linked_tasks for select to authenticated
using (public.can_access_doc(doc_id));

drop policy if exists "doc_linked_tasks_modify" on public.doc_linked_tasks;
create policy "doc_linked_tasks_modify" on public.doc_linked_tasks for all to authenticated
using (public.can_edit_doc(doc_id));

-- 11. Legacy synchronization trigger
create or replace function public.sync_doc_page_to_legacy_project_document()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id from public.docs where id = new.doc_id;
  if v_project_id is not null then
    if new.parent_page_id is null or new.id = new.doc_id then
      update public.project_documents
      set title = new.title,
          body_markdown = new.content_markdown,
          updated_by = coalesce(new.updated_by, updated_by),
          updated_at = new.updated_at
      where id = new.doc_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_doc_page_to_legacy_trigger on public.doc_pages;
create trigger sync_doc_page_to_legacy_trigger
after insert or update on public.doc_pages
for each row execute function public.sync_doc_page_to_legacy_project_document();
