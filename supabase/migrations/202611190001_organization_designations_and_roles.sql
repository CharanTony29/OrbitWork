-- 202611190001_organization_designations_and_roles.sql
-- Organization Designations, Multi-Role Assignments, and AI Smart Assignment

CREATE TABLE IF NOT EXISTS public.organization_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  hierarchy_level integer NOT NULL DEFAULT 5,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#3b82f6',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS designations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_designation text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS designations text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.organization_designations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read organization_designations for authenticated" ON public.organization_designations;
CREATE POLICY "Allow read organization_designations for authenticated"
  ON public.organization_designations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert organization_designations for authenticated" ON public.organization_designations;
CREATE POLICY "Allow insert organization_designations for authenticated"
  ON public.organization_designations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow update organization_designations for authenticated" ON public.organization_designations;
CREATE POLICY "Allow update organization_designations for authenticated"
  ON public.organization_designations FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow delete organization_designations for authenticated" ON public.organization_designations;
CREATE POLICY "Allow delete organization_designations for authenticated"
  ON public.organization_designations FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
