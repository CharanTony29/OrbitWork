import { notFound, redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import Link from "next/link";
import { ArrowLeft, Brain, Clock3, FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { removeWorkspaceMember, updateWorkspaceMemberRole } from "@/app/actions";
import WorkspaceProjectsList from "./WorkspaceProjectsList";
import WorkspaceInviteSection from "./WorkspaceInviteSection";
import WorkspaceStorageSection from "./WorkspaceStorageSection";
import DeleteWorkspaceButton from "../DeleteWorkspaceButton";
import { getWorkspaceStorageConfig } from "@/lib/storage-config";
import TimesheetExportButton from "@/app/timesheets/TimesheetExportButton";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    error?: string;
    member_added?: string;
    member_removed?: string;
    member_updated?: string;
    invited?: string;
    status_updated?: string;
    project_deleted?: string;
    drive?: string;
    storage?: string;
  }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Automatically process any pending invitations for this user
  try {
    await supabase.rpc("accept_user_pending_invitations");
  } catch {}

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, description, organization_id, created_by")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) notFound();

  const [
    { data: projects },
    { data: organizationMembers },
    { data: workspaceMembers },
    { data: canManage },
    { data: canCreateProj },
    { data: isOrgOwner },
    { data: isOrgCoOwner },
    { data: isOrgAdmin },
    { data: driveConnection },
    storageInfo,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, status, priority, due_date, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", workspace.organization_id)
      .eq("status", "active"),
    supabase
      .from("workspace_members")
      .select("user_id, role, status")
      .eq("workspace_id", workspaceId),
    supabase.rpc("can_manage_workspace", { target_workspace: workspaceId }),
    supabase.rpc("can_create_project", { target_workspace: workspaceId }),
    supabase.rpc("has_org_role", {
      target_org: workspace.organization_id,
      allowed_roles: ["owner"],
    }),
    supabase.rpc("has_org_role", {
      target_org: workspace.organization_id,
      allowed_roles: ["co_owner"],
    }),
    supabase.rpc("has_org_role", {
      target_org: workspace.organization_id,
      allowed_roles: ["owner", "co_owner", "admin"],
    }),
    supabase
      .from("google_drive_connections")
      .select("id, connected_at, updated_at, connected_by, account_email, folder_name")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    getWorkspaceStorageConfig(supabase, workspaceId, workspace.organization_id),
  ]);

  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI &&
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY
  );

  const microsoftConfigured = Boolean(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET
  );

  const memberIds = [
    ...new Set([
      ...(organizationMembers ?? []).map((member) => member.user_id),
      ...(workspaceMembers ?? []).map((member) => member.user_id),
    ]),
  ];

  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", memberIds)
    : { data: [] };

  const people = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.display_name?.trim() || profile.email || "Team member",
    ])
  );

  const activeWorkspaceMembers = (workspaceMembers ?? []).filter(
    (member) => member.status === "active"
  );
  const activeWorkspaceMemberIds = new Set(
    activeWorkspaceMembers.map((member) => member.user_id)
  );
  const availableMembers = (organizationMembers ?? [])
    .filter((member) => !activeWorkspaceMemberIds.has(member.user_id))
    .map((member) => ({
      user_id: member.user_id,
      name: people.get(member.user_id) ?? "Team member",
    }));

  const { error, member_added, member_removed, member_updated, invited, status_updated, project_deleted, drive, storage } =
    await searchParams;

  const memberErrors: Record<string, string> = {
    workspace_member_forbidden:
      "Only a workspace owner, admin, or manager can change workspace access.",
    workspace_member_not_in_org:
      "Only active organization members can be added to this workspace.",
    workspace_member_add_failed:
      "The member could not be added. Check the workspace access migration and try again.",
    workspace_member_remove_failed:
      "The member could not be removed. Check your workspace role and the workspace access migration.",
    workspace_delete_forbidden:
      "Only an organization owner or admin can permanently delete a workspace.",
    workspace_delete_confirmation:
      "Workspace name confirmation did not match.",
    workspace_delete_failed:
      "Could not delete this workspace. Please try again.",
  };

  return (
    <main className="app-shell">
      <AppTopBar
        email={user.email ?? ""}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        organizationId={workspace.organization_id}
      />

      <div className="workspace-page">
        <Link className="back-link" href="/dashboard">
          <ArrowLeft size={15} /> All organizations
        </Link>

        <div className="workspace-heading">
          <div>
            <p className="eyebrow">WORKSPACE</p>
            <h1>{workspace.name}</h1>
            <p className="muted">
              {workspace.description || "Projects and shared work in one place."}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link
              href={`/workspaces/${workspaceId}/brain`}
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", minHeight: 34 }}
            >
              <Brain size={14} color="#6366f1" />
              <span>Workspace Brain</span>
            </Link>
            <Link
              href={`/workspaces/${workspaceId}/timesheets`}
              className="button button-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", minHeight: 34 }}
            >
              <Clock3 size={14} />
              <span>Timesheets</span>
            </Link>
            <TimesheetExportButton
              scope="workspace"
              targetId={workspaceId}
              scopeName={workspace.name}
              label="Export Timesheets Excel"
            />
            {(Boolean(isOrgOwner) || Boolean(isOrgCoOwner)) && (
              <DeleteWorkspaceButton
                workspaceId={workspaceId}
                workspaceName={workspace.name}
                returnTo={`/organizations/${workspace.organization_id}/workspaces`}
                isCoOwner={!isOrgOwner && Boolean(isOrgCoOwner)}
              />
            )}
            <div className="workspace-symbol">
              <FolderKanban size={22} />
            </div>
          </div>
        </div>

        {invited && <p className="notice" role="status">{Number(invited) > 1 ? `Invitation emails sent to ${invited} people.` : "Invitation email sent."}</p>}
        {member_added && <p className="notice" role="status">Workspace access added.</p>}
        {member_removed && <p className="notice" role="status">Workspace access removed.</p>}
        {member_updated && <p className="notice" role="status">Workspace member role updated.</p>}
        {status_updated && <p className="notice" role="status">Project status updated.</p>}
        {project_deleted && <p className="notice" role="status">Project permanently deleted.</p>}
        {error && (
          <p className="error" role="alert">
            {memberErrors[error] ?? "That change could not be saved. Check your access and try again."}
          </p>
        )}

        {/* 1. Projects Directory with Compact Top Creator & Inactive/Active Filter */}
        <WorkspaceProjectsList
          workspaceId={workspaceId}
          projects={(projects ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            priority: p.priority,
            due_date: p.due_date,
            created_at: p.created_at,
          }))}
          canManage={Boolean(canManage || canCreateProj || isOrgOwner || isOrgCoOwner || isOrgAdmin)}
          isCoOwner={!isOrgOwner && Boolean(isOrgCoOwner)}
        />

        {/* 2. Workspace Access & Professional Member Management */}
        <section className="workspace-access-section">
          <header>
            <div>
              <p className="eyebrow">WORKSPACE ACCESS</p>
              <h2>
                Members <span className="count-pill">{activeWorkspaceMembers.length}</span>
              </h2>
            </div>
          </header>

          {activeWorkspaceMembers.length ? (
            <div className="workspace-member-list">
              {activeWorkspaceMembers.map((member) => (
                <div className="workspace-member-row" key={member.user_id}>
                  <span className="organization-member-avatar">
                    {(people.get(member.user_id) ?? "T")[0].toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <strong>{people.get(member.user_id) ?? "Team member"}</strong>
                  </div>
                  {canManage ? (
                    <form
                      action={updateWorkspaceMemberRole}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="userId" value={member.user_id} />
                      <select
                        name="role"
                        defaultValue={member.role}
                        style={{
                          height: 30,
                          lineHeight: "28px",
                          fontSize: 11,
                          padding: "0 8px",
                          borderRadius: 6,
                          border: "1px solid #dfe5e0",
                          background: "#fff",
                          verticalAlign: "middle",
                        }}
                      >
                        <option value="viewer">Viewer (Read-only)</option>
                        <option value="member">Member (Can edit &amp; upload)</option>
                        <option value="manager">Manager</option>
                        {isOrgAdmin && <option value="admin">Admin</option>}
                      </select>
                      <button
                        type="submit"
                        className="button button-secondary"
                        style={{ minHeight: 28, padding: "0 10px", fontSize: 11 }}
                      >
                        Update
                      </button>
                    </form>
                  ) : (
                    <span className="role-pill">{member.role}</span>
                  )}
                  {canManage && (
                    <form action={removeWorkspaceMember}>
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="userId" value={member.user_id} />
                      <button className="mini-remove">Remove</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">
              No one has explicit workspace access yet. Organization owners and admins can still access it.
            </p>
          )}

          {/* Professional Add or Invite Workspace Members Section */}
          {Boolean(canManage || isOrgOwner || isOrgCoOwner || isOrgAdmin || workspace.created_by === user.id) && (
            <WorkspaceInviteSection
              workspaceId={workspaceId}
              organizationId={workspace.organization_id}
              availableMembers={availableMembers}
              isOrgAdmin={Boolean(isOrgAdmin || isOrgOwner || isOrgCoOwner || workspace.created_by === user.id)}
            />
          )}
        </section>

        {/* 3. Workspace Storage & Cloud Integrations (Local, Google Drive, OneDrive, SharePoint) */}
        <WorkspaceStorageSection
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          storageInfo={storageInfo}
          driveConnection={driveConnection}
          canManage={Boolean(canManage || canCreateProj || isOrgOwner || isOrgCoOwner || isOrgAdmin)}
          googleConfigured={configured}
          microsoftConfigured={microsoftConfigured}
          driveStatus={drive}
          storageStatus={storage}
        />
      </div>
    </main>
  );
}
