"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  GanttChart,
  Kanban,
  ListTodo,
  Lock,
  MessageSquare,
  Pause,
  Play,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";
import { useInViewport, usePrefersReducedMotion } from "./useMotionPreferences";

type HeroViewId = "board" | "list" | "timeline" | "docs" | "agents" | "brain";

const HERO_VIEWS: Array<{
  id: HeroViewId;
  label: string;
  urlSlug: string;
  caption: string;
  icon: React.ElementType;
}> = [
  {
    id: "board",
    label: "Board",
    urlSlug: "board",
    caption: "Drag-and-drop Kanban board with live task timers",
    icon: Kanban,
  },
  {
    id: "list",
    label: "List",
    urlSlug: "list",
    caption: "Interactive task sheet with linked docs & estimates",
    icon: ListTodo,
  },
  {
    id: "timeline",
    label: "Timeline",
    urlSlug: "gantt",
    caption: "Gantt timeline with milestones & dependencies",
    icon: GanttChart,
  },
  {
    id: "docs",
    label: "Docs",
    urlSlug: "documents",
    caption: "Living Markdown project specs linked to tasks",
    icon: FileText,
  },
  {
    id: "agents",
    label: "AI Agents",
    urlSlug: "agents",
    caption: "Trigger-driven autonomous AI agents for teams",
    icon: Bot,
  },
  {
    id: "brain",
    label: "Project Brain",
    urlSlug: "brain",
    caption: "Live project health, risks & change impact analysis",
    icon: Brain,
  },
];

