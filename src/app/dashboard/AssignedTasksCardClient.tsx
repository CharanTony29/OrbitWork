"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import FavoriteButton from "@/app/FavoriteButton";

export type DashboardAssignedTaskItem = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  priority: string;
  statusName: string | null;
  statusColor: string | null;
  statusCategory: string | null;
  dueDate: string | null;
  isUrgent: boolean;
  isNew: boolean;
  isInProgress: boolean;
  isFavorited: boolean;
};

type TaskFilter = "all" | "urgent" | "new" | "in_progress";

type Props = {
  tasks: DashboardAssignedTaskItem[];
  tableAvailable: boolean;
};

export default function AssignedTasksCardClient({
  tasks,
  tableAvailable,
}: Props) {
  const [filter, setFilter] = useState<TaskFilter>("all");

  const counts = useMemo(
    () => ({
      all: tasks.length,
      urgent: tasks.filter((t) => t.isUrgent).length,
      new: tasks.filter((t) => t.isNew).length,
      in_progress: tasks.filter((t) => t.isInProgress).length,
    }),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    switch (filter) {
      case "urgent":
        return tasks.filter((t) => t.isUrgent);
      case "new":
        return tasks.filter((t) => t.isNew);
      case "in_progress":
        return tasks.filter((t) => t.isInProgress);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  return (
    <article className="user-dash-panel">
      <header className="user-dash-panel-head">
        <div>
          <p className="eyebrow">MY WORK</p>
          <h3>
            <Sparkles size={15} style={{ color: "var(--green)" }} />
            <span>Assigned Tasks</span>
            <span className="count-pill">{visibleTasks.length}</span>
          </h3>
        </div>
        <Link href="/inbox" className="user-dash-all-link">
          View Inbox <ArrowUpRight size={13} />
        </Link>
      </header>

      <div
        className="user-dash-filter-pills"
        role="tablist"
        aria-label="Filter assigned tasks"
      >
        {(
          [
            { key: "all", label: `All Open (${counts.all})` },
            { key: "urgent", label: `Urgent (${counts.urgent})` },
            { key: "new", label: `New (${counts.new})` },
            { key: "in_progress", label: `In Progress (${counts.in_progress})` },
          ] as { key: TaskFilter; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={`user-dash-filter-pill${filter === item.key ? " is-active" : ""}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="user-task-list">
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => (
            <div className="user-task-row" key={task.id}>
              <Link
                href={`/projects/${task.projectId}/tasks/${task.id}`}
                className="user-task-row-link"
              >
                <span className="user-task-row-main">
                  <strong>{task.title}</strong>
                  <small>
                    {task.projectName}
                    {task.dueDate ? ` · Due ${task.dueDate}` : ""}
                  </small>
                </span>
                <span className="user-task-row-badges">
                  <span className={`priority-pill priority-${task.priority}`}>
                    {task.priority}
                  </span>
                  {task.statusName && (
                    <span
                      className="user-task-status-pill"
                      style={{
                        borderColor: task.statusColor ?? undefined,
                        color: task.statusColor ?? undefined,
                      }}
                    >
                      {task.statusName}
                    </span>
                  )}
                </span>
              </Link>
              {tableAvailable && (
                <FavoriteButton
                  entityType="task"
                  entityId={task.id}
                  projectId={task.projectId}
                  title={task.title}
                  subtitle={task.projectName}
                  initialFavorited={task.isFavorited}
                  compact
                />
              )}
            </div>
          ))
        ) : (
          <div className="user-dash-empty">
            <p>
              {filter === "all"
                ? "You have no open assigned tasks right now."
                : "No tasks match this filter."}
            </p>
            <small>
              Tasks assigned to you across your projects will show up here.
            </small>
          </div>
        )}
      </div>
    </article>
  );
}
