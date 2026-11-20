"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Layers,
  Users,
  Filter,
  Sparkles,
  RefreshCw,
  ArrowRight,
  GitBranch,
  ShieldAlert,
  Zap,
  History,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Send,
  Building,
  ExternalLink,
} from "lucide-react";
import type { PortfolioBrainPayload, TaskCatalogFilter } from "@/lib/brain/portfolio-brain";
import { markdownToSafeHtml } from "@/lib/markdown";

interface OrganizationBrainViewProps {
  organizationId: string;
  initialData?: PortfolioBrainPayload;
}

export type PortfolioBrainSubTab =
  | "overview"
  | "why"
  | "recommendations"
  | "dependencies"
  | "workload"
  | "projects"
  | "timeline"
  | "chat";

export default function OrganizationBrainView({
  organizationId,
  initialData,
}: OrganizationBrainViewProps) {
  const [data, setData] = useState<PortfolioBrainPayload | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PortfolioBrainSubTab>("overview");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Task Catalog Filter State
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant" | "system"; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  // Subnav scrolling movers
  const subnavRef = useRef<HTMLDivElement | null>(null);
  const [canScrollSubnavLeft, setCanScrollSubnavLeft] = useState(false);
  const [canScrollSubnavRight, setCanScrollSubnavRight] = useState(false);

  const updateSubnavScrollState = useCallback(() => {
    const el = subnavRef.current;
    if (!el) return;
    setCanScrollSubnavLeft(el.scrollLeft > 4);
    setCanScrollSubnavRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollSubnavBy = useCallback((delta: number) => {
    const el = subnavRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = subnavRef.current;
    if (!el) return;
    updateSubnavScrollState();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSubnavScrollState) : null;
    ro?.observe(el);
    window.addEventListener("resize", updateSubnavScrollState);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateSubnavScrollState);
    };
  }, [loading, data, updateSubnavScrollState]);

  const fetchBrain = async (filter?: TaskCatalogFilter) => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/organizations/${organizationId}/brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter || {}),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load Organization Brain:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchBrain();
    }
  }, [organizationId]);

  const applyCatalogFilter = () => {
    setShowCatalogModal(false);
    fetchBrain({
      selectedProjectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
      priorities: selectedPriorities.length > 0 ? selectedPriorities : undefined,
    });
  };

  const resetCatalogFilter = () => {
    setSelectedProjects([]);
    setSelectedPriorities([]);
    setShowCatalogModal(false);
    fetchBrain({});
  };

  const handleSendChatMessage = async (presetPrompt?: string) => {
    const textToSend = presetPrompt || chatInput;
    if (!textToSend.trim() || chatStreaming) return;

    const newMessages = [
      ...chatMessages,
      { role: "user" as const, content: textToSend.trim() },
    ];
    setChatMessages(newMessages);
    if (!presetPrompt) setChatInput("");
    setChatStreaming(true);

    try {
      const res = await fetch(`/api/organizations/${organizationId}/brain/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error("Organization AI Chat failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;
          setChatMessages([
            ...newMessages,
            { role: "assistant", content: assistantText },
          ]);
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "I encountered a temporary communication issue connecting to Organization Brain. Please try again or rephrase your question.",
        },
      ]);
    } finally {
      setChatStreaming(false);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted, #64748b)" }}>
        <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 16px", color: "var(--green, #167c58)" }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink, #0f172a)", margin: "0 0 6px" }}>
          Assembling Organization Brain Intelligence
        </h3>
        <p style={{ fontSize: 14, color: "var(--muted, #64748b)", margin: 0 }}>
          Synthesizing enterprise portfolio governance, department workload, and milestone delivery analytics...
        </p>
      </div>
    );
  }

  const {
    health,
    metrics,
    aiExecutiveSummary,
    portfolioProjects,
    workload,
    crossProjectDependencies,
    risks,
    recommendations,
    timeline,
  } = data;

  const overloadedCount = workload.filter(
    (w) => w.status === "over_capacity" || w.status === "severely_overloaded"
  ).length;

  const todayDateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="brain-container" style={{ width: "100%", maxWidth: 1280, margin: "0 auto" }}>
      {/* 1. TOP HEADER & HEALTH GLANCE */}
      <div className="brain-header">
        <div className="brain-title-wrap">
          <div className="brain-icon-badge" style={{ background: "linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(67, 56, 202, 0.25))", borderColor: "rgba(79, 70, 229, 0.3)", color: "#4f46e5" }}>
            <Building size={24} />
          </div>
          <div className="brain-title-area">
            <h1>
              {data.scopeName} Organization Brain
              <span className="brain-badge-layer" style={{ background: "rgba(79, 70, 229, 0.1)", color: "#4f46e5", borderColor: "rgba(79, 70, 229, 0.3)" }}>
                ENTERPRISE GOVERNANCE
              </span>
            </h1>
            <p>
              Enterprise portfolio governance, department capacity intelligence, and cross-team dependency analytics.
            </p>
          </div>
        </div>

        <div className="brain-header-actions">
          <button
            onClick={() => setShowCatalogModal(true)}
            className="brain-refresh-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Filter size={13} />
            <span>
              Task Catalog ({selectedProjects.length > 0 ? `${selectedProjects.length} Projects` : "All Projects"})
            </span>
          </button>

          <button
            className="brain-refresh-btn"
            onClick={() => fetchBrain()}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            Recalculate
          </button>
        </div>
      </div>

      {/* 2. SUB-NAV TABS */}
      <div className="brain-subnav-wrap">
        {canScrollSubnavLeft && (
          <button
            type="button"
            className="brain-subnav-mover brain-subnav-mover-left"
            onClick={() => scrollSubnavBy(-240)}
            aria-label="Scroll tabs left"
          >
            <ChevronLeft size={15} />
          </button>
        )}
        <div ref={subnavRef} className="brain-subnav" onScroll={updateSubnavScrollState}>
          <button
            className={`brain-nav-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <Layers size={13} /> Overview
          </button>
          <button
            className={`brain-nav-tab ${activeTab === "why" ? "active" : ""}`}
            onClick={() => setActiveTab("why")}
          >
            <AlertCircle size={13} /> Why At Risk?
          </button>
          <button
            className={`brain-nav-tab ${activeTab === "recommendations" ? "active" : ""}`}
            onClick={() => setActiveTab("recommendations")}
          >
            <Zap
              size={13}
              style={{ color: recommendations.length > 0 ? "var(--green)" : "var(--muted)" }}
            />{" "}
            Recommendations ({recommendations.length})
          </button>
          <button
            className={`brain-nav-tab ${activeTab === "dependencies" ? "active" : ""}`}
            onClick={() => setActiveTab("dependencies")}
          >
            <GitBranch size={13} /> Dependencies ({crossProjectDependencies.length})
          </button>
          <button
            className={`brain-nav-tab ${activeTab === "workload" ? "active" : ""}`}
            onClick={() => setActiveTab("workload")}
          >
            <Users size={13} /> Workload ({overloadedCount} Overloaded)
          </button>
          <button
            className={`brain-nav-tab ${activeTab === "projects" ? "active" : ""}`}
            onClick={() => setActiveTab("projects")}
          >
            <Layers size={13} /> Projects ({portfolioProjects.length})
          </button>
          <button
            className={`brain-nav-tab ${activeTab === "timeline" ? "active" : ""}`}
            onClick={() => setActiveTab("timeline")}
          >
            <History size={13} /> Timeline ({timeline.length})
          </button>
          <button
            className={`brain-nav-tab ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <MessageSquare size={13} /> AI Organization Chat
          </button>
        </div>
        {canScrollSubnavRight && (
          <button
            type="button"
            className="brain-subnav-mover brain-subnav-mover-right"
            onClick={() => scrollSubnavBy(240)}
            aria-label="Scroll tabs right"
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <>
          {/* Today's Portfolio Brief */}
          <div className="today-brief-card">
            <div className="today-brief-header">
              <h3>
                <Sparkles size={16} style={{ color: "var(--green)" }} />
                Today&apos;s Organization Portfolio Brief
              </h3>
              <span className="today-brief-date">{todayDateFormatted}</span>
            </div>

            <div className="today-brief-items">
              <div className="today-brief-item">
                <div
                  className={`today-brief-item-dot ${
                    metrics.overdueTasks > 10
                      ? "dot-critical"
                      : metrics.overdueTasks > 0
                      ? "dot-high"
                      : "dot-normal"
                  }`}
                />
                <div className="today-brief-item-content">
                  <p className="today-brief-item-title">
                    {metrics.overdueTasks > 0
                      ? `${metrics.overdueTasks} Overdue Enterprise Deliverables`
                      : "Enterprise Milestones On Track"}
                  </p>
                  <p className="today-brief-item-detail">
                    {metrics.overdueTasks > 0
                      ? `${metrics.inProgressTasks} tasks active across ${metrics.totalProjects} enterprise projects.`
                      : "Zero past-due deliverables detected across business units."}
                  </p>
                </div>
              </div>

              <div className="today-brief-item">
                <div
                  className={`today-brief-item-dot ${
                    crossProjectDependencies.length > 0 ? "dot-high" : "dot-normal"
                  }`}
                />
                <div className="today-brief-item-content">
                  <p className="today-brief-item-title">
                    {crossProjectDependencies.length > 0
                      ? `${crossProjectDependencies.length} Inter-Team Dependencies`
                      : "Decoupled Team Workflows"}
                  </p>
                  <p className="today-brief-item-detail">
                    {crossProjectDependencies.length > 0
                      ? "Cross-project blocking dependencies require milestone synchronization."
                      : "Zero inter-team blocking dependencies detected."}
                  </p>
                </div>
              </div>

              <div className="today-brief-item">
                <div
                  className={`today-brief-item-dot ${
                    overloadedCount > 0 ? "dot-critical" : "dot-normal"
                  }`}
                />
                <div className="today-brief-item-content">
                  <p className="today-brief-item-title">
                    {overloadedCount > 0
                      ? `${overloadedCount} Contributors Over Capacity`
                      : "Department Capacity Balanced"}
                  </p>
                  <p className="today-brief-item-detail">
                    {overloadedCount > 0
                      ? "Estimated effort exceeds effective working capacity for key personnel."
                      : "Workload distribution is within sustainable enterprise capacity limits."}
                  </p>
                </div>
              </div>
            </div>

            <div className="today-brief-footer">
              <span>
                <strong>Enterprise Health:</strong> {health.overallScore}% ({health.statusLabel})
              </span>
              <span>
                <strong>Velocity:</strong> {metrics.completionPercentage}% delivered ({metrics.completedTasks}/{metrics.totalTasks} tasks) · {metrics.totalEstimatedHours}h estimated effort
              </span>
            </div>
          </div>

          {/* Health Score & Category Breakdown */}
          <div className="health-overview-card">
            <div className="health-score-row">
              <div className="health-score-main">
                <div
                  className={`health-number-circle ${
                    health.overallStatus === "healthy"
                      ? "health-circle-healthy"
                      : health.overallStatus === "needs_attention"
                      ? "health-circle-attention"
                      : health.overallStatus === "at_risk"
                      ? "health-circle-at_risk"
                      : "health-circle-critical"
                  }`}
                >
                  {health.overallScore}%
                </div>
                <div className="health-label-area">
                  <h2>
                    Organization Health: {health.statusLabel}
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background:
                          health.overallStatus === "healthy"
                            ? "rgba(22, 163, 74, 0.15)"
                            : health.overallStatus === "needs_attention"
                            ? "rgba(234, 179, 8, 0.15)"
                            : "rgba(220, 38, 38, 0.15)",
                        color:
                          health.overallStatus === "healthy"
                            ? "#16a34a"
                            : health.overallStatus === "needs_attention"
                            ? "#ca8a04"
                            : "#dc2626",
                      }}
                    >
                      {health.overallStatus.toUpperCase().replace("_", " ")}
                    </span>
                  </h2>
                  <p>{health.headlineExplanation}</p>
                </div>
              </div>

              {health.overallStatus !== "healthy" && (
                <button className="why-at-risk-btn" onClick={() => setActiveTab("why")}>
                  <AlertTriangle size={14} /> Why is the organization at risk?
                </button>
              )}
            </div>

            {/* Expandable Category Pills */}
            <div className="health-categories-grid">
              {health.categories &&
                Object.values(health.categories).map((cat: any) => (
                  <div
                    key={cat.key}
                    className="health-category-pill"
                    onClick={() =>
                      setExpandedCategory(expandedCategory === cat.key ? null : cat.key)
                    }
                    title="Click to view detailed score breakdown"
                  >
                    <div className="health-category-header">
                      <span className="health-cat-name">{cat.label}</span>
                      <span className="health-cat-status-icon">
                        {cat.status === "good" ? "🟢" : cat.status === "warning" ? "🟠" : "🔴"}
                      </span>
                    </div>
                    <div
                      className={`health-cat-score ${
                        cat.status === "good"
                          ? "score-good"
                          : cat.status === "warning"
                          ? "score-warning"
                          : "score-danger"
                      }`}
                    >
                      {cat.score}%
                    </div>
                    <div className="health-cat-metric">{cat.metricLabel}</div>
                  </div>
                ))}
            </div>

            {expandedCategory && health.categories && (health.categories as any)[expandedCategory] && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "var(--surface-subtle)",
                  border: "1px dashed var(--line)",
                  fontSize: "13px",
                  color: "var(--ink)",
                }}
              >
                <strong>{(health.categories as any)[expandedCategory].label} Breakdown:</strong>{" "}
                {(health.categories as any)[expandedCategory].details}
              </div>
            )}
          </div>

          {/* AI Executive Intelligence Card */}
          <div className="ai-summary-card">
            <div className="ai-summary-header">
              <div className="ai-summary-title">
                <Brain size={16} style={{ color: "#4f46e5" }} />
                Enterprise Governance Intelligence Briefing
                <span className="ai-badge" style={{ background: "rgba(79, 70, 229, 0.1)", color: "#4f46e5", borderColor: "rgba(79, 70, 229, 0.3)" }}>
                  Live Context
                </span>
              </div>
              <div className="transparency-pills">
                <span className="pill-fact">FACT</span>
                <span className="pill-analysis">ANALYSIS</span>
                <span className="pill-recommendation">RECOMMENDATION</span>
              </div>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "4px 0 2px" }}>
              {aiExecutiveSummary.headline}
            </h3>
            <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, margin: "0 0 10px" }}>
              {aiExecutiveSummary.summary}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {aiExecutiveSummary.recommendations.map((rec, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 13,
                    color: "#4338ca",
                    fontWeight: 500,
                  }}
                >
                  <ArrowRight size={14} style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Two-Column Grid: Predictive Risks & Recommendations */}
          <div className="brain-two-col">
            {/* Predictive Risks */}
            <div className="brain-card">
              <div className="brain-card-header">
                <h3 className="brain-card-title">
                  <ShieldAlert size={16} style={{ color: "#dc2626" }} />
                  Predictive Enterprise Risks ({risks.length})
                </h3>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Algorithmic Trajectory</span>
              </div>

              {risks.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                  ✓ No critical enterprise risks currently detected.
                </p>
              ) : (
                risks.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className={`risk-item-card ${
                      r.severity === "critical"
                        ? "risk-critical"
                        : r.severity === "high"
                        ? "risk-high"
                        : "risk-medium"
                    }`}
                    style={{ marginBottom: 10 }}
                  >
                    <div className="risk-item-header">
                      <p className="risk-title" style={{ fontWeight: 650, color: "var(--ink)" }}>{r.title}</p>
                      <span
                        className={`risk-probability-badge ${
                          r.severity === "critical" ? "prob-critical" : "prob-high"
                        }`}
                      >
                        {r.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="risk-reason" style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                      {r.reason}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Actionable Recommendations */}
            <div className="brain-card">
              <div className="brain-card-header">
                <h3 className="brain-card-title">
                  <Zap size={16} style={{ color: "var(--green)" }} />
                  Actionable Recommendations ({recommendations.length})
                </h3>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Autonomous Guidance</span>
              </div>

              {recommendations.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                  ✓ Enterprise operations are balanced. No immediate rebalancing actions required.
                </p>
              ) : (
                recommendations.slice(0, 4).map((rec) => (
                  <div key={rec.id} className="rec-item-card" style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="rec-category-badge">{rec.category.toUpperCase()}</span>
                    </div>
                    <h4 style={{ margin: "6px 0 4px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {rec.title}
                    </h4>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>{rec.description}</p>
                    <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>
                      Expected Benefit: {rec.expectedBenefit}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB: WHY AT RISK */}
      {activeTab === "why" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <AlertCircle size={16} style={{ color: "#dc2626" }} />
              Why Is This Organization Portfolio At Risk?
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Enterprise Root Cause Analysis
            </span>
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
            The Organization Brain monitors enterprise-level delivery commitments across all workspaces and business units.
          </p>

          <div className="why-chain-wrapper">
            <div className="why-chain-step">
              <div className="why-step-index">1</div>
              <div className="why-step-content">
                <div className="why-step-stage">Root Factor: Enterprise Schedule Slippage</div>
                <div className="why-step-desc">
                  {metrics.overdueTasks > 0
                    ? `${metrics.overdueTasks} deliverables across organization projects are past due.`
                    : "All enterprise project schedules are running on time."}
                </div>
                <div className="why-step-evidence">
                  Evidence: {metrics.inProgressTasks} tasks in progress across {metrics.totalProjects} active projects with {metrics.totalEstimatedHours}h estimated effort remaining.
                </div>
              </div>
            </div>

            <div className="why-chain-step">
              <div className="why-step-index">2</div>
              <div className="why-step-content">
                <div className="why-step-stage">Resource Constraint: Department Capacity Bottlenecks</div>
                <div className="why-step-desc">
                  {overloadedCount > 0
                    ? `${overloadedCount} team members are operating above sustainable capacity.`
                    : "Team utilization across all departments is within sustainable limits."}
                </div>
                <div className="why-step-evidence">
                  Evidence: Calculated strictly as (Estimated Effort ÷ Available Capacity). Effort bottlenecks accumulate when assigned hours exceed capacity.
                </div>
              </div>
            </div>

            <div className="why-chain-step">
              <div className="why-step-index">3</div>
              <div className="why-step-content">
                <div className="why-step-stage">Structural Friction: Cross-Project Blocking Links</div>
                <div className="why-step-desc">
                  {crossProjectDependencies.length > 0
                    ? `${crossProjectDependencies.length} cross-project dependencies link deliverables across teams.`
                    : "Zero cross-project blocking dependencies detected."}
                </div>
                <div className="why-step-evidence">
                  Evidence: Delays in upstream projects cascade to dependent downstream business unit initiatives.
                </div>
              </div>
            </div>

            <div className="why-chain-step">
              <div className="why-step-index">4</div>
              <div className="why-step-content">
                <div className="why-step-stage">Enterprise Impact & Roadmap Alignment</div>
                <div className="why-step-desc">
                  Organization health is scored at {health.overallScore}% ({health.statusLabel}). Rebalancing resources and resolving blocker dependencies restores enterprise delivery cadence.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: RECOMMENDATIONS */}
      {activeTab === "recommendations" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Zap size={16} style={{ color: "var(--green)" }} />
              Actionable Enterprise Recommendations ({recommendations.length})
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Governance Optimizations
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recommendations.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                ✓ No active rebalancing recommendations. Workload and schedules are optimal.
              </p>
            ) : (
              recommendations.map((rec) => (
                <div key={rec.id} className="rec-item-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="rec-category-badge">{rec.category.toUpperCase()}</span>
                  </div>
                  <h4 style={{ margin: "8px 0 4px", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    {rec.title}
                  </h4>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>{rec.description}</p>
                  <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                    Expected Benefit: {rec.expectedBenefit}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: DEPENDENCIES */}
      {activeTab === "dependencies" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <GitBranch size={16} style={{ color: "var(--green)" }} />
              Cross-Project Dependencies ({crossProjectDependencies.length})
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Inter-team blocking chains
            </span>
          </div>

          {crossProjectDependencies.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              ✓ No cross-project dependency bottlenecks detected across organization initiatives.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", color: "var(--ink)", fontWeight: 650 }}>Blocking Project</th>
                    <th style={{ padding: "10px 14px", color: "var(--ink)", fontWeight: 650 }}>Prerequisite Blocker Task</th>
                    <th style={{ padding: "10px 14px", color: "var(--ink)", fontWeight: 650 }}>Blocked Project</th>
                    <th style={{ padding: "10px 14px", color: "var(--ink)", fontWeight: 650 }}>Dependent Task</th>
                  </tr>
                </thead>
                <tbody>
                  {crossProjectDependencies.map((dep, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#dc2626" }}>
                        {dep.blockingProject}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--ink)" }}>{dep.blockingTask}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--green)" }}>
                        {dep.blockedProject}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--ink)" }}>{dep.blockedTask}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: WORKLOAD (ENGINE V2 REDESIGN) */}
      {activeTab === "workload" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Users size={16} style={{ color: "var(--green)" }} />
              Enterprise Team Workload & Capacity Intelligence
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {overloadedCount} overloaded | {workload.length} contributors analyzed
            </span>
          </div>

          {/* Workload Principle Banner */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--surface-subtle)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              marginBottom: 16,
              fontSize: 12,
              color: "var(--ink)",
              lineHeight: 1.5,
            }}
          >
            <strong>Workload Principle:</strong> Workload ={" "}
            <span style={{ color: "var(--green)", fontWeight: 700 }}>Total Estimated Effort ÷ Available Capacity</span>{" "}
            (Adjusted by Role & Seniority). Tasks are NOT counted equally: 10 small 2h tasks (20h) represent less effort than 3 large 8h development tasks (24h).
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
            {workload.map((m) => {
              const isOverloaded = m.status === "over_capacity" || m.status === "severely_overloaded";
              const isHeavy = m.status === "high";
              const isOptimal = m.status === "healthy";
              const badgeBg = isOverloaded
                ? "rgba(220, 38, 38, 0.15)"
                : isHeavy
                ? "rgba(234, 179, 8, 0.15)"
                : isOptimal
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(22, 163, 74, 0.15)";
              const badgeColor = isOverloaded
                ? "#dc2626"
                : isHeavy
                ? "#d97706"
                : isOptimal
                ? "#2563eb"
                : "#16a34a";

              return (
                <div
                  key={m.userId}
                  className="workload-member-row"
                  style={{
                    background: isOverloaded ? "rgba(254, 242, 242, 0.6)" : "var(--surface)",
                    borderColor: isOverloaded ? "#fca5a5" : "var(--line)",
                    padding: 16,
                  }}
                >
                  <div className="workload-member-info">
                    <div>
                      <span className="workload-member-name" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {m.name}
                      </span>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {m.role || "Software Engineer"} · {m.experienceLevel?.toUpperCase()} ({m.experienceFactor}x factor)
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 12,
                        background: badgeBg,
                        color: badgeColor,
                        textTransform: "uppercase",
                      }}
                    >
                      {m.statusLabel || m.status.replace("_", " ")} ({m.utilizationPercentage}%)
                    </span>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div className="workload-bar-track" style={{ height: 8, marginTop: 8 }}>
                    <div
                      className="workload-bar-fill"
                      style={{
                        width: `${Math.min(100, m.utilizationPercentage)}%`,
                        background: isOverloaded ? "#dc2626" : isHeavy ? "#ea580c" : "var(--green)",
                      }}
                    />
                  </div>

                  {/* Effort & Capacity Breakdown */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 8,
                      marginTop: 10,
                      padding: "8px 0",
                      borderTop: "1px dashed var(--line)",
                      borderBottom: "1px dashed var(--line)",
                      fontSize: 11,
                      color: "var(--ink)",
                    }}
                  >
                    <div>
                      <div style={{ color: "var(--muted)" }}>Effort</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.totalEstimatedHours}h</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted)" }}>Capacity</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.effectiveCapacityHours}h</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted)" }}>Tasks</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.totalTasks}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted)" }}>Projects</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.projectCount}</div>
                    </div>
                  </div>

                  {/* Confidence Alert */}
                  {m.unestimatedTasksCount > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#b45309",
                        background: "rgba(245, 158, 11, 0.1)",
                        padding: "4px 8px",
                        borderRadius: 6,
                        marginTop: 8,
                      }}
                    >
                      ⚠️ Confidence: {m.confidence?.toUpperCase()} ({m.unestimatedTasksCount} tasks lack hour estimates)
                    </div>
                  )}

                  {/* Explanation */}
                  {m.explanation && (
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.4 }}>
                      {m.explanation}
                    </p>
                  )}

                  {/* Potential Rebalance Recommendation */}
                  {m.potentialRedistribution?.recommended && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "rgba(22, 163, 74, 0.08)",
                        border: "1px solid rgba(22, 163, 74, 0.2)",
                        fontSize: 11,
                        color: "var(--green-dark)",
                      }}
                    >
                      💡 <strong>Rebalance:</strong> Shift divisible tasks to{" "}
                      <strong>{m.potentialRedistribution.targetMemberName || "available team member"}</strong> (
                      {m.potentialRedistribution.reason})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: PROJECTS CATALOG */}
      {activeTab === "projects" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Layers size={16} style={{ color: "var(--green)" }} />
              Organization Portfolio Projects ({portfolioProjects.length})
            </h3>
            <button
              onClick={() => setShowCatalogModal(true)}
              className="brain-refresh-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Filter size={13} />
              Filter Scope
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {portfolioProjects.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                      {p.name}
                    </h4>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                      {p.description || "Active organization deliverable."}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: p.healthScore >= 75 ? "rgba(22, 163, 74, 0.15)" : "rgba(220, 38, 38, 0.15)",
                      color: p.healthScore >= 75 ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {p.healthScore}% HEALTH
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="workload-bar-track" style={{ flex: 1, height: 6 }}>
                    <div
                      className="workload-bar-fill"
                      style={{
                        width: `${p.taskCount > 0 ? Math.round((p.completedTaskCount / p.taskCount) * 100) : 0}%`,
                        background: "var(--green)",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                    {p.taskCount > 0 ? Math.round((p.completedTaskCount / p.taskCount) * 100) : 0}%
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink)" }}>
                  <span>Tasks: <strong>{p.completedTaskCount}/{p.taskCount}</strong></span>
                  {p.overdueTaskCount > 0 && (
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>
                      {p.overdueTaskCount} overdue
                    </span>
                  )}
                  {p.due_date && (
                    <span style={{ color: "var(--muted)" }}>
                      Due {new Date(p.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div style={{ paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
                  <Link
                    href={`/projects/${p.id}/brain`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--green)",
                    }}
                  >
                    Open Project Brain <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: TIMELINE */}
      {activeTab === "timeline" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <History size={16} style={{ color: "var(--green)" }} />
              Enterprise Delivery Timeline ({timeline.length})
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Multi-project milestones & deadlines
            </span>
          </div>

          {timeline.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              ✓ No timeline deadlines recorded for current enterprise projects.
            </p>
          ) : (
            <div className="timeline-event-list">
              {timeline.map((evt) => (
                <div key={evt.id} className="timeline-event-card">
                  <div className="timeline-event-dot" />
                  <div className="timeline-event-content">
                    <div className="timeline-event-date">
                      {new Date(evt.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="timeline-event-title">{evt.title}</div>
                    <div className="timeline-event-desc">Project: {evt.projectName}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: AI ORGANIZATION CHAT */}
      {activeTab === "chat" && (
        <div className="brain-chat-container">
          <div className="brain-chat-messages">
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", margin: "auto", maxWidth: 440 }}>
                <Brain size={32} style={{ color: "#4f46e5", margin: "0 auto 8px" }} />
                <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                  Ask {data.scopeName} Organization Brain
                </h4>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                  Ask questions across all workspaces and business units about deadlines, cross-team blockers, contributor overallocation, or executive status reports. Grounded strictly in your organization database.
                </p>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`brain-chat-bubble ${msg.role === "user" ? "user" : "assistant"}`}
                dangerouslySetInnerHTML={{
                  __html: markdownToSafeHtml(msg.content),
                }}
              />
            ))}

            {chatStreaming && (
              <div className="brain-chat-bubble assistant" style={{ fontStyle: "italic", opacity: 0.8 }}>
                Synthesizing enterprise context and reasoning...
              </div>
            )}
          </div>

          <div className="brain-chat-starters">
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("Why is enterprise delivery delayed or at risk?")}
            >
              Why is enterprise delivery at risk?
            </button>
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("Who is overloaded across departments?")}
            >
              Who is overloaded?
            </button>
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("What cross-project dependencies exist?")}
            >
              Cross-project dependencies
            </button>
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("Prepare an enterprise governance summary.")}
            >
              Enterprise governance report
            </button>
          </div>

          <form
            className="brain-chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage();
            }}
          >
            <input
              className="brain-chat-input"
              placeholder={`Ask anything about ${data.scopeName} enterprise portfolio...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatStreaming}
            />
            <button
              type="submit"
              className="brain-chat-send-btn"
              disabled={chatStreaming || !chatInput.trim()}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Task Catalog Modal */}
      {showCatalogModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--surface, #fff)",
              borderRadius: 12,
              maxWidth: 540,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--line, #e2e8f0)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "var(--ink, #0f172a)" }}>
              Select Task Catalog for Brain Analysis
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted, #64748b)", margin: "0 0 18px" }}>
              Choose which projects and priority levels are analyzed in the Organization Brain context.
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #334155)", marginBottom: 8 }}>
                Included Projects:
              </div>
              <div
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  border: "1px solid var(--line, #e2e8f0)",
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                {data.availableProjects.map((proj) => {
                  const isChecked =
                    selectedProjects.length === 0 || selectedProjects.includes(proj.id);
                  return (
                    <label
                      key={proj.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        cursor: "pointer",
                        color: "var(--ink, #0f172a)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProjects([...selectedProjects, proj.id]);
                          } else {
                            const newSelection = (
                              selectedProjects.length === 0
                                ? data.availableProjects.map((p) => p.id)
                                : selectedProjects
                            ).filter((id) => id !== proj.id);
                            setSelectedProjects(newSelection);
                          }
                        }}
                      />
                      <span>{proj.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink, #334155)", marginBottom: 8 }}>
                Filter by Priority:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["urgent", "high", "normal", "low"].map((prio) => {
                  const active = selectedPriorities.includes(prio);
                  return (
                    <button
                      key={prio}
                      type="button"
                      onClick={() => {
                        if (active) setSelectedPriorities(selectedPriorities.filter((p) => p !== prio));
                        else setSelectedPriorities([...selectedPriorities, prio]);
                      }}
                      style={{
                        padding: "5px 12px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor: active ? "#4f46e5" : "var(--line, #cbd5e1)",
                        background: active ? "rgba(79, 70, 229, 0.1)" : "var(--surface, #fff)",
                        color: active ? "#4f46e5" : "var(--ink, #475569)",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {prio}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={resetCatalogFilter}
                className="button button-secondary"
                style={{ fontSize: 13, padding: "6px 14px" }}
              >
                Reset to All
              </button>
              <button
                onClick={applyCatalogFilter}
                className="button button-primary"
                style={{ fontSize: 13, padding: "6px 16px" }}
              >
                Apply Catalog Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
