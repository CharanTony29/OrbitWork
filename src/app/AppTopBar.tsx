import type { ReactNode } from "react";
import Link from "next/link";
import "./app-styles.css";
import CurrentUserBadge from "./CurrentUserBadge";
import GlobalSearchModal from "./GlobalSearchModal";
import TopBarMobileMenuToggle from "./TopBarMobileMenuToggle";
import { BrandMark } from "./BrandMark";

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
        {leftSlot ?? (
          <div className="topbar-default-brand-row">
            <TopBarMobileMenuToggle />
            <Link className="brand ov-brand topbar-header-brand" href="/dashboard" prefetch={false}>
              <BrandMark size={24} />
              <span className="brand-header-text">
                Orbit<span className="ov-brand-accent">Work</span>
              </span>
            </Link>
            {workspaceName && (
              <span className="topbar-crumb-item" title={workspaceName}>
                <span className="topbar-crumb-sep">/</span>
                <span className="topbar-crumb-title">{workspaceName}</span>
              </span>
            )}
          </div>
        )}
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
