"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { updateTaskProgress } from "@/app/actions";

export default function TaskDetailProgress({
  projectId,
  taskId,
  initialProgress = 0,
  canEdit = true,
  checklistTotal = 0,
  checklistCompleted = 0,
}: {
  projectId: string;
  taskId: string;
  initialProgress: number;
  canEdit?: boolean;
  checklistTotal?: number;
  checklistCompleted?: number;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProgress(initialProgress);
  }, [initialProgress]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveProgress = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setProgress(clamped);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("progress", String(clamped));
      await updateTaskProgress(fd);
    });
  };

  const autoFromChecklist = () => {
    if (!checklistTotal) return;
    const calc = Math.round((checklistCompleted / checklistTotal) * 100);
    saveProgress(calc);
    setOpen(false);
  };

  return (
    <div className="task-detail-progress-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`task-detail-progress${canEdit ? " is-clickable" : ""}`}
        onClick={() => {
          if (canEdit) setOpen((prev) => !prev);
        }}
        title={canEdit ? "Click to adjust progress percentage" : "Task progress"}
        aria-label="Manage task progress"
      >
        <div className="progress-top-label">
          <span>{progress}%</span>
          {canEdit && <ChevronDown size={11} className={`progress-arrow${open ? " is-open" : ""}`} />}
        </div>
        <div className="progress-bar-bg">
          <i
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? "#16a34a" : progress > 50 ? "#059669" : "#10b981",
            }}
          />
        </div>
        <small>complete</small>
      </button>

      {/* Interactive Popover to Manage Progress Bar */}
      {open && canEdit && (
        <div className="progress-popover-menu" onClick={(e) => e.stopPropagation()}>
          <div className="progress-popover-header">
            <strong>Update progress</strong>
            <span>{progress}%</span>
          </div>

          {/* Slider */}
          <div className="progress-slider-row">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => saveProgress(Number(e.target.value))}
              className="progress-range-slider"
            />
          </div>

          {/* Preset Buttons: 0%, 25%, 50%, 75%, 100% */}
          <div className="progress-presets">
            {[0, 25, 50, 75, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                className={`progress-preset-btn${progress === preset ? " is-selected" : ""}`}
                onClick={() => {
                  saveProgress(preset);
                  setOpen(false);
                }}
              >
                {preset}%
              </button>
            ))}
          </div>

          {/* Auto Calculate from Checklists if available */}
          {checklistTotal > 0 && (
            <button
              type="button"
              className="progress-auto-btn"
              onClick={autoFromChecklist}
            >
              <Sparkles size={12} />
              <span>
                Auto from checklist ({checklistCompleted}/{checklistTotal})
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
