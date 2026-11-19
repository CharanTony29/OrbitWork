"use client";

import { Video } from "lucide-react";

export default function MeetingStudioTrigger({
  projectId,
  workspaceId,
}: {
  projectId?: string;
  workspaceId?: string;
}) {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("orbitwork:open-meeting-studio", {
        detail: { projectId, workspaceId },
      })
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        height: "28px",
        padding: "0 10px",
        borderRadius: "6px",
        border: "1px solid var(--line, #e2e8f0)",
        background: "var(--surface, #ffffff)",
        color: "var(--ink, #1e293b)",
        fontSize: "11px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      title="Upload Zoom/Teams recording to generate MoM and Action Items (Otter.ai alternate)"
    >
      <Video size={13} style={{ color: "var(--green, #10b981)" }} />
      <span>Meeting Studio</span>
    </button>
  );
}
