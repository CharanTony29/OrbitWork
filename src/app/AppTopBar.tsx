import type { ReactNode } from "react";
import CurrentUserBadge from "./CurrentUserBadge";
import GlobalSearchModal from "./GlobalSearchModal";

export default function AppTopBar({
  email,
  projectId,
  workspaceId,
  workspaceName,
  organizationId,
  leftSlot,
}: {
  email: string;
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  organizationId?: string;
  leftSlot?: ReactNode;
}) {
  return (
    <header className="topbar app-topbar">
      <div className="topbar-left">
        {leftSlot}
      </div>
      <div className="topbar-center">
        <GlobalSearchModal
          variant="topbar"
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </div>
      <div className="topbar-right">
        <CurrentUserBadge
          email={email}
          projectId={projectId}
          workspaceId={workspaceId}
          organizationId={organizationId}
        />
      </div>
    </header>
  );
}
