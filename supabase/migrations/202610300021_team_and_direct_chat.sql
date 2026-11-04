create table if not exists public.workspace_chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  channel text not null default 'general',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists workspace_chat_channel_idx on public.workspace_chat_messages (workspace_id, channel, created_at asc);
create index if not exists workspace_chat_direct_idx on public.workspace_chat_messages (sender_id, recipient_id, created_at asc);

alter table public.workspace_chat_messages enable row level security;

drop policy if exists "workspace_chat_messages_select" on public.workspace_chat_messages;
create policy "workspace_chat_messages_select" on public.workspace_chat_messages for select to authenticated
using (
  (recipient_id is null and (workspace_id is null or public.can_access_workspace(workspace_id)))
  or recipient_id = auth.uid()
  or sender_id = auth.uid()
);

drop policy if exists "workspace_chat_messages_insert" on public.workspace_chat_messages;
create policy "workspace_chat_messages_insert" on public.workspace_chat_messages for insert to authenticated
with check (
  sender_id = auth.uid()
);
