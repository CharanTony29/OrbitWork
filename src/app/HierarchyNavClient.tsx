"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  FolderKanban,
  House,
  Layers3,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
  X,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import ProjectSublinks from "./ProjectSublinks";

type Props = {
  organizationId: string;
  organizationName: string;
  currentWorkspaceId: string;
  currentProjectId?: string;
  workspaces: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; workspace_id: string }>;
};

const STORAGE_KEY = "orbitwork:sidebar-collapsed";

export default function HierarchyNavClient({
  organizationId,
  organizationName,
  currentWorkspaceId,
  currentProjectId,
  workspaces,
  projects,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Initialize collapse preference from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  // Update layout container classes
  useEffect(() => {
    const layoutEl = document.querySelector(".hierarchy-layout");
    if (!layoutEl) return;

    if (isCollapsed) {
      layoutEl.classList.add("is-collapsed");
    } else {
      layoutEl.classList.remove("is-collapsed");
    }

    if (isMobileOpen) {
      layoutEl.classList.add("is-mobile-open");
    } else {
      layoutEl.classList.remove("is-mobile-open");
    }
  }, [isCollapsed, isMobileOpen]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Listen for mobile navigation events
  useEffect(() => {
    const onOpen = () => setIsMobileOpen(true);
    const onClose = () => setIsMobileOpen(false);

    window.addEventListener("orbitwork:open-mobile-nav", onOpen);
    window.addEventListener("orbitwork:close-mobile-nav", onClose);

    return () => {
      window.removeEventListener("orbitwork:open-mobile-nav", onOpen);
      window.removeEventListener("orbitwork:close-mobile-nav", onClose);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        toggleCollapsed();
      }
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapsed, isMobileOpen]);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className="hierarchy-mobile-backdrop"
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Navigation Group Container: Rail + Hierarchy Sidebar */}
      <div className={`hierarchy-nav-group${isCollapsed ? " is-collapsed" : ""}`}>
        {/* Compact Icon Rail */}
        <nav className="work-icon-rail" aria-label="Main navigation">
          <Link
            className="work-rail-logo"
            href="/dashboard"
            prefetch={false}
            aria-label="Orbitwork home"
          >
            <BrandMark className="brand-mark" size={25} />
          </Link>

          {/* Toggle button on rail to expand sidebar when collapsed on desktop */}
          <button
            type="button"
            className="work-rail-toggle-btn"
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>

          <Link href="/dashboard" prefetch={false} title="Overview">
            <House size={18} />
            <span>Home</span>
          </Link>
          <Link href="/my-dashboard" prefetch={false} title="Dashboard">
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
          </Link>
          <Link href="/inbox" prefetch={false} title="Inbox">
            <Bell size={17} />
            <span>Inbox</span>
          </Link>
          <Link
            href={organizationId ? `/planner?org=${organizationId}` : "/planner"}
            prefetch={false}
            title="Planner & Meeting Rooms"
          >
            <CalendarDays size={17} />
            <span>Planner</span>
          </Link>
          <Link
            href={
              currentProjectId
                ? `/projects/${currentProjectId}/documents`
                : `/organizations/${organizationId}/docs`
            }
            prefetch={false}
            title="Docs & Attachments"
          >
            <FileText size={17} />
            <span>Docs</span>
          </Link>
          <Link
            href={`/workspaces/${currentWorkspaceId}/timesheets`}
            prefetch={false}
            title="Workspace Timesheets"
          >
            <Clock3 size={17} />
            <span>Time</span>
          </Link>
          <Link href="/chat" prefetch={false} title="Team & Personal Chat">
            <MessageSquare size={17} />
            <span>Chat</span>
          </Link>
          <Link
            href={`/organizations/${organizationId}/members`}
            prefetch={false}
            title="Members"
          >
            <UsersRound size={17} />
            <span>People</span>
          </Link>
          <Link
            className="work-rail-more"
            href={`/organizations/${organizationId}/calendar`}
            prefetch={false}
            title="Holidays and leave"
          >
            <Layers3 size={17} />
            <span>More</span>
          </Link>
        </nav>

        {/* Tree Sidebar */}
        <aside
          className="hierarchy-sidebar"
          aria-label="Workspace navigation"
          aria-hidden={isCollapsed}
        >
          <div className="hierarchy-sidebar-heading">
            <div className="hierarchy-sidebar-heading-text">
              <span>WORKSPACE</span>
              <strong>{organizationName}</strong>
            </div>
            <div className="hierarchy-sidebar-actions">
              <button
                type="button"
                className="hierarchy-collapse-btn desktop-only"
                onClick={toggleCollapsed}
                title="Collapse sidebar (Ctrl+B)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
              <button
                type="button"
                className="hierarchy-mobile-close-btn mobile-only"
                onClick={() => setIsMobileOpen(false)}
                title="Close menu"
                aria-label="Close menu"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <Link className="hierarchy-dashboard" href="/dashboard" prefetch={false}>
            <Layers3 size={15} /> All organizations
          </Link>
          <Link className="hierarchy-dashboard" href="/my-dashboard" prefetch={false}>
            <LayoutDashboard size={15} /> Dashboard
          </Link>
          <Link className="hierarchy-dashboard" href="/inbox" prefetch={false}>
            <Bell size={15} /> Inbox
          </Link>
          <Link
            className="hierarchy-dashboard"
            href={`/organizations/${organizationId}/docs`}
            prefetch={false}
          >
            <FileText size={15} /> Docs &amp; Attachments
          </Link>

          <div className="hierarchy-org-label">
            <Building2 size={14} />
            <span>ORGANIZATION</span>
          </div>
          <div className="hierarchy-org-name" title={organizationName}>
            {organizationName}
          </div>

          <p className="hierarchy-section-label">WORKSPACES &amp; PROJECTS</p>

          <nav
            className="hierarchy-tree"
            aria-label="Organization workspaces and projects"
          >
            {workspaces.map((workspace) => (
              <details
                key={workspace.id}
                open={workspace.id === currentWorkspaceId}
              >
                <summary
                  className={
                    workspace.id === currentWorkspaceId && !currentProjectId
                      ? "is-current"
                      : ""
                  }
                >
                  <ChevronDown size={13} />
                  <FolderKanban size={14} />
                  <Link
                    className="hierarchy-workspace-title-link"
                    href={`/workspaces/${workspace.id}`}
                    prefetch={false}
                  >
                    {workspace.name}
                  </Link>
                </summary>
                <div className="hierarchy-projects">
                  <Link
                    className={`hierarchy-workspace-link${
                      workspace.id === currentWorkspaceId && !currentProjectId
                        ? " is-current"
                        : ""
                    }`}
                    href={`/workspaces/${workspace.id}`}
                    prefetch={false}
                  >
                    Workspace overview
                  </Link>
                  {projects
                    .filter((project) => project.workspace_id === workspace.id)
                    .map((project) => (
                      <div className="hierarchy-project-group" key={project.id}>
                        <Link
                          className={`hierarchy-project-link${
                            project.id === currentProjectId ? " is-current" : ""
                          }`}
                          href={`/projects/${project.id}`}
                          prefetch={false}
                          title={project.name}
                        >
                          <span className="hierarchy-project-dot" />
                          <span className="hierarchy-link-label">
                            {project.name}
                          </span>
                        </Link>
                        {project.id === currentProjectId && (
                          <ProjectSublinks projectId={project.id} />
                        )}
                      </div>
                    ))}
                </div>
              </details>
            ))}
            {!workspaces.length && (
              <p className="hierarchy-empty">No workspaces yet.</p>
            )}
          </nav>

          <div className="hierarchy-sidebar-footer">
            <Link
              href={`/organizations/${organizationId}/calendar`}
              prefetch={false}
            >
              Holidays &amp; leave
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
