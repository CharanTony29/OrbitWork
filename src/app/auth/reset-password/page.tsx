import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UpdatePasswordForm from "./UpdatePasswordForm";

async function updatePassword(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (password.length < 8 || password.length > 128) redirect("/auth/reset-password?error=invalid_password");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/reset-password?error=reset_failed");
  redirect("/login?message=password_updated");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  const messages: Record<string, string> = {
    invalid_password: "Your new password must be at least 8 characters long.",
    reset_failed: "Failed to update your password. The recovery link may be expired or already used. Request a new reset link.",
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <p className="eyebrow">SECURITY</p>
        <h1>Set a new password</h1>
        <p className="muted">Enter a strong new password for your account.</p>

        {params.error && <p className="error" role="alert">{messages[params.error] ?? params.error}</p>}

        <UpdatePasswordForm serverAction={updatePassword} />

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--line)", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          <Link href="/login" style={{ color: "var(--green)", fontWeight: 700 }}>
            &larr; Back to sign in
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
