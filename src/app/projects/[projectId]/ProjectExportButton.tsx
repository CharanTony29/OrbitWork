"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, Presentation, Sparkles, FileSpreadsheet, ChevronDown, Clock3 } from "lucide-react";
import ProjectExportModal from "./ProjectExportModal";
import ExportPresentationModal from "./ExportPresentationModal";
import TimesheetExportModal from "@/app/timesheets/TimesheetExportModal";

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isPresentationModalOpen, setIsPresentationModalOpen] = useState(false);
  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={dropdownRef}>
      <button
        type="button"
        className="export-link"
        onClick={() => setIsDropdownOpen((prev) => !prev)}
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
        title="Export Project Presentation Deck or Task Data"
      >
        <Download size={13} style={{ color: "var(--green, #167c58)" }} />
        <span>Export</span>
        <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>

      {/* Modern Export Options Dropdown Menu */}
      {isDropdownOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            width: 280,
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
            padding: "6px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {/* Option 0: AI Presentation Studio (Interactive & PPTX) */}
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(false);
              window.dispatchEvent(
                new CustomEvent("orbitwork:open-presentation-studio", {
                  detail: {
                    projectId,
                    topic: `${projectName} Executive Strategy, Milestones & KPI Deck`,
                  },
                })
              );
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: 0,
              background: "transparent",
              color: "var(--ink, #0f172a)",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-subtle, #f1f5f9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "6px",
                background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Sparkles size={15} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                AI Presentations
                <span
                  style={{
                    background: "rgba(168, 85, 247, 0.15)",
                    color: "#7e22ce",
                    fontSize: "9px",
                    fontWeight: 800,
                    padding: "1px 5px",
                    borderRadius: "4px",
                  }}
                >
                  AI Studio
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted, #64748b)", lineHeight: 1.3 }}>
                Generate interactive slide decks with AI from project milestones &amp; tasks.
              </p>
            </div>
          </button>

          {/* Option 1: Executive Presentation Deck (PPTX) */}
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(false);
              setIsPresentationModalOpen(true);
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: 0,
              background: "transparent",
              color: "var(--ink, #0f172a)",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-subtle, #f1f5f9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "6px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Presentation size={15} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                Presentation Deck (PPTX)
                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#059669",
                    fontSize: "9px",
                    fontWeight: 800,
                    padding: "1px 5px",
                    borderRadius: "4px",
                  }}
                >
                  32+ Styles
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted, #64748b)", lineHeight: 1.3 }}>
                Pitch-style 16:9 widescreen slides, vector charts &amp; executive KPI cards.
              </p>
            </div>
          </button>

          {/* Option 2: Project Tasks Data (Excel, HTML, CSV) */}
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(false);
              setIsTasksModalOpen(true);
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: 0,
              background: "transparent",
              color: "var(--ink, #0f172a)",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-subtle, #f1f5f9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "6px",
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <FileSpreadsheet size={15} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700 }}>Export Tasks Data</div>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted, #64748b)", lineHeight: 1.3 }}>
                Download deliverables to Excel (.xlsx), HTML, or raw CSV.
              </p>
            </div>
          </button>

          {/* Option 3: Multi-Sheet Timesheets Report (Excel) */}
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(false);
              setIsTimesheetModalOpen(true);
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: 0,
              background: "transparent",
              color: "var(--ink, #0f172a)",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-subtle, #f1f5f9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "6px",
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Clock3 size={15} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                Export Timesheets (Excel)
                <span
                  style={{
                    background: "rgba(22, 163, 74, 0.14)",
                    color: "#15803d",
                    fontSize: "9px",
                    fontWeight: 800,
                    padding: "1px 5px",
                    borderRadius: "4px",
                  }}
                >
                  Per User
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted, #64748b)", lineHeight: 1.3 }}>
                Multi-sheet Excel workbook by team member for yearly, monthly, or custom dates.
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Modal 1: Tasks Data Exporter */}
      <ProjectExportModal
        isOpen={isTasksModalOpen}
        onClose={() => setIsTasksModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        tasks={tasks}
        statuses={statuses}
        members={members}
        customFields={customFields}
      />

      {/* Modal 2: 32+ Templates Executive Presentation Exporter */}
      <ExportPresentationModal
        isOpen={isPresentationModalOpen}
        onClose={() => setIsPresentationModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
      />

      {/* Modal 3: Multi-Sheet Timesheets Excel Exporter */}
      <TimesheetExportModal
        isOpen={isTimesheetModalOpen}
        onClose={() => setIsTimesheetModalOpen(false)}
        scope="project"
        targetId={projectId}
        scopeName={projectName}
      />
    </div>
  );
}
