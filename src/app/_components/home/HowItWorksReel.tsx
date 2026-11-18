"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  GanttChart,
  Kanban,
  MessageSquare,
  Pause,
  Play,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useInViewport, usePrefersReducedMotion } from "./useMotionPreferences";

type JourneyStepId = "plan" | "collaborate" | "execute" | "improve";

interface JourneyStep {
  id: JourneyStepId;
  num: string;
  title: string;
  headline: string;
  summary: string;
  clipLabel: string;
  highlights: string[];
  icon: React.ElementType;
}

const STEPS: JourneyStep[] = [
  {
    id: "plan",
    num: "01",
    title: "Plan",
    headline: "Turn goals & meeting notes into structured project plans",
    summary:
      "Start with a project goal or rough meeting notes. Orbitwork's AI Subtask Planner and MoM-to-Tasks importer break work into sequenced tasks, milestones, effort estimates, and Gantt timelines.",
    clipLabel: "CLIP 01 · AI Subtask Planner & Timeline Setup",
    highlights: [
      "Generate subtasks, checklists & effort estimates from a goal",
      "Set priorities, dependencies & target milestones on Gantt",
      "Organize cleanly by Organization → Workspace → Project",
    ],
    icon: Target,
  },
  {
    id: "collaborate",
    num: "02",
    title: "Collaborate",
    headline: "Keep docs, decisions, and team conversations linked to tasks",
    summary:
      "Write living project specifications beside your backlog, discuss blockers in real-time Project Channels, and turn any chat message into an assigned task in one click.",
    clipLabel: "CLIP 02 · Living Docs & Project Channel Sync",
    highlights: [
      "Rich Markdown docs linked directly to task rows & cards",
      "Project channels, group chats & DMs with instant task creation",
      "Shared files via Google Drive, OneDrive, SharePoint, or DB",
    ],
    icon: MessageSquare,
  },
  {
    id: "execute",
    num: "03",
    title: "Execute",
    headline: "Ship faster with synchronized views, live timers & AI agents",
    summary:
      "Move work across Kanban boards, interactive task sheets, and workload calendars while built-in stopwatches log billable hours and Custom AI Agents automate checklists and assignments.",
    clipLabel: "CLIP 03 · Board Execution, Stopwatch & AI Agent Run",
    highlights: [
      "12 synchronized project views with per-user custom layouts",
      "Event-driven AI Agents run automatically on task creation",
      "Built-in task timers feed straight into weekly timesheets",
    ],
    icon: Kanban,
  },
  {
    id: "improve",
    num: "04",
    title: "Improve",
    headline: "Spot risks early and simulate impact with Project Brain",
    summary:
      "Project Brain continuously reads your live tasks, dependencies, workload, and decisions—surfacing preventive risks, running Change Impact Simulations, and recording team memory.",
    clipLabel: "CLIP 04 · Project Brain Risk Detection & Simulation",
    highlights: [
      "Live Project Health diagnostics & preventive recommendations",
      "Simulate deadline shifts or task delays before they cascade",
      "Decision Memory captures why key choices were made",
    ],
    icon: TrendingUp,
  },
];

