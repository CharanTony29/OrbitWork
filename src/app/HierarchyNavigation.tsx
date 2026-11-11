import Link from "next/link";
import { Bell, Building2, CalendarDays, ChevronDown, Clock3, FileText, FolderKanban, House, Layers3, LayoutDashboard, UsersRound, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProjectSublinks from "./ProjectSublinks";

export default async function HierarchyNavigation({ organizationId, organizationName, currentWorkspaceId, currentProjectId }: { organizationId: string; organizationName: string; currentWorkspaceId: string; currentProjectId?: string }) {
  const supabase = await createClient();
  const { data: workspaces } = await supabase.from("workspaces").select("id, name").eq("organization_id", organizationId).order("name");
  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id);
  const { data: projects } = workspaceIds.length ? await supabase.from("projects").select("id, name, workspace_id").in("workspace_id", workspaceIds).order("name") : { data: [] };

  return <>
    <nav className="work-icon-rail" aria-label="Main navigation">
      <Link className="work-rail-logo" href="/dashboard" prefetch={false} aria-label="Orbitwork home"><span>O</span></Link>
      <Link href="/dashboard" prefetch={false} title="Overview"><House size={18}/><span>Home</span></Link>
      <Link href="/my-dashboard" prefetch={false} title="Dashboard"><LayoutDashboard size={17}/><span>Dashboard</span></Link>
      <Link href="/inbox" prefetch={false} title="Inbox"><Bell size={17}/><span>Inbox</span></Link>
      <Link href={currentProjectId ? `/projects/${currentProjectId}?view=calendar` : `/workspaces/${currentWorkspaceId}`} prefetch={false} title="Planner"><CalendarDays size={17}/><span>Planner</span></Link>
      <Link href={currentProjectId ? `/projects/${currentProjectId}/documents` : `/organizations/${organizationId}/docs`} prefetch={false} title="Docs & Attachments"><FileText size={17}/><span>Docs</span></Link>
      <Link href={`/workspaces/${currentWorkspaceId}/timesheets`} prefetch={false} title="Workspace Timesheets"><Clock3 size={17}/><span>Time</span></Link>
      <Link href="/chat" prefetch={false} title="Team & Personal Chat"><MessageSquare size={17}/><span>Chat</span></Link>
      <Link href={`/organizations/${organizationId}/members`} prefetch={false} title="Members"><UsersRound size={17}/><span>People</span></Link>
      <Link className="work-rail-more" href={`/organizations/${organizationId}/calendar`} prefetch={false} title="Holidays and leave"><Layers3 size={17}/><span>More</span></Link>
    </nav>
    <aside className="hierarchy-sidebar" aria-label="Workspace navigation">
    <div className="hierarchy-sidebar-heading"><span>WORKSPACE</span><strong>{organizationName}</strong></div>
    <Link className="hierarchy-dashboard" href="/dashboard" prefetch={false}><Layers3 size={15}/> All organizations</Link>
    <Link className="hierarchy-dashboard" href="/my-dashboard" prefetch={false}><LayoutDashboard size={15}/> Dashboard</Link>
    <Link className="hierarchy-dashboard" href="/inbox" prefetch={false}><Bell size={15}/> Inbox</Link>
    <Link className="hierarchy-dashboard" href={`/organizations/${organizationId}/docs`} prefetch={false}><FileText size={15}/> Docs &amp; Attachments</Link>
    <div className="hierarchy-org-label"><Building2 size={14}/><span>ORGANIZATION</span></div>
    <div className="hierarchy-org-name" title={organizationName}>{organizationName}</div>
    <p className="hierarchy-section-label">WORKSPACES &amp; PROJECTS</p>
    <nav className="hierarchy-tree" aria-label="Organization workspaces and projects">
      {(workspaces ?? []).map((workspace) => <details key={workspace.id} open={workspace.id === currentWorkspaceId}>
        <summary className={workspace.id === currentWorkspaceId && !currentProjectId ? "is-current" : ""}><ChevronDown size={13}/><FolderKanban size={14}/><Link className="hierarchy-workspace-title-link" href={`/workspaces/${workspace.id}`} prefetch={false}>{workspace.name}</Link></summary>
        <div className="hierarchy-projects">
          <Link className={`hierarchy-workspace-link${workspace.id === currentWorkspaceId && !currentProjectId ? " is-current" : ""}`} href={`/workspaces/${workspace.id}`} prefetch={false}>Workspace overview</Link>
          {(projects ?? []).filter((project) => project.workspace_id === workspace.id).map((project) => (
            <div className="hierarchy-project-group" key={project.id}>
              <Link className={`hierarchy-project-link${project.id === currentProjectId ? " is-current" : ""}`} href={`/projects/${project.id}`} prefetch={false} title={project.name}><span className="hierarchy-project-dot"/><span className="hierarchy-link-label">{project.name}</span></Link>
              {project.id === currentProjectId && <ProjectSublinks projectId={project.id} />}
            </div>
          ))}
        </div>
      </details>)}
      {!workspaces?.length && <p className="hierarchy-empty">No workspaces yet.</p>}
    </nav>
    <div className="hierarchy-sidebar-footer"><Link href={`/organizations/${organizationId}/calendar`} prefetch={false}>Holidays &amp; leave</Link></div>
    </aside>
  </>;
}
