"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";
import ProjectExportModal from "./ProjectExportModal";

interface ProjectExportButtonProps {
  projectId: string;
  projectName: string;
  tasks: Array<any>;
  statuses: Array<{ id: string; name: string; color: string; category?: string }>;
  members: Array<{ id: string; label: string; email?: string }>;
  customFields?: Array<{ id: string; name: string; field_type: string }>;
}

export default function ProjectExportButton({
  projectId,
  projectName,
  tasks,
  statuses,
  members,
  customFields,
}: ProjectExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="export-link"
        onClick={() => setIsOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          background: "transparent",
          border: "1px solid var(--line, #cbd5e1)",
          borderRadius: "6px",
          padding: "4px 9px",
          color: "var(--ink, #334155)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
        }}
        title="Export project tasks to Excel, HTML, or CSV with custom attribute templates"
      >
        <Download size={13} style={{ color: "var(--green, #167c58)" }} />
        <span>Export</span>
      </button>

      <ProjectExportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        projectId={projectId}
        projectName={projectName}
        tasks={tasks}
        statuses={statuses}
        members={members}
        customFields={customFields}
      />
    </>
  );
}
