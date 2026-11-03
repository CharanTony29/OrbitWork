import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signInWithMagicLink } from "../actions";
import { createClient } from "@/lib/supabase/server";
import PasswordInput from "@/app/PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; returnUrl?: string; email?: string }>;
}) {
  const params = await searchParams;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      redirect("/dashboard");
    }
  } catch {}

  const messages: Record<string, string> = {
    invalid_input: "Enter a valid email and password.",
    sign_in_failed: "Invalid credentials. Please verify your email and password, then try again.",
    magic_link_sent: "A magic sign-in link has been sent to your email! Click the link in your inbox to sign in instantly.",
    magic_link_failed: "Could not send magic link. Please check your email or custom SMTP settings.",
    sign_in_to_accept: "Sign in or create an account to accept your workspace invitation.",
    verification_failed: "That verification link is invalid or has expired. Please request a new one.",
    password_updated: "Your password has been reset successfully. Please sign in with your new password.",
  };

  const returnUrl = params.returnUrl && params.returnUrl.startsWith("/") && !params.returnUrl.startsWith("//") ? params.returnUrl : "";
  const signupLink = returnUrl ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}` : "/signup";
  const resetLink = returnUrl ? `/reset-password?returnUrl=${encodeURIComponent(returnUrl)}` : "/reset-password";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to Orbitwork</h1>
        <p className="muted">Choose password login or get a magic link sent to your email.</p>

        {params.message && <p className="notice" role="status">{messages[params.message] ?? params.message}</p>}
        {params.error && <p className="error" role="alert">{messages[params.error] ?? params.error}</p>}

        {/* 1. Password Login */}
        <form action={signIn} className="form-stack">
          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={params.email ?? ""} />
          </label>
          <label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Password</span>
              <Link href={resetLink} style={{ color: "var(--green)", fontSize: "11px", fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            <PasswordInput name="password" autoComplete="current-password" required minLength={8} maxLength={128} />
          </label>
          <button className="button button-primary" type="submit">
            Sign in with Password
          </button>
        </form>

        <div className="auth-divider">
          <span>or passwordless</span>
        </div>

        {/* 2. Magic Link Login */}
        <form action={signInWithMagicLink} className="form-stack" style={{ marginTop: 20 }}>
          <input type="hidden" name="from" value="login" />
          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
          <label>
            Email for Magic Link
            <input name="email" type="email" placeholder="you@company.com" required maxLength={254} defaultValue={params.email ?? ""} />
          </label>
          <button className="button button-secondary" type="submit">
            Send Magic Sign-in Link
          </button>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
            We’ll send a secure one-click sign-in link to your inbox. No password required.
          </p>
        </form>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--line)", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          Don’t have an account?{" "}
          <Link href={signupLink} style={{ color: "var(--green)", fontWeight: 700 }}>
            Create an account
          </Link>
        </div>
      </section>

      <aside className="auth-aside">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="aside-copy">
          <p className="eyebrow">A CALMER WAY TO PLAN</p>
          <h2>Make space for the work that matters.</h2>
          <p>Projects, people, and progress—connected in one thoughtful workspace.</p>
          <div className="aside-stats">
            <div><strong>01</strong><span>Organization</span></div>
            <div><strong>∞</strong><span>Workspaces</span></div>
            <div><strong>✓</strong><span>Team aligned</span></div>
          </div>
        </div>
        <div className="aside-foot">PLAN TOGETHER · MOVE FORWARD</div>
      </aside>
    </main>
  );
}
