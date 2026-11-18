"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, X, Loader2 } from "lucide-react";

type ExportScope = "workspace" | "project" | "organization";

interface TimesheetExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ExportScope;
  targetId: string;
  scopeName: string;
}

export default function TimesheetExportModal({
  isOpen,
  onClose,
  scope,
  targetId,
  scopeName,
}: TimesheetExportModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

  const [mounted, setMounted] = useState(false);
  const [rangeType, setRangeType] = useState<"month" | "year" | "custom">("month");
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [customStart, setCustomStart] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        scope,
        id: targetId,
        range: rangeType,
      });

      if (rangeType === "year") {
        params.set("year", selectedYear);
      } else if (rangeType === "month") {
        params.set("year", selectedYear);
        params.set("month", selectedMonth);
      } else {
        if (!customStart || !customEnd) {
          setErrorMessage("Please select both start and end dates.");
          setIsExporting(false);
          return;
        }
        if (customStart > customEnd) {
          setErrorMessage("Start date cannot be after end date.");
          setIsExporting(false);
          return;
        }
        params.set("startDate", customStart);
        params.set("endDate", customEnd);
      }

      const res = await fetch(`/api/timesheets/export?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `timesheet_${scope}_${rangeType}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      onClose();
    } catch (err: any) {
      console.error("Export error:", err);
      setErrorMessage(err.message || "Failed to generate Excel export");
    } finally {
      setIsExporting(false);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - i));
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--paper, #fff)",
          borderRadius: 12,
          boxShadow: "0 20px 40px -12px rgba(0,0,0,0.25)",
          border: "1px solid var(--line, #e2e8f0)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#dcfce7",
                display: "grid",
                placeItems: "center",
                color: "#16a34a",
              }}
            >
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                Export Timesheets to Excel
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted, #64748b)" }}>
                {scope.toUpperCase()}: {scopeName}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            style={{ padding: "4px", width: 28, height: 28, minHeight: 28, display: "grid", placeItems: "center" }}
            aria-label="Close export modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>
          {errorMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: 12,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Timeframe Type Picker */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink, #1e293b)", marginBottom: 8 }}>
              Export Timeframe
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {(["month", "year", "custom"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRangeType(type)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: rangeType === type ? 600 : 500,
                    border: rangeType === type ? "2px solid #16a34a" : "1px solid var(--line, #e2e8f0)",
                    background: rangeType === type ? "rgba(22, 163, 74, 0.1)" : "var(--paper, #fff)",
                    color: rangeType === type ? "#15803d" : "var(--ink, #334155)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {type === "custom" ? "Custom Range" : `By ${type}`}
                </button>
              ))}
            </div>
          </div>

          {/* Period Inputs */}
          {rangeType === "month" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 4 }}>
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "7px 10px", fontSize: 13 }}
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 4 }}>
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "7px 10px", fontSize: 13 }}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {rangeType === "year" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 4 }}>
                Select Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="input"
                style={{ width: "100%", padding: "7px 10px", fontSize: 13 }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    Full Year {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {rangeType === "custom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 4 }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 4 }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* Info note */}
          <div
            style={{
              padding: "10px 12px",
              background: "var(--surface, #f8fafc)",
              borderRadius: 8,
              border: "1px solid var(--line, #e2e8f0)",
              fontSize: 11,
              color: "var(--muted, #64748b)",
              lineHeight: 1.5,
            }}
          >
            <strong>Excel Structure:</strong> Generates an <em>Overview Summary</em> tab with overall KPIs and member breakdown, plus a <em>dedicated sheet for each team member</em> detailing all tasks, projects, notes, and hours worked.
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 20px",
            background: "var(--surface, #f8fafc)",
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={isExporting}
            style={{ fontSize: 12, padding: "6px 14px", minHeight: 34 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              fontSize: 12,
              padding: "6px 16px",
              minHeight: 34,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#16a34a",
              borderColor: "#15803d",
              color: "#fff",
            }}
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Generating XLSX…</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Export Workbook (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
