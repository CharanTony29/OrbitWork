"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { Plus, Pencil, Circle, Check, ChevronRight, CornerDownRight, Loader2 } from "lucide-react";
import { updateTaskField, quickCreateSubtask } from "@/app/actions";

export default function TaskNameCell({
  projectId,
  taskId,
  taskKey,
  title: initialTitle,
  description,
  statusColor = "#87938b",
  hasSubtasks = false,
  isExpanded = false,
  onToggleExpand,
  subtaskCount = 0,
  isSubtask = false,
}: {
  projectId: string;
  taskId: string;
  taskKey: string;
  title: string;
  description?: string;
  statusColor?: string;
  hasSubtasks?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  subtaskCount?: number;
  isSubtask?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [isSubtaskPending, startSubtaskTransition] = useTransition();
  const [isRenamePending, startRenameTransition] = useTransition();

  const editInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleSaveRename = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || trimmed === title) {
      setIsEditing(false);
      return;
    }
    startRenameTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("field", "title");
      fd.set("value", trimmed);
      await updateTaskField(fd);
      setTitle(trimmed);
      setIsEditing(false);
    });
  };

  const handleSubtaskSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!subtaskTitle.trim() || isSubtaskPending) return;

    startSubtaskTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("parentTaskId", taskId);
      fd.set("title", subtaskTitle.trim());

      const res = await quickCreateSubtask(fd);
      if (res?.ok) {
        setSubtaskTitle("");
        setAddingSubtask(false);
      }
    });
  };

  return (
    <div className={`task-name-cell-wrap${isSubtask ? " is-subtask-cell" : ""}`}>
      <div className="task-name-row">
        {/* Subtle Checkbox */}
        <button
          type="button"
          className="task-row-checkbox"
          aria-label="Select task"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="checkbox-box" />
        </button>

        {/* Expand Arrow or Subtask Connector */}
        {isSubtask ? (
          <span className="task-subtask-branch" title="Subtask">
            <CornerDownRight size={13} className="text-muted" />
          </span>
        ) : (
          <button
            type="button"
            className={`task-expand-arrow${isExpanded ? " is-expanded" : ""}${hasSubtasks ? " has-children" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleExpand) onToggleExpand();
            }}
            disabled={!hasSubtasks}
            aria-label={hasSubtasks ? (isExpanded ? "Collapse subtasks" : "Expand subtasks") : undefined}
          >
            <ChevronRight size={12} />
          </button>
        )}

        {/* Status circle */}
        <span className="task-status-dot" style={{ color: statusColor }}>
          <Circle size={12} strokeWidth={3} />
        </span>

        {/* Task Title / Inline Edit */}
        {isEditing ? (
          <div className="task-inline-edit-box" onClick={(e) => e.stopPropagation()}>
            <input
              ref={editInputRef}
              type="text"
              className="task-title-input-active"
              defaultValue={title}
              onBlur={(e) => handleSaveRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveRename(e.currentTarget.value);
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
              disabled={isRenamePending}
              maxLength={240}
            />
            {isRenamePending && <Loader2 size={12} className="animate-spin text-muted" />}
          </div>
        ) : (
          <div className="task-title-and-badges">
            <Link
              href={`/projects/${projectId}/tasks/${taskId}`}
              className="task-title-link"
              title="Click to view task details"
            >
              {title}
            </Link>
            {hasSubtasks && subtaskCount > 0 && (
              <span
                className="task-subtasks-count"
                title={`${subtaskCount} subtask(s)`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleExpand) onToggleExpand();
                }}
              >
                {subtaskCount}
              </span>
            )}
          </div>
        )}

        {/* Hover Action Buttons (ClickUp style) */}
        {!isEditing && (
          <div className="task-row-hover-actions">
            {!isSubtask && (
              <button
                type="button"
                className="task-hover-btn"
                title="Add Subtask"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingSubtask(true);
                  setTimeout(() => subtaskInputRef.current?.focus(), 50);
                }}
              >
                <Plus size={12} />
              </button>
            )}
            <button
              type="button"
              className="task-hover-btn"
              title="Edit Task Name"
              onClick={handleStartEdit}
            >
              <Pencil size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Description if present */}
      {description && !isEditing && (
        <small className="sheet-description">{description}</small>
      )}

      {/* Quick Add Subtask Input Form */}
      {addingSubtask && (
        <form
          className="quick-subtask-form"
          onSubmit={handleSubtaskSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={subtaskInputRef}
            type="text"
            className="quick-subtask-input"
            placeholder="Subtask name (Enter to save, Esc to cancel)…"
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            disabled={isSubtaskPending}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAddingSubtask(false);
                setSubtaskTitle("");
              }
            }}
          />
          <button
            type="submit"
            className="quick-subtask-save"
            disabled={!subtaskTitle.trim() || isSubtaskPending}
          >
            {isSubtaskPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          </button>
          <button
            type="button"
            className="quick-subtask-cancel"
            onClick={() => {
              setAddingSubtask(false);
              setSubtaskTitle("");
            }}
          >
            ×
          </button>
        </form>
      )}
    </div>
  );
}
