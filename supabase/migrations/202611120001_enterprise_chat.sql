-- 202611120001_enterprise_chat.sql
-- Persistent enterprise chat: org-scoped channels, custom group chats, reactions,
-- read receipts, binary image/file attachments, presence timestamps, and realtime.

-- 1. Ensure base table exists even if 202610300021 was skipped
create table if not exists public.workspace_chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  channel text not null default 'general',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists workspace_chat_channel_idx
  on public.workspace_chat_messages (workspace_id, channel, created_at desc);
create index if not exists workspace_chat_direct_idx
  on public.workspace_chat_messages (sender_id, recipient_id, created_at desc);

-- 2. Presence timestamp on profiles
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- 3. Custom Group Chats & Membership
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists chat_thread_members_user_idx
  on public.chat_thread_members (user_id, thread_id);

drop trigger if exists chat_threads_updated_at on public.chat_threads;
create trigger chat_threads_updated_at
  before update on public.chat_threads
  for each row execute function public.set_updated_at();

create or replace function public.is_chat_thread_member(target_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_thread_members m
    where m.thread_id = target_thread
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_chat_thread_member(uuid) from public;
grant execute on function public.is_chat_thread_member(uuid) to authenticated;

-- 4. Extend workspace_chat_messages for org scoping, groups, replies, metadata
alter table public.workspace_chat_messages
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists thread_id uuid references public.chat_threads(id) on delete cascade,
  add column if not exists reply_to_id uuid references public.workspace_chat_messages(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists edited_at timestamptz;

create index if not exists workspace_chat_org_channel_idx
  on public.workspace_chat_messages (organization_id, channel, created_at desc);
create index if not exists workspace_chat_thread_idx
  on public.workspace_chat_messages (thread_id, created_at desc);
create index if not exists workspace_chat_created_idx
  on public.workspace_chat_messages (created_at desc);

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.workspace_chat_messages enable row level security;

drop policy if exists "chat_threads_select_members" on public.chat_threads;
create policy "chat_threads_select_members" on public.chat_threads
  for select to authenticated
  using (created_by = (select auth.uid()) or public.is_chat_thread_member(id));

drop policy if exists "chat_threads_insert_creator" on public.chat_threads;
create policy "chat_threads_insert_creator" on public.chat_threads
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (organization_id is null or public.is_active_org_member(organization_id))
  );

drop policy if exists "chat_threads_update_creator" on public.chat_threads;
create policy "chat_threads_update_creator" on public.chat_threads
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_chat_thread_member(id))
  with check (created_by = (select auth.uid()) or public.is_chat_thread_member(id));

drop policy if exists "chat_threads_delete_creator" on public.chat_threads;
create policy "chat_threads_delete_creator" on public.chat_threads
  for delete to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists "chat_thread_members_select" on public.chat_thread_members;
create policy "chat_thread_members_select" on public.chat_thread_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_chat_thread_member(thread_id)
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.created_by = (select auth.uid())
    )
  );

drop policy if exists "chat_thread_members_insert" on public.chat_thread_members;
create policy "chat_thread_members_insert" on public.chat_thread_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.created_by = (select auth.uid())
    )
    or public.is_chat_thread_member(thread_id)
  );

drop policy if exists "chat_thread_members_delete" on public.chat_thread_members;
create policy "chat_thread_members_delete" on public.chat_thread_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.created_by = (select auth.uid())
    )
  );

drop policy if exists "workspace_chat_messages_select" on public.workspace_chat_messages;
create policy "workspace_chat_messages_select" on public.workspace_chat_messages
  for select to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or (thread_id is not null and public.is_chat_thread_member(thread_id))
    or (
      recipient_id is null
      and thread_id is null
      and (
        (organization_id is not null and public.is_active_org_member(organization_id))
        or (organization_id is null and workspace_id is not null and public.can_access_workspace(workspace_id))
        or (organization_id is null and workspace_id is null)
      )
    )
  );

drop policy if exists "workspace_chat_messages_insert" on public.workspace_chat_messages;
create policy "workspace_chat_messages_insert" on public.workspace_chat_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (thread_id is null or public.is_chat_thread_member(thread_id))
    and (organization_id is null or public.is_active_org_member(organization_id))
    and (workspace_id is null or public.can_access_workspace(workspace_id))
  );

drop policy if exists "workspace_chat_messages_update_sender" on public.workspace_chat_messages;
create policy "workspace_chat_messages_update_sender" on public.workspace_chat_messages
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

drop policy if exists "workspace_chat_messages_delete_sender" on public.workspace_chat_messages;
create policy "workspace_chat_messages_delete_sender" on public.workspace_chat_messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));

-- 5. Message Reactions
create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.workspace_chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists chat_message_reactions_msg_idx
  on public.chat_message_reactions (message_id);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "chat_reactions_select" on public.chat_message_reactions;
create policy "chat_reactions_select" on public.chat_message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.workspace_chat_messages m
      where m.id = message_id
    )
  );

drop policy if exists "chat_reactions_insert" on public.chat_message_reactions;
create policy "chat_reactions_insert" on public.chat_message_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workspace_chat_messages m
      where m.id = message_id
    )
  );

drop policy if exists "chat_reactions_delete" on public.chat_message_reactions;
create policy "chat_reactions_delete" on public.chat_message_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 6. Read Receipts & Unread Tracking
create table if not exists public.chat_read_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_key text not null check (char_length(thread_key) between 1 and 160),
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_key)
);

create index if not exists chat_read_receipts_thread_idx
  on public.chat_read_receipts (thread_key, last_read_at desc);

alter table public.chat_read_receipts enable row level security;

drop policy if exists "chat_read_receipts_select" on public.chat_read_receipts;
create policy "chat_read_receipts_select" on public.chat_read_receipts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or thread_key like ('dm:%' || (select auth.uid())::text || '%')
    or thread_key like 'ch:%'
    or (
      thread_key ~ '^grp:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      and public.is_chat_thread_member(substring(thread_key from 5)::uuid)
    )
  );

drop policy if exists "chat_read_receipts_upsert_self" on public.chat_read_receipts;
create policy "chat_read_receipts_upsert_self" on public.chat_read_receipts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 7. Persistent Binary Chat Attachments (images/screenshots/files)
create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0 and file_size_bytes <= 10485760),
  file_bytes bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_attachments_uploader_idx
  on public.chat_attachments (uploader_id, created_at desc);

alter table public.chat_attachments enable row level security;

drop policy if exists "chat_attachments_select_colleagues" on public.chat_attachments;
create policy "chat_attachments_select_colleagues" on public.chat_attachments
  for select to authenticated
  using (
    uploader_id = (select auth.uid())
    or (organization_id is not null and public.is_active_org_member(organization_id))
    or exists (
      select 1
      from public.organization_members m1
      join public.organization_members m2 on m2.organization_id = m1.organization_id
      where m1.user_id = (select auth.uid())
        and m1.status = 'active'
        and m2.user_id = chat_attachments.uploader_id
        and m2.status = 'active'
    )
  );

drop policy if exists "chat_attachments_insert_self" on public.chat_attachments;
create policy "chat_attachments_insert_self" on public.chat_attachments
  for insert to authenticated
  with check (uploader_id = (select auth.uid()));

drop policy if exists "chat_attachments_delete_self" on public.chat_attachments;
create policy "chat_attachments_delete_self" on public.chat_attachments
  for delete to authenticated
  using (uploader_id = (select auth.uid()));

-- 8. Enable Supabase Realtime publication (safe when already added)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.workspace_chat_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.chat_message_reactions; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.chat_read_receipts; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  end if;
end $$;
