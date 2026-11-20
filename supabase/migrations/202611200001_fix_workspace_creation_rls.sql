-- 202611200001_fix_workspace_creation_rls.sql
-- Fix workspace creation failure for owners/admins:
-- 1. Redefine workspaces_read_permitted to avoid circular self-query on public.workspaces during INSERT ... RETURNING id
-- 2. Ensure org owners, org creators, admins, and managers have permissions to create/manage workspaces
-- 3. Automatically add the workspace creator to workspace_members as admin

-- 1. Redefine workspaces_read_permitted
DROP POLICY IF EXISTS "workspaces_read_permitted" ON public.workspaces;

CREATE POLICY "workspaces_read_permitted" ON public.workspaces
FOR SELECT TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'manager'::public.organization_role])
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = workspaces.organization_id AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
  )
);

-- 2. Update workspaces_create_admins
DROP POLICY IF EXISTS "workspaces_create_admins" ON public.workspaces;

CREATE POLICY "workspaces_create_admins" ON public.workspaces
FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (
    public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'manager'::public.organization_role])
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
    )
  )
);

-- 3. Update workspaces_update_admins
DROP POLICY IF EXISTS "workspaces_update_admins" ON public.workspaces;

CREATE POLICY "workspaces_update_admins" ON public.workspaces
FOR UPDATE TO authenticated
USING (
  public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'manager'::public.organization_role])
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'manager'::public.organization_role])
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
  )
);

-- 4. Update workspaces_delete_admins
DROP POLICY IF EXISTS "workspaces_delete_admins" ON public.workspaces;

CREATE POLICY "workspaces_delete_admins" ON public.workspaces
FOR DELETE TO authenticated
USING (
  public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'admin'::public.organization_role])
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
  )
);

-- 5. Trigger to automatically add workspace creator to workspace_members as admin
CREATE OR REPLACE FUNCTION public.handle_new_workspace_creator()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, organization_id, user_id, role, status)
  VALUES (NEW.id, NEW.organization_id, NEW.created_by, 'admin', 'active')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_created_add_creator ON public.workspaces;
CREATE TRIGGER on_workspace_created_add_creator
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_creator();
