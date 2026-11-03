"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useTransition, useRef, useState, useCallback, Fragment } from "react";
import { updateTaskField, updateTaskStatus } from "@/app/actions";
import AssigneePicker from "./AssigneePicker";
import AddColumnButton from "./AddColumnButton";
import InlineTaskRow from "./InlineTaskRow";
import TaskNameCell from "./TaskNameCell";
import TaskCommentsModal from "./TaskCommentsModal";
import TaskEstimateCell from "./TaskEstimateCell";
import TaskLinkedDocsCell, {
  TaskAttachmentItem,
  AvailableProjectDoc,
} from "./TaskLinkedDocsCell";
import { formatMinutes, formatRemaining } from "@/lib/work";

type TaskRow = {
  id: string;
  generated_key: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  due_date: string | null;
  estimate_minutes: number | null;
  billable_minutes?: number;
  status_id: string;
  created_by: string;
  assigneeIds: string[];
  parent_task_id?: string | null;
};

type WorkflowStatus = { id: string; name: string; color: string };
type Person = { id: string; label: string };
type CustomField = { id: string; name: string; field_type: string };

function AutosaveSelect({
  action,
  name,
  value: initialValue,
  children,
  ariaLabel,
}: {
  action: (fd: FormData) => Promise<unknown>;
  name: string;
  value: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [savedValue, setSavedValue] = useState(initialValue);

  return (
    <select
      name={name}
      defaultValue={savedValue}
      disabled={pending}
      aria-label={ariaLabel}
      onChange={(e) => {
        const fd = new FormData(e.currentTarget.form!);
        fd.set(name, e.currentTarget.value);
        const next = e.currentTarget.value;
        startTransition(async () => {
          await action(fd);
          setSavedValue(next);
        });
      }}
    >
      {children}
    </select>
  );
}

function AutosaveInput({
  action,
  name,
  value: initialValue,
  type = "text",
  ariaLabel,
  placeholder,
  required,
  maxLength,
  min,
  max,
  className,
}: {
  action: (fd: FormData) => Promise<unknown>;
  name: string;
  value: string;
  type?: string;
  ariaLabel?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentValue = useRef(initialValue);

  const save = useCallback(
    (value: string, form: HTMLFormElement) => {
      if (required && !value.trim()) return;
      startTransition(async () => {
        const fd = new FormData(form);
        fd.set(name, value);
        await action(fd);
      });
    },
    [action, name, required]
  );

  return (
    <input
      type={type}
      name={name}
      defaultValue={initialValue}
      disabled={pending}
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      min={min}
      max={max}
      className={className}
      onChange={(e) => {
        currentValue.current = e.currentTarget.value;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        const form = e.currentTarget.form!;
        const val = e.currentTarget.value;
        debounceTimer.current = setTimeout(() => save(val, form), 800);
      }}
      onBlur={(e) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        save(e.currentTarget.value, e.currentTarget.form!);
      }}
    />
  );
}

export default function TaskTable({
  projectId,
  canEdit = true,
  tasks,
  statuses,
  members,
  createdBy,
  customFields,
  customValues,
  attachmentsMap,
  projectDocuments = [],
  commentCounts,
}: {
  projectId: string;
  canEdit?: boolean;
  tasks: TaskRow[];
  statuses: WorkflowStatus[];
  members: Person[];
  createdBy: Map<string, string>;
  customFields: CustomField[];
  customValues: Map<string, Map<string, string>>;
  attachmentsMap?: Map<string, TaskAttachmentItem[]>;
  projectDocuments?: AvailableProjectDoc[];
  commentCounts?: Map<string, number>;
}) {
  const [activeCommentsTask, setActiveCommentsTask] = useState<{
    id: string;
    key: string;
    title: string;
  } | null>(null);

  const statusMap = new Map(statuses.map((s) => [s.id, s]));

  // Partition tasks into parents and nested subtasks
  const subtasksByParent = new Map<string, TaskRow[]>();
  const parentTasks: TaskRow[] = [];
  const taskIdSet = new Set(tasks.map((t) => t.id));

  for (const task of tasks) {
    if (task.parent_task_id && taskIdSet.has(task.parent_task_id)) {
      const list = subtasksByParent.get(task.parent_task_id) ?? [];
      list.push(task);
      subtasksByParent.set(task.parent_task_id, list);
    } else {
      parentTasks.push(task);
    }
  }

  // Auto-expand all parent tasks that have subtasks
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      if (task.parent_task_id) set.add(task.parent_task_id);
    }
    return set;
  });

  const toggleExpand = (id: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTaskRow = (task: TaskRow, isSubtask = false, subtasks: TaskRow[] = []) => {
    const currentStatus = statusMap.get(task.status_id);
    const count = commentCounts?.get(task.id) ?? 0;

    return (
      <tr key={task.id} className={`task-data-tr${isSubtask ? " is-subtask-row" : ""}`}>
        {/* Task Name — clean text with hover actions for subtasks and edit */}
        <td className={`task-title-cell${isSubtask ? " is-subtask-title-cell" : ""}`}>
          <TaskNameCell
            projectId={projectId}
            taskId={task.id}
            taskKey={task.generated_key}
            title={task.title}
            description={task.description}
            statusColor={currentStatus?.color}
            hasSubtasks={subtasks.length > 0}
            isExpanded={expandedTaskIds.has(task.id)}
            onToggleExpand={() => toggleExpand(task.id)}
            subtaskCount={subtasks.length}
            isSubtask={isSubtask}
            canEdit={canEdit}
          />
        </td>

        {/* Created by */}
        <td>{createdBy.get(task.created_by) ?? "Team member"}</td>

        {/* Assignees — numbered multi-picker or static badges for viewers */}
        <td>
          {canEdit ? (
            <AssigneePicker
              key={`${task.id}-${task.assigneeIds.join(",")}`}
              projectId={projectId}
              taskId={task.id}
              members={members}
              initialAssignees={task.assigneeIds}
            />
          ) : (
            <div className="assignees-static-list" style={{ display: "flex", gap: "4px", flexWrap: "wrap", fontSize: "12px" }}>
              {task.assigneeIds.length ? (
                task.assigneeIds.map((id) => {
                  const m = members.find((x) => x.id === id);
                  return (
                    <span key={id} className="assignee-pill-static" style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#334155" }}>
                      {m?.label ?? "Team member"}
                    </span>
                  );
                })
              ) : (
                <span style={{ color: "#94a3b8" }}>Unassigned</span>
              )}
            </div>
          )}
        </td>

        {/* Status — autosave on change or static pill for viewers */}
        <td>
          {canEdit ? (
            <form className="sheet-edit">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="taskId" value={task.id} />
              <AutosaveSelect
                action={updateTaskStatus}
                name="statusId"
                value={task.status_id}
                ariaLabel={`Status for ${task.title}`}
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </AutosaveSelect>
            </form>
          ) : (
            <span
              className="status-pill-static"
              style={{
                border: `1px solid ${currentStatus?.color ?? "#cbd5cd"}`,
                color: currentStatus?.color ?? "#526057",
                background: `${currentStatus?.color ?? "#526057"}18`,
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 500,
                display: "inline-block",
              }}
            >
              {currentStatus?.name ?? "Unknown"}
            </span>
          )}
        </td>

        {/* Priority — autosave on change or static pill for viewers */}
        <td>
          {canEdit ? (
            <form className="sheet-edit">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="field" value="priority" />
              <AutosaveSelect
                action={updateTaskField}
                name="value"
                value={task.priority}
                ariaLabel={`Priority for ${task.title}`}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </AutosaveSelect>
            </form>
          ) : (
            <span className={`priority-pill-static priority-${task.priority}`} style={{ textTransform: "capitalize", fontSize: "12px" }}>
              {task.priority}
            </span>
          )}
        </td>

        {/* Due date — autosave on change or static text for viewers */}
        <td>
          {canEdit ? (
            <form className="sheet-edit">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="field" value="due_date" />
              <AutosaveInput
                action={updateTaskField}
                name="value"
                value={task.due_date ?? ""}
                type="date"
                ariaLabel={`Due date for ${task.title}`}
              />
            </form>
          ) : (
            <span style={{ fontSize: "12px", color: "#475569" }}>
              {task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString() : "—"}
            </span>
          )}
        </td>

        {/* Estimate — interactive unit selector or static for viewers */}
        <td>
          <TaskEstimateCell
            projectId={projectId}
            taskId={task.id}
            taskTitle={task.title}
            initialMinutes={task.estimate_minutes}
            canEdit={canEdit}
          />
        </td>

        {/* Worked (Billable) */}
        <td>
          <span
            className="billable-time-badge"
            title="Total billable hours worked on this task"
          >
            {formatMinutes(task.billable_minutes)}
          </span>
        </td>

        {/* Hours Left / Added (Remaining from estimate) */}
        {(() => {
          const rem = formatRemaining(task.estimate_minutes, task.billable_minutes);
          let badgeClass = "remaining-badge is-none";
          let title = "No estimate set";
          if (rem.status === "ok") {
            badgeClass = "remaining-badge is-ok";
            title = `${rem.label} of budget remaining`;
          } else if (rem.status === "exhausting") {
            badgeClass = "remaining-badge is-warning";
            title = `Warning: ${rem.label} remaining (budget exhausting)`;
          } else if (rem.status === "exceeded") {
            badgeClass = "remaining-badge is-exceeded";
            title = `Over budget by ${rem.label}`;
          }
          return (
            <td>
              <span className={badgeClass} title={title}>
                {rem.status === "exhausting" && <span className="warning-dot">⚠️ </span>}
                {rem.status === "exceeded" && <span className="warning-dot">🚨 </span>}
                {rem.label}
              </span>
            </td>
          );
        })()}

        {/* Linked Docs / Whiteboard / Flowchart */}
        <td>
          <TaskLinkedDocsCell
            projectId={projectId}
            taskId={task.id}
            taskTitle={task.title}
            attachments={attachmentsMap?.get(task.id) ?? []}
            availableDocs={projectDocuments}
            canEdit={canEdit}
          />
        </td>

        {/* Custom fields */}
        {customFields.map((field) => (
          <td className="custom-value-cell" key={field.id}>
            {customValues.get(task.id)?.get(field.id) ?? <span className="muted">—</span>}
          </td>
        ))}

        {/* Comments / Discussion Column — opens modal in place, full details link removed */}
        <td>
          <button
            type="button"
            className="table-comment-btn"
            onClick={() =>
              setActiveCommentsTask({
                id: task.id,
                key: task.generated_key,
                title: task.title,
              })
            }
            title="Open discussion"
          >
            <MessageSquare size={13} />
            <span>{count > 0 ? count : "Discuss"}</span>
          </button>
        </td>

        <td className="add-col-empty-cell" />
      </tr>
    );
  };

  return (
    <div className="task-table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Created by</th>
            <th>Assignees</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due date</th>
            <th>Estimate</th>
            <th>Worked (Billable)</th>
            <th>Remaining</th>
            <th>Linked Docs</th>
            {customFields.map((field) => (
              <th key={field.id}>{field.name}</th>
            ))}
            <th>Comments</th>
            {canEdit ? <AddColumnButton projectId={projectId} /> : <th className="add-col-empty-cell" />}
          </tr>
        </thead>
        <tbody>
          {parentTasks.length === 0 && (
            <tr>
              <td colSpan={13 + customFields.length} style={{ textAlign: "center", padding: "42px 16px", color: "var(--muted)" }}>
                <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>No tasks found</p>
                <small style={{ fontSize: "11px" }}>No tasks match the current search or filters.</small>
              </td>
            </tr>
          )}
          {parentTasks.map((parentTask) => {
            const children = subtasksByParent.get(parentTask.id) ?? [];
            const isExpanded = expandedTaskIds.has(parentTask.id);

            return (
              <Fragment key={parentTask.id}>
                {renderTaskRow(parentTask, false, children)}
                {isExpanded &&
                  children.map((subtask) => renderTaskRow(subtask, true))}
              </Fragment>
            );
          })}
          {canEdit && (
            <InlineTaskRow
              projectId={projectId}
              statuses={statuses}
              members={members}
              colSpan={12 + customFields.length}
            />
          )}
        </tbody>
      </table>

      {/* Popover / Overlay Comments Modal (matching Image 3) */}
      {activeCommentsTask && (
        <TaskCommentsModal
          taskId={activeCommentsTask.id}
          taskKey={activeCommentsTask.key}
          taskTitle={activeCommentsTask.title}
          projectId={projectId}
          onClose={() => setActiveCommentsTask(null)}
        />
      )}
    </div>
  );
}
