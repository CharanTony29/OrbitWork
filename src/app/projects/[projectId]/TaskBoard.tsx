"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateTaskStatus } from "@/app/actions";

type Task = { id: string; generated_key: string; title: string; task_type?: string | null; priority: string; status_id: string; due_date: string | null; primary_assignee_id: string | null; secondary_assignee_id: string | null };
type Status = { id: string; name: string; color: string };

export default function TaskBoard({
  projectId,
  tasks,
  statuses,
  people,
  canEdit = true,
}: {
  projectId: string;
  tasks: Task[];
  statuses: Status[];
  people: Map<string, string>;
  canEdit?: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function moveTask(taskId: string, statusId: string) {
    if (!canEdit) return;
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("taskId", taskId);
    data.set("statusId", statusId);
    startTransition(() => { void updateTaskStatus(data); });
  }
  return (
    <div className={`kanban-board${pending ? " is-saving" : ""}`}>
      {statuses.map((status) => (
        <section
          className="kanban-column"
          key={status.id}
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
          <header>
            <span className="status-color" style={{ backgroundColor: status.color }} />
            <h3>{status.name}</h3>
            <span className="count-pill">{tasks.filter((task) => task.status_id === status.id).length}</span>
          </header>
          <div className="kanban-cards">
            {tasks.filter((task) => task.status_id === status.id).map((task) => (
              <article
                className={`kanban-card${dragging === task.id ? " is-dragging" : ""}${!canEdit ? " is-readonly" : ""}`}
                key={task.id}
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
                  <span className="task-key">{task.generated_key}</span>
                  <span className="task-type-badge">{(task.task_type ?? "task").replaceAll("_", " ")}</span>
                </div>
                <Link href={`/projects/${projectId}/tasks/${task.id}`}>{task.title}</Link>
                <div className="kanban-card-meta">
                  <span className={`priority priority-${task.priority}`}>{task.priority}</span>
                  <span>{task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString() : "No due date"}</span>
                </div>
                <div className="kanban-assignees">
                  {[task.primary_assignee_id, task.secondary_assignee_id].filter((id): id is string => Boolean(id)).map((id) => people.get(id) ?? "Team member").join(" · ") || "Unassigned"}
                </div>
                {canEdit && (
                  <form action={updateTaskStatus} className="kanban-status-form">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <select name="statusId" defaultValue={status.id} aria-label={`Move ${task.title} to status`} onChange={(event) => moveTask(task.id, event.target.value)}>
                      {statuses.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                      ))}
                    </select>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
