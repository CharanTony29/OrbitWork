"use client";

import { useState } from "react";
import {
  Presentation,
  Download,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface ExportPresentationModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  defaultPeriod?: "weekly" | "monthly" | "yearly" | "custom" | "all";
}

export default function ExportPresentationModal({
  projectId,
  projectName,
  isOpen,
  onClose,
  defaultPeriod = "monthly",
}: ExportPresentationModalProps) {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly" | "custom" | "all">(
    defaultPeriod
  );

  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7); // e.g. "2026-11"
  const currentYear = String(today.getFullYear());

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [includeCatalog, setIncludeCatalog] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsExporting(true);

    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "monthly") {
      params.set("month", selectedMonth);
    } else if (period === "yearly") {
      params.set("year", selectedYear);
    } else if (period === "custom") {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    params.set("includeCatalog", includeCatalog ? "true" : "false");

    const exportUrl = `/api/projects/${projectId}/presentation.pptx?${params.toString()}`;

    // Trigger download
    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsExporting(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="canvas-modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="canvas-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 640,
          borderRadius: 14,
          overflow: "hidden",
          padding: 0,
          background: "var(--surface, #ffffff)",
          color: "var(--ink, #17231f)",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.35)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            padding: "24px 28px",
            color: "#ffffff",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              background: "rgba(255,255,255,0.12)",
              border: 0,
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              cursor: "pointer",
            }}
            title="Close"
          >
            <X size={16} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span
              style={{
                background: "rgba(234, 179, 8, 0.2)",
                color: "#eab308",
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Presentation size={13} /> EXECUTIVE EXPORT
            </span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{projectName}</span>
          </div>

          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#ffffff" }}>
            Export Professional Presentation (PPT)
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
            Generate a 16:9 widescreen boardroom-ready PowerPoint deck complete with KPIs,
            status breakdown, resource ownership, and blocker analysis.
          </p>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px 28px", display: "grid", gap: 20 }}>
          {/* Period Selector Tabs */}
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink, #334155)",
                marginBottom: 8,
                display: "block",
              }}
            >
              SELECT REPORTING TIMEFRAME
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 6,
                background: "var(--app-bg, #f1f5f9)",
                padding: 4,
                borderRadius: 10,
                border: "1px solid var(--line, #e2e8f0)",
              }}
            >
              {(
                [
                  { id: "weekly", label: "Weekly" },
                  { id: "monthly", label: "Month-wise" },
                  { id: "yearly", label: "Yearly" },
                  { id: "custom", label: "Custom Dates" },
                  { id: "all", label: "All Tasks" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  style={{
                    border: 0,
                    borderRadius: 7,
                    padding: "9px 6px",
                    fontSize: 12,
                    fontWeight: period === tab.id ? 700 : 500,
                    color: period === tab.id ? "var(--ink, #0f172a)" : "var(--muted, #64748b)",
                    background: period === tab.id ? "var(--surface, #ffffff)" : "transparent",
                    boxShadow:
                      period === tab.id ? "0 2px 6px rgba(0,0,0,0.12)" : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Date Pickers based on Period */}
          <div
            style={{
              background: "var(--surface-subtle, #f8fafc)",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: 10,
              padding: "16px 18px",
            }}
          >
            {period === "weekly" && (
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--ink, #1e293b)" }}>
                  Current Week Overview
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted, #64748b)" }}>
                  Includes deliverables active, scheduled, or delivered during the current work
                  week (Monday through Sunday).
                </p>
              </div>
            )}

            {period === "monthly" && (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink, #1e293b)" }}>
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line, #cbd5e1)",
                    fontSize: 13,
                    maxWidth: 220,
                    background: "var(--surface, #ffffff)",
                    color: "var(--ink, #17231f)",
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
                  Generates an executive monthly review for the selected calendar month.
                </span>
              </div>
            )}

            {period === "yearly" && (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink, #1e293b)" }}>
                  Select Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line, #cbd5e1)",
                    fontSize: 13,
                    maxWidth: 220,
                    background: "var(--surface, #ffffff)",
                    color: "var(--ink, #17231f)",
                  }}
                >
                  <option value="2026">2026 (Current Year)</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
                <span style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
                  Consolidates full-year milestone execution, completed deliveries, and annual velocity.
                </span>
              </div>
            )}

            {period === "custom" && (
              <div style={{ display: "grid", gap: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--ink, #1e293b)" }}>
                  Specify Date Range
                </p>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        fontSize: 11,
                        color: "var(--muted, #64748b)",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      From (Start Date)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--line, #cbd5e1)",
                        fontSize: 13,
                        background: "var(--surface, #ffffff)",
                        color: "var(--ink, #17231f)",
                      }}
                    />
                  </div>
                  <span style={{ color: "var(--muted, #94a3b8)", marginTop: 16 }}>→</span>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        fontSize: 11,
                        color: "var(--muted, #64748b)",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      To (End Date)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--line, #cbd5e1)",
                        fontSize: 13,
                        background: "var(--surface, #ffffff)",
                        color: "var(--ink, #17231f)",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {period === "all" && (
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--ink, #1e293b)" }}>
                  Full Project Lifecycle Snapshot
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted, #64748b)" }}>
                  Includes all tasks, deliverables, and team assignments across the entire project history.
                </p>
              </div>
            )}
          </div>

          {/* Slide Deck Contents Preview Checklist */}
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink, #334155)",
                marginBottom: 8,
                display: "block",
              }}
            >
              PRESENTATION SLIDES INCLUDED (16:9 WIDESCREEN)
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                fontSize: 12,
                color: "var(--ink, #334155)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>Slide 1: Executive Title & Cover</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>Slide 2: Executive KPI Dashboard</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>Slide 3: Status Lifecycle Breakdown</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>Slide 4: Team Workload (Who Works on What)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>Slide 5: Critical & Overdue Deliverables</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>Slide 6+: Paginated Task Catalog</span>
              </div>
            </div>
          </div>

          {/* Toggle for Detailed Catalog */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--ink, #1e293b)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={includeCatalog}
              onChange={(e) => setIncludeCatalog(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#2563eb" }}
            />
            <span>Include detailed item-by-item task catalog table slides</span>
          </label>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 28px",
            background: "var(--surface-subtle, #f8fafc)",
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="button button-secondary"
            style={{ minHeight: 38 }}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="button button-primary"
            style={{
              minHeight: 38,
              background: "#0f172a",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.25)",
            }}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Generating Deck...
              </>
            ) : (
              <>
                <Download size={15} /> Download PowerPoint (.pptx)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
