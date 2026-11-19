"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bot, X, CheckCircle, Sparkles, Loader2, ArrowRight, Shield, User } from "lucide-react";

interface AIAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  members?: Array<{ id: string; label: string; designations?: string[] }>;
}

export default function AIAssignModal({
  isOpen,
  onClose,
  projectId,
  projectName = "Project",
  members = [],
}: AIAssignModalProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    assignedCount: number;
    assignments: Array<{
      taskId: string;
      taskTitle: string;
      assignedUserId: string;
      assignedUserName: string;
      requiredRole: string;
      workloadCount: number;
      reason: string;
    }>;
  } | null>(null);

  if (!isOpen) return null;

  async function handleRunAIAssignment() {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/ai-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAssignAll: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute AI task assignment");
      }

      setResults({
        assignedCount: data.assignedCount,
        assignments: data.assignments || [],
      });
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to run AI assignment");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="proj-modal-overlay"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isRunning) onClose();
        }}
        style={{ zIndex: 9999 }}
      >
        <div
          className="proj-modal"
          style={{
            maxWidth: 640,
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            className="proj-modal-head"
            style={{
              borderBottom: "1px solid var(--line, #e2e8f0)",
              paddingBottom: 12,
            }}
          >
            <div>
              <h2
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 16,
                  margin: 0,
                }}
              >
                <Bot size={18} style={{ color: "#7c3aed" }} />
                AI Task Assignment Agent
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11.5px",
                  color: "var(--muted, #64748b)",
                }}
              >
                Automatically triages unassigned tasks in {projectName} to role-aligned teammates with the lowest active workload.
              </p>
            </div>
            <button
              type="button"
              className="proj-modal-close"
              onClick={onClose}
              disabled={isRunning}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              padding: "16px 20px",
              overflowY: "auto",
              flex: 1,
              display: "grid",
              gap: 16,
            }}
          >
            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontSize: 12,
                  border: "1px solid #f87171",
                }}
              >
                {error}
              </div>
            )}

            {!results ? (
              <>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "rgba(124, 58, 237, 0.06)",
                    border: "1px solid rgba(124, 58, 237, 0.18)",
                    fontSize: 12,
                    lineHeight: 1.5,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <strong style={{ color: "#6d28d9", display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={14} />
                    How AI Workload Balancing Works:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink)", display: "grid", gap: 4 }}>
                    <li>
                      <strong>Role Detection:</strong> Analyzes task title &amp; description to determine if the task requires a Developer, Tester, Support, HR, or Administrator.
                    </li>
                    <li>
                      <strong>Designation Matching:</strong> Filters eligible team members who hold matching designations.
                    </li>
                    <li>
                      <strong>Workload Balancing:</strong> Assigns the member who currently has the lowest active task count to prevent team burnout.
                    </li>
                    <li>
                      <strong>Audit Trail:</strong> Records transparent activity logs showing why each assignee was chosen.
                    </li>
                  </ul>
                </div>

                {members.length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Eligible Project Members ({members.length})
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 6,
                        maxHeight: 120,
                        overflowY: "auto",
                      }}
                    >
                      {members.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--line, #e2e8f0)",
                            background: "var(--soft, #f8fafc)",
                            fontSize: 11,
                          }}
                        >
                          <User size={11} style={{ opacity: 0.6 }} />
                          <span style={{ fontWeight: 600 }}>{m.label}</span>
                          {m.designations && m.designations.length > 0 && (
                            <span style={{ color: "var(--muted)", fontSize: 10 }}>
                              ({m.designations.slice(0, 2).join(", ")})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#065f46",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle size={16} />
                  <span>
                    Successfully assigned {results.assignedCount} task
                    {results.assignedCount === 1 ? "" : "s"} based on designations and workload balancing!
                  </span>
                </div>

                {results.assignments.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                    No unassigned tasks found in this project.
                  </p>
                ) : (
                  <div
                    style={{
                      border: "1px solid var(--line, #e2e8f0)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead style={{ background: "var(--soft, #f8fafc)", borderBottom: "1px solid var(--line, #e2e8f0)" }}>
                        <tr>
                          <th style={{ textAlign: "left", padding: "7px 10px", color: "var(--muted)" }}>Task</th>
                          <th style={{ textAlign: "left", padding: "7px 10px", color: "var(--muted)" }}>Role</th>
                          <th style={{ textAlign: "left", padding: "7px 10px", color: "var(--muted)" }}>Assigned To</th>
                          <th style={{ textAlign: "left", padding: "7px 10px", color: "var(--muted)" }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.assignments.map((item, idx) => (
                          <tr
                            key={item.taskId}
                            style={{
                              borderBottom:
                                idx === results.assignments.length - 1
                                  ? "none"
                                  : "1px solid var(--line, #f1f5f9)",
                            }}
                          >
                            <td style={{ padding: "8px 10px", fontWeight: 600, maxWidth: 160 }}>
                              {item.taskTitle}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "rgba(124, 58, 237, 0.1)",
                                  color: "#7c3aed",
                                  fontWeight: 700,
                                  fontSize: 10.5,
                                }}
                              >
                                {item.requiredRole}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px", color: "var(--ink)", fontWeight: 600 }}>
                              {item.assignedUserName}
                            </td>
                            <td style={{ padding: "8px 10px", color: "var(--muted)", fontSize: 10.5 }}>
                              {item.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--line, #e2e8f0)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isRunning}
              className="button button-secondary"
              style={{ fontSize: 12, padding: "6px 14px" }}
            >
              {results ? "Close" : "Cancel"}
            </button>
            {!results && (
              <button
                type="button"
                onClick={handleRunAIAssignment}
                disabled={isRunning}
                className="button button-primary"
                style={{
                  fontSize: 12,
                  padding: "6px 16px",
                  backgroundColor: "#7c3aed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isRunning ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Analyzing &amp; Assigning…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Run AI Smart Assignment</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>,
      document.body
    )
  );
}
