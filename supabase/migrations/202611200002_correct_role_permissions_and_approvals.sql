-- ==============================================================================
-- Orbitwork Role & Permission Correction Migration
-- Roles: Owner, Co-Owner, Admin, Manager, Member, Viewer
-- Date: 2026-11-20
-- ==============================================================================

-- 1. Ensure 'co_owner' exists in organization_role enum
DO $$
BEGIN
  ALTER TYPE public.organization_role ADD VALUE IF NOT EXISTS 'co_owner' AFTER 'owner';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create deletion_requests table for Co-Owner destructive approval workflow
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('organization', 'workspace', 'project')),
  resource_id uuid NOT NULL,
  resource_name text NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_org_status
  ON public.deletion_requests(organization_id, status);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Allow notification event types for approval workflow
DO $$
BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_event_type_check;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_event_type_check
    CHECK (event_type = ANY (ARRAY[
      'task_assigned'::text, 'task_reassigned'::text, 'task_unassigned'::text,
      'task_commented'::text, 'task_status_changed'::text, 'task_completed'::text,
      'task_due_reminder'::text, 'task_mentioned'::text, 'channel_mentioned'::text,
      'leave_requested'::text, 'leave_reviewed'::text, 'task_delegated'::text,
      'goal_completed'::text, 'meeting_scheduled'::text,
      'deletion_request'::text, 'deletion_approved'::text, 'deletion_rejected'::text,
      'ownership_transferred'::text
    ]));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Requester and Org Owners / Co-Owners can view requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'deletion_requests_select' AND polrelid = 'public.deletion_requests'::regclass
  ) THEN
    CREATE POLICY deletion_requests_select ON public.deletion_requests
      FOR SELECT
      TO authenticated
      USING (
        requested_by = (SELECT auth.uid())
        OR public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role])
      );
  END IF;
END $$;

-- Co-Owners can insert deletion requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'deletion_requests_insert' AND polrelid = 'public.deletion_requests'::regclass
  ) THEN
    CREATE POLICY deletion_requests_insert ON public.deletion_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (
        requested_by = (SELECT auth.uid())
        AND public.has_org_role(organization_id, ARRAY['co_owner'::public.organization_role])
      );
  END IF;
END $$;

-- 3. Access Control Functions

-- has_org_role: checks membership and honors organization creator as Owner
CREATE OR REPLACE FUNCTION public.has_org_role(target_org uuid, allowed_roles public.organization_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = target_org AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active' AND m.role = ANY(allowed_roles)
  )
  OR (
    'owner'::public.organization_role = ANY(allowed_roles)
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = target_org AND o.created_by = (SELECT auth.uid())
    )
  );
$$;

