"use client";

import { useState } from "react";
import { UserPlus, X, Mail, Shield, Loader2 } from "lucide-react";
import { inviteOrganizationMember } from "@/app/actions";

export default function InviteMemberModal({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button button-primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          padding: "7px 14px",
          fontSize: "12px",
          fontWeight: 600,
          borderRadius: "7px",
          cursor: "pointer",
        }}
        aria-label="Invite new member to organization"
      >
        <UserPlus size={15} />
        <span>+ Invite Member</span>
      </button>

      {open && (
        <div
          className="proj-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="proj-modal" style={{ maxWidth: 460 }}>
            <div className="proj-modal-head">
              <h2 id="invite-modal-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
                <UserPlus size={18} style={{ color: "var(--green, #167c58)" }} />
                Invite to {organizationName}
              </h2>
              <button
                type="button"
                className="proj-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form
              action={async (formData) => {
                setIsPending(true);
                try {
                  await inviteOrganizationMember(formData);
                } finally {
                  setIsPending(false);
                  setOpen(false);
                }
              }}
              style={{ display: "grid", gap: 16, padding: "20px" }}
            >
              <input type="hidden" name="organizationId" value={organizationId} />
              <input
                type="hidden"
                name="returnUrl"
                value={`/organizations/${organizationId}/members`}
              />

              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                Enter the teammate&apos;s email address and assign an organization role. They will receive an invitation link to join.
              </p>

              <label style={{ display: "grid", gap: 6, fontSize: "11px", fontWeight: 700, color: "var(--ink, #1e293b)" }}>
                <span>Email address</span>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Mail
                    size={14}
                    style={{ position: "absolute", left: 10, color: "var(--muted, #94a3b8)", pointerEvents: "none" }}
                  />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="teammate@company.com"
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 32px",
                      borderRadius: 7,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                      background: "var(--surface, #fff)",
                      color: "var(--ink, #0f172a)",
                    }}
                  />
                </div>
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: "11px", fontWeight: 700, color: "var(--ink, #1e293b)" }}>
                <span>Organization role</span>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Shield
                    size={14}
                    style={{ position: "absolute", left: 10, color: "var(--muted, #94a3b8)", pointerEvents: "none" }}
                  />
                  <select
                    name="role"
                    defaultValue="member"
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 32px",
                      borderRadius: 7,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                      background: "var(--surface, #fff)",
                      color: "var(--ink, #0f172a)",
                    }}
                  >
                    <option value="admin">Admin (Full organization access)</option>
                    <option value="manager">Manager (Can manage teams & approvals)</option>
                    <option value="member">Member (Regular collaborator)</option>
                    <option value="viewer">Viewer (Read-only access)</option>
                  </select>
                </div>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  style={{ padding: "7px 14px", fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={isPending}
                  style={{
                    padding: "7px 16px",
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  <span>{isPending ? "Sending invite..." : "Send Invitation"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
