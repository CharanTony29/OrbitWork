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
  projects: Array<{ id: string; name: string; workspace_id: string; icon?: string | null }>;
};

const STORAGE_KEY = "orbitwork:sidebar-collapsed";
const POPULAR_PROJECT_ICONS = ["📁", "🚀", "⚡", "🎯", "📊", "🛠️", "💻", "💡", "🔥", "🌟", "📦", "🎨", "🌐", "🔒", "🤖", "📈", "🧪", "📑"];

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
  const [customIcons, setCustomIcons] = useState<Record<string, string>>({});
  const [editingIconProjectId, setEditingIconProjectId] = useState<string | null>(null);
  const pathname = usePathname();

  // Initialize collapse preference and custom project icons from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setIsCollapsed(true);
      }
    } catch {}

    try {
      const savedIcons = localStorage.getItem("orbitwork:project_icons");
      if (savedIcons) setCustomIcons(JSON.parse(savedIcons));
    } catch {}

    const handleIconChange = (e: any) => {
      if (e?.detail?.projectId && e?.detail?.icon) {
        setCustomIcons((prev) => {
          const next = { ...prev, [e.detail.projectId]: e.detail.icon };
          try {
            localStorage.setItem("orbitwork:project_icons", JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    };
    window.addEventListener("orbitwork:project-icon-change", handleIconChange);
    return () => window.removeEventListener("orbitwork:project-icon-change", handleIconChange);
  }, []);

  const handlePickIcon = async (projId: string, icon: string) => {
    setCustomIcons((prev) => {
      const next = { ...prev, [projId]: icon };
      try {
        localStorage.setItem("orbitwork:project_icons", JSON.stringify(next));
      } catch {}
      return next;
    });
    setEditingIconProjectId(null);
    window.dispatchEvent(
      new CustomEvent("orbitwork:project-icon-change", {
        detail: { projectId: projId, icon },
      })
    );

    try {
      await fetch(`/api/projects/${projId}/icon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon }),
      });
    } catch {}
  };

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

          <Link
            href="/dashboard"
            prefetch={false}
            title="Overview"
            className={pathname === "/dashboard" ? "is-active" : undefined}
          >
            <House size={18} />
            <span>Home</span>
          </Link>
          <Link
            href="/my-dashboard"
            prefetch={false}
            title="Dashboard"
            className={pathname === "/my-dashboard" ? "is-active" : undefined}
          >
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/inbox"
            prefetch={false}
            title="Inbox"
            className={pathname.startsWith("/inbox") ? "is-active" : undefined}
          >
            <Bell size={17} />
            <span>Inbox</span>
          </Link>
          <Link
            href={organizationId ? `/planner?org=${organizationId}` : "/planner"}
            prefetch={false}
            title="Planner & Meeting Rooms"
            className={pathname.startsWith("/planner") ? "is-active" : undefined}
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
            className={
              pathname.includes("/docs") || pathname.includes("/documents")
                ? "is-active"
                : undefined
            }
          >
            <FileText size={17} />
            <span>Docs</span>
          </Link>
          <Link
            href={`/workspaces/${currentWorkspaceId}/timesheets`}
            prefetch={false}
            title="Workspace Timesheets"
            className={pathname.includes("/timesheets") ? "is-active" : undefined}
          >
            <Clock3 size={17} />
            <span>Time</span>
          </Link>
          <Link
            href="/chat"
            prefetch={false}
            title="Team & Personal Chat"
            className={pathname.startsWith("/chat") ? "is-active" : undefined}
          >
            <MessageSquare size={17} />
            <span>Chat</span>
          </Link>
          <Link
            href={`/organizations/${organizationId}/members`}
            prefetch={false}
            title="Members"
            className={pathname.includes("/members") ? "is-active" : undefined}
          >
            <UsersRound size={17} />
            <span>People</span>
          </Link>
          <Link
            className={`work-rail-more${pathname.includes("/calendar") ? " is-active" : ""}`}
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingIconProjectId(editingIconProjectId === project.id ? null : project.id);
                            }}
                            className="hierarchy-project-icon"
                            title="Click to customize project icon"
                            style={{
                              border: 0,
                              background: "transparent",
                              padding: 0,
                              cursor: "pointer",
                              fontSize: 13,
                              lineHeight: 1,
                              flexShrink: 0,
                              marginRight: 2,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {customIcons[project.id] || project.icon || "📁"}
                          </button>
                          <span className="hierarchy-link-label">
                            {project.name}
                          </span>
                        </Link>
                        {editingIconProjectId === project.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              margin: "4px 0 8px 10px",
                              padding: "8px 10px",
                              background: "var(--surface, #ffffff)",
                              border: "1px solid var(--line, #e2e8f0)",
                              borderRadius: 10,
                              boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                              zIndex: 50,
                              display: "grid",
                              gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                                Choose Project Icon
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingIconProjectId(null);
                                }}
                                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)", padding: 2 }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
                              {POPULAR_PROJECT_ICONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePickIcon(project.id, emoji);
                                  }}
                                  style={{
                                    border: (customIcons[project.id] || project.icon || "📁") === emoji ? "1.5px solid var(--green, #167c58)" : "1px solid var(--line, #e2e8f0)",
                                    background: (customIcons[project.id] || project.icon || "📁") === emoji ? "color-mix(in srgb, var(--green, #167c58) 12%, var(--surface))" : "var(--surface)",
                                    borderRadius: 6,
                                    padding: "4px 2px",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    display: "grid",
                                    placeItems: "center",
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
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
