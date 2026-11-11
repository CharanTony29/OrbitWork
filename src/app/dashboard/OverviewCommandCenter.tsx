"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  FolderKanban,
  Layers3,
  LayoutGrid,
  List,
  Loader2,
  PlugZap,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import type {
  SpaceOrganization,
  SpaceProject,
  SpaceWorkspace,
} from "@/lib/workspace-space";
import {
  createOrganization,
  createWorkspace,
  deleteOrganization,
} from "@/app/actions";
import MultiEmailInviteForm from "@/app/MultiEmailInviteForm";

type Props = {
  displayName: string;
  organizations: SpaceOrganization[];
  workspaces: SpaceWorkspace[];
  projects: SpaceProject[];
  organizationMembers: { organization_id: string; user_id: string; role: string }[];
  banner?: ReactNode;
  refreshKey?: string;
};

type ActiveModal =
  | null
  | { type: "create-org" }
  | { type: "create-ws"; orgId: string }
  | { type: "invite"; orgId: string }
  | { type: "delete-org"; orgId: string };

function SubmitActionButton({
  label,
  pendingLabel,
  className,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending && <Loader2 size={14} className="spin" />}
      <span>{pending ? pendingLabel : label}</span>
    </button>
  );
}

function EnterpriseDialog({
  title,
  subtitle,
  onClose,
  danger = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="ov-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`ov-modal${danger ? " is-danger" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ov-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="ov-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="ov-modal-body">{children}</div>
      </div>
    </div>
  );
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeActivity(iso: string | null | undefined): string {
  if (!iso) return "No recent activity";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently active";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

/**
 * Full-page Enterprise Overview at `/dashboard`.
 * Reorganized into crisp balanced tabs and decks with zero empty voids:
 * Organizations, Workspaces + inline Projects, Projects directory, Quick actions,
 * and Organization administration.
 */
export default function OverviewCommandCenter({
  displayName,
  organizations,
  workspaces,
  projects,
  organizationMembers,
  banner,
  refreshKey,
}: Props) {
  const [selectedScope, setSelectedScope] = useState<string>(() =>
    organizations.length > 1 ? "all" : (organizations[0]?.id ?? "")
  );
  const [actionOrgId, setActionOrgId] = useState<string>(() => {
    const preferred =
      organizations.find((o) => ["owner", "admin"].includes(o.role)) ??
      organizations[0];
    return preferred?.id ?? "";
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    setActiveModal(null);
    setDeleteConfirmText("");
  }, [organizations.length, workspaces.length, refreshKey]);

  const orgById = useMemo(
    () => new Map(organizations.map((o) => [o.id, o])),
    [organizations]
  );

  const wsById = useMemo(
    () => new Map(workspaces.map((w) => [w.id, w])),
    [workspaces]
  );

  const projectsByWorkspace = useMemo(() => {
    const map = new Map<string, SpaceProject[]>();
    for (const p of projects) {
      const list = map.get(p.workspace_id);
      if (list) list.push(p);
      else map.set(p.workspace_id, [p]);
    }
    return map;
  }, [projects]);

  const memberCountByOrg = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of organizationMembers) {
      map.set(m.organization_id, (map.get(m.organization_id) ?? 0) + 1);
    }
    return map;
  }, [organizationMembers]);

  const uniqueMemberCount = useMemo(
    () => new Set(organizationMembers.map((m) => m.user_id)).size,
    [organizationMembers]
  );

  const isAllScope = organizations.length > 1 && selectedScope === "all";

  const activeOrg = useMemo(() => {
    if (isAllScope) return null;
    return (
      organizations.find((o) => o.id === selectedScope) ??
      organizations[0] ??
      null
    );
  }, [organizations, selectedScope, isAllScope]);

  const targetActionOrg = useMemo(() => {
    if (activeOrg) return activeOrg;
    return (
      organizations.find((o) => o.id === actionOrgId) ??
      organizations.find((o) => ["owner", "admin"].includes(o.role)) ??
      organizations[0] ??
      null
    );
  }, [activeOrg, organizations, actionOrgId]);

  const modalOrg = useMemo(() => {
    if (activeModal && "orgId" in activeModal) {
      return organizations.find((o) => o.id === activeModal.orgId) ?? targetActionOrg;
    }
    return targetActionOrg;
  }, [activeModal, organizations, targetActionOrg]);

  const scopedWorkspaces = useMemo(() => {
    if (isAllScope) return workspaces;
    if (!activeOrg) return [];
    return workspaces.filter((ws) => ws.organization_id === activeOrg.id);
  }, [isAllScope, activeOrg, workspaces]);

  const filteredWorkspaces = useMemo(() => {
    const q = workspaceQuery.trim().toLowerCase();
    if (!q) return scopedWorkspaces;
    return scopedWorkspaces.filter((ws) => {
      const orgName = orgById.get(ws.organization_id)?.name ?? "";
      return (
        ws.name.toLowerCase().includes(q) ||
        (ws.description ?? "").toLowerCase().includes(q) ||
        ws.ownerLabel.toLowerCase().includes(q) ||
        orgName.toLowerCase().includes(q)
      );
    });
  }, [scopedWorkspaces, workspaceQuery, orgById]);

  const scopedProjects = useMemo(() => {
    const wsIds = new Set(scopedWorkspaces.map((w) => w.id));
    return projects.filter((p) => wsIds.has(p.workspace_id));
  }, [scopedWorkspaces, projects]);

  const targetActionOrgWorkspaces = useMemo(
    () =>
      targetActionOrg
        ? workspaces.filter((ws) => ws.organization_id === targetActionOrg.id)
        : [],
    [targetActionOrg, workspaces]
  );

  const targetOrgMemberCount = targetActionOrg
    ? (memberCountByOrg.get(targetActionOrg.id) ?? 0)
    : 0;

  const canAdminTarget =
    targetActionOrg !== null &&
    ["owner", "admin"].includes(targetActionOrg.role);
  const isOwnerTarget = targetActionOrg?.role === "owner";

  const effectiveSelectedWsId = scopedWorkspaces.some(
    (w) => w.id === selectedWorkspaceId
  )
    ? selectedWorkspaceId
    : (scopedWorkspaces[0]?.id ?? "");

  const closeModal = () => {
    setActiveModal(null);
    setDeleteConfirmText("");
  };

  return (
    <div className="ov-command-wrap ov-full-wrap">
      {/* Compact Header */}
      <header className="ov-page-header">
        <div className="ov-page-header-copy">
          <span className="ov-eyebrow">OVERVIEW</span>
          <h1>Good to have you here, {displayName}.</h1>
          <p>
            {organizations.length}{" "}
            {organizations.length === 1 ? "organization" : "organizations"} ·{" "}
            {workspaces.length}{" "}
            {workspaces.length === 1 ? "workspace" : "workspaces"} ·{" "}
            {projects.length} {projects.length === 1 ? "project" : "projects"} ·{" "}
            {uniqueMemberCount}{" "}
            {uniqueMemberCount === 1 ? "member" : "members"} across your space.
          </p>
        </div>
        <div className="ov-header-actions">
          <button
            type="button"
            className="ov-btn ov-btn-secondary"
            onClick={() => setActiveModal({ type: "create-org" })}
          >
            <Building2 size={15} />
            <span>New organization</span>
          </button>
          <button
            type="button"
            className="ov-btn ov-btn-primary"
            disabled={!targetActionOrg}
            onClick={() =>
              targetActionOrg &&
              setActiveModal({ type: "create-ws", orgId: targetActionOrg.id })
            }
          >
            <Plus size={15} />
            <span>Create workspace</span>
          </button>
        </div>
      </header>

      {banner}

      {/* Reorganized Scope Tabs */}
      {organizations.length > 0 && (
        <div
          className="ov-org-switcher"
          role="tablist"
          aria-label="Organizations scope"
        >
          {organizations.length > 1 && (
            <button
              type="button"
              role="tab"
              aria-selected={isAllScope}
              className={`ov-org-tab${isAllScope ? " is-active" : ""}`}
              onClick={() => {
                setSelectedScope("all");
                setWorkspaceQuery("");
              }}
            >
              <Layers3 size={14} />
              <span className="ov-org-tab-name">All organizations</span>
              <span className="ov-org-tab-count">{workspaces.length}</span>
            </button>
          )}
          {organizations.map((org) => {
            const count = workspaces.filter(
              (w) => w.organization_id === org.id
            ).length;
            const isSelected = !isAllScope && activeOrg?.id === org.id;
            return (
              <button
                key={org.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`ov-org-tab${isSelected ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedScope(org.id);
                  setActionOrgId(org.id);
                  setWorkspaceQuery("");
                }}
              >
                <Building2 size={14} />
                <span className="ov-org-tab-name">{org.name}</span>
                <span className="ov-org-tab-role">{org.role}</span>
                <span className="ov-org-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {organizations.length === 0 ? (
        <section className="ov-empty-state">
          <div className="ov-empty-icon">
            <Building2 size={22} />
          </div>
          <h2>Create your first organization</h2>
          <p>
            Organizations group your team members, workspaces, projects, and
            administrative policies in one structured environment.
          </p>
          <button
            type="button"
            className="ov-btn ov-btn-primary"
            onClick={() => setActiveModal({ type: "create-org" })}
          >
            <Plus size={15} />
            <span>New organization</span>
          </button>
        </section>
      ) : (
        <>
          {/* Summary Deck: Portfolio across all orgs OR Single Organization Strip */}
          {isAllScope ? (
            <section
              className="ov-orgs-deck"
              aria-label="Organizations directory"
            >
              {organizations.map((org) => {
                const orgWsCount = workspaces.filter(
                  (w) => w.organization_id === org.id
                ).length;
                const orgProjCount = projects.filter((p) => {
                  const w = wsById.get(p.workspace_id);
                  return w?.organization_id === org.id;
                }).length;
                const orgMembersCount = memberCountByOrg.get(org.id) ?? 0;
                return (
                  <article key={org.id} className="ov-org-tile">
                    <div className="ov-org-tile-top">
                      <div className="ov-org-identity">
                        <div className="ov-org-badge-icon is-compact">
                          <Building2 size={16} />
                        </div>
                        <div className="ov-org-identity-text">
                          <div className="ov-org-name-row">
                            <h2>{org.name}</h2>
                            <span className="ov-role-tag">{org.role}</span>
                          </div>
                          <span className="ov-org-sub">
                            Owner: {org.ownerLabel} ·{" "}
                            {formatShortDate(org.created_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ov-btn ov-btn-ghost is-xs"
                        onClick={() => {
                          setSelectedScope(org.id);
                          setActionOrgId(org.id);
                          setWorkspaceQuery("");
                        }}
                      >
                        <span>Filter</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                    <div className="ov-org-tile-meta">
                      <Link href={`/organizations/${org.id}/workspaces`}>
                        <Layers3 size={13} />
                        <strong>{orgWsCount}</strong>{" "}
                        {orgWsCount === 1 ? "workspace" : "workspaces"}
                      </Link>
                      <Link href={`/organizations/${org.id}/members`}>
                        <UsersRound size={13} />
                        <strong>{orgMembersCount}</strong>{" "}
                        {orgMembersCount === 1 ? "member" : "members"}
                      </Link>
                      <span>
                        <FolderKanban size={13} />
                        <strong>{orgProjCount}</strong>{" "}
                        {orgProjCount === 1 ? "project" : "projects"}
                      </span>
                    </div>
                    <div className="ov-org-tile-links">
                      <Link href={`/organizations/${org.id}/members`}>
                        Members
                      </Link>
                      <Link href={`/organizations/${org.id}/calendar`}>
                        Holidays
                      </Link>
                      <Link href={`/organizations/${org.id}/integrations`}>
                        Integrations
                      </Link>
                      <Link href={`/organizations/${org.id}/docs`}>Docs</Link>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            activeOrg && (
              <section
                className="ov-org-summary"
                aria-label={`${activeOrg.name} summary`}
              >
                <div className="ov-org-identity">
                  <div className="ov-org-badge-icon">
                    <Building2 size={18} />
                  </div>
                  <div className="ov-org-identity-text">
                    <div className="ov-org-name-row">
                      <h2>{activeOrg.name}</h2>
                      <span className="ov-role-tag">{activeOrg.role}</span>
                    </div>
                    <span className="ov-org-sub">
                      Owned by {activeOrg.ownerLabel} · Created{" "}
                      {formatShortDate(activeOrg.created_at)}
                    </span>
                  </div>
                </div>

                <div className="ov-org-metrics-strip">
                  <Link
                    href={`/organizations/${activeOrg.id}/workspaces`}
                    className="ov-metric-cell is-link"
                  >
                    <span className="ov-metric-label">Workspaces</span>
                    <strong className="ov-metric-val">
                      <Layers3 size={14} />
                      {scopedWorkspaces.length}
                    </strong>
                  </Link>
                  <Link
                    href={`/organizations/${activeOrg.id}/members`}
                    className="ov-metric-cell is-link"
                  >
                    <span className="ov-metric-label">Members</span>
                    <strong className="ov-metric-val">
                      <UsersRound size={14} />
                      {memberCountByOrg.get(activeOrg.id) ?? 0}
                    </strong>
                  </Link>
                  <div className="ov-metric-cell">
                    <span className="ov-metric-label">Projects</span>
                    <strong className="ov-metric-val">
                      <FolderKanban size={14} />
                      {scopedProjects.length}
                    </strong>
                  </div>
                </div>

                <div className="ov-org-strip-actions">
                  <Link
                    href={`/organizations/${activeOrg.id}/workspaces`}
                    className="ov-btn ov-btn-ghost"
                  >
                    <span>All workspaces</span>
                    <ArrowUpRight size={14} />
                  </Link>
                  <Link
                    href={`/organizations/${activeOrg.id}/members`}
                    className="ov-btn ov-btn-ghost"
                  >
                    <span>Members</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </section>
            )
          )}

          {/* Balanced Two-Column Deck Layout */}
          <div className="ov-main-grid">
            {/* Left Main Column: Workspaces + Projects Deck */}
            <div className="ov-primary-column">
              <section
                className="ov-workspaces-section"
                aria-labelledby="ov-workspaces-title"
              >
                <header className="ov-section-head">
                  <div>
                    <div className="ov-section-title-row">
                      <h2 id="ov-workspaces-title">
                        {isAllScope ? "All workspaces" : "Your workspaces"}
                      </h2>
                      <span className="ov-count-badge">
                        {scopedWorkspaces.length}
                      </span>
                    </div>
                    <p>
                      {isAllScope
                        ? "Jump directly into any workspace, timesheet, or active project across your organizations."
                        : `Manage projects, tasks, and team activity across ${activeOrg?.name ?? "your"} workspaces.`}
                    </p>
                  </div>

                  <div className="ov-section-controls">
                    <div className="ov-search-input-wrap">
                      <Search size={14} className="ov-search-icon" />
                      <input
                        type="search"
                        value={workspaceQuery}
                        onChange={(e) => setWorkspaceQuery(e.target.value)}
                        placeholder="Filter workspaces..."
                        aria-label="Filter workspaces"
                      />
                    </div>
                    <div
                      className="ov-view-toggle"
                      role="group"
                      aria-label="Workspace view mode"
                    >
                      <button
                        type="button"
                        className={viewMode === "cards" ? "is-active" : ""}
                        onClick={() => setViewMode("cards")}
                        aria-pressed={viewMode === "cards"}
                        title="Card grid view"
                      >
                        <LayoutGrid size={14} />
                      </button>
                      <button
                        type="button"
                        className={viewMode === "table" ? "is-active" : ""}
                        onClick={() => setViewMode("table")}
                        aria-pressed={viewMode === "table"}
                        title="Compact table view"
                      >
                        <List size={14} />
                      </button>
                    </div>
                  </div>
                </header>

                {scopedWorkspaces.length === 0 ? (
                  <div className="ov-empty-box">
                    <FolderKanban size={20} className="ov-empty-box-icon" />
                    <h3>
                      No workspaces in {activeOrg?.name ?? "this organization"}{" "}
                      yet
                    </h3>
                    <p>
                      Create your first workspace to organize projects, tasks,
                      documents, and schedules.
                    </p>
                    {targetActionOrg && (
                      <button
                        type="button"
                        className="ov-btn ov-btn-primary"
                        onClick={() =>
                          setActiveModal({
                            type: "create-ws",
                            orgId: targetActionOrg.id,
                          })
                        }
                      >
                        <Plus size={15} />
                        <span>Create workspace</span>
                      </button>
                    )}
                  </div>
                ) : filteredWorkspaces.length === 0 ? (
                  <div className="ov-empty-box">
                    <Search size={20} className="ov-empty-box-icon" />
                    <h3>No matching workspaces</h3>
                    <p>
                      No workspaces matched &ldquo;{workspaceQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      className="ov-btn ov-btn-secondary"
                      onClick={() => setWorkspaceQuery("")}
                    >
                      Clear filter
                    </button>
                  </div>
                ) : viewMode === "cards" ? (
                  <div
                    className={`ov-workspace-grid${
                      filteredWorkspaces.length === 1 ? " is-single" : ""
                    }`}
                  >
                    {filteredWorkspaces.map((ws) => {
                      const isSelected = effectiveSelectedWsId === ws.id;
                      const statusLabel = ws.archived_at ? "Archived" : "Active";
                      const wsProjects = projectsByWorkspace.get(ws.id) ?? [];
                      const parentOrg = orgById.get(ws.organization_id);
                      const isSingleHero = filteredWorkspaces.length === 1;
                      return (
                        <article
                          key={ws.id}
                          className={`ov-ws-card${isSelected ? " is-selected" : ""}${
                            isSingleHero ? " is-single-hero" : ""
                          }`}
                          onClick={() => {
                            setSelectedWorkspaceId(ws.id);
                            setActionOrgId(ws.organization_id);
                          }}
                        >
                          <div className="ov-ws-card-main">
                            <div className="ov-ws-card-top">
                              <div className="ov-ws-title-group">
                                <span
                                  className={`ov-ws-dot${
                                    ws.archived_at ? " is-archived" : ""
                                  }`}
                                  aria-hidden="true"
                                />
                                <Link
                                  href={`/workspaces/${ws.id}`}
                                  className="ov-ws-name"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {ws.name}
                                </Link>
                                {isAllScope && parentOrg && (
                                  <span className="ov-ws-org-pill">
                                    {parentOrg.name}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`ov-status-pill${
                                  ws.archived_at ? " is-archived" : " is-active"
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>

                            <p className="ov-ws-desc">
                              {ws.description?.trim() ||
                                "Shared team workspace for coordinating project delivery and milestones."}
                            </p>

                            <div className="ov-ws-stats">
                              <span title="Projects">
                                <FolderKanban size={13} />
                                <strong>{ws.projectCount}</strong>{" "}
                                {ws.projectCount === 1 ? "project" : "projects"}
                              </span>
                              <span title="Active members">
                                <UsersRound size={13} />
                                <strong>{ws.memberCount}</strong>{" "}
                                {ws.memberCount === 1 ? "member" : "members"}
                              </span>
                              <span
                                className="ov-ws-owner"
                                title={`Owner: ${ws.ownerLabel}`}
                              >
                                Owner: <strong>{ws.ownerLabel}</strong>
                              </span>
                            </div>

                            {!isSingleHero && wsProjects.length > 0 && (
                              <div className="ov-ws-project-chips">
                                {wsProjects.slice(0, 3).map((proj) => (
                                  <Link
                                    key={proj.id}
                                    href={`/projects/${proj.id}`}
                                    className="ov-ws-proj-chip"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span
                                      className={`ov-proj-status status-${
                                        proj.status || "active"
                                      }`}
                                    />
                                    <span>{proj.name}</span>
                                  </Link>
                                ))}
                                {wsProjects.length > 3 && (
                                  <Link
                                    href={`/workspaces/${ws.id}`}
                                    className="ov-ws-proj-more"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    +{wsProjects.length - 3} more
                                  </Link>
                                )}
                              </div>
                            )}

                            <footer className="ov-ws-card-foot">
                              <span
                                className="ov-ws-activity"
                                title={ws.lastActivitySummary ?? undefined}
                              >
                                <Activity size={12} />
                                <span>
                                  {formatRelativeActivity(ws.lastActivityAt)}
                                  {ws.lastActivitySummary
                                    ? ` · ${ws.lastActivitySummary}`
                                    : ""}
                                </span>
                              </span>
                              <div className="ov-ws-foot-actions">
                                <Link
                                  href={`/workspaces/${ws.id}/timesheets`}
                                  className="ov-ws-icon-link"
                                  title="Workspace timesheets"
                                  aria-label={`${ws.name} timesheets`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Clock3 size={13} />
                                </Link>
                                <Link
                                  href={`/workspaces/${ws.id}`}
                                  className="ov-open-ws-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>Open workspace</span>
                                  <ArrowRight size={13} />
                                </Link>
                              </div>
                            </footer>
                          </div>

                          {isSingleHero && (
                            <div
                              className="ov-ws-single-projects"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="ov-ws-single-proj-head">
                                <span>
                                  PROJECTS IN {ws.name.toUpperCase()}
                                </span>
                                <span className="ov-count-badge">
                                  {wsProjects.length}
                                </span>
                              </div>
                              {wsProjects.length === 0 ? (
                                <div className="ov-ws-single-proj-empty">
                                  <p>No projects created yet.</p>
                                  <Link
                                    href={`/workspaces/${ws.id}`}
                                    className="ov-open-ws-link"
                                  >
                                    <span>Add project</span>
                                    <ArrowRight size={13} />
                                  </Link>
                                </div>
                              ) : (
                                <div className="ov-ws-single-proj-list">
                                  {wsProjects.slice(0, 5).map((proj) => (
                                    <Link
                                      key={proj.id}
                                      href={`/projects/${proj.id}`}
                                      className="ov-ws-single-proj-row"
                                    >
                                      <span
                                        className={`ov-proj-status status-${
                                          proj.status || "active"
                                        }`}
                                      />
                                      <span className="ov-ws-single-proj-name">
                                        {proj.name}
                                      </span>
                                      <span className="ov-proj-status-text">
                                        {(proj.status || "active").replace(
                                          "_",
                                          " "
                                        )}
                                      </span>
                                      <ArrowRight size={12} />
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ov-ws-table-wrap">
                    <table className="ov-ws-table">
                      <thead>
                        <tr>
                          <th>Workspace</th>
                          {isAllScope && <th>Organization</th>}
                          <th>Owner</th>
                          <th>Status</th>
                          <th>Projects</th>
                          <th>Members</th>
                          <th>Recent activity</th>
                          <th className="is-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkspaces.map((ws) => {
                          const isSelected = effectiveSelectedWsId === ws.id;
                          const parentOrg = orgById.get(ws.organization_id);
                          return (
                            <tr
                              key={ws.id}
                              className={isSelected ? "is-selected" : undefined}
                              onClick={() => {
                                setSelectedWorkspaceId(ws.id);
                                setActionOrgId(ws.organization_id);
                              }}
                            >
                              <td>
                                <div className="ov-table-ws-cell">
                                  <span
                                    className={`ov-ws-dot${
                                      ws.archived_at ? " is-archived" : ""
                                    }`}
                                  />
                                  <div>
                                    <Link
                                      href={`/workspaces/${ws.id}`}
                                      className="ov-table-ws-name"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {ws.name}
                                    </Link>
                                    {ws.description && (
                                      <span className="ov-table-ws-desc">
                                        {ws.description}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {isAllScope && (
                                <td className="ov-table-muted">
                                  {parentOrg?.name ?? "—"}
                                </td>
                              )}
                              <td className="ov-table-muted">{ws.ownerLabel}</td>
                              <td>
                                <span
                                  className={`ov-status-pill${
                                    ws.archived_at
                                      ? " is-archived"
                                      : " is-active"
                                  }`}
                                >
                                  {ws.archived_at ? "Archived" : "Active"}
                                </span>
                              </td>
                              <td>{ws.projectCount}</td>
                              <td>{ws.memberCount}</td>
                              <td className="ov-table-muted">
                                {formatRelativeActivity(ws.lastActivityAt)}
                              </td>
                              <td className="is-right">
                                <Link
                                  href={`/workspaces/${ws.id}`}
                                  className="ov-open-ws-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>Open</span>
                                  <ArrowRight size={13} />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Projects Directory Deck */}
              <section
                className="ov-workspaces-section ov-projects-deck"
                aria-labelledby="ov-projects-title"
              >
                <header className="ov-section-head">
                  <div>
                    <div className="ov-section-title-row">
                      <h2 id="ov-projects-title">
                        {isAllScope
                          ? "Active projects"
                          : `Projects in ${activeOrg?.name ?? "organization"}`}
                      </h2>
                      <span className="ov-count-badge">
                        {scopedProjects.length}
                      </span>
                    </div>
                    <p>
                      Direct access to project boards, task lists, flowcharts,
                      documents, and project reports.
                    </p>
                  </div>
                </header>

                {scopedProjects.length === 0 ? (
                  <div className="ov-projects-empty-bar">
                    <FolderKanban size={16} />
                    <span>
                      No projects in {isAllScope ? "these workspaces" : activeOrg?.name}{" "}
                      yet. Open any workspace above to create a project.
                    </span>
                  </div>
                ) : (
                  <div className="ov-ws-table-wrap">
                    <table className="ov-ws-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Workspace</th>
                          {isAllScope && <th>Organization</th>}
                          <th>Status</th>
                          <th className="is-right">Quick access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scopedProjects.map((project) => {
                          const parentWs = wsById.get(project.workspace_id);
                          const parentOrg = parentWs
                            ? orgById.get(parentWs.organization_id)
                            : undefined;
                          const statusKey = project.status || "active";
                          return (
                            <tr key={project.id}>
                              <td>
                                <Link
                                  href={`/projects/${project.id}`}
                                  className="ov-proj-table-link"
                                >
                                  <span
                                    className={`ov-proj-status status-${statusKey}`}
                                  />
                                  <span>{project.name}</span>
                                </Link>
                              </td>
                              <td>
                                {parentWs ? (
                                  <Link
                                    href={`/workspaces/${parentWs.id}`}
                                    className="ov-table-muted-link"
                                  >
                                    {parentWs.name}
                                  </Link>
                                ) : (
                                  <span className="ov-table-muted">—</span>
                                )}
                              </td>
                              {isAllScope && (
                                <td className="ov-table-muted">
                                  {parentOrg?.name ?? "—"}
                                </td>
                              )}
                              <td>
                                <span
                                  className={`ov-status-pill${
                                    statusKey === "active" ? " is-active" : ""
                                  }`}
                                >
                                  {statusKey.replace("_", " ")}
                                </span>
                              </td>
                              <td className="is-right">
                                <div className="ov-proj-row-actions">
                                  <Link
                                    href={`/projects/${project.id}/documents`}
                                    className="ov-table-action-pill"
                                  >
                                    Docs
                                  </Link>
                                  <Link
                                    href={`/projects/${project.id}`}
                                    className="ov-open-ws-link"
                                  >
                                    <span>Open project</span>
                                    <ArrowRight size={13} />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Compact 2-Col Quick Actions & Organization Settings */}
            {targetActionOrg && (
              <aside
                className="ov-side-column"
                aria-label="Quick actions and administration"
              >
                <section className="ov-panel">
                  <header className="ov-panel-head">
                    <div>
                      <span className="ov-panel-eyebrow">ACTIONS</span>
                      <h3>Quick actions</h3>
                    </div>
                    {isAllScope && organizations.length > 1 && (
                      <select
                        className="ov-panel-org-select"
                        aria-label="Select organization for actions"
                        value={targetActionOrg.id}
                        onChange={(e) => setActionOrgId(e.target.value)}
                      >
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </header>

                  <div className="ov-quick-grid">
                    <button
                      type="button"
                      className="ov-quick-tile is-primary"
                      onClick={() =>
                        setActiveModal({
                          type: "create-ws",
                          orgId: targetActionOrg.id,
                        })
                      }
                    >
                      <span className="ov-action-icon">
                        <Plus size={15} />
                      </span>
                      <strong>Create workspace</strong>
                      <small>{targetActionOrg.name}</small>
                    </button>

                    {canAdminTarget ? (
                      <button
                        type="button"
                        className="ov-quick-tile"
                        onClick={() =>
                          setActiveModal({
                            type: "invite",
                            orgId: targetActionOrg.id,
                          })
                        }
                      >
                        <span className="ov-action-icon">
                          <UserPlus size={15} />
                        </span>
                        <strong>Invite member</strong>
                        <small>Email invite</small>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ov-quick-tile"
                        onClick={() => setActiveModal({ type: "create-org" })}
                      >
                        <span className="ov-action-icon">
                          <Building2 size={15} />
                        </span>
                        <strong>New organization</strong>
                        <small>Create space</small>
                      </button>
                    )}

                    <Link
                      href={`/organizations/${targetActionOrg.id}/members`}
                      className="ov-quick-tile"
                    >
                      <span className="ov-action-icon">
                        <UsersRound size={15} />
                      </span>
                      <strong>Members &amp; roles</strong>
                      <small>
                        {targetOrgMemberCount}{" "}
                        {targetOrgMemberCount === 1 ? "member" : "members"}
                      </small>
                    </Link>

                    <Link
                      href={`/organizations/${targetActionOrg.id}/calendar`}
                      className="ov-quick-tile"
                    >
                      <span className="ov-action-icon">
                        <CalendarDays size={15} />
                      </span>
                      <strong>Holidays &amp; leave</strong>
                      <small>PTO &amp; calendar</small>
                    </Link>
                  </div>
                </section>

                {/* Organization Administration */}
                <section className="ov-panel ov-admin-panel">
                  <header className="ov-panel-head">
                    <div>
                      <span className="ov-panel-eyebrow">ADMINISTRATION</span>
                      <h3>{targetActionOrg.name} settings</h3>
                    </div>
                    <Settings2 size={15} className="ov-panel-muted-icon" />
                  </header>

                  <nav
                    className="ov-admin-links"
                    aria-label={`${targetActionOrg.name} administration`}
                  >
                    <Link href={`/organizations/${targetActionOrg.id}/members`}>
                      <UsersRound size={14} />
                      <span>Members &amp; roles</span>
                      <ArrowUpRight size={13} />
                    </Link>
                    <Link
                      href={`/organizations/${targetActionOrg.id}/integrations`}
                    >
                      <PlugZap size={14} />
                      <span>Integrations</span>
                      <ArrowUpRight size={13} />
                    </Link>
                    <Link href={`/organizations/${targetActionOrg.id}/calendar`}>
                      <CalendarDays size={14} />
                      <span>Holidays &amp; leave</span>
                      <ArrowUpRight size={13} />
                    </Link>
                    <Link
                      href={`/organizations/${targetActionOrg.id}/workspaces`}
                    >
                      <Layers3 size={14} />
                      <span>All workspaces</span>
                      <ArrowUpRight size={13} />
                    </Link>
                    <Link href={`/organizations/${targetActionOrg.id}/docs`}>
                      <FileText size={14} />
                      <span>Docs &amp; attachments</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </nav>

                  {isOwnerTarget && (
                    <div className="ov-danger-block is-compact">
                      <div className="ov-danger-copy">
                        <ShieldAlert size={14} />
                        <div>
                          <strong>Delete organization</strong>
                          <small>
                            Permanently erase {targetActionOrg.name}.
                          </small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ov-danger-trigger"
                        onClick={() => {
                          setDeleteConfirmText("");
                          setActiveModal({
                            type: "delete-org",
                            orgId: targetActionOrg.id,
                          });
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </section>
              </aside>
            )}
          </div>
        </>
      )}

      {/* Modal: Create Organization */}
      {activeModal?.type === "create-org" && (
        <EnterpriseDialog
          title="New organization"
          subtitle="Create a separate tenant boundary for teams, workspaces, and billing."
          onClose={closeModal}
        >
          <form action={createOrganization} className="ov-dialog-form">
            <label>
              <span>Organization name</span>
              <input
                name="name"
                placeholder="e.g. Acme PLM Studio"
                minLength={2}
                maxLength={100}
                required
                autoFocus
              />
            </label>
            <div className="ov-dialog-footer">
              <button
                type="button"
                className="ov-btn ov-btn-secondary"
                onClick={closeModal}
              >
                Cancel
              </button>
              <SubmitActionButton
                label="Create organization"
                pendingLabel="Creating..."
                className="ov-btn ov-btn-primary"
              />
            </div>
          </form>
        </EnterpriseDialog>
      )}

      {/* Modal: Create Workspace */}
      {activeModal?.type === "create-ws" && modalOrg && (
        <EnterpriseDialog
          title="Create workspace"
          subtitle={`Organize related projects, milestones, and team permissions inside ${modalOrg.name}.`}
          onClose={closeModal}
        >
          <form action={createWorkspace} className="ov-dialog-form">
            <input type="hidden" name="organizationId" value={modalOrg.id} />
            <label>
              <span>Workspace name</span>
              <input
                name="name"
                placeholder="e.g. Product Engineering"
                minLength={2}
                maxLength={100}
                required
                autoFocus
              />
            </label>
            <label>
              <span>Description (optional)</span>
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                placeholder="What projects or deliverables belong in this workspace?"
              />
            </label>
            <div className="ov-dialog-footer">
              <button
                type="button"
                className="ov-btn ov-btn-secondary"
                onClick={closeModal}
              >
                Cancel
              </button>
              <SubmitActionButton
                label="Create workspace"
                pendingLabel="Creating..."
                className="ov-btn ov-btn-primary"
              />
            </div>
          </form>
        </EnterpriseDialog>
      )}

      {/* Modal: Invite Member */}
      {activeModal?.type === "invite" && modalOrg && (
        <EnterpriseDialog
          title={`Invite members to ${modalOrg.name}`}
          subtitle="Choose an organization-only role or scope collaborators directly to a workspace."
          onClose={closeModal}
        >
          <div className="ov-invite-modal-body">
            <MultiEmailInviteForm
              organizationId={modalOrg.id}
              workspaces={targetActionOrgWorkspaces.map((ws) => ({
                id: ws.id,
                name: ws.name,
              }))}
            />
          </div>
        </EnterpriseDialog>
      )}

      {/* Modal: Delete Organization */}
      {activeModal?.type === "delete-org" && modalOrg && (
        <EnterpriseDialog
          title={`Delete ${modalOrg.name}`}
          subtitle="This action permanently deletes the organization, all workspaces, projects, tasks, and attachments. It cannot be undone."
          onClose={closeModal}
          danger
        >
          <form action={deleteOrganization} className="ov-dialog-form">
            <input type="hidden" name="organizationId" value={modalOrg.id} />
            <label>
              <span>
                Type <strong>{modalOrg.name}</strong> to confirm deletion
              </span>
              <input
                name="confirmName"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={modalOrg.name}
                autoComplete="off"
                required
                autoFocus
              />
            </label>
            <div className="ov-dialog-footer">
              <button
                type="button"
                className="ov-btn ov-btn-secondary"
                onClick={closeModal}
              >
                Cancel
              </button>
              <SubmitActionButton
                label="Delete organization"
                pendingLabel="Deleting..."
                className="ov-btn ov-btn-danger"
                disabled={deleteConfirmText.trim() !== modalOrg.name}
              />
            </div>
          </form>
        </EnterpriseDialog>
      )}
    </div>
  );
}
