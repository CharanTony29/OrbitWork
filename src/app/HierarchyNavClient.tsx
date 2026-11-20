"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  Plus,
  FolderPlus,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import ProjectSublinks from "./ProjectSublinks";
import { NavRailDynamicItems, type RailNavItem } from "./NavRailOverflowMenu";
import { preloadWorkspaceLov } from "./WorkspaceLovPopover";
import { createProject, createWorkspace } from "@/app/actions";

type Props = {
  organizationId: string;
  organizationName: string;
  currentWorkspaceId?: string;
  currentProjectId?: string;
  workspaces: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    workspace_id: string;
    icon?: string | null;
    taskCount?: number;
  }>;
  members?: Array<{ id: string; name: string; avatarUrl?: string | null }>;
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
  // Navigation sidebar defaults to minimized to the left across all pages as requested
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true; // Default minimized to the left
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [customIcons, setCustomIcons] = useState<Record<string, string>>({});
  const [editingIconProjectId, setEditingIconProjectId] = useState<string | null>(null);

  // Modal states for creating Workspace (New Space) and Project
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [projectModalTarget, setProjectModalTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState("📁");

  const pathname = usePathname();

  // Initialize collapse preference, custom project icons, and preload LOV spaces
  useEffect(() => {
    setMounted(true);
    preloadWorkspaceLov();

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      } else {
        setIsCollapsed(true);
      }
    } catch {
      setIsCollapsed(true);
    }

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
    const layoutEls = document.querySelectorAll(".hierarchy-layout");
    layoutEls.forEach((layoutEl) => {
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
    });
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
      if (e.key === "Escape") {
        if (workspaceModalOpen) setWorkspaceModalOpen(false);
        if (projectModalTarget) setProjectModalTarget(null);
        if (isMobileOpen) setIsMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapsed, isMobileOpen, workspaceModalOpen, projectModalTarget]);

  const railRef = useRef<HTMLElement | null>(null);

  const railNavItems: RailNavItem[] = [
    {
      key: "home",
      label: "Home",
      title: "Overview",
      href: "/dashboard",
      icon: <House size={18} />,
      isActive: pathname === "/dashboard",
    },
    {
      key: "dashboard",
      label: "Dashboard",
      title: "Dashboard",
      href: "/my-dashboard",
      icon: <LayoutDashboard size={17} />,
      isActive: pathname === "/my-dashboard",
    },
    {
      key: "inbox",
      label: "Inbox",
      title: "Inbox",
      href: "/inbox",
      icon: <Bell size={17} />,
      isActive: pathname.startsWith("/inbox"),
    },
    {
      key: "planner",
      label: "Planner",
      title: "Planner & Meeting Rooms",
      href: organizationId ? `/planner?org=${organizationId}` : "/planner",
      icon: <CalendarDays size={17} />,
      isActive: pathname.startsWith("/planner"),
    },
    {
      key: "docs",
      label: "Docs",
      title: "Docs & Attachments",
      href: currentProjectId
        ? `/projects/${currentProjectId}/documents`
        : `/organizations/${organizationId}/docs`,
      icon: <FileText size={17} />,
      isActive: pathname.includes("/docs") || pathname.includes("/documents"),
    },
    {
      key: "time",
      label: "Time",
      title: "Workspace Timesheets",
      href: `/workspaces/${currentWorkspaceId}/timesheets`,
      icon: <Clock3 size={17} />,
      isActive: pathname.includes("/timesheets"),
    },
    {
      key: "chat",
      label: "Chat",
      title: "Team & Personal Chat",
      href: "/chat",
      icon: <MessageSquare size={17} />,
      isActive: pathname.startsWith("/chat"),
    },
    {
      key: "people",
      label: "People",
      title: "Members",
      href: `/organizations/${organizationId}/members`,
      icon: <UsersRound size={17} />,
      isActive: pathname.includes("/members"),
    },
  ];

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
        {/* Compact Icon Rail (Orbitwork Deep Green) */}
        <nav ref={railRef} className="work-icon-rail" aria-label="Main navigation">
          <Link
            className="work-rail-logo"
            href="/dashboard"
            prefetch={true}
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

          <NavRailDynamicItems
            railRef={railRef}
            items={railNavItems}
            moreHref={`/organizations/${organizationId}/calendar`}
            moreTitle="Holidays & Leave"
            moreIsActive={pathname.includes("/calendar")}
            moreIcon={<Layers3 size={17} />}
          />
        </nav>

        {/* Tree Sidebar */}
        <aside
          className="hierarchy-sidebar"
          aria-label="Workspace navigation"
          aria-hidden={isCollapsed}
        >
          <div className="hierarchy-sidebar-heading">
            <div className="hierarchy-sidebar-heading-text">
              <span>ORGANIZATION</span>
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

          <Link className="hierarchy-dashboard" href="/dashboard" prefetch={true}>
            <Layers3 size={15} /> All organizations
          </Link>
          <Link className="hierarchy-dashboard" href="/my-dashboard" prefetch={true}>
            <LayoutDashboard size={15} /> Dashboard
          </Link>
          <Link className="hierarchy-dashboard" href="/inbox" prefetch={true}>
            <Bell size={15} /> Inbox
          </Link>
          <Link
            className="hierarchy-dashboard"
            href={`/organizations/${organizationId}/docs`}
            prefetch={true}
          >
            <FileText size={15} /> Docs &amp; Attachments
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              margin: "18px 9px 8px",
            }}
          >
            <p className="hierarchy-section-label" style={{ margin: 0 }}>
              SPACES (WORKSPACES)
            </p>
            <button
              type="button"
              onClick={() => setWorkspaceModalOpen(true)}
              title="Create New Space (Workspace)"
              style={{
                border: 0,
                background: "transparent",
                color: "var(--green, #167c58)",
                cursor: "pointer",
                padding: "2px 4px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <Plus size={13} />
            </button>
          </div>

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
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <ChevronDown size={13} />
                    <FolderKanban size={14} />
                    <Link
                      className="hierarchy-workspace-title-link"
                      href={`/workspaces/${workspace.id}`}
                      prefetch={true}
                    >
                      {workspace.name}
                    </Link>
                  </div>

                  {/* Create Project (+) Button for this workspace */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setProjectModalTarget(workspace);
                    }}
                    title={`Create new project in ${workspace.name}`}
                    style={{
                      border: "1px solid var(--line, #cbd5e1)",
                      background: "var(--surface, #ffffff)",
                      color: "var(--green, #167c58)",
                      cursor: "pointer",
                      padding: "2px 5px",
                      borderRadius: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginLeft: 4,
                    }}
                  >
                    <Plus size={11} />
                  </button>
                </summary>

                <div className="hierarchy-projects">
                  <Link
                    className={`hierarchy-workspace-link${
                      workspace.id === currentWorkspaceId && !currentProjectId
                        ? " is-current"
                        : ""
                    }`}
                    href={`/workspaces/${workspace.id}`}
                    prefetch={true}
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
                          prefetch={true}
                          title={project.name}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
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
                          </div>

                          {typeof project.taskCount === "number" && project.taskCount > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--muted, #64748b)",
                                background: "var(--line-light, #f1f5f9)",
                                padding: "1px 6px",
                                borderRadius: 8,
                                border: "1px solid var(--line, #e2e8f0)",
                                flexShrink: 0,
                                marginLeft: 4,
                              }}
                            >
                              {project.taskCount}
                            </span>
                          )}
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

            {/* Quick + New Space button */}
            <button
              type="button"
              onClick={() => setWorkspaceModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 9px",
                margin: "4px 0 0",
                border: "1px dashed var(--line, #cbd5e1)",
                borderRadius: 6,
                background: "transparent",
                color: "var(--green, #167c58)",
                fontSize: 12,
                fontWeight: 650,
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              <Plus size={13} />
              <span>New Space (Workspace)</span>
            </button>
          </nav>

          <div className="hierarchy-sidebar-footer">
            <Link
              href={`/organizations/${organizationId}/calendar`}
              prefetch={true}
            >
              Holidays &amp; leave
            </Link>
          </div>
        </aside>
      </div>

      {/* ======================================================== */}
      {/* MODAL: CREATE NEW SPACE (WORKSPACE)                      */}
      {/* ======================================================== */}
      {workspaceModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setWorkspaceModalOpen(false)}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--line, #cbd5e1)",
              borderRadius: 12,
              padding: "20px 24px",
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              color: "var(--ink, #0f172a)",
              display: "grid",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderKanban size={18} color="var(--green, #167c58)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>Create New Space</h3>
              </div>
              <button
                type="button"
                onClick={() => setWorkspaceModalOpen(false)}
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted, #64748b)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: "var(--muted, #64748b)" }}>
              Spaces organize your teams, projects, documents, and timesheets within <strong>{organizationName}</strong>.
            </p>

            <form action={createWorkspace} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="organizationId" value={organizationId} />

              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 650 }}>
                Space Name
                <input
                  name="name"
                  type="text"
                  placeholder="e.g. Engineering, Marketing, Client Operations"
                  required
                  autoFocus
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #cbd5e1)",
                    fontSize: 13,
                    outline: "none",
                    background: "var(--surface-raised, #ffffff)",
                    color: "var(--ink, #0f172a)",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 650 }}>
                Description (optional)
                <input
                  name="description"
                  type="text"
                  placeholder="Brief description of this space"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #cbd5e1)",
                    fontSize: 13,
                    outline: "none",
                    background: "var(--surface-raised, #ffffff)",
                    color: "var(--ink, #0f172a)",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setWorkspaceModalOpen(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #cbd5e1)",
                    background: "transparent",
                    color: "var(--ink, #0f172a)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: 0,
                    background: "var(--green, #167c58)",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE NEW PROJECT IN WORKSPACE                   */}
      {/* ======================================================== */}
      {projectModalTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setProjectModalTarget(null)}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--line, #cbd5e1)",
              borderRadius: 12,
              padding: "20px 24px",
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              color: "var(--ink, #0f172a)",
              display: "grid",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderPlus size={18} color="var(--green, #167c58)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>
                  Create Project in {projectModalTarget.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProjectModalTarget(null)}
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted, #64748b)" }}
              >
                <X size={16} />
              </button>
            </div>

            <form action={createProject} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="workspaceId" value={projectModalTarget.id} />
              <input type="hidden" name="icon" value={selectedEmoji} />

              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 650 }}>
                Project Name
                <div style={{ display: "flex", gap: 6 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      background: "var(--line-light, #f8fafc)",
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {selectedEmoji}
                  </span>
                  <input
                    name="name"
                    type="text"
                    placeholder="e.g. Sprint 02, Q4 Roadmap, Client Portal"
                    required
                    autoFocus
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 13,
                      outline: "none",
                      background: "var(--surface-raised, #ffffff)",
                      color: "var(--ink, #0f172a)",
                      flex: 1,
                    }}
                  />
                </div>
              </label>

              {/* Icon Choice Strip */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "2px 0" }}>
                {["📁", "🚀", "⚡", "🎯", "📊", "🛠️", "💻", "💡", "🌟", "📦", "🎨", "🤖"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    style={{
                      border: selectedEmoji === emoji ? "1.5px solid var(--green, #167c58)" : "1px solid var(--line, #cbd5e1)",
                      background: selectedEmoji === emoji ? "color-mix(in srgb, var(--green, #167c58) 12%, var(--surface))" : "var(--surface)",
                      borderRadius: 6,
                      width: 28,
                      height: 28,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 650 }}>
                Description (optional)
                <input
                  name="description"
                  type="text"
                  placeholder="Project purpose and scope"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #cbd5e1)",
                    fontSize: 13,
                    outline: "none",
                    background: "var(--surface-raised, #ffffff)",
                    color: "var(--ink, #0f172a)",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setProjectModalTarget(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #cbd5e1)",
                    background: "transparent",
                    color: "var(--ink, #0f172a)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: 0,
                    background: "var(--green, #167c58)",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
