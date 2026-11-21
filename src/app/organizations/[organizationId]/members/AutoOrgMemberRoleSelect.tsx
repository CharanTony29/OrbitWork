"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { updateOrganizationMemberRoleDirect } from "@/app/actions";

export default function AutoOrgMemberRoleSelect({
  organizationId,
  userId,
  initialRole,
  isOwner,
}: {
  organizationId: string;
  userId: string;
  initialRole: string;
  isOwner: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (newRole: "co_owner" | "admin" | "manager" | "member" | "viewer") => {
    const previousRole = role;
    setRole(newRole);
    setStatus("saving");
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await updateOrganizationMemberRoleDirect({
          organizationId,
          userId,
          role: newRole,
        });

        if (!res.success) {
          setRole(previousRole);
          setStatus("error");
          setErrorMsg(res.error || "Update failed");
          setTimeout(() => setStatus("idle"), 4000);
        } else {
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2500);
        }
      } catch (err: any) {
        setRole(previousRole);
        setStatus("error");
        setErrorMsg(err?.message || "Failed to save");
        setTimeout(() => setStatus("idle"), 4000);
      }
    });
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", verticalAlign: "middle" }}>
      <select
        value={role}
        onChange={(e) => handleRoleChange(e.target.value as any)}
        disabled={status === "saving" || isPending}
        style={{
          fontSize: "0.82rem",
          padding: "0.25rem 0.5rem",
          borderRadius: "6px",
          border: status === "error" ? "1px solid #ef4444" : "1px solid var(--border-color, #cbd5e1)",
          background: "var(--paper, #fff)",
          color: "inherit",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 0.15s ease",
        }}
      >
        {isOwner && <option value="co_owner">Co-Owner</option>}
        <option value="admin">Admin</option>
        <option value="manager">Manager</option>
        <option value="member">Member</option>
        <option value="viewer">Viewer</option>
      </select>

      {status === "saving" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "11px",
            color: "var(--muted, #64748b)",
          }}
          title="Saving role..."
        >
          <Loader2 size={12} className="animate-spin" />
          <span style={{ fontSize: "10.5px" }}>Saving...</span>
        </span>
      )}

      {status === "saved" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
            fontSize: "11px",
            fontWeight: 600,
            color: "#16a34a",
          }}
          title="Role updated successfully"
        >
          <Check size={13} strokeWidth={2.5} />
          <span style={{ fontSize: "10.5px" }}>Saved</span>
        </span>
      )}

      {status === "error" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "10.5px",
            color: "#dc2626",
            maxWidth: "140px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={errorMsg || "Error updating role"}
        >
          <AlertCircle size={12} />
          {errorMsg || "Error"}
        </span>
      )}
    </div>
  );
}
