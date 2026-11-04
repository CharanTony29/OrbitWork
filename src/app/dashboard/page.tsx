import { redirect } from "next/navigation";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import Link from "next/link";
import { Building2, Layers3, Plus, FolderKanban, UsersRound, ArrowUpRight, Bell, Trash2, ChevronDown, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createOrganization, createWorkspace, deleteOrganization, inviteOrganizationMember, signOut } from "../actions";

const dashboardErrorMessages: Record<string, string> = {
  invalid_invitation: "Check the invitation details and selected workspace, then try again.",
  invitation_forbidden: "Only an organization owner or admin can invite members.",
  invitation_failed: "The invitation could not be saved. Confirm the latest invitation migrations are applied and that you have owner or admin access.",
  invitation_email_failed: "Supabase Auth could not send the invitation email. Check the Auth logs and SMTP configuration.",
  invitation_email_recipient_restricted: "Supabase’s default email sender only sends to members of your Supabase project team. Configure custom SMTP to invite workspace users.",
  invitation_email_rate_limited: "Supabase Auth’s email send limit was reached. Wait and retry, or configure custom SMTP for regular invitations.",
  invitation_email_redirect_not_allowed: "Supabase rejected the invitation callback URL. Add your app URL under Authentication → URL Configuration → Redirect URLs.",
  invitation_accept_failed: "The invitation could not be accepted. Confirm migration 014_invitation_acceptance.sql is applied and sign in with the email address that received the invite.",
  invalid_workspace: "Enter a valid workspace name with at least two characters.",
  workspace_failed: "The workspace could not be created. Check your organization permissions and Supabase setup.",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string; invited?: string; invitation_accepted?: string; organization_deleted?: string; organization_created?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Automatically process any pending invitations for this user
  try {
    await supabase.rpc("accept_user_pending_invitations");
  } catch {}

  const { data: ownProfile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  const displayName = ownProfile?.display_name?.trim() || user.email?.split("@")[0] || "there";
  const { data: memberships } = await supabase.from("organization_members").select("organization_id, role, organizations(id, name, created_at)").eq("user_id", user.id);
  const organizations = (memberships ?? []).map((item) => ({ ...((Array.isArray(item.organizations) ? item.organizations[0] : item.organizations) as { id: string; name: string; created_at: string } | null), role: item.role })).filter((item): item is { id: string; name: string; created_at: string; role: string } => Boolean(item.id));
  const orgIds = organizations.map((org) => org.id);
  const { data: workspaces } = orgIds.length ? await supabase.from("workspaces").select("id, organization_id, name, description, created_at").in("organization_id", orgIds).order("created_at", { ascending: false }) : { data: [] };
  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id);
  const { data: projects } = workspaceIds.length ? await supabase.from("projects").select("id, workspace_id, name").in("workspace_id", workspaceIds).order("name") : { data: [] };
  const { data: organizationMembers } = orgIds.length ? await supabase.from("organization_members").select("organization_id, user_id").in("organization_id", orgIds).eq("status", "active") : { data: [] };
  const { count: assignedTaskCount } = await supabase.from("task_assignees").select("task_id", { count: "exact", head: true }).eq("user_id", user.id);
  const params = await searchParams;

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></a><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/></div></header>
    <div className="dashboard-layout"><aside className="sidebar"><div className="sidebar-label">YOUR SPACE</div><a className="nav-item active" href="/dashboard"><Layers3 size={17}/> Overview</a><Link className="nav-item" href="/inbox"><Bell size={16}/> Inbox {(assignedTaskCount ?? 0) > 0 && <span className="count-pill" style={{ marginLeft: "auto", fontSize: "10px", padding: "1px 6px" }}>{assignedTaskCount}</span>}</Link><Link className="nav-item" href="/chat"><MessageSquare size={16}/> Chat</Link><div className="sidebar-label sidebar-label-spaced">WORKSPACE HIERARCHY</div><nav className="dashboard-hierarchy" aria-label="Organization, workspace, and project navigation">{organizations.map((org) => <details className="dashboard-org-tree" key={org.id} open><summary><ChevronDown size={12}/><Building2 size={14}/><span>{org.name}</span></summary><div className="dashboard-tree-children">{(workspaces ?? []).filter((workspace) => workspace.organization_id === org.id).map((workspace) => <details className="dashboard-workspace-tree" key={workspace.id} open><summary><ChevronDown size={11}/><FolderKanban size={13}/><Link className="dashboard-tree-ws-link" href={`/workspaces/${workspace.id}`}>{workspace.name}</Link></summary><div className="dashboard-project-links"><Link href={`/workspaces/${workspace.id}`}>Workspace overview</Link>{(projects ?? []).filter((project) => project.workspace_id === workspace.id).map((project) => <Link href={`/projects/${project.id}`} key={project.id}><span/>{project.name}</Link>)}</div></details>)}{!(workspaces ?? []).some((workspace) => workspace.organization_id === org.id) && <p className="dashboard-tree-empty">No workspaces</p>}<Link className="dashboard-org-members" href={`/organizations/${org.id}/members`}>Members &amp; roles</Link></div></details>)}</nav><div className="sidebar-note">Projects, tasks, and team spaces, all in one place.</div></aside>
    <section className="dashboard-content"><div className="welcome-row"><div><p className="eyebrow">YOUR OVERVIEW</p><h1>Good to have you here, {displayName}.</h1><p className="muted">Start with an organization, then shape the workspaces your team needs.</p></div></div>
      {params.error && <p className="error banner-error" role="alert">{dashboardErrorMessages[params.error] ?? "That action could not be completed. Check your access and Supabase configuration."}</p>}
      {params.invited && <p className="notice" role="status">Invitation email sent.</p>}
      {params.invitation_accepted && <p className="notice" role="status">Invitation accepted. You now have access to the workspace.</p>}
      {params.organization_deleted && <p className="notice" role="status">Organization deleted.</p>}
      {params.organization_created && <p className="notice" role="status">Organization created.</p>}

      <section className="organization-directory">
        <header className="organization-directory-heading">
          <div><p className="eyebrow">ORGANIZATION DIRECTORY</p><h2>Your organizations <span className="count-pill">{organizations.length}</span></h2><p>Keep each company or team’s work in its own space.</p></div>
          <details className="organization-create"><summary className="button button-primary"><Plus size={16}/> New organization</summary><form action={createOrganization}><label>Organization name<input name="name" placeholder="e.g. Acme Studio" minLength={2} maxLength={100} required/></label><button className="button button-primary">Create organization</button></form></details>
        </header>
        {organizations.length ? <div className="org-grid">{organizations.map((org) => {
          const orgWorkspaces = (workspaces ?? []).filter((workspace) => workspace.organization_id === org.id);
          const memberCount = (organizationMembers ?? []).filter((member) => member.organization_id === org.id).length;
          return <article className="org-card" id={`org-${org.id}`} key={org.id}>
            <header className="org-card-top"><div className="org-icon"><Building2 size={19}/></div><span className="role-pill">{org.role}</span></header>
            <div className="org-card-title"><h3>{org.name}</h3><p>Created {new Date(org.created_at).toLocaleDateString()}</p></div>
            <nav className="organization-links" aria-label={`${org.name} settings`}><Link href={`/organizations/${org.id}/members`}>Members &amp; roles</Link><Link href={`/organizations/${org.id}/calendar`}>Holidays &amp; leave</Link><Link href={`/organizations/${org.id}/integrations`}>Integrations</Link></nav>
            <div className="org-metrics"><span><Layers3 size={14}/>{orgWorkspaces.length} workspaces</span><span><UsersRound size={14}/>{memberCount} members</span></div>
            <div className="workspace-list">{orgWorkspaces.map((workspace) => <Link className="workspace-row" href={`/workspaces/${workspace.id}`} key={workspace.id}><div><span className="workspace-dot"/><strong>{workspace.name}</strong>{workspace.description && <small>{workspace.description}</small>}</div><ArrowUpRight size={15}/></Link>)}{!orgWorkspaces.length && <p className="muted small">No workspaces yet. Create one to organize projects.</p>}</div>
            <form action={createWorkspace} className="workspace-form"><input type="hidden" name="organizationId" value={org.id}/><input name="name" placeholder="New workspace name" minLength={2} maxLength={100} required/><button className="icon-button" aria-label={`Create workspace in ${org.name}`} title="Create workspace"><Plus size={17}/></button></form>
            {["owner", "admin"].includes(org.role) && <form action={inviteOrganizationMember} className="workspace-form invite-form"><input type="hidden" name="organizationId" value={org.id}/><select name="workspaceId" defaultValue="" aria-label="Invite to workspace"><option value="">Organization only · no workspace access</option>{orgWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select><input name="email" type="email" placeholder="Invite by email" required/><select name="role" defaultValue="member" aria-label="Invitation role"><option value="member">Member</option><option value="manager">Manager</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select><button className="button button-secondary">Invite</button></form>}
            {org.role === "owner" && <details className="org-danger-zone"><summary><Trash2 size={14}/> Delete organization</summary><p>This permanently deletes the organization, its workspaces, projects, tasks, and related records.</p><form action={deleteOrganization}><input type="hidden" name="organizationId" value={org.id}/><label>Type <strong>{org.name}</strong> to confirm<input name="confirmName" placeholder={org.name} required autoComplete="off"/></label><button className="button button-danger">Delete organization</button></form></details>}
          </article>;
        })}</div> : <div className="organization-empty"><div className="empty-icon"><Building2 size={22}/></div><h3>No organizations yet</h3><p>Create one to get started with workspaces, members, and projects.</p></div>}
      </section>      <div className="footnote"><FolderKanban size={15}/> Open an organization workspace to manage its projects and tasks.</div>
    </section></div>
  </main>;
}
