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
                }}
              >
                {/* SLIDE 0: COVER */}
                {activeSlideIndex === 0 && (
                  <div>
                    <div
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: `#${activeTemplate.cardBg}`,
                        border: `1px solid #${activeTemplate.cardBorder}`,
                        fontSize: 11,
                        fontWeight: 700,
                        marginBottom: 14,
                        color: `#${activeTemplate.accent}`,
                      }}
                    >
                      EXECUTIVE PROJECT REPORT • 16:9
                    </div>
                    {activeTemplate.id === "pitch_sage" ? (
                      <h1
                        style={{
                          margin: 0,
                          fontSize: 36,
                          fontWeight: 900,
                          lineHeight: 1.1,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        <span style={{ color: "#ffffff" }}>PROJECT STATUS &</span>
                        <br />
                        <span style={{ color: "#111111" }}>KPI REPORT</span>
                      </h1>
                    ) : (
                      <h1
                        style={{
                          margin: 0,
                          fontSize: 32,
                          fontWeight: 800,
                          lineHeight: 1.15,
                          color: `#${activeTemplate.textPrimary}`,
                        }}
                      >
                        PROJECT STATUS &amp; EXECUTION REPORT
                      </h1>
                    )}
                    <p
                      style={{
                        margin: "12px 0 20px",
                        fontSize: 15,
                        color: `#${activeTemplate.textSecondary}`,
                      }}
                    >
                      Project: <strong style={{ color: `#${activeTemplate.textPrimary}` }}>{projectName}</strong> • Confirmed Scope
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: `#${activeTemplate.cardBg}`,
                          border: `1px solid #${activeTemplate.cardBorder}`,
                          fontSize: 11,
                        }}
                      >
                        <span style={{ opacity: 0.7 }}>Reporting Timeframe: </span>
                        <strong>{period.toUpperCase()}</strong>
                      </div>
                      <div
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: `#${activeTemplate.cardBg}`,
                          border: `1px solid #${activeTemplate.cardBorder}`,
                          fontSize: 11,
                        }}
                      >
                        <span style={{ opacity: 0.7 }}>Deliverables: </span>
                        <strong>Live Tracked</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE 1: KPI DASHBOARD */}
                {activeSlideIndex === 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20 }}>
                    {/* Left Metric Stack */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: `#${activeTemplate.cardBg}`,
                          border: `1px solid #${activeTemplate.cardBorder}`,
                        }}
                      >
                        <span style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>Completion Rate</span>
                        <div style={{ fontSize: 24, fontWeight: 800, color: `#${activeTemplate.accent}` }}>
                          78% <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>+14% vs last cycle</span>
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: `#${activeTemplate.cardBg}`,
                          border: `1px solid #${activeTemplate.cardBorder}`,
                        }}
                      >
                        <span style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>In Progress Tasks</span>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>
                          42 <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>Active items</span>
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: `#${activeTemplate.cardBg}`,
                          border: `1px solid #${activeTemplate.cardBorder}`,
                        }}
                      >
                        <span style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>Overdue Critical</span>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>
                          0 <span style={{ fontSize: 12, fontWeight: 500, color: "#10b981" }}>On Track</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Chart Card */}
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: 8,
                        background: `#${activeTemplate.cardBg}`,
                        border: `1px solid #${activeTemplate.cardBorder}`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Execution Velocity vs Goal</h4>
                        <p style={{ margin: "2px 0 12px", fontSize: 11, opacity: 0.7 }}>
                          Monthly completed deliverable comparison across project milestones.
                        </p>
                      </div>
                      {/* Stylized Bar Chart */}
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 90, paddingBottom: 6 }}>
                        {[40, 65, 80, 60, 95, 110].map((h, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <div
                              style={{
                                width: "100%",
                                height: `${(h / 120) * 100}%`,
                                background: i === 5 ? `#${activeTemplate.accent}` : activeTemplate.isDark ? "#374151" : "#cbd5e1",
                                borderRadius: 4,
                              }}
                            />
                            <span style={{ fontSize: 9, opacity: 0.7 }}>M{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE 2: STATUS LIFECYCLE */}
                {activeSlideIndex === 2 && (
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Task Status Lifecycle</h3>
                    <p style={{ margin: "0 0 16px", fontSize: 12, opacity: 0.7 }}>Distribution of work across stages</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                      {[
                        { label: "New / Backlog", count: 18, color: "#64748b" },
                        { label: "In Progress", count: 42, color: "#3b82f6" },
                        { label: "Under Review", count: 14, color: "#eab308" },
                        { label: "Completed", count: 102, color: "#10b981" },
                      ].map((st, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "12px",
                            borderRadius: 8,
                            background: `#${activeTemplate.cardBg}`,
                            border: `1px solid #${activeTemplate.cardBorder}`,
                            borderTop: `3px solid ${st.color}`,
                          }}
                        >
                          <span style={{ fontSize: 10, opacity: 0.7 }}>{st.label}</span>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{st.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SLIDE 3: TEAM WORKLOAD */}
                {activeSlideIndex === 3 && (
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Resource Allocation & Ownership</h3>
                    <p style={{ margin: "0 0 14px", fontSize: 12, opacity: 0.7 }}>Who is working on what across deliverables</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { name: "Orbit Work (Lead)", count: 28, pct: 85 },
                        { name: "charantony67", count: 24, pct: 72 },
                        { name: "Engineering Core", count: 19, pct: 58 },
                      ].map((m, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: `#${activeTemplate.cardBg}`,
                            border: `1px solid #${activeTemplate.cardBorder}`,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div style={{ width: 140, fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                          <div style={{ flex: 1, height: 8, background: "rgba(0,0,0,0.15)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${m.pct}%`, height: "100%", background: `#${activeTemplate.accent}` }} />
                          </div>
                          <div style={{ width: 60, textAlign: "right", fontSize: 12, fontWeight: 700 }}>{m.count} tasks</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SLIDE 4: CRITICAL & RISKS */}
                {activeSlideIndex === 4 && (
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Critical Deliverables & Blockers</h3>
                    <p style={{ margin: "0 0 14px", fontSize: 12, opacity: 0.7 }}>High-priority items requiring attention</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { title: "Teamcenter PDR Workflow Approval Matrix", priority: "Urgent", status: "In Progress" },
                        { title: "SAP / Axapta Material Ledger Synchronizer", priority: "High", status: "Review" },
                        { title: "ISO 9001 Immutable Audit Log Verification", priority: "High", status: "Ready" },
                      ].map((item, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: `#${activeTemplate.cardBg}`,
                            border: `1px solid #${activeTemplate.cardBorder}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              background: item.priority === "Urgent" ? "#ef4444" : "#f59e0b",
                              color: "#ffffff",
                            }}
                          >
                            {item.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SLIDE 5: CATALOG TABLE */}
                {activeSlideIndex === 5 && (
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Itemized Task Catalog</h3>
                    <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.7 }}>Paginated deliverable inventory</p>
                    <div
                      style={{
                        background: `#${activeTemplate.cardBg}`,
                        borderRadius: 8,
                        border: `1px solid #${activeTemplate.cardBorder}`,
                        overflow: "hidden",
                        fontSize: 11,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "80px 1fr 90px 90px",
                          padding: "6px 12px",
                          fontWeight: 700,
                          background: "rgba(0,0,0,0.2)",
                        }}
                      >
                        <span>KEY</span>
                        <span>TITLE</span>
                        <span>PRIORITY</span>
                        <span>STATUS</span>
                      </div>
                      {[
                        { key: "TSK-01", title: "Problem Deviation Request (PDR) Initialization", p: "Urgent", s: "Closed" },
                        { key: "TSK-02", title: "Problem Items Association & Bill of Materials", p: "High", s: "In Progress" },
                        { key: "TSK-03", title: "Attach Technical References & Spec Documents", p: "Normal", s: "Open" },
                      ].map((row, i) => (
                        <div
                          key={i}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "80px 1fr 90px 90px",
                            padding: "6px 12px",
                            borderTop: `1px solid #${activeTemplate.cardBorder}`,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{row.key}</span>
                          <span>{row.title}</span>
                          <span style={{ color: row.p === "Urgent" ? "#ef4444" : "inherit" }}>{row.p}</span>
                          <span style={{ opacity: 0.8 }}>{row.s}</span>
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
