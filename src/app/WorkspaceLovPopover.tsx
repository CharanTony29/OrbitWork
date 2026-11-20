"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  FolderKanban,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { SpaceOrganization, SpaceWorkspace, SpaceProject } from "@/lib/workspace-space";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type LovData = {
  organizations: SpaceOrganization[];
  workspaces: SpaceWorkspace[];
  projects: SpaceProject[];
};

let cachedLovData: LovData | null = null;
const LOV_CACHE_KEY = "orbitwork:spaces_lov_cache_v1";

function getInitialLovData(): LovData | null {
  if (cachedLovData) return cachedLovData;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOV_CACHE_KEY);
      if (stored) {
        cachedLovData = JSON.parse(stored);
        return cachedLovData;
      }
    } catch {}
  }
  return null;
}

export function preloadWorkspaceLov() {
  if (typeof window === "undefined" || cachedLovData) return;
  fetch("/api/spaces/lov")
    .then((res) => (res.ok ? res.json() : null))
    .then((resData) => {
      if (resData?.success) {
        const fresh: LovData = {
          organizations: resData.organizations || [],
          workspaces: resData.workspaces || [],
          projects: resData.projects || [],
        };
        cachedLovData = fresh;
        try {
          localStorage.setItem(LOV_CACHE_KEY, JSON.stringify(fresh));
        } catch {}
      }
    })
    .catch(() => {});
}

export default function WorkspaceLovPopover({ isOpen, onClose }: Props) {
  const [data, setData] = useState<LovData | null>(getInitialLovData);
  const [loading, setLoading] = useState<boolean>(() => !getInitialLovData());
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "orgs" | "workspaces" | "projects">("all");
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus input immediately
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    // If no cache at all, show spinner; otherwise show cached data instantly and silently revalidate
    const currentCached = cachedLovData || getInitialLovData();
    if (currentCached && !data) {
      setData(currentCached);
      setLoading(false);
    } else if (!data && !currentCached) {
      setLoading(true);
    }

    // Always revalidate silently in the background so updates appear without blocking user
    fetch("/api/spaces/lov")
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.success) {
          const fresh: LovData = {
            organizations: resData.organizations || [],
            workspaces: resData.workspaces || [],
            projects: resData.projects || [],
          };
          cachedLovData = fresh;
          setData(fresh);
          try {
            localStorage.setItem(LOV_CACHE_KEY, JSON.stringify(fresh));
          } catch {}
        }
      })
      .catch((err) => console.error("Failed to load LOV spaces:", err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const q = query.trim().toLowerCase();

  const filteredOrgs = useMemo(() => {
    if (!data?.organizations) return [];
    if (!q) return data.organizations;
    return data.organizations.filter((org) => org.name.toLowerCase().includes(q));
  }, [data?.organizations, q]);

  const filteredWorkspaces = useMemo(() => {
    if (!data?.workspaces) return [];
    if (!q) return data.workspaces;
    return data.workspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(q) ||
        (ws.description && ws.description.toLowerCase().includes(q))
    );
  }, [data?.workspaces, q]);

  const filteredProjects = useMemo(() => {
    if (!data?.projects) return [];
    if (!q) return data.projects;
    return data.projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [data?.projects, q]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: 64,
        left: 64,
        width: 380,
        maxHeight: "calc(100vh - 84px)",
        background: "var(--surface, #ffffff)",
        color: "var(--ink, #17231f)",
        borderRadius: 14,
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--line, #e2e8f0)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "slideInLeft 0.15s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--line, #e2e8f0)",
          background: "var(--surface-subtle, #f8fafc)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FolderKanban size={16} style={{ color: "var(--green, #167c58)" }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Switch Workspace (LOV)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--muted, #64748b)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Real-time Search Box */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--line, #cbd5e1)",
            background: "var(--surface, #ffffff)",
          }}
        >
          <Search size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organization, workspace, or project…"
            style={{
              border: 0,
              outline: "none",
              fontSize: 12.5,
              width: "100%",
              background: "transparent",
              color: "var(--ink)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
            >
              <X size={13} style={{ color: "var(--muted)" }} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {[
            { id: "all", label: "All" },
            { id: "orgs", label: `Orgs (${filteredOrgs.length})` },
            { id: "workspaces", label: `Workspaces (${filteredWorkspaces.length})` },
            { id: "projects", label: `Projects (${filteredProjects.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id as any)}
              style={{
                fontSize: 10.5,
                fontWeight: 650,
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid",
                borderColor: categoryFilter === tab.id ? "var(--green, #167c58)" : "var(--line, #cbd5e1)",
                background: categoryFilter === tab.id ? "rgba(22, 124, 88, 0.12)" : "transparent",
                color: categoryFilter === tab.id ? "var(--green, #167c58)" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Tree */}
      <div
        style={{
          padding: "10px 12px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 30, gap: 8, color: "var(--muted)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 12 }}>Loading spaces…</span>
          </div>
        ) : null}

        {/* Organizations Section */}
        {(categoryFilter === "all" || categoryFilter === "orgs") && filteredOrgs.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, paddingLeft: 4 }}>
              Organizations ({filteredOrgs.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {filteredOrgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/dashboard?org=${org.id}`}
                  prefetch={true}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "var(--ink)",
                    fontSize: 12,
                    fontWeight: 650,
                    background: "var(--surface-subtle, #f8fafc)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--nav-hover, #eaf4ed)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-subtle, #f8fafc)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Building2 size={14} style={{ color: "var(--green, #167c58)" }} />
                    <span>{org.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--line)", padding: "2px 6px", borderRadius: 4 }}>
                    {org.role || "Member"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Workspaces Section */}
        {(categoryFilter === "all" || categoryFilter === "workspaces") && filteredWorkspaces.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, paddingLeft: 4 }}>
              Workspaces ({filteredWorkspaces.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {filteredWorkspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/workspaces/${ws.id}`}
                  prefetch={true}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "var(--ink)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--nav-hover, #eaf4ed)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FolderKanban size={13} style={{ color: "#3b82f6" }} />
                    <span>{ws.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>
                    {ws.projectCount} proj
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Projects Section */}
        {(categoryFilter === "all" || categoryFilter === "projects") && filteredProjects.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, paddingLeft: 4 }}>
              Projects ({filteredProjects.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {filteredProjects.map((proj) => (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  prefetch={true}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "var(--ink)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--nav-hover, #eaf4ed)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{proj.icon || "📁"}</span>
                    <span>{proj.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      background: proj.status === "active" ? "rgba(22, 124, 88, 0.15)" : "var(--line)",
                      color: proj.status === "active" ? "var(--green, #167c58)" : "var(--muted)",
                    }}
                  >
                    {proj.status || "active"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading &&
          filteredOrgs.length === 0 &&
          filteredWorkspaces.length === 0 &&
          filteredProjects.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
              No matches found for &quot;{query}&quot;
            </div>
          )}
      </div>

      {/* Footer link to Overview */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--line, #e2e8f0)",
          background: "var(--surface-subtle, #f8fafc)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Quick Switcher</span>
        <Link
          href="/dashboard"
          onClick={onClose}
          style={{
            fontSize: 11.5,
            fontWeight: 650,
            color: "var(--green, #167c58)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>All Workspaces &amp; Orgs</span>
          <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
}
