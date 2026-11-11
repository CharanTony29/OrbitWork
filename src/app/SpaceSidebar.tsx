import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  MessageSquare,
  PlugZap,
  UsersRound,
} from "lucide-react";
import type {
  SpaceOrganization,
  SpaceProject,
  SpaceWorkspace,
} from "@/lib/workspace-space";

type Props = {
  activeNav: "overview" | "dashboard";
  assignedTaskCount: number;
  organizations: SpaceOrganization[];
  workspaces: SpaceWorkspace[];
  projects: SpaceProject[];
};

/**
 * Compact enterprise left sidebar with primary navigation and collapsible
 * organization/workspace/project hierarchy tree (used on `/my-dashboard`).
 */
export default function SpaceSidebar({
  activeNav,
  assignedTaskCount,
  organizations,
  workspaces,
  projects,
}: Props) {
  return (
    <aside className="sidebar ov-sidebar" aria-label="Primary navigation">
      <div className="ov-sidebar-section">
        <div className="sidebar-label">YOUR SPACE</div>
        <nav className="ov-primary-nav" aria-label="Core workspace views">
          <Link
            className={`nav-item ov-nav-item${activeNav === "overview" ? " active" : ""}`}
            href="/dashboard"
            prefetch={false}
            aria-current={activeNav === "overview" ? "page" : undefined}
          >
            <Layers3 size={16} />
            <span>Overview</span>
          </Link>
          <Link
            className={`nav-item ov-nav-item${activeNav === "dashboard" ? " active" : ""}`}
            href="/my-dashboard"
            prefetch={false}
            aria-current={activeNav === "dashboard" ? "page" : undefined}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
          <Link className="nav-item ov-nav-item" href="/inbox" prefetch={false}>
            <Bell size={16} />
            <span>Inbox</span>
            {assignedTaskCount > 0 && (
              <span className="ov-nav-badge">{assignedTaskCount}</span>
            )}
          </Link>
          <Link className="nav-item ov-nav-item" href="/chat" prefetch={false}>
            <MessageSquare size={16} />
            <span>Chat</span>
          </Link>
        </nav>
      </div>

      <div className="ov-sidebar-divider" />

      <div className="ov-sidebar-section ov-hierarchy-section">
        <div className="ov-hierarchy-head">
          <span className="sidebar-label">WORKSPACE HIERARCHY</span>
          {workspaces.length > 0 && (
            <span className="ov-hierarchy-total">{workspaces.length}</span>
          )}
        </div>

        <nav
          className="ov-hierarchy-tree"
          aria-label="Organization, workspace, and project navigation"
        >
          {organizations.map((org) => {
            const orgWorkspaces = workspaces.filter(
              (workspace) => workspace.organization_id === org.id
            );
            return (
              <details className="ov-org-node" key={org.id} open>
                <summary title={org.name}>
                  <ChevronDown size={13} className="ov-tree-caret" />
                  <Building2 size={14} className="ov-tree-icon-org" />
                  <span className="ov-tree-label">{org.name}</span>
                  <span className="ov-tree-role">{org.role}</span>
                </summary>

                <div className="ov-org-branch">
                  {orgWorkspaces.map((workspace) => {
                    const wsProjects = projects.filter(
                      (project) => project.workspace_id === workspace.id
                    );
                    return (
                      <details
                        className="ov-ws-node"
                        key={workspace.id}
                        open
                      >
                        <summary title={workspace.name}>
                          <ChevronDown size={12} className="ov-tree-caret" />
                          <FolderKanban size={13} className="ov-tree-icon-ws" />
                          <Link
                            className="ov-tree-ws-link"
                            href={`/workspaces/${workspace.id}`}
                            prefetch={false}
                          >
                            {workspace.name}
                          </Link>
                          <span className="ov-tree-count">{wsProjects.length}</span>
                        </summary>

                        <div className="ov-ws-branch">
                          <Link
                            href={`/workspaces/${workspace.id}`}
                            prefetch={false}
                            className="ov-ws-resource-link"
                          >
                            <Layers3 size={12} />
                            <span>Workspace overview</span>
                          </Link>
                          <Link
                            href={`/workspaces/${workspace.id}/timesheets`}
                            prefetch={false}
                            className="ov-ws-resource-link"
                          >
                            <Clock3 size={12} />
                            <span>Timesheets</span>
                          </Link>

                          {wsProjects.map((project) => (
                            <Link
                              href={`/projects/${project.id}`}
                              prefetch={false}
                              key={project.id}
                              className="ov-project-leaf"
                              title={project.name}
                            >
                              <span
                                className={`ov-proj-status status-${project.status || "active"}`}
                              />
                              <span className="ov-tree-leaf-text">{project.name}</span>
                            </Link>
                          ))}
                        </div>
                      </details>
                    );
                  })}

                  {orgWorkspaces.length === 0 && (
                    <p className="ov-tree-empty">No workspaces yet</p>
                  )}

                  <div className="ov-org-resources">
                    <Link href={`/organizations/${org.id}/members`} prefetch={false}>
                      <UsersRound size={12} />
                      <span>Members &amp; roles</span>
                    </Link>
                    <Link href={`/organizations/${org.id}/calendar`} prefetch={false}>
                      <CalendarDays size={12} />
                      <span>Holidays &amp; leave</span>
                    </Link>
                    <Link href={`/organizations/${org.id}/integrations`} prefetch={false}>
                      <PlugZap size={12} />
                      <span>Integrations</span>
                    </Link>
                    <Link href={`/organizations/${org.id}/docs`} prefetch={false}>
                      <FileText size={12} />
                      <span>Docs &amp; attachments</span>
                    </Link>
                  </div>
                </div>
              </details>
            );
          })}

          {organizations.length === 0 && (
            <p className="ov-tree-empty">No organizations yet</p>
          )}
        </nav>
      </div>
    </aside>
  );
}
