"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { deleteWorkspace } from "@/app/actions";

export default function DeleteWorkspaceButton({
  workspaceId,
  workspaceName,
  returnTo,
  compact = false,
}: {
  workspaceId: string;
  workspaceName: string;
  returnTo?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const isMatch = confirmText.trim().toLowerCase() === workspaceName.trim().toLowerCase();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirmText("");
          setOpen(true);
        }}
        className="button button-secondary"
        style={
          compact
            ? {
                minHeight: 30,
                padding: "0 10px",
                fontSize: "0.78rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                borderColor: "#fca5a5",
                color: "#dc2626",
              }
            : {
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "6px 12px",
                minHeight: 34,
                borderColor: "#fca5a5",
                color: "#dc2626",
              }
        }
        title={`Delete workspace "${workspaceName}"`}
      >
        <Trash2 size={compact ? 12 : 14} />
        <span>{compact ? "Delete" : "Delete Workspace"}</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="proj-modal-overlay"
            style={{ zIndex: 20015 }}
            onClick={() => setOpen(false)}
          >
            <div
              className="proj-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Delete workspace ${workspaceName}`}
              style={{ maxWidth: 460 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="proj-modal-head">
                <h2 style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#dc2626" }}>
                  <AlertTriangle size={17} />
                  <span>Delete workspace</span>
                </h2>
                <button
                  type="button"
                  className="proj-modal-close"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="proj-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink)" }}>
                  This permanently deletes <strong>{workspaceName}</strong> along with all of its projects, tasks,
                  documents, time logs, and workspace settings. This action cannot be undone.
                </p>
                <form action={deleteWorkspace} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                    <span>
                      Type <strong>{workspaceName}</strong> to confirm:
                    </span>
                    <input
                      type="text"
                      name="confirmName"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={workspaceName}
                      autoFocus
                      required
                      style={{
                        height: 38,
                        padding: "0 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line, #cbd5e1)",
                        background: "var(--paper, #fff)",
                        color: "var(--ink)",
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isMatch}
                      className="button"
                      style={{
                        background: isMatch ? "#dc2626" : "#f1f5f9",
                        color: isMatch ? "#fff" : "#94a3b8",
                        border: "1px solid " + (isMatch ? "#b91c1c" : "#e2e8f0"),
                        cursor: isMatch ? "pointer" : "not-allowed",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Permanently Delete</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
