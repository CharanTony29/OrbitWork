"use client";

import { useState, useEffect, useRef } from "react";
import {
  Clock,
  Play,
  Square,
  Plus,
  Search,
  X,
  Loader2,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import TimesheetExportButton from "@/app/timesheets/TimesheetExportButton";

interface QuickTask {
  id: string;
  title: string;
  generatedKey: string;
  projectId: string;
  projectName: string;
  status: string;
  statusColor: string;
  priority: string;
  dueDate?: string | null;
  estimateMinutes?: number | null;
}

interface RunningTimer {
  id: string;
  taskId: string;
  taskTitle: string;
  generatedKey: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  billable?: boolean;
}

interface TodayEntry {
  id: string;
  durationMinutes: number;
  startedAt: string;
  description?: string;
  taskTitle: string;
  projectName: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  projectId?: string;
}

export default function QuickTimeTrackerModal({
  isOpen,
  onClose,
  workspaceId,
  projectId,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [todayTotalMinutes, setTodayTotalMinutes] = useState(0);
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [manualLogTaskId, setManualLogTaskId] = useState<string | null>(null);
  const [manualMinutes, setManualMinutes] = useState("30");
  const [manualDesc, setManualDesc] = useState("");

  // Live timer clock
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchTrackerData = async () => {
    try {
      const res = await fetch("/api/time/quick-tracker");
      if (res.ok) {
        const data = await res.json();
        setRunningTimer(data.runningTimer || null);
        setTasks(data.tasks || []);
        setTodayTotalMinutes(data.todayTotalMinutes || 0);
        setTodayEntries(data.todayEntries || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchTrackerData();
    }
  }, [isOpen]);

  // Compute live elapsed time for running timer
  useEffect(() => {
    if (!runningTimer?.startedAt) {
      setElapsedSeconds(0);
      return;
    }
    const startTime = new Date(runningTimer.startedAt).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [runningTimer]);

  if (!isOpen) return null;

  const formatElapsed = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatHoursMinutes = (totalMin: number) => {
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const handleStartTimer = async (task: QuickTask) => {
    setActionLoadingId(task.id);
    try {
      const res = await fetch("/api/time/quick-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          taskId: task.id,
          projectId: task.projectId,
        }),
      });
      if (res.ok) {
        await fetchTrackerData();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStopTimer = async () => {
    if (!runningTimer) return;
    setActionLoadingId("stop");
    try {
      const res = await fetch("/api/time/quick-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
          entryId: runningTimer.id,
          taskId: runningTimer.taskId,
          projectId: runningTimer.projectId,
        }),
      });
      if (res.ok) {
        setRunningTimer(null);
        await fetchTrackerData();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleManualLog = async (task: QuickTask) => {
    const mins = parseInt(manualMinutes, 10);
    if (!mins || mins <= 0) return;
    setActionLoadingId(`log-${task.id}`);
    try {
      const res = await fetch("/api/time/quick-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          taskId: task.id,
          projectId: task.projectId,
          minutes: mins,
          description: manualDesc,
        }),
      });
      if (res.ok) {
        setManualLogTaskId(null);
        setManualDesc("");
        setManualMinutes("30");
        await fetchTrackerData();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.generatedKey.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="canvas-modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="canvas-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 620,
          maxHeight: "88vh",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          overflow: "hidden",
          padding: 0,
          background: "var(--surface, #ffffff)",
          color: "var(--ink, #17231f)",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            padding: "18px 24px",
            color: "#ffffff",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  background: "color-mix(in srgb, var(--green, #10b981) 25%, transparent)",
                  color: "var(--green, #34d399)",
                  padding: "3px 9px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Clock size={12} /> TIME TRACKER
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Today:{" "}
                <strong style={{ color: "#ffffff" }}>
                  {formatHoursMinutes(todayTotalMinutes)}
                </strong>
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
              Active Task Time Tracking
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: 0,
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              cursor: "pointer",
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            maxHeight: "calc(88vh - 150px)",
            overflowY: "auto",
            padding: "20px 24px",
            display: "grid",
            gap: 16,
            scrollbarWidth: "thin",
            scrollbarColor: "var(--line, #94a3b8) transparent",
          }}
        >
          {/* Running Timer Live Card */}
          {runningTimer ? (
            <div
              style={{
                background: "color-mix(in srgb, var(--green, #10b981) 8%, var(--surface, #ffffff))",
                border: "1.5px solid var(--green, #10b981)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                boxShadow: "0 4px 15px color-mix(in srgb, var(--green, #10b981) 15%, transparent)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--green, #10b981)",
                      display: "inline-block",
                      boxShadow: "0 0 8px var(--green, #10b981)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--green, #10b981)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Timer Running Now
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "var(--surface-subtle, #f1f5f9)",
                      color: "var(--muted, #64748b)",
                    }}
                  >
                    {runningTimer.projectName}
                  </span>
                </div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink, #0f172a)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {runningTimer.generatedKey ? `${runningTimer.generatedKey} · ` : ""}
                  {runningTimer.taskTitle}
                </h4>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--ink, #0f172a)",
                    letterSpacing: "1px",
                  }}
                >
                  {formatElapsed(elapsedSeconds)}
                </span>
                <button
                  type="button"
                  onClick={handleStopTimer}
                  disabled={actionLoadingId === "stop"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#ffffff",
                    border: 0,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {actionLoadingId === "stop" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Square size={13} fill="currentColor" />
                  )}
                  Stop
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--surface-subtle, #f8fafc)",
                border: "1px dashed var(--line, #cbd5e1)",
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--muted, #64748b)",
                fontSize: 12.5,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} /> No timer is currently running. Select a task below to start!
              </span>
            </div>
          )}

          {/* Search bar */}
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted, #94a3b8)",
              }}
            />
            <input
              type="text"
              placeholder="Search tasks by title or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px 9px 36px",
                borderRadius: 8,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                color: "var(--ink, #0f172a)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          {/* Task list */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--muted, #64748b)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Your Tasks ({filteredTasks.length})
              </span>
            </div>

            {loading ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "var(--muted)" }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, margin: 0 }}>Loading your tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div
                style={{
                  padding: "30px 20px",
                  textAlign: "center",
                  background: "var(--surface-subtle, #f8fafc)",
                  borderRadius: 10,
                  border: "1px solid var(--line, #e2e8f0)",
                }}
              >
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  No tasks found
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                  Try a different search term or check your assigned tasks in projects.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {filteredTasks.map((task) => {
                  const isCurrentRunning = runningTimer?.taskId === task.id;
                  const isLogging = manualLogTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      style={{
                        background: isCurrentRunning
                          ? "color-mix(in srgb, var(--green, #10b981) 6%, var(--surface))"
                          : "var(--surface, #ffffff)",
                        border: `1px solid ${
                          isCurrentRunning ? "var(--green, #10b981)" : "var(--line, #e2e8f0)"
                        }`,
                        borderRadius: 9,
                        padding: "10px 14px",
                        display: "grid",
                        gap: 8,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            {task.generatedKey && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>
                                {task.generatedKey}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "var(--surface-subtle, #f1f5f9)",
                                color: "var(--muted, #475569)",
                              }}
                            >
                              {task.projectName}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: task.statusColor || "#3b82f6",
                              }}
                            >
                              {task.status}
                            </span>
                          </div>
                          <Link
                            href={`/projects/${task.projectId}/tasks/${task.id}`}
                            onClick={onClose}
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--ink, #0f172a)",
                              textDecoration: "none",
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={task.title}
                          >
                            {task.title}
                          </Link>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {isCurrentRunning ? (
                            <button
                              type="button"
                              onClick={handleStopTimer}
                              disabled={actionLoadingId === "stop"}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "5px 10px",
                                borderRadius: 6,
                                background: "#ef4444",
                                color: "#ffffff",
                                border: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {actionLoadingId === "stop" ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Square size={11} fill="currentColor" />
                              )}
                              Stop
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartTimer(task)}
                              disabled={actionLoadingId === task.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "5px 11px",
                                borderRadius: 6,
                                background: "var(--green, #10b981)",
                                color: "#ffffff",
                                border: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {actionLoadingId === task.id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Play size={11} fill="currentColor" />
                              )}
                              Start
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setManualLogTaskId(isLogging ? null : task.id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              padding: "5px 9px",
                              borderRadius: 6,
                              background: "var(--surface-subtle, #f1f5f9)",
                              color: "var(--ink, #334155)",
                              border: "1px solid var(--line, #cbd5e1)",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Log time manually"
                          >
                            <Plus size={12} /> Log
                          </button>
                        </div>
                      </div>

                      {/* Inline manual log form */}
                      {isLogging && (
                        <div
                          style={{
                            padding: "8px 10px",
                            background: "var(--surface-subtle, #f8fafc)",
                            border: "1px solid var(--line, #e2e8f0)",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <input
                            type="number"
                            placeholder="Minutes"
                            value={manualMinutes}
                            onChange={(e) => setManualMinutes(e.target.value)}
                            style={{
                              width: 75,
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--line, #cbd5e1)",
                              fontSize: 12,
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Work summary (optional)..."
                            value={manualDesc}
                            onChange={(e) => setManualDesc(e.target.value)}
                            style={{
                              flex: 1,
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--line, #cbd5e1)",
                              fontSize: 12,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleManualLog(task)}
                            disabled={actionLoadingId === `log-${task.id}`}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 4,
                              background: "var(--green, #10b981)",
                              color: "#fff",
                              border: 0,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 24px",
            background: "var(--surface-subtle, #f8fafc)",
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href={
              workspaceId
                ? `/workspaces/${workspaceId}/timesheets`
                : projectId
                ? `/projects/${projectId}/timesheets`
                : "/dashboard"
            }
            onClick={onClose}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--green, #10b981)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>Open Full Timesheets &amp; Reports</span>
            <ExternalLink size={12} />
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(workspaceId || projectId) && (
              <TimesheetExportButton
                scope={projectId ? "project" : "workspace"}
                targetId={(projectId || workspaceId)!}
                scopeName={projectId ? "Current Project" : "Current Workspace"}
                label="Export Excel"
                variant="secondary"
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="button button-secondary"
              style={{ minHeight: 32, padding: "4px 14px", fontSize: 12 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
