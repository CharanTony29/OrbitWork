import Link from "next/link";
import { CheckCircle2, HardDrive, Link2, ShieldCheck, Unlink } from "lucide-react";

export type WorkspaceDriveConnectionInfo = {
  id: string;
  connected_at: string;
  updated_at: string;
  connected_by: string;
  account_email: string | null;
  folder_name: string | null;
} | null;

export default function WorkspaceStorageSection({
  workspaceId,
  workspaceName,
  connection,
  canManage,
  configured,
  driveStatus,
}: {
  workspaceId: string;
  workspaceName: string;
  connection: WorkspaceDriveConnectionInfo;
  canManage: boolean;
  configured: boolean;
  driveStatus?: string;
}) {
  const statusMessages: Record<string, { type: "notice" | "error"; text: string }> = {
    connected: {
      type: "notice",
      text: "Google Drive connected successfully for this workspace! Attachments will be saved to your workspace storage.",
    },
    disconnected: {
      type: "notice",
      text: "Google Drive storage has been disconnected for this workspace.",
    },
    forbidden: {
      type: "error",
      text: "Permission denied: Only Workspace Managers, Workspace Admins, or Organization Owners can manage storage for this workspace.",
    },
    cancelled: {
      type: "notice",
      text: "Google Drive connection was cancelled.",
    },
    not_configured: {
      type: "error",
      text: "Google OAuth credentials are not configured on this server yet. Contact the server administrator.",
    },
    invalid_state: {
      type: "error",
      text: "The OAuth authorization session expired. Please click Connect to try again.",
    },
    token_exchange_failed: {
      type: "error",
      text: "Google authorization could not be completed. Please check your Google permissions.",
    },
    missing_refresh_token: {
      type: "error",
      text: "Google did not return an offline refresh token. Please reconnect and grant offline access.",
    },
  };

  const currentMsg = driveStatus ? statusMessages[driveStatus] : null;

  return (
    <section id="storage" className="workspace-access-section" style={{ marginTop: 24 }}>
      <header style={{ marginBottom: 14 }}>
        <div>
          <p className="eyebrow">STORAGE &amp; PRIVACY</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Google Drive Storage</h2>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 12,
                background: connection ? "#eaf7ee" : "#f1f5f9",
                color: connection ? "#167c58" : "#64748b",
                border: `1px solid ${connection ? "#cbead5" : "#cbd5e1"}`,
              }}
            >
              {connection ? (
                <>
                  <CheckCircle2 size={12} color="#167c58" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <Link2 size={12} />
                  <span>Not Connected</span>
                </>
              )}
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            Manage your workspace’s dedicated storage location. Each workspace can use its own Google Drive account
            so other workspaces and members cannot view your personal files.
          </p>
        </div>
      </header>

      {currentMsg && (
        <p className={currentMsg.type} role="status" style={{ marginBottom: 14 }}>
          {currentMsg.text}
        </p>
      )}

      <div
        style={{
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: 10,
          background: "var(--surface, #fff)",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: connection ? "#eaf7ee" : "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: connection ? "#167c58" : "#64748b",
              flexShrink: 0,
            }}
          >
            <HardDrive size={22} />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            {connection ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14, color: "var(--ink, #1e293b)" }}>
                    {connection.account_email ? connection.account_email : "Workspace Google Drive"}
                  </strong>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "#eaf7ee",
                      color: "#167c58",
                      border: "1px solid #cbead5",
                    }}
                  >
                    Active Storage
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 4,
                    marginTop: 8,
                    fontSize: 11.5,
                    color: "var(--muted, #64748b)",
                  }}
                >
                  <div>
                    📁 <strong>Storage Location:</strong>{" "}
                    <code>Orbitwork / {workspaceName} / [Project Name]</code>
                  </div>
                  <div>
                    📅 <strong>Connected:</strong>{" "}
                    {new Date(connection.connected_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, color: "#167c58" }}>
                    <ShieldCheck size={13} />
                    <span>Isolated: Only files from this workspace are uploaded to this Drive.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <strong style={{ fontSize: 13, color: "var(--ink, #1e293b)" }}>
                  No Google Drive Connected for this Workspace
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                  Connect your Google Drive account to store task attachments in your own private folder.
                  Workspace Managers and Owners can connect and manage this workspace&apos;s storage at any time.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Management Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            paddingTop: 12,
            borderTop: "1px solid var(--line, #edf2f7)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
            {canManage ? (
              <span>Only Workspace Managers, Workspace Admins, and Organization Owners can manage this connection.</span>
            ) : (
              <span>Storage connection is managed by Workspace Managers and Owners.</span>
            )}
          </div>

          {canManage && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {connection ? (
                <>
                  <a
                    href={`/api/integrations/google-drive/connect?workspaceId=${workspaceId}`}
                    className="button button-secondary"
                    style={{ minHeight: 32, fontSize: 11.5, padding: "0 12px", textDecoration: "none" }}
                    title="Switch Google account or renew access token"
                  >
                    Switch Account / Reconnect
                  </a>

                  <form
                    action="/api/integrations/google-drive/disconnect"
                    method="POST"
                    onSubmit={(e) => {
                      if (!confirm("Are you sure you want to disconnect Google Drive from this workspace?")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <button
                      type="submit"
                      className="button button-secondary"
                      style={{
                        minHeight: 32,
                        fontSize: 11.5,
                        padding: "0 12px",
                        color: "#dc2626",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                      title="Disconnect Google Drive storage from this workspace"
                    >
                      <Unlink size={13} />
                      <span>Disconnect</span>
                    </button>
                  </form>
                </>
              ) : configured ? (
                <a
                  href={`/api/integrations/google-drive/connect?workspaceId=${workspaceId}`}
                  className="button button-primary"
                  style={{ minHeight: 34, fontSize: 12, padding: "0 14px", textDecoration: "none" }}
                >
                  <HardDrive size={14} style={{ marginRight: 6 }} />
                  <span>Connect Google Drive</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled
                  title="Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables on the server first"
                  style={{ minHeight: 32, fontSize: 11.5 }}
                >
                  Setup credentials required
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
