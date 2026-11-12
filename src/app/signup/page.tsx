import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp, signInWithMagicLink } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { buildPublicMetadata } from "@/lib/seo";
import { BrandMark } from "../BrandMark";
import SignupForm from "./SignupForm";

export const metadata: Metadata = buildPublicMetadata({
  title: "Create Free Account",
  description:
    "Create your free Orbitwork workspace for project management, Kanban & Gantt workflows, team docs, time tracking, and real-time chat.",
  path: "/signup",
});

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
    magic_link_sent: "Password-less sign-in link sent! Check your inbox and click the link to finish setting up your account.",
    magic_link_failed: "Could not send password-less sign-in link. Check your email address or SMTP settings.",
    sign_in_to_accept: "Create your account to accept your workspace invitation.",
  };

  const returnUrl = params.returnUrl && params.returnUrl.startsWith("/") && !params.returnUrl.startsWith("//") ? params.returnUrl : "";
  const loginLink = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <BrandMark />Orbit<span>work</span>
        </Link>
        <p className="eyebrow" style={{ marginTop: 18, marginBottom: 6 }}>NEW ACCOUNT</p>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Create your account</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Get started managing projects, tracking time, and collaborating.</p>

        {params.message && <p className="notice" role="status" style={{ margin: "10px 0" }}>{messages[params.message] ?? params.message}</p>}
        {params.error && <p className="error" role="alert" style={{ margin: "10px 0" }}>{messages[params.error] ?? params.error}</p>}

        <SignupForm
          returnUrl={returnUrl}
          emailDefault={params.email ?? ""}
          signUpAction={signUp}
          magicLinkAction={signInWithMagicLink}
        />

        <div className="auth-footer-link">
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
            <div><strong>100%</strong><span>Clarity</span></div>
          </div>
        </div>
        <div className="aside-foot">ORBITWORK · PRODUCTIVITY PLATFORM</div>
      </aside>
    </main>
  );
}
