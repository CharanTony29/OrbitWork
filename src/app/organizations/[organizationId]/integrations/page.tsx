import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, HardDrive, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export default async function OrganizationIntegrationsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ drive?: string }> }) {
  const { organizationId } = await params;
  const filters = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: organization } = await supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle();
  if (!organization) notFound();
  const [{ data: connection }, { data: canManage }] = await Promise.all([
    supabase.from("google_drive_connections").select("connected_by, connected_at, updated_at, account_email").eq("organization_id", organizationId).is("workspace_id", null).maybeSingle(),
    supabase.rpc("has_org_role", { target_org: organizationId, allowed_roles: ["owner", "admin"] }),
  ]);
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY);
  const statusText: Record<string, string> = {
    connected: "Google Drive is connected.",
    disconnected: "Google Drive default organization storage was disconnected.",
    not_configured: "Google OAuth environment variables are not configured on this app yet.",
    forbidden: "Only organization owners or admins can manage organization integrations.",
    invalid_state: "The OAuth session expired. Try connecting again.",
    token_exchange_failed: "Google did not approve the connection. Check the OAuth client and redirect URI.",
    missing_refresh_token: "Google returned no refresh token. Reconnect with offline access enabled.",
    cancelled: "Google Drive connection was cancelled.",
  };
  return <main className="app-shell"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/></div></header><section className="integrations-page"><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/>{organization.name}</Link><div className="integrations-heading"><div><p className="eyebrow">ORGANIZATION SETTINGS</p><h1>Integrations</h1><p className="muted">Connect approved services to your organization.</p></div></div>{filters.drive && <p className={filters.drive === "connected" ? "notice" : "error"} role="status">{statusText[filters.drive] ?? "Google Drive connection did not complete."}</p>}<article className="integration-card"><div className="integration-icon"><HardDrive size={21}/></div><div className="integration-copy"><h2>Google Drive (Default Organization Storage)</h2><p>Default storage for task attachments. Individual workspaces can connect their own dedicated Google Drive accounts from Workspace Settings to keep files isolated.</p><span className={connection ? "integration-state connected" : "integration-state"}>{connection ? <><CheckCircle2 size={13}/> Connected {connection.account_email ? `(${connection.account_email})` : ""}</> : <><Link2 size={13}/> Not connected</>}</span></div>{canManage && (connection ? (
  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
    <span className="integration-connected-time">Connected {new Date(connection.connected_at).toLocaleDateString()}</span>
    <a className="button button-secondary" href={`/api/integrations/google-drive/connect?organizationId=${organizationId}`}>Reconnect / Switch Account</a>
    <form action="/api/integrations/google-drive/disconnect" method="POST">
      <input type="hidden" name="organizationId" value={organizationId} />
      <button type="submit" className="button button-secondary" style={{ color: "#dc2626" }}>Disconnect</button>
    </form>
  </div>
) : configured ? (
  <a className="button button-primary" href={`/api/integrations/google-drive/connect?organizationId=${organizationId}`}>Connect Google Drive</a>
) : (
  <button className="button button-secondary" disabled title="Configure Google OAuth environment variables first">Set up required credentials</button>
))}</article>{!configured && <section className="integration-setup"><h2>Setup required</h2><p>Add these server-only variables to the deployment environment:</p><pre>GOOGLE_CLIENT_ID{"\n"}GOOGLE_CLIENT_SECRET{"\n"}GOOGLE_REDIRECT_URI{"\n"}GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY</pre><p>Use redirect URI <code>{process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/google-drive/callback</code> in Google Cloud OAuth settings. Generate a 32-byte encryption key for refresh tokens. Never use a <code>NEXT_PUBLIC_</code> prefix for these secrets.</p></section>}</section></main>;
}
