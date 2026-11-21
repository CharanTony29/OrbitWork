"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
import WorkspaceLovPopover, { preloadWorkspaceLov } from "./WorkspaceLovPopover";
import { NavRailDynamicItems, type RailNavItem } from "./NavRailOverflowMenu";

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
  const railRef = useRef<HTMLElement | null>(null);

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
      preloadWorkspaceLov();
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

  const navItems: RailNavItem[] = [
    {
      key: "home",
      label: "Home",
      title: "Overview",
      href: "/dashboard",
      icon: <House size={18} />,
      isActive: isHomeActive,
    },
    {
      key: "dashboard",
      label: "Dashboard",
      title: "Dashboard",
      href: "/my-dashboard",
      icon: <LayoutDashboard size={17} />,
      isActive: isDashboardActive,
    },
    {
      key: "workspace",
      label: "Workspace",
      title: "Quick Workspace & Organization Switcher",
      onClick: () => setLovOpen((prev) => !prev),
      icon: <FolderKanban size={17} />,
      isActive: lovOpen,
    },
    {
      key: "inbox",
      label: "Inbox",
      title: "Inbox",
      href: "/inbox",
      icon: <Bell size={17} />,
      isActive: isInboxActive,
    },
    {
      key: "planner",
      label: "Planner",
      title: "Planner & Meeting Rooms",
      href: activeOrgId ? `/planner?org=${activeOrgId}` : "/planner",
      icon: <CalendarDays size={17} />,
      isActive: isPlannerActive,
    },
    {
      key: "docs",
      label: "Docs",
      title: "Docs & Attachments",
      href: activeProjectId
        ? `/projects/${activeProjectId}/documents`
        : activeOrgId
        ? `/organizations/${activeOrgId}/docs`
        : "/dashboard",
      icon: <FileText size={17} />,
      isActive: isDocsActive,
    },
    {
      key: "time",
      label: "Time",
      title: "Workspace Timesheets",
      href: activeWorkspaceId
        ? `/workspaces/${activeWorkspaceId}/timesheets`
        : "/my-dashboard",
      icon: <Clock3 size={17} />,
      isActive: isTimeActive,
    },
    {
      key: "chat",
      label: "Chat",
      title: "Team & Personal Chat",
      href: "/chat",
      icon: <MessageSquare size={17} />,
      isActive: isChatActive,
    },
    {
      key: "people",
      label: "People",
      title: "Members",
      href: activeOrgId
        ? `/organizations/${activeOrgId}/members`
        : "/dashboard",
      icon: <UsersRound size={17} />,
      isActive: isPeopleActive,
    },
  ];

  return (
    <nav ref={railRef} className="work-icon-rail global-app-rail" aria-label="Main navigation">
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

      <NavRailDynamicItems
        railRef={railRef}
        items={navItems}
        moreHref={
          activeOrgId
            ? `/organizations/${activeOrgId}/calendar`
            : "/dashboard"
        }
        moreTitle="Holidays & Leave"
        moreIsActive={isMoreActive}
        moreIcon={<Layers3 size={17} />}
      />

      <WorkspaceLovPopover isOpen={lovOpen} onClose={() => setLovOpen(false)} />
    </nav>
  );
}
