"use client";

import { useState } from "react";
import {
  Cloud,
  HardDrive,
  CheckCircle2,
  ShieldCheck,
  Unlink,
  Link2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { showAppConfirm, showAppToast } from "@/lib/app-feedback";
import type {
  OrgChatStoragePolicy,
  PersonalCloudProvider,
  UserCloudConnectionSummary,
} from "@/lib/personal-cloud";

export default function PersonalCloudStorageSection({
  initialConnections,
  policies,
  googleConfigured,
  microsoftConfigured,
  migrationMissing,
}: {
  initialConnections: UserCloudConnectionSummary[];
  policies: OrgChatStoragePolicy[];
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  migrationMissing: boolean;
}) {
  const [connections, setConnections] = useState<UserCloudConnectionSummary[]>(initialConnections);
  const [busyProvider, setBusyProvider] = useState<PersonalCloudProvider | null>(null);

  const googleConn = connections.find((c) => c.provider === "google_drive") ?? null;
  const oneDriveConn = connections.find((c) => c.provider === "onedrive") ?? null;

  const googleBlockedByOrg = policies.find((p) => p.allowedProviders === "onedrive") ?? null;
  const oneDriveBlockedByOrg = policies.find((p) => p.allowedProviders === "google_drive") ?? null;
  const domainRestrictedOrgs = policies.filter(
    (p) => p.policy === "org_domain_only" && p.allowedDomains.length > 0
  );

  async function handleSetActive(provider: PersonalCloudProvider) {
    setBusyProvider(provider);
    try {
      const res = await fetch("/api/profile/cloud/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppToast(data.error || "Could not switch active cloud drive.", "error");
        return;
      }
      setConnections((prev) =>
        prev.map((c) => ({ ...c, isActive: c.provider === provider }))
      );
      showAppToast(
        provider === "google_drive"
          ? "Google Drive is now your active drive for chat attachments."
          : "Microsoft OneDrive is now your active drive for chat attachments.",
        "success"
      );
    } catch {
      showAppToast("Network error while updating active drive.", "error");
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleDisconnect(provider: PersonalCloudProvider) {
    const label = provider === "google_drive" ? "Google Drive" : "Microsoft OneDrive";
    const ok = await showAppConfirm({
      title: `Disconnect personal ${label}?`,
      message:
        "You will not be able to upload new files in chat until you connect a personal Google Drive or OneDrive account. Existing files stay safely in your cloud drive.",
      confirmLabel: "Disconnect",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;

    setBusyProvider(provider);
    try {
      const res = await fetch(`/api/profile/cloud/status?provider=${provider}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppToast(data.error || `Could not disconnect ${label}.`, "error");
        return;
      }
      setConnections((prev) => {
        const remaining = prev.filter((c) => c.provider !== provider);
        if (remaining.length > 0 && !remaining.some((c) => c.isActive)) {
          remaining[0] = { ...remaining[0], isActive: true };
        }
        return remaining;
      });
      showAppToast(`Personal ${label} disconnected.`, "info");
    } catch {
      showAppToast("Network error while disconnecting drive.", "error");
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <section
      className="profile-form"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      id="personal-cloud-storage"
    >
      <div className="profile-section-heading">
        <h2>Personal Cloud Storage (Private Chat &amp; Group Attachments)</h2>
        <p>
          Connect your own <strong>Google Drive</strong> or <strong>Microsoft OneDrive</strong> for files you share
          in direct chats and groups. Attachments are saved privately inside your own{" "}
          <code>Orbitwork Chat</code> folder — separate from Project/Workspace drives and never stored in Supabase.
        </p>
      </div>

      {migrationMissing && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 9,
            border: "1px solid #fde68a",
            background: "rgba(245, 158, 11, 0.08)",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Database migration pending:</strong> Apply{" "}
            <code>supabase/migrations/202611180001_user_prefs_personal_cloud_inbox.sql</code> in Supabase to enable
            personal cloud drive connections.
          </div>
        </div>
      )}

      {(domainRestrictedOrgs.length > 0 || googleBlockedByOrg || oneDriveBlockedByOrg) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid rgba(22, 124, 88, 0.3)",
            background: "rgba(22, 124, 88, 0.06)",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <ShieldCheck size={17} style={{ color: "var(--green, #167c58)", flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Organization Storage Policy Active:</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {domainRestrictedOrgs.map((org) => (
                <li key={org.organizationId}>
                  <strong>{org.organizationName}</strong> requires an organization cloud account matching{" "}
                  <code>{org.allowedDomains.map((d) => `*@${d}`).join(", ")}</code>
                  {org.allowedProviders === "onedrive"
                    ? " (Microsoft OneDrive only)"
                    : org.allowedProviders === "google_drive"
                    ? " (Google Drive only)"
                    : ""}
                  .
                </li>
              ))}
              {googleBlockedByOrg &&
                !domainRestrictedOrgs.some((o) => o.organizationId === googleBlockedByOrg.organizationId) && (
                  <li>
                    <strong>{googleBlockedByOrg.organizationName}</strong> only permits Microsoft OneDrive for chat
                    attachments.
                  </li>
                )}
              {oneDriveBlockedByOrg &&
                !domainRestrictedOrgs.some((o) => o.organizationId === oneDriveBlockedByOrg.organizationId) && (
                  <li>
                    <strong>{oneDriveBlockedByOrg.organizationName}</strong> only permits Google Drive for chat
                    attachments.
                  </li>
                )}
            </ul>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {/* Google Drive Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            padding: "14px 16px",
            borderRadius: 10,
            border: `1px solid ${googleConn?.isActive ? "var(--green, #167c58)" : "var(--line, #e2e8f0)"}`,
            background: "var(--soft, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220, flex: 1 }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--paper, #fff)",
                border: "1px solid var(--line, #e2e8f0)",
                color: "var(--green, #167c58)",
                flexShrink: 0,
              }}
            >
              <HardDrive size={18} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>Personal Google Drive</strong>
                {googleConn?.isActive && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(22, 124, 88, 0.12)",
                      color: "var(--green, #167c58)",
                    }}
                  >
                    Active for Chat
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {googleConn ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CheckCircle2 size={13} style={{ color: "var(--green, #167c58)" }} />
                    Connected as <strong>{googleConn.accountEmail || "Google account"}</strong> · Folder:{" "}
                    <code>{googleConn.folderName}</code>
                  </span>
                ) : googleBlockedByOrg ? (
                  <span>Disabled by {googleBlockedByOrg.organizationName} policy (OneDrive required).</span>
                ) : (
                  <span>Not connected yet. Connect to store your chat files privately in Google Drive.</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {googleConn && !googleConn.isActive && !googleBlockedByOrg && (
              <button
                type="button"
                className="button button-secondary"
                disabled={busyProvider !== null}
                onClick={() => handleSetActive("google_drive")}
                style={{ minHeight: 34, fontSize: 12, padding: "0 12px" }}
              >
                Use for Chat
              </button>
            )}
            {googleConfigured && !googleBlockedByOrg && !migrationMissing && (
              <a
                href="/api/profile/cloud/google-drive/connect"
                className={googleConn ? "button button-secondary" : "button button-primary"}
                style={{
                  minHeight: 34,
                  fontSize: 12,
                  padding: "0 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  textDecoration: "none",
                }}
              >
                {googleConn ? <RefreshCw size={13} /> : <Link2 size={13} />}
                <span>{googleConn ? "Switch Account" : "Connect Google Drive"}</span>
              </a>
            )}
            {googleConn && (
              <button
                type="button"
                className="button button-secondary"
                disabled={busyProvider !== null}
                onClick={() => handleDisconnect("google_drive")}
                style={{
                  minHeight: 34,
                  fontSize: 12,
                  padding: "0 10px",
                  borderColor: "#fca5a5",
                  color: "#dc2626",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Unlink size={13} />
                <span>Disconnect</span>
              </button>
            )}
            {!googleConfigured && !googleConn && (
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Google OAuth not configured</span>
            )}
          </div>
        </div>

        {/* OneDrive Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            padding: "14px 16px",
            borderRadius: 10,
            border: `1px solid ${oneDriveConn?.isActive ? "var(--green, #167c58)" : "var(--line, #e2e8f0)"}`,
            background: "var(--soft, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220, flex: 1 }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--paper, #fff)",
                border: "1px solid var(--line, #e2e8f0)",
                color: "#0284c7",
                flexShrink: 0,
              }}
            >
              <Cloud size={18} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>Personal Microsoft OneDrive</strong>
                {oneDriveConn?.isActive && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(22, 124, 88, 0.12)",
                      color: "var(--green, #167c58)",
                    }}
                  >
                    Active for Chat
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {oneDriveConn ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CheckCircle2 size={13} style={{ color: "var(--green, #167c58)" }} />
                    Connected as <strong>{oneDriveConn.accountEmail || "Microsoft account"}</strong> · Folder:{" "}
                    <code>{oneDriveConn.folderName}</code>
                  </span>
                ) : oneDriveBlockedByOrg ? (
                  <span>Disabled by {oneDriveBlockedByOrg.organizationName} policy (Google Drive required).</span>
                ) : (
                  <span>Not connected yet. Connect your personal or work OneDrive for chat attachments.</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {oneDriveConn && !oneDriveConn.isActive && !oneDriveBlockedByOrg && (
              <button
                type="button"
                className="button button-secondary"
                disabled={busyProvider !== null}
                onClick={() => handleSetActive("onedrive")}
                style={{ minHeight: 34, fontSize: 12, padding: "0 12px" }}
              >
                Use for Chat
              </button>
            )}
            {microsoftConfigured && !oneDriveBlockedByOrg && !migrationMissing && (
              <a
                href="/api/profile/cloud/onedrive/connect"
                className={oneDriveConn ? "button button-secondary" : "button button-primary"}
                style={{
                  minHeight: 34,
                  fontSize: 12,
                  padding: "0 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  textDecoration: "none",
                }}
              >
                {oneDriveConn ? <RefreshCw size={13} /> : <Link2 size={13} />}
                <span>{oneDriveConn ? "Switch Account" : "Connect OneDrive"}</span>
              </a>
            )}
            {oneDriveConn && (
              <button
                type="button"
                className="button button-secondary"
                disabled={busyProvider !== null}
                onClick={() => handleDisconnect("onedrive")}
                style={{
                  minHeight: 34,
                  fontSize: 12,
                  padding: "0 10px",
                  borderColor: "#fca5a5",
                  color: "#dc2626",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Unlink size={13} />
                <span>Disconnect</span>
              </button>
            )}
            {!microsoftConfigured && !oneDriveConn && (
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Microsoft OAuth not configured</span>
            )}
          </div>
        </div>
      </div>

      {!googleConn && !oneDriveConn && !migrationMissing && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Note: Until you connect either Google Drive or OneDrive above, file uploads in direct chats and group chats
          are paused so your private files are never stored in Supabase.
        </p>
      )}
    </section>
  );
}
