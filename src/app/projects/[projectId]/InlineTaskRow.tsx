"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import {
  Circle,
  Calendar,
  Flag,
  UserPlus,
  CornerDownLeft,
  Loader2,
  Clock,
  Tag,
} from "lucide-react";
import { quickCreateTask } from "@/app/actions";
import { formatEstimate, parseEstimateToMinutes } from "@/lib/work";

type WorkflowStatus = { id: string; name: string; color: string; category?: string };
type Member = { id: string; label: string };

export default function InlineTaskRow({
  projectId,
  statuses,
  members,
  colSpan,
}: {
  projectId: string;
  statuses: WorkflowStatus[];
  members: Member[];
  colSpan: number;
}) {
  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [dueDate, setDueDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const [activeMenu, setActiveMenu] = useState<
    "status" | "assignee" | "date" | "priority" | "estimate" | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = () => {
    if (!title.trim() || isPending) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("title", title.trim());
      fd.set("statusId", statusId || statuses[0]?.id);
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const currentStatus = statuses.find((s) => s.id === statusId) ?? statuses[0];
  const assignedMember = members.find((m) => m.id === assigneeId);

  const priorityColors = {
    low: "#718078",
    normal: "#2e7eed",
    high: "#e69122",
    urgent: "#d13c2c",
  };

  return (
    <tr className="inline-task-tr" id="inline-add-task-row">
      <td colSpan={colSpan} className="inline-task-td">
        <div
          ref={rowRef}
          className={`inline-task-bar${title.trim() ? " is-dirty" : ""}${isPending ? " is-pending" : ""}`}
        >
          {/* Status radio circle icon on the left */}
          <div className="inline-picker-wrap">
            <button
              type="button"
              className="inline-status-circle"
              style={{ color: currentStatus?.color ?? "#87938b" }}
              onClick={() => setActiveMenu(activeMenu === "status" ? null : "status")}
              title={`Status: ${currentStatus?.name}`}
            >
              <Circle size={15} strokeWidth={2.8} />
            </button>
            {activeMenu === "status" && (
              <div className="inline-picker-menu">
                <span className="inline-picker-title">Select Status</span>
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`inline-picker-item${s.id === statusId ? " is-selected" : ""}`}
                    onClick={() => {
                      setStatusId(s.id);
                      setActiveMenu(null);
                    }}
                  >
                    <i className="status-color" style={{ backgroundColor: s.color }} />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main title input */}
          <input
            ref={inputRef}
            type="text"
            className="inline-task-input"
            placeholder="Task Name or type '/' for commands"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            maxLength={240}
          />

          {/* Quick attribute icons right inside the row (like image 2) */}
          <div className="inline-task-controls">
            {/* Assignee Icon Button */}
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
                  <UserPlus size={14} />
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

            {/* Due Date Calendar Icon Button */}
            <div className="inline-picker-wrap">
              <button
                type="button"
                className={`inline-ctrl-btn${dueDate ? " has-value" : ""}`}
                onClick={() => setActiveMenu(activeMenu === "date" ? null : "date")}
                title={dueDate ? `Due: ${dueDate}` : "Set due date"}
              >
                <Calendar size={14} />
                {dueDate && <span className="inline-date-tag">{dueDate.slice(5)}</span>}
              </button>
              {activeMenu === "date" && (
                <div className="inline-picker-menu inline-date-menu">
                  <span className="inline-picker-title">Due date</span>
                  <input
                    type="date"
                    className="inline-date-input"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
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

            {/* Priority Flag Icon Button */}
            <div className="inline-picker-wrap">
              <button
                type="button"
                className="inline-ctrl-btn"
                style={{ color: priorityColors[priority] }}
                onClick={() => setActiveMenu(activeMenu === "priority" ? null : "priority")}
                title={`Priority: ${priority}`}
              >
                <Flag size={14} fill={priority !== "normal" ? "currentColor" : "none"} />
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

            {/* Estimate Icon Button */}
            <div className="inline-picker-wrap">
              <button
                type="button"
                className={`inline-ctrl-btn${estimateMinutes ? " has-value" : ""}`}
                onClick={() => setActiveMenu(activeMenu === "estimate" ? null : "estimate")}
                title={estimateMinutes ? `Estimate: ${estimateMinutes}` : "Set estimate (e.g. 2h, 1d, 3w)"}
              >
                <Clock size={14} />
                {estimateMinutes && <span className="inline-date-tag">{estimateMinutes}</span>}
              </button>
              {activeMenu === "estimate" && (
                <div className="inline-picker-menu inline-date-menu" style={{ minWidth: 190 }}>
                  <span className="inline-picker-title">Estimate (m, h, d, w, mo)</span>
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
                    {["30m", "1h", "2h", "4h", "1d", "1w"].map((val) => (
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
            {title && (
              <button
                type="button"
                className="inline-cancel-btn"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </button>
            )}

            {/* Save ↵ Button */}
            <button
              type="button"
              className="inline-save-btn"
              onClick={handleSave}
              disabled={!title.trim() || isPending}
              title="Save (Enter)"
            >
              {isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <>
                  <span>Save</span>
                  <CornerDownLeft size={11} className="inline-enter-icon" />
                </>
              )}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
