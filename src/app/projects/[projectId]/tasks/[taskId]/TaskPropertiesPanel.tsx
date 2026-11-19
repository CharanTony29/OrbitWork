"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoSaveTaskProperty, deleteTask } from "@/app/actions";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import DateInput from "@/app/DateInput";
import AssigneePicker from "../../AssigneePicker";

type StatusOption = {
  id: string;
  name: string;
  color: string;
};

type MemberOption = {
  id: string;
  label: string;
  avatarUrl?: string | null;
};

type Props = {
  projectId: string;
  taskId: string;
  canEdit: boolean;
  isSubtask?: boolean;
  members?: MemberOption[];
  initialAssignees?: string[];
  statuses: StatusOption[];
  initialStatusId: string;
  initialPriority: "low" | "normal" | "high" | "urgent";
  initialStartDate: string | null;
  initialDueDate: string | null;
  initialEstimateFormatted: string;
  billableFormatted: string;
  remainingLabel: string;
  remainingStatus: string;
  createdByLabel: string;
  createdAtFormatted: string;
};

export default function TaskPropertiesPanel({
  projectId,
  taskId,
  canEdit,
  isSubtask = false,
  members = [],
  initialAssignees = [],
  statuses,
  initialStatusId,
  initialPriority,
  initialStartDate,
  initialDueDate,
  initialEstimateFormatted,
  billableFormatted,
  remainingLabel,
  remainingStatus,
  createdByLabel,
  createdAtFormatted,
}: Props) {
  const [statusId, setStatusId] = useState(initialStatusId);
  const [priority, setPriority] = useState(initialPriority);
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const [estimate, setEstimate] = useState(initialEstimateFormatted);

  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteTask = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    try {
      const res = await deleteTask(fd);
      if (res.ok) {
        router.push(`/projects/${projectId}`);
      } else {
        setDeleteError(res.error || "Failed to delete task");
        setIsDeleting(false);
      }
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete task");
      setIsDeleting(false);
    }
  };

  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const currentStatus = statuses.find((s) => s.id === statusId);

  function saveField(
    field: "status_id" | "priority" | "start_date" | "due_date" | "estimate_minutes",
    value: string
  ) {
    setSaveState("saving");
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("field", field);
    fd.set("value", value);

    startTransition(async () => {
      const res = await autoSaveTaskProperty(fd);
      if (res.ok) {
        setSaveState("saved");
      } else {
        setSaveState("error");
        setErrorMsg(res.error ?? "Could not save change.");
      }
    });
  }

  return (
    <section className="task-properties" aria-label="Task properties">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p className="eyebrow" style={{ margin: 0 }}>PROPERTIES</p>
        {canEdit && saveState && (
          <span
            role="status"
            aria-live="polite"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color:
                saveState === "error"
                  ? "#dc2626"
                  : saveState === "saving"
                  ? "var(--muted)"
                  : "var(--green)",
            }}
          >
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Auto-saved" : "Error"}
          </span>
        )}
      </div>

      {errorMsg && (
        <p className="error" role="alert" style={{ margin: "0 0 10px", fontSize: 11.5 }}>
          {errorMsg}
        </p>
      )}

      <label className="detail-field">
        Status
        {canEdit ? (
          <select
            name="statusId"
            value={statusId}
            onChange={(e) => {
              const next = e.currentTarget.value;
              setStatusId(next);
              saveField("status_id", next);
            }}
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        ) : (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: `1px solid ${currentStatus?.color ?? "#cbd5cd"}`,
              color: currentStatus?.color ?? "#526057",
              background: `${currentStatus?.color ?? "#526057"}12`,
              fontWeight: 500,
              fontSize: "12px",
              width: "fit-content",
              marginTop: "4px",
            }}
          >
            <i
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: currentStatus?.color ?? "#526057",
                display: "inline-block",
              }}
            />
            {currentStatus?.name ?? "Unknown"}
          </div>
        )}
      </label>

      <label className="detail-field">
        Priority
        {canEdit ? (
          <select
            name="priority"
            value={priority}
            onChange={(e) => {
              const next = e.currentTarget.value as "low" | "normal" | "high" | "urgent";
              setPriority(next);
              saveField("priority", next);
            }}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        ) : (
          <span
            className={`priority-pill priority-${priority}`}
            style={{ width: "fit-content", marginTop: "4px", textTransform: "capitalize" }}
          >
            {priority}
          </span>
        )}
      </label>

      <label className="detail-field">
        Start date
        {canEdit ? (
          <DateInput
            name="startDate"
            value={startDate}
            onChange={(nextVal) => {
              setStartDate(nextVal);
              saveField("start_date", nextVal);
            }}
          />
        ) : (
          <span style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>
            {startDate
              ? new Date(`${startDate}T00:00:00`).toLocaleDateString()
              : "Not set"}
          </span>
        )}
      </label>

      <label className="detail-field">
        Due date
        {canEdit ? (
          <DateInput
            name="dueDate"
            value={dueDate}
            onChange={(nextVal) => {
              setDueDate(nextVal);
              saveField("due_date", nextVal);
            }}
          />
        ) : (
          <span style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>
            {dueDate
              ? new Date(`${dueDate}T00:00:00`).toLocaleDateString()
              : "No due date"}
          </span>
        )}
      </label>

      <label className="detail-field">
        Estimate (e.g. 2h, 1d, 3w, 30m)
        {canEdit ? (
          <input
            name="estimateMinutes"
            type="text"
            placeholder="e.g. 2h, 1d, 3w, 30m"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            onBlur={() => {
              saveField("estimate_minutes", estimate);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <span style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>
            {estimate || "None"}
          </span>
        )}
      </label>

      <div className="property-line">
        <span>Worked (Billable)</span>
        <strong>{billableFormatted}</strong>
      </div>
      <div className="property-line">
        <span>Remaining / Added</span>
        <strong className={`remaining-badge is-${remainingStatus}`}>
          {remainingLabel}
        </strong>
      </div>
      <div className="property-line property-line-assignees">
        <span>Assignees</span>
        <div>
          {canEdit ? (
            <AssigneePicker
              projectId={projectId}
              taskId={taskId}
              members={members}
              initialAssignees={initialAssignees}
            />
          ) : (
            <strong>
              {initialAssignees.length > 0
                ? members
                    .filter((m) => initialAssignees.includes(m.id))
                    .map((m) => m.label)
                    .join(", ") || "Unassigned"
                : "Unassigned"}
            </strong>
          )}
        </div>
      </div>
      <div className="property-line">
        <span>Created by</span>
        <strong>{createdByLabel}</strong>
      </div>
      <div className="property-line">
        <span>Created</span>
        <strong>{createdAtFormatted}</strong>
      </div>

      {canEdit && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line, #e2e8f0)" }}>
          <p className="eyebrow" style={{ margin: "0 0 8px", color: "#dc2626" }}>DANGER ZONE</p>
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "7px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#dc2626",
                background: "rgba(220, 38, 38, 0.06)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                borderRadius: 7,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220, 38, 38, 0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(220, 38, 38, 0.06)"; }}
            >
              <Trash2 size={13} />
              <span>Delete Task</span>
            </button>
          ) : (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#991b1b" }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Permanently delete this task and all related subtasks, checklists, and attachments?</span>
              </div>
              {deleteError && (
                <p style={{ margin: 0, fontSize: 11.5, color: "#dc2626" }}>{deleteError}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={isDeleting}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#ffffff",
                    background: "#dc2626",
                    border: 0,
                    borderRadius: 6,
                    cursor: isDeleting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {isDeleting && <Loader2 size={12} className="spin" />}
                  <span>{isDeleting ? "Deleting..." : "Yes, Delete"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={{
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "#64748b",
                    background: "transparent",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
