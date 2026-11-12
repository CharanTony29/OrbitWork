"use client";

import { useState, useEffect } from "react";
import {
  Kanban,
  Layers3,
  Clock,
  FileText,
  Share2,
  Lock,
  Play,
  Pause,
  CheckCircle2,
  Plus,
  ArrowRight,
  Sparkles,
  Calendar,
  AlertCircle
} from "lucide-react";

export function HeroInteractiveMockup() {
  const [activeView, setActiveView] = useState<"board" | "sheet" | "gantt" | "docs">("board");
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(6135); // 01:42:15

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="hp-mockup-window">
      {/* Top Window Bar */}
      <div className="hp-mockup-topbar">
        <div className="hp-mockup-dots">
          <div className="hp-mockup-dot hp-dot-red" />
          <div className="hp-mockup-dot hp-dot-yellow" />
          <div className="hp-mockup-dot hp-dot-green" />
        </div>
        <div className="hp-mockup-address">
          <Lock size={11} />
          <span>app.orbitwork.com/workspaces/engineering/{activeView}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
            Live Demo
          </span>
        </div>
      </div>

      <div className="hp-mockup-body">
        {/* Mockup Sidebar */}
        <aside className="hp-mockup-sidebar">
          <div className="hp-mini-brand">
            <span className="hp-mini-brand-mark" aria-hidden="true">A</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>Acme Systems</div>
              <div style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 500 }}>Engineering Workspace</div>
            </div>
          </div>

          <div className="hp-mini-nav">
            <button
              type="button"
              onClick={() => setActiveView("board")}
              className={`hp-mini-nav-item ${activeView === "board" ? "active" : ""}`}
              style={{ border: "none", background: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
            >
              <Kanban size={13} />
              <span>Sprint 14 Board</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("sheet")}
              className={`hp-mini-nav-item ${activeView === "sheet" ? "active" : ""}`}
              style={{ border: "none", background: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
            >
              <Layers3 size={13} />
              <span>Interactive Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("gantt")}
              className={`hp-mini-nav-item ${activeView === "gantt" ? "active" : ""}`}
              style={{ border: "none", background: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
            >
              <Clock size={13} />
              <span>Gantt Roadmap</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("docs")}
              className={`hp-mini-nav-item ${activeView === "docs" ? "active" : ""}`}
              style={{ border: "none", background: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
            >
              <FileText size={13} />
              <span>Project Specs</span>
            </button>
          </div>

          <div className="hp-mini-badge">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Active Stopwatch</strong>
              <button
                type="button"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                style={{
                  border: "none",
                  background: isTimerRunning ? "#eaf4ed" : "#fef3c7",
                  color: isTimerRunning ? "var(--green)" : "#b45309",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 3
                }}
              >
                {isTimerRunning ? <Pause size={9} /> : <Play size={9} />}
                {isTimerRunning ? "Pause" : "Resume"}
              </button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace", marginTop: 4, color: "var(--ink)" }}>
              ⏱️ {formatTimer(timerSeconds)}
            </div>
            <div style={{ fontSize: 9.5, opacity: 0.8, marginTop: 2 }}>Storage: Google Drive</div>
          </div>
        </aside>

        {/* Mockup Main Canvas */}
        <div className="hp-mockup-content">
          <div className="hp-mockup-content-header">
            <div className="hp-mockup-project-info">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h4>Core Platform Architecture (Q4)</h4>
                <span className="hp-tag hp-tag-green" style={{ fontSize: 9 }}>Active Sprint</span>
              </div>
              <p>Workspace: Engineering · 14 Tasks · 8 Completed · 38.5h Logged</p>
            </div>

            <div className="hp-mockup-view-tabs">
              <button
                type="button"
                onClick={() => setActiveView("board")}
                className={`hp-mockup-view-tab ${activeView === "board" ? "active" : ""}`}
                style={{ border: "none", background: "none", cursor: "pointer" }}
              >
                <Kanban size={12} />
                <span>Board</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("sheet")}
                className={`hp-mockup-view-tab ${activeView === "sheet" ? "active" : ""}`}
                style={{ border: "none", background: "none", cursor: "pointer" }}
              >
                <Layers3 size={12} />
                <span>Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("gantt")}
                className={`hp-mockup-view-tab ${activeView === "gantt" ? "active" : ""}`}
                style={{ border: "none", background: "none", cursor: "pointer" }}
              >
                <Clock size={12} />
                <span>Gantt</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("docs")}
                className={`hp-mockup-view-tab ${activeView === "docs" ? "active" : ""}`}
                style={{ border: "none", background: "none", cursor: "pointer" }}
              >
                <FileText size={12} />
                <span>Docs</span>
              </button>
            </div>
          </div>

          {/* VIEW: KANBAN BOARD */}
          {activeView === "board" && (
            <div className="hp-mockup-board">
              {/* To Do */}
              <div className="hp-mockup-column">
                <div className="hp-mockup-col-header">
                  <span>To Do</span>
                  <span className="count-pill">2</span>
                </div>
                <div className="hp-mockup-card">
                  <div className="hp-mockup-card-title">Token Refresh Rotation</div>
                  <div className="hp-mockup-card-tags">
                    <span className="hp-tag hp-tag-purple">Backend</span>
                    <span className="hp-tag hp-tag-amber">P1 High</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9.5, color: "var(--muted)", marginTop: 4 }}>
                    <span>Est: 3h</span>
                    <span>2 checklists</span>
                  </div>
                </div>
                <div className="hp-mockup-card">
                  <div className="hp-mockup-card-title">Responsive Navigation Polish</div>
                  <div className="hp-mockup-card-tags">
                    <span className="hp-tag hp-tag-blue">Frontend</span>
                  </div>
                </div>
              </div>

              {/* In Progress */}
              <div className="hp-mockup-column">
                <div className="hp-mockup-col-header">
                  <span>In Progress</span>
                  <span className="count-pill">2</span>
                </div>
                <div className="hp-mockup-card" style={{ borderColor: "rgba(22, 124, 88, 0.45)", background: "rgba(22, 124, 88, 0.03)" }}>
                  <div className="hp-mockup-card-title">Multi-Tenant Storage Integration</div>
                  <div className="hp-mockup-card-tags">
                    <span className="hp-tag hp-tag-green">Cloud</span>
                    <button
                      type="button"
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                      className="hp-mockup-timer-pill"
                      style={{ border: "none", cursor: "pointer" }}
                      title="Click to toggle timer"
                    >
                      <Clock size={10} /> {formatTimer(timerSeconds)}
                    </button>
                  </div>
                  <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                    <span>Google Drive Synced</span>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>● Active</span>
                  </div>
                </div>

                <div className="hp-mockup-card">
                  <div className="hp-mockup-card-title">Weekly Timesheet PDF Export</div>
                  <div className="hp-mockup-card-tags">
                    <span className="hp-tag hp-tag-amber">Review</span>
                    <span style={{ fontSize: 9.5, color: "var(--muted)" }}>Due Today</span>
                  </div>
                </div>
              </div>

              {/* Completed */}
              <div className="hp-mockup-column">
                <div className="hp-mockup-col-header">
                  <span>Completed</span>
                  <span className="count-pill">5</span>
                </div>
                <div className="hp-mockup-card">
                  <div className="hp-mockup-card-title">PostgreSQL RLS Security Policies</div>
                  <div className="hp-mockup-card-tags">
                    <span className="hp-tag hp-tag-green">Verified ✓</span>
                    <span style={{ fontSize: 9.5, color: "var(--muted)" }}>5h 30m</span>
                  </div>
                </div>
                <div className="hp-mockup-card">
                  <div className="hp-mockup-card-title">Task Dependency Flowcharts</div>
                  <div className="hp-mockup-card-tags">
                    <span className="hp-tag hp-tag-green">Shipped ✓</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SPREADSHEET SHEET */}
          {activeView === "sheet" && (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle)", textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "8px 10px", fontWeight: 750 }}>Task Name</th>
                    <th style={{ padding: "8px 10px", fontWeight: 750 }}>Status</th>
                    <th style={{ padding: "8px 10px", fontWeight: 750 }}>Assignee</th>
                    <th style={{ padding: "8px 10px", fontWeight: 750 }}>Priority</th>
                    <th style={{ padding: "8px 10px", fontWeight: 750 }}>Estimate</th>
                    <th style={{ padding: "8px 10px", fontWeight: 750 }}>Logged</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 650 }}>Multi-Tenant Storage Integration</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-green">In Progress</span></td>
                    <td style={{ padding: "8px 10px" }}>Sarah L.</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-amber">Urgent</span></td>
                    <td style={{ padding: "8px 10px", color: "var(--muted)" }}>4h</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--green)" }}>{formatTimer(timerSeconds)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 650 }}>Token Refresh Rotation</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-purple">To Do</span></td>
                    <td style={{ padding: "8px 10px" }}>Alex K.</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-amber">High</span></td>
                    <td style={{ padding: "8px 10px", color: "var(--muted)" }}>3h</td>
                    <td style={{ padding: "8px 10px", color: "var(--muted)" }}>0h</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 650 }}>PostgreSQL RLS Security Policies</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-green">Done</span></td>
                    <td style={{ padding: "8px 10px" }}>David M.</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-blue">Normal</span></td>
                    <td style={{ padding: "8px 10px", color: "var(--muted)" }}>6h</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>5h 30m</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px 10px", fontWeight: 650 }}>Weekly Timesheet PDF Export</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-amber">Review</span></td>
                    <td style={{ padding: "8px 10px" }}>Elena R.</td>
                    <td style={{ padding: "8px 10px" }}><span className="hp-tag hp-tag-blue">Normal</span></td>
                    <td style={{ padding: "8px 10px", color: "var(--muted)" }}>2h</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>1h 45m</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW: GANTT TIMELINE */}
          {activeView === "gantt" && (
            <div style={{ width: "100%", padding: "6px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6, fontSize: 10, color: "var(--muted)" }}>
                <span>Sprint Week 1 (Oct 28 - Nov 03)</span>
                <span>Sprint Week 2 (Nov 04 - Nov 10)</span>
                <span>Sprint Week 3 (Nov 11 - Nov 17)</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 140, fontSize: 10.5, fontWeight: 650, flexShrink: 0 }}>RLS Security Policies</span>
                  <div style={{ flex: 1, position: "relative", height: 22, background: "var(--surface-subtle)", borderRadius: 4 }}>
                    <div style={{ position: "absolute", left: "0%", width: "45%", height: "100%", background: "var(--green)", borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, color: "#fff", fontSize: 9.5, fontWeight: 700 }}>
                      Shipped (100%)
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 140, fontSize: 10.5, fontWeight: 650, flexShrink: 0 }}>Multi-Cloud Storage</span>
                  <div style={{ flex: 1, position: "relative", height: 22, background: "var(--surface-subtle)", borderRadius: 4 }}>
                    <div style={{ position: "absolute", left: "30%", width: "45%", height: "100%", background: "#efb64b", borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, color: "#17231f", fontSize: 9.5, fontWeight: 700 }}>
                      Active (75%)
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 140, fontSize: 10.5, fontWeight: 650, flexShrink: 0 }}>Timesheet PDF Generator</span>
                  <div style={{ flex: 1, position: "relative", height: 22, background: "var(--surface-subtle)", borderRadius: 4 }}>
                    <div style={{ position: "absolute", left: "55%", width: "35%", height: "100%", background: "#38bdf8", borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, color: "#fff", fontSize: 9.5, fontWeight: 700 }}>
                      Under Review
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: PROJECT DOCS */}
          {activeView === "docs" && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 14, fontSize: 11.5, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={15} color="var(--green)" />
                  <strong>Platform Specification: Storage Routing</strong>
                </div>
                <span className="hp-tag hp-tag-green" style={{ fontSize: 9 }}>Version 3 · Published</span>
              </div>
              <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>
                Workspaces support per-tenant storage routing. When Google Drive is selected, files are written to the dedicated Orbitwork application folder with encrypted tokens.
              </p>
              <div style={{ background: "var(--surface-subtle)", padding: "6px 8px", borderRadius: 6, fontFamily: "monospace", fontSize: 10 }}>
                const &#123; data &#125; = await uploadToWorkspaceStorage(workspaceId, file);
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
