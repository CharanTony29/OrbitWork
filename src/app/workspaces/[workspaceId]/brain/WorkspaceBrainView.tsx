"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Users,
  Filter,
  Sparkles,
  RefreshCw,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import type { PortfolioBrainPayload, TaskCatalogFilter } from "@/lib/brain/portfolio-brain";

interface WorkspaceBrainViewProps {
  workspaceId: string;
  initialData?: PortfolioBrainPayload;
}

export default function WorkspaceBrainView({
  workspaceId,
  initialData,
}: WorkspaceBrainViewProps) {
  const [data, setData] = useState<PortfolioBrainPayload | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBrain = async (filter?: TaskCatalogFilter) => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/workspaces/${workspaceId}/brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter || {}),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load Workspace Brain:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchBrain();
    }
  }, [workspaceId]);

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

  if (loading || !data) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 15, fontWeight: 500 }}>Assembling Workspace Brain Intelligence...</p>
      </div>
    );
  }

  const { health, metrics, aiExecutiveSummary, portfolioProjects, workload, crossProjectDependencies } = data;

  return (
    <div style={{ padding: "24px 0", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Header & Task Catalog Action */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Brain size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Workspace Brain • {data.scopeName}
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                Consolidated cross-project portfolio health, team workload, and dependency intelligence.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowCatalogModal(true)}
            className="button button-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "7px 14px", height: 36 }}
          >
            <Filter size={15} />
            <span>Select Task Catalog ({selectedProjects.length > 0 ? `${selectedProjects.length} Projects` : "All Projects"})</span>
          </button>

          <button
            onClick={() => fetchBrain()}
            disabled={refreshing}
            className="button button-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "7px 14px", height: 36 }}
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Portfolio Health</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: health.overallScore >= 75 ? "#16a34a" : health.overallScore >= 50 ? "#d97706" : "#dc2626" }}>
              {health.overallScore}%
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{health.statusLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Across {metrics.totalProjects} active projects</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Completion Velocity</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: "#2563eb" }}>{metrics.completionPercentage}%</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{metrics.completedTasks}/{metrics.totalTasks} Done</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{metrics.totalEstimatedHours} hours estimated</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Deadline Slips</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: metrics.overdueTasks > 0 ? "#dc2626" : "#16a34a" }}>
              {metrics.overdueTasks}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Overdue Items</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{metrics.inProgressTasks} currently in progress</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Cross-Project Dependencies</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: crossProjectDependencies.length > 0 ? "#d97706" : "#16a34a" }}>
              {crossProjectDependencies.length}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Linkages</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Cross-project blocking chains</div>
        </div>
      </div>

      {/* AI Executive Intelligence Card */}
      <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)", border: "1px solid #c7d2fe", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4f46e5", fontWeight: 700, fontSize: 14 }}>
          <Sparkles size={18} />
          <span>AI Portfolio Executive Briefing</span>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: "8px 0 6px" }}>
          {aiExecutiveSummary.headline}
        </h3>
        <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, margin: "0 0 12px" }}>
          {aiExecutiveSummary.summary}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {aiExecutiveSummary.recommendations.map((rec, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#4338ca" }}>
              <ArrowRight size={14} style={{ flexShrink: 0, marginTop: 3 }} />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Project Dependencies Table */}
      {crossProjectDependencies.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={18} color="#6366f1" />
            <span>Cross-Project Dependency Bottlenecks</span>
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Blocking Project</th>
                  <th style={{ padding: "8px 12px" }}>Blocker Task</th>
                  <th style={{ padding: "8px 12px" }}>Impacted Project</th>
                  <th style={{ padding: "8px 12px" }}>Blocked Task</th>
                </tr>
              </thead>
              <tbody>
                {crossProjectDependencies.map((dep, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#dc2626" }}>{dep.blockingProject}</td>
                    <td style={{ padding: "8px 12px" }}>{dep.blockingTask}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#2563eb" }}>{dep.blockedProject}</td>
                    <td style={{ padding: "8px 12px" }}>{dep.blockedTask}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Multi-Project Workload Heatmap */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={18} color="#6366f1" />
          <span>Cross-Project Team Workload & Allocation</span>
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {workload.map((m) => (
            <div
              key={m.userId}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 14,
                background: m.status === "overloaded" ? "#fef2f2" : "#f8fafc",
                borderColor: m.status === "overloaded" ? "#fca5a5" : "#e2e8f0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 650, fontSize: 14, color: "#0f172a" }}>{m.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: m.status === "overloaded" ? "#dc2626" : m.status === "heavy" ? "#d97706" : "#16a34a",
                    color: "#fff",
                  }}
                >
                  {m.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{m.email}</div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: "#334155" }}>
                <div><strong>{m.totalTasks}</strong> tasks</div>
                <div><strong>{m.totalEstimatedHours}</strong> hrs</div>
                <div><strong>{m.projectCount}</strong> projects</div>
                {m.overdueTasks > 0 && <div style={{ color: "#dc2626" }}><strong>{m.overdueTasks}</strong> overdue</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Catalog Modal */}
      {showCatalogModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, maxWidth: 540, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>Select Task Catalog for Brain Analysis</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>
              Choose which projects and priority levels are analyzed in the Workspace Brain context.
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Included Projects:</div>
              <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, border: "1px solid #e2e8f0", padding: 10, borderRadius: 8 }}>
                {data.availableProjects.map((proj) => {
                  const isChecked = selectedProjects.length === 0 || selectedProjects.includes(proj.id);
                  return (
                    <label key={proj.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProjects([...selectedProjects, proj.id]);
                          } else {
                            const newSelection = (selectedProjects.length === 0 ? data.availableProjects.map((p) => p.id) : selectedProjects).filter(
                              (id) => id !== proj.id
                            );
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
              <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Filter by Priority:</div>
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
                        padding: "4px 10px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor: active ? "#6366f1" : "#cbd5e1",
                        background: active ? "#eef2ff" : "#fff",
                        color: active ? "#4f46e5" : "#475569",
                        fontWeight: active ? 600 : 400,
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
              <button onClick={resetCatalogFilter} className="button button-secondary" style={{ fontSize: 13, padding: "6px 12px" }}>
                Reset to All
              </button>
              <button onClick={applyCatalogFilter} className="button button-primary" style={{ fontSize: 13, padding: "6px 16px" }}>
                Apply Catalog Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
