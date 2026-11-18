import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateMyProfile } from "../actions";
import AppTopBar from "../AppTopBar";
import AppRailLayout from "../AppRailLayout";
import {
  ChangePasswordSection,
  DeleteAccountSection,
  ProfileAvatarSection,
} from "./ProfileSettingsClient";
import PersonalCloudStorageSection from "./PersonalCloudStorageSection";
import {
  getUserApplicableOrgPolicies,
  getUserPersonalCloudConnections,
  toPublicCloudConnection,
} from "@/lib/personal-cloud";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    cloud_connected?: string;
    cloud_error?: string;
    cloud_detail?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="app-shell"><p className="profile-auth-message">Please sign in to view your personal details.</p></main>;
  const [{ data: profile }, params, personalCloud, orgPolicies] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, department, designation, contact_information").eq("id", user.id).maybeSingle(),
    searchParams,
    getUserPersonalCloudConnections(supabase, user.id),
    getUserApplicableOrgPolicies(supabase, user.id),
  ]);
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Team member";
  const hasPasswordProvider =
    (user.identities ?? []).some((id) => id.provider === "email") ||
    user.app_metadata?.provider === "email";

  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY
  );
  const microsoftConfigured = Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );

  const cloudErrorMessages: Record<string, string> = {
    policy_violation:
      params.cloud_detail ||
      "This cloud account is not permitted by your organization's chat storage policy.",
    not_configured: "Cloud OAuth credentials are not configured on this server yet.",
    invalid_state: "Your OAuth session expired. Please try connecting again.",
    cancelled: "Cloud storage connection was cancelled.",
    session_changed: "Your login session changed. Please sign in and try again.",
    token_exchange_failed: "Could not complete cloud sign-in. Please try again.",
    missing_refresh_token:
      "Offline access token was not granted. Please reconnect and approve drive permissions.",
    save_failed: params.cloud_detail
      ? `Could not save cloud connection: ${params.cloud_detail}`
      : "Could not save your cloud connection. Please check that the database migration is applied.",
    connection_failed: params.cloud_detail
      ? `Connection error: ${params.cloud_detail}`
      : "An unexpected error occurred while connecting your cloud storage.",
  };

  return (
    <AppRailLayout>
      <main className="app-shell">
        <AppTopBar email={user.email ?? ""} />
        <section className="profile-page">
      <Link className="back-link" href="/dashboard"><ArrowLeft size={15}/> Dashboard</Link>
      <header className="profile-heading"><span className="profile-icon"><UserRound size={21}/></span><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>Personal details</h1><p className="muted">Manage your avatar, profile information, password, and privacy settings.</p></div></header>
      {params.saved && <p className="notice" role="status">Your profile was updated.</p>}
      {params.error && <p className="error" role="alert">We couldn’t save those details. Check the fields and try again.</p>}
      {params.cloud_connected && (
        <p className="notice" role="status">
          Personal {params.cloud_connected === "onedrive" ? "Microsoft OneDrive" : "Google Drive"} connected for private chat &amp; group attachments.
        </p>
      )}
      {params.cloud_error && (
        <p className="error" role="alert">
          {cloudErrorMessages[params.cloud_error] ?? "Could not connect your personal cloud drive."}
        </p>
      )}

      <div className="profile-settings-stack">
        <ProfileAvatarSection
          initialAvatarUrl={profile?.avatar_url ?? null}
          displayName={displayName}
        />

        <PersonalCloudStorageSection
          initialConnections={personalCloud.connections.map(toPublicCloudConnection)}
          policies={orgPolicies}
          googleConfigured={googleConfigured}
          microsoftConfigured={microsoftConfigured}
          migrationMissing={personalCloud.migrationMissing}
        />

        <form action={updateMyProfile} className="profile-form">
          <div className="profile-section-heading"><h2>Basic information</h2><p>Your email is used for sign-in and invitations. It can’t be changed here.</p></div>
          <label>Display name<input name="displayName" defaultValue={displayName} minLength={2} maxLength={100} autoComplete="name" required/><small>This name appears on tasks, comments, timesheets, and the member directory.</small></label>
          <label>Email address<input value={user.email ?? ""} readOnly disabled/><small>Contact your administrator if your sign-in email needs to change.</small></label>
          <div className="profile-form-columns"><label>Job title<input name="designation" defaultValue={profile?.designation ?? ""} maxLength={100} autoComplete="organization-title" placeholder="e.g. Project manager"/></label><label>Department<input name="department" defaultValue={profile?.department ?? ""} maxLength={100} autoComplete="organization" placeholder="e.g. Operations"/></label></div>
          <label>Contact details<input name="contactInformation" defaultValue={profile?.contact_information ?? ""} maxLength={500} autoComplete="tel" placeholder="Phone number or preferred contact method"/><small>Leave optional fields empty if you prefer not to store them. Saved fields appear in your organization’s member directory.</small></label>
          <footer><span>Only fields you provide are stored on your account.</span><button className="button button-primary">Save details</button></footer>
        </form>

        <ChangePasswordSection hasPasswordProvider={hasPasswordProvider} />

        <DeleteAccountSection
          initialAvatarUrl={profile?.avatar_url ?? null}
          displayName={displayName}
          email={user.email ?? ""}
        />
      </div>
    </section>
  </main>
  </AppRailLayout>
  );
}