-- can_access_workspace: Owner, Co-Owner, Admin, Manager, and active workspace members
CREATE OR REPLACE FUNCTION public.can_access_workspace(target_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = (SELECT auth.uid())
    WHERE w.id = target_workspace AND om.user_id = (SELECT auth.uid()) AND om.status = 'active'
      AND (
        w.created_by = (SELECT auth.uid())
        OR om.role::text IN ('owner', 'co_owner', 'admin', 'manager')
        OR (wm.user_id IS NOT NULL AND wm.status = 'active')
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    JOIN public.organizations o ON o.id = w.organization_id
    WHERE w.id = target_workspace AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = target_workspace AND w.created_by = (SELECT auth.uid())
  );
$$;

-- can_manage_workspace: Owner, Co-Owner, Admin
CREATE OR REPLACE FUNCTION public.can_manage_workspace(target_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE w.id = target_workspace
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'co_owner', 'admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.organizations o ON o.id = w.organization_id
    WHERE w.id = target_workspace
      AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = target_workspace
      AND w.created_by = (SELECT auth.uid())
  );
$$;

-- can_create_project: Owner, Co-Owner, Admin, Manager
CREATE OR REPLACE FUNCTION public.can_create_project(target_workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE w.id = target_workspace
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.organizations o ON o.id = w.organization_id
    WHERE w.id = target_workspace
      AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = target_workspace
      AND w.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  );
$$;

-- can_access_project: Owner, Co-Owner, Admin, Manager, and active project members
CREATE OR REPLACE FUNCTION public.can_access_project(target_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = (SELECT auth.uid())
    LEFT JOIN public.project_members pm ON pm.project_id = p.id AND pm.user_id = (SELECT auth.uid())
    WHERE p.id = target_project
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND (
        om.role::text IN ('owner', 'co_owner', 'admin', 'manager')
        OR (wm.user_id IS NOT NULL AND wm.status = 'active')
        OR pm.user_id IS NOT NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organizations o ON o.id = w.organization_id
    WHERE p.id = target_project AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    WHERE p.id = target_project AND w.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = target_project AND p.created_by = (SELECT auth.uid())
  );
$$;

-- can_manage_project: Owner, Co-Owner, Admin, Manager
CREATE OR REPLACE FUNCTION public.can_manage_project(target_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE p.id = target_project
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organizations o ON o.id = w.organization_id
    WHERE p.id = target_project AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    WHERE p.id = target_project AND w.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project AND p.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = target_project
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role::text IN ('manager', 'lead', 'owner')
  );
$$;

-- can_delete_project: Owner, Admin, Manager directly. (Co-Owner requires approval workflow)
CREATE OR REPLACE FUNCTION public.can_delete_project(target_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE p.id = target_project
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organizations o ON o.id = w.organization_id
    WHERE p.id = target_project AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    WHERE p.id = target_project AND w.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = target_project
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role::text = 'manager'
  );
$$;

-- can_edit_project_tasks: Excludes Viewers. Allows Owner, Co-Owner, Admin, Manager, Member.
CREATE OR REPLACE FUNCTION public.can_edit_project_tasks(target_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE p.id = target_project
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text <> 'viewer'
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = target_project
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text <> 'viewer'
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role::text IN ('manager', 'member')
  );
$$;

-- can_delete_project_tasks: Excludes Members and Viewers. Allows Owner, Co-Owner, Admin, Manager.
CREATE OR REPLACE FUNCTION public.can_delete_project_tasks(target_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE p.id = target_project
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = target_project
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role::text = 'manager'
  );
$$;

-- can_assign_project_tasks: Excludes Members and Viewers. Allows Owner, Co-Owner, Admin, Manager.
CREATE OR REPLACE FUNCTION public.can_assign_project_tasks(target_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspaces w ON w.id = p.workspace_id
    JOIN public.organization_members om ON om.organization_id = w.organization_id
    WHERE p.id = target_project
      AND om.user_id = (SELECT auth.uid())
      AND om.status = 'active'
      AND om.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = target_project
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('owner', 'co_owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project
      AND pm.user_id = (SELECT auth.uid())
      AND pm.role::text = 'manager'
  );
$$;

-- 4. Correct Database RLS Policies

-- organizations: Delete is strictly Owner only.
DROP POLICY IF EXISTS organizations_delete_owner ON public.organizations;
CREATE POLICY organizations_delete_owner ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(id, ARRAY['owner'::public.organization_role])
    OR created_by = (SELECT auth.uid())
  );

-- organizations: Update allowed for Owner, Co-Owner, Admin.
DROP POLICY IF EXISTS organizations_update_admins ON public.organizations;
CREATE POLICY organizations_update_admins ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    public.has_org_role(id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.has_org_role(id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
    OR created_by = (SELECT auth.uid())
  );

-- workspaces: Delete is strictly Owner only (Admin is revoked!).
DROP POLICY IF EXISTS workspaces_delete_admins ON public.workspaces;
CREATE POLICY workspaces_delete_admins ON public.workspaces
  FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(organization_id, ARRAY['owner'::public.organization_role])
    OR (EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = workspaces.organization_id AND o.created_by = (SELECT auth.uid())
    ))
  );

-- workspaces: Update allowed for Owner, Co-Owner, Admin.
DROP POLICY IF EXISTS workspaces_update_admins ON public.workspaces;
CREATE POLICY workspaces_update_admins ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (
    public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
    OR (EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = workspaces.organization_id AND o.created_by = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
    OR (EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = workspaces.organization_id AND o.created_by = (SELECT auth.uid())
    ))
  );

-- workspaces: Insert allowed for Owner, Co-Owner, Admin.
DROP POLICY IF EXISTS workspaces_create_admins ON public.workspaces;
CREATE POLICY workspaces_create_admins ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
      OR (EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = workspaces.organization_id AND o.created_by = (SELECT auth.uid())
      ))
    )
  );