export function Hero3DWorkspaceStage() {
  const reducedMotion = usePrefersReducedMotion();
  const { ref: stageRef, inView } = useInViewport<HTMLDivElement>("80px");

  const [activeView, setActiveView] = useState<HeroViewId>("board");
  const [autoPlay, setAutoPlay] = useState(true);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(4935); // 01:22:15
  const [tilt, setTilt] = useState({ rx: 4, ry: -2 });
  const [isHovering, setIsHovering] = useState(false);

  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  // Live stopwatch ticking only while visible
  useEffect(() => {
    if (!isTimerRunning || !inView) return;
    const id = window.setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTimerRunning, inView]);

  // Video-style auto-tour across real Orbitwork views
  useEffect(() => {
    if (!autoPlay || reducedMotion || !inView || isHovering) return;
    const id = window.setInterval(() => {
      setActiveView((current) => {
        const idx = HERO_VIEWS.findIndex((v) => v.id === current);
        const nextIdx = (idx + 1) % HERO_VIEWS.length;
        return HERO_VIEWS[nextIdx].id;
      });
    }, 4500);
    return () => window.clearInterval(id);
  }, [autoPlay, reducedMotion, inView, isHovering]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !stageContainerRef.current) return;
    const rect = stageContainerRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-py * 7).toFixed(2)),
      ry: Number((px * 9).toFixed(2)),
    });
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ rx: 3.5, ry: -1.5 });
  };

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const currentMeta = HERO_VIEWS.find((v) => v.id === activeView) ?? HERO_VIEWS[0];
  const currentIdx = HERO_VIEWS.findIndex((v) => v.id === activeView);

  return (
    <div
      ref={stageRef}
      className="hp-hero-3d-stage"
      aria-label="Interactive 3D Orbitwork workspace preview showing Board, List, Timeline, Docs, AI Agents, and Project Brain views"
      role="region"
    >
      {/* Ambient 3D backdrop glow */}
      <div className="hp-3d-aura" aria-hidden="true" />

      {/* 3D Perspective Frame */}
      <div
        ref={stageContainerRef}
        className="hp-hero-3d-visual"
        onMouseEnter={() => setIsHovering(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={
          reducedMotion
            ? undefined
            : {
                transform: `perspective(1500px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              }
        }
      >
        {/* Depth Layer 1: Floating Project Brain Signal Satellite */}
        <div className="hp-3d-satellite hp-3d-sat-top" aria-hidden="true">
          <div className="hp-sat-icon hp-sat-violet">
            <Brain size={15} />
          </div>
          <div className="hp-sat-copy">
            <strong>Project Brain</strong>
            <span>Dependency risk flagged · 1 impact</span>
          </div>
          <span className="hp-sat-dot" />
        </div>

        {/* Depth Layer 2: Floating AI Agent Satellite */}
        <div className="hp-3d-satellite hp-3d-sat-bottom" aria-hidden="true">
          <div className="hp-sat-icon hp-sat-emerald">
            <Bot size={15} />
          </div>
          <div className="hp-sat-copy">
            <strong>Acceptance Criteria Agent</strong>
            <span>4 checklist items added on create</span>
          </div>
        </div>

        {/* Main Orbitwork App Window */}
        <div className="hp-window-shell">
          {/* Browser Chrome */}
          <div className="hp-window-topbar">
            <div className="hp-window-dots" aria-hidden="true">
              <span className="hp-dot hp-dot-red" />
              <span className="hp-dot hp-dot-yellow" />
              <span className="hp-dot hp-dot-green" />
            </div>

            <div className="hp-window-address">
              <Lock size={11} aria-hidden="true" />
              <span>app.orbitwork.org/projects/product-launch/{currentMeta.urlSlug}</span>
            </div>

            <div className="hp-window-controls">
              <button
                type="button"
                className="hp-tour-toggle"
                onClick={() => setAutoPlay((prev) => !prev)}
                aria-label={autoPlay ? "Pause interactive product tour" : "Play interactive product tour"}
              >
                {autoPlay && !reducedMotion ? <Pause size={11} /> : <Play size={11} />}
                <span>{autoPlay && !reducedMotion ? "Auto-Tour" : "Paused"}</span>
              </button>
            </div>
          </div>

          {/* Orbitwork Real App Shell: Dark Emerald Rail + Project Workspace */}
          <div className="hp-window-grid">
            {/* Real Orbitwork App Rail */}
            <aside className="hp-app-rail-mini" aria-hidden="true">
              <div className="hp-rail-logo">O</div>
              <div className="hp-rail-icons">
                <span className="hp-rail-btn is-active" title="Projects">
                  <Kanban size={14} />
                </span>
                <span className="hp-rail-btn" title="Docs">
                  <FileText size={14} />
                </span>
                <span className="hp-rail-btn" title="Team Chat">
                  <MessageSquare size={14} />
                </span>
                <span className="hp-rail-btn" title="Timesheets">
                  <Clock size={14} />
                </span>
                <span className="hp-rail-btn" title="Project Brain">
                  <Brain size={14} />
                </span>
              </div>
              <div className="hp-rail-avatar">AK</div>
            </aside>

            {/* Hierarchy Sidebar */}
            <aside className="hp-window-sidebar">
              <div className="hp-ws-brand">
                <span className="hp-ws-badge">OW</span>
                <div>
                  <strong>Product Studio</strong>
                  <span>Core Platform Workspace</span>
                </div>
              </div>

              <div className="hp-ws-section-label">PROJECT VIEWS</div>
              <nav className="hp-ws-nav" aria-label="Workspace preview views">
                {HERO_VIEWS.map((view) => {
                  const Icon = view.icon;
                  const isActive = view.id === activeView;
                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => {
                        setActiveView(view.id);
                        setAutoPlay(false);
                      }}
                      className={`hp-ws-nav-item ${isActive ? "is-active" : ""}`}
                    >
                      <Icon size={13} />
                      <span>{view.label}</span>
                      {view.id === "brain" && <span className="hp-mini-pill-ai">AI</span>}
                    </button>
                  );
                })}
              </nav>

              <div className="hp-ws-timer-box">
                <div className="hp-ws-timer-head">
                  <span>Task Stopwatch</span>
                  <button
                    type="button"
                    onClick={() => setIsTimerRunning((p) => !p)}
                    className="hp-ws-timer-btn"
                    aria-label={isTimerRunning ? "Pause demo stopwatch" : "Resume demo stopwatch"}
                  >
                    {isTimerRunning ? <Pause size={9} /> : <Play size={9} />}
                    {isTimerRunning ? "Live" : "Paused"}
                  </button>
                </div>
                <div className="hp-ws-timer-val">{formatTimer(timerSeconds)}</div>
                <div className="hp-ws-timer-sub">Storage: Workspace Cloud</div>
              </div>
            </aside>

            {/* Main Project Content Area */}
            <div className="hp-window-main">
              {/* Project Header & Real View Tabs */}
              <div className="hp-proj-head">
                <div>
                  <div className="hp-proj-title-row">
                    <span className="hp-live-dot" aria-hidden="true" />
                    <h4>Release 2.4 — Customer Portal</h4>
                    <span className="hp-status-chip">Active Sprint</span>
                  </div>
                  <p className="hp-proj-sub">{currentMeta.caption}</p>
                </div>

                <div className="hp-view-switcher" role="tablist" aria-label="Orbitwork views">
                  {HERO_VIEWS.map((view) => {
                    const Icon = view.icon;
                    const isActive = view.id === activeView;
                    return (
                      <button
                        key={view.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                          setActiveView(view.id);
                          setAutoPlay(false);
                        }}
                        className={`hp-view-pill ${isActive ? "is-active" : ""}`}
                      >
                        <Icon size={12} />
                        <span>{view.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Animated Stage Viewport */}
              <div className="hp-stage-viewport" key={activeView}>
                {activeView === "board" && (
                  <div className="hp-board-cols">
                    <div className="hp-board-col">
                      <div className="hp-board-col-head">
                        <span>Planned</span>
                        <span className="hp-col-count">2</span>
                      </div>
                      <div className="hp-task-card">
                        <div className="hp-task-title">OAuth2 Workspace Storage Routing</div>
                        <div className="hp-task-meta">
                          <span className="hp-chip hp-chip-amber">High</span>
                          <span className="hp-chip hp-chip-blue">Backend</span>
                        </div>
                        <div className="hp-task-foot">
                          <span>3 subtasks</span>
                          <span>Est 4h</span>
                        </div>
                      </div>
                      <div className="hp-task-card">
                        <div className="hp-task-title">Onboarding Doc Templates</div>
                        <div className="hp-task-meta">
                          <span className="hp-chip hp-chip-green">Docs Linked</span>
                        </div>
                      </div>
                    </div>

                    <div className="hp-board-col">
                      <div className="hp-board-col-head">
                        <span>In Progress</span>
                        <span className="hp-col-count">2</span>
                      </div>
                      <div className="hp-task-card is-highlighted">
                        <div className="hp-task-title">Role-Based Access &amp; RLS Audit</div>
                        <div className="hp-task-meta">
                          <span className="hp-chip hp-chip-purple">AI Checklist ✓</span>
                          <span className="hp-timer-chip">
                            <Clock size={10} /> {formatTimer(timerSeconds)}
                          </span>
                        </div>
                        <div className="hp-task-foot">
                          <span>Spec v2.4 linked</span>
                          <span className="hp-live-text">Active</span>
                        </div>
                      </div>
                      <div className="hp-task-card">
                        <div className="hp-task-title">Weekly Timesheet Manager Review</div>
                        <div className="hp-task-meta">
                          <span className="hp-chip hp-chip-amber">In Review</span>
                        </div>
                      </div>
                    </div>

                    <div className="hp-board-col">
                      <div className="hp-board-col-head">
                        <span>Completed</span>
                        <span className="hp-col-count">4</span>
                      </div>
                      <div className="hp-task-card">
                        <div className="hp-task-title">Smart Dependency Graph UI</div>
                        <div className="hp-task-meta">
                          <span className="hp-chip hp-chip-green">Verified ✓</span>
                        </div>
                        <div className="hp-task-foot">
                          <span>5h 20m logged</span>
                          <span>Shipped</span>
                        </div>
                      </div>
                      <div className="hp-task-card">
                        <div className="hp-task-title">Meeting Notes to Tasks Importer</div>
                        <div className="hp-task-meta">
                          <span className="hp-chip hp-chip-green">Shipped ✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeView === "list" && (
                  <div className="hp-sheet-wrap">
                    <table className="hp-sheet-table">
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Linked Doc</th>
                          <th>Worked</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Role-Based Access &amp; RLS Audit</strong></td>
                          <td><span className="hp-chip hp-chip-green">In Progress</span></td>
                          <td><span className="hp-chip hp-chip-amber">Urgent</span></td>
                          <td><span className="hp-doc-link"><FileText size={11} /> Security Spec</span></td>
                          <td className="hp-mono-green">{formatTimer(timerSeconds)}</td>
                        </tr>
                        <tr>
                          <td><strong>OAuth2 Workspace Storage Routing</strong></td>
                          <td><span className="hp-chip hp-chip-purple">Planned</span></td>
                          <td><span className="hp-chip hp-chip-amber">High</span></td>
                          <td><span className="hp-doc-link"><FileText size={11} /> Drive OAuth</span></td>
                          <td>0h 00m</td>
                        </tr>
                        <tr>
                          <td><strong>Weekly Timesheet Manager Review</strong></td>
                          <td><span className="hp-chip hp-chip-blue">Review</span></td>
                          <td><span className="hp-chip hp-chip-blue">Normal</span></td>
                          <td><span className="hp-doc-link"><FileText size={11} /> Billing SOP</span></td>
                          <td>3h 45m</td>
                        </tr>
                        <tr>
                          <td><strong>Smart Dependency Graph UI</strong></td>
                          <td><span className="hp-chip hp-chip-green">Done</span></td>
                          <td><span className="hp-chip hp-chip-blue">Normal</span></td>
                          <td><span className="hp-doc-link"><FileText size={11} /> Brain PRD</span></td>
                          <td>5h 20m</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {activeView === "timeline" && (
                  <div className="hp-gantt-stage">
                    <div className="hp-gantt-header">
                      <span>Sprint Week 1</span>
                      <span>Sprint Week 2</span>
                      <span>Sprint Week 3</span>
                      <span>Release</span>
                    </div>
                    <div className="hp-gantt-rows">
                      <div className="hp-gantt-row">
                        <span className="hp-gantt-label">Smart Dependency Graph</span>
                        <div className="hp-gantt-track">
                          <div className="hp-gantt-bar hp-bar-emerald" style={{ left: "2%", width: "36%" }}>
                            Done · 100%
                          </div>
                        </div>
                      </div>
                      <div className="hp-gantt-row">
                        <span className="hp-gantt-label">RLS Security Audit</span>
                        <div className="hp-gantt-track">
                          <div className="hp-gantt-bar hp-bar-amber" style={{ left: "26%", width: "42%" }}>
                            Active · 72%
                          </div>
                        </div>
                      </div>
                      <div className="hp-gantt-row">
                        <span className="hp-gantt-label">Storage OAuth Routing</span>
                        <div className="hp-gantt-track">
                          <div className="hp-gantt-bar hp-bar-violet" style={{ left: "54%", width: "34%" }}>
                            Dependent · Next
                          </div>
                        </div>
                      </div>
                      <div className="hp-gantt-row">
                        <span className="hp-gantt-label">Portal Production Launch</span>
                        <div className="hp-gantt-track">
                          <div className="hp-gantt-bar hp-bar-sky" style={{ left: "78%", width: "20%" }}>
                            Milestone ◆
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeView === "docs" && (
                  <div className="hp-doc-stage">
                    <div className="hp-doc-stage-head">
                      <div className="hp-doc-title-group">
                        <FileText size={15} />
                        <strong>Architecture Spec: Multi-Tenant Workspace Storage</strong>
                      </div>
                      <span className="hp-chip hp-chip-green">v3 Snapshot · Linked to 3 Tasks</span>
                    </div>
                    <p className="hp-doc-excerpt">
                      Each workspace routes attachments to Google Drive, Microsoft OneDrive, SharePoint, or encrypted database storage. Credentials are isolated by workspace RLS and encrypted via AES-256-GCM.
                    </p>
                    <div className="hp-doc-code">
                      <code>workspace.storageProvider → &quot;google_drive&quot; | &quot;onedrive&quot; | &quot;sharepoint&quot; | &quot;local&quot;</code>
                    </div>
                    <div className="hp-doc-footer-pills">
                      <span className="hp-chip hp-chip-blue">Export PDF</span>
                      <span className="hp-chip hp-chip-purple">Indexed by Project Brain</span>
                    </div>
                  </div>
                )}

                {activeView === "agents" && (
                  <div className="hp-agents-stage">
                    <div className="hp-agent-row">
                      <div className="hp-agent-badge hp-sat-violet"><Bot size={14} /></div>
                      <div className="hp-agent-info">
                        <strong>Acceptance Criteria Generator</strong>
                        <span>Trigger: On Task Created → Drafts 4 testable checklist items</span>
                      </div>
                      <span className="hp-chip hp-chip-green">Enabled</span>
                    </div>
                    <div className="hp-agent-row">
                      <div className="hp-agent-badge hp-sat-emerald"><Zap size={14} /></div>
                      <div className="hp-agent-info">
                        <strong>Subtask Auto-Inheritor</strong>
                        <span>Trigger: On Subtask Created → Inherits parent assignee</span>
                      </div>
                      <span className="hp-chip hp-chip-green">Enabled</span>
                    </div>
                    <div className="hp-agent-row">
                      <div className="hp-agent-badge hp-sat-amber"><Clock size={14} /></div>
                      <div className="hp-agent-info">
                        <strong>Effort &amp; Priority Estimator</strong>
                        <span>Trigger: On Task Created → Suggests realistic effort &amp; priority</span>
                      </div>
                      <span className="hp-chip hp-chip-blue">Ready</span>
                    </div>
                  </div>
                )}

                {activeView === "brain" && (
                  <div className="hp-brain-stage">
                    <div className="hp-brain-kpi-row">
                      <div className="hp-brain-kpi">
                        <span>Health Overview</span>
                        <strong className="hp-text-emerald">On Track</strong>
                      </div>
                      <div className="hp-brain-kpi">
                        <span>Preventive Risks</span>
                        <strong className="hp-text-amber">1 Dependency Watch</strong>
                      </div>
                      <div className="hp-brain-kpi">
                        <span>Decision Memory</span>
                        <strong>6 Recorded</strong>
                      </div>
                    </div>
                    <div className="hp-brain-insight-box">
                      <div className="hp-brain-insight-head">
                        <Sparkles size={13} />
                        <strong>Actionable Recommendation · Change Impact Simulation</strong>
                      </div>
                      <p>
                        &ldquo;OAuth2 Workspace Storage Routing&rdquo; depends on &ldquo;RLS Security Audit&rdquo;. Moving the audit completion up by 1 day keeps the release milestone clear with zero workload overload.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video-style Reel Progress Scrubber */}
              <div className="hp-reel-bar" aria-hidden="true">
                {HERO_VIEWS.map((view, idx) => (
                  <button
                    key={view.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setActiveView(view.id);
                      setAutoPlay(false);
                    }}
                    className={`hp-reel-segment ${idx === currentIdx ? "is-current" : ""} ${idx < currentIdx ? "is-done" : ""}`}
                  >
                    <span
                      className={`hp-reel-fill ${
                        idx === currentIdx && autoPlay && !reducedMotion && inView && !isHovering
                          ? "is-animating"
                          : ""
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Concise live view caption */}
      <div className="hp-stage-caption">
        <Radio size={13} className="hp-caption-icon" aria-hidden="true" />
        <span>
          Interactive Product Preview — click any tab above to explore Orbitwork&apos;s synchronized views
        </span>
      </div>
    </div>
  );
}
