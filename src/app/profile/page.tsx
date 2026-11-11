import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateMyProfile } from "../actions";
import AppTopBar from "../AppTopBar";
import {
  ChangePasswordSection,
  DeleteAccountSection,
  ProfileAvatarSection,
} from "./ProfileSettingsClient";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="app-shell"><p className="profile-auth-message">Please sign in to view your personal details.</p></main>;
  const [{ data: profile }, params] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, department, designation, contact_information").eq("id", user.id).maybeSingle(),
    searchParams,
  ]);
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Team member";
  const hasPasswordProvider =
    (user.identities ?? []).some((id) => id.provider === "email") ||
    user.app_metadata?.provider === "email";

  return <main className="app-shell">
    <AppTopBar email={user.email ?? ""} />
    <section className="profile-page">
      <Link className="back-link" href="/dashboard"><ArrowLeft size={15}/> Dashboard</Link>
      <header className="profile-heading"><span className="profile-icon"><UserRound size={21}/></span><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>Personal details</h1><p className="muted">Manage your avatar, profile information, password, and privacy settings.</p></div></header>
      {params.saved && <p className="notice" role="status">Your profile was updated.</p>}
      {params.error && <p className="error" role="alert">We couldn’t save those details. Check the fields and try again.</p>}

      <div className="profile-settings-stack">
        <ProfileAvatarSection
          initialAvatarUrl={profile?.avatar_url ?? null}
          displayName={displayName}
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
  </main>;
}