export function HowItWorksReel() {
  const reducedMotion = usePrefersReducedMotion();
  const { ref: sectionRef, inView } = useInViewport<HTMLElement>("100px");

  const [activeId, setActiveId] = useState<JourneyStepId>("plan");
  const [isPlaying, setIsPlaying] = useState(true);
  const [subFrame, setSubFrame] = useState(0);

  // Advance animation frames inside each clip for video-like motion
  useEffect(() => {
    if (reducedMotion || !inView || !isPlaying) return;
    const frameTimer = window.setInterval(() => {
      setSubFrame((f) => (f + 1) % 3);
    }, 1900);
    return () => window.clearInterval(frameTimer);
  }, [reducedMotion, inView, isPlaying]);

  // Auto-advance journey steps when playing
  useEffect(() => {
    if (reducedMotion || !inView || !isPlaying) return;
    const stepTimer = window.setInterval(() => {
      setActiveId((curr) => {
        const idx = STEPS.findIndex((s) => s.id === curr);
        return STEPS[(idx + 1) % STEPS.length].id;
      });
      setSubFrame(0);
    }, 6000);
    return () => window.clearInterval(stepTimer);
  }, [reducedMotion, inView, isPlaying]);

  const activeIndex = STEPS.findIndex((s) => s.id === activeId);
  const currentStep = STEPS[activeIndex] ?? STEPS[0];

  const handleSelectStep = (id: JourneyStepId) => {
    setActiveId(id);
    setSubFrame(0);
  };

  return (
    <section
      ref={sectionRef}
      className="hp-section hp-journey-section"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <div className="hp-container">
        <div className="hp-section-header">
          <span className="hp-section-tag">How Orbitwork Works</span>
          <h2 className="hp-section-title" id="how-it-works-heading">
            From first idea to continuous delivery in four connected steps
          </h2>
          <p className="hp-section-desc">
            Watch how project planning, team collaboration, task execution, and AI intelligence stay connected inside one workspace.
          </p>
        </div>

        {/* Connected 4-Step Journey Rail */}
        <div className="hp-journey-rail" role="tablist" aria-label="Orbitwork workflow stages">
          <div className="hp-journey-line" aria-hidden="true">
            <div
              className="hp-journey-line-fill"
              style={{ width: `${(activeIndex / (STEPS.length - 1)) * 100}%` }}
            />
          </div>

          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.id === activeId;
            const isCompleted = idx < activeIndex;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  handleSelectStep(step.id);
                  setIsPlaying(false);
                }}
                className={`hp-journey-step-btn ${isActive ? "is-active" : ""} ${isCompleted ? "is-passed" : ""}`}
              >
                <span className="hp-step-node">
                  <Icon size={16} />
                </span>
                <span className="hp-step-meta">
                  <span className="hp-step-num">Step {step.num}</span>
                  <strong>{step.title}</strong>
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Split Stage: Step Story + Video-Style Animated Product Clip */}
        <div className="hp-journey-stage">
          {/* Left Narrative */}
          <div className="hp-journey-copy">
            <div className="hp-journey-badge-row">
              <span className="hp-step-pill">
                {currentStep.num} · {currentStep.title}
              </span>
              <button
                type="button"
                className="hp-clip-play-btn"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? "Pause workflow walkthrough" : "Play workflow walkthrough"}
              >
                {isPlaying && !reducedMotion ? <Pause size={12} /> : <Play size={12} />}
                <span>{isPlaying && !reducedMotion ? "Playing" : "Paused"}</span>
              </button>
            </div>

            <h3>{currentStep.headline}</h3>
            <p>{currentStep.summary}</p>

            <ul className="hp-check-list">
              {currentStep.highlights.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="hp-journey-next-row">
              <button
                type="button"
                className="hp-text-action"
                onClick={() => {
                  const next = STEPS[(activeIndex + 1) % STEPS.length];
                  handleSelectStep(next.id);
                }}
              >
                Next stage: {STEPS[(activeIndex + 1) % STEPS.length].title}{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Right: Animated Video-Style Product Clip */}
          <div
            className="hp-clip-frame"
            role="img"
            aria-label={`Animated Orbitwork UI preview for ${currentStep.title}: ${currentStep.headline}`}
          >
            <div className="hp-clip-topbar">
              <div className="hp-window-dots" aria-hidden="true">
                <span className="hp-dot hp-dot-red" />
                <span className="hp-dot hp-dot-yellow" />
                <span className="hp-dot hp-dot-green" />
              </div>
              <span className="hp-clip-label">{currentStep.clipLabel}</span>
              <span className="hp-clip-rec">
                <span className="hp-rec-dot" />
                UI REEL
              </span>
            </div>

            <div className="hp-clip-canvas" key={activeId}>
              {/* CLIP 01: PLAN */}
              {activeId === "plan" && (
                <div className="hp-clip-scene">
                  <div className="hp-clip-prompt-bar">
                    <Sparkles size={14} className="hp-violet-icon" />
                    <span>
                      Goal: <strong>Launch Self-Serve Customer Onboarding</strong>
                    </span>
                    <span className="hp-chip hp-chip-purple">
                      {subFrame === 0 ? "Analyzing scope…" : "4 tasks drafted"}
                    </span>
                  </div>

                  <div className="hp-clip-stack">
                    {[
                      { title: "1. Design workspace onboarding checklist", est: "2h", tag: "UX", showAt: 0 },
                      { title: "2. Configure Supabase invite token flow", est: "3h", tag: "Auth", showAt: 1 },
                      { title: "3. Add starter project template & docs", est: "2h", tag: "Docs", showAt: 1 },
                      { title: "4. Verify RLS isolation across tenants", est: "4h", tag: "Security", showAt: 2 },
                    ].map((row, i) => (
                      <div
                        key={row.title}
                        className={`hp-clip-task-row ${subFrame >= row.showAt || reducedMotion ? "is-visible" : "is-dim"} ${subFrame === i ? "is-active-pulse" : ""}`}
                      >
                        <CheckCircle2 size={14} className="hp-emerald-icon" />
                        <span className="hp-clip-task-name">{row.title}</span>
                        <span className="hp-chip hp-chip-blue">{row.tag}</span>
                        <span className="hp-clip-est">{row.est}</span>
                      </div>
                    ))}
                  </div>

                  <div className="hp-clip-mini-gantt">
                    <div className="hp-clip-gantt-head">
                      <GanttChart size={13} />
                      <span>Timeline auto-scheduled · 11h total estimate</span>
                    </div>
                    <div className="hp-clip-gantt-bars">
                      <span className="hp-mini-bar hp-bar-emerald" style={{ width: subFrame >= 1 || reducedMotion ? "32%" : "18%" }} />
                      <span className="hp-mini-bar hp-bar-amber" style={{ width: subFrame >= 2 || reducedMotion ? "38%" : "22%" }} />
                      <span className="hp-mini-bar hp-bar-violet" style={{ width: subFrame >= 2 || reducedMotion ? "26%" : "10%" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* CLIP 02: COLLABORATE */}
              {activeId === "collaborate" && (
                <div className="hp-clip-scene hp-clip-split">
                  <div className="hp-clip-doc-card">
                    <div className="hp-clip-subhead">
                      <FileText size={13} className="hp-emerald-icon" />
                      <strong>Living Spec · Onboarding Flow</strong>
                    </div>
                    <p className="hp-clip-doc-line">
                      Invitations use one-time tokens with role validation (Owner, Admin, Member, Viewer).
                    </p>
                    <div className={`hp-clip-link-pill ${subFrame >= 1 || reducedMotion ? "is-highlighted" : ""}`}>
                      <span>Linked Task:</span>
                      <strong>Configure Invite Token Flow →</strong>
                    </div>
                  </div>

                  <div className="hp-clip-chat-card">
                    <div className="hp-clip-subhead">
                      <MessageSquare size={13} className="hp-emerald-icon" />
                      <strong>#project-launch Channel</strong>
                    </div>
                    <div className="hp-chat-bubble">
                      <strong>Maya · Product</strong>
                      <p>Can we also attach the walkthrough PDF to the welcome workspace?</p>
                    </div>
                    <div className={`hp-chat-convert ${subFrame >= 2 || reducedMotion ? "is-converted" : ""}`}>
                      <CheckCircle2 size={13} />
                      <span>
                        {subFrame >= 2 || reducedMotion
                          ? "Converted to Task · Assigned to Dev Team"
                          : "1-Click Convert Message → Tracked Task"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* CLIP 03: EXECUTE */}
              {activeId === "execute" && (
                <div className="hp-clip-scene">
                  <div className="hp-clip-board-mini">
                    <div className="hp-clip-col">
                      <span className="hp-clip-col-title">In Progress</span>
                      <div className={`hp-clip-card ${subFrame === 0 ? "is-moving" : ""}`}>
                        <strong>Invite Token Flow</strong>
                        <span className="hp-timer-chip">
                          <Clock size={10} /> 01:18:42
                        </span>
                      </div>
                    </div>
                    <div className="hp-clip-col">
                      <span className="hp-clip-col-title">In Review</span>
                      <div className={`hp-clip-card ${subFrame >= 1 ? "is-landed" : ""}`}>
                        <strong>RLS Policy Verification</strong>
                        <span className="hp-chip hp-chip-green">Timesheet synced</span>
                      </div>
                    </div>
                  </div>

                  <div className={`hp-clip-agent-toast ${subFrame >= 1 || reducedMotion ? "is-visible" : ""}`}>
                    <div className="hp-agent-badge hp-sat-violet">
                      <Bot size={14} />
                    </div>
                    <div>
                      <strong>AI Agent Executed · On Status Change</strong>
                      <span>
                        {subFrame === 2
                          ? "QA checklist verified (4/4 items) · Effort logged to weekly timesheet"
                          : "Drafted 4 acceptance checks & inherited parent assignee"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* CLIP 04: IMPROVE */}
              {activeId === "improve" && (
                <div className="hp-clip-scene">
                  <div className="hp-clip-brain-header">
                    <div className="hp-agent-badge hp-sat-violet">
                      <Brain size={15} />
                    </div>
                    <div>
                      <strong>Project Brain · Live Diagnostics</strong>
                      <span>Analyzing tasks, dependencies, workload &amp; decisions</span>
                    </div>
                    <span className="hp-chip hp-chip-amber">1 Risk Detected</span>
                  </div>

                  <div className="hp-clip-risk-card">
                    <div className="hp-risk-head">
                      <ShieldAlert size={14} />
                      <strong>Preventive Alert · Dependency Bottleneck</strong>
                    </div>
                    <p>
                      Delaying &ldquo;RLS Policy Verification&rdquo; by 2 days shifts &ldquo;Production Launch&rdquo; and increases backend workload.
                    </p>
                  </div>

                  <div className={`hp-clip-sim-bar ${subFrame >= 1 || reducedMotion ? "is-applied" : ""}`}>
                    <Sparkles size={13} />
                    <span>
                      {subFrame >= 2 || reducedMotion
                        ? "Change Impact Simulated → Recommended reassignment applied & logged to Decision Memory"
                        : "Running Change Impact Simulation across 3 dependent tasks…"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Scrubber Progress Bar */}
            <div className="hp-clip-progress" aria-hidden="true">
              {STEPS.map((s, idx) => (
                <span
                  key={s.id}
                  className={`hp-clip-prog-seg ${idx === activeIndex ? "is-current" : ""} ${idx < activeIndex ? "is-done" : ""}`}
                >
                  <span
                    className={`hp-clip-prog-fill ${idx === activeIndex && isPlaying && !reducedMotion && inView ? "is-animating" : ""}`}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
