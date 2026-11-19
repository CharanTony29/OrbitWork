"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GitBranch, Link2, Loader2, X, Search } from "lucide-react";
import { createTaskDependency, removeTaskDependency } from "@/app/actions";
import { showAppToast } from "@/lib/app-feedback";

export type DependencyRelation = "blocks" | "blocked_by" | "related" | "duplicate";

export interface LinkedTaskItem {
  id: string;
  generated_key?: string | null;
  title: string;
}

export interface DependencyItem {
  linked_task_id: string;
  relation: DependencyRelation;
  linked_task?: LinkedTaskItem | null;
}

interface TaskDependenciesSectionProps {
  projectId: string;
  taskId: string;
  canEdit: boolean;
  initialDependencies: DependencyItem[];
  projectTasks: LinkedTaskItem[];
}

const RELATION_OPTIONS: { id: DependencyRelation; label: string; badgeLabel: string; hint: string }[] = [
  { id: "related", label: "Related", badgeLabel: "RELATED", hint: "Relates to another task" },
  { id: "blocks", label: "Blocks", badgeLabel: "BLOCKS", hint: "This task must finish first" },
  { id: "blocked_by", label: "Blocked by", badgeLabel: "BLOCKED BY", hint: "Waiting on another task" },
  { id: "duplicate", label: "Duplicate of", badgeLabel: "DUPLICATE", hint: "Duplicate of another task" },
];

export default function TaskDependenciesSection({
  projectId,
  taskId,
  canEdit,
  initialDependencies,
  projectTasks,
}: TaskDependenciesSectionProps) {
  const [dependencies, setDependencies] = useState<DependencyItem[]>(initialDependencies);
  const [selectedRelation, setSelectedRelation] = useState<DependencyRelation>("related");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Filter out the current task and any tasks already linked
  const linkedTaskIds = new Set(dependencies.map((d) => d.linked_task_id));
  const availableTasks = projectTasks.filter(
    (item) => item.id !== taskId && !linkedTaskIds.has(item.id)
  );

  const filteredAvailableTasks = searchFilter.trim()
    ? availableTasks.filter((t) => {
        const q = searchFilter.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.generated_key && t.generated_key.toLowerCase().includes(q))
        );
      })
    : availableTasks;

  const handleLinkTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || isPending) return;

    const targetTask = projectTasks.find((t) => t.id === selectedTaskId);

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("linkedTaskId", selectedTaskId);
    fd.set("relation", selectedRelation);

    // Optimistically update
    const newDep: DependencyItem = {
      linked_task_id: selectedTaskId,
      relation: selectedRelation,
      linked_task: targetTask || null,
    };
    setDependencies((prev) => [...prev, newDep]);
    setSelectedTaskId("");
    setSearchFilter("");

    startTransition(async () => {
      try {
        await createTaskDependency(fd);
        showAppToast("Task dependency linked successfully.", "success", {
          title: "Linked",
        });
      } catch (err: any) {
        // Rollback on error
        setDependencies((prev) =>
          prev.filter(
            (d) => !(d.linked_task_id === selectedTaskId && d.relation === selectedRelation)
          )
        );
        showAppToast(err?.message || "Failed to link task dependency", "error", {
          title: "Link failed",
        });
      }
    });
  };

  const handleRemoveDependency = async (dep: DependencyItem) => {
    if (isPending) return;

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("linkedTaskId", dep.linked_task_id);
    fd.set("relation", dep.relation);

    // Optimistic removal
    setDependencies((prev) =>
      prev.filter(
        (d) => !(d.linked_task_id === dep.linked_task_id && d.relation === dep.relation)
      )
    );

    startTransition(async () => {
      try {
        await removeTaskDependency(fd);
        showAppToast("Task dependency removed.", "info", {
          title: "Removed",
        });
      } catch (err: any) {
        // Rollback
        setDependencies((prev) => [...prev, dep]);
        showAppToast(err?.message || "Failed to remove task dependency", "error", {
          title: "Error",
        });
      }
    });
  };

  return (
    <section className="task-dependencies">
      {/* Header */}
      <div className="relationship-heading">
        <div>
          <p className="eyebrow">RELATED WORK</p>
          <h2>
            Dependencies <span className="count-pill">{dependencies.length}</span>
          </h2>
        </div>
        <div className="relationship-header-icon">
          <GitBranch size={17} />
        </div>
      </div>

      {/* Linked Dependencies List */}
      <div className="dependency-list">
        {dependencies.map((dependency) => {
          const linked = dependency.linked_task;
          const relOpt =
            RELATION_OPTIONS.find((r) => r.id === dependency.relation) || RELATION_OPTIONS[0];

          return (
            <div
              className="dependency-row"
              key={`${dependency.linked_task_id}-${dependency.relation}`}
            >
              <span className={`dependency-badge rel-${dependency.relation}`}>
                {relOpt.badgeLabel}
              </span>

              {linked ? (
                <Link
                  href={`/projects/${projectId}/tasks/${linked.id}`}
                  className="dependency-task-link"
                  title={linked.title}
                >
                  {linked.generated_key && (
                    <span className="dependency-task-key">{linked.generated_key}</span>
                  )}
                  <span className="dependency-task-title">{linked.title}</span>
                </Link>
              ) : (
                <span className="dependency-task-title muted">Unknown task</span>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemoveDependency(dependency)}
                  className="dependency-remove-btn"
                  aria-label="Remove dependency"
                  title="Remove dependency"
                  disabled={isPending}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}

        {dependencies.length === 0 && (
          <div className="relationship-empty-state">
            <GitBranch size={22} className="empty-state-icon" />
            <p>No dependencies linked yet</p>
            <small>Link tasks that block this task, are blocked by it, or are related.</small>
          </div>
        )}
      </div>

      {/* Link New Dependency Form */}
      {canEdit && (
        <form onSubmit={handleLinkTask} className="task-dependency-link-form">
          {/* Relation Selector Pills */}
          <div className="dependency-relation-selector">
            <label className="dependency-field-label">Relationship Type</label>
            <div className="dependency-relation-pills">
              {RELATION_OPTIONS.map((opt) => {
                const isActive = selectedRelation === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedRelation(opt.id)}
                    className={`dependency-relation-pill rel-${opt.id} ${isActive ? "is-active" : ""}`}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task Selector */}
          <div className="dependency-task-selector">
            <label className="dependency-field-label">
              Choose Task to Link
              {availableTasks.length > 5 && (
                <span className="dependency-filter-count">({availableTasks.length} available)</span>
              )}
            </label>

            {availableTasks.length > 5 && (
              <div className="dependency-search-box">
                <Search size={13} className="dependency-search-icon" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter tasks by key or title…"
                  className="dependency-search-input"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter("")}
                    className="dependency-search-clear"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              required
              className="dependency-task-dropdown"
              disabled={availableTasks.length === 0 || isPending}
            >
              <option value="" disabled>
                {availableTasks.length === 0
                  ? "All project tasks are already linked"
                  : "Select a task to link…"}
              </option>
              {filteredAvailableTasks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.generated_key ? `[${item.generated_key}] ` : ""}
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedTaskId || availableTasks.length === 0 || isPending}
            className="dependency-submit-button"
          >
            {isPending ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <Link2 size={13} />
            )}
            <span>{isPending ? "Linking…" : "+ Link task"}</span>
          </button>
        </form>
      )}
    </section>
  );
}
