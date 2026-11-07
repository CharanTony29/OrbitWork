"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import {
  Calendar,
  Flag,
  UserPlus,
  Loader2,
  Clock,
} from "lucide-react";
import { quickCreateTask } from "@/app/actions";
import DateInput from "@/app/DateInput";

type WorkflowStatus = { id: string; name: string; color: string; category?: string };
type Member = { id: string; label: string };

export default function InlineTaskRow({
  projectId,
  statuses,
  defaultStatusId,
  defaultPriority = "normal",
  members,
  colSpan,
}: {
  projectId: string;
  statuses: WorkflowStatus[];
  defaultStatusId?: string;
  defaultPriority?: "low" | "normal" | "high" | "urgent";
  members: Member[];
  colSpan: number;
}) {
  const initialStatus = defaultStatusId || statuses[0]?.id || "";
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState(initialStatus);
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">(defaultPriority);
  const [dueDate, setDueDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const [activeMenu, setActiveMenu] = useState<
    "assignee" | "date" | "priority" | "estimate" | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultStatusId) {
      setStatusId(defaultStatusId);
    }
  }, [defaultStatusId]);

  useEffect(() => {
    if (defaultPriority) {
      setPriority(defaultPriority);
    }
  }, [defaultPriority]);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        if (!title.trim()) {
          setIsAdding(false);
        }
      }
    }
    if (isAdding) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isAdding, title]);

  const handleSave = () => {
    if (!title.trim() || isPending) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("title", title.trim());
      fd.set("statusId", statusId || initialStatus);
      fd.set("priority", priority);
      if (dueDate) fd.set("dueDate", dueDate);
      if (estimateMinutes) fd.set("estimateMinutes", estimateMinutes);
      if (assigneeId) fd.append("assigneeIds", assigneeId);

      const res = await quickCreateTask(fd);
      if (res?.ok) {
        setTitle("");
        setDueDate("");
        setEstimateMinutes("");
        setAssigneeId("");
        setPriority("normal");
        setActiveMenu(null);
        inputRef.current?.focus();
      }
    });
  };

  const handleCancel = () => {
    setTitle("");
    setDueDate("");
    setEstimateMinutes("");
    setAssigneeId("");
    setPriority("normal");
    setActiveMenu(null);
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const assignedMember = members.find((m) => m.id === assigneeId);

  const priorityColors = {
    urgent: "#ef4444",
    high: "#f59e0b",
    normal: "#3b82f6",
    low: "#94a3b8",
  };

  // Idle state: Clean minimal "◌ Add Task" row pinned to the left column (matching Image 2)
  if (!isAdding) {
    return (
      <tr className="task-data-tr inline-add-task-idle-tr">
        <td className="task-title-cell inline-add-task-idle-td">
          <button
            type="button"
            className="inline-add-task-idle-btn"
            onClick={() => setIsAdding(true)}
            title="Add task in this group"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeDasharray="3 3"
              className="inline-add-task-dashed-circle"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>Add Task</span>
          </button>
        </td>
        <td colSpan={colSpan - 1} className="inline-add-task-empty" />
      </tr>
    );
  }

  // Active state: Input and controls inside the frozen first column (matching screenshot under HOLD)
  return (
    <tr className="task-data-tr inline-task-tr is-active-adding" id="inline-add-task-row">
      <td className="task-title-cell inline-task-active-td">
        <div ref={rowRef} className="inline-add-row-content">
          <div className="inline-add-left">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeDasharray="3 3"
              style={{ flexShrink: 0, opacity: 0.7 }}
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="inline-add-task-input"
              placeholder="Add Task"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending}
              maxLength={240}
            />
          </div>

          <div className="inline-add-right-actions">
            {/* Assignee Icon */}
            <div className="inline-picker-wrap">
              <button
                type="button"
                className={`inline-ctrl-btn${assigneeId ? " has-value" : ""}`}
                onClick={() => setActiveMenu(activeMenu === "assignee" ? null : "assignee")}
                title={assignedMember ? `Assigned: ${assignedMember.label}` : "Assign member"}
              >
                {assignedMember ? (
                  <span className="inline-assigned-avatar">
                    {assignedMember.label.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <UserPlus size={13} />
                )}
              </button>
              {activeMenu === "assignee" && (
                <div className="inline-picker-menu">
                  <span className="inline-picker-title">Assignee</span>
                  <button
                    type="button"
                    className={`inline-picker-item${!assigneeId ? " is-selected" : ""}`}
                    onClick={() => {
                      setAssigneeId("");
                      setActiveMenu(null);
                    }}
                  >
                    Unassigned
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`inline-picker-item${m.id === assigneeId ? " is-selected" : ""}`}
                      onClick={() => {
                        setAssigneeId(m.id);
                        setActiveMenu(null);
                      }}
                    >
                      <span className="assignee-avatar">
                        {m.label.charAt(0).toUpperCase()}
                      </span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Due Date Icon */}
            <div className="inline-picker-wrap">
              <button
                type="button"
                className={`inline-ctrl-btn${dueDate ? " has-value" : ""}`}
                onClick={() => setActiveMenu(activeMenu === "date" ? null : "date")}
                title={dueDate ? `Due: ${dueDate}` : "Set due date"}
              >
                <Calendar size={13} />
                {dueDate && <span className="inline-date-tag">{dueDate.slice(8, 10)}/{dueDate.slice(5, 7)}</span>}
              </button>
              {activeMenu === "date" && (
                <div className="inline-picker-menu inline-date-menu">
                  <span className="inline-picker-title">Due date</span>
                  <DateInput
                    className="inline-date-input"
                    value={dueDate}
                    ariaLabel="Task due date"
                    onChange={(value) => {
                      setDueDate(value);
                      setActiveMenu(null);
                    }}
                  />
                  {dueDate && (
                    <button
                      type="button"
                      className="inline-clear-btn"
                      onClick={() => {
                        setDueDate("");
                        setActiveMenu(null);
                      }}
                    >
                      Clear date
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Priority Flag Icon */}
            <div className="inline-picker-wrap">
              <button
                type="button"
                className="inline-ctrl-btn"
                style={{ color: priorityColors[priority] }}
                onClick={() => setActiveMenu(activeMenu === "priority" ? null : "priority")}
                title={`Priority: ${priority}`}
              >
                <Flag size={13} fill={priority !== "normal" ? "currentColor" : "none"} />
              </button>
              {activeMenu === "priority" && (
                <div className="inline-picker-menu">
                  <span className="inline-picker-title">Priority</span>
                  {(["low", "normal", "high", "urgent"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`inline-picker-item${priority === p ? " is-selected" : ""}`}
                      style={{ color: priorityColors[p] }}
                      onClick={() => {
                        setPriority(p);
                        setActiveMenu(null);
                      }}
                    >
                      <Flag size={12} fill="currentColor" />
                      <span style={{ textTransform: "capitalize" }}>{p}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Estimate Clock Icon */}
            <div className="inline-picker-wrap">
              <button
                type="button"
                className={`inline-ctrl-btn${estimateMinutes ? " has-value" : ""}`}
                onClick={() => setActiveMenu(activeMenu === "estimate" ? null : "estimate")}
                title={estimateMinutes ? `Estimate: ${estimateMinutes}` : "Set estimate"}
              >
                <Clock size={13} />
                {estimateMinutes && <span className="inline-date-tag">{estimateMinutes}</span>}
              </button>
              {activeMenu === "estimate" && (
                <div className="inline-picker-menu inline-date-menu" style={{ minWidth: 180 }}>
                  <span className="inline-picker-title">Estimate (e.g. 2h, 1d)</span>
                  <input
                    type="text"
                    placeholder="e.g. 2h, 1.5d, 30m"
                    className="inline-date-input"
                    value={estimateMinutes}
                    onChange={(e) => setEstimateMinutes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setActiveMenu(null);
                      }
                    }}
                  />
                  <div className="inline-estimate-presets" style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                    {["30m", "1h", "2h", "4h", "1d"].map((val) => (
                      <button
                        key={val}
                        type="button"
                        className="estimate-preset-pill"
                        onClick={() => {
                          setEstimateMinutes(val);
                          setActiveMenu(null);
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  {estimateMinutes && (
                    <button
                      type="button"
                      className="inline-clear-btn"
                      onClick={() => {
                        setEstimateMinutes("");
                        setActiveMenu(null);
                      }}
                    >
                      Clear estimate
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              className="inline-cancel-btn"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </button>

            {/* Save ↵ Button */}
            <button
              type="button"
              className="inline-save-btn"
              onClick={handleSave}
              disabled={!title.trim() || isPending}
              title="Save task (Enter)"
            >
              {isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <span>Save ↵</span>
              )}
            </button>
          </div>
        </div>
      </td>
      <td colSpan={colSpan - 1} className="inline-add-task-empty" />
    </tr>
  );
}
