"use client";

import { useState } from "react";
import { Presentation } from "lucide-react";
import ExportPresentationModal from "../ExportPresentationModal";

interface ExportPresentationButtonProps {
  projectId: string;
  projectName: string;
}

export default function ExportPresentationButton({
  projectId,
  projectName,
}: ExportPresentationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="button"
        style={{
          background: "#0f172a",
          color: "#ffffff",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontWeight: 700,
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.16)",
        }}
      >
        <Presentation size={15} /> Export Presentation (PPT)
      </button>

      <ExportPresentationModal
        projectId={projectId}
        projectName={projectName}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
