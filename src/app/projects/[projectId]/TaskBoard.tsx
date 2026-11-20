"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { updateTaskStatus, updateTaskField, updateTaskAssignees } from "@/app/actions";
import {
  Check,
  Edit2,
  X,
  UserPlus,
  Search,
  Flag,
  Calendar,
  AlertCircle,
  Clock,
} from "lucide-react";

type Task = {
  id: string;
  generated_key: string;
  title: string;
  task_type?: string | null;
  priority: string;
  status_id: string;
  due_date: string | null;
  primary_assignee_id: string | null;
  secondary_assignee_id: string | null;
};
type Status = { id: string; name: string; color: string; category?: string };

const AVATAR_COLORS = [
  "#167c58",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#9333ea",
  "#0891b2",
  "#4f46e5",
  "#e11d48",
];

const PRIORITIES = [
  { id: "urgent", label: "Urgent", color: "#dc2626", bg: "rgba(220, 38, 38, 0.12)" },
  { id: "high", label: "High", color: "#ea580c", bg: "rgba(234, 88, 12, 0.12)" },
  { id: "normal", label: "Normal", color: "#2563eb", bg: "rgba(37, 99, 235, 0.12)" },
  { id: "low", label: "Low", color: "#64748b", bg: "rgba(100, 116, 139, 0.12)" },
] as const;

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getSmartStatusColor(status?: { name?: string; color?: string; category?: string }) {
  const name = (status?.name ?? "").toLowerCase();
  if (
    name.includes("new") ||
    name.includes("to do") ||
    name.includes("todo") ||
    name.includes("backlog") ||
    status?.category === "not_started"
  ) {
    return "#0284c7"; // Sky / Ocean Blue for New
  }
  if (
    name.includes("progress") ||
    name.includes("doing") ||
    name.includes("active") ||
    status?.category === "in_progress"
  ) {
    return "#2563eb"; // Royal Blue for In Progress
  }
  if (name.includes("hold") || name.includes("block") || name.includes("wait")) {
    return "#d97706"; // Amber for On Hold
  }
  if (name.includes("review") || name.includes("qa") || name.includes("test")) {
    return "#9333ea"; // Purple for Review
  }
  if (
    name.includes("complete") ||
    name.includes("done") ||
    name.includes("closed") ||
    status?.category === "completed"
  ) {
    return "#167c58"; // Emerald Green for Completed
  }
  if (name.includes("reject") || name.includes("cancel") || status?.category === "cancelled") {
    return "#dc2626"; // Crimson Red for Rejected
  }
  if (status?.color && status.color !== "#87938b" && status.color !== "#526057" && status.color !== "#64748b") {
    return status.color;
  }
  return "#0284c7";
}

