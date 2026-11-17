"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Loader2,
  CheckSquare,
  Square,
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Copy,
  Check,
  Bot,
  Play,
  ExternalLink,
} from "lucide-react";
import type { SuggestedSubtask } from "@/lib/ai/agent/planner";
import type { CustomAIAgent } from "@/lib/ai/agent/custom-agent-types";
import { markdownToSafeHtml } from "@/lib/markdown";

interface AIAgentSubtaskPlannerProps {
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  parentAssigneeName?: string;
  canEdit?: boolean;
}

export default function AIAgentSubtaskPlanner({
  projectId,
  taskId,
  taskTitle,
  taskDescription,
  parentAssigneeName,
  canEdit = true,
}: AIAgentSubtaskPlannerProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"subtasks" | "diagnose" | "custom">("subtasks");
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<SuggestedSubtask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Diagnose state
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [copiedDiagnosis, setCopiedDiagnosis] = useState(false);

  // Custom Agents state
  const [customAgents, setCustomAgents] = useState<CustomAIAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [agentRunResult, setAgentRunResult] = useState<string | null>(null);

  const fetchCustomAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch(`/api/ai/agent/custom?projectId=${projectId}`);
      const data = await res.json();
      if (data.agents) {
        setCustomAgents(data.agents);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleRunCustomAgent = async (agentId: string) => {
    setRunningAgentId(agentId);
    setError(null);
    setAgentRunResult(null);

    try {
      const res = await fetch("/api/ai/agent/custom/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          taskId,
          projectId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent execution failed");

      setAgentRunResult(data.summary || "Agent executed successfully!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Agent failed to run");
    } finally {
      setRunningAgentId(null);
    }
  };

  if (!canEdit) return null;

  const handleGeneratePlan = async () => {
    setIsPlanning(true);
    setError(null);
    setSuccessCount(null);
    setIsOpen(true);

    try {
      const res = await fetch("/api/ai/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle,
          taskDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");

      setSummary(data.plan.summary);
      setSubtasks(data.plan.subtasks);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Planning failed");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleDiagnoseTask = async () => {
    setIsDiagnosing(true);
    setError(null);
    setIsOpen(true);

    try {
      const res = await fetch("/api/ai/agent/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle,
          taskDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to diagnose task");

      setDiagnosis(data.analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Diagnosis failed");
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleExecutePlan = async () => {
    const selected = subtasks.filter((s) => s.selected);
    if (selected.length === 0) {
      setError("Please select at least one subtask to create.");
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          parentTaskId: taskId,
          autoAssignToParent: autoAssign,
          subtasks: selected.map((s) => ({
            title: s.title,
            description: s.description,
            estimateMinutes: s.estimateMinutes,
            priority: s.priority,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute plan");

      setSuccessCount(data.createdCount);
      setSubtasks([]);
      setSummary(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyDiagnosis = () => {
    if (diagnosis) {
      navigator.clipboard.writeText(diagnosis);
      setCopiedDiagnosis(true);
      setTimeout(() => setCopiedDiagnosis(false), 2000);
    }
  };

  const selectedCount = subtasks.filter((s) => s.selected).length;

  return (
    <div className="ai-agent-card">
      <div
        className="ai-agent-header"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <div className="ai-agent-header-info">
          <div className="ai-agent-icon-badge">
            <Zap size={15} />
          </div>
          <div>
            <div className="ai-agent-title">
              <span>AI Task Agent</span>
              <span className="ai-agent-pill">Autonomous</span>
            </div>
            <div className="ai-agent-desc">
              Decompose subtasks, auto-assign & brainstorm technical solutions
            </div>
          </div>
        </div>

        <button
          type="button"
          className="ai-agent-toggle-btn"
          aria-label={isOpen ? "Collapse AI Agent" : "Expand AI Agent"}
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isOpen && (
        <div className="ai-agent-content">
          {/* Agent Capability Tabs */}
          <div className="ai-agent-tabs">
            <button
              type="button"
              className={`ai-agent-tab ${activeTab === "subtasks" ? "is-active" : ""}`}
              onClick={() => setActiveTab("subtasks")}
            >
              <Zap size={13} />
              <span>Auto-Plan Subtasks</span>
            </button>
            <button
              type="button"
              className={`ai-agent-tab ${activeTab === "diagnose" ? "is-active" : ""}`}
              onClick={() => setActiveTab("diagnose")}
            >
              <Lightbulb size={13} />
              <span>Diagnose & Solution Ideas</span>
            </button>
            <button
              type="button"
              className={`ai-agent-tab ${activeTab === "custom" ? "is-active" : ""}`}
              onClick={() => {
                setActiveTab("custom");
                if (customAgents.length === 0) {
                  void fetchCustomAgents();
                }
              }}
            >
              <Bot size={13} />
              <span>Custom Agents & Automations</span>
            </button>
          </div>

          {error && (
            <div className="ai-agent-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: SUBTASK PLANNER */}
          {activeTab === "subtasks" && (
            <>
              {successCount !== null && (
                <div className="ai-agent-success" role="status">
                  <CheckCircle2 size={16} />
                  <span>
                    Successfully created <strong>{successCount}</strong> subtask
                    {successCount === 1 ? "" : "s"}!
                    {autoAssign && parentAssigneeName
                      ? ` Assigned to ${parentAssigneeName}.`
                      : ""}
                  </span>
                </div>
              )}

              {subtasks.length === 0 && !isPlanning && (
                <div className="ai-agent-actions-row">
                  <button
                    type="button"
                    className="ai-agent-btn-primary"
                    onClick={handleGeneratePlan}
                    disabled={isPlanning}
                  >
                    <Zap size={14} />
                    <span>Auto-Plan Subtasks with AI Agent</span>
                  </button>

                  <label className="ai-agent-checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoAssign}
                      onChange={(e) => setAutoAssign(e.target.checked)}
                    />
                    <UserCheck size={14} className="text-emerald-600" />
                    <span>
                      Auto-assign created subtasks to parent assignee
                      {parentAssigneeName ? ` (${parentAssigneeName})` : ""}
                    </span>
                  </label>
                </div>
              )}

              {isPlanning && (
                <div className="ai-agent-loading-state">
                  <Loader2 size={18} className="spin text-emerald-600" />
                  <span>Agent analyzing task scope and generating optimal breakdown…</span>
                </div>
              )}

              {subtasks.length > 0 && (
                <div className="ai-agent-plan-preview">
                  {summary && <div className="ai-plan-summary">💡 {summary}</div>}

                  <div className="ai-subtasks-list">
                    {subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className={`ai-subtask-item ${sub.selected ? "is-selected" : ""}`}
                        role="checkbox"
                        aria-checked={sub.selected}
                        tabIndex={0}
                        onClick={() => handleToggleSubtask(sub.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleToggleSubtask(sub.id);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="ai-subtask-check"
                          aria-label="Toggle subtask"
                        >
                          {sub.selected ? (
                            <CheckSquare size={16} className="text-emerald-600" />
                          ) : (
                            <Square size={16} className="text-slate-400" />
                          )}
                        </button>

                        <div className="ai-subtask-details">
                          <div className="ai-subtask-title">{sub.title}</div>
                          {sub.description && (
                            <div className="ai-subtask-desc">{sub.description}</div>
                          )}
                        </div>

                        <div className="ai-subtask-badges">
                          <span className="ai-badge-time">
                            <Clock size={11} />
                            {sub.estimateMinutes}m
                          </span>
                          <span className={`ai-badge-priority is-${sub.priority}`}>
                            {sub.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="ai-plan-footer">
                    <label className="ai-agent-checkbox-label">
                      <input
                        type="checkbox"
                        checked={autoAssign}
                        onChange={(e) => setAutoAssign(e.target.checked)}
                      />
                      <span>Auto-assign to parent assignee</span>
                    </label>

                    <div className="ai-plan-footer-buttons">
                      <button
                        type="button"
                        className="ai-btn-discard"
                        onClick={() => {
                          setSubtasks([]);
                          setSummary(null);
                        }}
                        disabled={isExecuting}
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        className="ai-btn-execute"
                        onClick={handleExecutePlan}
                        disabled={isExecuting || selectedCount === 0}
                      >
                        {isExecuting ? (
                          <>
                            <Loader2 size={14} className="spin" />
                            <span>Creating {selectedCount} subtasks…</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} />
                            <span>Execute & Create {selectedCount} Subtasks</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: DIAGNOSE & BRAINSTORM */}
          {activeTab === "diagnose" && (
            <div className="ai-agent-diagnose-panel">
              {!diagnosis && !isDiagnosing && (
                <div className="ai-agent-actions-row">
                  <button
                    type="button"
                    className="ai-agent-btn-primary"
                    onClick={handleDiagnoseTask}
                    disabled={isDiagnosing}
                  >
                    <Lightbulb size={14} />
                    <span>Diagnose Scope & Brainstorm Solution</span>
                  </button>
                  <p className="ai-agent-hint">
                    Get an architect-level resolution plan, test acceptance criteria, and edge-case warnings for this task.
                  </p>
                </div>
              )}

              {isDiagnosing && (
                <div className="ai-agent-loading-state">
                  <Loader2 size={18} className="spin text-emerald-600" />
                  <span>Agent analyzing architecture, root causes, and resolution steps…</span>
                </div>
              )}

              {diagnosis && (
                <div className="ai-diagnose-results">
                  <div className="ai-diagnose-header">
                    <span>💡 Technical Strategy & Resolution Steps</span>
                    <button
                      type="button"
                      className="ai-diagnose-copy-btn"
                      onClick={handleCopyDiagnosis}
                      title="Copy Solution"
                    >
                      {copiedDiagnosis ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedDiagnosis ? "Copied!" : "Copy Plan"}</span>
                    </button>
                  </div>

                  <div
                    className="ai-diagnose-body doc-markdown-body"
                    dangerouslySetInnerHTML={{
                      __html: markdownToSafeHtml(diagnosis),
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM AUTOMATION AGENTS */}
          {activeTab === "custom" && (
            <div className="ai-custom-agents-tab" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {agentRunResult && (
                <div className="ai-agent-success" role="status">
                  <CheckCircle2 size={16} />
                  <span>{agentRunResult}</span>
                </div>
              )}

              {loadingAgents && (
                <div className="ai-agent-loading-state">
                  <Loader2 size={18} className="spin text-purple-600" />
                  <span>Loading declared AI automation agents…</span>
                </div>
              )}

              {!loadingAgents && customAgents.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 14px",
                    background: "rgba(139, 92, 246, 0.04)",
                    borderRadius: "8px",
                    border: "1px dashed rgba(139, 92, 246, 0.25)",
                  }}
                >
                  <Bot size={26} style={{ color: "#8b5cf6", margin: "0 auto 8px" }} />
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--ink, #1e293b)", marginBottom: "4px" }}>
                    No Custom Agents Configured Yet
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--muted, #64748b)", marginBottom: "12px", maxWidth: "360px", margin: "0 auto 12px", lineHeight: "1.5" }}>
                    Declare autonomous AI agents inside your project to auto-inherit parent assignees on subtask creation, generate acceptance checklists, or run custom prompts.
                  </div>
                  <a
                    href={`/projects/${projectId}?view=agents`}
                    className="ai-agent-btn-primary"
                    style={{ textDecoration: "none", display: "inline-flex" }}
                  >
                    <Zap size={13} />
                    <span>Open AI Agents Hub</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {!loadingAgents && customAgents.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", background: "rgba(139, 92, 246, 0.05)", padding: "7px 11px", borderRadius: "6px", border: "1px solid rgba(139, 92, 246, 0.15)", lineHeight: "1.4" }}>
                    💡 <strong>Automations run automatically!</strong> Enabled agents fire autonomously when their trigger event happens (e.g. creating a task). You can also run them anytime on-demand below.
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Active Agents for this project
                    </span>
                    <a
                      href={`/projects/${projectId}?view=agents`}
                      style={{ fontSize: "11px", color: "#7c3aed", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}
                    >
                      <span>Manage All</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  {customAgents.map((agent) => {
                    const triggerLabel =
                      agent.trigger_type === "on_task_created"
                        ? "⚡ Auto: On Task Created"
                        : agent.trigger_type === "on_subtask_created"
                        ? "🔄 Auto: On Subtask Created"
                        : agent.trigger_type === "on_status_change"
                        ? "🏷️ Auto: On Status Change"
                        : "⚡ Manual / On Demand";

                    return (
                      <div
                        key={agent.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: "1px solid var(--line, #e2e8f0)",
                          background: agent.enabled ? "var(--surface, #ffffff)" : "rgba(0,0,0,0.02)",
                          opacity: agent.enabled ? 1 : 0.65,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <Bot size={14} style={{ color: "#7c3aed" }} />
                            <strong style={{ fontSize: "12.5px", color: "var(--ink, #1e293b)" }}>
                              {agent.name}
                            </strong>
                            <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(139, 92, 246, 0.1)", color: "#7c3aed", fontWeight: 600 }}>
                              {triggerLabel}
                            </span>
                            {!agent.enabled && (
                              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "#f1f5f9", color: "#64748b" }}>
                                Disabled
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                            {agent.description || "Custom task automation agent"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="ai-agent-btn-primary"
                          style={{ padding: "6px 12px", fontSize: "11.5px", flexShrink: 0 }}
                          disabled={runningAgentId === agent.id || !agent.enabled}
                          onClick={() => handleRunCustomAgent(agent.id)}
                          title={agent.enabled ? "Execute this agent now on this task" : "Enable agent in Project Settings first"}
                        >
                          {runningAgentId === agent.id ? (
                            <>
                              <Loader2 size={12} className="spin" />
                              <span>Running…</span>
                            </>
                          ) : (
                            <>
                              <Play size={12} />
                              <span>Run on Task</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
