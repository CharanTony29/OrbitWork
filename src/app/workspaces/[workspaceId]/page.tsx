import { notFound, redirect } from "next/navigation";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import Link from "next/link";
import { ArrowLeft, FolderKanban, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { addWorkspaceMember, createProject, removeWorkspaceMember, signOut } from "@/app/actions";

export default async function WorkspacePage({ params, searchParams }: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ error?: string; member_added?: string; member_removed?: string }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: workspace } = await supabase.from("workspaces").select("id, name, description, organization_id").eq("id", workspaceId).maybeSingle();
  if (!workspace) notFound();
  const [{ data: projects }, { data: organizationMembers }, { data: workspaceMembers }, { data: canManage }, { data: isOrgAdmin }] = await Promise.all([
    supabase.from("projects").select("id, name, description, status, priority, due_date, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("organization_members").select("user_id").eq("organization_id", workspace.organization_id).eq("status", "active"),
    supabase.from("workspace_members").select("user_id, role, status").eq("workspace_id", workspaceId),
    supabase.rpc("can_manage_workspace", { target_workspace: workspaceId }),
    supabase.rpc("has_org_role", { target_org: workspace.organization_id, allowed_roles: ["owner", "admin"] }),
  ]);
  const memberIds = [...new Set([...(organizationMembers ?? []).map((member) => member.user_id), ...(workspaceMembers ?? []).map((member) => member.user_id)])];
  const { data: profiles } = memberIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", memberIds) : { data: [] };
  const people = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "Team member"]));
  const activeWorkspaceMembers = (workspaceMembers ?? []).filter((member) => member.status === "active");
  const activeWorkspaceMemberIds = new Set(activeWorkspaceMembers.map((member) => member.user_id));
  const availableMembers = (organizationMembers ?? []).filter((member) => !activeWorkspaceMemberIds.has(member.user_id));
  const { error, member_added, member_removed } = await searchParams;
  const memberErrors: Record<string, string> = {
    workspace_member_forbidden: "Only a workspace owner, admin, or manager can change workspace access.",
    workspace_member_not_in_org: "Only active organization members can be added to this workspace.",
    workspace_member_add_failed: "The member could not be added. Check the workspace access migration and try again.",
    workspace_member_remove_failed: "The member could not be removed. Check your workspace role and the workspace access migration.",
  };

  return <main className="app-shell">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/><form action={signOut}><button className="quiet-button">Sign out</button></form></div></header>
    <div className="workspace-page"><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/> All organizations</Link>
      <div className="workspace-heading"><div><p className="eyebrow">WORKSPACE</p><h1>{workspace.name}</h1><p className="muted">{workspace.description || "Projects and shared work in one place."}</p></div><div className="workspace-symbol"><FolderKanban size={22}/></div></div>
      {member_added && <p className="notice" role="status">Workspace access added.</p>}{member_removed && <p className="notice" role="status">Workspace access removed.</p>}
      {error && <p className="error" role="alert">{memberErrors[error] ?? "The project could not be created. Check your access and try again."}</p>}
      <div className="project-section-head"><div><p className="eyebrow">PROJECT DIRECTORY</p><h2>Projects <span className="count-pill">{projects?.length ?? 0}</span></h2></div></div>
      {projects?.length ? <div className="project-grid">{projects.map((project) => <Link className="project-card" href={`/projects/${project.id}`} key={project.id}><div className="project-card-top"><span className="project-symbol"><FolderKanban size={17}/></span><span className={`project-state state-${project.status}`}>{project.status.replace("_", " ")}</span></div><h3>{project.name}</h3><p>{project.description || "No project description yet."}</p><div className="project-card-meta"><span>{project.priority} priority</span>{project.due_date && <span>Due {new Date(`${project.due_date}T00:00:00`).toLocaleDateString()}</span>}</div></Link>)}</div> : <div className="empty-projects"><div className="empty-icon"><FolderKanban size={21}/></div><h3>No projects yet</h3><p>Create the first project in this workspace. Its own task workflow will be created automatically.</p></div>}
      <section className="workspace-access-section"><header><div><p className="eyebrow">WORKSPACE ACCESS</p><h2>Members <span className="count-pill">{activeWorkspaceMembers.length}</span></h2></div></header>
        {activeWorkspaceMembers.length ? <div className="workspace-member-list">{activeWorkspaceMembers.map((member) => <div className="workspace-member-row" key={member.user_id}><span className="organization-member-avatar">{(people.get(member.user_id) ?? "T")[0].toUpperCase()}</span><strong>{people.get(member.user_id) ?? "Team member"}</strong><span className="role-pill">{member.role}</span>{canManage && <form action={removeWorkspaceMember}><input type="hidden" name="workspaceId" value={workspaceId}/><input type="hidden" name="userId" value={member.user_id}/><button className="mini-remove">Remove</button></form>}</div>)}</div> : <p className="muted small">No one has explicit workspace access yet. Organization owners and admins can still access it.</p>}
        {canManage && <form action={addWorkspaceMember} className="workspace-member-add"><input type="hidden" name="workspaceId" value={workspaceId}/><label>Add an organization member<select name="userId" required defaultValue="" disabled={!availableMembers.length}><option value="">{availableMembers.length ? "Choose a member" : "All organization members already have access"}</option>{availableMembers.map((member) => <option key={member.user_id} value={member.user_id}>{people.get(member.user_id) ?? "Team member"}</option>)}</select></label><label>Workspace role<select name="role" defaultValue="member"><option value="member">Member</option><option value="manager">Manager</option><option value="viewer">Viewer</option>{isOrgAdmin && <option value="admin">Admin</option>}</select></label><button className="button button-primary" disabled={!availableMembers.length}>Add to workspace</button></form>}
      </section>
      <details className="create-project"><summary><Plus size={16}/> Create a project</summary><form action={createProject} className="project-form"><input type="hidden" name="workspaceId" value={workspace.id}/><label>Project name<input name="name" placeholder="e.g. Website refresh" minLength={2} maxLength={120} required/></label><label>Description <span className="optional">optional</span><textarea name="description" placeholder="What is this project for?" maxLength={2000}/></label><button className="button button-primary">Create project</button></form></details>
    </div>
  </main>;
}
