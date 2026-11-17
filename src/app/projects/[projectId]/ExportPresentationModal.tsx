"use client";

import { useState, useMemo } from "react";
import {
  Presentation,
  Download,
  X,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Upload,
  Layers,
  BarChart3,
  Users,
  AlertTriangle,
  Calendar,
  Check,
  FileSpreadsheet,
} from "lucide-react";
import {
  PRESENTATION_TEMPLATES,
  PresentationTemplate,
  TemplateCategory,
  getTemplateById,
  getArchetype,
  ARCHETYPE_SYSTEMS,
  DesignArchetype,
} from "@/lib/presentation/templates";

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
  const currentMonth = today.toISOString().slice(0, 7);
  const currentYear = String(today.getFullYear());

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [includeCatalog, setIncludeCatalog] = useState(true);

  // Template Selection & Explorer State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("pitch_sage");
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Custom RGB State
  const [customPrimary, setCustomPrimary] = useState("#0f172a");
  const [customCard, setCustomCard] = useState("#1e293b");
  const [customAccent, setCustomAccent] = useState("#2563eb");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return PRESENTATION_TEMPLATES.filter((t) => {
      const matchesCat = activeCategory === "all" || t.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const activeTemplate = useMemo(() => {
    const t = getTemplateById(selectedTemplateId);
    if (selectedTemplateId === "custom_brand") {
      return {
        ...t,
        bg: customPrimary.replace("#", ""),
        cardBg: customCard.replace("#", ""),
        accent: customAccent.replace("#", ""),
      };
    }
    return t;
  }, [selectedTemplateId, customPrimary, customCard, customAccent]);

  const archetype: DesignArchetype = getArchetype(activeTemplate);
  const archetypeSystem = ARCHETYPE_SYSTEMS[archetype];

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
    params.set("templateId", selectedTemplateId);
    if (selectedTemplateId === "custom_brand") {
      params.set("style", "custom");
      params.set("customPrimary", customPrimary);
      params.set("customSecondary", customCard);
      params.set("customAccent", customAccent);
    }
    if (aiPrompt.trim()) {
      params.set("aiPrompt", aiPrompt.trim());
    }

    const exportUrl = `/api/projects/${projectId}/presentation.pptx?${params.toString()}`;

    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${selectedTemplateId}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsExporting(false);
      onClose();
    }, 1200);
  };

  const slidesMeta = [
    { id: 0, title: "Executive Title & Cover", icon: Presentation },
    { id: 1, title: "Executive KPI Dashboard", icon: BarChart3 },
    { id: 2, title: "Status Lifecycle Breakdown", icon: Layers },
    { id: 3, title: "Team Workload & Capacity", icon: Users },
    { id: 4, title: "Critical & Overdue Deliverables", icon: AlertTriangle },
    { id: 5, title: "Paginated Task Catalog", icon: FileSpreadsheet },
  ];

  return (
    <div
      className="canvas-modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
    >
      <div
        className="canvas-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 1140,
          maxHeight: "92vh",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
          padding: 0,
          background: "var(--surface, #111827)",
          color: "var(--ink, #f3f4f6)",
          border: "1px solid var(--line, #374151)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div
          style={{
            flexShrink: 0,
            background: "linear-gradient(135deg, #090d16 0%, #111827 100%)",
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
              }}
            >
              <Presentation size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#ffffff" }}>
                  Export Executive Presentation (PPTX)
                </h2>
                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                  }}
                >
                  32+ TEMPLATES
                </span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{projectName}</span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>
                Interactive 16:9 widescreen presentation deck with real vector charts, executive cards, and clickable slide navigation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              color: "#9ca3af",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            scrollbarWidth: "thin",
          }}
        >
          {/* Timeframe Selector Pills */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>
                Timeframe:
              </span>
              <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.3)", padding: 3, borderRadius: 8 }}>
                {(
                  [
                    { id: "weekly", label: "Weekly" },
                    { id: "monthly", label: "Monthly" },
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
                      borderRadius: 6,
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: period === tab.id ? 700 : 500,
                      color: period === tab.id ? "#ffffff" : "#9ca3af",
                      background: period === tab.id ? "#2563eb" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-selectors */}
            {period === "monthly" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#1f2937",
                    color: "#ffffff",
                    fontSize: 12,
                  }}
                />
              </div>
            )}
            {period === "yearly" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#1f2937",
                    color: "#ffffff",
                    fontSize: 12,
                  }}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            )}
            {period === "custom" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#1f2937",
                    color: "#ffffff",
                    fontSize: 12,
                  }}
                />
                <span style={{ color: "#9ca3af" }}>→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#1f2937",
                    color: "#ffffff",
                    fontSize: 12,
                  }}
                />
              </div>
            )}
          </div>

          {/* SECTION 1: PITCH-STYLE INTERACTIVE SLIDE DECK VIEWER */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 260px",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {/* 16:9 Main Interactive Slide Stage */}
            <div
              style={{
                background: `#${activeTemplate.bg}`,
                borderRadius: 14,
                border: `1px solid #${activeTemplate.cardBorder}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                minHeight: 330,
                color: `#${activeTemplate.textPrimary}`,
                transition: "all 0.25s ease",
              }}
            >
              {/* Interactive Slide Header / Nav */}
              <div
                style={{
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: `1px solid #${activeTemplate.cardBorder}`,
                  background: activeTemplate.isDark
                    ? "rgba(0, 0, 0, 0.25)"
                    : "rgba(255, 255, 255, 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: `#${activeTemplate.accent}`,
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" }}>
                    {activeTemplate.name.toUpperCase()}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: `#${activeTemplate.accent}25`,
                      border: `1px solid #${activeTemplate.accent}60`,
                      fontSize: 10,
                      fontWeight: 800,
                      color: `#${activeTemplate.accent}`,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {archetypeSystem.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: `#${activeTemplate.textSecondary}`,
                      opacity: 0.8,
                      display: "inline-block",
                      maxWidth: 320,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {archetypeSystem.description}
                  </span>
                </div>

                {/* Clickable section tabs */}
                <div style={{ display: "flex", gap: 4 }}>
                  {slidesMeta.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlideIndex(idx)}
                      style={{
                        border: 0,
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: activeSlideIndex === idx ? 700 : 500,
                        cursor: "pointer",
                        background:
                          activeSlideIndex === idx
                            ? `#${activeTemplate.accent}`
                            : "transparent",
                        color:
                          activeSlideIndex === idx
                            ? "#ffffff"
                            : `#${activeTemplate.textSecondary}`,
                      }}
                    >
                      {s.title.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slide Content Dynamic Renderer */}
              <div
                style={{
                  flex: 1,
                  padding: "24px 32px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  position: "relative",
                  fontFamily: activeTemplate.fontTitle || "Inter, sans-serif",
                  overflow: "hidden",
                }}
              >
                {/* ========================================================= */}
                {/* SLIDE 0: TITLE & COVER SLIDE (7 DISTINCT ARCHETYPES)     */}
                {/* ========================================================= */}
                {activeSlideIndex === 0 && (
                  <div>
                    {/* 1. EDITORIAL COVER */}
                    {archetype === "editorial" && (
                      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                        <div style={{ width: 6, height: 180, background: `#${activeTemplate.accent}`, borderRadius: 3 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: `#${activeTemplate.accent}` }}>
                            EXECUTIVE BRIEFING // {period.toUpperCase()}
                          </span>
                          <h1 style={{ margin: "10px 0 14px", fontSize: 36, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                            <span style={{ color: `#${activeTemplate.textPrimary}` }}>PROJECT STATUS &</span><br />
                            <span style={{ color: `#${activeTemplate.accent}` }}>KPI REPORT</span>
                          </h1>
                          <p style={{ margin: 0, fontSize: 14, color: `#${activeTemplate.textSecondary}` }}>
                            Project: <strong style={{ color: `#${activeTemplate.textPrimary}` }}>{projectName}</strong> • Confirmed Scope &amp; Milestones
                          </p>
                          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                            <div style={{ padding: "8px 14px", borderRadius: 8, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, fontSize: 11 }}>
                              <span style={{ opacity: 0.7 }}>Takeaway: </span>
                              <strong>78% Milestone Delivery Achieved</strong>
                            </div>
                            <div style={{ padding: "8px 14px", borderRadius: 8, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, fontSize: 11 }}>
                              <span style={{ opacity: 0.7 }}>Cadence: </span>
                              <strong>{period.toUpperCase()}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. CORPORATE BOARDROOM COVER */}
                    {archetype === "corporate" && (
                      <div style={{ borderTop: `3px solid #${activeTemplate.accent}`, borderBottom: `3px solid #${activeTemplate.accent}`, padding: "20px 0" }}>
                        <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: `#${activeTemplate.accent}`, marginBottom: 8 }}>
                          BOARD OF DIRECTORS EXECUTIVE AUDIT // GOVERNANCE REPORT
                        </div>
                        <h1 style={{ textAlign: "center", margin: 0, fontSize: 30, fontWeight: 800, color: `#${activeTemplate.textPrimary}`, letterSpacing: "-0.01em" }}>
                          PROJECT STATUS &amp; GOVERNANCE REPORT
                        </h1>
                        <p style={{ textAlign: "center", margin: "8px 0 18px", fontSize: 13, color: `#${activeTemplate.textSecondary}` }}>
                          Performance Verification &amp; Milestone Audit • Project: {projectName}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, background: `#${activeTemplate.cardBg}`, padding: 12, borderRadius: 4, border: `1px solid #${activeTemplate.cardBorder}` }}>
                          <div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>ORGANIZATION</div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>Orbitwork Corp</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>PERIOD</div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{period.toUpperCase()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>CONFIRMED SCOPE</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: `#${activeTemplate.accent}` }}>176 Tasks</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>AUDIT STATUS</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>APPROVED</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. MODERN SAAS BENTO HERO COVER */}
                    {archetype === "modern_saas" && (
                      <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.accent}`, fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}`, marginBottom: 12 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: `#${activeTemplate.accent}` }} />
                          RELEASE v2.4 • LIVE STATUS TELEMETRY
                        </div>
                        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: `#${activeTemplate.textPrimary}`, lineHeight: 1.15 }}>
                          PROJECT EXECUTION &amp; VELOCITY
                        </h1>
                        <p style={{ margin: "8px 0 16px", fontSize: 13, color: `#${activeTemplate.textSecondary}` }}>
                          Continuous Delivery Pipeline • {projectName} • Live Tracked
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                          <div style={{ padding: "10px 14px", borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>VELOCITY</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: `#${activeTemplate.accent}` }}>78% <span style={{ fontSize: 10, color: "#10b981" }}>+14% DoD</span></div>
                          </div>
                          <div style={{ padding: "10px 14px", borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>ACTIVE SPRINT</div>
                            <div style={{ fontSize: 22, fontWeight: 800 }}>42 Tasks</div>
                          </div>
                          <div style={{ padding: "10px 14px", borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>CADENCE</div>
                            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{period.toUpperCase()}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. DATA STORYTELLING COVER */}
                    {archetype === "data_story" && (
                      <div style={{ fontFamily: "monospace" }}>
                        <div style={{ fontSize: 10, color: `#${activeTemplate.accent}`, fontWeight: 700, marginBottom: 6 }}>
                          TELEMETRY // REAL-TIME EXECUTION METRICS DASHBOARD // [STATUS: OPTIMAL]
                        </div>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: `#${activeTemplate.textPrimary}` }}>
                          SYSTEM EXECUTION TELEMETRY
                        </h1>
                        <p style={{ margin: "6px 0 16px", fontSize: 12, color: `#${activeTemplate.textSecondary}` }}>
                          Node: {projectName} • Stream: LIVE • Timestamp: {new Date().toLocaleTimeString()}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {[
                            { l: "COMPLETION RATIO", v: "78.4%", c: `#${activeTemplate.accent}` },
                            { l: "TOTAL DELIVERABLES", v: "176", c: `#${activeTemplate.textPrimary}` },
                            { l: "IN FLIGHT SCOPE", v: "42", c: "#38bdf8" },
                            { l: "EXCEPTION DELTA", v: "0", c: "#10b981" },
                          ].map((m, i) => (
                            <div key={i} style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                              <div style={{ fontSize: 8, opacity: 0.7 }}>{m.l}</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: m.c, marginTop: 4 }}>{m.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. STRATEGIC CONSULTING COVER */}
                    {archetype === "consulting" && (
                      <div>
                        <div style={{ background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, padding: "6px 12px", fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}`, marginBottom: 12 }}>
                          STRATEGIC ADVISORY ENGAGEMENT // DELIVERABLES GOVERNANCE
                        </div>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: `#${activeTemplate.textPrimary}`, lineHeight: 1.2 }}>
                          STRATEGIC DELIVERABLES &amp; EXECUTION GOVERNANCE
                        </h1>
                        <p style={{ margin: "8px 0 16px", fontSize: 13, color: `#${activeTemplate.textSecondary}`, fontStyle: "italic" }}>
                          Assessment of workstream velocity, deliverable readiness, and critical path governance for {projectName}.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                          {[
                            { t: "WORKSTREAM VELOCITY", v: "78% Complete", d: "Core milestones on schedule." },
                            { t: "ENGAGEMENT PERIOD", v: period.toUpperCase(), d: "Audit & reporting timeframe." },
                            { t: "EXECUTIVE VERDICT", v: "Approved", d: "Delivery health verified." },
                          ].map((col, i) => (
                            <div key={i} style={{ padding: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: `#${activeTemplate.accent}` }}>{col.t}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, margin: "4px 0" }}>{col.v}</div>
                              <div style={{ fontSize: 10, opacity: 0.7 }}>{col.d}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. SWISS MINIMALIST COVER */}
                    {archetype === "minimalist" && (
                      <div style={{ fontFamily: "Helvetica, sans-serif" }}>
                        <h1 style={{ margin: 0, fontSize: 44, fontWeight: 900, lineHeight: 1.05, color: `#${activeTemplate.textPrimary}`, letterSpacing: "-0.04em" }}>
                          PROJECT STATUS<br />REPORT
                        </h1>
                        <div style={{ height: 2, background: `#${activeTemplate.textPrimary}`, margin: "18px 0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: `#${activeTemplate.textSecondary}` }}>
                          <span>{projectName.toUpperCase()}</span>
                          <span>{period.toUpperCase()}</span>
                          <span style={{ color: `#${activeTemplate.accent}` }}>78% COMPLETED</span>
                        </div>
                      </div>
                    )}

                    {/* 7. CREATIVE LAYERED COVER */}
                    {archetype === "creative_layered" && (
                      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                        <div style={{ width: "35%", background: `#${activeTemplate.cardBg}`, border: `2px solid #${activeTemplate.accent}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}` }}>CREATIVE REPORT</span>
                          <div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: `#${activeTemplate.accent}` }}>78%</div>
                            <div style={{ fontSize: 11, color: `#${activeTemplate.textSecondary}` }}>Overall Output</div>
                          </div>
                        </div>
                        <div style={{ flex: 1, padding: "8px 0" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: `#${activeTemplate.accent}` }}>{projectName}</span>
                          <h1 style={{ margin: "4px 0 12px", fontSize: 28, fontWeight: 900, color: `#${activeTemplate.textPrimary}` }}>
                            EXECUTION &amp; CREATIVE PORTFOLIO
                          </h1>
                          <p style={{ margin: 0, fontSize: 13, color: `#${activeTemplate.textSecondary}` }}>
                            Scope Overview: 176 Confirmed Deliverables • {period.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* SLIDE 1: EXECUTIVE KPI DASHBOARD (7 DISTINCT ARCHETYPES)  */}
                {/* ========================================================= */}
                {activeSlideIndex === 1 && (
                  <div>
                    {/* 1. EDITORIAL KPI: 40% QUOTE NARRATIVE + 60% DUAL CARDS */}
                    {archetype === "editorial" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
                        <div style={{ padding: 16, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}` }}>EXECUTIVE NARRATIVE</div>
                          <p style={{ margin: "8px 0 12px", fontSize: 13, fontStyle: "italic", lineHeight: 1.4 }}>
                            "Delivery velocity is sustained across confirmed deliverables with 78% milestone completion."
                          </p>
                          <div style={{ fontSize: 10, opacity: 0.8, lineHeight: 1.6 }}>
                            • 176 Total Scope Items<br />
                            • 102 Deliverables Shipped<br />
                            • 42 Active in Sprint<br />
                            • 0 Critical Path Blockers
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ padding: 14, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 10, opacity: 0.7 }}>COMPLETION RATE</div>
                              <div style={{ fontSize: 32, fontWeight: 900, color: `#${activeTemplate.accent}` }}>78%</div>
                            </div>
                            <div style={{ fontSize: 11, textAlign: "right", opacity: 0.8 }}>
                              102 of 176 tasks<br />+14% vs last cycle
                            </div>
                          </div>
                          <div style={{ padding: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>DELIVERY VELOCITY BY STATUS</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 50 }}>
                              {[{ l: "Done", h: 78, c: `#${activeTemplate.accent}` }, { l: "Active", h: 35, c: "#3b82f6" }, { l: "Hold", h: 10, c: "#eab308" }, { l: "Queue", h: 20, c: "#9ca3af" }].map((b, i) => (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <div style={{ width: "100%", height: `${b.h}%`, background: b.c, borderRadius: 2 }} />
                                  <span style={{ fontSize: 8, opacity: 0.7 }}>{b.l}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. CORPORATE KPI: 4-PILLAR SCORECARD + VELOCITY LEDGER */}
                    {archetype === "corporate" && (
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                          {[
                            { l: "CONFIRMED SCOPE", v: "176", s: "Baseline scope", c: `#${activeTemplate.textPrimary}` },
                            { l: "COMPLETION RATE", v: "78%", s: "102 Delivered", c: "#10b981" },
                            { l: "IN FLIGHT", v: "42", s: "24% of project", c: `#${activeTemplate.accent}` },
                            { l: "AT RISK", v: "0", s: "Compliant", c: "#10b981" },
                          ].map((p, i) => (
                            <div key={i} style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 4 }}>
                              <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.7 }}>{p.l}</div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: p.c, margin: "2px 0" }}>{p.v}</div>
                              <div style={{ fontSize: 9, opacity: 0.7 }}>{p.s}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
                          <div style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                            <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>EXECUTION VELOCITY AUDIT</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 50 }}>
                              {[{ l: "Shipped", v: 102, c: "#10b981" }, { l: "Active", v: 42, c: `#${activeTemplate.accent}` }, { l: "Hold", v: 14, c: "#f59e0b" }, { l: "Queue", v: 18, c: "#64748b" }].map((b, i) => (
                                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <div style={{ width: "100%", height: `${(b.v / 110) * 100}%`, background: b.c }} />
                                  <span style={{ fontSize: 8 }}>{b.l}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, fontSize: 9 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>AUDIT LEDGER</div>
                            <div>• Target Slippage: COMPLIANT</div>
                            <div>• Velocity Pace: HEALTHY</div>
                            <div>• Risk Severity: LOW</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. MODERN SAAS KPI: 2X2 ASYMMETRIC BENTO GRID */}
                    {archetype === "modern_saas" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 10 }}>
                        <div style={{ padding: 14, borderRadius: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                          <div style={{ fontSize: 10, opacity: 0.7 }}>SPRINT VELOCITY</div>
                          <div style={{ fontSize: 36, fontWeight: 900, color: `#${activeTemplate.accent}` }}>
                            78% <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>+14% DoD</span>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 11, opacity: 0.8 }}>102 of 176 sprint items verified.</p>
                        </div>
                        <div style={{ padding: 14, borderRadius: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                          <div style={{ fontSize: 10, opacity: 0.7 }}>BURNDOWN TRACK</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 50, marginTop: 6 }}>
                            {[30, 50, 75, 60, 90, 105].map((h, i) => (
                              <div key={i} style={{ flex: 1, height: `${(h / 110) * 100}%`, background: i === 5 ? `#${activeTemplate.accent}` : "rgba(255,255,255,0.15)", borderRadius: 3 }} />
                            ))}
                          </div>
                        </div>
                        <div style={{ padding: 10, borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, fontSize: 11 }}>
                          <span style={{ opacity: 0.7 }}>IN FLIGHT: </span><strong>42 Active Pod Tasks</strong>
                        </div>
                        <div style={{ padding: 10, borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, fontSize: 11 }}>
                          <span style={{ opacity: 0.7 }}>EXCEPTIONS: </span><strong style={{ color: "#10b981" }}>0 Blockers</strong>
                        </div>
                      </div>
                    )}

                    {/* 4. DATA STORYTELLING: 70% CHART DOMINANCE + TELEMETRY RAIL */}
                    {archetype === "data_story" && (
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, fontFamily: "monospace" }}>
                        <div style={{ padding: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                          <div style={{ fontSize: 9, color: `#${activeTemplate.accent}` }}>DELIVERY THROUGHPUT BY STATUS (70% CANVAS)</div>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 95, marginTop: 8 }}>
                            {[{ l: "DONE", v: 102, c: `#${activeTemplate.accent}` }, { l: "EXEC", v: 42, c: "#38bdf8" }, { l: "HOLD", v: 14, c: "#f59e0b" }, { l: "STAGED", v: 18, c: "#64748b" }].map((b, i) => (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                <div style={{ width: "100%", height: `${(b.v / 110) * 100}%`, background: b.c }} />
                                <span style={{ fontSize: 8 }}>{b.l}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { l: "COMPLETION RATIO", v: "78.4%", c: `#${activeTemplate.accent}` },
                            { l: "ACTIVE PIPELINE", v: "42 tasks", c: "#38bdf8" },
                            { l: "PAUSED SCOPE", v: "14 tasks", c: "#f59e0b" },
                            { l: "EXCEPTION LOG", v: "0 alerts", c: "#10b981" },
                          ].map((rm, i) => (
                            <div key={i} style={{ padding: 6, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                              <div style={{ fontSize: 8, opacity: 0.7 }}>{rm.l}</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: rm.c }}>{rm.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. STRATEGIC CONSULTING: MINTO 3-PILLAR FRAMEWORK */}
                    {archetype === "consulting" && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: `#${activeTemplate.accent}`, marginBottom: 8, fontStyle: "italic" }}>
                          Executive Lead: Delivery velocity is on track at 78% completion with zero critical path slippage.
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                          {[
                            { n: "01", t: "WORKSTREAM VELOCITY", v: "78%", s: "102 Delivered", d: "Core milestones successfully verified." },
                            { n: "02", t: "EXECUTION QUALITY", v: "42", s: "Active Deliverables", d: "Engineering capacity actively engaged." },
                            { n: "03", t: "DELIVERY RISK", v: "0", s: "Critical Issues", d: "Zero schedule threats detected." },
                          ].map((p, i) => (
                            <div key={i} style={{ padding: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}` }}>{p.n} {p.t}</div>
                              <div style={{ fontSize: 26, fontWeight: 800, color: `#${activeTemplate.accent}`, margin: "4px 0" }}>{p.v}</div>
                              <div style={{ fontSize: 10, fontWeight: 600 }}>{p.s}</div>
                              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4 }}>{p.d}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. SWISS MINIMALIST: ONE MAJOR MESSAGE (76PT NUMBER) */}
                    {archetype === "minimalist" && (
                      <div style={{ fontFamily: "Helvetica, sans-serif", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.9, color: `#${activeTemplate.accent}`, letterSpacing: "-0.04em" }}>
                            78%
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8 }}>COMPLETED DELIVERABLES</div>
                          <div style={{ fontSize: 11, color: `#${activeTemplate.textSecondary}`, marginTop: 4 }}>102 of 176 deliverables verified.</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 24, fontWeight: 800 }}>42</div>
                            <div style={{ fontSize: 10, color: `#${activeTemplate.textSecondary}` }}>IN PROGRESS // ACTIVE DEVELOPMENT</div>
                          </div>
                          <div style={{ height: 1, background: `#${activeTemplate.cardBorder}` }} />
                          <div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: `#${activeTemplate.accent}` }}>0</div>
                            <div style={{ fontSize: 10, color: `#${activeTemplate.textSecondary}` }}>OVERDUE // ALL MILESTONES ON SCHEDULE</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 7. CREATIVE LAYERED: ASYMMETRIC METRIC CARDS */}
                    {archetype === "creative_layered" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 14 }}>
                        <div style={{ padding: 16, background: `#${activeTemplate.cardBg}`, border: `2px solid #${activeTemplate.accent}`, borderRadius: 12 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: `#${activeTemplate.accent}` }}>COMPLETION RATIO</span>
                          <div style={{ fontSize: 40, fontWeight: 900, color: `#${activeTemplate.accent}`, margin: "4px 0" }}>78%</div>
                          <p style={{ margin: 0, fontSize: 11, color: `#${activeTemplate.textSecondary}` }}>102 deliverables verified across active project milestones.</p>
                        </div>
                        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 10 }}>
                          <div style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>In Flight Scope</span>
                            <span style={{ fontSize: 20, fontWeight: 800, color: `#${activeTemplate.accent}` }}>42 Tasks</span>
                          </div>
                          <div style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>At Risk / Blockers</span>
                            <span style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>0 Items</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* SLIDE 2: STATUS LIFECYCLE (7 DISTINCT ARCHETYPES)         */}
                {/* ========================================================= */}
                {activeSlideIndex === 2 && (
                  <div>
                    {/* 1. EDITORIAL: HORIZONTAL NARRATIVE ROWS */}
                    {archetype === "editorial" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { l: "Completed & Verified", c: 102, p: 78, col: "#10b981" },
                            { l: "In Active Execution", c: 42, p: 24, col: "#3b82f6" },
                            { l: "On Hold / Paused", c: 14, p: 8, col: "#eab308" },
                            { l: "Pending Backlog", c: 18, p: 10, col: "#9ca3af" },
                          ].map((st, i) => (
                            <div key={i} style={{ padding: "8px 12px", background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700 }}>{st.l}</div>
                                <div style={{ fontSize: 9, opacity: 0.7 }}>{st.p}% of total scope</div>
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: st.col }}>{st.c}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 8 }}>DISTRIBUTION</div>
                          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `10px solid #${activeTemplate.accent}`, borderTopColor: "#3b82f6", borderRightColor: "#eab308", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>
                            78%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. CORPORATE: 2X2 GOVERNANCE MATRIX */}
                    {archetype === "corporate" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { t: "QUADRANT I: DELIVERED", v: "102 Tasks (78%)", c: "#10b981", d: "Verified deliverables signed off." },
                          { t: "QUADRANT II: ACTIVE", v: "42 Tasks (24%)", c: `#${activeTemplate.accent}`, d: "In flight within sprint timeline." },
                          { t: "QUADRANT III: PAUSED", v: "14 Tasks (8%)", c: "#eab308", d: "External dependency review." },
                          { t: "QUADRANT IV: SCHEDULED", v: "18 Tasks (10%)", c: "#9ca3af", d: "Staged for subsequent cycles." },
                        ].map((q, i) => (
                          <div key={i} style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 4 }}>
                            <div style={{ fontSize: 9, fontWeight: 800, color: q.c }}>{q.t}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, margin: "2px 0" }}>{q.v}</div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>{q.d}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. MODERN SAAS: BENTO STATUS PODS */}
                    {archetype === "modern_saas" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {[
                          { l: "COMPLETED", c: 102, p: 78, col: "#10b981" },
                          { l: "IN FLIGHT", c: 42, p: 24, col: "#3b82f6" },
                          { l: "ON HOLD", c: 14, p: 8, col: "#eab308" },
                          { l: "BACKLOG", c: 18, p: 10, col: "#9ca3af" },
                        ].map((pod, i) => (
                          <div key={i} style={{ padding: 12, borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderTop: `3px solid ${pod.col}` }}>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>{pod.l}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, margin: "4px 0" }}>{pod.c}</div>
                            <div style={{ fontSize: 9, color: pod.col }}>{pod.p}% of scope</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 4. DATA STORYTELLING: TELEMETRY STREAM TABLE */}
                    {archetype === "data_story" && (
                      <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                        <div style={{ padding: 8, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, marginBottom: 6 }}>
                          STATUS TELEMETRY STREAM // FULL SPECTRUM DISTRIBUTION
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                          {[
                            { n: "NODE_DONE", c: "102 (78.0%)", s: "VERIFIED" },
                            { n: "NODE_EXEC", c: "42 (24.0%)", s: "IN_FLIGHT" },
                            { n: "NODE_HOLD", c: "14 (8.0%)", s: "DEP_BLOCK" },
                            { n: "NODE_QUEUE", c: "18 (10.0%)", s: "STAGED" },
                          ].map((t, i) => (
                            <div key={i} style={{ padding: 8, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                              <div style={{ fontSize: 8, color: `#${activeTemplate.accent}` }}>{t.n}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, margin: "2px 0" }}>{t.c}</div>
                              <div style={{ fontSize: 8, opacity: 0.7 }}>{t.s}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. STRATEGIC CONSULTING: 2X2 MATURITY MATRIX */}
                    {archetype === "consulting" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[
                          { t: "STRATEGIC WINS", v: "102 Tasks", d: "High impact, delivered scope." },
                          { t: "PRIORITY FOCUS", v: "42 Tasks", d: "High impact, active development." },
                          { t: "ESCALATION QUEUE", v: "14 Tasks", d: "Blocked dependencies requiring intervention." },
                          { t: "BACKLOG PIPELINE", v: "18 Tasks", d: "Planned for subsequent engagement phases." },
                        ].map((m, i) => (
                          <div key={i} style={{ padding: 12, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}` }}>{m.t}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, margin: "2px 0" }}>{m.v}</div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>{m.d}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 6. SWISS MINIMALIST: TYPOGRAPHIC COLUMNS */}
                    {archetype === "minimalist" && (
                      <div style={{ fontFamily: "Helvetica, sans-serif", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        {[
                          { n: "01", l: "COMPLETED", v: "102", p: "78%" },
                          { n: "02", l: "IN PROGRESS", v: "42", p: "24%" },
                          { n: "03", l: "ON HOLD", v: "14", p: "8%" },
                          { n: "04", l: "PENDING", v: "18", p: "10%" },
                        ].map((c, i) => (
                          <div key={i} style={{ borderRight: i < 3 ? `1px solid #${activeTemplate.cardBorder}` : "none", paddingRight: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}` }}>{c.n}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{c.l}</div>
                            <div style={{ fontSize: 32, fontWeight: 900, margin: "4px 0" }}>{c.v}</div>
                            <div style={{ fontSize: 10, color: `#${activeTemplate.textSecondary}` }}>{c.p} of scope</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 7. CREATIVE LAYERED: ASYMMETRIC STATUS CLUSTERS */}
                    {archetype === "creative_layered" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
                        <div style={{ padding: 16, background: `#${activeTemplate.cardBg}`, border: `2px solid #${activeTemplate.accent}`, borderRadius: 12 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: `#${activeTemplate.accent}` }}>DOMINANT WORKFLOW STATE</span>
                          <div style={{ fontSize: 36, fontWeight: 900, color: `#${activeTemplate.accent}` }}>102</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>COMPLETED DELIVERABLES</div>
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>78% of confirmed initiative scope verified &amp; shipped.</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { l: "In Flight", v: 42, c: "#3b82f6" },
                            { l: "On Hold", v: 14, c: "#eab308" },
                            { l: "Pending", v: 18, c: "#9ca3af" },
                          ].map((s, i) => (
                            <div key={i} style={{ padding: 8, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, fontWeight: 600 }}>{s.l}</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* SLIDE 3: TEAM WORKLOAD (7 DISTINCT ARCHETYPES)            */}
                {/* ========================================================= */}
                {activeSlideIndex === 3 && (
                  <div>
                    {/* 1. EDITORIAL: SPACIOUS CONTRIBUTOR CARDS */}
                    {archetype === "editorial" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {[
                          { n: "Charan Dukka", r: "Lead Architect", c: 42, p: 85 },
                          { n: "Leelavathi", r: "Core Engineer", c: 38, p: 74 },
                          { n: "Engineering Core", r: "Delivery Team", c: 24, p: 60 },
                        ].map((m, i) => (
                          <div key={i} style={{ padding: 14, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `#${activeTemplate.accent}`, color: "#ffffff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
                              {m.n.charAt(0)}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{m.n}</div>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>{m.r}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: `#${activeTemplate.accent}`, margin: "6px 0 2px" }}>{m.p}%</div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>{m.c} deliverables assigned</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. CORPORATE: INSTITUTIONAL WORKLOAD LEDGER TABLE */}
                    {archetype === "corporate" && (
                      <div style={{ fontSize: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 4, background: `#${activeTemplate.cardBg}`, padding: "6px 8px", fontWeight: 800, color: `#${activeTemplate.accent}` }}>
                          <span>TEAM MEMBER</span>
                          <span>ASSIGNED</span>
                          <span>COMPLETED</span>
                          <span>IN FLIGHT</span>
                          <span>RATE</span>
                          <span>STATUS</span>
                        </div>
                        {[
                          { n: "Charan Dukka", a: 42, c: 36, f: 6, p: "85%", s: "COMPLIANT" },
                          { n: "Leelavathi", a: 38, c: 28, f: 10, p: "74%", s: "COMPLIANT" },
                          { n: "Engineering Core", a: 24, c: 15, f: 9, p: "62%", s: "ON TRACK" },
                        ].map((row, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 4, padding: "6px 8px", borderBottom: `1px solid #${activeTemplate.cardBorder}` }}>
                            <span style={{ fontWeight: 600 }}>{row.n}</span>
                            <span>{row.a}</span>
                            <span style={{ color: "#10b981", fontWeight: 700 }}>{row.c}</span>
                            <span>{row.f}</span>
                            <span style={{ fontWeight: 700 }}>{row.p}</span>
                            <span style={{ color: "#10b981", fontWeight: 700 }}>{row.s}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. MODERN SAAS: SPRINT PODS */}
                    {archetype === "modern_saas" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                        {[
                          { n: "Charan Dukka", r: "Sprint Lead", t: 42, v: "85%" },
                          { n: "Leelavathi", r: "Fullstack Pod", t: 38, v: "74%" },
                          { n: "Engineering Core", r: "Platform Pod", t: 24, v: "62%" },
                        ].map((pod, i) => (
                          <div key={i} style={{ padding: 12, borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{pod.n}</span>
                              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.08)" }}>{pod.r}</span>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: `#${activeTemplate.accent}`, margin: "8px 0 4px" }}>{pod.v}</div>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>{pod.t} active sprint deliverables</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 4. DATA STORYTELLING: RESOURCE TELEMETRY */}
                    {archetype === "data_story" && (
                      <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                        <div style={{ padding: 6, background: `#${activeTemplate.cardBg}`, fontWeight: 700, color: `#${activeTemplate.accent}`, marginBottom: 6 }}>
                          RESOURCE CAPACITY &amp; THROUGHPUT TELEMETRY
                        </div>
                        {[
                          { n: "NODE_CHARAN", a: 42, c: 36, idx: "0.85" },
                          { n: "NODE_LEELA", a: 38, c: 28, idx: "0.74" },
                          { n: "NODE_ENG_CORE", a: 24, c: 15, idx: "0.62" },
                        ].map((node, i) => (
                          <div key={i} style={{ padding: "6px 8px", background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                            <span>{node.n}</span>
                            <span>Assigned: {node.a}</span>
                            <span>Done: {node.c}</span>
                            <span style={{ color: `#${activeTemplate.accent}`, fontWeight: 700 }}>Capacity: {node.idx}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 5. STRATEGIC CONSULTING: WORKSTREAM ALLOCATION MATRIX */}
                    {archetype === "consulting" && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: `#${activeTemplate.accent}`, marginBottom: 8 }}>
                          STRATEGIC WORKSTREAM STAFFING ALLOCATION
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { w: "Architecture & Integrations", o: "Charan Dukka", s: "42 tasks", c: "High Velocity (85%)" },
                            { w: "Core Feature Engineering", o: "Leelavathi", s: "38 tasks", c: "Balanced (74%)" },
                            { w: "Platform Infrastructure", o: "Engineering Core", s: "24 tasks", c: "Optimal (62%)" },
                          ].map((ws, i) => (
                            <div key={i} style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>{ws.w}</div>
                                <div style={{ fontSize: 10, opacity: 0.7 }}>Owner: {ws.o} • Scope: {ws.s}</div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: `#${activeTemplate.accent}` }}>{ws.c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. SWISS MINIMALIST: TYPOGRAPHIC CONTRIBUTOR INDEX */}
                    {archetype === "minimalist" && (
                      <div style={{ fontFamily: "Helvetica, sans-serif" }}>
                        {[
                          { n: "Charan Dukka", a: "42 assigned", c: "36 completed" },
                          { n: "Leelavathi", a: "38 assigned", c: "28 completed" },
                          { n: "Engineering Core", a: "24 assigned", c: "15 completed" },
                        ].map((m, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid #${activeTemplate.cardBorder}` }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{m.n}</span>
                            <span style={{ fontSize: 11, color: `#${activeTemplate.textSecondary}` }}>{m.a}  •  {m.c}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 7. CREATIVE LAYERED: CREATIVE CONTRIBUTOR SHOWCASE */}
                    {archetype === "creative_layered" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                        {[
                          { n: "Charan Dukka", t: "Lead", p: "85%" },
                          { n: "Leelavathi", t: "Engineer", p: "74%" },
                          { n: "Engineering Core", t: "Core", p: "62%" },
                        ].map((c, i) => (
                          <div key={i} style={{ padding: 12, background: `#${activeTemplate.cardBg}`, border: `2px solid #${activeTemplate.accent}`, borderRadius: 12 }}>
                            <span style={{ fontSize: 9, padding: "2px 6px", background: `#${activeTemplate.accent}`, color: "#ffffff", borderRadius: 4, fontWeight: 800 }}>{c.t}</span>
                            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>{c.n}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: `#${activeTemplate.accent}`, marginTop: 4 }}>{c.p}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* SLIDE 4: CRITICAL & ROADBLOCKS (7 DISTINCT ARCHETYPES)     */}
                {/* ========================================================= */}
                {activeSlideIndex === 4 && (
                  <div>
                    {/* 1. EDITORIAL: ALERT CALLOUT + STREAMLINED LIST */}
                    {archetype === "editorial" && (
                      <div>
                        <div style={{ padding: 14, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: `#${activeTemplate.accent}` }}>CRITICAL PATH TAKEAWAY</span>
                          <p style={{ margin: "4px 0 0", fontSize: 12, fontStyle: "italic" }}>
                            "All deliverables are on schedule with zero overdue items threatening target launch."
                          </p>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 6, fontSize: 11 }}>
                            <strong style={{ color: "#10b981" }}>Overdue Scope (0)</strong>
                            <p style={{ margin: "4px 0 0", opacity: 0.7 }}>Zero overdue escalations.</p>
                          </div>
                          <div style={{ padding: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, borderRadius: 6, fontSize: 11 }}>
                            <strong style={{ color: "#eab308" }}>On Hold Items (14)</strong>
                            <p style={{ margin: "4px 0 0", opacity: 0.7 }}>Pending external review.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. CORPORATE: RISK MITIGATION REGISTRY */}
                    {archetype === "corporate" && (
                      <div style={{ fontSize: 9 }}>
                        <div style={{ padding: "6px 8px", background: `#${activeTemplate.cardBg}`, fontWeight: 800, color: `#${activeTemplate.accent}`, marginBottom: 4 }}>
                          RISK MITIGATION &amp; ESCALATION REGISTRY
                        </div>
                        {[
                          { id: "RSK-001", t: "Axapta ERP Integration Sync", s: "P2 - MED", o: "Charan Dukka", a: "Resolve API dependency blocker." },
                          { id: "RSK-002", t: "PDR Workflow Verification", s: "P2 - MED", o: "Leelavathi", a: "Review sign-off matrix with team." },
                        ].map((r, i) => (
                          <div key={i} style={{ padding: "6px 8px", background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}`, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 700 }}>{r.id}: {r.t}</span>
                            <span style={{ color: "#eab308", fontWeight: 700 }}>{r.s}</span>
                            <span>{r.o}</span>
                            <span style={{ opacity: 0.8 }}>{r.a}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. MODERN SAAS: INCIDENT CONSOLE */}
                    {archetype === "modern_saas" && (
                      <div style={{ padding: 14, borderRadius: 10, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#10b981", marginBottom: 8 }}>
                          INCIDENT CONSOLE // SLA MONITOR: ALL NOMINAL
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.6 }}>
                          ✓ ZERO P0 BLOCKERS ACTIVE<br />
                          ✓ TARGET SPRINT CADENCE COMPLIANT<br />
                          ✓ 14 DEPENDENCY HOLD TICKETS TRACKED IN BACKLOG
                        </div>
                      </div>
                    )}

                    {/* 4. DATA STORYTELLING: ANOMALY LOG */}
                    {archetype === "data_story" && (
                      <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                        <div style={{ padding: 6, background: `#${activeTemplate.cardBg}`, color: `#${activeTemplate.accent}`, fontWeight: 700, marginBottom: 6 }}>
                          ANOMALY DETECTION &amp; EXCEPTION TELEMETRY
                        </div>
                        <div style={{ padding: 8, background: `#${activeTemplate.cardBg}`, border: `1px solid #${activeTemplate.cardBorder}` }}>
                          [ANM-000] STATUS: ALL TELEMETRY NODES REPORTING NOMINAL. ZERO DRIFT DETECTED.
                        </div>
                      </div>
                    )}

                    {/* 5. STRATEGIC CONSULTING: OBSERVATION -> ACTION TABLE */}
                    {archetype === "consulting" && (
                      <div style={{ fontSize: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.6fr", gap: 6, background: `#${activeTemplate.cardBg}`, padding: 6, fontWeight: 800, color: `#${activeTemplate.accent}` }}>
                          <span>OBSERVATION</span>
                          <span>IMPLICATION</span>
                          <span>RECOMMENDED ACTION</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.6fr", gap: 6, padding: "8px 6px", borderBottom: `1px solid #${activeTemplate.cardBorder}` }}>
                          <span>78% deliverables delivered on track.</span>
                          <span>Velocity satisfies sponsor milestones.</span>
                          <span style={{ fontWeight: 700, color: `#${activeTemplate.accent}` }}>Lock completed scope and proceed to sign-off.</span>
                        </div>
                      </div>
                    )}

                    {/* 6. SWISS MINIMALIST: STARK FOCUS LIST */}
                    {archetype === "minimalist" && (
                      <div style={{ fontFamily: "Helvetica, sans-serif" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>04 / ATTENTION REQUIRED</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", padding: "8px 0", borderBottom: `1px solid #${activeTemplate.cardBorder}` }}>
                          ALL WORKSTREAMS ON SCHEDULE. ZERO ESCALATIONS.
                        </div>
                        <div style={{ fontSize: 11, color: `#${activeTemplate.textSecondary}`, marginTop: 8 }}>
                          14 deliverables on hold for external review.
                        </div>
                      </div>
                    )}

                    {/* 7. CREATIVE LAYERED: STICKY BOARD */}
                    {archetype === "creative_layered" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ padding: 14, background: `#${activeTemplate.cardBg}`, border: "2px solid #10b981", borderRadius: 12 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#10b981" }}>STATUS</span>
                          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>Zero Critical Blockers</div>
                          <p style={{ margin: "4px 0 0", fontSize: 10, opacity: 0.7 }}>Milestones running on cadence.</p>
                        </div>
                        <div style={{ padding: 14, background: `#${activeTemplate.cardBg}`, border: "2px solid #eab308", borderRadius: 12 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#eab308" }}>DEPENDENCIES</span>
                          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>14 Held Items</div>
                          <p style={{ margin: "4px 0 0", fontSize: 10, opacity: 0.7 }}>Awaiting client sign-off.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* SLIDE 5: ITEMIZABLE TASK CATALOG (ALL ARCHETYPES)          */}
                {/* ========================================================= */}
                {activeSlideIndex === 5 && (
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Task Status Catalog (Part 1 of 12)</h3>
                    <p style={{ margin: "0 0 10px", fontSize: 11, opacity: 0.7 }}>Comprehensive itemized registry of project deliverables</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
                      {[
                        { key: "TASK-001", title: "Release status - ITK Utility for NX", status: "Done", prio: "High", assignee: "Charan Dukka" },
                        { key: "TASK-002", title: "Teamcenter PDR Workflow Approval Matrix", status: "In Progress", prio: "Urgent", assignee: "Leelavathi" },
                        { key: "TASK-003", title: "SAP / Axapta Material Ledger Synchronizer", status: "On Hold", prio: "Normal", assignee: "Charan Dukka" },
                      ].map((t, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 4,
                            background: `#${activeTemplate.cardBg}`,
                            border: `1px solid #${activeTemplate.cardBorder}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ fontWeight: 700, width: 75 }}>{t.key}</span>
                          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginRight: 10 }}>
                            {t.title}
                          </span>
                          <span style={{ width: 80, fontWeight: 700, color: t.status === "Done" ? "#10b981" : t.status === "In Progress" ? `#${activeTemplate.accent}` : "#f59e0b" }}>
                            {t.status}
                          </span>
                          <span style={{ width: 60, opacity: 0.7 }}>{t.prio}</span>
                          <span style={{ width: 90, textAlign: "right" }}>{t.assignee}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Floating Prev / Next Navigation Arrows */}
              <button
                type="button"
                onClick={() => setActiveSlideIndex((prev) => (prev > 0 ? prev - 1 : slidesMeta.length - 1))}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
                title="Previous Slide"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setActiveSlideIndex((prev) => (prev < slidesMeta.length - 1 ? prev + 1 : 0))}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
                title="Next Slide"
              >
                <ChevronRight size={16} />
              </button>

              {/* Slide Counter Footer */}
              <div
                style={{
                  padding: "6px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  opacity: 0.6,
                  borderTop: `1px solid #${activeTemplate.cardBorder}`,
                }}
              >
                <span>Slide {activeSlideIndex + 1} of {slidesMeta.length}: {slidesMeta[activeSlideIndex].title}</span>
                <span>Click tabs or arrows to preview full deck</span>
              </div>
            </div>

            {/* Thumbnail Gallery Rail (Pitch Style) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 330,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>
                SLIDES IN DECK ({slidesMeta.length})
              </span>
              {slidesMeta.map((s, idx) => {
                const isActive = activeSlideIndex === idx;
                const Icon = s.icon;
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveSlideIndex(idx)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: isActive
                        ? `2px solid #${activeTemplate.accent}`
                        : "1px solid rgba(255,255,255,0.1)",
                      background: isActive
                        ? "rgba(37, 99, 235, 0.15)"
                        : "rgba(255,255,255,0.03)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: isActive ? `#${activeTemplate.accent}` : "rgba(255,255,255,0.08)",
                        display: "grid",
                        placeItems: "center",
                        color: "#ffffff",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={12} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? "#ffffff" : "#d1d5db",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {idx + 1}. {s.title}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: TEMPLATE EXPLORER & CATEGORIES (30+ STYLES) */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                  Select Presentation Style &amp; Template ({filteredTemplates.length} Available)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>
                  Pick from executive, tech, strategy consulting, creative, and data-heavy slide designs.
                </p>
              </div>

              {/* Search input */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  width: 220,
                }}
              >
                <Search size={14} style={{ color: "#9ca3af" }} />
                <input
                  type="text"
                  placeholder="Search 32+ templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    color: "#ffffff",
                    fontSize: 12,
                    width: "100%",
                  }}
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
              {[
                { id: "all", label: `All (${PRESENTATION_TEMPLATES.length})` },
                { id: "executive", label: "Executive & Boardroom (8)" },
                { id: "tech", label: "Tech & SaaS (8)" },
                { id: "consulting", label: "Strategy & Consulting (8)" },
                { id: "creative", label: "Creative & Nature (8)" },
                { id: "data", label: "Data & Metrics (5)" },
                { id: "custom", label: "Custom Brand" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id as TemplateCategory)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: activeCategory === cat.id ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                    background: activeCategory === cat.id ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.03)",
                    color: activeCategory === cat.id ? "#60a5fa" : "#9ca3af",
                    fontSize: 12,
                    fontWeight: activeCategory === cat.id ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Template Cards Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
                maxHeight: 250,
                overflowY: "auto",
                padding: "2px",
              }}
            >
              {filteredTemplates.map((t) => {
                const isSelected = selectedTemplateId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplateId(t.id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: isSelected
                        ? "2px solid #3b82f6"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: isSelected
                        ? "rgba(59, 130, 246, 0.12)"
                        : "rgba(255,255,255,0.03)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 8,
                      position: "relative",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 4px 16px rgba(59, 130, 246, 0.25)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                          {t.name}
                        </span>
                        {isSelected && (
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "#3b82f6",
                              color: "#ffffff",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Check size={12} />
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0 6px" }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(59, 130, 246, 0.15)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            color: "#93c5fd",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {ARCHETYPE_SYSTEMS[getArchetype(t)].label}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                        {t.tagline}
                      </p>
                    </div>

                    {/* Color Swatch Preview */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span
                          title="Canvas Background"
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: `#${t.bg}`,
                            border: "1px solid rgba(255,255,255,0.3)",
                          }}
                        />
                        <span
                          title="Card Surface"
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: `#${t.cardBg}`,
                            border: "1px solid rgba(255,255,255,0.3)",
                          }}
                        />
                        <span
                          title="Accent Highlight"
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: `#${t.accent}`,
                            border: "1px solid rgba(255,255,255,0.3)",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        {t.fontTitle}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Brand Suite Options (when custom_brand selected) */}
          {selectedTemplateId === "custom_brand" && (
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "grid",
                gap: 14,
              }}
            >
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                Custom Brand RGB Palette &amp; AI Prompt
              </h4>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>Canvas Background</label>
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    style={{ width: 44, height: 32, borderRadius: 6, border: 0, cursor: "pointer" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>Card Surface</label>
                  <input
                    type="color"
                    value={customCard}
                    onChange={(e) => setCustomCard(e.target.value)}
                    style={{ width: 44, height: 32, borderRadius: 6, border: 0, cursor: "pointer" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>Accent Highlight</label>
                  <input
                    type="color"
                    value={customAccent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    style={{ width: 44, height: 32, borderRadius: 6, border: 0, cursor: "pointer" }}
                  />
                </div>
              </div>
              <textarea
                placeholder="Optional AI Prompt (e.g. Create McKinsey-style 2x2 matrix, interactive drill-down slides...)"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #4b5563",
                  background: "#1f2937",
                  color: "#ffffff",
                  fontSize: 12,
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: "16px 24px",
            background: "linear-gradient(135deg, #111827 0%, #090d16 100%)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: "#d1d5db" }}>
            <input
              type="checkbox"
              checked={includeCatalog}
              onChange={(e) => setIncludeCatalog(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" }}
            />
            Include detailed itemized task catalog table slides
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: "#9ca3af",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: 0,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Generating Presentation...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download PowerPoint (.pptx)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
