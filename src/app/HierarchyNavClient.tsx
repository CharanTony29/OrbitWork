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
  Edit3,
  Inbox,
  CornerUpLeft,
  Megaphone,
  Heart,
  CheckSquare,
  MoreHorizontal,
  Sparkles,
  Lock,
  GitBranch,
  ChevronRight,
  Circle,
  FileCode2,
  Orbit,
  FlaskConical,
  Download,
  UserPlus,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import ProjectSublinks from "./ProjectSublinks";
import { NavRailDynamicItems, type RailNavItem } from "./NavRailOverflowMenu";
import UniversalCreateModal from "./UniversalCreateModal";

type MemberItem = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

type Props = {
  organizationId: string;
  organizationName: string;
  currentWorkspaceId: string;
  currentProjectId?: string;
  workspaces: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    workspace_id: string;
    icon?: string | null;
    taskCount?: number;
  }>;
  members?: MemberItem[];
};

const STORAGE_KEY = "orbitwork:sidebar-collapsed";
const POPULAR_PROJECT_ICONS = ["📁", "🚀", "⚡", "🎯", "📊", "🛠️", "💻", "💡", "🔥", "🌟", "📦", "🎨", "🌐", "🔒", "🤖", "📈", "🧪", "📑"];

function getAvatarColor(name: string) {
  const colors = ["#f97316", "#06b6d4", "#8b5cf6", "#ec4899", "#10b981", "#3b82f6", "#eab308"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function HierarchyNavClient({
  organizationId,
  organizationName,
  currentWorkspaceId,
  currentProjectId,
  workspaces,
  projects,
  members = [],
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [customIcons, setCustomIcons] = useState<Record<string, string>>({});
  const [editingIconProjectId, setEditingIconProjectId] = useState<string | null>(null);
  const [isUniversalCreateOpen, setIsUniversalCreateOpen] = useState(false);
  const [showMoreQuickHub, setShowMoreQuickHub] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(true);
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
      key: "spaces",
      label: "Spaces",
      title: "Workspaces & Projects",
      href: `/workspaces/${currentWorkspaceId}`,
      icon: <Orbit size={18} />,
      isActive: pathname.startsWith("/workspaces"),
    },
    {
      key: "planner",
      label: "Planner",
      title: "Planner & Meeting Rooms",
      href: organizationId ? `/planner?org=${organizationId}` : "/planner",
      icon: <CalendarDays size={18} />,
      isActive: pathname.startsWith("/planner"),
    },
    {
      key: "docs",
      label: "Docs",
      title: "Docs & Attachments",
      href: currentProjectId
        ? `/projects/${currentProjectId}/documents`
        : `/organizations/${organizationId}/docs`,
      icon: <FileText size={18} />,
      isActive: pathname.includes("/docs") || pathname.includes("/documents"),
    },
    {
      key: "dashboard",
      label: "Dashboard",
      title: "My Dashboard & Metrics",
      href: "/my-dashboard",
      icon: <LayoutDashboard size={18} />,
      isActive: pathname === "/my-dashboard",
    },
    {
      key: "time",
      label: "Timesheet",
      title: "Workspace Timesheets",
      href: `/workspaces/${currentWorkspaceId}/timesheets`,
      icon: <Clock3 size={18} />,
      isActive: pathname.includes("/timesheets"),
    },
    {
      key: "chat",
      label: "Chat",
      title: "Team & Personal Chat",
      href: "/chat",
      icon: <MessageSquare size={18} />,
      isActive: pathname.startsWith("/chat"),
    },
    {
      key: "people",
      label: "People",
      title: "Members Directory",
      href: `/organizations/${organizationId}/members`,
      icon: <UsersRound size={18} />,
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
        {/* Compact Icon Rail (Dark Obsidian) */}
        <nav ref={railRef} className="work-icon-rail" aria-label="Main navigation">
          {/* Top Logo with Notification Badge */}
          <Link
            className="work-rail-logo"
            href="/dashboard"
            prefetch={false}
            aria-label="Orbitwork home"
            style={{ position: "relative" }}
          >
            <BrandMark className="brand-mark" size={26} />
            <span
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#f43f5e",
                color: "#ffffff",
                fontSize: 9,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #111317",
              }}
            >
              1
            </span>
          </Link>

          {/* Toggle button on rail to expand sidebar when collapsed on desktop */}
          <button
            type="button"
            className="work-rail-toggle-btn"
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          <NavRailDynamicItems
            railRef={railRef}
            items={railNavItems}
            moreHref={`/organizations/${organizationId}/calendar`}
            moreTitle="Holidays & Leave"
            moreIsActive={pathname.includes("/calendar")}
            moreIcon={<Layers3 size={17} />}
          />

          {/* Bottom Utility Rail Items */}
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              paddingBottom: 8,
            }}
          >
            <Link
              href="/ai/agents"
              title="Labs / AI Studio"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#a855f7",
                fontSize: 8,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              <FlaskConical size={16} />
              <span>Labs</span>
            </Link>
            <Link
              href={`/organizations/${organizationId}/members`}
              title="Invite Members"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: 8,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              <UserPlus size={16} />
              <span>Invite</span>
            </Link>
          </div>
        </nav>

        {/* Tree Sidebar (Dark Obsidian Drawer) */}
        <aside
          className="hierarchy-sidebar"
          aria-label="Workspace navigation"
          aria-hidden={isCollapsed}
        >
          {/* Top Header: Title + Create [ + v ] Button */}
          <div className="hierarchy-sidebar-heading">
            <div className="hierarchy-sidebar-heading-text">
              <strong style={{ fontSize: 15, fontWeight: 750, color: "#ffffff" }}>
                Home
              </strong>
            </div>
            <div className="hierarchy-sidebar-actions" style={{ gap: 6 }}>
              {/* Quick Create [ + v ] button */}
              <button
                type="button"
                onClick={() => setIsUniversalCreateOpen(true)}
                title="Create Task or Document"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid #2d333b",
                  background: "#1c2128",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Plus size={13} />
                <ChevronDown size={11} style={{ opacity: 0.7 }} />
              </button>

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

          {/* Quick Hub Section */}
          <div className="hierarchy-quick-hub" style={{ display: "grid", gap: 1, padding: "8px 0" }}>
            <button
              type="button"
              className="hierarchy-item-btn"
              onClick={() => setIsUniversalCreateOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 10px",
                borderRadius: 7,
                border: 0,
                background: "transparent",
                color: "#e2e8f0",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <Edit3 size={15} style={{ opacity: 0.85 }} />
              <span>New</span>
            </button>

            <Link
              className={`hierarchy-dashboard${pathname.startsWith("/inbox") ? " is-active" : ""}`}
              href="/inbox"
              prefetch={false}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 7,
                color: pathname.startsWith("/inbox") ? "#ffffff" : "#e2e8f0",
                background: pathname.startsWith("/inbox") ? "#22272e" : "transparent",
                fontSize: 12.5,
                fontWeight: 650,
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Inbox size={15} style={{ opacity: 0.85 }} />
                <span>Inbox</span>
              </div>
              <span
                style={{
                  background: "#f43f5e",
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 10,
                }}
              >
                1
              </span>
            </Link>

            <Link
              className="hierarchy-dashboard"
              href="/chat?tab=replies"
              prefetch={false}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 10px",
                borderRadius: 7,
                color: "#94a3b8",
                fontSize: 12.5,
                fontWeight: 550,
                textDecoration: "none",
              }}
            >
              <CornerUpLeft size={15} style={{ opacity: 0.85 }} />
              <span>Replies</span>
            </Link>

            <Link
              className="hierarchy-dashboard"
              href="/chat"
              prefetch={false}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 10px",
                borderRadius: 7,
                color: "#94a3b8",
                fontSize: 12.5,
                fontWeight: 550,
                textDecoration: "none",
              }}
            >
              <Megaphone size={15} style={{ opacity: 0.85 }} />
              <span>Posts</span>
            </Link>

            <Link
              className="hierarchy-dashboard"
              href={currentProjectId ? `/projects/${currentProjectId}/documents` : `/organizations/${organizationId}/docs`}
              prefetch={false}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 10px",
                borderRadius: 7,
                color: "#94a3b8",
                fontSize: 12.5,
                fontWeight: 550,
                textDecoration: "none",
              }}
            >
              <Heart size={15} color="#ec4899" style={{ opacity: 0.9 }} />
              <span>Artifacts</span>
            </Link>

            <Link
              className="hierarchy-dashboard"
              href="/my-dashboard"
              prefetch={false}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 10px",
                borderRadius: 7,
                color: "#94a3b8",
                fontSize: 12.5,
                fontWeight: 550,
                textDecoration: "none",
              }}
            >
              <CheckSquare size={15} style={{ opacity: 0.85 }} />
              <span>My Tasks</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowMoreQuickHub(!showMoreQuickHub)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 10px",
                borderRadius: 7,
                border: 0,
                background: "transparent",
                color: "#64748b",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <MoreHorizontal size={15} />
              <span>{showMoreQuickHub ? "Less" : "More"}</span>
            </button>

            {showMoreQuickHub && (
              <div style={{ paddingLeft: 12, display: "grid", gap: 2 }}>
                <Link
                  className="hierarchy-dashboard"
                  href={`/workspaces/${currentWorkspaceId}/timesheets`}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", color: "#94a3b8", fontSize: 12, textDecoration: "none" }}
                >
                  <Clock3 size={14} /> Timesheets
                </Link>
                <Link
                  className="hierarchy-dashboard"
                  href={`/organizations/${organizationId}/calendar`}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", color: "#94a3b8", fontSize: 12, textDecoration: "none" }}
                >
                  <CalendarDays size={14} /> Holidays &amp; Leaves
                </Link>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "#22262e", margin: "6px 0" }} />

          {/* Favorites Section */}
          <div style={{ padding: "4px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", padding: "4px 10px", letterSpacing: 0.3 }}>
              Favorites
            </div>
            <Link
              href={currentProjectId ? `/projects/${currentProjectId}/documents` : `/organizations/${organizationId}/docs`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                borderRadius: 6,
                color: "#cbd5e1",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              <FileText size={14} color="#38bdf8" />
              <span>KB Document</span>
            </Link>
            <Link
              href={currentProjectId ? `/projects/${currentProjectId}/documents` : `/organizations/${organizationId}/docs`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                borderRadius: 6,
                color: "#cbd5e1",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              <FileText size={14} color="#38bdf8" />
              <span>Learnings</span>
            </Link>
          </div>

          <div style={{ height: 1, background: "#22262e", margin: "6px 0" }} />

          {/* Agents Section */}
          <div style={{ padding: "4px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", padding: "4px 10px", letterSpacing: 0.3 }}>
              Agents
            </div>
            <Link
              href={currentProjectId ? `/projects/${currentProjectId}?view=brain` : `/dashboard`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 12,
                fontWeight: 650,
                textDecoration: "none",
                background: pathname.includes("view=brain") ? "#22272e" : "transparent",
              }}
            >
              <span style={{ fontSize: 14 }}>🌸</span>
              <span>Brain</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("orbitwork:open-ai-chat"));
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                border: 0,
                background: "transparent",
                color: "#64748b",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              <Plus size={14} />
              <span>New Super Agent</span>
            </button>
          </div>

          <div style={{ height: 1, background: "#22262e", margin: "6px 0" }} />

          {/* Spaces Section */}
          <div style={{ padding: "4px 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 10px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.3 }}>
                Spaces
              </span>
              <button
                type="button"
                onClick={() => setIsUniversalCreateOpen(true)}
                title="Create Space"
                style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer", padding: 2 }}
              >
                <Plus size={13} />
              </button>
            </div>

            {/* All Tasks Link */}
            <Link
              href="/dashboard"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                color: "#cbd5e1",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 12, opacity: 0.8 }}>✳️</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                All Tasks - {organizationName}
              </span>
            </Link>

            {/* Workspaces & Projects Tree */}
            <nav className="hierarchy-tree" aria-label="Organization workspaces and projects">
              {workspaces.map((workspace) => (
                <details
                  key={workspace.id}
                  open={workspace.id === currentWorkspaceId}
                  style={{ marginTop: 2 }}
                >
                  <summary
                    style={{
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: 6,
                      color: "#e2e8f0",
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          background: "#2563eb",
                          color: "#ffffff",
                          fontSize: 10,
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {workspace.name.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {workspace.name}
                      </span>
                      <Lock size={11} color="#64748b" style={{ flexShrink: 0 }} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsUniversalCreateOpen(true);
                      }}
                      style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer", padding: 2 }}
                    >
                      <Plus size={12} />
                    </button>
                  </summary>

                  <div className="hierarchy-projects" style={{ paddingLeft: 14, margin: "2px 0 6px 6px", borderLeft: "1px solid #2d333b" }}>
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
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "5px 8px",
                              borderRadius: 6,
                              color: project.id === currentProjectId ? "#ffffff" : "#cbd5e1",
                              background: project.id === currentProjectId ? "#22272e" : "transparent",
                              fontSize: 12,
                              fontWeight: project.id === currentProjectId ? 700 : 500,
                              textDecoration: "none",
                              margin: "1px 0",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>
                                {customIcons[project.id] || project.icon || "🔀"}
                              </span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {project.name}
                              </span>
                            </div>
                            {typeof project.taskCount === "number" && project.taskCount > 0 && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "#94a3b8",
                                  background: "#1c2128",
                                  padding: "1px 6px",
                                  borderRadius: 8,
                                  border: "1px solid #2d333b",
                                  flexShrink: 0,
                                }}
                              >
                                {project.taskCount}
                              </span>
                            )}
                          </Link>

                          {project.id === currentProjectId && (
                            <ProjectSublinks projectId={project.id} />
                          )}
                        </div>
                      ))}
                  </div>
                </details>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setIsUniversalCreateOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                border: 0,
                background: "transparent",
                color: "#64748b",
                fontSize: 12,
                cursor: "pointer",
                width: "100%",
                marginTop: 2,
              }}
            >
              <Plus size={14} />
              <span>New Space</span>
            </button>
          </div>

          <div style={{ height: 1, background: "#22262e", margin: "6px 0" }} />

          {/* Channels Section */}
          <div style={{ padding: "4px 0" }}>
            <Link
              href="/chat"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 10px",
                color: "#64748b",
                fontSize: 11,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <span>Channels</span>
              <ChevronRight size={12} />
            </Link>
          </div>

          <div style={{ height: 1, background: "#22262e", margin: "6px 0" }} />

          {/* Direct Messages Section */}
          <div style={{ padding: "4px 0", marginTop: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", padding: "4px 10px", letterSpacing: 0.3 }}>
              Direct Messages
            </div>
            <div style={{ display: "grid", gap: 2, marginTop: 2 }}>
              {members.length ? (
                members.map((member) => (
                  <Link
                    key={member.id}
                    href={`/chat?user=${member.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 10px",
                      borderRadius: 6,
                      color: "#cbd5e1",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#20242c")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      style={{
                        position: "relative",
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: getAvatarColor(member.name),
                        color: "#ffffff",
                        fontSize: 9.5,
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        (member.name.charAt(0) || "?").toUpperCase()
                      )}
                      <span
                        style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#10b981",
                          border: "1.5px solid #16181d",
                        }}
                      />
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {member.name}
                    </span>
                  </Link>
                ))
              ) : (
                <div style={{ fontSize: 11, color: "#64748b", padding: "4px 10px" }}>
                  No members yet.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Universal Create Modal Triggered from Nav Drawer */}
      <UniversalCreateModal
        isOpen={isUniversalCreateOpen}
        onClose={() => setIsUniversalCreateOpen(false)}
        projectId={currentProjectId}
        members={members.map((m) => ({ id: m.id, label: m.name }))}
      />
    </>
  );
}
