import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "../actions";

export default async function RequestResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    code?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;

  if (params.code) {
    const cbQuery = new URLSearchParams();
    cbQuery.set("code", params.code);
    if (params.type) cbQuery.set("type", params.type);
    if (params.next) cbQuery.set("next", params.next);
    redirect(`/auth/callback?${cbQuery.toString()}`);
  }

  if (params.type === "recovery" || params.next?.includes("reset-password")) {
    redirect("/auth/reset-password");
  }

  const messages: Record<string, string> = {
    invalid_input: "Please enter a valid email address.",
    reset_sent: "If an account exists with that address, a fresh password reset link has been dispatched to your email. Check your inbox and spam folder.",
    link_expired: "That password reset link has expired or has already been used. Enter your email below to request a fresh link.",
    verification_failed: "That reset link is invalid or has expired. Enter your email below to request a fresh link.",
    reset_send_failed: "Could not dispatch reset email. Please verify your address and try again.",
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <p className="eyebrow">RECOVER ACCESS</p>
        <h1>Reset your password</h1>
        <p className="muted">Enter your account email and we’ll send you a link to reset your password.</p>

        {params.message && <p className="notice" role="status">{messages[params.message] ?? params.message}</p>}
        {params.error && <p className="error" role="alert">{messages[params.error] ?? params.error}</p>}

        <form action={requestPasswordReset} className="form-stack">
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" />
          </label>
          <button className="button button-primary" type="submit">
            Send Reset Link
          </button>
        </form>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--line)", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          Remember your password?{" "}
          <Link href="/login" style={{ color: "var(--green)", fontWeight: 700 }}>
            Back to sign in
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
