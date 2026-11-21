"use client";

import { useState } from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";

export default function DismissibleAlert({
  type = "notice",
  children,
  onDismiss,
}: {
  type?: "notice" | "error";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isError = type === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "10px 14px",
        borderRadius: "8px",
        marginBottom: "14px",
        fontSize: "13.5px",
        lineHeight: "1.4",
        backgroundColor: isError ? "var(--error-subtle, #fef2f2)" : "var(--success-subtle, #ecfdf5)",
        color: isError ? "var(--error, #b91c1c)" : "var(--success, #047857)",
        border: `1px solid ${isError ? "#fecaca" : "#a7f3d0"}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
        {isError ? <AlertCircle size={16} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={16} style={{ flexShrink: 0 }} />}
        <span>{children}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          onDismiss?.();
        }}
        aria-label="Dismiss alert"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "3px",
          color: "currentColor",
          opacity: 0.7,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "4px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7";
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