-- projects: Select uses non-recursive workspace/project member check
DROP POLICY IF EXISTS projects_read_accessible ON public.projects;
CREATE POLICY projects_read_accessible ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR public.can_access_workspace(workspace_id)
    OR (EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = (SELECT auth.uid())
    ))
  );

-- projects: Insert uses can_create_project (Owner, Co-Owner, Admin, Manager).
DROP POLICY IF EXISTS projects_create_admins ON public.projects;
DROP POLICY IF EXISTS projects_create_workspace_managers ON public.projects;
CREATE POLICY projects_create_workspace_managers ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.can_create_project(workspace_id)
  );

-- projects: Update uses can_manage_project (Owner, Co-Owner, Admin, Manager).
DROP POLICY IF EXISTS projects_update_admins ON public.projects;
DROP POLICY IF EXISTS projects_update_managers ON public.projects;
CREATE POLICY projects_update_managers ON public.projects
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_project(id))
  WITH CHECK (public.can_manage_project(id));

-- projects: Delete uses can_delete_project (Owner, Admin, Manager directly).
DROP POLICY IF EXISTS projects_delete_admins ON public.projects;
DROP POLICY IF EXISTS projects_delete_managers ON public.projects;
CREATE POLICY projects_delete_managers ON public.projects
  FOR DELETE
  TO authenticated
  USING (public.can_delete_project(id));

-- tasks: Insert/Update uses can_edit_project_tasks (Viewer blocked).
DROP POLICY IF EXISTS tasks_create_members ON public.tasks;
CREATE POLICY tasks_create_members ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.can_edit_project_tasks(project_id)
  );

DROP POLICY IF EXISTS tasks_update_members ON public.tasks;
CREATE POLICY tasks_update_members ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_project_tasks(project_id))
  WITH CHECK (public.can_edit_project_tasks(project_id));

-- tasks: Delete uses can_delete_project_tasks (Member & Viewer blocked).
DROP POLICY IF EXISTS tasks_delete_managers ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_editors ON public.tasks;
CREATE POLICY tasks_delete_editors ON public.tasks
  FOR DELETE
  TO authenticated
  USING (public.can_delete_project_tasks(project_id));

-- task_comments: Insert uses can_access_project (Viewers CAN comment).
DROP POLICY IF EXISTS task_comments_create_members ON public.task_comments;
CREATE POLICY task_comments_create_members ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.can_access_project(project_id)
  );

-- organization_members: Protect Owner from demotion and removal; protect co_owner management.
DROP POLICY IF EXISTS org_members_remove_admins_or_self ON public.organization_members;
CREATE POLICY org_members_remove_admins_or_self ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    role::text <> 'owner'
    AND (
      user_id = (SELECT auth.uid())
      OR (
        public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
        AND (
          role::text <> 'co_owner'
          OR public.has_org_role(organization_id, ARRAY['owner'::public.organization_role])
        )
      )
    )
  );

