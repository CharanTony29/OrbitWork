import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp, signInWithMagicLink } from "../actions";
import { createClient } from "@/lib/supabase/server";
import PasswordInput from "@/app/PasswordInput";

export default async function SignupPage({
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
    invalid_input: "Enter a valid email and a password with at least 8 characters.",
    sign_up_failed: "Could not create your account. Please try again or check your credentials.",
    check_email: "Account created! Check your email to verify your address, then sign in.",
    magic_link_sent: "Magic link sent! Check your inbox and click the link to finish setting up your account.",
    magic_link_failed: "Could not send magic link. Check your email address or SMTP settings.",
    sign_in_to_accept: "Create your account to accept your workspace invitation.",
  };

  const returnUrl = params.returnUrl && params.returnUrl.startsWith("/") && !params.returnUrl.startsWith("//") ? params.returnUrl : "";
  const loginLink = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <p className="eyebrow">NEW ACCOUNT</p>
        <h1>Create your account</h1>
        <p className="muted">Get started managing projects, tracking time, and collaborating with your team.</p>

        {params.message && <p className="notice" role="status">{messages[params.message] ?? params.message}</p>}
        {params.error && <p className="error" role="alert">{messages[params.error] ?? params.error}</p>}

        {/* 1. Standard Account Creation */}
        <form action={signUp} className="form-stack">
          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={params.email ?? ""} />
          </label>
          <label>
            Password
            <PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          </label>
          <button className="button button-primary" type="submit">
            Create Account
          </button>
        </form>

        <div className="auth-divider">
          <span>or passwordless signup</span>
        </div>

        {/* 2. Magic Link Signup */}
        <form action={signInWithMagicLink} className="form-stack" style={{ marginTop: 20 }}>
          <input type="hidden" name="from" value="signup" />
          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
          <label>
            Email for Magic Link
            <input name="email" type="email" placeholder="you@company.com" required maxLength={254} defaultValue={params.email ?? ""} />
          </label>
          <button className="button button-secondary" type="submit">
            Sign up with Magic Link
          </button>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
            No password required. We’ll email you a secure direct-access link to instantly start.
          </p>
        </form>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--line)", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link href={loginLink} style={{ color: "var(--green)", fontWeight: 700 }}>
            Sign in
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
