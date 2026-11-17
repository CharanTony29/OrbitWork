"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  AIAgentJob,
  dismissAIAgentJob,
  getActiveAIAgentJobs,
} from "@/lib/ai/agent/background-runner";

export default function AIAgentGlobalNotifier() {
  const [jobs, setJobs] = useState<AIAgentJob[]>([]);

  useEffect(() => {
    setJobs(getActiveAIAgentJobs());

    const handleJobsChange = (e: Event) => {
      const custom = e as CustomEvent<AIAgentJob[]>;
      if (custom.detail) {
        setJobs([...custom.detail]);
      } else {
        setJobs(getActiveAIAgentJobs());
      }
    };

    window.addEventListener("orbitwork:ai-agent-jobs-change", handleJobsChange);
    return () => {
      window.removeEventListener("orbitwork:ai-agent-jobs-change", handleJobsChange);
    };
  }, []);

  // Auto-dismiss completed jobs after 8 seconds
  useEffect(() => {
    const completedJobs = jobs.filter((j) => j.status === "completed" && j.finishedAt);
    if (completedJobs.length === 0) return;

    const timer = setTimeout(() => {
      completedJobs.forEach((job) => {
        if (job.finishedAt && Date.now() - job.finishedAt >= 7500) {
          dismissAIAgentJob(job.id);
        }
      });
    }, 8000);

    return () => clearTimeout(timer);
  }, [jobs]);

  if (jobs.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 380,
        width: "calc(100vw - 48px)",
        pointerEvents: "none",
      }}
      aria-live="polite"
    >
      {jobs.map((job) => {
        const isRunning = job.status === "running";
        const isCompleted = job.status === "completed";
        const isError = job.status === "error";

        let borderColor = "var(--line, #cbd5e1)";
        let iconBg = "rgba(16, 185, 129, 0.15)";
        let iconColor = "#10b981";

        if (isRunning) {
          borderColor = "var(--green, #167c58)";
          iconBg = "rgba(22, 124, 88, 0.15)";
          iconColor = "var(--green, #167c58)";
        } else if (isError) {
          borderColor = "#ef4444";
          iconBg = "rgba(239, 68, 68, 0.15)";
          iconColor = "#ef4444";
        }

        return (
          <div
            key={job.id}
            style={{
              pointerEvents: "auto",
              background: "var(--paper, #ffffff)",
              color: "var(--ink, #17231f)",
              border: `1.5px solid ${borderColor}`,
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.22)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              animation: "slideInUp 0.25s ease-out",
            }}
          >
            {/* Status Icon */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: iconBg,
                color: iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {isRunning && <Loader2 size={18} className="spin" style={{ animation: "spin 1s linear infinite" }} />}
              {isCompleted && <CheckCircle2 size={18} />}
              {isError && <AlertCircle size={18} />}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 750,
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {isRunning && <span>Running AI Agent in Background</span>}
                  {isCompleted && <span style={{ color: "var(--green, #167c58)" }}>AI Agent Completed!</span>}
                  {isError && <span style={{ color: "#ef4444" }}>AI Agent Execution Failed</span>}
                </span>

                <button
                  type="button"
                  onClick={() => dismissAIAgentJob(job.id)}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--muted, #64748b)",
                    cursor: "pointer",
                    padding: 2,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Dismiss notification"
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", margin: "3px 0 2px" }}>
                {job.agentName}
              </div>

              <p
                style={{
                  fontSize: 11,
                  color: "var(--muted, #64748b)",
                  margin: 0,
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                }}
              >
                {isRunning && (
                  <span>
                    Executing across tasks in background. You can navigate to List or other views while this finishes.
                  </span>
                )}
                {isCompleted && <span>{job.summary}</span>}
                {isError && <span>{job.error}</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
