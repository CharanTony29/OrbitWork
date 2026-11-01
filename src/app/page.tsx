import { signIn, signUp, requestPasswordReset } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return <main className="auth-shell"><section className="auth-card"><Link className="brand" href="/">Orbit<span>work</span></Link><h1>You’re signed in</h1><p>Open your organization workspace to continue.</p><Link className="button button-primary" href="/dashboard">Go to dashboard</Link></section></main>;

  const messages: Record<string, string> = {
    invalid_input: "Enter a valid email and a password with at least 8 characters.",
    sign_in_failed: "Could not sign in. Check your credentials and try again.",
    sign_up_failed: "Could not create your account. Try again.",
    check_email: "Check your email to verify your account, then sign in.",
    pending_approval: "Your registration request has been submitted to the administrator. You will receive an email once your account has been approved.",
    account_rejected: "Your account registration was not approved. Please contact an administrator for assistance.",
    reset_sent: "If an account exists for that address, a password reset email is on its way.",
    verification_failed: "That verification link is invalid or expired. Request a new one.",
  };

  return <main className="auth-shell"><section className="auth-card">
    <Link className="brand" href="/">Orbit<span>work</span></Link>
    <p className="eyebrow">PROJECTS, MADE CLEAR</p><h1>Bring your team’s work together.</h1>
    <p className="muted">Create an account or sign in to manage your organization and workspaces.</p>
    {params.message && <p className="notice" role="status">{messages[params.message] ?? "Done."}</p>}
    {params.error && <p className="error" role="alert">{messages[params.error] ?? "Something went wrong. Please try again."}</p>}
    <form action={signIn} className="form-stack"><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} /></label><button className="button button-primary">Sign in</button></form>
    <div className="auth-divider"><span>new to Orbitwork?</span></div>
    <form action={signUp} className="form-stack"><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>Password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label><button className="button button-secondary">Create account</button></form>
    <form action={requestPasswordReset} className="reset-form"><label>Email<input name="email" type="email" placeholder="For password reset" required /></label><button className="text-button">Send reset link</button></form>
    <p className="fine-print">Email verification and password recovery are handled by your Supabase project.</p>
  </section><aside className="auth-aside"><div className="orb orb-one"/><div className="orb orb-two"/><div className="aside-copy"><p className="eyebrow">A CALMER WAY TO PLAN</p><h2>Make space for the work that matters.</h2><p>Projects, people, and progress—connected in one thoughtful workspace.</p><div className="aside-stats"><div><strong>01</strong><span>Organization</span></div><div><strong>∞</strong><span>Workspaces</span></div><div><strong>✓</strong><span>Team aligned</span></div></div></div><div className="aside-foot">PLAN TOGETHER · MOVE FORWARD</div></aside></main>;
}
import Link from "next/link";
