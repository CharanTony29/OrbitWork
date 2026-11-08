import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  HardDrive,
  Database,
  Cloud,
  Globe,
  Link2,
  Unlink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationStorageConfig } from "@/lib/storage-config";
import {
  setOrganizationActiveStorageProvider,
  saveOrganizationOneDriveConfig,
  disconnectOrganizationOneDrive,
  saveOrganizationSharePointConfig,
  disconnectOrganizationSharePoint,
} from "@/app/actions";

export default async function OrganizationIntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ drive?: string; storage?: string }>;
}) {
  const { organizationId } = await params;
  const filters = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();
  if (!organization) notFound();

  const [{ data: connection }, { data: canManage }, storageConfig] = await Promise.all([
    supabase
      .from("google_drive_connections")
      .select("connected_by, connected_at, updated_at, account_email")
      .eq("organization_id", organizationId)
      .is("workspace_id", null)
      .maybeSingle(),
    supabase.rpc("has_org_role", {
      target_org: organizationId,
      allowed_roles: ["owner", "admin"],
    }),
    getOrganizationStorageConfig(supabase, organizationId),
  ]);

  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY
  );

  const microsoftConfigured = Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );

  const statusText: Record<string, string> = {
    connected: "Google Drive default organization storage connected.",
    disconnected: "Google Drive default organization storage was disconnected.",
    not_configured: "Google OAuth environment variables are not configured on this app yet.",
    forbidden: "Only organization owners or admins can manage organization integrations.",
    invalid_state: "The OAuth session expired. Try connecting again.",
    token_exchange_failed: "Authorization did not complete. Check your OAuth client configuration.",
    missing_refresh_token: "Google returned no refresh token. Reconnect with offline access enabled.",
    cancelled: "Connection was cancelled.",
    onedrive_connected: "Microsoft OneDrive default storage connected successfully.",
    onedrive_disconnected: "Microsoft OneDrive default storage disconnected.",
    sharepoint_connected: "Microsoft SharePoint Document Library connected successfully.",
    sharepoint_disconnected: "Microsoft SharePoint storage disconnected.",
    provider_updated: "Organization default storage provider updated.",
  };

  const currentStatusMsg = filters.drive ? statusText[filters.drive] : filters.storage ? statusText[filters.storage] : null;
  const isSuccess = filters.drive === "connected" || filters.storage?.includes("connected");

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <div className="topbar-right">
          <CurrentUserBadge email={user.email ?? ""} />
        </div>
      </header>

      <section className="integrations-page">
        <Link className="back-link" href="/dashboard">
          <ArrowLeft size={15} />
          {organization.name}
        </Link>

        <div className="integrations-heading">
          <div>
            <p className="eyebrow">ORGANIZATION SETTINGS</p>
            <h1>Storage &amp; Cloud Integrations</h1>
            <p className="muted">
              Connect default storage and cloud services for <strong>{organization.name}</strong>.
              Individual workspaces can also manage their own dedicated storage locations from Workspace Settings.
            </p>
          </div>
        </div>

        {currentStatusMsg && (
          <p className={isSuccess ? "notice" : "error"} role="status" style={{ marginBottom: 16 }}>
            {currentStatusMsg}
          </p>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          {/* 1. Local Storage (Built-in) */}
          <article className="integration-card">
            <div className="integration-icon">
              <Database size={21} />
            </div>
            <div className="integration-copy">
              <h2>Local Storage (Built-in Server Storage)</h2>
              <p>
                Fast, secure built-in database storage inside Orbitwork. No third-party accounts or cloud API setup needed.
                Provides instant file attachments up to 15 MB with workspace data isolation.
              </p>
              <span className={`integration-state ${storageConfig.activeProvider === "local" ? "connected" : ""}`}>
                <CheckCircle2 size={13} />{" "}
                {storageConfig.activeProvider === "local" ? "Active Default Storage" : "Available"}
              </span>
            </div>
            {canManage && storageConfig.activeProvider !== "local" && (
              <form action={async (formData) => { "use server"; await setOrganizationActiveStorageProvider(formData); }}>
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="provider" value="local" />
                <button type="submit" className="button button-secondary">
                  Set as Default
                </button>
              </form>
            )}
          </article>

          {/* 2. Google Drive */}
          <article className="integration-card">
            <div className="integration-icon">
              <HardDrive size={21} />
            </div>
            <div className="integration-copy">
              <h2>Google Drive (Organization Cloud Storage)</h2>
              <p>
                Default cloud storage for task attachments across organization workspaces.
                Individual workspaces can connect their own dedicated Google Drive accounts to keep files completely isolated.
              </p>
              <span className={`integration-state ${connection ? "connected" : ""}`}>
                {connection ? (
                  <>
                    <CheckCircle2 size={13} /> Connected{" "}
                    {connection.account_email ? `(${connection.account_email})` : ""}
                  </>
                ) : (
                  <>
                    <Link2 size={13} /> Not connected
                  </>
                )}
              </span>
            </div>
            {canManage &&
              (connection ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="integration-connected-time">
                    Connected {new Date(connection.connected_at).toLocaleDateString()}
                  </span>
                  <a
                    className="button button-secondary"
                    href={`/api/integrations/google-drive/connect?organizationId=${organizationId}`}
                  >
                    Switch Account
                  </a>
                  <form action="/api/integrations/google-drive/disconnect" method="POST">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <button type="submit" className="button button-secondary" style={{ color: "#dc2626" }}>
                      Disconnect
                    </button>
                  </form>
                </div>
              ) : googleConfigured ? (
                <a
                  className="button button-primary"
                  href={`/api/integrations/google-drive/connect?organizationId=${organizationId}`}
                >
                  Connect Google Drive
                </a>
              ) : (
                <button
                  className="button button-secondary"
                  disabled
                  title="Configure Google OAuth environment variables first"
                >
                  Setup credentials required
                </button>
              ))}
          </article>

          {/* 3. Microsoft OneDrive */}
          <article className="integration-card">
            <div className="integration-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
              <Cloud size={21} />
            </div>
            <div className="integration-copy">
              <h2>Microsoft OneDrive</h2>
              <p>
                Store and synchronize task attachments in personal or Microsoft 365 OneDrive accounts under dedicated folders.
              </p>
              <span className={`integration-state ${storageConfig.oneDrive.connected ? "connected" : ""}`}>
                {storageConfig.oneDrive.connected ? (
                  <>
                    <CheckCircle2 size={13} /> Connected{" "}
                    {storageConfig.oneDrive.accountEmail ? `(${storageConfig.oneDrive.accountEmail})` : ""}
                  </>
                ) : (
                  <>
                    <Link2 size={13} /> Not connected
                  </>
                )}
              </span>
            </div>
            {canManage &&
              (storageConfig.oneDrive.connected ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <form action={async (formData) => { "use server"; await disconnectOrganizationOneDrive(formData); }}>
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <button type="submit" className="button button-secondary" style={{ color: "#dc2626" }}>
                      Disconnect
                    </button>
                  </form>
                </div>
              ) : microsoftConfigured ? (
                <a
                  className="button button-primary"
                  href={`/api/integrations/onedrive/connect?organizationId=${organizationId}`}
                >
                  Connect OneDrive
                </a>
              ) : (
                <form
                  action={async (formData) => {
                    "use server";
                    await saveOrganizationOneDriveConfig(formData);
                  }}
                  style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                >
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input
                    type="email"
                    name="accountEmail"
                    placeholder="account@company.com"
                    style={{
                      height: 34,
                      padding: "0 8px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 11.5,
                    }}
                  />
                  <button type="submit" className="button button-primary">
                    Link OneDrive
                  </button>
                </form>
              ))}
          </article>

          {/* 4. Microsoft SharePoint */}
          <article className="integration-card">
            <div className="integration-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>
              <Globe size={21} />
            </div>
            <div className="integration-copy">
              <h2>Microsoft SharePoint Document Library</h2>
              <p>
                Link documents directly from enterprise SharePoint sites and libraries for compliance and collaboration.
              </p>
              <span className={`integration-state ${storageConfig.sharePoint.connected ? "connected" : ""}`}>
                {storageConfig.sharePoint.connected ? (
                  <>
                    <CheckCircle2 size={13} /> Connected{" "}
                    {storageConfig.sharePoint.siteUrl ? `(${storageConfig.sharePoint.siteUrl})` : ""}
                  </>
                ) : (
                  <>
                    <Link2 size={13} /> Not connected
                  </>
                )}
              </span>
            </div>
            {canManage &&
              (storageConfig.sharePoint.connected ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <form action={async (formData) => { "use server"; await disconnectOrganizationSharePoint(formData); }}>
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <button type="submit" className="button button-secondary" style={{ color: "#dc2626" }}>
                      Disconnect
                    </button>
                  </form>
                </div>
              ) : (
                <form
                  action={async (formData) => {
                    "use server";
                    await saveOrganizationSharePointConfig(formData);
                  }}
                  style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                >
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input
                    type="url"
                    name="siteUrl"
                    required
                    placeholder="https://company.sharepoint.com/sites/team"
                    style={{
                      height: 34,
                      padding: "0 8px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 11.5,
                      minWidth: 200,
                    }}
                  />
                  <button type="submit" className="button button-primary">
                    Link SharePoint
                  </button>
                </form>
              ))}
          </article>
        </div>

        {/* Setup Reference */}
        <section className="integration-setup" style={{ marginTop: 24 }}>
          <h2>Storage Providers Configuration Reference</h2>
          <p>
            Orbitwork supports <strong>Local Storage (Built-in)</strong>, <strong>Google Drive</strong>,{" "}
            <strong>Microsoft OneDrive</strong>, and <strong>Microsoft SharePoint</strong>.
          </p>
          <p style={{ marginTop: 8 }}>
            For cloud OAuth integrations, set up the following environment variables on your deployment:
          </p>
          <pre>
            # Google Drive OAuth (Optional){"\n"}
            GOOGLE_CLIENT_ID{"\n"}
            GOOGLE_CLIENT_SECRET{"\n"}
            GOOGLE_REDIRECT_URI={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/google-drive/callback{"\n"}
            GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY{"\n\n"}
            # Microsoft Azure OAuth (Optional for OneDrive & SharePoint){"\n"}
            MICROSOFT_CLIENT_ID{"\n"}
            MICROSOFT_CLIENT_SECRET{"\n"}
            MICROSOFT_REDIRECT_URI={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/onedrive/callback
          </pre>
          <p style={{ marginTop: 8, fontSize: 11 }}>
            🔒 <em>Local Storage requires zero credentials and works immediately for all workspaces.</em>
          </p>
        </section>
      </section>
    </main>
  );
}
