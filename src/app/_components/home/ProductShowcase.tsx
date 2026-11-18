"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  Cloud,
  FileText,
  FolderKanban,
  GanttChart,
  Kanban,
  ListTodo,
  MessageSquare,
  Network,
  Play,
  Presentation,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

type ShowcaseModuleId =
  | "projects"
  | "views"
  | "tasks"
  | "docs"
  | "agents"
  | "brain"
  | "collaboration";

interface ShowcaseModule {
  id: ShowcaseModuleId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  capabilities: string[];
  icon: React.ElementType;
}

const MODULES: ShowcaseModule[] = [
  {
    id: "projects",
    label: "Projects",
    eyebrow: "Multi-Tenant Hierarchy",
    title: "Structured Organizations, Workspaces & Projects",
    description:
      "Organize departments, product lines, or client engagements cleanly. Manage custom per-project statuses, Live Tracker dashboards, goals, reports, and role-based access from one navigation rail.",
    capabilities: [
      "Organization → Workspace → Project hierarchy with RLS isolation",
      "Owner, Admin, Member & Viewer roles plus email invitations",
      "Live Tracker, project goals, status reports & presentation export",
    ],
    icon: FolderKanban,
  },
  {
    id: "views",
    label: "List / Board / Timeline",
    eyebrow: "12 Synchronized Views",
    title: "Switch instantly between List, Kanban Board & Gantt Timeline",
    description:
      "Every teammate works in the view that fits their role without duplicating data. Reorder project tabs and customize sheet columns independently per user.",
    capabilities: [
      "Interactive Task Sheet with inline edits, custom fields & pagination",
      "Drag-and-drop Kanban Board across custom workflow columns",
      "Gantt Timeline, Calendar, Workload, Whiteboard & Flowchart views",
    ],
    icon: Kanban,
  },
  {
    id: "tasks",
    label: "Tasks",
    eyebrow: "Deep Task Execution",
    title: "Tasks built for clarity, ownership & accurate time tracking",
    description:
      "Break complex deliverables into subtasks, checklists, and dependencies. Assign primary and secondary owners, attach cloud files, polish descriptions with AI, and run live stopwatch timers.",
    capabilities: [
      "Primary & secondary assignees, subtasks, checklists & dependencies",
      "1-click AI Description Polish & AI Subtask Planner inside tasks",
      "Live stopwatch timers, manual entries & billable tracking",
    ],
    icon: CheckSquare,
  },
  {
    id: "docs",
    label: "Docs",
    eyebrow: "Living Project Documentation",
    title: "Rich project docs & specs right alongside your tasks",
    description:
      "Keep PRDs, meeting notes, SOPs, and technical specs where your team executes. Link docs directly to tasks, preserve version snapshots, and export clean HTML or PDF anytime.",
    capabilities: [
      "Rich Markdown editor with inline images, tables & code blocks",
      "Direct task linking & Meeting Notes (MoM) to Tasks conversion",
      "Revision history snapshots and direct PDF / HTML downloads",
    ],
    icon: FileText,
  },
  {
    id: "agents",
    label: "AI Agents",
    eyebrow: "Autonomous Workflows",
    title: "Custom AI Agents triggered directly by project events",
    description:
      "Deploy built-in templates or write plain-English instructions for your own project AI agents. Automate subtask inheritance, acceptance criteria checklists, and effort estimation.",
    capabilities: [
      "Triggers: On Task Created, On Subtask Created, On Status Change, Manual",
      "Templates: Subtask Auto-Inheritor, Acceptance Criteria, Effort Estimator",
      "Custom Autonomous Agents with plain-English system instructions",
    ],
    icon: Bot,
  },
  {
    id: "brain",
    label: "Project Brain",
    eyebrow: "Live Project Intelligence",
    title: "Health diagnostics, preventive risks & Change Impact Simulation",
    description:
      "Project Brain synthesizes tasks, timelines, workload, and recorded decisions into an interactive intelligence layer—helping teams spot risks before deadlines slip.",
    capabilities: [
      "Project Health Overview, Why root-cause analysis & Preventive alerts",
      "Change Impact Simulator for deadline shifts & assignee changes",
      "Interactive Smart Dependency Graph, Decision Memory & AI Chat",
    ],
    icon: Brain,
  },
  {
    id: "collaboration",
    label: "Collaboration",
    eyebrow: "Connected Team Operations",
    title: "Team Chat, Whiteboards, Timesheets & Multi-Cloud Storage",
    description:
      "Unite real-time messaging, visual whiteboards, weekly timesheet approvals, company holidays, leave management, and your workspace's preferred cloud storage provider.",
    capabilities: [
      "Project channels, group chats, DMs & real-time notifications",
      "Weekly timesheets with manager review, leave requests & holiday calendars",
      "Bring your own storage: Google Drive, OneDrive, SharePoint, or Local DB",
    ],
    icon: Users,
  },
];