export default function TaskBoard({
  projectId,
  tasks,
  statuses,
  people,
  profileAvatars,
  canEdit = true,
}: {
  projectId: string;
  tasks: Task[];
  statuses: Status[];
  people: Map<string, string>;
  profileAvatars?: Map<string, string | null>;
  canEdit?: boolean;
}) {
  const router = useRouter();

  // Optimistic local state for instantaneous 0ms UI feedback
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [dragging, setDragging] = useState<string | null>(null);

  // Inline editing states
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState<string>("");
  const [activePriorityMenuId, setActivePriorityMenuId] = useState<string | null>(null);
  const [activeAssigneeMenuId, setActiveAssigneeMenuId] = useState<string | null>(null);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");

  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync server tasks when updated elsewhere
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    const handleUpdated = () => router.refresh();
    window.addEventListener("orbitwork:tasks-updated", handleUpdated);
    return () => window.removeEventListener("orbitwork:tasks-updated", handleUpdated);
  }, [router]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePriorityMenuId(null);
        setActiveAssigneeMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Instant 0ms Status Move (Drag & Drop or Select)
  function moveTask(taskId: string, statusId: string) {
    if (!canEdit) return;

    // 0ms optimistic local update
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status_id: statusId } : t))
    );

    // Persist in background asynchronously without blocking UI
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("taskId", taskId);
    data.set("statusId", statusId);

    void updateTaskStatus(data).catch((err) => {
      console.error("Failed to move task:", err);
      setLocalTasks(tasks); // Revert on failure
    });
  }

  // 2. Instant 0ms Title Edit
  function handleSaveTitle(taskId: string) {
    const trimmed = editingTitleValue.trim();
    if (!trimmed || !canEdit) {
      setEditingTitleId(null);
      return;
    }

    // 0ms optimistic local update
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t))
    );
    setEditingTitleId(null);

    // Persist in background
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("taskId", taskId);
    data.set("field", "title");
    data.set("value", trimmed);

    void updateTaskField(data).catch((err) => {
      console.error("Failed to update task title:", err);
      setLocalTasks(tasks);
    });
  }

  // 3. Instant 0ms Priority Update
  function handleSelectPriority(taskId: string, newPriority: string) {
    if (!canEdit) return;

    // 0ms optimistic local update
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t))
    );
    setActivePriorityMenuId(null);

    // Persist in background
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("taskId", taskId);
    data.set("field", "priority");
    data.set("value", newPriority);

    void updateTaskField(data).catch((err) => {
      console.error("Failed to update priority:", err);
      setLocalTasks(tasks);
    });
  }

  // 4. Instant 0ms Assignee Update
  function handleToggleAssignee(task: Task, userId: string) {
    if (!canEdit) return;

    let nextPrimary = task.primary_assignee_id;
    let nextSecondary = task.secondary_assignee_id;

    if (nextPrimary === userId) {
      // Remove primary, promote secondary
      nextPrimary = nextSecondary;
      nextSecondary = null;
    } else if (nextSecondary === userId) {
      // Remove secondary
      nextSecondary = null;
    } else {
      // Add user
      if (!nextPrimary) {
        nextPrimary = userId;
      } else if (!nextSecondary) {
        nextSecondary = userId;
      } else {
        // Replace secondary
        nextSecondary = userId;
      }
    }

    // 0ms optimistic update
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, primary_assignee_id: nextPrimary, secondary_assignee_id: nextSecondary }
          : t
      )
    );

    // Persist in background
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("taskId", task.id);
    data.set("primaryAssigneeId", nextPrimary || "");
    data.set("secondaryAssigneeId", nextSecondary || "");

    void updateTaskAssignees(data).catch((err) => {
      console.error("Failed to update assignees:", err);
      setLocalTasks(tasks);
    });
  }

  const peopleList = Array.from(people.entries()).map(([id, name]) => ({
    id,
    name,
    avatar: profileAvatars?.get(id),
  }));

  const filteredPeople = peopleList.filter((p) =>
    p.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
  );

  return (
    <div className="kanban-board" style={{ minHeight: "calc(100vh - 220px)", height: "100%" }}>
      {statuses.map((status) => {
        const colColor = getSmartStatusColor(status);
        const columnTasks = localTasks.filter((task) => task.status_id === status.id);

        return (
          <section
            className="kanban-column"
            key={status.id}
            style={{
              borderTop: `3px solid ${colColor}`,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: "calc(100vh - 240px)",
              background: "#f7f9f7",
            }}
            onDragOver={(event) => {
              if (canEdit) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!canEdit) return;
              const taskId = event.dataTransfer.getData("text/task-id");
              if (taskId) moveTask(taskId, status.id);
              setDragging(null);
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                paddingBottom: 8,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="status-color"
                  style={{
                    backgroundColor: colColor,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    display: "inline-block",
                    boxShadow: `0 0 0 2px ${colColor}33`,
                  }}
                />
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  {status.name}
                </h3>
              </div>
              <span
                className="count-pill"
                style={{
                  background: `${colColor}18`,
                  color: colColor,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "1px 8px",
                  fontSize: 11,
                }}
              >
                {columnTasks.length}
              </span>
            </header>

            <div
              className="kanban-cards"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flex: "1 1 auto",
                minHeight: 180,
              }}
            >
              {columnTasks.map((task) => {
                const assigneeIds = [task.primary_assignee_id, task.secondary_assignee_id].filter(
                  (id): id is string => Boolean(id)
                );
                const isEditingTitle = editingTitleId === task.id;
                const isPriorityMenuOpen = activePriorityMenuId === task.id;
                const isAssigneeMenuOpen = activeAssigneeMenuId === task.id;
                const currentPriority =
                  PRIORITIES.find((p) => p.id === task.priority) || PRIORITIES[2];

                return (
                  <article
                    className={`kanban-card${dragging === task.id ? " is-dragging" : ""}${
                      !canEdit ? " is-readonly" : ""
                    }`}
                    key={task.id}
                    tabIndex={0}
                    role="article"
                    aria-label={`Task: ${task.title}`}
                    draggable={canEdit && !isEditingTitle}
                    onDragStart={(event) => {
                      if (!canEdit || isEditingTitle) return;
                      setDragging(task.id);
                      event.dataTransfer.setData("text/task-id", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragging(null)}
                    style={{
                      background: "#ffffff",
                      borderRadius: 9,
                      border: "1px solid var(--line, #e2e8f0)",
                      padding: "11px 12px",
                      position: "relative",
                      transition: "transform 0.08s ease, box-shadow 0.1s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Top Row: Task Key & Type Badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--muted, #64748b)",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {task.generated_key || `#${task.id.slice(0, 6)}`}
                      </span>
                      <span className="task-type-badge">
                        {(task.task_type ?? "task").replaceAll("_", " ")}
                      </span>
                    </div>

                    {/* Task Title (Inline Editable) */}
                    <div className="kanban-card-heading" style={{ marginBottom: 8 }}>
                      {isEditingTitle ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
                          <input
                            type="text"
                            autoFocus
                            value={editingTitleValue}
                            onChange={(e) => setEditingTitleValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveTitle(task.id);
                              if (e.key === "Escape") setEditingTitleId(null);
                            }}
                            onBlur={() => handleSaveTitle(task.id)}
                            style={{
                              flex: 1,
                              fontSize: 12,
                              fontWeight: 650,
                              padding: "4px 6px",
                              border: "1.5px solid var(--green, #167c58)",
                              borderRadius: 5,
                              color: "var(--ink)",
                              outline: "none",
                              background: "#fff",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTitle(task.id)}
                            style={{
                              border: 0,
                              background: "var(--green, #167c58)",
                              color: "#fff",
                              borderRadius: 4,
                              padding: 4,
                              cursor: "pointer",
                            }}
                            title="Save Title"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTitleId(null)}
                            style={{
                              border: 0,
                              background: "#f1f5f9",
                              color: "#64748b",
                              borderRadius: 4,
                              padding: 4,
                              cursor: "pointer",
                            }}
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 6,
                            width: "100%",
                          }}
                        >
                          <Link
                            href={`/projects/${projectId}/tasks/${task.id}`}
                            className="kanban-card-title"
                            onDoubleClick={(e) => {
                              if (!canEdit) return;
                              e.preventDefault();
                              setEditingTitleId(task.id);
                              setEditingTitleValue(task.title);
                            }}
                            style={{
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: "var(--ink, #0f172a)",
                              textDecoration: "none",
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                            }}
                            title="Click to view details · Double-click to edit name"
                          >
                            {task.title}
                          </Link>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTitleId(task.id);
                                setEditingTitleValue(task.title);
                              }}
                              style={{
                                border: 0,
                                background: "transparent",
                                color: "var(--muted, #94a3b8)",
                                cursor: "pointer",
                                padding: "2px 4px",
                                borderRadius: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                flexShrink: 0,
                                transition: "all 0.1s ease",
                              }}
                              title="Edit task name"
                              aria-label="Edit task name"
                            >
                              <Edit2 size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata Row: Priority & Due Date */}
                    <div
                      className="kanban-card-meta"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        position: "relative",
                      }}
                    >
                      {/* Priority Button with Interactive Popover */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canEdit) return;
                            setActivePriorityMenuId(isPriorityMenuOpen ? null : task.id);
                            setActiveAssigneeMenuId(null);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            border: `1px solid ${currentPriority.color}40`,
                            background: currentPriority.bg,
                            color: currentPriority.color,
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            padding: "2px 7px",
                            cursor: canEdit ? "pointer" : "default",
                            textTransform: "capitalize",
                            transition: "all 0.1s ease",
                          }}
                          title={canEdit ? "Click to change priority" : undefined}
                        >
                          <Flag size={9} />
                          <span>{currentPriority.label}</span>
                        </button>

                        {/* Priority Selection Popover */}
                        {isPriorityMenuOpen && (
                          <div
                            ref={popoverRef}
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              marginTop: 4,
                              background: "#ffffff",
                              border: "1px solid var(--line, #e2e8f0)",
                              borderRadius: 8,
                              boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                              zIndex: 50,
                              minWidth: 120,
                              padding: 4,
                            }}
                          >
                            {PRIORITIES.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectPriority(task.id, p.id)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  width: "100%",
                                  border: 0,
                                  background: task.priority === p.id ? p.bg : "transparent",
                                  color: p.color,
                                  fontWeight: task.priority === p.id ? 700 : 500,
                                  fontSize: 11,
                                  padding: "5px 8px",
                                  borderRadius: 5,
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: p.color,
                                  }}
                                />
                                <span>{p.label}</span>
                                {task.priority === p.id && (
                                  <Check size={11} style={{ marginLeft: "auto" }} />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Due Date */}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10,
                          color: "var(--muted, #64748b)",
                          fontWeight: 500,
                        }}
                      >
                        <Calendar size={10} />
                        {task.due_date
                          ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString()
                          : "No due date"}
                      </span>
                    </div>

                    {/* Assignees Row (Interactive Quick Picker) */}
                    <div
                      className="kanban-assignees"
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        flexWrap: "wrap",
                        margin: "6px 0",
                      }}
                    >
                      {assigneeIds.length > 0 ? (
                        assigneeIds.map((uid) => {
                          const name = people.get(uid) ?? "Team member";
                          const avatar = profileAvatars?.get(uid);
                          return (
                            <span
                              key={uid}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: "var(--ink)",
                                background: "var(--surface-subtle, #f8faf8)",
                                border: "1px solid var(--line, #e4e9e5)",
                                borderRadius: 12,
                                padding: "2px 7px 2px 3px",
                              }}
                              title={name}
                            >
                              <span
                                style={{
                                  width: 17,
                                  height: 17,
                                  borderRadius: "50%",
                                  backgroundColor: getAvatarColor(uid),
                                  color: "#fff",
                                  fontSize: 8.5,
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                }}
                              >
                                {avatar ? (
                                  <img
                                    src={avatar}
                                    alt={name}
                                    loading="lazy"
                                    decoding="async"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  name.charAt(0).toUpperCase()
                                )}
                              </span>
                              <span
                                style={{
                                  maxWidth: 100,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {name}
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--muted)",
                            fontStyle: "italic",
                          }}
                        >
                          Unassigned
                        </span>
                      )}

                      {/* Quick Assign Button */}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAssigneeMenuId(isAssigneeMenuOpen ? null : task.id);
                            setActivePriorityMenuId(null);
                            setAssigneeSearchQuery("");
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            border: "1px dashed var(--line, #cbd5e1)",
                            background: "transparent",
                            color: "var(--muted, #64748b)",
                            fontSize: 9.5,
                            fontWeight: 600,
                            borderRadius: 12,
                            padding: "2px 6px",
                            cursor: "pointer",
                            transition: "all 0.1s ease",
                          }}
                          title="Assign team member"
                        >
                          <UserPlus size={10} />
                          <span>Assign</span>
                        </button>
                      )}

                      {/* Assignee Selection Popover */}
                      {isAssigneeMenuOpen && (
                        <div
                          ref={popoverRef}
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            marginTop: 4,
                            background: "#ffffff",
                            border: "1px solid var(--line, #e2e8f0)",
                            borderRadius: 8,
                            boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
                            zIndex: 60,
                            minWidth: 190,
                            maxWidth: 240,
                            padding: 6,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 6px",
                              background: "#f8fafc",
                              borderRadius: 5,
                              border: "1px solid #e2e8f0",
                              marginBottom: 6,
                            }}
                          >
                            <Search size={11} style={{ color: "#94a3b8" }} />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Search member..."
                              value={assigneeSearchQuery}
                              onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                              style={{
                                border: 0,
                                background: "transparent",
                                outline: "none",
                                fontSize: 11,
                                width: "100%",
                              }}
                            />
                          </div>

                          <div style={{ maxHeight: 160, overflowY: "auto" }}>
                            {filteredPeople.map((p) => {
                              const isAssigned =
                                task.primary_assignee_id === p.id ||
                                task.secondary_assignee_id === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleToggleAssignee(task, p.id)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    width: "100%",
                                    border: 0,
                                    background: isAssigned ? "rgba(22, 124, 88, 0.08)" : "transparent",
                                    color: isAssigned ? "var(--green, #167c58)" : "var(--ink)",
                                    fontWeight: isAssigned ? 700 : 500,
                                    fontSize: 11,
                                    padding: "5px 6px",
                                    borderRadius: 5,
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: "50%",
                                      backgroundColor: getAvatarColor(p.id),
                                      color: "#fff",
                                      fontSize: 8,
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {p.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span
                                    style={{
                                      flex: 1,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {p.name}
                                  </span>
                                  {isAssigned && <Check size={12} />}
                                </button>
                              );
                            })}

                            {filteredPeople.length === 0 && (
                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: "var(--muted)",
                                  textAlign: "center",
                                  padding: "8px 4px",
                                }}
                              >
                                No matching members
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Dropdown (Instant 0ms Move) */}
                    {canEdit && (
                      <div className="kanban-status-form" style={{ marginTop: 6 }}>
                        <select
                          value={task.status_id}
                          aria-label={`Move ${task.title} to status`}
                          onChange={(event) => moveTask(task.id, event.target.value)}
                          style={{
                            width: "100%",
                            background: `${colColor}0e`,
                            border: `1.5px solid ${colColor}4d`,
                            color: colColor,
                            fontWeight: 700,
                            fontSize: "11px",
                            borderRadius: "7px",
                            padding: "5px 8px",
                            cursor: "pointer",
                            outline: "none",
                            transition: "border-color 0.1s ease",
                          }}
                        >
                          {statuses.map((candidate) => (
                            <option
                              key={candidate.id}
                              value={candidate.id}
                              style={{ color: "var(--ink)", background: "var(--surface)" }}
                            >
                              {candidate.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
