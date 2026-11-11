import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signInWithMagicLink } from "../actions";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_detail?: string; message?: string; returnUrl?: string; email?: string }>;
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
    magic_link_sent: "A password-less sign-in link has been sent to your email! Click the link in your inbox to sign in instantly.",
    magic_link_failed: "Could not send password-less sign-in link. Please check your email or custom SMTP settings.",
    account_deleted: "Your account and all personal information have been permanently erased from Orbitwork.",
    sign_in_to_accept: "Sign in or create an account to accept your workspace invitation.",
    verification_failed: "That verification link is invalid or has expired. Please request a new one.",
    oauth_cookie_blocked:
      "Sign-in session expired or browser cookies were blocked during redirect. Please allow cookies and try signing in again.",
    oauth_failed: "Could not complete social sign-in. Please try again.",
    oauth_missing_code:
      "Sign-in could not be completed because the authorization session expired or was interrupted. Please try again.",
    password_updated: "Your password has been reset successfully. Please sign in with your new password.",
  };

  const isOAuthError =
    params.error === "oauth_cookie_blocked" ||
    params.error === "oauth_failed" ||
    params.error === "oauth_missing_code";

  const returnUrl = params.returnUrl && params.returnUrl.startsWith("/") && !params.returnUrl.startsWith("//") ? params.returnUrl : "";
  const signupLink = returnUrl ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}` : "/signup";
  const resetLink = returnUrl ? `/reset-password?returnUrl=${encodeURIComponent(returnUrl)}` : "/reset-password";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <p className="eyebrow" style={{ marginTop: 18, marginBottom: 6 }}>WELCOME BACK</p>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Sign in to Orbitwork</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Choose password login or get a password-less sign-in link sent to your email.</p>

        {params.message && <p className="notice" role="status" style={{ margin: "10px 0" }}>{messages[params.message] ?? params.message}</p>}
        {params.error && (
          <div className="error" role="alert" style={{ margin: "10px 0" }}>
            <p style={{ margin: 0 }}>{messages[params.error] ?? params.error}</p>
            {params.error_detail && (
              <p style={{ margin: "5px 0 0", fontSize: 11.5, opacity: 0.9 }}>
                Details: {params.error_detail}
              </p>
            )}
            {isOAuthError && (
              <p style={{ margin: "6px 0 0", fontSize: 11.5, opacity: 0.9 }}>
                Tip: Please ensure cookies are enabled, avoid double-clicking, and use a standard browser tab.
              </p>
            )}
            {params.error === "verification_failed" && (
              <p style={{ margin: "6px 0 0", fontSize: 12 }}>
                Need to reset your password?{" "}
                <Link href="/reset-password" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}>
                  Request a new reset link &rarr;
                </Link>
              </p>
            )}
          </div>
        )}

        <LoginForm
          returnUrl={returnUrl}
          emailDefault={params.email ?? ""}
          signInAction={signIn}
          magicLinkAction={signInWithMagicLink}
          resetLink={resetLink}
        />

        <div className="auth-footer-link">
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
            <div><strong>100%</strong><span>Clarity</span></div>
          </div>
        </div>
        <div className="aside-foot">ORBITWORK · PRODUCTIVITY PLATFORM</div>
      </aside>
    </main>
  );
}
