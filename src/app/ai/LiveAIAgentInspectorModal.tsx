"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  StopCircle,
  Minimize2,
  Search,
  ExternalLink,
  Clock,
  Sparkles,
} from "lucide-react";
import type { AIAgentJob, AIAgentLogEntry } from "@/lib/ai/agent/background-runner";

type Props = {
  job: AIAgentJob;
  onClose: () => void;
  onCancel: (jobId: string) => void;
};

export default function LiveAIAgentInspectorModal({ job, onClose, onCancel }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(
    Math.max(0, Math.floor((Date.now() - job.startedAt) / 1000))
  );
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isRunning = job.status === "running";

  // Live timer for elapsed time
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - job.startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, job.startedAt]);

  // Auto-scroll to bottom of logs on new logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [job.logs.length]);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  const percent =
    job.totalTasks > 0
      ? Math.min(100, Math.round((job.processedCount / job.totalTasks) * 100))
      : isRunning
      ? 15
      : 100;

  const filteredLogs = job.logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      log.actionTaken.toLowerCase().includes(q) ||
      (log.taskTitle && log.taskTitle.toLowerCase().includes(q))
    );
  });

  const successCount = job.logs.filter((l) => l.status === "success").length;
  const skippedCount = job.logs.filter((l) => l.actionTaken.toLowerCase().includes("already") || l.actionTaken.toLowerCase().includes("skipped")).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          background: "var(--paper, #ffffff)",
          color: "var(--ink, #0f172a)",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          border: "1px solid var(--line, #e2e8f0)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "aiSlideUp 0.18s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(16, 185, 129, 0.25)",
              }}
            >
              <Bot size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "var(--ink, #0f172a)" }}>
                  AI Agent Live Activity Inspector
                </h3>
                {isRunning ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#059669",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#10b981",
                        boxShadow: "0 0 6px #10b981",
                      }}
                    />
                    LIVE RUNNING
                  </span>
                ) : job.status === "completed" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#059669",
                    }}
                  >
                    <CheckCircle2 size={12} /> COMPLETED
                  </span>
                ) : job.status === "partially_completed" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(245, 158, 11, 0.18)",
                      color: "#b45309",
                    }}
                  >
                    <AlertCircle size={12} /> PARTIALLY COMPLETED
                  </span>
                ) : job.status === "cancelled" ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#fef3c7",
                      color: "#d97706",
                    }}
                  >
                    CANCELLED
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#fee2e2",
                      color: "#dc2626",
                    }}
                  >
                    FAILED
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted, #64748b)" }}>
                {job.agentName}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={onClose}
              title="Minimize to background toast"
              style={{
                background: "transparent",
                border: "1px solid var(--line, #cbd5e1)",
                borderRadius: 7,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--muted, #64748b)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Minimize2 size={13} />
              <span>Minimize</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--muted, #64748b)",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
              }}
              title="Close inspector"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress & Overview Header */}
        <div style={{ padding: "16px 20px", background: "var(--paper, #ffffff)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink, #0f172a)" }}>
              {isRunning
                ? `Processing Project Tasks (${percent}%)`
                : job.status === "completed"
                ? "All Tasks Processed (100%)"
                : "Execution Summary"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted, #64748b)", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> Elapsed: <strong>{formatElapsed(elapsedSeconds)}</strong>
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: "100%",
              height: 8,
              borderRadius: 999,
              background: "var(--line, #e2e8f0)",
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Metrics Tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
            }}
          >
            <div style={{ padding: "8px 12px", background: "var(--surface, #f8fafc)", borderRadius: 8, border: "1px solid var(--line, #e2e8f0)" }}>
              <span style={{ fontSize: 11, color: "var(--muted, #64748b)", display: "block" }}>Verified DB Updates</span>
              <strong style={{ fontSize: 15, color: "#16a34a" }}>{job.processedCount}</strong>
            </div>
            <div style={{ padding: "8px 12px", background: "var(--surface, #f8fafc)", borderRadius: 8, border: "1px solid var(--line, #e2e8f0)" }}>
              <span style={{ fontSize: 11, color: "var(--muted, #64748b)", display: "block" }}>Actions Executed</span>
              <strong style={{ fontSize: 15, color: "var(--ink, #0f172a)" }}>{successCount}</strong>
            </div>
            <div style={{ padding: "8px 12px", background: "var(--surface, #f8fafc)", borderRadius: 8, border: "1px solid var(--line, #e2e8f0)" }}>
              <span style={{ fontSize: 11, color: "var(--muted, #64748b)", display: "block" }}>Steps Inspected</span>
              <strong style={{ fontSize: 15, color: "var(--ink, #0f172a)" }}>{job.logs.length}</strong>
            </div>
            <div style={{ padding: "8px 12px", background: "var(--surface, #f8fafc)", borderRadius: 8, border: "1px solid var(--line, #e2e8f0)" }}>
              <span style={{ fontSize: 11, color: "var(--muted, #64748b)", display: "block" }}>Skipped / Unchanged</span>
              <strong style={{ fontSize: 15, color: "var(--muted, #64748b)" }}>{skippedCount}</strong>
            </div>
          </div>
        </div>

        {/* Live Step Log Stream */}
        <div
          style={{
            flex: 1,
            minHeight: 220,
            maxHeight: 380,
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid var(--line, #e2e8f0)",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            background: "#0f172a",
            color: "#f8fafc",
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#1e293b",
              borderBottom: "1px solid #334155",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} style={{ color: "#10b981" }} />
              Real-Time Execution Steps &amp; Decisions ({filteredLogs.length})
            </span>

            <div style={{ position: "relative", width: 200 }}>
              <Search
                size={12}
                style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }}
              />
              <input
                type="text"
                placeholder="Search steps…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "4px 8px 4px 26px",
                  fontSize: 11,
                  background: "#0f172a",
                  color: "#f8fafc",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div
            ref={logContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {filteredLogs.length === 0 ? (
              <p style={{ color: "#64748b", margin: 0, fontStyle: "italic" }}>
                {isRunning ? "Waiting for next batch..." : "No steps recorded."}
              </p>
            ) : (
              filteredLogs.map((log) => {
                let statusBadgeColor = "#3b82f6";
                let statusText = "INFO";
                if (log.status === "success") {
                  statusBadgeColor = "#10b981";
                  statusText = "SUCCESS";
                } else if (log.status === "warn") {
                  statusBadgeColor = "#f59e0b";
                  statusText = "NOTICE";
                } else if (log.status === "failed") {
                  statusBadgeColor = "#ef4444";
                  statusText = "FAILED";
                }

                return (
                  <div
                    key={log.id}
                    style={{
                      padding: "4px 0",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "#64748b", flexShrink: 0, fontSize: 11 }}>[{log.time}]</span>
                    <span
                      style={{
                        padding: "1px 5px",
                        borderRadius: 3,
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: "#ffffff",
                        background: statusBadgeColor,
                        flexShrink: 0,
                      }}
                    >
                      {statusText}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>
                      {log.taskTitle && (
                        <strong style={{ color: "#38bdf8", marginRight: 6 }}>
                          &ldquo;{log.taskTitle}&rdquo;:
                        </strong>
                      )}
                      <span style={{ color: log.status === "failed" ? "#fca5a5" : "#e2e8f0" }}>
                        {log.actionTaken}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            background: "var(--surface, #f8fafc)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            {isRunning && (
              <span style={{ fontSize: 12, color: "var(--muted, #64748b)", display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={13} className="spin" /> Runs in resilient background chunks across your project.
              </span>
            )}
            {!isRunning && job.summary && (
              <span style={{ fontSize: 12, color: "var(--muted, #64748b)" }}>{job.summary}</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isRunning && (
              <button
                type="button"
                onClick={() => onCancel(job.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#dc2626",
                  background: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                  borderRadius: 7,
                  cursor: "pointer",
                }}
              >
                <StopCircle size={14} />
                <span>Stop Agent</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#ffffff",
                background: "#0f172a",
                border: 0,
                borderRadius: 7,
                cursor: "pointer",
              }}
            >
              {isRunning ? "Keep in Background" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
