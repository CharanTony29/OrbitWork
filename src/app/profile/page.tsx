import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut, updateMyProfile } from "../actions";
import CurrentUserBadge from "../CurrentUserBadge";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="app-shell"><p className="profile-auth-message">Please sign in to view your personal details.</p></main>;
  const [{ data: profile }, params] = await Promise.all([
    supabase.from("profiles").select("display_name, department, designation, contact_information").eq("id", user.id).maybeSingle(),
    searchParams,
  ]);
  const displayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "Team member";
  return <main className="app-shell">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/><form action={signOut}><button className="quiet-button">Sign out</button></form></div></header>
    <section className="profile-page">
      <Link className="back-link" href="/dashboard"><ArrowLeft size={15}/> Dashboard</Link>
      <header className="profile-heading"><span className="profile-icon"><UserRound size={21}/></span><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>Personal details</h1><p className="muted">Choose how your name appears to teammates across Orbitwork.</p></div></header>
      {params.saved && <p className="notice" role="status">Your profile was updated.</p>}
      {params.error && <p className="error" role="alert">We couldn’t save those details. Check the fields and try again.</p>}
      <form action={updateMyProfile} className="profile-form">
        <div className="profile-section-heading"><h2>Basic information</h2><p>Your email is used for sign-in and invitations. It can’t be changed here.</p></div>
        <label>Display name<input name="displayName" defaultValue={displayName} minLength={2} maxLength={100} autoComplete="name" required/><small>This name appears on tasks, comments, timesheets, and the member directory.</small></label>
        <label>Email address<input value={user.email ?? ""} readOnly disabled/><small>Contact your administrator if your sign-in email needs to change.</small></label>
        <div className="profile-form-columns"><label>Job title<input name="designation" defaultValue={profile?.designation ?? ""} maxLength={100} autoComplete="organization-title" placeholder="e.g. Project manager"/></label><label>Department<input name="department" defaultValue={profile?.department ?? ""} maxLength={100} autoComplete="organization" placeholder="e.g. Operations"/></label></div>
        <label>Contact details<input name="contactInformation" defaultValue={profile?.contact_information ?? ""} maxLength={500} autoComplete="tel" placeholder="Phone number or preferred contact method"/><small>Your title, department, and contact details appear in your organization’s member directory.</small></label>
        <footer><span>Profile changes are saved to your account.</span><button className="button button-primary">Save details</button></footer>
      </form>
    </section>
  </main>;
}
