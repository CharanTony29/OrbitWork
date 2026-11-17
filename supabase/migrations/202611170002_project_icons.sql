-- Add icon column to public.projects for user-customizable project icons
alter table public.projects add column if not exists icon text default '📁';
