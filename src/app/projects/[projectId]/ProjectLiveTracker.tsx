"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  Search,
  ExternalLink,
  Presentation,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  PauseCircle,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ExportPresentationModal from "./ExportPresentationModal";
import { getCustomStatusColor } from "@/lib/custom-theme";
import "./live-tracker.css";

interface LiveTask {
  id: string;
  generated_key?: string | null;
  title: string;
  task_type?: string | null;
  priority?: string | null;
  due_date?: string | null;
  status_id: string;
  created_at?: string;
  primary_assignee_id?: string | null;
  secondary_assignee_id?: string | null;
  assigneeIds?: string[];
}

interface WorkflowStatus {
  id: string;
  name: string;
  color?: string | null;
  category?: string | null;
}

interface ProjectLiveTrackerProps {
  projectId: string;
  projectName: string;
  workspaceName?: string;
  organizationName?: string;
  initialTasks: LiveTask[];
  statuses: WorkflowStatus[];
  people: Map<string, string>;
  canEdit?: boolean;
}

function getStatusColor(status?: WorkflowStatus): string {
  if (!status) return "#64748b";
  if (typeof window !== "undefined") {
    const custom = getCustomStatusColor(status.name, status.category || undefined);
    if (custom) return custom;
  }
  const name = (status.name || "").toLowerCase();
  if (
    status.category === "completed" ||
    name.includes("done") ||
    name.includes("complete") ||
    name.includes("closed")
  ) {
    return "#167c58"; // Emerald Green
  }
  if (
    status.category === "in_progress" ||
    name.includes("progress") ||
    name.includes("doing") ||
    name.includes("active")
  ) {
    return "#2563eb"; // Royal Blue
  }
  if (name.includes("hold") || name.includes("block") || name.includes("wait")) {
    return "#d97706"; // Amber
  }
  if (name.includes("re open") || name.includes("reopen") || name.includes("review")) {
    return "#f59e0b"; // Gold / Amber
  }
  if (status.category === "not_started" || name.includes("new") || name.includes("todo")) {
    return "#0284c7"; // Sky Blue
  }
  return status.color || "#64748b";
}

