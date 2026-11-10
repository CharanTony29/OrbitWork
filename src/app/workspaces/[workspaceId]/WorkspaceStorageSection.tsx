"use client";

import { useState } from "react";
import {
  CheckCircle2,
  HardDrive,
  Database,
  Cloud,
  Globe,
  ShieldCheck,
  Unlink,
  Settings,
} from "lucide-react";
import type { WorkspaceStorageInfo, StorageProviderType } from "@/lib/storage-config";
import {
  setWorkspaceActiveStorageProvider,
  saveWorkspaceOneDriveConfig,
  disconnectWorkspaceOneDrive,
  saveWorkspaceSharePointConfig,
  disconnectWorkspaceSharePoint,
} from "@/app/actions";

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
  storageInfo,
  driveConnection,
  canManage,
  googleConfigured,
  microsoftConfigured,
  driveStatus,
  storageStatus,
}: {
  workspaceId: string;
  workspaceName: string;
  storageInfo: WorkspaceStorageInfo;
  driveConnection: WorkspaceDriveConnectionInfo;
  canManage: boolean;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  driveStatus?: string;
  storageStatus?: string;
}) {
  const [showOneDriveForm, setShowOneDriveForm] = useState(false);
  const [showSharePointForm, setShowSharePointForm] = useState(false);

  const statusMessages: Record<string, { type: "notice" | "error"; text: string }> = {
    // Google Drive statuses
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
      text: "Connection was cancelled.",
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
      text: "Authorization could not be completed. Please check your credentials and permissions.",
    },
    missing_refresh_token: {
      type: "error",
      text: "Google did not return an offline refresh token. Please reconnect and grant offline access.",
    },
    save_failed: {
      type: "error",
      text: "Database error: Could not save the Google Drive connection token to the database.",
    },
    connection_failed: {
      type: "error",
      text: "Google Drive connection encountered an unexpected error. Please try again.",
    },
    // General / Storage statuses
    onedrive_connected: {
      type: "notice",
      text: "Microsoft OneDrive has been connected successfully for this workspace!",
    },
    onedrive_disconnected: {
      type: "notice",
      text: "Microsoft OneDrive storage has been disconnected for this workspace.",
    },
    onedrive_credentials_required: {
      type: "error",
      text: "Microsoft Azure OAuth credentials (MICROSOFT_CLIENT_ID) are not configured. You can use direct OneDrive account linking below.",
    },
    sharepoint_connected: {
      type: "notice",
      text: "Microsoft SharePoint Document Library connected successfully for this workspace!",
    },
    sharepoint_disconnected: {
      type: "notice",
      text: "Microsoft SharePoint storage has been disconnected for this workspace.",
    },
    provider_updated: {
      type: "notice",
      text: "Active storage provider has been updated for this workspace.",
    },
  };

  const activeMsg = (driveStatus && statusMessages[driveStatus]) || (storageStatus && statusMessages[storageStatus]) || null;
  const currentProvider = storageInfo.activeProvider;

  const providerNames: Record<StorageProviderType, string> = {
    local: "Local Storage (Built-in)",
    google_drive: "Google Drive",
    onedrive: "Microsoft OneDrive",
    sharepoint: "Microsoft SharePoint",
  };

  return (
    <section id="storage" className="workspace-access-section" style={{ marginTop: 28 }}>
      <header style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow">STORAGE &amp; CLOUD INTEGRATIONS</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Workspace Storage</h2>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 14,
                  background: "#eaf7ee",
                  color: "#167c58",
                  border: "1px solid #cbead5",
                }}
              >
                <CheckCircle2 size={12} color="#167c58" />
                <span>Active: {providerNames[currentProvider]}</span>
              </span>
            </div>

            {canManage && (
              <form
                action={async (formData) => {
                  await setWorkspaceActiveStorageProvider(formData);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  margin: 0,
                  alignSelf: "center",
                }}
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <label
                  htmlFor="active-storage-select"
                  style={{
                    fontSize: 12,
                    color: "var(--muted, #64748b)",
                    fontWeight: 600,
                    margin: 0,
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  Active Provider:
                </label>
                <select
                  id="active-storage-select"
                  name="provider"
                  defaultValue={currentProvider}
                  onChange={(e) => e.target.form?.requestSubmit()}
                  style={{
                    height: 34,
                    minHeight: 34,
                    fontSize: 12,
                    borderRadius: 18,
                    border: "1.5px solid var(--green, #167c58)",
                    padding: "0 14px",
                    background: "var(--paper, #fff)",
                    color: "var(--ink, #0f172a)",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "center",
                    textAlignLast: "center",
                    verticalAlign: "middle",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: "32px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                >
                  <option value="local">🏠 Local Storage (Built-in)</option>
                  <option value="google_drive" disabled={!storageInfo.googleDrive.connected}>
                    📂 Google Drive {storageInfo.googleDrive.connected ? "✓" : "(Not connected)"}
                  </option>
                  <option value="onedrive" disabled={!storageInfo.oneDrive.connected}>
                    ☁️ Microsoft OneDrive {storageInfo.oneDrive.connected ? "✓" : "(Not connected)"}
                  </option>
                  <option value="sharepoint" disabled={!storageInfo.sharePoint.connected}>
                    🏢 Microsoft SharePoint {storageInfo.sharePoint.connected ? "✓" : "(Not connected)"}
                  </option>
                </select>
              </form>
            )}
          </div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
            Manage where task attachments and files for <strong>{workspaceName}</strong> are stored. Each workspace can use its own isolated storage provider so your files remain secure and separated.
          </p>
        </div>
      </header>

      {activeMsg && (
        <p className={activeMsg.type} role="status" style={{ marginBottom: 16 }}>
          {activeMsg.text}
        </p>
      )}

      {/* Grid of Storage Providers */}
      <div style={{ display: "grid", gap: 14 }}>
        {/* 1. LOCAL STORAGE (BUILT-IN) */}
        <div
          style={{
            border: currentProvider === "local" ? "2px solid #167c58" : "1px solid var(--line, #e2e8f0)",
            borderRadius: 10,
            background: "var(--surface, #fff)",
            padding: "16px 18px",
            display: "grid",
            gap: 12,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: currentProvider === "local" ? "#eaf7ee" : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: currentProvider === "local" ? "#167c58" : "#475569",
                flexShrink: 0,
              }}
            >
              <Database size={22} />
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14.5, color: "var(--ink, #1e293b)" }}>Local Storage (Built-in)</strong>
                {currentProvider === "local" ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#eaf7ee",
                      color: "#167c58",
                      border: "1px solid #cbead5",
                    }}
                  >
                    Active Default Storage
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    Ready &amp; Available
                  </span>
                )}
              </div>

              <p style={{ margin: "4px 0 6px", fontSize: 12, color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                High-speed built-in server storage. Instant uploads with zero setup and no third-party cloud account required.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5, color: "var(--muted, #64748b)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#167c58" }}>
                  <ShieldCheck size={13} />
                  <span>Encrypted &amp; workspace-isolated</span>
                </span>
                <span>• Max 15 MB/file</span>
                <span>• Zero configuration</span>
              </div>
            </div>

            {canManage && currentProvider !== "local" && (
              <form action={async (formData) => { await setWorkspaceActiveStorageProvider(formData); }} style={{ alignSelf: "center" }}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="provider" value="local" />
                <button type="submit" className="button button-secondary" style={{ minHeight: 32, fontSize: 11.5 }}>
                  Set as Active Storage
                </button>
              </form>
            )}
          </div>
        </div>

        {/* 2. GOOGLE DRIVE */}
        <div
          style={{
            border: currentProvider === "google_drive" ? "2px solid #167c58" : "1px solid var(--line, #e2e8f0)",
            borderRadius: 10,
            background: "var(--surface, #fff)",
            padding: "16px 18px",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: storageInfo.googleDrive.connected ? "#eaf7ee" : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: storageInfo.googleDrive.connected ? "#167c58" : "#475569",
                flexShrink: 0,
              }}
            >
              <HardDrive size={22} />
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14.5, color: "var(--ink, #1e293b)" }}>Google Drive</strong>
                {storageInfo.googleDrive.connected ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: currentProvider === "google_drive" ? "#eaf7ee" : "#f1f5f9",
                      color: currentProvider === "google_drive" ? "#167c58" : "#475569",
                      border: `1px solid ${currentProvider === "google_drive" ? "#cbead5" : "#cbd5e1"}`,
                    }}
                  >
                    {currentProvider === "google_drive" ? "Active Default Storage" : "Connected"}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    Not Connected
                  </span>
                )}
              </div>

              <p style={{ margin: "4px 0 6px", fontSize: 12, color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                Store task attachments in a dedicated Google Drive folder: <code>Orbitwork / {workspaceName} / [Project Name]</code>.
              </p>

              {storageInfo.googleDrive.connected ? (
                <div style={{ display: "grid", gap: 3, fontSize: 11.5, color: "var(--muted, #64748b)", marginTop: 6 }}>
                  <div>
                    👤 <strong>Connected Account:</strong> {storageInfo.googleDrive.accountEmail || "Workspace Google Drive"}
                  </div>
                  {storageInfo.googleDrive.connectedAt && (
                    <div>
                      📅 <strong>Connected:</strong> {new Date(storageInfo.googleDrive.connectedAt).toLocaleDateString()}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, color: "#167c58" }}>
                    <ShieldCheck size={13} />
                    <span>Scoped to <code>drive.file</code> (Orbitwork cannot access personal files).</span>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted, #64748b)" }}>
                  Connect your Google Drive account to isolate this workspace’s file storage.
                </p>
              )}
            </div>

            {canManage && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", alignSelf: "center" }}>
                {storageInfo.googleDrive.connected ? (
                  <>
                    {currentProvider !== "google_drive" && (
                      <form action={async (formData) => { await setWorkspaceActiveStorageProvider(formData); }}>
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <input type="hidden" name="provider" value="google_drive" />
                        <button type="submit" className="button button-primary" style={{ minHeight: 32, fontSize: 11.5 }}>
                          Set as Active
                        </button>
                      </form>
                    )}
                    <a
                      href={`/api/integrations/google-drive/connect?workspaceId=${workspaceId}`}
                      className="button button-secondary"
                      style={{ minHeight: 32, fontSize: 11.5, textDecoration: "none" }}
                    >
                      Switch Account
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
                        style={{ minHeight: 32, fontSize: 11.5, color: "#dc2626" }}
                        title="Disconnect Google Drive"
                      >
                        <Unlink size={13} style={{ marginRight: 4 }} />
                        <span>Disconnect</span>
                      </button>
                    </form>
                  </>
                ) : googleConfigured ? (
                  <a
                    href={`/api/integrations/google-drive/connect?workspaceId=${workspaceId}`}
                    className="button button-primary"
                    style={{ minHeight: 34, fontSize: 12, textDecoration: "none" }}
                  >
                    <HardDrive size={14} style={{ marginRight: 6 }} />
                    <span>Connect Google Drive</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled
                    title="GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables required"
                    style={{ minHeight: 32, fontSize: 11.5 }}
                  >
                    Setup Credentials Required
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. MICROSOFT ONEDRIVE */}
        <div
          style={{
            border: currentProvider === "onedrive" ? "2px solid #167c58" : "1px solid var(--line, #e2e8f0)",
            borderRadius: 10,
            background: "var(--surface, #fff)",
            padding: "16px 18px",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: storageInfo.oneDrive.connected ? "#eaf7ee" : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: storageInfo.oneDrive.connected ? "#167c58" : "#0284c7",
                flexShrink: 0,
              }}
            >
              <Cloud size={22} />
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14.5, color: "var(--ink, #1e293b)" }}>Microsoft OneDrive</strong>
                {storageInfo.oneDrive.connected ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: currentProvider === "onedrive" ? "#eaf7ee" : "#f1f5f9",
                      color: currentProvider === "onedrive" ? "#167c58" : "#0284c7",
                      border: `1px solid ${currentProvider === "onedrive" ? "#cbead5" : "#cbd5e1"}`,
                    }}
                  >
                    {currentProvider === "onedrive" ? "Active Default Storage" : "Connected"}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    Not Connected
                  </span>
                )}
              </div>

              <p style={{ margin: "4px 0 6px", fontSize: 12, color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                Sync and store attachments directly in personal or Microsoft 365 OneDrive accounts.
              </p>

              {storageInfo.oneDrive.connected ? (
                <div style={{ display: "grid", gap: 3, fontSize: 11.5, color: "var(--muted, #64748b)", marginTop: 6 }}>
                  <div>
                    👤 <strong>Connected Account:</strong> {storageInfo.oneDrive.accountEmail || "OneDrive Account"}
                  </div>
                  <div>
                    📁 <strong>Root Folder:</strong> <code>OneDrive / {storageInfo.oneDrive.folderName || "Orbitwork"} / {workspaceName}</code>
                  </div>
                  {storageInfo.oneDrive.connectedAt && (
                    <div>
                      📅 <strong>Connected:</strong> {new Date(storageInfo.oneDrive.connectedAt).toLocaleDateString()}
                    </div>
                  )}
                  {storageInfo.oneDrive.hasOauth ? (
                    <div style={{ color: "#16a34a", fontWeight: 600 }}>
                      ⚡ Cloud Uploads Enabled: Files upload directly to your OneDrive account.
                    </div>
                  ) : microsoftConfigured ? (
                    <div style={{ color: "#d97706", fontWeight: 500 }}>
                      ℹ️ To stream files directly to OneDrive cloud, click <strong>Link Cloud Account</strong>.
                    </div>
                  ) : null}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted, #64748b)" }}>
                  Connect your Microsoft OneDrive to keep project files seamlessly accessible within Office 365.
                </p>
              )}
            </div>

            {canManage && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", alignSelf: "center" }}>
                {storageInfo.oneDrive.connected ? (
                  <>
                    {currentProvider !== "onedrive" && (
                      <form action={async (formData) => { await setWorkspaceActiveStorageProvider(formData); }}>
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <input type="hidden" name="provider" value="onedrive" />
                        <button type="submit" className="button button-primary" style={{ minHeight: 32, fontSize: 11.5 }}>
                          Set as Active
                        </button>
                      </form>
                    )}
                    {microsoftConfigured && (
                      <a
                        href={`/api/integrations/onedrive/connect?workspaceId=${workspaceId}`}
                        className="button button-primary"
                        style={{ minHeight: 32, fontSize: 11.5, textDecoration: "none" }}
                      >
                        <Cloud size={13} style={{ marginRight: 4 }} />
                        <span>{storageInfo.oneDrive.hasOauth ? "Reconnect" : "Link Cloud Account"}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowOneDriveForm((prev) => !prev)}
                      className="button button-secondary"
                      style={{ minHeight: 32, fontSize: 11.5 }}
                    >
                      <Settings size={13} style={{ marginRight: 4 }} />
                      <span>Configure</span>
                    </button>
                    <form
                      action={async (formData) => { await disconnectWorkspaceOneDrive(formData); }}
                      onSubmit={(e) => {
                        if (!confirm("Are you sure you want to disconnect OneDrive from this workspace?")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <button
                        type="submit"
                        className="button button-secondary"
                        style={{ minHeight: 32, fontSize: 11.5, color: "#dc2626" }}
                      >
                        <Unlink size={13} style={{ marginRight: 4 }} />
                        <span>Disconnect</span>
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    {microsoftConfigured ? (
                      <a
                        href={`/api/integrations/onedrive/connect?workspaceId=${workspaceId}`}
                        className="button button-primary"
                        style={{ minHeight: 34, fontSize: 12, textDecoration: "none" }}
                      >
                        <Cloud size={14} style={{ marginRight: 6 }} />
                        <span>Connect Microsoft</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowOneDriveForm((prev) => !prev)}
                        className="button button-primary"
                        style={{ minHeight: 34, fontSize: 12 }}
                      >
                        <Cloud size={14} style={{ marginRight: 6 }} />
                        <span>Configure OneDrive</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Inline OneDrive Configuration Form */}
          {showOneDriveForm && canManage && (
            <form
              action={async (formData) => {
                await saveWorkspaceOneDriveConfig(formData);
                setShowOneDriveForm(false);
              }}
              style={{
                marginTop: 10,
                padding: "12px 14px",
                borderRadius: 8,
                background: "var(--paper, #f8fafc)",
                border: "1px solid var(--line, #e2e8f0)",
                display: "grid",
                gap: 10,
              }}
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink, #1e293b)" }}>
                  Configure OneDrive Storage
                </span>
                <button
                  type="button"
                  onClick={() => setShowOneDriveForm(false)}
                  style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 14 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Microsoft Account Email (Optional)
                  </label>
                  <input
                    type="email"
                    name="accountEmail"
                    defaultValue={storageInfo.oneDrive.accountEmail || ""}
                    placeholder="user@company.onmicrosoft.com"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Dedicated Root Folder
                  </label>
                  <input
                    type="text"
                    name="folderName"
                    defaultValue={storageInfo.oneDrive.folderName || "Orbitwork"}
                    placeholder="Orbitwork"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>

              {/* Optional Enterprise Tenant Info */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, paddingTop: 4 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Azure Tenant ID / Domain (Optional for Enterprise)
                  </label>
                  <input
                    type="text"
                    name="tenantId"
                    defaultValue={storageInfo.oneDrive.tenantId || ""}
                    placeholder="e.g. company.onmicrosoft.com or common"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Custom Client / App ID (Optional)
                  </label>
                  <input
                    type="text"
                    name="clientId"
                    defaultValue={storageInfo.oneDrive.clientId || ""}
                    placeholder="Leave blank for public SaaS default"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" name="setActive" value="true" defaultChecked={currentProvider === "onedrive" || !storageInfo.oneDrive.connected} />
                  <span>Set as active default storage provider for this workspace</span>
                </label>
                <button type="submit" className="button button-primary" style={{ minHeight: 32, fontSize: 12 }}>
                  Save Configuration
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 4. MICROSOFT SHAREPOINT */}
        <div
          style={{
            border: currentProvider === "sharepoint" ? "2px solid #167c58" : "1px solid var(--line, #e2e8f0)",
            borderRadius: 10,
            background: "var(--surface, #fff)",
            padding: "16px 18px",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: storageInfo.sharePoint.connected ? "#eaf7ee" : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: storageInfo.sharePoint.connected ? "#167c58" : "#0369a1",
                flexShrink: 0,
              }}
            >
              <Globe size={22} />
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14.5, color: "var(--ink, #1e293b)" }}>Microsoft SharePoint</strong>
                {storageInfo.sharePoint.connected ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: currentProvider === "sharepoint" ? "#eaf7ee" : "#f1f5f9",
                      color: currentProvider === "sharepoint" ? "#167c58" : "#0369a1",
                      border: `1px solid ${currentProvider === "sharepoint" ? "#cbead5" : "#cbd5e1"}`,
                    }}
                  >
                    {currentProvider === "sharepoint" ? "Active Default Storage" : "Connected"}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    Not Connected
                  </span>
                )}
              </div>

              <p style={{ margin: "4px 0 6px", fontSize: 12, color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                Enterprise Document Library integration. Link and store documents inside your corporate SharePoint site.
              </p>

              {storageInfo.sharePoint.connected ? (
                <div style={{ display: "grid", gap: 3, fontSize: 11.5, color: "var(--muted, #64748b)", marginTop: 6 }}>
                  <div>
                    🌐 <strong>Site URL:</strong>{" "}
                    <a
                      href={storageInfo.sharePoint.siteUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0369a1", textDecoration: "none" }}
                    >
                      {storageInfo.sharePoint.siteUrl}
                    </a>
                  </div>
                  <div>
                    📚 <strong>Document Library:</strong> {storageInfo.sharePoint.libraryName || "Documents"} · Folder: <code>{storageInfo.sharePoint.folderName || "Orbitwork"}</code>
                  </div>
                  {storageInfo.sharePoint.connectedAt && (
                    <div>
                      📅 <strong>Connected:</strong> {new Date(storageInfo.sharePoint.connectedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted, #64748b)" }}>
                  Configure your team&apos;s SharePoint Document Library URL to centralize project deliverables.
                </p>
              )}
            </div>

            {canManage && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", alignSelf: "center" }}>
                {storageInfo.sharePoint.connected ? (
                  <>
                    {currentProvider !== "sharepoint" && (
                      <form action={async (formData) => { await setWorkspaceActiveStorageProvider(formData); }}>
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <input type="hidden" name="provider" value="sharepoint" />
                        <button type="submit" className="button button-primary" style={{ minHeight: 32, fontSize: 11.5 }}>
                          Set as Active
                        </button>
                      </form>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowSharePointForm((prev) => !prev)}
                      className="button button-secondary"
                      style={{ minHeight: 32, fontSize: 11.5 }}
                    >
                      <Settings size={13} style={{ marginRight: 4 }} />
                      <span>Configure</span>
                    </button>
                    <form
                      action={async (formData) => { await disconnectWorkspaceSharePoint(formData); }}
                      onSubmit={(e) => {
                        if (!confirm("Are you sure you want to disconnect SharePoint from this workspace?")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <button
                        type="submit"
                        className="button button-secondary"
                        style={{ minHeight: 32, fontSize: 11.5, color: "#dc2626" }}
                      >
                        <Unlink size={13} style={{ marginRight: 4 }} />
                        <span>Disconnect</span>
                      </button>
                    </form>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSharePointForm((prev) => !prev)}
                    className="button button-primary"
                    style={{ minHeight: 34, fontSize: 12 }}
                  >
                    <Globe size={14} style={{ marginRight: 6 }} />
                    <span>Configure SharePoint</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Inline SharePoint Configuration Form */}
          {showSharePointForm && canManage && (
            <form
              action={async (formData) => {
                await saveWorkspaceSharePointConfig(formData);
                setShowSharePointForm(false);
              }}
              style={{
                marginTop: 10,
                padding: "12px 14px",
                borderRadius: 8,
                background: "var(--paper, #f8fafc)",
                border: "1px solid var(--line, #e2e8f0)",
                display: "grid",
                gap: 10,
              }}
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink, #1e293b)" }}>
                  Configure SharePoint Document Library
                </span>
                <button
                  type="button"
                  onClick={() => setShowSharePointForm(false)}
                  style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 14 }}
                >
                  ✕
                </button>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                  SharePoint Site URL (Required)
                </label>
                <input
                  type="url"
                  name="siteUrl"
                  required
                  defaultValue={storageInfo.sharePoint.siteUrl || ""}
                  placeholder="https://company.sharepoint.com/sites/YourTeam"
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #cbd5e1)",
                    fontSize: 12,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Document Library Name
                  </label>
                  <input
                    type="text"
                    name="libraryName"
                    defaultValue={storageInfo.sharePoint.libraryName || "Documents"}
                    placeholder="Documents"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Folder Name
                  </label>
                  <input
                    type="text"
                    name="folderName"
                    defaultValue={storageInfo.sharePoint.folderName || "Orbitwork"}
                    placeholder="Orbitwork"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>

              {/* Optional Enterprise Tenant Info */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, paddingTop: 4 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Azure Tenant ID / Domain (Optional)
                  </label>
                  <input
                    type="text"
                    name="tenantId"
                    defaultValue={storageInfo.sharePoint.tenantId || ""}
                    placeholder="e.g. company.onmicrosoft.com"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                    Custom Client / App ID (Optional)
                  </label>
                  <input
                    type="text"
                    name="clientId"
                    defaultValue={storageInfo.sharePoint.clientId || ""}
                    placeholder="Leave blank for public SaaS default"
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" name="setActive" value="true" defaultChecked={currentProvider === "sharepoint" || !storageInfo.sharePoint.connected} />
                  <span>Set as active default storage provider for this workspace</span>
                </label>
                <button type="submit" className="button button-primary" style={{ minHeight: 32, fontSize: 12 }}>
                  Save SharePoint Settings
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
