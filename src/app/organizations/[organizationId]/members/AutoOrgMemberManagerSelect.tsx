"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { updateOrganizationMemberManagerDirect } from "@/app/actions";

export default function AutoOrgMemberManagerSelect({
  organizationId,
  userId,
  initialManagerId,
  candidates,
  memberName,
}: {
  organizationId: string;
  userId: string;
  initialManagerId?: string | null;
  candidates: Array<{ user_id: string; label: string; role: string }>;
  memberName: string;
}) {
  const router = useRouter();
  const [managerId, setManagerId] = useState(initialManagerId ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleManagerChange = (newManagerId: string) => {
    const previousManagerId = managerId;
    setManagerId(newManagerId);
    setStatus("saving");
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await updateOrganizationMemberManagerDirect({
          organizationId,
          userId,
          managerId: newManagerId || null,
        });

        if (!res.success) {
          setManagerId(previousManagerId);
          setStatus("error");
          setErrorMsg(res.error || "Update failed");
          setTimeout(() => setStatus("idle"), 4000);
        } else {
          setStatus("saved");
          // Smoothly refresh server components (e.g. hierarchy tree) in the background without a full page reload or query params
          router.refresh();
          setTimeout(() => setStatus("idle"), 2500);
        }
      } catch (err: any) {
        setManagerId(previousManagerId);
        setStatus("error");
        setErrorMsg(err?.message || "Failed to save");
        setTimeout(() => setStatus("idle"), 4000);
      }
    });
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", verticalAlign: "middle" }}>
      <select
        value={managerId}
        onChange={(e) => handleManagerChange(e.target.value)}
        disabled={status === "saving" || isPending}
        aria-label={`Immediate manager for ${memberName}`}
        style={{
          fontSize: "0.82rem",
          padding: "0.25rem 0.5rem",
          borderRadius: "6px",
          border: status === "error" ? "1px solid #ef4444" : "1px solid var(--border-color, #cbd5e1)",
          background: "var(--paper, #fff)",
          color: "inherit",
          cursor: "pointer",
          maxWidth: "180px",
          outline: "none",
          transition: "border-color 0.15s ease",
        }}
      >
        <option value="">Top level (No manager)</option>
        {candidates.map((candidate) => (
          <option key={candidate.user_id} value={candidate.user_id}>
            {candidate.label} ({candidate.role})
          </option>
        ))}
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
          title="Saving reporting manager..."
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
          title="Reporting line saved"
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
            maxWidth: "150px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={errorMsg || "Error updating reporting line"}
        >
          <AlertCircle size={12} />
          {errorMsg || "Error"}
        </span>
      )}
    </div>
  );
}
