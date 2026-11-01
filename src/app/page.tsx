import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; returnUrl?: string }>;
}) {
  const params = await searchParams;
  let user = null;
  let configError: string | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("Home page initialization error:", err);
    configError = err instanceof Error ? err.message : String(err);
  }

  if (configError) {
    return (
      <main className="auth-shell">
        <section className="auth-card" style={{ maxWidth: 540 }}>
          <div className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 18 }}>
            <span className="brand-mark">O</span>Orbit<span>work</span>
          </div>
          <h1 style={{ marginTop: 16 }}>Configuration Required</h1>
          <p className="muted">
            Your Vercel deployment is live, but required Supabase environment variables are missing.
          </p>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "14px 16px", borderRadius: 8, fontSize: 12.5, color: "#92400e", margin: "16px 0", lineHeight: 1.6 }}>
            <strong>How to fix this in Vercel:</strong>
            <ol style={{ paddingLeft: 18, marginTop: 8 }}>
              <li>Open your project at <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "#b45309", textDecoration: "underline" }}>vercel.com</a> &rarr; <strong>Settings</strong> &rarr; <strong>Environment Variables</strong></li>
              <li>Add <code>NEXT_PUBLIC_SUPABASE_URL</code>: <code>https://zdvpocqcymdfnywyvvfp.supabase.co</code></li>
              <li>Add <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>: <code>sb_publishable_pTHrnJatNMSr0INhm6NmQQ_fhaWBKit</code></li>
              <li>Add <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>: <code>sb_publishable_pTHrnJatNMSr0INhm6NmQQ_fhaWBKit</code></li>
              <li>Under <strong>Deployments</strong>, click <strong>...</strong> on the latest deployment and click <strong>Redeploy</strong>.</li>
            </ol>
          </div>
        </section>
      </main>
    );
  }

  if (user) {
    redirect("/dashboard");
  }

  const query = new URLSearchParams();
  if (params.returnUrl) query.set("returnUrl", params.returnUrl);
  if (params.error) query.set("error", params.error);
  if (params.message) query.set("message", params.message);
  const qStr = query.toString();

  redirect(qStr ? `/login?${qStr}` : "/login");
}
