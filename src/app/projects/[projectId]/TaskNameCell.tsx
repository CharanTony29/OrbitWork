"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Circle, Check, ChevronRight, Loader2, FileText, AlignLeft, Paperclip } from "lucide-react";
import { updateTaskField, quickCreateSubtask, updateTaskStatus } from "@/app/actions";

export default function TaskNameCell({
  projectId,
  taskId,
  taskKey,
  title: initialTitle,
  taskType = "task",
  tags = [],
  description,
  statusColor = "#87938b",
  hasSubtasks = false,
  isExpanded = false,
  onToggleExpand,
  subtaskCount = 0,
  hasAttachments = false,
  isSubtask = false,
  canEdit = true,
  isCompleted = false,
  completedStatusId,
  initialStatusId,
}: {
  projectId: string;
  taskId: string;
  taskKey: string;
  title: string;
  taskType?: string;
  tags?: string[];
  description?: string;
  statusColor?: string;
  hasSubtasks?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  subtaskCount?: number;
  hasAttachments?: boolean;
  isSubtask?: boolean;
  canEdit?: boolean;
  isCompleted?: boolean;
  completedStatusId?: string;
  initialStatusId?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [completed, setCompleted] = useState(isCompleted);
  const [isEditing, setIsEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showDescOverlay, setShowDescOverlay] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSubtaskPending, startSubtaskTransition] = useTransition();
  const [isRenamePending, startRenameTransition] = useTransition();
  const [isStatusPending, startStatusTransition] = useTransition();

  const handleMouseEnter = () => {
    if (!description?.trim()) return;
    hoverTimerRef.current = setTimeout(() => {
      setShowDescOverlay(true);
    }, 2000); // 2 seconds
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowDescOverlay(false);
  };


  useEffect(() => {
    setCompleted(isCompleted);
  }, [isCompleted]);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const editInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit || isStatusPending) return;

    const targetStatusId = completed ? initialStatusId : completedStatusId;
    if (!targetStatusId) return;

    const nextCompleted = !completed;
    setCompleted(nextCompleted);

    startStatusTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("statusId", targetStatusId);
      await updateTaskStatus(fd);
    });
  };

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
    <div
      className={`task-name-cell-wrap${isSubtask ? " is-subtask-cell" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="task-name-row">
        {/* Interactive Checkbox */}
        <button
          type="button"
          className={`task-row-checkbox${completed ? " is-checked" : ""}`}
          aria-label={completed ? "Mark task incomplete" : "Mark task complete"}
          title={
            !canEdit
              ? "View-only"
              : completed
              ? "Mark incomplete"
              : "Mark complete"
          }
          disabled={!canEdit || isStatusPending}
          onClick={handleToggleComplete}
        >
          <span className="checkbox-box">
            {isStatusPending ? (
              <Loader2 size={9} className="animate-spin" />
            ) : completed ? (
              <Check size={10} strokeWidth={3} />
            ) : null}
          </span>
        </button>

        {/* Expand Arrow for parents */}
        {!isSubtask && (
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
          <Circle size={11} strokeWidth={2.5} />
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
              className={`task-title-link${completed ? " is-completed-title" : ""}`}
              title="Click to view task details"
            >
              {title}
            </Link>
            <span className="task-type-badge">{taskType.replaceAll("_", " ")}</span>
            {tags.slice(0, 2).map((tag) => <span className="task-tag-badge" key={tag}>{tag}</span>)}
            {tags.length > 2 && <span className="task-tag-badge task-tag-count">+{tags.length - 2}</span>}
            {Boolean(description && description.trim()) && (
              <span className="task-meta-indicator" title="Has description: hover 2s to preview">
                <AlignLeft size={11} />
              </span>
            )}
            {hasAttachments && (
              <span className="task-meta-indicator" title="Has attachments / documents">
                <Paperclip size={11} />
              </span>
            )}
            {hasSubtasks && subtaskCount > 0 && (
              <span
                className="task-subtasks-count"
                title={`${subtaskCount} subtask(s)`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleExpand) onToggleExpand();
                }}
              >
                %{subtaskCount}
              </span>
            )}
          </div>
        )}

        {/* Hover Action Buttons (ClickUp style) */}
        {!isEditing && canEdit && (
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

      {/* 2-Second Hover Description Overlay Popover */}
      {showDescOverlay && description && (
        <div
          className="task-desc-overlay-popup"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: isSubtask ? 24 : 0,
            zIndex: 1000,
            width: 320,
            maxWidth: "90vw",
            padding: "10px 14px",
            background: "var(--paper, #fff)",
            color: "var(--ink, #1e293b)",
            borderRadius: 8,
            border: "1px solid var(--line, #cbd5e1)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green, #167c58)", textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <FileText size={11} />
            <span>{title}</span>
          </div>
          <p style={{ margin: 0, color: "var(--ink)", wordBreak: "break-word" }}>{description}</p>
        </div>
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
