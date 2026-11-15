"use client";

import React, { useState } from "react";
import {
  X,
  Zap,
  Sparkles,
  Bot,
  UserCheck,
  CheckSquare,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  AGENT_TEMPLATES,
  type AgentTriggerType,
  type AgentActionType,
  type CustomAIAgent,
} from "@/lib/ai/agent/custom-agent-types";

interface CustomAgentBuilderModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onAgentCreated: (agent: CustomAIAgent) => void;
}

export default function CustomAgentBuilderModal({
  projectId,
  isOpen,
  onClose,
  onAgentCreated,
}: CustomAgentBuilderModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<AgentTriggerType>("on_subtask_created");
  const [actionType, setActionType] = useState<AgentActionType>("auto_assign_parent");
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: (typeof AGENT_TEMPLATES)[0]) => {
    setName(tmpl.name);
    setDescription(tmpl.description);
    setTriggerType(tmpl.trigger_type);
    setActionType(tmpl.action_type);
    setInstructions(tmpl.system_instructions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a name for your AI Agent.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/agent/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          description: description.trim(),
          trigger_type: triggerType,
          action_type: actionType,
          system_instructions: instructions.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent");

      onAgentCreated(data.agent);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to declare agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <div className="ai-modal-title-group">
            <div className="ai-modal-badge-icon">
              <Bot size={18} />
            </div>
            <div>
              <h3>Declare New AI Agent</h3>
              <p>Configure autonomous task actions and trigger rules</p>
            </div>
          </div>
          <button type="button" className="ai-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="ai-modal-body">
          {error && (
            <div className="ai-agent-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Preset Templates */}
          <div className="ai-template-section">
            <label className="ai-form-label">Quick Start Templates</label>
            <div className="ai-template-grid">
              {AGENT_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  className="ai-template-card"
                  onClick={() => handleApplyTemplate(tmpl)}
                >
                  <div className="ai-template-top">
                    <span className="ai-template-name">{tmpl.name}</span>
                    <ArrowRight size={13} className="ai-template-arrow" />
                  </div>
                  <p className="ai-template-desc">{tmpl.description}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="ai-agent-form">
            <div className="ai-form-field">
              <label className="ai-form-label">Agent Name *</label>
              <input
                type="text"
                className="ai-form-input"
                placeholder="e.g. Subtask Auto-Assigner"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="ai-form-row">
              <div className="ai-form-field">
                <label className="ai-form-label">Trigger Event (When)</label>
                <select
                  className="ai-form-select"
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as AgentTriggerType)}
                >
                  <option value="on_subtask_created">🔄 When a subtask is created</option>
                  <option value="on_task_created">➕ When a new task is created</option>
                  <option value="on_status_change">🏷️ When status changes</option>
                  <option value="manual">⚡ On demand (Manual trigger)</option>
                </select>
              </div>

              <div className="ai-form-field">
                <label className="ai-form-label">Action (What)</label>
                <select
                  className="ai-form-select"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as AgentActionType)}
                >
                  <option value="auto_assign_parent">👤 Inherit Parent Task Assignee</option>
                  <option value="generate_checklist">📋 Generate Acceptance Checklist</option>
                  <option value="estimate_time">⏱️ Auto-Estimate Working Minutes</option>
                  <option value="custom_agent">🤖 Custom Plain English Prompt</option>
                </select>
              </div>
            </div>

            <div className="ai-form-field">
              <label className="ai-form-label">
                Agent Instructions & Rules (Plain English)
              </label>
              <textarea
                className="ai-form-textarea"
                rows={3}
                placeholder="e.g. Whenever a subtask is created, assign it to the parent task assignee and ensure no subtask is left empty."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              <span className="ai-form-hint">
                The agent will follow these instructions when executing this automation.
              </span>
            </div>

            <div className="ai-modal-footer">
              <button
                type="button"
                className="ai-btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ai-btn-primary"
                disabled={isSubmitting || !name.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    <span>Declaring Agent…</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>Declare Agent</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
