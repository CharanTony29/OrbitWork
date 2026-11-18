-- 202611180001_user_prefs_personal_cloud_inbox.sql
-- Adds:
--   1. Per-user List tab column widths & frozen columns on user_preferences
--   2. Per-user personal Google Drive / OneDrive connections for private Chat/Group attachments
--   3. Organization-wide cloud storage domain/provider policy (*@myorg.com vs any)
--   4. External cloud pointer columns on chat_attachments (nullable file_bytes, zero Supabase bloat)
--   5. Per-user Inbox triage states (primary / later / cleared)

-- 1. Extend user_preferences for per-user column resizing & freezing
ALTER TABLE IF EXISTS public.user_preferences
  ADD COLUMN IF NOT EXISTS list_column_widths jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS list_frozen_columns jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Organization-wide personal chat cloud storage policy (Owner/Manager controlled)
ALTER TABLE IF EXISTS public.organizations
  ADD COLUMN IF NOT EXISTS chat_storage_policy text NOT NULL DEFAULT 'any'
    CHECK (chat_storage_policy IN ('any', 'org_domain_only')),
  ADD COLUMN IF NOT EXISTS chat_storage_allowed_providers text NOT NULL DEFAULT 'both'
    CHECK (chat_storage_allowed_providers IN ('both', 'onedrive', 'google_drive')),
  ADD COLUMN IF NOT EXISTS chat_storage_allowed_domains text[] NOT NULL DEFAULT '{}'::text[];

-- 3. Per-user personal cloud storage connections (Profile Settings)
CREATE TABLE IF NOT EXISTS public.user_cloud_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_drive', 'onedrive')),
  account_email text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  folder_id text,
  folder_name text NOT NULL DEFAULT 'Orbitwork Chat',
  is_active boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_cloud_connections_user
  ON public.user_cloud_connections(user_id, is_active);

ALTER TABLE public.user_cloud_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_connections' AND policyname = 'user_cloud_connections_select_own'
  ) THEN
    CREATE POLICY user_cloud_connections_select_own
      ON public.user_cloud_connections FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_connections' AND policyname = 'user_cloud_connections_insert_own'
  ) THEN
    CREATE POLICY user_cloud_connections_insert_own
      ON public.user_cloud_connections FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_connections' AND policyname = 'user_cloud_connections_update_own'
  ) THEN
    CREATE POLICY user_cloud_connections_update_own
      ON public.user_cloud_connections FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_connections' AND policyname = 'user_cloud_connections_delete_own'
  ) THEN
    CREATE POLICY user_cloud_connections_delete_own
      ON public.user_cloud_connections FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Extend chat_attachments to point to sender's personal Google Drive / OneDrive (no Supabase bytes)
ALTER TABLE IF EXISTS public.chat_attachments
  ALTER COLUMN file_bytes DROP NOT NULL;

ALTER TABLE IF EXISTS public.chat_attachments
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'built_in',
  ADD COLUMN IF NOT EXISTS external_file_id text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. Per-user Inbox triage states (Primary / Later / Cleared + Read state)
CREATE TABLE IF NOT EXISTS public.user_inbox_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  bucket text NOT NULL DEFAULT 'primary' CHECK (bucket IN ('primary', 'later', 'cleared')),
  is_read boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_user_inbox_states_user
  ON public.user_inbox_states(user_id, bucket);

ALTER TABLE public.user_inbox_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_inbox_states' AND policyname = 'user_inbox_states_own_all'
  ) THEN
    CREATE POLICY user_inbox_states_own_all
      ON public.user_inbox_states FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
