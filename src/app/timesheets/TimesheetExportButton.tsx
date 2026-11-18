"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import TimesheetExportModal from "@/app/timesheets/TimesheetExportModal";

interface TimesheetExportButtonProps {
  scope: "workspace" | "project" | "organization";
  targetId: string;
  scopeName: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "icon" | "tile-link";
  className?: string;
}

export default function TimesheetExportButton({
  scope,
  targetId,
  scopeName,
  label = "Export Timesheets Excel",
  variant = "primary",
  className,
}: TimesheetExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(true);
  };

  let buttonElement: React.ReactNode;

  if (variant === "icon") {
    buttonElement = (
      <button
        type="button"
        onClick={handleClick}
        className={className || "ov-ws-icon-link"}
        title={`Export ${scopeName} timesheets to Excel (.xlsx)`}
        aria-label={`Export ${scopeName} timesheets to Excel`}
        style={{
          cursor: "pointer",
          background: "transparent",
          border: "1px solid var(--line, #e2e8f0)",
          color: "#16a34a",
        }}
      >
        <FileSpreadsheet size={13} />
      </button>
    );
  } else if (variant === "tile-link") {
    buttonElement = (
      <button
        type="button"
        onClick={handleClick}
        className={className}
        title={`Export ${scopeName} timesheets to Excel (.xlsx)`}
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          font: "inherit",
          fontSize: "inherit",
          fontWeight: 600,
          color: "#15803d",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <FileSpreadsheet size={12} />
        <span>{label}</span>
      </button>
    );
  } else if (variant === "ghost") {
    buttonElement = (
      <button
        type="button"
        onClick={handleClick}
        className={className || "ov-btn ov-btn-ghost"}
        title={`Export ${scopeName} timesheets to multi-sheet Excel (.xlsx)`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
        }}
      >
        <FileSpreadsheet size={14} color="#16a34a" />
        <span>{label}</span>
      </button>
    );
  } else if (variant === "secondary") {
    buttonElement = (
      <button
        type="button"
        onClick={handleClick}
        className={className || "button button-secondary"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          padding: "6px 12px",
          minHeight: 34,
          fontWeight: 600,
          cursor: "pointer",
        }}
        title={`Export ${scopeName} timesheets to multi-sheet Excel (.xlsx)`}
      >
        <FileSpreadsheet size={14} color="#16a34a" />
        <span>{label}</span>
      </button>
    );
  } else {
    buttonElement = (
      <button
        type="button"
        onClick={handleClick}
        className={className || "button button-primary"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          padding: "7px 14px",
          minHeight: 34,
          fontWeight: 600,
          background: "#16a34a",
          borderColor: "#15803d",
          color: "#ffffff",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        title={`Export ${scopeName} timesheets to multi-sheet Excel (.xlsx)`}
      >
        <FileSpreadsheet size={14} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <>
      {buttonElement}
      {isOpen && (
        <TimesheetExportModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          scope={scope}
          targetId={targetId}
          scopeName={scopeName}
        />
      )}
    </>
  );
}
