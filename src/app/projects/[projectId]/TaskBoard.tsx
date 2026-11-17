"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateTaskStatus } from "@/app/actions";

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

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getSmartStatusColor(status?: { name?: string; color?: string; category?: string }) {
  const name = (status?.name ?? "").toLowerCase();
  if (name.includes("new") || name.includes("to do") || name.includes("todo") || name.includes("backlog") || status?.category === "not_started") {
    return "#0284c7"; // Sky / Ocean Blue for New
  }
  if (name.includes("progress") || name.includes("doing") || name.includes("active") || status?.category === "in_progress") {
    return "#2563eb"; // Royal Blue for In Progress
  }
  if (name.includes("hold") || name.includes("block") || name.includes("wait")) {
    return "#d97706"; // Amber for On Hold
  }
  if (name.includes("review") || name.includes("qa") || name.includes("test")) {
    return "#9333ea"; // Purple for Review
  }
  if (name.includes("complete") || name.includes("done") || name.includes("closed") || status?.category === "completed") {
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
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const handleUpdated = () => router.refresh();
    window.addEventListener("orbitwork:tasks-updated", handleUpdated);
    return () => window.removeEventListener("orbitwork:tasks-updated", handleUpdated);
  }, [router]);

  function moveTask(taskId: string, statusId: string) {
    if (!canEdit) return;
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("taskId", taskId);
    data.set("statusId", statusId);
    startTransition(() => {
      void updateTaskStatus(data);
    });
  }

  return (
    <div className={`kanban-board${pending ? " is-saving" : ""}`}>
      {statuses.map((status) => {
        const colColor = getSmartStatusColor(status);
        const columnTasks = tasks.filter((task) => task.status_id === status.id);

        return (
          <section
            className="kanban-column"
            key={status.id}
            style={{ borderTop: `3px solid ${colColor}` }}
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
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8 }}>
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
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{status.name}</h3>
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

            <div className="kanban-cards">
              {columnTasks.map((task) => {
                const assigneeIds = [task.primary_assignee_id, task.secondary_assignee_id].filter(
                  (id): id is string => Boolean(id)
                );

                return (
                  <article
                    className={`kanban-card${dragging === task.id ? " is-dragging" : ""}${!canEdit ? " is-readonly" : ""}`}
                    key={task.id}
                    tabIndex={0}
                    role="article"
                    aria-label={`Task: ${task.title}`}
                    draggable={canEdit}
                    onDragStart={(event) => {
                      if (!canEdit) return;
                      setDragging(task.id);
                      event.dataTransfer.setData("text/task-id", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragging(null)}
                  >
                    <div className="kanban-card-heading">
                      <Link href={`/projects/${projectId}/tasks/${task.id}`} className="kanban-card-title">
                        {task.title}
                      </Link>
                      <span className="task-type-badge">
                        {(task.task_type ?? "task").replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="kanban-card-meta">
                      <span className={`priority priority-${task.priority}`}>{task.priority}</span>
                      <span>
                        {task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString() : "No due date"}
                      </span>
                    </div>

                    <div className="kanban-assignees" style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", margin: "6px 0" }}>
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
                              <span style={{ maxWidth: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {name}
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>Unassigned</span>
                      )}
                    </div>

                    {canEdit && (
                      <form action={updateTaskStatus} className="kanban-status-form" style={{ marginTop: 4 }}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <select
                          name="statusId"
                          defaultValue={status.id}
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
                      </form>
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
