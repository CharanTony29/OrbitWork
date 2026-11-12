import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GitBranch, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateOrganizationMemberManager, updateOrganizationMemberRole } from "@/app/actions";

export default async function OrganizationMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ error?: string; hierarchy_updated?: string; member_updated?: string }>;
}) {
  const { organizationId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: organization } = await supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle();
  if (!organization) notFound();

  const extMemberQuery = await supabase
    .from("organization_members")
    .select("user_id, role, status, joined_at, manager_id")
    .eq("organization_id", organizationId)
    .order("joined_at");

  const hierarchySupported = !extMemberQuery.error;
  const memberships: Array<{
    user_id: string;
    role: string;
    status: string;
    joined_at: string;
    manager_id?: string | null;
  }> = extMemberQuery.error
    ? (await supabase
        .from("organization_members")
        .select("user_id, role, status, joined_at")
        .eq("organization_id", organizationId)
        .order("joined_at")).data ?? []
    : extMemberQuery.data ?? [];

  const [{ data: workspaces }, { data: canManageOrg }, { data: isOwner }] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("organization_id", organizationId).order("name"),
    supabase.rpc("has_org_role", { target_org: organizationId, allowed_roles: ["owner", "admin"] }),
    supabase.rpc("has_org_role", { target_org: organizationId, allowed_roles: ["owner"] }),
  ]);

  const memberIds = memberships.map((member) => member.user_id);
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

  const getMemberLabel = (uid: string) => {
    const p = profileById.get(uid);
    return p?.display_name?.trim() || p?.email || "Team member";
  };

  // Build reporting tree structure for Organization Hierarchy visualization
  const activeMembers = memberships.filter((m) => m.status === "active");
  const childrenByManager = new Map<string, typeof activeMembers>();
  const topLevelMembers: typeof activeMembers = [];
  const activeIdSet = new Set(activeMembers.map((m) => m.user_id));

  for (const m of activeMembers) {
    const mgr = m.manager_id && activeIdSet.has(m.manager_id) && m.manager_id !== m.user_id ? m.manager_id : null;
    if (!mgr) {
      topLevelMembers.push(m);
    } else {
      childrenByManager.set(mgr, [...(childrenByManager.get(mgr) ?? []), m]);
    }
  }

  function renderHierarchyNodes(nodes: typeof activeMembers, visited = new Set<string>(), depth = 0): React.ReactNode {
    if (nodes.length === 0 || depth > 8) return null;
    return (
      <ul style={{ listStyle: "none", margin: depth === 0 ? 0 : "8px 0 0 22px", padding: depth === 0 ? 0 : "0 0 0 14px", borderLeft: depth === 0 ? "none" : "2px solid var(--line, #dfe5e0)", display: "grid", gap: "8px" }}>
        {nodes.map((node) => {
          if (visited.has(node.user_id)) return null;
          const nextVisited = new Set(visited);
          nextVisited.add(node.user_id);
          const profile = profileById.get(node.user_id);
          const name = getMemberLabel(node.user_id);
          const reports = childrenByManager.get(node.user_id) ?? [];
          return (
            <li key={node.user_id}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "9px", border: "1px solid var(--line, #dfe5e0)", background: "var(--paper, #fff)" }}>
                <span className="organization-member-avatar" style={{ width: 28, height: 28 }}>
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt={name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : (name[0]?.toUpperCase() ?? "U")}
                </span>
                <div>
                  <strong style={{ fontSize: "12.5px", display: "block" }}>{name}</strong>
                  <small style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                    {node.role}{profile?.designation ? ` · ${profile.designation}` : ""}{reports.length > 0 ? ` · ${reports.length} direct report${reports.length === 1 ? "" : "s"}` : ""}
                  </small>
                </div>
              </div>
              {renderHierarchyNodes(reports, nextVisited, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  return <main className="app-shell"><AppTopBar email={user.email ?? ""} organizationId={organizationId}/><section className="organization-members-page"><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>{organization.name}</Link><header className="organization-members-heading"><div><p className="eyebrow">ORGANIZATION DIRECTORY</p><h1>Members, roles &amp; hierarchy</h1><p className="muted">People with access to {organization.name}, workspace roles, and reporting lines for leave approvals.</p></div><span className="organization-members-count"><UsersRound size={16}/>{memberships.length} members</span></header>
  {sp.error && <p className="error" role="alert">Hierarchy or role update could not be saved ({sp.error}). Check permissions and avoid circular reporting.</p>}
  {(sp.hierarchy_updated || sp.member_updated) && <p className="notice" role="status">Organization member settings updated.</p>}
  {!hierarchySupported && <p className="error" role="alert">Run <code>supabase/migrations/202611120003_platform_enhancements.sql</code> in Supabase to enable reporting hierarchy management.</p>}
  <div className="organization-members-table-wrap"><table className="organization-members-table"><thead><tr><th>Member</th><th>Organization role</th><th>Reports to (Manager)</th><th>Workspace access and role</th><th>Status</th><th>Joined</th></tr></thead><tbody>{memberships.map((membership) => {
    const profile = profileById.get(membership.user_id);
    const name = getMemberLabel(membership.user_id);
    const workspaceRoles = workspaceRoleByUser.get(membership.user_id) ?? [];
    const profileDetails = [profile?.designation, profile?.department, profile?.contact_information].filter(Boolean).join(" · ");
    const currentManagerName = membership.manager_id ? getMemberLabel(membership.manager_id) : "Top level (No manager)";
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
    )}</td><td>{isOwner && hierarchySupported ? (
      <form action={updateOrganizationMemberManager} style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="userId" value={membership.user_id} />
        <select
          name="managerId"
          defaultValue={membership.manager_id ?? ""}
          aria-label={`Immediate manager for ${name}`}
          style={{ fontSize: "0.82rem", padding: "0.25rem 0.5rem", borderRadius: "6px", border: "1px solid var(--border-color, #cbd5e1)", maxWidth: "180px" }}
        >
          <option value="">Top level (No manager)</option>
          {activeMembers
            .filter((candidate) => candidate.user_id !== membership.user_id)
            .map((candidate) => (
              <option key={candidate.user_id} value={candidate.user_id}>
                {getMemberLabel(candidate.user_id)} ({candidate.role})
              </option>
            ))}
        </select>
        <button type="submit" className="button button-secondary" style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem" }}>Save</button>
      </form>
    ) : (
      <span style={{ fontSize: "12px", color: membership.manager_id ? "var(--ink)" : "var(--muted)" }}>{currentManagerName}</span>
    )}</td><td>{workspaceRoles.length ? <div className="organization-workspace-roles">{workspaceRoles.map((item) => <span key={`${item.name}-${item.role}`}><strong>{item.name}</strong><small>{item.role}</small></span>)}</div> : <span className="organization-member-muted">No workspace access</span>}</td><td><span className={`organization-member-status status-${membership.status}`}>{membership.status}</span></td><td>{new Date(membership.joined_at).toLocaleDateString()}</td></tr>;
  })}</tbody></table>{!memberships.length && <p className="organization-members-empty">No members found.</p>}</div>

  <section style={{ marginTop: "24px", border: "1px solid var(--line, #dfe5e0)", borderRadius: "12px", padding: "18px 20px", background: "var(--surface, #fff)" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", gap: "10px", flexWrap: "wrap" }}>
      <div>
        <p className="eyebrow" style={{ margin: "0 0 4px" }}>REPORTING STRUCTURE</p>
        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <GitBranch size={17} style={{ color: "var(--green, #167c58)" }} />
          Organization Hierarchy
        </h2>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
          Leave requests are automatically routed &amp; emailed to each member&apos;s immediate reporting manager. {isOwner ? "As Owner, you can update reporting lines above." : "Only the Organization Owner can modify hierarchy."}
        </p>
      </div>
    </header>
    {topLevelMembers.length > 0 ? renderHierarchyNodes(topLevelMembers) : <p className="muted small">No active members in hierarchy.</p>}
  </section>
  </section></main>;
}
