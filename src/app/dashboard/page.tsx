import { redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import PrimarySpaceLeftSlot from "@/app/PrimarySpaceLeftSlot";
import AppRailLayout from "@/app/AppRailLayout";
import { getUserSpaceData } from "@/lib/workspace-space";
import { createClient } from "@/lib/supabase/server";
import { approveDeletionRequest, rejectDeletionRequest } from "@/app/actions";
import OverviewCommandCenter from "./OverviewCommandCenter";

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
  workspace_create_forbidden: "Only Organization Owners, Co-Owners, and Admins can create workspaces.",
  workspace_delete_forbidden: "Only Organization Owners can delete workspaces directly. Co-Owners must submit a deletion request.",
  invalid_organization: "Enter an organization name with at least two characters.",
  organization_failed: "The organization could not be created. Please try again.",
  organization_delete_confirmation: "Enter the exact organization name to confirm deletion.",
  organization_delete_forbidden: "Only an organization owner can delete an organization directly. Co-Owners must submit a deletion request.",
  organization_delete_failed: "The organization could not be deleted. Please try again.",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    info?: string;
    invited?: string;
    invitation_accepted?: string;
    organization_deleted?: string;
    organization_created?: string;
    deletion_approved?: string;
    deletion_rejected?: string;
  }>;
}) {
  const space = await getUserSpaceData();
  if (!space) redirect("/login");
  const {
    user,
    displayName,
    organizations,
    workspaces,
    projects,
    organizationMembers,
    assignedTaskCount,
  } = space;
  const params = await searchParams;

  const ownerOrgIds = organizationMembers
    .filter((m) => m.role === "owner")
    .map((m) => m.organization_id);

  let pendingDeletionRequests: Array<{
    id: string;
    organization_id: string;
    resource_type: string;
    resource_id: string;
    resource_name: string;
    requested_by: string;
    status: string;
    created_at: string;
  }> = [];

  if (ownerOrgIds.length > 0) {
    const supabase = await createClient();
    const { data: requests } = await supabase
      .from("deletion_requests")
      .select("id, organization_id, resource_type, resource_id, resource_name, requested_by, status, created_at")
      .in("organization_id", ownerOrgIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    pendingDeletionRequests = requests ?? [];
  }

  const banner = (
    <>
      {params.error && (
        <p className="error banner-error ov-status-banner" role="alert">
          {dashboardErrorMessages[params.error] ??
            decodeURIComponent(params.error)}
        </p>
      )}
      {params.info === "deletion_request_submitted" && (
        <p className="notice ov-status-banner" role="status">
          Deletion request submitted. The Organization Owner has been notified for approval.
        </p>
      )}
      {params.deletion_approved && (
        <p className="notice ov-status-banner" role="status">
          Deletion request approved. The resource has been permanently deleted.
        </p>
      )}
      {params.deletion_rejected && (
        <p className="notice ov-status-banner" role="status">
          Deletion request rejected.
        </p>
      )}
      {pendingDeletionRequests.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 18px",
            borderRadius: 10,
            border: "1px solid #f97316",
            background: "#fff7ed",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <strong style={{ fontSize: 13.5, color: "#9a3412" }}>
              Action Required: Deletion Approval Requests ({pendingDeletionRequests.length})
            </strong>
            <span style={{ fontSize: 12, color: "#c2410c" }}>
              Co-Owners submitted these requests for your Owner review &amp; approval
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingDeletionRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#fff",
                  border: "1px solid #fed7aa",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    Delete {req.resource_type}: <strong>&quot;{req.resource_name}&quot;</strong>
                  </span>
                  <small style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>
                    Submitted {new Date(req.created_at).toLocaleString()}
                  </small>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <form action={rejectDeletionRequest}>
                    <input type="hidden" name="requestId" value={req.id} />
                    <button
                      type="submit"
                      className="button button-secondary"
                      style={{ padding: "4px 10px", fontSize: 12, minHeight: 28 }}
                    >
                      Reject
                    </button>
                  </form>
                  <form action={approveDeletionRequest}>
                    <input type="hidden" name="requestId" value={req.id} />
                    <button
                      type="submit"
                      className="button"
                      style={{
                        padding: "4px 12px",
                        fontSize: 12,
                        minHeight: 28,
                        background: "#dc2626",
                        color: "#fff",
                        border: "1px solid #b91c1c",
                        cursor: "pointer",
                        fontWeight: 600,
                        borderRadius: 6,
                      }}
                    >
                      Approve &amp; Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {params.invited && (
        <p className="notice ov-status-banner" role="status">
          {Number(params.invited) > 1
            ? `Invitation emails sent to ${params.invited} people.`
            : "Invitation email sent."}
        </p>
      )}
      {params.invitation_accepted && (
        <p className="notice ov-status-banner" role="status">
          Invitation accepted. You now have access to the workspace.
        </p>
      )}
      {params.organization_deleted && (
        <p className="notice ov-status-banner" role="status">
          Organization deleted.
        </p>
      )}
      {params.organization_created && (
        <p className="notice ov-status-banner" role="status">
          Organization created.
        </p>
      )}
    </>
  );

  return (
    <AppRailLayout
      organizationId={organizations[0]?.id}
      organizationName={organizations[0]?.name}
      workspaceId={workspaces[0]?.id}
      projectId={projects[0]?.id}
    >
      <main className="app-shell ov-shell ov-fullpage-shell">
        <AppTopBar
          email={user.email ?? ""}
          leftSlot={
            <PrimarySpaceLeftSlot
              activeNav="overview"
              assignedTaskCount={assignedTaskCount}
            />
          }
        />
        <section className="ov-fullpage-content">
          <OverviewCommandCenter
            displayName={displayName}
            organizations={organizations}
            workspaces={workspaces}
            projects={projects}
            organizationMembers={organizationMembers}
            banner={banner}
            refreshKey={JSON.stringify(params)}
          />
        </section>
      </main>
    </AppRailLayout>
  );
}
