"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Clock3,
  FileText,
  House,
  Layers3,
  LayoutDashboard,
  MessageSquare,
  PanelLeft,
  UsersRound,
  FolderKanban,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import WorkspaceLovPopover from "./WorkspaceLovPopover";

type GlobalAppRailProps = {
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
};

export default function GlobalAppRail({
  organizationId,
  workspaceId,
  projectId,
}: GlobalAppRailProps) {
  const pathname = usePathname() || "";
  const [storedOrgId, setStoredOrgId] = useState<string | null>(null);
  const [storedWorkspaceId, setStoredWorkspaceId] = useState<string | null>(null);
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);
  const [lovOpen, setLovOpen] = useState(false);

  // Sync props to localStorage and retrieve stored values
  useEffect(() => {
    try {
      if (organizationId) {
        localStorage.setItem("orbitwork:current-org-id", organizationId);
        setStoredOrgId(organizationId);
      } else {
        const saved = localStorage.getItem("orbitwork:current-org-id");
        if (saved) setStoredOrgId(saved);
      }

      if (workspaceId) {
        localStorage.setItem("orbitwork:current-workspace-id", workspaceId);
        setStoredWorkspaceId(workspaceId);
      } else {
        const saved = localStorage.getItem("orbitwork:current-workspace-id");
        if (saved) setStoredWorkspaceId(saved);
      }

      if (projectId) {
        localStorage.setItem("orbitwork:current-project-id", projectId);
        setStoredProjectId(projectId);
      } else {
        const saved = localStorage.getItem("orbitwork:current-project-id");
        if (saved) setStoredProjectId(saved);
      }
    } catch {}
  }, [organizationId, workspaceId, projectId]);

  const activeOrgId = organizationId || storedOrgId;
  const activeWorkspaceId = workspaceId || storedWorkspaceId;
  const activeProjectId = projectId || storedProjectId;

  const handleOpenDrawer = useCallback(() => {
    window.dispatchEvent(new CustomEvent("orbitwork:open-mobile-nav"));
  }, []);

  const isHomeActive = pathname === "/dashboard";
  const isDashboardActive = pathname === "/my-dashboard";
  const isInboxActive = pathname.startsWith("/inbox");
  const isPlannerActive = pathname.startsWith("/planner");
  const isDocsActive =
    pathname.includes("/docs") || pathname.includes("/documents");
  const isTimeActive = pathname.includes("/timesheets");
  const isChatActive = pathname.startsWith("/chat");
  const isPeopleActive = pathname.includes("/members");
  const isMoreActive = pathname.includes("/calendar");

  return (
    <nav className="work-icon-rail global-app-rail" aria-label="Main navigation">
      <Link
        className="work-rail-logo"
        href="/dashboard"
        prefetch={false}
        aria-label="Orbitwork home"
      >
        <BrandMark className="brand-mark" size={25} />
      </Link>

      <button
        type="button"
        className="work-rail-toggle-btn"
        onClick={handleOpenDrawer}
        title="Open navigation menu"
        aria-label="Open navigation menu"
      >
        <PanelLeft size={17} />
      </button>

      <Link
        href="/dashboard"
        prefetch={false}
        title="Overview"
        className={isHomeActive ? "is-active" : undefined}
      >
        <House size={18} />
        <span>Home</span>
      </Link>

      <Link
        href="/my-dashboard"
        prefetch={false}
        title="Dashboard"
        className={isDashboardActive ? "is-active" : undefined}
      >
        <LayoutDashboard size={17} />
        <span>Dashboard</span>
      </Link>

      <button
        type="button"
        onClick={() => setLovOpen((prev) => !prev)}
        title="Quick Workspace & Organization LOV Switcher"
        className={lovOpen ? "is-active" : undefined}
        style={{
          background: lovOpen ? "var(--rail-hover)" : "transparent",
          border: 0,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          color: lovOpen ? "var(--rail-strong)" : "var(--rail-ink)",
          borderRadius: 8,
          width: 46,
          minHeight: 47,
        }}
      >
        <FolderKanban size={17} />
        <span style={{ fontSize: 8, fontWeight: 650 }}>Spaces</span>
      </button>

      <Link
        href="/inbox"
        prefetch={false}
        title="Inbox"
        className={isInboxActive ? "is-active" : undefined}
      >
        <Bell size={17} />
        <span>Inbox</span>
      </Link>

      <Link
        href={activeOrgId ? `/planner?org=${activeOrgId}` : "/planner"}
        prefetch={false}
        title="Planner & Meeting Rooms"
        className={isPlannerActive ? "is-active" : undefined}
      >
        <CalendarDays size={17} />
        <span>Planner</span>
      </Link>

      <Link
        href={
          activeProjectId
            ? `/projects/${activeProjectId}/documents`
            : activeOrgId
            ? `/organizations/${activeOrgId}/docs`
            : "/dashboard"
        }
        prefetch={false}
        title="Docs & Attachments"
        className={isDocsActive ? "is-active" : undefined}
      >
        <FileText size={17} />
        <span>Docs</span>
      </Link>

      <Link
        href={
          activeWorkspaceId
            ? `/workspaces/${activeWorkspaceId}/timesheets`
            : "/my-dashboard"
        }
        prefetch={false}
        title="Workspace Timesheets"
        className={isTimeActive ? "is-active" : undefined}
      >
        <Clock3 size={17} />
        <span>Time</span>
      </Link>

      <Link
        href="/chat"
        prefetch={false}
        title="Team & Personal Chat"
        className={isChatActive ? "is-active" : undefined}
      >
        <MessageSquare size={17} />
        <span>Chat</span>
      </Link>

      <Link
        href={
          activeOrgId
            ? `/organizations/${activeOrgId}/members`
            : "/dashboard"
        }
        prefetch={false}
        title="Members"
        className={isPeopleActive ? "is-active" : undefined}
      >
        <UsersRound size={17} />
        <span>People</span>
      </Link>

      <Link
        className={`work-rail-more${isMoreActive ? " is-active" : ""}`}
        href={
          activeOrgId
            ? `/organizations/${activeOrgId}/calendar`
            : "/dashboard"
        }
        prefetch={false}
        title="Holidays and leave (People & Availability)"
      >
        <Layers3 size={17} />
        <span>More</span>
      </Link>

      <WorkspaceLovPopover isOpen={lovOpen} onClose={() => setLovOpen(false)} />
    </nav>
  );
}
