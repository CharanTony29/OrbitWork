"use client";

import React, { useState, useEffect } from "react";
import { showAppConfirm } from "@/lib/app-feedback";
import {
  Bot,
  Zap,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  Power,
  Play,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Pencil,
  AlertCircle,
  X,
} from "lucide-react";
import type { CustomAIAgent } from "@/lib/ai/agent/custom-agent-types";
import CustomAgentBuilderModal from "./CustomAgentBuilderModal";
import { triggerAIAgentRun } from "@/lib/ai/agent/background-runner";

interface ProjectAIAgentsHubProps {
  projectId: string;
  projectName?: string;
  initialAgents?: CustomAIAgent[];
}

const TRIGGER_LABELS: Record<string, string> = {
  on_subtask_created: "🔄 On Subtask Created",
  on_task_created: "➕ On Task Created",
  on_status_change: "🏷️ On Status Change",
  manual: "⚡ Manual / On Demand",
};

const ACTION_LABELS: Record<string, string> = {
  auto_assign_parent: "👤 Inherit Parent Assignee",
  generate_checklist: "📋 Generate Acceptance Checklist",
  estimate_time: "⏱️ Estimate Effort & Priority",
  custom_agent: "🤖 Custom Action",
};

export default function ProjectAIAgentsHub({
  projectId,
  projectName = "Project",
  initialAgents = [],
}: ProjectAIAgentsHubProps) {
  const [agents, setAgents] = useState<CustomAIAgent[]>(initialAgents);
  const [isLoading, setIsLoading] = useState(initialAgents.length === 0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CustomAIAgent | null>(null);
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runFeedback, setRunFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [backgroundJobs, setBackgroundJobs] = useState<Array<{ id: string; title: string; startedAt: Date }>>([]);
  const [completionPopup, setCompletionPopup] = useState<{
    title: string;
    summary: string;
    processedCount: number;
    type: "success" | "error";
  } | null>(null);

  // Auto-dismiss popup after 9 seconds
  useEffect(() => {
    if (!completionPopup) return;
    const timer = setTimeout(() => {
      setCompletionPopup(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [completionPopup]);

  // Fetch agents on mount if not preloaded
  useEffect(() => {
    let isMounted = true;
    async function loadAgents() {
      try {
        const res = await fetch(`/api/ai/agent/custom?projectId=${projectId}`);
        const data = await res.json();
        if (isMounted && data.agents) {
          setAgents(data.agents);
        }
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadAgents();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    const handleUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ agentId?: string; processedCount?: number }>;
      const targetAgentId = custom.detail?.agentId;
      setAgents((prev) =>
        prev.map((a) => {
          if (!targetAgentId || a.id === targetAgentId) {
            return {
              ...a,
              runs_count: (a.runs_count || 0) + (custom.detail?.processedCount || 1),
              last_run_at: new Date().toISOString(),
            };
          }
          return a;
        })
      );
    };

    window.addEventListener("orbitwork:tasks-updated", handleUpdated);
    return () => window.removeEventListener("orbitwork:tasks-updated", handleUpdated);
  }, []);

  const handleToggle = async (agent: CustomAIAgent) => {
    setTogglePendingId(agent.id);
    const nextState = !agent.enabled;

    try {
      const res = await fetch("/api/ai/agent/custom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, enabled: nextState }),
      });
      const data = await res.json();
      if (data.agent) {
        setAgents((prev) =>
          prev.map((a) => (a.id === agent.id ? { ...a, enabled: nextState } : a))
        );
      }
    } catch (err) {
      console.error("Failed to toggle agent:", err);
    } finally {
      setTogglePendingId(null);
    }
  };

  const handleDelete = async (agentId: string) => {
    const confirmed = await showAppConfirm({
      title: "Delete AI Agent",
      message: "Are you sure you want to delete this AI Agent?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await fetch(`/api/ai/agent/custom?agentId=${agentId}`, {
        method: "DELETE",
      });
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  const handleAgentCreated = (newAgent: CustomAIAgent) => {
    setAgents((prev) => [newAgent, ...prev]);
  };

  const handleAgentUpdated = (updatedAgent: CustomAIAgent) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === updatedAgent.id ? updatedAgent : a))
    );
  };

  const handleRunOnProject = (agent: CustomAIAgent) => {
    setRunningAgentId(agent.id);
    setRunFeedback({
      type: "success",
      text: `AI Agent "${agent.name}" is now executing in the background. You can freely switch to List or any other view! Confirmation will appear at the bottom right.`,
    });

    triggerAIAgentRun({
      projectId,
      agentId: agent.id,
      agentName: agent.name,
      runAllTasks: true,
    }).finally(() => {
      setRunningAgentId(null);
    });
  };

  const handleRunAllOnProject = () => {
    if (activeCount === 0) {
      setRunFeedback({
        type: "error",
        text: "No active agents enabled to run. Enable at least one agent first.",
      });
      return;
    }

    setIsRunningAll(true);
    setRunFeedback({
      type: "success",
      text: `Running all ${activeCount} active AI agents in the background. You can freely navigate away! Confirmation will appear at the bottom right.`,
    });

    triggerAIAgentRun({
      projectId,
      agentName: "All Active Automations",
      runAllAgents: true,
    }).finally(() => {
      setIsRunningAll(false);
    });
  };

  const activeCount = agents.filter((a) => a.enabled).length;

  return (
    <div className="ai-agents-hub-wrap">
      {/* Top Banner / Header */}
      <div className="ai-hub-header">
        <div className="ai-hub-header-left">
          <div className="ai-hub-icon-badge">
            <Zap size={20} />
          </div>
          <div>
            <div className="ai-hub-title">
              <h2>Autonomous AI Agents & Automations</h2>
              <span className="ai-hub-count-pill">
                {activeCount} Active / {agents.length} Total
              </span>
            </div>
            <p className="ai-hub-subtitle">
              Declare custom agents that execute actions automatically when events occur in {projectName}.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {agents.length > 0 && (
            <button
              type="button"
              onClick={handleRunAllOnProject}
              disabled={isRunningAll || activeCount === 0}
              title="Run all enabled agents across all tasks in this project to update existing data"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 16px",
                borderRadius: "8px",
                background: "#0f172a",
                color: "#ffffff",
                border: "0",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: activeCount === 0 || isRunningAll ? "not-allowed" : "pointer",
                opacity: activeCount === 0 ? 0.6 : 1,
                boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
                transition: "all 0.15s ease",
              }}
            >
              {isRunningAll ? <Loader2 size={14} className="spin" /> : <Play size={13} fill="currentColor" />}
              <span>{isRunningAll ? "Running across project…" : "Run All on Project"}</span>
            </button>
          )}

          <button
            type="button"
            className="ai-hub-btn-new"
            onClick={() => {
              setEditingAgent(null);
              setModalOpen(true);
            }}
          >
            <Plus size={15} />
            <span>Declare New AI Agent</span>
          </button>
        </div>
      </div>

      {/* Instructional helper card explaining how to run complete project */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "12px 18px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #e7ebe7)",
          borderRadius: "8px",
          margin: "14px 0 6px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <Sparkles size={18} style={{ color: "#7c3aed", flexShrink: 0, marginTop: "2px" }} />
        <div style={{ fontSize: "12.5px", color: "var(--ink, #17231f)", lineHeight: 1.5 }}>
          <strong>Running Project Automations:</strong> Active agents automatically execute when events happen (such as creating a task or subtask). To update <em>existing/past tasks</em> right now, click <strong>"Run All on Project"</strong> above or <strong>"Run on Project"</strong> on any individual agent card below.
        </div>
      </div>

      {/* Run Feedback Banner */}
      {runFeedback && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            margin: "10px 0",
            background: runFeedback.type === "success" ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)",
            color: runFeedback.type === "success" ? "#15803d" : "#b91c1c",
            border: `1px solid ${runFeedback.type === "success" ? "rgba(22, 163, 74, 0.3)" : "rgba(220, 38, 38, 0.3)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {runFeedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{runFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setRunFeedback(null)}
            style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="ai-hub-loading">
          <Loader2 size={24} className="spin text-emerald-600" />
          <span>Loading declared agents…</span>
        </div>
      ) : agents.length === 0 ? (
        <div className="ai-hub-empty">
          <div className="ai-hub-empty-icon">
            <Bot size={36} />
          </div>
          <h3>No AI Agents Declared Yet</h3>
          <p>
            Declare autonomous agents to automate assigning subtasks to parents, generating acceptance criteria, or estimating task effort.
          </p>
          <button
            type="button"
            className="ai-hub-btn-new"
            onClick={() => {
              setEditingAgent(null);
              setModalOpen(true);
            }}
          >
            <Plus size={15} />
            <span>Declare Your First Agent</span>
          </button>
        </div>
      ) : (
        <div className="ai-agents-grid">
          {agents.map((agent) => {
            const isToggling = togglePendingId === agent.id;
            const isRunningThis = runningAgentId === agent.id;
            return (
              <div
                key={agent.id}
                className={`ai-agent-item-card ${agent.enabled ? "is-enabled" : "is-disabled"}`}
              >
                <div className="ai-card-header">
                  <div className="ai-card-title-group">
                    <div className="ai-card-icon">
                      <Bot size={16} />
                    </div>
                    <div>
                      <h4 className="ai-card-name">{agent.name}</h4>
                      <div className="ai-card-badges">
                        <span className="ai-card-pill is-trigger">
                          {TRIGGER_LABELS[agent.trigger_type] || agent.trigger_type}
                        </span>
                        <span className="ai-card-pill is-action">
                          {ACTION_LABELS[agent.action_type] || agent.action_type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ai-card-toggle">
                    <button
                      type="button"
                      className={`ai-toggle-switch ${agent.enabled ? "is-on" : ""}`}
                      onClick={() => handleToggle(agent)}
                      disabled={isToggling}
                      title={agent.enabled ? "Click to disable agent" : "Click to enable agent"}
                    >
                      <span className="ai-toggle-slider" />
                    </button>
                  </div>
                </div>

                {agent.system_instructions && (
                  <div
                    className="ai-card-instructions"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setEditingAgent(agent);
                      setModalOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditingAgent(agent);
                        setModalOpen(true);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                    title="Click to modify this agent's rules & instructions"
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span className="ai-instructions-label">Rules:</span>
                      <span style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <Pencil size={10} /> Edit
                      </span>
                    </div>
                    <p>{agent.system_instructions}</p>
                  </div>
                )}

                <div className="ai-card-footer">
                  <div className="ai-card-stats">
                    <span>
                      Ran <strong>{agent.runs_count || 0}</strong> time
                      {agent.runs_count === 1 ? "" : "s"}
                    </span>
                    {agent.last_run_at && (
                      <span className="ai-card-last-run">
                        &bull; Last run {new Date(agent.last_run_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      className="ai-card-btn-run"
                      onClick={() => handleRunOnProject(agent)}
                      disabled={isRunningThis || isRunningAll}
                      title="Run this agent across project tasks now to update existing data"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "5px 10px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#15803d",
                        background: "rgba(22, 163, 74, 0.1)",
                        border: "1px solid rgba(22, 163, 74, 0.3)",
                        borderRadius: "6px",
                        cursor: isRunningThis || isRunningAll ? "not-allowed" : "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isRunningThis ? (
                        <Loader2 size={11} className="spin" />
                      ) : (
                        <Play size={10} fill="currentColor" />
                      )}
                      <span>{isRunningThis ? "Running…" : "Run on Project"}</span>
                    </button>

                    <button
                      type="button"
                      className="ai-card-btn-edit"
                      onClick={() => {
                        setEditingAgent(agent);
                        setModalOpen(true);
                      }}
                      title="Modify Agent Rules & Instructions"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "5px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "#7c3aed",
                        background: "rgba(139, 92, 246, 0.08)",
                        border: "1px solid rgba(139, 92, 246, 0.22)",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Pencil size={11} />
                      <span>Modify Rule</span>
                    </button>

                    <button
                      type="button"
                      className="ai-card-btn-delete"
                      onClick={() => handleDelete(agent.id)}
                      title="Delete Agent"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Background Task Indicator */}
      {backgroundJobs.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.38), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            border: "1px solid rgba(139, 92, 246, 0.45)",
            maxWidth: "380px",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(139, 92, 246, 0.25)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Loader2 size={16} className="spin" style={{ color: "#a78bfa" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#e0e7ff" }}>
              AI Agent Running in Background
            </div>
            <div style={{ fontSize: "11px", color: "#c7d2fe", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {backgroundJobs[0]?.title}
            </div>
            <div style={{ fontSize: "10px", color: "#a5b4fc", marginTop: "2px" }}>
              You can continue working freely without waiting.
            </div>
          </div>
        </div>
      )}

      {/* Floating Completion Pop-up Modal */}
      {completionPopup && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 10000,
            background: "var(--surface, #ffffff)",
            color: "var(--ink, #0f172a)",
            padding: "18px 20px",
            borderRadius: "14px",
            border: completionPopup.type === "success" ? "2px solid #22c55e" : "2px solid #ef4444",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
            maxWidth: "420px",
            width: "calc(100vw - 48px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: completionPopup.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: completionPopup.type === "success" ? "#16a34a" : "#dc2626",
              }}
            >
              {completionPopup.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <strong style={{ fontSize: "14px", fontWeight: 800 }}>
                  {completionPopup.title}
                </strong>
                <button
                  type="button"
                  onClick={() => setCompletionPopup(null)}
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    padding: 2,
                    color: "var(--muted, #64748b)",
                  }}
                  title="Close notification"
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ margin: "6px 0 12px", fontSize: "12.5px", color: "var(--ink, #334155)", lineHeight: 1.5 }}>
                {completionPopup.summary}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCompletionPopup(null);
                    window.location.reload();
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    background: "var(--green, #167c58)",
                    color: "#ffffff",
                    border: 0,
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Refresh Tasks
                </button>
                <button
                  type="button"
                  onClick={() => setCompletionPopup(null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    background: "var(--line, #e2e8f0)",
                    color: "var(--ink, #334155)",
                    border: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal to declare or edit agent */}
      <CustomAgentBuilderModal
        projectId={projectId}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAgent(null);
        }}
        onAgentCreated={handleAgentCreated}
        agentToEdit={editingAgent}
        onAgentUpdated={handleAgentUpdated}
      />
    </div>
  );
}
