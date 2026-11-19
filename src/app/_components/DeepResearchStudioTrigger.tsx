"use client";

import { Globe } from "lucide-react";

export default function DeepResearchStudioTrigger({
  projectId,
}: {
  projectId?: string;
}) {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("orbitwork:open-deep-research", {
        detail: { projectId },
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
      title="Conduct deep web research and cited market analysis (Perplexity alternative)"
    >
      <Globe size={13} style={{ color: "#2563eb" }} />
      <span>Deep Research</span>
    </button>
  );
}
