"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  Layers,
  Users,
  Filter,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Building,
} from "lucide-react";
import type { PortfolioBrainPayload, TaskCatalogFilter } from "@/lib/brain/portfolio-brain";

interface OrganizationBrainViewProps {
  organizationId: string;
  initialData?: PortfolioBrainPayload;
}

export default function OrganizationBrainView({
  organizationId,
  initialData,
}: OrganizationBrainViewProps) {
  const [data, setData] = useState<PortfolioBrainPayload | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  if (loading || !data) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 15, fontWeight: 500 }}>Assembling Organization Brain Intelligence...</p>
      </div>
    );
  }

  const { health, metrics, aiExecutiveSummary, portfolioProjects } = data;

  return (
    <div style={{ padding: "24px 0", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Building size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Organization Brain • {data.scopeName}
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Enterprise portfolio governance, macro delivery milestones, and department health.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowCatalogModal(true)}
            className="button button-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "7px 14px", height: 36 }}
          >
            <Filter size={15} />
            <span>Task Catalog ({selectedProjects.length > 0 ? `${selectedProjects.length} Projects` : "All Projects"})</span>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Enterprise Health</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: health.overallScore >= 75 ? "#16a34a" : "#d97706" }}>
              {health.overallScore}%
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{health.statusLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Across {metrics.totalProjects} tracked projects</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Enterprise Completion</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: "#2563eb" }}>{metrics.completionPercentage}%</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{metrics.completedTasks}/{metrics.totalTasks}</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{metrics.totalEstimatedHours} hours total logged/estimated</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Critical Overdue Items</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: metrics.overdueTasks > 0 ? "#dc2626" : "#16a34a" }}>
              {metrics.overdueTasks}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Tasks Overdue</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Requires executive review</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Active Backlog</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 750, color: "#0f172a" }}>{metrics.inProgressTasks}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>In Flight</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Across all departments</div>
        </div>
      </div>

      {/* AI Executive Intelligence */}
      <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)", border: "1px solid #c7d2fe", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4f46e5", fontWeight: 700, fontSize: 14 }}>
          <Sparkles size={18} />
          <span>Executive Portfolio Governance Briefing</span>
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

      {/* Projects Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={18} color="#4f46e5" />
          <span>Enterprise Projects Catalog</span>
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Project Name</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px" }}>Priority</th>
                <th style={{ padding: "8px 12px" }}>Total Tasks</th>
                <th style={{ padding: "8px 12px" }}>Completed</th>
                <th style={{ padding: "8px 12px" }}>Overdue</th>
                <th style={{ padding: "8px 12px" }}>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {portfolioProjects.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0f172a" }}>{p.name}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#e2e8f0" }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", textTransform: "capitalize" }}>{p.priority}</td>
                  <td style={{ padding: "8px 12px" }}>{p.taskCount}</td>
                  <td style={{ padding: "8px 12px", color: "#16a34a", fontWeight: 600 }}>{p.completedTaskCount}</td>
                  <td style={{ padding: "8px 12px", color: p.overdueTaskCount > 0 ? "#dc2626" : "#64748b", fontWeight: p.overdueTaskCount > 0 ? 650 : 400 }}>
                    {p.overdueTaskCount}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#64748b" }}>{p.due_date ? p.due_date.slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Catalog Filter Modal */}
      {showCatalogModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, maxWidth: 540, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>Select Organization Task Catalog</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>
              Filter which enterprise projects are included in Organization Brain governance.
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
