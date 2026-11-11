import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Layers3, LayoutDashboard, MessageSquare } from "lucide-react";
import AppTopBar from "@/app/AppTopBar";
import { getUserSpaceData } from "@/lib/workspace-space";
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
  invalid_organization: "Enter an organization name with at least two characters.",
  organization_failed: "The organization could not be created. Please try again.",
  organization_delete_confirmation: "Enter the exact organization name to confirm deletion.",
  organization_delete_forbidden: "Only an organization owner can delete an organization.",
  organization_delete_failed: "The organization could not be deleted. Please try again.",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    invited?: string;
    invitation_accepted?: string;
    organization_deleted?: string;
    organization_created?: string;
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

  const banner = (
    <>
      {params.error && (
        <p className="error banner-error ov-status-banner" role="alert">
          {dashboardErrorMessages[params.error] ??
            "That action could not be completed. Check your access and Supabase configuration."}
        </p>
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
    <main className="app-shell ov-shell ov-fullpage-shell">
      <AppTopBar
        email={user.email ?? ""}
        leftSlot={
          <div className="ov-topbar-left-nav">
            <Link className="brand ov-brand" href="/dashboard">
              <span className="brand-mark">O</span>
              <span>
                Orbit<span className="ov-brand-accent">Work</span>
              </span>
            </Link>
            <nav className="ov-topbar-links" aria-label="Primary navigation">
              <Link href="/dashboard" className="is-active" aria-current="page">
                <Layers3 size={14} />
                <span>Overview</span>
              </Link>
              <Link href="/my-dashboard">
                <LayoutDashboard size={14} />
                <span>Dashboard</span>
              </Link>
              <Link href="/inbox">
                <Bell size={14} />
                <span>Inbox</span>
                {assignedTaskCount > 0 && (
                  <span className="ov-topbar-count">{assignedTaskCount}</span>
                )}
              </Link>
              <Link href="/chat">
                <MessageSquare size={14} />
                <span>Chat</span>
              </Link>
            </nav>
          </div>
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
  );
}
