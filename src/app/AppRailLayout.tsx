import type { ReactNode } from "react";
import HierarchyNavigation from "./HierarchyNavigation";
import GlobalAppRail from "./GlobalAppRail";
import { getUserSpaceData } from "@/lib/workspace-space";
import "./hierarchy-navigation.css";

export default async function AppRailLayout({
  children,
  organizationId,
  organizationName,
  workspaceId,
  projectId,
}: {
  children: ReactNode;
  organizationId?: string;
  organizationName?: string;
  workspaceId?: string;
  projectId?: string;
}) {
  let targetOrgId = organizationId;
  let targetOrgName = organizationName;
  let targetWorkspaceId = workspaceId;

  // If organization details were not passed by caller, resolve from authenticated user space
  if (!targetOrgId || !targetOrgName) {
    try {
      const space = await getUserSpaceData();
      if (space?.organizations?.length) {
        if (!targetOrgId) {
          targetOrgId = space.organizations[0].id;
        }
        if (!targetOrgName) {
          targetOrgName =
            space.organizations.find((o) => o.id === targetOrgId)?.name ||
            space.organizations[0].name;
        }
        if (!targetWorkspaceId && space.workspaces?.length) {
          targetWorkspaceId =
            space.workspaces.find((w) => w.organization_id === targetOrgId)?.id ||
            space.workspaces[0].id;
        }
      }
    } catch {
      // Best-effort fallback
    }
  }

  // When an organization is found, mount the unified Orbitwork Hierarchy Navigation bar across all pages
  if (targetOrgId && targetOrgName) {
    return (
      <div className="hierarchy-layout is-collapsed">
        <HierarchyNavigation
          organizationId={targetOrgId}
          organizationName={targetOrgName}
          currentWorkspaceId={targetWorkspaceId || undefined}
          currentProjectId={projectId}
        />
        <div className="hierarchy-content">{children}</div>
      </div>
    );
  }

  // Graceful fallback for unauthenticated views or initial onboarding
  return (
    <div className="app-rail-layout">
      <GlobalAppRail
        organizationId={organizationId}
        workspaceId={workspaceId}
        projectId={projectId}
      />
      <div className="app-rail-content">{children}</div>
    </div>
  );
}