export function ProductShowcase({ isUserLoggedIn }: { isUserLoggedIn: boolean }) {
  const [activeMod, setActiveMod] = useState<ShowcaseModuleId>("views");
  const [subView, setSubView] = useState<"list" | "board" | "timeline">("board");
  const [enabledAgents, setEnabledAgents] = useState<Record<string, boolean>>({
    criteria: true,
    inheritor: true,
    estimator: true,
  });
  const [selectedCloud, setSelectedCloud] = useState<"drive" | "onedrive" | "sharepoint" | "db">("drive");

  const current = MODULES.find((m) => m.id === activeMod) ?? MODULES[0];

  return (
    <section
      className="hp-section hp-showcase-section"
      id="product"
      aria-labelledby="product-showcase-heading"
    >
      <div className="hp-container">
        <div className="hp-section-header">
          <span className="hp-section-tag">Product Showcase</span>
          <h2 className="hp-section-title" id="product-showcase-heading">
            Explore every layer of the Orbitwork workspace
          </h2>
          <p className="hp-section-desc">
            Every capability below is built directly into Orbitwork—no third-party add-ons or disconnected tabs required.
          </p>
        </div>

        {/* Interactive Module Switcher */}
        <div className="hp-showcase-tabs" role="tablist" aria-label="Orbitwork product modules">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isActive = mod.id === activeMod;
            return (
              <button
                key={mod.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveMod(mod.id)}
                className={`hp-showcase-tab ${isActive ? "is-active" : ""}`}
              >
                <Icon size={15} />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {/* Showcase Panel */}
        <div className="hp-showcase-panel">
          <div className="hp-showcase-info">
            <span className="hp-module-eyebrow">{current.eyebrow}</span>
            <h3>{current.title}</h3>
            <p>{current.description}</p>

            <ul className="hp-check-list">
              {current.capabilities.map((cap) => (
                <li key={cap}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>

            <div className="hp-showcase-cta">
              <a
                href={isUserLoggedIn ? "/my-dashboard" : "/signup"}
                className="hp-btn-primary"
              >
                {isUserLoggedIn ? "Open Workspace" : `Try ${current.label} Free`}
                <ArrowRight size={15} />
              </a>
            </div>
          </div>

          {/* Interactive Real UI Demonstration */}
          <div
            className="hp-showcase-stage"
            role="img"
            aria-label={`Interactive Orbitwork ${current.label} interface demonstration`}
          >
            {/* MODULE 1: PROJECTS */}
            {activeMod === "projects" && (
              <div className="hp-demo-surface">
                <div className="hp-demo-head">
                  <div className="hp-demo-title">
                    <FolderKanban size={15} className="hp-emerald-icon" />
                    <strong>Organization → Workspace → Project Tree</strong>
                  </div>
                  <span className="hp-chip hp-chip-green">PostgreSQL RLS Active</span>
                </div>
                <div className="hp-tree-demo">
                  <div className="hp-tree-org">
                    <strong>Northstar Digital (Organization)</strong>
                    <span className="hp-chip hp-chip-blue">Owner · Admin · Member · Viewer</span>
                  </div>
                  <div className="hp-tree-children">
                    <div className="hp-tree-ws">
                      <span className="hp-tree-dot hp-dot-emerald" />
                      <strong>Product Engineering Workspace</strong>
                      <div className="hp-tree-projects">
                        <div className="hp-tree-proj is-selected">
                          <Radio size={12} className="hp-amber-icon" />
                          <span>Customer Portal v2.4</span>
                          <span className="hp-chip hp-chip-green">Live Tracker</span>
                        </div>
                        <div className="hp-tree-proj">
                          <Target size={12} className="hp-emerald-icon" />
                          <span>Mobile App Roadmap</span>
                          <span className="hp-chip hp-chip-purple">Project Brain</span>
                        </div>
                      </div>
                    </div>
                    <div className="hp-tree-ws">
                      <span className="hp-tree-dot hp-dot-amber" />
                      <strong>Client Delivery Workspace</strong>
                      <div className="hp-tree-projects">
                        <div className="hp-tree-proj">
                          <ShieldCheck size={12} className="hp-emerald-icon" />
                          <span>Enterprise Migration</span>
                          <span className="hp-chip hp-chip-amber">Isolated Tenant</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 2: LIST / BOARD / TIMELINE */}
            {activeMod === "views" && (
              <div className="hp-demo-surface">
                <div className="hp-demo-head">
                  <div className="hp-demo-title">
                    <strong>Synchronized Project Views</strong>
                  </div>
                  <div className="hp-inline-seg">
                    {(
                      [
                        { id: "list", label: "List", icon: ListTodo },
                        { id: "board", label: "Board", icon: Kanban },
                        { id: "timeline", label: "Timeline", icon: GanttChart },
                      ] as const
                    ).map((v) => {
                      const Icon = v.icon;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSubView(v.id)}
                          className={`hp-seg-btn ${subView === v.id ? "is-active" : ""}`}
                        >
                          <Icon size={12} />
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {subView === "board" && (
                  <div className="hp-mini-kanban">
                    <div className="hp-mini-col">
                      <div className="hp-mini-col-h">To Do</div>
                      <div className="hp-mini-card">
                        <strong>Custom Field Filters</strong>
                        <span className="hp-chip hp-chip-blue">Normal</span>
                      </div>
                      <div className="hp-mini-card">
                        <strong>Holiday Calendar Sync</strong>
                        <span className="hp-chip hp-chip-amber">High</span>
                      </div>
                    </div>
                    <div className="hp-mini-col">
                      <div className="hp-mini-col-h">In Progress</div>
                      <div className="hp-mini-card is-active">
                        <strong>Gantt Critical Dependencies</strong>
                        <span className="hp-timer-chip"><Clock size={10} /> 01:40:12</span>
                      </div>
                    </div>
                    <div className="hp-mini-col">
                      <div className="hp-mini-col-h">Done</div>
                      <div className="hp-mini-card">
                        <strong>Per-User Tab Ordering</strong>
                        <span className="hp-chip hp-chip-green">Shipped ✓</span>
                      </div>
                    </div>
                  </div>
                )}

                {subView === "list" && (
                  <div className="hp-mini-sheet">
                    <div className="hp-mini-sheet-row is-head">
                      <span>Task</span>
                      <span>Status</span>
                      <span>Estimate</span>
                      <span>Linked Doc</span>
                    </div>
                    <div className="hp-mini-sheet-row">
                      <strong>Gantt Critical Dependencies</strong>
                      <span className="hp-chip hp-chip-green">In Progress</span>
                      <span>4h</span>
                      <span className="hp-doc-link"><FileText size={11} /> Timeline Spec</span>
                    </div>
                    <div className="hp-mini-sheet-row">
                      <strong>Holiday Calendar Sync</strong>
                      <span className="hp-chip hp-chip-amber">To Do</span>
                      <span>2h</span>
                      <span className="hp-doc-link"><FileText size={11} /> Leave Rules</span>
                    </div>
                    <div className="hp-mini-sheet-row">
                      <strong>Per-User Tab Ordering</strong>
                      <span className="hp-chip hp-chip-blue">Done</span>
                      <span>3h</span>
                      <span className="hp-doc-link"><FileText size={11} /> UI Prefs</span>
                    </div>
                  </div>
                )}

                {subView === "timeline" && (
                  <div className="hp-gantt-stage">
                    <div className="hp-gantt-header">
                      <span>Week 1</span>
                      <span>Week 2</span>
                      <span>Week 3</span>
                    </div>
                    <div className="hp-gantt-rows">
                      <div className="hp-gantt-row">
                        <span className="hp-gantt-label">Per-User Tab Ordering</span>
                        <div className="hp-gantt-track">
                          <div className="hp-gantt-bar hp-bar-emerald" style={{ left: "4%", width: "36%" }}>Done</div>
                        </div>
                      </div>
                      <div className="hp-gantt-row">
                        <span className="hp-gantt-label">Gantt Dependencies</span>
                        <div className="hp-gantt-track">
                          <div className="hp-gantt-bar hp-bar-amber" style={{ left: "34%", width: "42%" }}>Active</div>
                        </div>
                      </div>
                      <div className="hp-gantt-row">
                        <span className="hp-gantt-label">Holiday Calendar Sync</span>
                        <div className="hp-gantt-track">
                          <div className="hp-gantt-bar hp-bar-violet" style={{ left: "66%", width: "30%" }}>Scheduled</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="hp-demo-foot-strip">
                  <span>Also synchronized:</span>
                  <span className="hp-chip hp-chip-blue"><CalendarDays size={10} /> Calendar</span>
                  <span className="hp-chip hp-chip-green"><Users size={10} /> Workload</span>
                  <span className="hp-chip hp-chip-amber"><Presentation size={10} /> Whiteboard</span>
                  <span className="hp-chip hp-chip-purple"><Workflow size={10} /> Flowchart</span>
                </div>
              </div>
            )}

            {/* MODULE 3: TASKS */}
            {activeMod === "tasks" && (
              <div className="hp-demo-surface">
                <div className="hp-demo-head">
                  <div className="hp-demo-title">
                    <CheckSquare size={15} className="hp-emerald-icon" />
                    <strong>OW-142 · Implement Workspace Storage Proxy</strong>
                  </div>
                  <span className="hp-timer-chip"><Play size={10} /> 00:48:19</span>
                </div>
                <div className="hp-task-detail-grid">
                  <div className="hp-task-kv">
                    <span>Primary Owner</span>
                    <strong>Ananya R.</strong>
                  </div>
                  <div className="hp-task-kv">
                    <span>Secondary</span>
                    <strong>David M.</strong>
                  </div>
                  <div className="hp-task-kv">
                    <span>Estimate / Worked</span>
                    <strong>4h 00m / 2h 48m</strong>
                  </div>
                  <div className="hp-task-kv">
                    <span>Dependency</span>
                    <strong className="hp-text-amber">Blocked by OW-138</strong>
                  </div>
                </div>
                <div className="hp-checklist-box">
                  <div className="hp-checklist-head">
                    <span>Acceptance Checklist (AI Polished)</span>
                    <span className="hp-chip hp-chip-purple"><Sparkles size={10} /> 3/4 Done</span>
                  </div>
                  <div className="hp-cl-row is-done"><CheckCircle2 size={13} /> Verify workspace membership before signed proxy stream</div>
                  <div className="hp-cl-row is-done"><CheckCircle2 size={13} /> Encrypt OAuth refresh tokens with AES-256-GCM</div>
                  <div className="hp-cl-row is-done"><CheckCircle2 size={13} /> Enforce 15 MB upload limit &amp; MIME checks</div>
                  <div className="hp-cl-row"><span className="hp-cl-empty" /> Add integration test for revoked Drive token</div>
                </div>
              </div>
            )}

            {/* MODULE 4: DOCS */}
            {activeMod === "docs" && (
              <div className="hp-demo-surface">
                <div className="hp-demo-head">
                  <div className="hp-demo-title">
                    <FileText size={15} className="hp-emerald-icon" />
                    <strong>PRD: Multi-Tenant Cloud Storage</strong>
                  </div>
                  <span className="hp-chip hp-chip-green">Snapshot v4 · Export PDF</span>
                </div>
                <div className="hp-doc-toolbar" aria-hidden="true">
                  <span>H1</span>
                  <span>H2</span>
                  <span>Bold</span>
                  <span>Code</span>
                  <span>Checklist</span>
                  <span>Image</span>
                  <span className="hp-doc-tb-ai"><Sparkles size={11} /> MoM → Tasks</span>
                </div>
                <div className="hp-doc-body-preview">
                  <h4>1. Security Boundaries</h4>
                  <p>
                    Each workspace configures its own attachment backend while keeping task metadata strictly isolated in PostgreSQL via Row Level Security.
                  </p>
                  <div className="hp-doc-linked-row">
                    <span>Linked Tasks:</span>
                    <span className="hp-chip hp-chip-blue">OW-142 Storage Proxy</span>
                    <span className="hp-chip hp-chip-green">OW-138 RLS Policies</span>
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 5: AI AGENTS */}
            {activeMod === "agents" && (
              <div className="hp-demo-surface">
                <div className="hp-demo-head">
                  <div className="hp-demo-title">
                    <Bot size={15} className="hp-violet-icon" />
                    <strong>Project AI Agents Hub (Interactive Toggle)</strong>
                  </div>
                  <span className="hp-chip hp-chip-purple">Event-Driven</span>
                </div>
                <div className="hp-agents-interactive">
                  {[
                    {
                      key: "criteria",
                      name: "Acceptance Criteria Generator",
                      trigger: "On Task Created",
                      action: "Drafts 3–5 testable checklist items",
                    },
                    {
                      key: "inheritor",
                      name: "Subtask Auto-Inheritor",
                      trigger: "On Subtask Created",
                      action: "Inherits parent task assignee automatically",
                    },
                    {
                      key: "estimator",
                      name: "Effort & Priority Estimator",
                      trigger: "On Task Created",
                      action: "Suggests realistic minutes & priority level",
                    },
                  ].map((agent) => {
                    const isOn = enabledAgents[agent.key];
                    return (
                      <div key={agent.key} className={`hp-agent-toggle-card ${isOn ? "is-on" : ""}`}>
                        <div className="hp-agent-toggle-meta">
                          <strong>{agent.name}</strong>
                          <span>
                            <Zap size={11} /> {agent.trigger} → {agent.action}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEnabledAgents((prev) => ({
                              ...prev,
                              [agent.key]: !prev[agent.key],
                            }))
                          }
                          className={`hp-switch ${isOn ? "is-on" : ""}`}
                          role="switch"
                          aria-checked={isOn}
                          aria-label={`Toggle ${agent.name}`}
                        >
                          <span className="hp-switch-thumb" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODULE 6: PROJECT BRAIN */}
            {activeMod === "brain" && (
              <div className="hp-demo-surface">
                <div className="hp-demo-head">
                  <div className="hp-demo-title">
                    <Brain size={15} className="hp-violet-icon" />
                    <strong>Project Brain · Live Intelligence</strong>
                  </div>
                  <span className="hp-chip hp-chip-purple">11 Analysis Views</span>
                </div>
                <div className="hp-brain-pills-grid">
                  <span>Health Overview</span>
                  <span>Why Analysis</span>
                  <span className="is-hot">Preventive Risks</span>
                  <span>Dependencies</span>
                  <span className="is-hot">Change Impact Sim</span>
                  <span>Workload Balance</span>
                  <span>Decision Memory</span>
                  <span>Smart Graph</span>
                </div>
                <div className="hp-brain-sim-card">
                  <div className="hp-brain-sim-head">
                    <Network size={14} className="hp-violet-icon" />
                    <strong>Change Impact Simulation Result</strong>
                  </div>
                  <p>
                    Simulating a <strong>+3 day shift</strong> on &ldquo;RLS Policy Audit&rdquo; impacts <strong>2 downstream tasks</strong> and flags 1 reviewer capacity bottleneck.
                  </p>
                </div>
              </div>
            )}

            {/* MODULE 7: COLLABORATION & WORKFLOWS */}
            {activeMod === "collaboration" && (
              <div className="hp-demo-surface">
                <div className="hp-demo-head">
                  <div className="hp-demo-title">
                    <Cloud size={15} className="hp-emerald-icon" />
                    <strong>Workspace Storage &amp; Team Operations</strong>
                  </div>
                  <span className="hp-chip hp-chip-green">AES-256-GCM</span>
                </div>
                <div className="hp-cloud-grid">
                  {(
                    [
                      { id: "drive", name: "Google Drive", sub: "Scoped drive.file OAuth" },
                      { id: "onedrive", name: "Microsoft OneDrive", sub: "Personal & Business" },
                      { id: "sharepoint", name: "SharePoint", sub: "Team document libraries" },
                      { id: "db", name: "Built-in Encrypted DB", sub: "Zero-setup storage" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedCloud(item.id)}
                      className={`hp-cloud-card ${selectedCloud === item.id ? "is-selected" : ""}`}
                    >
                      <strong>{item.name}</strong>
                      <span>{item.sub}</span>
                    </button>
                  ))}
                </div>
                <div className="hp-collab-strip">
                  <span><MessageSquare size={12} /> Project Channels &amp; DMs</span>
                  <span><Clock size={12} /> Weekly Timesheet Approvals</span>
                  <span><CalendarDays size={12} /> Leave &amp; Country Holidays</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