export default function ProjectLiveTracker({
  projectId,
  projectName,
  workspaceName,
  organizationName,
  initialTasks,
  statuses,
  people,
  canEdit = true,
}: ProjectLiveTrackerProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<LiveTask[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<"open" | "overdue" | "closed" | "all">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "due" | "priority">("recent");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [, setThemeVersion] = useState(0);

  useEffect(() => {
    const onTheme = () => setThemeVersion((v) => v + 1);
    window.addEventListener("orbitwork:theme-change", onTheme);
    return () => window.removeEventListener("orbitwork:theme-change", onTheme);
  }, []);
  const [, startTransition] = useTransition();

  // Status mapping
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  // Today ISO string
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Update tasks when initialTasks prop updates
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Supabase Realtime Listener for Live Project Updates
  useEffect(() => {
    const supabase = createClient();
    const channelName = `project-live-tracker-${projectId}-${Math.random().toString(36).slice(2, 7)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const raw = payload.new as any;
            setTasks((prev) => [raw as LiveTask, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const raw = payload.new as any;
            setTasks((prev) => prev.map((t) => (t.id === raw.id ? { ...t, ...raw } : t)));
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as any)?.id;
            if (oldId) setTasks((prev) => prev.filter((t) => t.id !== oldId));
          }
          startTransition(() => {
            router.refresh();
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, router]);

  // Manual Refresh Handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => setIsRefreshing(false), 800);
    });
  };

  // Helper to determine task state
  const isTaskClosed = (task: LiveTask) => {
    const st = statusMap.get(task.status_id);
    if (!st) return false;
    const name = (st.name || "").toLowerCase();
    return (
      st.category === "completed" ||
      st.category === "cancelled" ||
      name.includes("done") ||
      name.includes("complete") ||
      name.includes("closed")
    );
  };

  const isTaskOverdue = (task: LiveTask) => {
    if (!task.due_date) return false;
    return task.due_date < todayStr && !isTaskClosed(task);
  };

  // Counts for tabs and hero badge
  const counts = useMemo(() => {
    let open = 0;
    let overdue = 0;
    let closed = 0;
    for (const t of tasks) {
      const closedFlag = isTaskClosed(t);
      if (closedFlag) {
        closed += 1;
      } else {
        open += 1;
        if (t.due_date && t.due_date < todayStr) {
          overdue += 1;
        }
      }
    }
    return {
      open,
      overdue,
      closed,
      all: tasks.length,
    };
  }, [tasks, statusMap, todayStr]);

  // Assignee resolver helper
  const getAssigneeLabel = (task: LiveTask): string => {
    const ids = new Set<string>();
    if (task.primary_assignee_id) ids.add(task.primary_assignee_id);
    if (task.secondary_assignee_id) ids.add(task.secondary_assignee_id);
    if (task.assigneeIds) {
      for (const id of task.assigneeIds) ids.add(id);
    }
    if (ids.size === 0) return "Unassigned";
    const names = Array.from(ids).map((id) => people.get(id) || "Team member");
    return names.join(", ");
  };

  // Filtered and Sorted Tasks
  const displayedTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      const closed = isTaskClosed(t);
      const overdue = isTaskOverdue(t);

      // Tab filter
      if (activeTab === "open" && closed) return false;
      if (activeTab === "overdue" && !overdue) return false;
      if (activeTab === "closed" && !closed) return false;

      // Status dropdown filter
      if (statusFilter !== "all" && t.status_id !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (t.title || "").toLowerCase().includes(q);
        const keyMatch = (t.generated_key || "").toLowerCase().includes(q);
        const assigneeMatch = getAssigneeLabel(t).toLowerCase().includes(q);
        if (!titleMatch && !keyMatch && !assigneeMatch) return false;
      }

      return true;
    });

    // Sorting
    if (sortBy === "due") {
      result.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    } else if (sortBy === "priority") {
      const weight: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
      result.sort((a, b) => {
        const wa = weight[a.priority || "normal"] || 2;
        const wb = weight[b.priority || "normal"] || 2;
        return wb - wa;
      });
    } else {
      // Recent
      result.sort((a, b) => {
        const da = a.created_at || "";
        const db = b.created_at || "";
        return db.localeCompare(da);
      });
    }

    return result;
  }, [tasks, activeTab, statusFilter, searchQuery, sortBy, statusMap, todayStr, people]);

  return (
    <div className="live-tracker-root">
      {/* Top Header Row (Mirroring Screenshot Top Bar) */}
      <div className="live-tracker-header">
        <div className="live-tracker-breadcrumb">
          <div className="live-tracker-org-proj">
            {organizationName || workspaceName || "ORBITWORK"} / {projectName}
          </div>
          <div className="live-tracker-subtag">Live list tracker • Realtime dashboard</div>
        </div>

        <div className="live-tracker-header-actions">
          <button
            type="button"
            className="live-tracker-refresh-btn"
            onClick={handleRefresh}
            title="Refresh latest live data"
          >
            <RotateCcw size={14} className={isRefreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="live-tracker-ppt-btn"
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
              color: "#ffffff",
              border: 0,
              boxShadow: "0 2px 8px rgba(126, 34, 206, 0.35)",
            }}
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("orbitwork:open-presentation-studio", {
                  detail: {
                    projectId,
                    topic: `${projectName} Realtime Live Tracker Status (${displayedTasks.length} active tasks)`,
                  },
                })
              );
            }}
            title="Generate AI Presentation deck from live tracker data"
          >
            <Sparkles size={14} />
            <span>AI Presentations</span>
          </button>

          <button
            type="button"
            className="live-tracker-ppt-btn"
            onClick={() => setIsExportModalOpen(true)}
            title="Export professional presentation deck"
          >
            <Presentation size={14} />
            <span>Export Presentation (PPT)</span>
          </button>
        </div>
      </div>

      {/* Hero Banner (Keep The Work Moving) */}
      <div className="live-tracker-hero">
        <div className="live-tracker-hero-left">
          <div className="live-tracker-view-pill">
            <span className="live-tracker-dot" />
            <span>WORK IN VIEW / {projectName}</span>
          </div>
          <h1 className="live-tracker-headline">KEEP THE WORK MOVING.</h1>
          <p className="live-tracker-desc">
            One clear view of the work on your {projectName} list. Realtime task progression,
            critical blockers, and team status.
          </p>
        </div>

        <div className="live-tracker-hero-right">
          <div className="live-tracker-open-label">OPEN WORK</div>
          <div className="live-tracker-big-count">
            <span className="live-tracker-big-number">{counts.open}</span>
            <span className="live-tracker-count-sub">tasks</span>
          </div>
          <div className="live-tracker-pulse-indicator">
            <span className="live-pulse-dot" />
            <span>LIVE REALTIME SYNC</span>
          </div>
        </div>
      </div>

      {/* The Workboard Section (What Needs Attention) */}
      <div className="live-tracker-workboard">
        <div className="live-tracker-board-heading">
          <div className="live-tracker-board-title-group">
            <p className="eyebrow">THE WORKBOARD</p>
            <h2>WHAT NEEDS ATTENTION</h2>
          </div>
          <div className="live-tracker-board-subtitle">Tasks and subtasks • live data</div>
        </div>

        {/* Filter Tabs */}
        <div className="live-tracker-tabs">
          <button
            type="button"
            className={`live-tracker-tab-btn ${activeTab === "open" ? "is-active" : ""}`}
            onClick={() => setActiveTab("open")}
          >
            <span>Open</span>
            <span className="live-tracker-tab-pill">{counts.open}</span>
          </button>

          <button
            type="button"
            className={`live-tracker-tab-btn ${activeTab === "overdue" ? "is-active" : ""}`}
            onClick={() => setActiveTab("overdue")}
          >
            <span>Overdue</span>
            <span
              className="live-tracker-tab-pill"
              style={{
                background: counts.overdue > 0 ? "#fef2f2" : undefined,
                color: counts.overdue > 0 ? "#dc2626" : undefined,
              }}
            >
              {counts.overdue}
            </span>
          </button>

          <button
            type="button"
            className={`live-tracker-tab-btn ${activeTab === "closed" ? "is-active" : ""}`}
            onClick={() => setActiveTab("closed")}
          >
            <span>Closed</span>
            <span className="live-tracker-tab-pill">{counts.closed}</span>
          </button>

          <button
            type="button"
            className={`live-tracker-tab-btn ${activeTab === "all" ? "is-active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span>All work</span>
            <span className="live-tracker-tab-pill">{counts.all}</span>
          </button>
        </div>

        {/* Toolbar: Search & Selectors */}
        <div className="live-tracker-toolbar">
          <div className="live-tracker-search-wrap">
            <Search size={15} />
            <input
              type="text"
              className="live-tracker-search-input"
              placeholder="Search work or assignee"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="live-tracker-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {statuses.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <select
            className="live-tracker-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "due" | "priority")}
          >
            <option value="recent">Recently updated</option>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        {/* Info Bar */}
        <div className="live-tracker-info-bar">
          <span>{displayedTasks.length} TASKS SHOWN</span>
          <span>SELECT A TASK TO VIEW DETAILS ↗</span>
        </div>

        {/* Task List (Matching Exact Row Style from Image) */}
        <div className="live-tracker-list">
          {displayedTasks.length === 0 ? (
            <div className="live-tracker-empty">
              No tasks match the selected tab and filters.
            </div>
          ) : (
            displayedTasks.map((task) => {
              const st = statusMap.get(task.status_id);
              const statusColor = getStatusColor(st);
              const assigneeName = getAssigneeLabel(task);
              const overdue = isTaskOverdue(task);
              const taskTypeName = (task.task_type || "Task").replaceAll("_", " ");

              // Due date label
              let dueLabel = "No due date";
              if (task.due_date) {
                const d = new Date(task.due_date);
                const formattedDate = d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                dueLabel = overdue ? `Overdue - ${formattedDate}` : formattedDate;
              }

              return (
                <Link
                  key={task.id}
                  href={`/projects/${projectId}/tasks/${task.id}`}
                  className="live-tracker-row"
                  style={{ borderLeftColor: statusColor }}
                  title="Click to view task details and comments"
                >
                  <div className="live-tracker-row-left">
                    <div className="live-tracker-task-title">{task.title}</div>
                    <div className="live-tracker-row-meta">
                      <span>{taskTypeName}</span>
                      <span>•</span>
                      <span>{assigneeName}</span>
                      {task.priority && task.priority !== "normal" && (
                        <>
                          <span>•</span>
                          <span
                            style={{
                              textTransform: "capitalize",
                              fontWeight: 600,
                              color: task.priority === "urgent" ? "#dc2626" : "#d97706",
                            }}
                          >
                            {task.priority}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="live-tracker-row-right">
                    <div className="live-tracker-status-col">
                      <span
                        className="live-tracker-status-badge"
                        style={{
                          backgroundColor: `${statusColor}18`,
                          color: statusColor,
                          border: `1px solid ${statusColor}40`,
                        }}
                      >
                        {st?.name || "To Do"}
                      </span>
                      <span
                        className={`live-tracker-due-info ${overdue ? "is-overdue" : ""}`}
                      >
                        {dueLabel}
                      </span>
                    </div>

                    <ExternalLink size={15} className="live-tracker-arrow" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Export Presentation Modal */}
      <ExportPresentationModal
        projectId={projectId}
        projectName={projectName}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
