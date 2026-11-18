"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Kanban,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { useInViewport, usePrefersReducedMotion } from "./useMotionPreferences";

type BrainScenarioId = "risk" | "impact" | "agents";

interface BrainScenario {
  id: BrainScenarioId;
  label: string;
  inputHighlight: string;
  outputHighlight: string;
  insightTitle: string;
  insightDetail: string;
  actionBadge: string;
}

const SCENARIOS: BrainScenario[] = [
  {
    id: "risk",
    label: "Preventive Risk Detection",
    inputHighlight: "Tasks + Timeline",
    outputHighlight: "Preventive Alerts",
    insightTitle: "Blocked Critical-Path Dependency Detected",
    insightDetail:
      "Project Brain cross-checks task due dates, dependency chains, and assignee workload to flag bottlenecks early—with one-click actionable recommendations.",
    actionBadge: "Preventive Analysis · Batch Apply Ready",
  },
  {
    id: "impact",
    label: "Change Impact Simulation",
    inputHighlight: "Timeline + Workload",
    outputHighlight: "Impact Simulator",
    insightTitle: "Preview Schedule & Capacity Ripple Effects",
    insightDetail:
      "Before moving a release deadline or reassigning a key task, simulate the exact downstream impact on linked tasks, milestones, and team capacity.",
    actionBadge: "What-If Simulation · Zero Guesswork",
  },
  {
    id: "agents",
    label: "Autonomous AI Agents & Planner",
    inputHighlight: "Docs + Channels",
    outputHighlight: "AI Agents Hub",
    insightTitle: "Context-Aware Decomposition & Automated Execution",
    insightDetail:
      "AI Subtask Planner, Description Polish, and Custom AI Agents use live project specs and decision history to generate checklists, estimates, and next steps.",
    actionBadge: "Triggered on Create / Status Change / Manual",
  },
];

