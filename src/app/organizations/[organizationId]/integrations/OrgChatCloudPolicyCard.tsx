"use client";

import { useState } from "react";
import { ShieldCheck, Save } from "lucide-react";
import { showAppToast } from "@/lib/app-feedback";
import type {
  OrgChatAllowedProviders,
  OrgChatStoragePolicy,
  OrgChatStoragePolicyMode,
} from "@/lib/personal-cloud";

export default function OrgChatCloudPolicyCard({
  organizationId,
  organizationName,
  initialPolicy,
  canManage,
}: {
  organizationId: string;
  organizationName: string;
  initialPolicy: OrgChatStoragePolicy;
  canManage: boolean;
}) {
  const [policyMode, setPolicyMode] = useState<OrgChatStoragePolicyMode>(initialPolicy.policy);
  const [allowedProviders, setAllowedProviders] = useState<OrgChatAllowedProviders>(
    initialPolicy.allowedProviders
  );
  const [domainsInput, setDomainsInput] = useState<string>(
    initialPolicy.allowedDomains.map((d) => `*@${d}`).join(", ")
  );
  const [saving, setSaving] = useState(false);

  const previewDomains = domainsInput
    .split(/[\s,;]+/)
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/^\*@?/, "")
        .replace(/^@/, "")
    )
    .filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    if (policyMode === "org_domain_only" && previewDomains.length === 0) {
      showAppToast(
        "Enter at least one valid organization domain (for example: *@myorg.com).",
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/cloud-policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy: policyMode,
          allowedProviders,
          allowedDomains: previewDomains,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppToast(data.error || "Could not save organization chat storage policy.", "error");
        return;
      }
      if (Array.isArray(data.policy?.allowedDomains)) {
        setDomainsInput(data.policy.allowedDomains.map((d: string) => `*@${d}`).join(", "));
      }
      showAppToast("Organization chat cloud storage policy saved.", "success");
    } catch {
      showAppToast("Network error while saving cloud policy.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className="integration-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div className="integration-icon" style={{ color: "var(--green, #167c58)" }}>
          <ShieldCheck size={21} />
        </div>
        <div className="integration-copy" style={{ flex: 1 }}>
          <h2>Member Chat &amp; Group Attachment Storage Policy</h2>
          <p>
            Chat &amp; group files are uploaded to each member&apos;s personal Google Drive or OneDrive (configured in
            Profile Settings) instead of Project drives or Supabase. Control whether members of{" "}
            <strong>{organizationName}</strong> may connect any personal cloud account or only organization-domain
            accounts (e.g., <code>*@myorg.com</code>).
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        style={{
          display: "grid",
          gap: 14,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid var(--line, #e2e8f0)",
          background: "var(--soft, #f8fafc)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600 }}>
            <span>Allowed Account Policy</span>
            <select
              value={policyMode}
              onChange={(e) => setPolicyMode(e.target.value as OrgChatStoragePolicyMode)}
              disabled={!canManage || saving}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 7,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--paper, #fff)",
                color: "var(--ink)",
                fontSize: 12.5,
              }}
            >
              <option value="any">Any Google Drive / OneDrive account</option>
              <option value="org_domain_only">Organization email domain(s) only (*@myorg.com)</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600 }}>
            <span>Allowed Cloud Providers</span>
            <select
              value={allowedProviders}
              onChange={(e) => setAllowedProviders(e.target.value as OrgChatAllowedProviders)}
              disabled={!canManage || saving}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 7,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--paper, #fff)",
                color: "var(--ink)",
                fontSize: 12.5,
              }}
            >
              <option value="both">Both Google Drive &amp; Microsoft OneDrive</option>
              <option value="onedrive">Microsoft OneDrive only</option>
              <option value="google_drive">Google Drive only</option>
            </select>
          </label>
        </div>

        {policyMode === "org_domain_only" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600 }}>
              <span>Allowed Organization Email Domains (comma-separated)</span>
              <input
                type="text"
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
                disabled={!canManage || saving}
                placeholder="e.g. *@myorg.com, subsidiary.com"
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 7,
                  border: "1px solid var(--line, #cbd5e1)",
                  background: "var(--paper, #fff)",
                  color: "var(--ink)",
                  fontSize: 12.5,
                }}
              />
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11.5 }}>
              <span style={{ color: "var(--muted)" }}>Accepted patterns:</span>
              {previewDomains.length > 0 ? (
                previewDomains.map((d) => (
                  <span
                    key={d}
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(22, 124, 88, 0.12)",
                      color: "var(--green, #167c58)",
                      fontWeight: 700,
                    }}
                  >
                    *@{d}
                  </span>
                ))
              ) : (
                <span style={{ color: "#b45309" }}>Enter at least one domain (e.g. *@myorg.com)</span>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            Applies organization-wide to all members of {organizationName} when connecting cloud accounts or sending chat
            attachments.
          </span>
          {canManage && (
            <button
              type="submit"
              disabled={saving}
              className="button button-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, fontSize: 12 }}
            >
              <Save size={14} />
              <span>{saving ? "Saving..." : "Save Chat Policy"}</span>
            </button>
          )}
        </div>
      </form>
    </article>
  );
}
