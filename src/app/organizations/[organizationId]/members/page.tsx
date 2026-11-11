import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut, updateOrganizationMemberRole } from "@/app/actions";

export default async function OrganizationMembersPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: organization } = await supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle();
  if (!organization) notFound();
  const [{ data: memberships }, { data: workspaces }, { data: canManageOrg }] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, status, joined_at").eq("organization_id", organizationId).order("joined_at"),
    supabase.from("workspaces").select("id, name").eq("organization_id", organizationId).order("name"),
    supabase.rpc("has_org_role", { target_org: organizationId, allowed_roles: ["owner", "admin"] }),
  ]);
  const memberIds = (memberships ?? []).map((member) => member.user_id);
  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id);
  const [{ data: profiles }, { data: workspaceMembers }] = await Promise.all([
    memberIds.length ? supabase.from("profiles").select("id, display_name, email, avatar_url, designation, department, contact_information").in("id", memberIds) : Promise.resolve({ data: [] }),
    workspaceIds.length ? supabase.from("workspace_members").select("workspace_id, user_id, role, status").in("workspace_id", workspaceIds).in("user_id", memberIds) : Promise.resolve({ data: [] }),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const workspaceById = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace.name]));
  const workspaceRoleByUser = new Map<string, Array<{ name: string; role: string }>>();
  for (const membership of workspaceMembers ?? []) {
    if (membership.status !== "active") continue;
    workspaceRoleByUser.set(membership.user_id, [...(workspaceRoleByUser.get(membership.user_id) ?? []), { name: workspaceById.get(membership.workspace_id) ?? "Workspace", role: membership.role }]);
  }
  return <main className="app-shell"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/></div></header><section className="organization-members-page"><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>{organization.name}</Link><header className="organization-members-heading"><div><p className="eyebrow">ORGANIZATION DIRECTORY</p><h1>Members and roles</h1><p className="muted">People with access to {organization.name} and their workspace roles.</p></div><span className="organization-members-count"><UsersRound size={16}/>{memberships?.length ?? 0} members</span></header><div className="organization-members-table-wrap"><table className="organization-members-table"><thead><tr><th>Member</th><th>Organization role</th><th>Workspace access and role</th><th>Status</th><th>Joined</th></tr></thead><tbody>{(memberships ?? []).map((membership) => {
    const profile = profileById.get(membership.user_id);
    const name = profile?.display_name?.trim() || profile?.email || "Team member";
    const workspaceRoles = workspaceRoleByUser.get(membership.user_id) ?? [];
    const profileDetails = [profile?.designation, profile?.department, profile?.contact_information].filter(Boolean).join(" · ");
    return <tr key={membership.user_id}><td><div className="organization-member-person"><span className="organization-member-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt={name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : (name[0]?.toUpperCase() ?? "U")}</span><span><strong>{name}</strong>{profile?.email && profile.display_name?.trim() && <small>{profile.email}</small>}{profileDetails && <small>{profileDetails}</small>}</span></div></td><td>{canManageOrg && membership.role !== "owner" ? (
      <form action={updateOrganizationMemberRole} style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="userId" value={membership.user_id} />
        <select name="role" defaultValue={membership.role} style={{ fontSize: "0.82rem", padding: "0.25rem 0.5rem", borderRadius: "6px", border: "1px solid var(--border-color, #cbd5e1)" }}>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
        <button type="submit" className="button button-secondary" style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem" }}>Update</button>
      </form>
    ) : (
      <span className={`organization-role-badge role-${membership.role}`}>{membership.role}</span>
    )}</td><td>{workspaceRoles.length ? <div className="organization-workspace-roles">{workspaceRoles.map((item) => <span key={`${item.name}-${item.role}`}><strong>{item.name}</strong><small>{item.role}</small></span>)}</div> : <span className="organization-member-muted">No workspace access</span>}</td><td><span className={`organization-member-status status-${membership.status}`}>{membership.status}</span></td><td>{new Date(membership.joined_at).toLocaleDateString()}</td></tr>;
  })}</tbody></table>{!memberships?.length && <p className="organization-members-empty">No members found.</p>}</div></section></main>;
}
