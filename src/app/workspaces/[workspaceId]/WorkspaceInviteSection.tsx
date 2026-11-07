"use client";

import { useState } from "react";
import { UserPlus, Mail, Send, Check } from "lucide-react";
import { addWorkspaceMember, inviteOrganizationMember } from "@/app/actions";

type MemberOption = {
  user_id: string;
  name: string;
};

export default function WorkspaceInviteSection({
  workspaceId,
  organizationId,
  availableMembers,
  isOrgAdmin,
}: {
  workspaceId: string;
  organizationId: string;
  availableMembers: MemberOption[];
  isOrgAdmin: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"org" | "email">("org");

  return (
    <div className="workspace-invite-box" style={{ marginTop: 24, padding: "18px 20px", borderRadius: 12, border: "1px solid var(--line, #e2e8f0)", background: "var(--paper, #fff)" }}>
      <div className="workspace-invite-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={16} color="var(--green, #167c58)" />
            <span>Add or Invite Workspace Members</span>
          </h4>
          <p className="muted small" style={{ margin: 0, fontSize: 12 }}>
            Grant workspace access to existing organization members or invite team members by email.
          </p>
        </div>

        {/* Tab switch */}
        <div style={{ display: "inline-flex", background: "var(--soft, #f1f5f2)", padding: 3, borderRadius: 8, gap: 3 }}>
          <button
            type="button"
            onClick={() => setActiveTab("org")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 6,
              border: 0,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "org" ? "var(--paper, #fff)" : "transparent",
              color: activeTab === "org" ? "var(--green, #167c58)" : "var(--muted, #64748b)",
              boxShadow: activeTab === "org" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <UserPlus size={13} />
            <span>Organization Member</span>
          </button>
          {isOrgAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("email")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 6,
                border: 0,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "email" ? "var(--paper, #fff)" : "transparent",
                color: activeTab === "email" ? "var(--green, #167c58)" : "var(--muted, #64748b)",
                boxShadow: activeTab === "email" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Mail size={13} />
              <span>Invite via Email</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Existing Org Member */}
      {activeTab === "org" && (
        <form action={addWorkspaceMember} style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div style={{ flex: "2 1 240px", display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Select Organization Member
            </label>
            <select
              name="userId"
              required
              defaultValue=""
              disabled={!availableMembers.length}
              style={{
                boxSizing: "border-box",
                height: 40,
                minHeight: 40,
                lineHeight: "38px",
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--paper, #fff)",
                color: "var(--ink)",
                fontSize: 13,
                outline: "none",
                verticalAlign: "middle",
              }}
            >
              <option value="">
                {availableMembers.length ? "Choose an organization member…" : "All organization members already have access"}
              </option>
              {availableMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Workspace Role
            </label>
            <select
              name="role"
              defaultValue="member"
              style={{
                boxSizing: "border-box",
                height: 40,
                minHeight: 40,
                lineHeight: "38px",
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--paper, #fff)",
                color: "var(--ink)",
                fontSize: 13,
                outline: "none",
                verticalAlign: "middle",
              }}
            >
              <option value="member">Member (Can edit &amp; upload)</option>
              <option value="viewer">Viewer (Read-only)</option>
              <option value="manager">Manager</option>
              {isOrgAdmin && <option value="admin">Admin</option>}
            </select>
          </div>

          <button
            type="submit"
            className="button button-primary"
            disabled={!availableMembers.length}
            style={{
              boxSizing: "border-box",
              height: 40,
              minHeight: 40,
              padding: "0 20px",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
            }}
          >
            Add to workspace
          </button>
        </form>
      )}

      {/* Tab 2: Invite by email */}
      {activeTab === "email" && isOrgAdmin && (
        <form action={inviteOrganizationMember} style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="workspaceId" value={workspaceId} />

          <div style={{ flex: "2 1 240px", display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Email Address
            </label>
            <input
              name="email"
              type="email"
              placeholder="colleague@company.com"
              required
              style={{
                boxSizing: "border-box",
                height: 40,
                minHeight: 40,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--paper, #fff)",
                color: "var(--ink)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Workspace Role
            </label>
            <select
              name="role"
              defaultValue="member"
              style={{
                boxSizing: "border-box",
                height: 40,
                minHeight: 40,
                lineHeight: "38px",
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--paper, #fff)",
                color: "var(--ink)",
                fontSize: 13,
                outline: "none",
                verticalAlign: "middle",
              }}
            >
              <option value="member">Member (Can edit &amp; upload)</option>
              <option value="viewer">Viewer (Read-only)</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="button button-primary"
            style={{
              boxSizing: "border-box",
              height: 40,
              minHeight: 40,
              padding: "0 20px",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              gap: 6,
            }}
          >
            <Send size={13} />
            <span>Send Invitation</span>
          </button>
        </form>
      )}
    </div>
  );
}
