"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import type { CustomAIAgent } from "@/lib/ai/agent/custom-agent-types";
import CustomAgentBuilderModal from "./CustomAgentBuilderModal";

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
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);

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
    if (!confirm("Delete this AI Agent?")) return;

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

        <button
          type="button"
          className="ai-hub-btn-new"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={15} />
          <span>Declare New AI Agent</span>
        </button>
      </div>

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
            onClick={() => setModalOpen(true)}
          >
            <Plus size={15} />
            <span>Declare Your First Agent</span>
          </button>
        </div>
      ) : (
        <div className="ai-agents-grid">
          {agents.map((agent) => {
            const isToggling = togglePendingId === agent.id;
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
                  <div className="ai-card-instructions">
                    <span className="ai-instructions-label">Rules:</span>
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
            );
          })}
        </div>
      )}

      {/* Modal to declare new agent */}
      <CustomAgentBuilderModal
        projectId={projectId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAgentCreated={handleAgentCreated}
      />
    </div>
  );
}
