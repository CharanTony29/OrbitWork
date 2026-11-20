import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import AppRailLayout from "@/app/AppRailLayout";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Brain, FolderKanban, Layers3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import TimesheetExportButton from "@/app/timesheets/TimesheetExportButton";
import DeleteWorkspaceButton from "@/app/workspaces/DeleteWorkspaceButton";

export default async function OrganizationWorkspacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ workspace_deleted?: string; error?: string }>;
}) {
  const { organizationId } = await params;
  const { workspace_deleted, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();
  if (!organization) notFound();

  const [{ data: workspaces }, { data: isOrgOwner }, { data: isOrgCoOwner }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, description, created_at")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase.rpc("has_org_role", {
      target_org: organizationId,
      allowed_roles: ["owner"],
    }),
    supabase.rpc("has_org_role", {
      target_org: organizationId,
      allowed_roles: ["co_owner"],
    }),
  ]);

  const workspaceIds = (workspaces ?? []).map((w) => w.id);
  const [{ data: projects }, { data: workspaceMembers }] = await Promise.all([
    workspaceIds.length
      ? supabase.from("projects").select("id, workspace_id").in("workspace_id", workspaceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; workspace_id: string }> }),
    workspaceIds.length
      ? supabase
          .from("workspace_members")
          .select("workspace_id, user_id, status")
          .in("workspace_id", workspaceIds)
          .eq("status", "active")
      : Promise.resolve({
          data: [] as Array<{ workspace_id: string; user_id: string; status: string }>,
        }),
  ]);

  const projectCountByWorkspace = new Map<string, number>();
  for (const project of projects ?? []) {
    projectCountByWorkspace.set(
      project.workspace_id,
      (projectCountByWorkspace.get(project.workspace_id) ?? 0) + 1
    );
  }

  const memberCountByWorkspace = new Map<string, number>();
  for (const member of workspaceMembers ?? []) {
    memberCountByWorkspace.set(
      member.workspace_id,
      (memberCountByWorkspace.get(member.workspace_id) ?? 0) + 1
    );
  }

  return (
    <AppRailLayout organizationId={organizationId}>
      <main className="app-shell">
        <AppTopBar email={user.email ?? ""} organizationId={organizationId} />
        <section className="organization-members-page">
        <Link className="back-link" href="/dashboard">
          <ArrowLeft size={15} />
          {organization.name}
        </Link>
        <header className="organization-members-heading">
          <div>
            <p className="eyebrow">ORGANIZATION WORKSPACES</p>
            <h1>All workspaces</h1>
            <p className="muted">
              Workspaces inside {organization.name}, including projects and active members.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href={`/organizations/${organizationId}/brain`}
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "7px 12px", height: 36 }}
            >
              <Brain size={15} color="#4f46e5" />
              <span>Organization Brain</span>
            </Link>
            <TimesheetExportButton
              scope="organization"
              targetId={organizationId}
              scopeName={organization.name}
            />
            <span className="organization-members-count">
              <Layers3 size={16} />
              {workspaces?.length ?? 0} workspaces
            </span>
          </div>
        </header>
        {workspace_deleted && (
          <p className="notice" role="status">Workspace permanently deleted.</p>
        )}
        {error && (
          <p className="error" role="alert">Could not complete workspace action ({error}).</p>
        )}
        <div className="organization-members-table-wrap">
          <table className="organization-members-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Projects</th>
                <th>Members</th>
                <th>Created</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {(workspaces ?? []).map((workspace) => {
                const projectCount = projectCountByWorkspace.get(workspace.id) ?? 0;
                const memberCount = memberCountByWorkspace.get(workspace.id) ?? 0;
                return (
                  <tr key={workspace.id}>
                    <td>
                      <Link
                        href={`/workspaces/${workspace.id}`}
                        className="organization-member-person"
                        style={{ textDecoration: "none" }}
                      >
                        <span className="organization-member-avatar">
                          <FolderKanban size={15} />
                        </span>
                        <span>
                          <strong>{workspace.name}</strong>
                          {workspace.description && <small>{workspace.description}</small>}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="organization-role-badge">
                        {projectCount} {projectCount === 1 ? "project" : "projects"}
                      </span>
                    </td>
                    <td>
                      <span className="organization-member-status status-active">
                        {memberCount} {memberCount === 1 ? "member" : "members"}
                      </span>
                    </td>
                    <td>{new Date(workspace.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Link
                          href={`/workspaces/${workspace.id}`}
                          className="button button-secondary"
                          style={{
                            minHeight: 30,
                            padding: "0 10px",
                            fontSize: "0.78rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>Open</span>
                          <ArrowUpRight size={13} />
                        </Link>
                        {(Boolean(isOrgOwner) || Boolean(isOrgCoOwner)) && (
                          <DeleteWorkspaceButton
                            workspaceId={workspace.id}
                            workspaceName={workspace.name}
                            returnTo={`/organizations/${organizationId}/workspaces`}
                            compact
                            isCoOwner={!isOrgOwner && Boolean(isOrgCoOwner)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!workspaces?.length && (
            <p className="organization-members-empty">No workspaces found in this organization.</p>
          )}
        </div>
      </section>
    </main>
    </AppRailLayout>
  );
}
