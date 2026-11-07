"use client";

import Link from "next/link";
import { MessageSquare, ExternalLink, ChevronDown, ChevronRight, Flag, Calendar, Layers, List, Check } from "lucide-react";
import { useTransition, useRef, useState, useCallback, useEffect, Fragment } from "react";
import { updateTaskField, updateTaskStatus } from "@/app/actions";
import AssigneePicker from "./AssigneePicker";
import AddColumnButton from "./AddColumnButton";
import InlineTaskRow from "./InlineTaskRow";
import TaskNameCell from "./TaskNameCell";
import TaskCommentsModal from "./TaskCommentsModal";
import TaskEstimateCell from "./TaskEstimateCell";
import TaskTableTimer from "./TaskTableTimer";
import TaskLinkedDocsCell, {
  TaskAttachmentItem,
  AvailableProjectDoc,
} from "./TaskLinkedDocsCell";
import { formatMinutes, formatRemaining } from "@/lib/work";
import DateInput from "@/app/DateInput";

type TaskRow = {
  id: string;
  generated_key: string;
  title: string;
  task_type?: string;
  tags?: string[];
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

const AVATAR_COLORS = [
  "#167c58",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#9333ea",
  "#0891b2",
  "#4f46e5",
  "#e11d48",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#ef4444" },
  high: { label: "High", color: "#f59e0b" },
  normal: { label: "Normal", color: "#3b82f6" },
  low: { label: "Low", color: "#94a3b8" },
};

function getStatusColor(status?: { name?: string; color?: string; category?: string }) {
  if (status?.color && status.color !== "#87938b" && status.color !== "#526057") return status.color;
  const name = (status?.name ?? "").toLowerCase();
  if (name.includes("complete") || name.includes("done") || name.includes("closed") || status?.category === "completed") {
    return "#167c58";
  }
  if (name.includes("progress") || name.includes("doing") || status?.category === "in_progress") {
    return "#2563eb";
  }
  if (name.includes("hold") || name.includes("block") || name.includes("wait")) {
    return "#d97706";
  }
  if (name.includes("reject") || name.includes("cancel") || status?.category === "cancelled") {
    return "#dc2626";
  }
  if (name.includes("review") || name.includes("qa") || name.includes("test")) {
    return "#9333ea";
  }
  return "#64748b"; // New / Default slate
}

function PriorityPickerCell({
  projectId,
  taskId,
  priority: initialPriority,
  canEdit = true,
}: {
  projectId: string;
  taskId: string;
  priority: "low" | "normal" | "high" | "urgent";
  canEdit?: boolean;
}) {
  const [priority, setPriority] = useState(initialPriority);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPriority(initialPriority);
  }, [initialPriority]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const currentMeta = PRIORITY_META[priority] ?? PRIORITY_META.normal;

  const handleSelect = (next: "low" | "normal" | "high" | "urgent") => {
    setPriority(next);
    setOpen(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("field", "priority");
      fd.set("value", next);
      await updateTaskField(fd);
    });
  };

  if (!canEdit) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          color: currentMeta.color,
          fontSize: 11.5,
          fontWeight: 600,
        }}
      >
        <Flag size={11} fill={currentMeta.color} color={currentMeta.color} />
        <span>{currentMeta.label}</span>
      </span>
    );
  }

  return (
    <div ref={ref} className="priority-dropdown-wrap" style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="priority-trigger-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: 24,
          padding: "2px 8px",
          border: "1px solid var(--line, #dfe5e0)",
          borderRadius: 6,
          background: "var(--surface, #fff)",
          color: currentMeta.color,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all .12s ease",
          whiteSpace: "nowrap",
        }}
        title={`Priority: ${currentMeta.label}`}
      >
        <Flag size={11} fill={currentMeta.color} color={currentMeta.color} />
        <span>{currentMeta.label}</span>
      </button>

      {open && (
        <div
          className="priority-popover-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            minWidth: 120,
            background: "var(--surface, #fff)",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: 8,
            boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(["urgent", "high", "normal", "low"] as const).map((p) => {
            const meta = PRIORITY_META[p];
            const isSelected = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleSelect(p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  border: 0,
                  borderRadius: 6,
                  background: isSelected ? "var(--nav-hover, #f1f5f9)" : "transparent",
                  color: "var(--ink, #1e293b)",
                  fontSize: 11.5,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {isSelected ? <Check size={12} color="var(--green, #167c58)" /> : <span style={{ width: 12 }} />}
                <Flag size={12} fill={meta.color} color={meta.color} />
                <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPickerCell({
  projectId,
  taskId,
  statusId: initialStatusId,
  statuses,
  canEdit = true,
}: {
  projectId: string;
  taskId: string;
  statusId: string;
  statuses: WorkflowStatus[];
  canEdit?: boolean;
}) {
  const [statusId, setStatusId] = useState(initialStatusId);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatusId(initialStatusId);
  }, [initialStatusId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const currentStatus = statuses.find((s) => s.id === statusId) || statuses[0];
  const currentColor = getStatusColor(currentStatus);

  const handleSelect = (nextId: string) => {
    setStatusId(nextId);
    setOpen(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("statusId", nextId);
      await updateTaskStatus(fd);
    });
  };

  return (
    <div ref={ref} className="status-dropdown-wrap" style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => canEdit && setOpen(!open)}
        disabled={!canEdit}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 24,
          padding: "2px 8px",
          border: `1px solid ${currentColor}40`,
          borderRadius: 6,
          background: `${currentColor}15`,
          color: currentColor,
          fontSize: 11,
          fontWeight: 700,
          cursor: canEdit ? "pointer" : "default",
          transition: "all .12s ease",
          whiteSpace: "nowrap",
        }}
        title={`Status: ${currentStatus?.name ?? "Status"}`}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: currentColor,
            flexShrink: 0,
          }}
        />
        <span>{currentStatus?.name ?? "Status"}</span>
      </button>

      {open && (
        <div
          className="status-popover-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            minWidth: 150,
            background: "var(--surface, #fff)",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: 8,
            boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {statuses.map((status) => {
            const isSelected = status.id === statusId;
            const color = getStatusColor(status);
            return (
              <button
                key={status.id}
                type="button"
                onClick={() => handleSelect(status.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  border: 0,
                  borderRadius: 6,
                  background: isSelected ? `${color}18` : "transparent",
                  color: isSelected ? color : "var(--ink, #1e293b)",
                  fontSize: 11.5,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {isSelected ? <Check size={12} color={color} /> : <span style={{ width: 12 }} />}
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{status.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  if (type === "date") {
    return (
      <DateInput
        name={name}
        defaultValue={initialValue}
        disabled={pending}
        ariaLabel={ariaLabel}
        className={className}
        containerClassName="sheet-date-picker"
        onChange={(nextValue, form) => {
          currentValue.current = nextValue;
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          if (form) {
            debounceTimer.current = setTimeout(() => save(nextValue, form), 800);
          }
        }}
        onBlur={(nextValue, form) => {
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          if (form) save(nextValue, form);
        }}
      />
    );
  }

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

function parseUrls(text: string): { label: string; href: string }[] {
  if (!text) return [];
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const links: { label: string; href: string }[] = [];
  for (const token of tokens) {
    const clean = token.trim();
    if (/^https?:\/\//i.test(clean)) {
      try {
        const url = new URL(clean);
        const domain = url.hostname.replace(/^www\./, "");
        const path = url.pathname !== "/" ? url.pathname : "";
        links.push({ label: domain + (path.length > 15 ? path.slice(0, 15) + "…" : path), href: clean });
      } catch {
        links.push({ label: clean, href: clean });
      }
    } else if (/^www\./i.test(clean) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(clean)) {
      links.push({ label: clean, href: `https://${clean}` });
    }
  }
  return links;
}

function CustomFieldCell({
  fieldType,
  val,
}: {
  fieldType: string;
  val: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!val) return <span className="muted">—</span>;
  const trimmed = val.trim();
  const isUrlField = fieldType === "url" || fieldType === "link";
  const links = parseUrls(trimmed);

  if (isUrlField || links.length > 0) {
    if (links.length > 1) {
      const first = links[0];
      const remainingCount = links.length - 1;
      return (
        <div ref={ref} className="custom-links-cell" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <a
            href={first.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 6px",
              background: "rgba(22, 124, 88, 0.08)",
              color: "var(--green, #167c58)",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
              textDecoration: "none",
              maxWidth: 130,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={`Open ${first.href}`}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first.label}</span>
            <ExternalLink size={10} style={{ flexShrink: 0 }} />
          </a>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1px 6px",
              height: 20,
              borderRadius: "4px",
              background: "var(--nav-hover, #e2e8f0)",
              color: "var(--muted, #475569)",
              fontSize: "10px",
              fontWeight: 700,
              border: 0,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title={`${links.length} links (click to view all)`}
          >
            +{remainingCount}
          </button>

          {open && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                zIndex: 9999,
                minWidth: 180,
                maxWidth: 280,
                background: "var(--surface, #fff)",
                border: "1px solid var(--line, #cbd5e1)",
                borderRadius: 8,
                boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", padding: "2px 6px", borderBottom: "1px solid var(--line)" }}>
                Attached Links ({links.length})
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                {links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      padding: "5px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      color: "var(--green, #167c58)",
                      textDecoration: "none",
                      background: "rgba(22, 124, 88, 0.04)",
                    }}
                    title={link.href}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.label}</span>
                    <ExternalLink size={10} style={{ flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    const single = links[0] || { label: trimmed, href: trimmed.startsWith("http") ? trimmed : `https://${trimmed}` };
    return (
      <a
        href={single.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "var(--green, #167c58)",
          textDecoration: "underline",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontWeight: 600,
        }}
        title={`Open URL: ${single.href}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {single.label}
        </span>
        <ExternalLink size={11} />
      </a>
    );
  }

  // Multi-values (comma-separated tags / multi-select items)
  const items = trimmed.split(/,\s*/).filter(Boolean);
  if (items.length > 1) {
    const first = items[0];
    const remainingCount = items.length - 1;
    return (
      <div ref={ref} className="custom-multivalue-cell" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 7px",
            background: "var(--nav-hover, #f1f5f9)",
            color: "var(--ink, #1e293b)",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={first}
        >
          {first}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1px 6px",
            height: 20,
            borderRadius: "4px",
            background: "var(--nav-hover, #e2e8f0)",
            color: "var(--muted, #475569)",
            fontSize: "10px",
            fontWeight: 700,
            border: 0,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          title={`${items.length} values (click to view all)`}
        >
          +{remainingCount}
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 9999,
              minWidth: 160,
              maxWidth: 240,
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #cbd5e1)",
              borderRadius: 8,
              boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
              padding: "6px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", padding: "2px 6px", borderBottom: "1px solid var(--line)" }}>
              Values ({items.length})
            </div>
            <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    background: "var(--nav-hover, #f8fafc)",
                    color: "var(--ink, #1e293b)",
                    border: "1px solid var(--line, #e2e8f0)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (fieldType === "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return (
      <a
        href={`mailto:${trimmed}`}
        style={{ color: "var(--green, #167c58)", textDecoration: "underline" }}
        onClick={(e) => e.stopPropagation()}
      >
        {trimmed}
      </a>
    );
  }

  return <span>{trimmed}</span>;
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
  runningTimerMap,
  initialGroupBy = "status",
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
  runningTimerMap?: Map<string, { id: string; started_at: string; billable?: boolean }>;
  initialGroupBy?: "status" | "priority" | "due_date" | "none";
}) {
  const [groupBy, setGroupBy] = useState<"status" | "priority" | "due_date" | "none">(initialGroupBy);
  const [activeCommentsTask, setActiveCommentsTask] = useState<{
    id: string;
    key: string;
    title: string;
  } | null>(null);

  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialGroupBy) {
      setGroupBy(initialGroupBy);
    }
  }, [initialGroupBy]);

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

  // Collapsed groups tracking
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const s of statuses) {
      if (
        s.name.toLowerCase().includes("complete") ||
        s.name.toLowerCase().includes("closed")
      ) {
        set.add(s.id);
      }
    }
    return set;
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const completedStatus =
    statuses.find(
      (s) =>
        s.name.toLowerCase().includes("complete") ||
        s.name.toLowerCase().includes("done") ||
        s.name.toLowerCase().includes("closed")
    ) || statuses[statuses.length - 1];

  const initialStatus =
    statuses.find(
      (s) =>
        s.name.toLowerCase().includes("new") ||
        s.name.toLowerCase().includes("to do") ||
        s.name.toLowerCase().includes("open")
    ) || statuses[0];

  const colSpanCount = 13 + customFields.length;

  const renderTaskRow = (task: TaskRow, isSubtask = false, subtasks: TaskRow[] = []) => {
    const currentStatus = statusMap.get(task.status_id);
    const count = commentCounts?.get(task.id) ?? 0;
    const isCompleted = Boolean(
      currentStatus?.name.toLowerCase().includes("complete") ||
      currentStatus?.name.toLowerCase().includes("done") ||
      currentStatus?.name.toLowerCase().includes("closed")
    );
    const hasAttachments = Boolean((attachmentsMap?.get(task.id)?.length ?? 0) > 0);

    return (
      <tr key={task.id} className={`task-data-tr${isSubtask ? " is-subtask-row" : ""}`}>
        {/* Task Name — clean text, indented subtask without L-shape, meta icons */}
        <td className={`task-title-cell${isSubtask ? " is-subtask-title-cell" : ""}`}>
          <TaskNameCell
            projectId={projectId}
            taskId={task.id}
            taskKey={task.generated_key}
            title={task.title}
            taskType={task.task_type ?? "task"}
            tags={task.tags ?? []}
            description={task.description}
            statusColor={getStatusColor(currentStatus)}
            hasSubtasks={subtasks.length > 0}
            isExpanded={expandedTaskIds.has(task.id)}
            onToggleExpand={() => toggleExpand(task.id)}
            subtaskCount={subtasks.length}
            hasAttachments={hasAttachments}
            isSubtask={isSubtask}
            canEdit={canEdit}
            isCompleted={isCompleted}
            completedStatusId={completedStatus?.id}
            initialStatusId={initialStatus?.id}
          />
        </td>

        {/* Assignees — compact circular avatar badges (ClickUp style) */}
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
            <div style={{ display: "inline-flex", alignItems: "center" }}>
              {task.assigneeIds.length ? (
                task.assigneeIds.slice(0, 3).map((id, idx) => {
                  const m = members.find((x) => x.id === id);
                  return (
                    <span
                      key={id}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundColor: getAvatarColor(id),
                        color: "#ffffff",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: idx > 0 ? -6 : 0,
                        border: "1.5px solid var(--paper, #ffffff)",
                      }}
                      title={m?.label ?? "Team member"}
                    >
                      {(m?.label ?? "T").charAt(0).toUpperCase()}
                    </span>
                  );
                })
              ) : (
                <span style={{ color: "var(--muted, #94a3b8)", fontSize: "11px" }}>—</span>
              )}
            </div>
          )}
        </td>

        {/* Due date */}
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

        {/* Priority — colored flag pill */}
        <td className="priority-td">
          <PriorityPickerCell
            projectId={projectId}
            taskId={task.id}
            priority={task.priority}
            canEdit={canEdit}
          />
        </td>

        {/* Status — colored pill & popup */}
        <td className="status-td">
          <StatusPickerCell
            projectId={projectId}
            taskId={task.id}
            statusId={task.status_id}
            statuses={statuses}
            canEdit={canEdit}
          />
        </td>

        {/* Created by */}
        <td>{createdBy.get(task.created_by) ?? "Team member"}</td>

        {/* Estimate */}
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
          <div className="table-worked-cell" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <TaskTableTimer
              projectId={projectId}
              taskId={task.id}
              taskTitle={task.title}
              runningEntry={runningTimerMap?.get(task.id) ?? null}
              canEdit={canEdit}
            />
            <span
              className="billable-time-badge"
              title="Total billable hours worked on this task"
            >
              {formatMinutes(task.billable_minutes)}
            </span>
          </div>
        </td>

        {/* Hours Left / Added */}
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

        {/* Linked Docs */}
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
            <CustomFieldCell
              fieldType={field.field_type}
              val={customValues.get(task.id)?.get(field.id)}
            />
          </td>
        ))}

        {/* Comments */}
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

  // --- Render Priority Groups (Matching Image 2) ---
  const renderPriorityGroups = () => {
    const PRIORITY_GROUPS: Array<{
      key: "urgent" | "high" | "normal" | "low" | "none";
      label: string;
      flagColor: string;
    }> = [
      { key: "urgent", label: "Urgent", flagColor: "#ef4444" },
      { key: "high", label: "High", flagColor: "#f59e0b" },
      { key: "normal", label: "Normal", flagColor: "#3b82f6" },
      { key: "low", label: "Low", flagColor: "#94a3b8" },
      { key: "none", label: "No Priority", flagColor: "#cbd5e1" },
    ];

    const tasksByPriority = new Map<string, TaskRow[]>();
    PRIORITY_GROUPS.forEach((g) => tasksByPriority.set(g.key, []));

    parentTasks.forEach((t) => {
      const p = t.priority && ["urgent", "high", "normal", "low"].includes(t.priority) ? t.priority : "none";
      tasksByPriority.get(p)!.push(t);
    });

    return PRIORITY_GROUPS.map((grp) => {
      const groupTasks = tasksByPriority.get(grp.key) ?? [];
      const isCollapsed = collapsedGroups.has(grp.key);

      return (
        <Fragment key={grp.key}>
          {/* Priority Group Header (ClickUp Style matching Image 2) */}
          <tr className="status-group-tr">
            <td colSpan={colSpanCount} className="status-group-td">
              <div className="status-group-header" onClick={() => toggleGroup(grp.key)}>
                <button type="button" className="status-group-caret-btn" aria-label="Toggle group">
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  <Flag size={13} style={{ fill: grp.flagColor, color: grp.flagColor }} />
                  <span style={{ color: "var(--ink, #1e293b)" }}>{grp.label}</span>
                </span>
                <span className="status-group-count">{groupTasks.length}</span>
              </div>
            </td>
          </tr>

          {/* Tasks in this priority group */}
          {!isCollapsed &&
            groupTasks.map((parentTask) => {
              const children = subtasksByParent.get(parentTask.id) ?? [];
              const isExpanded = expandedTaskIds.has(parentTask.id);

              return (
                <Fragment key={parentTask.id}>
                  {renderTaskRow(parentTask, false, children)}
                  {isExpanded && children.map((subtask) => renderTaskRow(subtask, true))}
                </Fragment>
              );
            })}

          {/* Minimal Inline Add Task Row */}
          {!isCollapsed && canEdit && (
            <InlineTaskRow
              projectId={projectId}
              statuses={statuses}
              defaultPriority={grp.key !== "none" ? grp.key : "normal"}
              members={members}
              colSpan={colSpanCount}
            />
          )}
        </Fragment>
      );
    });
  };

  // --- Render Status Groups (Matching Image 3 & 5) ---
  const renderStatusGroups = () => {
    const tasksByStatus = new Map<string, TaskRow[]>();
    for (const s of statuses) {
      tasksByStatus.set(s.id, []);
    }
    const otherTasks: TaskRow[] = [];
    for (const task of parentTasks) {
      if (tasksByStatus.has(task.status_id)) {
        tasksByStatus.get(task.status_id)!.push(task);
      } else {
        otherTasks.push(task);
      }
    }

    return (
      <>
        {statuses.map((status) => {
          const groupTasks = tasksByStatus.get(status.id) ?? [];
          const isCollapsed = collapsedGroups.has(status.id);

          return (
            <Fragment key={status.id}>
              {/* Status Group Header */}
              <tr className="status-group-tr">
                <td colSpan={colSpanCount} className="status-group-td">
                  <div className="status-group-header" onClick={() => toggleGroup(status.id)}>
                    <button type="button" className="status-group-caret-btn" aria-label="Toggle status group">
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <span
                      className="status-group-pill"
                      style={{
                        backgroundColor: getStatusColor(status),
                        color: "#ffffff",
                      }}
                    >
                      {status.name.toUpperCase()}
                    </span>
                    <span className="status-group-count">{groupTasks.length}</span>
                  </div>
                </td>
              </tr>

              {/* Tasks in this status */}
              {!isCollapsed &&
                groupTasks.map((parentTask) => {
                  const children = subtasksByParent.get(parentTask.id) ?? [];
                  const isExpanded = expandedTaskIds.has(parentTask.id);

                  return (
                    <Fragment key={parentTask.id}>
                      {renderTaskRow(parentTask, false, children)}
                      {isExpanded && children.map((subtask) => renderTaskRow(subtask, true))}
                    </Fragment>
                  );
                })}

              {/* Minimal Add Task Row */}
              {!isCollapsed && canEdit && (
                <InlineTaskRow
                  projectId={projectId}
                  statuses={statuses}
                  defaultStatusId={status.id}
                  members={members}
                  colSpan={colSpanCount}
                />
              )}
            </Fragment>
          );
        })}

        {otherTasks.length > 0 && (
          <Fragment key="unmapped-group">
            <tr className="status-group-tr">
              <td colSpan={colSpanCount} className="status-group-td">
                <div className="status-group-header">
                  <span className="status-group-pill" style={{ backgroundColor: "#64748b", color: "#fff" }}>
                    OTHER
                  </span>
                  <span className="status-group-count">{otherTasks.length}</span>
                </div>
              </td>
            </tr>
            {otherTasks.map((parentTask) => {
              const children = subtasksByParent.get(parentTask.id) ?? [];
              const isExpanded = expandedTaskIds.has(parentTask.id);

              return (
                <Fragment key={parentTask.id}>
                  {renderTaskRow(parentTask, false, children)}
                  {isExpanded && children.map((subtask) => renderTaskRow(subtask, true))}
                </Fragment>
              );
            })}
          </Fragment>
        )}
      </>
    );
  };

  // --- Render Due Date Groups ---
  const renderDueDateGroups = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = nextWeekDate.toISOString().slice(0, 10);

    const DUE_DATE_GROUPS = [
      { key: "overdue", label: "Overdue", color: "#ef4444" },
      { key: "today", label: "Today", color: "#f59e0b" },
      { key: "this_week", label: "This Week", color: "#3b82f6" },
      { key: "later", label: "Later", color: "#64748b" },
      { key: "no_date", label: "No Due Date", color: "#94a3b8" },
    ];

    const tasksByDue = new Map<string, TaskRow[]>();
    DUE_DATE_GROUPS.forEach((g) => tasksByDue.set(g.key, []));

    parentTasks.forEach((t) => {
      if (!t.due_date) {
        tasksByDue.get("no_date")!.push(t);
      } else if (t.due_date < todayStr) {
        tasksByDue.get("overdue")!.push(t);
      } else if (t.due_date === todayStr) {
        tasksByDue.get("today")!.push(t);
      } else if (t.due_date <= nextWeekStr) {
        tasksByDue.get("this_week")!.push(t);
      } else {
        tasksByDue.get("later")!.push(t);
      }
    });

    return DUE_DATE_GROUPS.map((grp) => {
      const groupTasks = tasksByDue.get(grp.key) ?? [];
      const isCollapsed = collapsedGroups.has(grp.key);

      return (
        <Fragment key={grp.key}>
          <tr className="status-group-tr">
            <td colSpan={colSpanCount} className="status-group-td">
              <div className="status-group-header" onClick={() => toggleGroup(grp.key)}>
                <button type="button" className="status-group-caret-btn" aria-label="Toggle group">
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  <Calendar size={13} style={{ color: grp.color }} />
                  <span style={{ color: "var(--ink, #1e293b)" }}>{grp.label}</span>
                </span>
                <span className="status-group-count">{groupTasks.length}</span>
              </div>
            </td>
          </tr>

          {!isCollapsed &&
            groupTasks.map((parentTask) => {
              const children = subtasksByParent.get(parentTask.id) ?? [];
              const isExpanded = expandedTaskIds.has(parentTask.id);

              return (
                <Fragment key={parentTask.id}>
                  {renderTaskRow(parentTask, false, children)}
                  {isExpanded && children.map((subtask) => renderTaskRow(subtask, true))}
                </Fragment>
              );
            })}

          {!isCollapsed && canEdit && (
            <InlineTaskRow
              projectId={projectId}
              statuses={statuses}
              members={members}
              colSpan={colSpanCount}
            />
          )}
        </Fragment>
      );
    });
  };

  // --- Render Flat List (No Grouping) ---
  const renderFlatList = () => {
    return (
      <>
        {parentTasks.map((parentTask) => {
          const children = subtasksByParent.get(parentTask.id) ?? [];
          const isExpanded = expandedTaskIds.has(parentTask.id);

          return (
            <Fragment key={parentTask.id}>
              {renderTaskRow(parentTask, false, children)}
              {isExpanded && children.map((subtask) => renderTaskRow(subtask, true))}
            </Fragment>
          );
        })}

        {canEdit && (
          <InlineTaskRow
            projectId={projectId}
            statuses={statuses}
            members={members}
            colSpan={colSpanCount}
          />
        )}
      </>
    );
  };

  return (
    <div
      className="task-table-outer"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div className="task-table-wrap" ref={tableWrapRef}>
        <table className="task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Assignees</th>
              <th>Due date</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created by</th>
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
                <td colSpan={colSpanCount} style={{ textAlign: "center", padding: "36px 16px", color: "var(--muted)" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>No tasks found</p>
                  <small style={{ fontSize: "11px" }}>No tasks match the current search or filters.</small>
                </td>
              </tr>
            )}

            {groupBy === "priority" && renderPriorityGroups()}
            {groupBy === "status" && renderStatusGroups()}
            {groupBy === "due_date" && renderDueDateGroups()}
            {groupBy === "none" && renderFlatList()}
          </tbody>
        </table>

        {/* Popover / Overlay Comments Modal */}
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
    </div>
  );
}
