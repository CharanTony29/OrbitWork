import type { ReactNode } from "react";
import GlobalAppRail from "./GlobalAppRail";

export default function AppRailLayout({
  children,
  organizationId,
  workspaceId,
  projectId,
}: {
  children: ReactNode;
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
}) {
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
