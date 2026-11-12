-- 202611120002_contact_inquiries.sql
-- Stores public website contact & feedback submissions without requiring login.

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  organization text not null default '' check (char_length(organization) <= 160),
  email text not null check (char_length(trim(email)) between 3 and 200),
  topic text not null default 'General Feedback' check (char_length(topic) <= 160),
  message text not null check (char_length(trim(message)) between 2 and 5000),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contact_inquiries_created_idx
  on public.contact_inquiries (created_at desc);

alter table public.contact_inquiries enable row level security;

drop policy if exists "contact_inquiries_insert_public" on public.contact_inquiries;
create policy "contact_inquiries_insert_public" on public.contact_inquiries
  for insert to anon, authenticated
  with check (char_length(trim(name)) >= 1 and char_length(trim(message)) >= 2);
