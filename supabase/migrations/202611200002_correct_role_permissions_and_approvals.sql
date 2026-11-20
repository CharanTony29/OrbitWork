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
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('owner', 'co_owner', 'admin')
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
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace
      AND wm.user_id = (SELECT auth.uid())
      AND wm.status = 'active'
      AND wm.role::text IN ('owner', 'co_owner', 'admin', 'manager')
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
ALTER POLICY organizations_delete_owner ON public.organizations
  USING (public.has_org_role(id, ARRAY['owner'::public.organization_role]));

-- organizations: Update allowed for Owner, Co-Owner, Admin.
ALTER POLICY organizations_update_admins ON public.organizations
  USING (public.has_org_role(id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role]))
  WITH CHECK (public.has_org_role(id, ARRAY['owner'::public.organization_role, 'co_owner'::public.organization_role, 'admin'::public.organization_role]));

-- workspaces: Delete is strictly Owner only (Admin is revoked!).
ALTER POLICY workspaces_delete_admins ON public.workspaces
  USING (public.has_org_role(organization_id, ARRAY['owner'::public.organization_role]));

-- projects: Insert uses can_create_project (Owner, Co-Owner, Admin, Manager).
ALTER POLICY projects_create_admins ON public.projects
  WITH CHECK (public.can_create_project(workspace_id));

-- projects: Update uses can_manage_project (Owner, Co-Owner, Admin, Manager).
ALTER POLICY projects_update_admins ON public.projects
  USING (public.can_manage_project(id))
  WITH CHECK (public.can_manage_project(id));

-- projects: Delete uses can_delete_project (Owner, Admin, Manager directly).
ALTER POLICY projects_delete_admins ON public.projects
  USING (public.can_delete_project(id));

-- tasks: Insert/Update uses can_edit_project_tasks (Viewer blocked).
ALTER POLICY tasks_create_members ON public.tasks
  WITH CHECK (public.can_edit_project_tasks(project_id));

ALTER POLICY tasks_update_members ON public.tasks
  USING (public.can_edit_project_tasks(project_id))
  WITH CHECK (public.can_edit_project_tasks(project_id));

-- tasks: Delete uses can_delete_project_tasks (Member & Viewer blocked).
ALTER POLICY tasks_delete_managers ON public.tasks
  USING (public.can_delete_project_tasks(project_id));

-- task_comments: Insert uses can_access_project (Viewers CAN comment).
ALTER POLICY task_comments_create_members ON public.task_comments
  WITH CHECK (public.can_access_project(project_id));

-- organization_members: Protect Owner from demotion and removal; protect co_owner management.
ALTER POLICY org_members_remove_admins_or_self ON public.organization_members
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

ALTER POLICY org_members_update_admins ON public.organization_members
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