DROP POLICY IF EXISTS org_members_update_admins ON public.organization_members;
CREATE POLICY org_members_update_admins ON public.organization_members
  FOR UPDATE
  TO authenticated
  USING (
    role::text <> 'owner'
    AND public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
  )
  WITH CHECK (
    role::text <> 'owner'
    AND (
      role::text <> 'co_owner'
      OR public.has_org_role(organization_id, ARRAY['owner'::public.organization_role])
    )
    AND public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
  );

DROP POLICY IF EXISTS org_members_add_admins ON public.organization_members;
CREATE POLICY org_members_add_admins ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role::text <> 'owner'
    AND (
      public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
      OR (EXISTS (
        SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
      ))
    )
    AND (
      role::text <> 'co_owner'
      OR public.has_org_role(organization_id, ARRAY['owner'::public.organization_role])
      OR (EXISTS (
        SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
      ))
    )
  );

-- invitations: Owner, Co-Owner, Admin can invite and manage invitations
DROP POLICY IF EXISTS invitations_create_admins ON public.invitations;
CREATE POLICY invitations_create_admins ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = (SELECT auth.uid())
    AND (
      public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
      OR (EXISTS (
        SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
      ))
    )
  );

DROP POLICY IF EXISTS invitations_read_admins ON public.invitations;
CREATE POLICY invitations_read_admins ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    invited_by = (SELECT auth.uid())
    OR public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
    OR (EXISTS (
      SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
    ))
  );

