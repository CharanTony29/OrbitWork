"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { updateWorkspaceMemberRoleDirect } from "@/app/actions";

export default function AutoWorkspaceMemberRoleSelect({
  workspaceId,
  userId,
  initialRole,
  isOrgAdmin,
}: {
  workspaceId: string;
  userId: string;
  initialRole: string;
  isOrgAdmin: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (newRole: "admin" | "manager" | "member" | "viewer") => {
    const previousRole = role;
    setRole(newRole);
    setStatus("saving");
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await updateWorkspaceMemberRoleDirect({
          workspaceId,
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
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, verticalAlign: "middle" }}>
      <select
        value={role}
        onChange={(e) => handleRoleChange(e.target.value as any)}
        disabled={status === "saving" || isPending}
        style={{
          height: 30,
          lineHeight: "28px",
          fontSize: 11,
          padding: "0 8px",
          borderRadius: 6,
          border: status === "error" ? "1px solid #ef4444" : "1px solid #dfe5e0",
          background: "#fff",
          verticalAlign: "middle",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <option value="viewer">Viewer (Read-only)</option>
        <option value="member">Member (Can edit &amp; upload)</option>
        <option value="manager">Manager</option>
        {isOrgAdmin && <option value="admin">Admin</option>}
      </select>

      {status === "saving" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            color: "var(--muted, #64748b)",
          }}
          title="Saving workspace role..."
        >
          <Loader2 size={12} className="animate-spin" />
          <span style={{ fontSize: 10 }}>Saving...</span>
        </span>
      )}

      {status === "saved" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            fontSize: 11,
            fontWeight: 600,
            color: "#16a34a",
          }}
          title="Role updated"
        >
          <Check size={13} strokeWidth={2.5} />
          <span style={{ fontSize: 10 }}>Saved</span>
        </span>
      )}

      {status === "error" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 10.5,
            color: "#dc2626",
            maxWidth: 130,
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
