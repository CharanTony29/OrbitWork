import Link from "next/link";
import { Bell, Building2, CalendarDays, ChevronDown, Clock3, FileText, FolderKanban, House, Layers3, UsersRound, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProjectSublinks from "./ProjectSublinks";
import GlobalSearchModal from "./GlobalSearchModal";

export default async function HierarchyNavigation({ organizationId, organizationName, currentWorkspaceId, currentProjectId }: { organizationId: string; organizationName: string; currentWorkspaceId: string; currentProjectId?: string }) {
  const supabase = await createClient();
  const { data: workspaces } = await supabase.from("workspaces").select("id, name").eq("organization_id", organizationId).order("name");
  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id);
  const { data: projects } = workspaceIds.length ? await supabase.from("projects").select("id, name, workspace_id").in("workspace_id", workspaceIds).order("name") : { data: [] };

  return <>
    <nav className="work-icon-rail" aria-label="Main navigation">
      <Link className="work-rail-logo" href="/dashboard" aria-label="Orbitwork home"><span>O</span></Link>
      <Link href="/dashboard" title="Home"><House size={18}/><span>Home</span></Link>
      <Link href="/inbox" title="Inbox"><Bell size={17}/><span>Inbox</span></Link>
      <Link href={currentProjectId ? `/projects/${currentProjectId}?view=calendar` : `/workspaces/${currentWorkspaceId}`} title="Planner"><CalendarDays size={17}/><span>Planner</span></Link>
      {currentProjectId && <Link href={`/projects/${currentProjectId}/documents`} title="Documents"><FileText size={17}/><span>Docs</span></Link>}
      <Link href={`/workspaces/${currentWorkspaceId}/timesheets`} title="Workspace Timesheets"><Clock3 size={17}/><span>Time</span></Link>
      <Link href="/chat" title="Team & Personal Chat"><MessageSquare size={17}/><span>Chat</span></Link>
      <Link href={`/organizations/${organizationId}/members`} title="Members"><UsersRound size={17}/><span>People</span></Link>
      <Link className="work-rail-more" href={`/organizations/${organizationId}/calendar`} title="Holidays and leave"><Layers3 size={17}/><span>More</span></Link>
    </nav>
    <aside className="hierarchy-sidebar" aria-label="Workspace navigation">
    <div className="hierarchy-sidebar-heading"><span>WORKSPACE</span><strong>{organizationName}</strong></div>
    <Link className="hierarchy-dashboard" href="/dashboard"><Layers3 size={15}/> All organizations</Link>
    <Link className="hierarchy-dashboard" href="/inbox"><Bell size={15}/> Inbox</Link>
    <div className="hierarchy-org-label"><Building2 size={14}/><span>ORGANIZATION</span></div>
    <div className="hierarchy-org-name" title={organizationName}>{organizationName}</div>
    <div className="hierarchy-search-box">
      <GlobalSearchModal workspaceId={currentWorkspaceId} workspaceName={(workspaces ?? []).find(w => w.id === currentWorkspaceId)?.name} />
    </div>
    <p className="hierarchy-section-label">WORKSPACES &amp; PROJECTS</p>
    <nav className="hierarchy-tree" aria-label="Organization workspaces and projects">
      {(workspaces ?? []).map((workspace) => <details key={workspace.id} open={workspace.id === currentWorkspaceId}>
        <summary className={workspace.id === currentWorkspaceId && !currentProjectId ? "is-current" : ""}><ChevronDown size={13}/><FolderKanban size={15}/><Link className="hierarchy-workspace-title-link" href={`/workspaces/${workspace.id}`}>{workspace.name}</Link></summary>
        <div className="hierarchy-projects">
          <Link className={`hierarchy-workspace-link${workspace.id === currentWorkspaceId && !currentProjectId ? " is-current" : ""}`} href={`/workspaces/${workspace.id}`}>Workspace overview</Link>
          {(projects ?? []).filter((project) => project.workspace_id === workspace.id).map((project) => (
            <div className="hierarchy-project-group" key={project.id}>
              <Link className={`hierarchy-project-link${project.id === currentProjectId ? " is-current" : ""}`} href={`/projects/${project.id}`}><span className="hierarchy-project-dot"/>{project.name}</Link>
              {project.id === currentProjectId && <ProjectSublinks projectId={project.id} />}
            </div>
          ))}
        </div>
      </details>)}
      {!workspaces?.length && <p className="hierarchy-empty">No workspaces yet.</p>}
    </nav>
    <div className="hierarchy-sidebar-footer"><Link href={`/organizations/${organizationId}/calendar`}>Holidays &amp; leave</Link></div>
    </aside>
  </>;
}