DROP POLICY IF EXISTS invitations_update_admins ON public.invitations;
CREATE POLICY invitations_update_admins ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (
    public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
    OR (EXISTS (
      SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    public.has_org_role(organization_id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role])
    OR (EXISTS (
      SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = (SELECT auth.uid())
    ))
  );

-- 5. Stored Procedures for Deletion Requests and Ownership Transfer

CREATE OR REPLACE FUNCTION public.approve_deletion_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.deletion_requests%ROWTYPE;
  v_caller uuid := (SELECT auth.uid());
  v_is_owner boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_req FROM public.deletion_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Deletion request is already %', v_req.status;
  END IF;

  -- Verify caller is Owner of the organization
  v_is_owner := public.has_org_role(v_req.organization_id, ARRAY['owner'::public.organization_role])
                OR EXISTS (
                  SELECT 1 FROM public.organizations o 
                  WHERE o.id = v_req.organization_id AND o.created_by = v_caller
                );
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only the Organization Owner can approve deletion requests';
  END IF;

  -- CRITICAL REQUIREMENT: Co-Owner cannot approve their own request!
  IF v_req.requested_by = v_caller THEN
    RAISE EXCEPTION 'Cannot approve your own deletion request';
  END IF;

  -- Execute deletion based on resource_type
  IF v_req.resource_type = 'project' THEN
    DELETE FROM public.projects WHERE id = v_req.resource_id;
  ELSIF v_req.resource_type = 'workspace' THEN
    DELETE FROM public.workspaces WHERE id = v_req.resource_id;
  ELSIF v_req.resource_type = 'organization' THEN
    DELETE FROM public.organizations WHERE id = v_req.resource_id;
  ELSE
    RAISE EXCEPTION 'Unknown resource type %', v_req.resource_type;
  END IF;

  UPDATE public.deletion_requests
  SET status = 'executed', reviewed_by = v_caller, reviewed_at = now()
  WHERE id = p_request_id;

  -- Notify requester
  INSERT INTO public.notifications (
    recipient_id, actor_id, organization_id, event_type, message, action_url
  ) VALUES (
    v_req.requested_by,
    v_caller,
    v_req.organization_id,
    'deletion_approved',
    'Your request to delete ' || v_req.resource_type || ' "' || v_req.resource_name || '" was approved and completed.',
    '/dashboard'
  );

  RETURN jsonb_build_object('success', true, 'resource_type', v_req.resource_type, 'resource_id', v_req.resource_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_deletion_request(p_request_id uuid, p_reason text DEFAULT 'Rejected by owner')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.deletion_requests%ROWTYPE;
  v_caller uuid := (SELECT auth.uid());
  v_is_owner boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_req FROM public.deletion_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion request not found';
  END IF;

  v_is_owner := public.has_org_role(v_req.organization_id, ARRAY['owner'::public.organization_role])
                OR EXISTS (
                  SELECT 1 FROM public.organizations o 
                  WHERE o.id = v_req.organization_id AND o.created_by = v_caller
                );
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only the Organization Owner can reject deletion requests';
  END IF;

  UPDATE public.deletion_requests
  SET status = 'rejected', reviewed_by = v_caller, reviewed_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.notifications (
    recipient_id, actor_id, organization_id, event_type, message, action_url
  ) VALUES (
    v_req.requested_by,
    v_caller,
    v_req.organization_id,
    'deletion_rejected',
    'Your request to delete ' || v_req.resource_type || ' "' || v_req.resource_name || '" was rejected by the Owner.',
    '/dashboard'
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
  p_org_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_is_owner boolean;
  v_new_member record;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Check that caller is currently the Owner of p_org_id
  v_is_owner := public.has_org_role(p_org_id, ARRAY['owner'::public.organization_role])
                OR EXISTS (
                  SELECT 1 FROM public.organizations o
                  WHERE o.id = p_org_id AND o.created_by = v_caller
                );
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only the current Owner can transfer organization ownership';
  END IF;

  IF p_new_owner_id = v_caller THEN
    RAISE EXCEPTION 'You are already the owner of this organization';
  END IF;

  -- 2. Verify new owner exists as an active member in this organization
  SELECT * INTO v_new_member
  FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_new_owner_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New owner must be an active member of this organization';
  END IF;

  -- 3. Update organization created_by
  UPDATE public.organizations
  SET created_by = p_new_owner_id, updated_at = now()
  WHERE id = p_org_id;

  -- 4. Promote new owner to owner role
  UPDATE public.organization_members
  SET role = 'owner', updated_at = now()
  WHERE organization_id = p_org_id AND user_id = p_new_owner_id;

  -- 5. Demote current owner to co_owner
  UPDATE public.organization_members
  SET role = 'co_owner', updated_at = now()
  WHERE organization_id = p_org_id AND user_id = v_caller;

  -- 6. Insert notification
  INSERT INTO public.notifications (
    recipient_id, actor_id, organization_id, event_type, message, action_url
  ) VALUES (
    p_new_owner_id,
    v_caller,
    p_org_id,
    'ownership_transferred',
    'Organization ownership has been transferred to you.',
    '/dashboard'
  );

  RETURN jsonb_build_object('success', true, 'new_owner_id', p_new_owner_id);
END;
$$;

-- ---------------------------------------------------------
-- Workspace Members Non-Recursive Policies
-- ---------------------------------------------------------
ALTER POLICY "workspace_members_read_permitted" ON public.workspace_members
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organizations o 
    WHERE o.id = workspace_members.organization_id 
      AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = workspace_members.organization_id 
      AND om.user_id = (SELECT auth.uid()) 
      AND om.status = 'active'
  )
);

ALTER POLICY "workspace_members_manage_admins" ON public.workspace_members
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o 
    WHERE o.id = workspace_members.organization_id 
      AND o.created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = workspace_members.organization_id 
      AND om.user_id = (SELECT auth.uid()) 
      AND om.status = 'active' 
      AND om.role IN ('owner', 'co_owner', 'admin')
  )
)
WITH CHECK (
  (
    EXISTS (
      SELECT 1 FROM public.organizations o 
      WHERE o.id = workspace_members.organization_id 
        AND o.created_by = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = workspace_members.organization_id 
        AND om.user_id = (SELECT auth.uid()) 
        AND om.status = 'active' 
        AND om.role IN ('owner', 'co_owner', 'admin')
    )
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = workspace_members.organization_id 
        AND om.user_id = workspace_members.user_id 
        AND om.status = 'active'
    )
  )
);