export function ProjectBrainFlow() {
  const reducedMotion = usePrefersReducedMotion();
  const { ref: sectionRef, inView } = useInViewport<HTMLElement>("120px");
  const [scenarioId, setScenarioId] = useState<BrainScenarioId>("risk");

  const active = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const animateFlow = inView && !reducedMotion;

  return (
    <section
      ref={sectionRef}
      className="hp-section hp-brain-section"
      id="ai-project-brain"
      aria-labelledby="brain-heading"
    >
      <div className="hp-container">
        <div className="hp-section-header hp-header-on-dark">
          <span className="hp-section-tag hp-tag-violet-dark">
            <Sparkles size={13} aria-hidden="true" /> AI + Project Brain
          </span>
          <h2 className="hp-section-title" id="brain-heading">
            AI that understands your entire project—not just isolated prompts
          </h2>
          <p className="hp-section-desc">
            Because tasks, docs, timelines, channels, and decisions live in one workspace, Orbitwork&apos;s Project Brain turns real operational signals into preventive insights and automated team assistance.
          </p>
        </div>

        {/* Interactive Scenario Switcher */}
        <div className="hp-brain-scenarios" role="tablist" aria-label="Project Brain scenarios">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={sc.id === scenarioId}
              onClick={() => setScenarioId(sc.id)}
              className={`hp-brain-sc-btn ${sc.id === scenarioId ? "is-active" : ""}`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Animated Data-Flow Architecture Diagram */}
        <div
          className={`hp-flow-stage ${animateFlow ? "is-flowing" : ""}`}
          role="img"
          aria-label="Animated data flow diagram showing Tasks, Living Docs, Timeline and Workload, and Channels and Decisions flowing into Orbitwork Project Brain, producing Preventive Risk Detection, Change Impact Simulation, Autonomous AI Agents, and Context-Aware AI Assistant outputs"
        >
          {/* Left Column: Real Workspace Signals */}
          <div className="hp-flow-col hp-flow-inputs">
            <div className="hp-flow-col-label">LIVE PROJECT SIGNALS</div>
            <div className={`hp-flow-node ${scenarioId === "risk" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-emerald"><Kanban size={15} /></span>
              <div>
                <strong>Tasks &amp; Subtasks</strong>
                <span>Statuses, estimates, checklists</span>
              </div>
            </div>
            <div className={`hp-flow-node ${scenarioId === "agents" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-sky"><FileText size={15} /></span>
              <div>
                <strong>Living Docs &amp; Specs</strong>
                <span>PRDs, meeting notes, versions</span>
              </div>
            </div>
            <div className={`hp-flow-node ${scenarioId === "impact" || scenarioId === "risk" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-amber"><Clock size={15} /></span>
              <div>
                <strong>Timeline &amp; Workload</strong>
                <span>Dependencies, timers, leave</span>
              </div>
            </div>
            <div className={`hp-flow-node ${scenarioId === "agents" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-violet"><MessageSquare size={15} /></span>
              <div>
                <strong>Channels &amp; Decisions</strong>
                <span>Team threads &amp; Decision Memory</span>
              </div>
            </div>
          </div>

          {/* Left-to-Center SVG Animated Flow Connectors */}
          <svg
            className="hp-flow-svg"
            viewBox="0 0 120 320"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="owFlowIn" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1ca878" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            {[40, 120, 200, 280].map((y, idx) => (
              <g key={y}>
                <path
                  d={`M 0 ${y} C 60 ${y}, 60 160, 120 160`}
                  fill="none"
                  stroke="rgba(167, 139, 250, 0.22)"
                  strokeWidth="2"
                />
                <path
                  d={`M 0 ${y} C 60 ${y}, 60 160, 120 160`}
                  fill="none"
                  stroke="url(#owFlowIn)"
                  strokeWidth="2.5"
                  strokeDasharray="8 14"
                  className="hp-flow-dash"
                  style={{ animationDelay: `${idx * 0.35}s` }}
                />
              </g>
            ))}
          </svg>

          {/* Center Core: Orbitwork Project Brain */}
          <div className="hp-flow-core">
            <div className="hp-core-ring hp-ring-outer" aria-hidden="true" />
            <div className="hp-core-ring hp-ring-inner" aria-hidden="true" />
            <div className="hp-core-orb">
              <Brain size={30} />
            </div>
            <div className="hp-core-label">
              <strong>Project Brain</strong>
              <span>Unified Context Graph</span>
            </div>
            <div className="hp-core-tags">
              <span>Health</span>
              <span>Why</span>
              <span>Impact</span>
              <span>Memory</span>
            </div>
          </div>

          {/* Center-to-Right SVG Animated Flow Connectors */}
          <svg
            className="hp-flow-svg"
            viewBox="0 0 120 320"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="owFlowOut" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#1ca878" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {[40, 120, 200, 280].map((y, idx) => (
              <g key={y}>
                <path
                  d={`M 0 160 C 60 160, 60 ${y}, 120 ${y}`}
                  fill="none"
                  stroke="rgba(28, 168, 120, 0.22)"
                  strokeWidth="2"
                />
                <path
                  d={`M 0 160 C 60 160, 60 ${y}, 120 ${y}`}
                  fill="none"
                  stroke="url(#owFlowOut)"
                  strokeWidth="2.5"
                  strokeDasharray="8 14"
                  className="hp-flow-dash"
                  style={{ animationDelay: `${idx * 0.35 + 0.2}s` }}
                />
              </g>
            ))}
          </svg>

          {/* Right Column: Actionable AI Outputs */}
          <div className="hp-flow-col hp-flow-outputs">
            <div className="hp-flow-col-label">ACTIONABLE INTELLIGENCE</div>
            <div className={`hp-flow-node ${scenarioId === "risk" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-amber"><ShieldAlert size={15} /></span>
              <div>
                <strong>Risk &amp; Blocker Detection</strong>
                <span>Preventive alerts &amp; root causes</span>
              </div>
            </div>
            <div className={`hp-flow-node ${scenarioId === "impact" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-violet"><GitBranch size={15} /></span>
              <div>
                <strong>Change Impact Simulator</strong>
                <span>Deadline &amp; assignee what-if checks</span>
              </div>
            </div>
            <div className={`hp-flow-node ${scenarioId === "agents" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-emerald"><Bot size={15} /></span>
              <div>
                <strong>Autonomous AI Agents</strong>
                <span>Checklists, estimates &amp; routing</span>
              </div>
            </div>
            <div className={`hp-flow-node ${scenarioId === "agents" ? "is-lit" : ""}`}>
              <span className="hp-node-icon hp-ni-sky"><Sparkles size={15} /></span>
              <div>
                <strong>AI Assistant &amp; Planner</strong>
                <span>Live Q&amp;A, briefs &amp; task generation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Output Inspector Card */}
        <div className="hp-brain-inspector" key={active.id}>
          <div className="hp-inspector-meta">
            <span className="hp-inspector-pill">
              <Zap size={12} /> {active.inputHighlight} → Project Brain → {active.outputHighlight}
            </span>
            <span className="hp-inspector-badge">{active.actionBadge}</span>
          </div>
          <div className="hp-inspector-body">
            <div>
              <h3>{active.insightTitle}</h3>
              <p>{active.insightDetail}</p>
            </div>
            <div className="hp-inspector-checks">
              <span><CheckCircle2 size={14} /> Grounded in your live workspace data</span>
              <span><AlertTriangle size={14} /> Human-in-the-loop review before applying</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
