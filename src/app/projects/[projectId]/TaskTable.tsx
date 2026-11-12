"use client";

import Link from "next/link";
import { MessageSquare, ExternalLink, ChevronDown, ChevronRight, Flag, Calendar, Layers, List, Check, GripVertical, Columns3, RotateCcw, ChevronLeft } from "lucide-react";
import { useTransition, useRef, useState, useCallback, useEffect, useMemo, Fragment } from "react";
import { updateTaskField, updateTaskStatus } from "@/app/actions";
import {
  BASE_TABLE_COLUMN_LABELS,
  BaseTableColumnKey,
  buildDefaultColumnOrder,
  normalizeColumnOrder,
  TABLE_COL_COOKIE,
} from "@/lib/project-preferences";
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

  if (fieldType === "progress") {
    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      const pct = Math.max(0, Math.min(100, Math.round(num)));
      return (
        <div className="cf-table-progress" title={`${pct}% complete`}>
          <div className="cf-progress-track">
            <div className="cf-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span>{pct}%</span>
        </div>
      );
    }
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
  initialColumnOrder,
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
  initialColumnOrder?: string[];
}) {
  const [groupBy, setGroupBy] = useState<"status" | "priority" | "due_date" | "none">(initialGroupBy);
  const [activeCommentsTask, setActiveCommentsTask] = useState<{
    id: string;
    key: string;
    title: string;
  } | null>(null);

  const customFieldIds = useMemo(
    () => customFields.map((f) => f.id),
    [customFields]
  );
  const customFieldMap = useMemo(
    () => new Map(customFields.map((f) => [f.id, f])),
    [customFields]
  );

  const [savedColumnOrder, setSavedColumnOrder] = useState<string[] | undefined>(
    initialColumnOrder
  );
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialColumnOrder && initialColumnOrder.length > 0) {
      setSavedColumnOrder(initialColumnOrder);
      return;
    }
    try {
      const cached = localStorage.getItem("orbitwork_table_col_order_v1");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setSavedColumnOrder(parsed.filter((x): x is string => typeof x === "string"));
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }, [initialColumnOrder]);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setColumnsMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setColumnsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [columnsMenuOpen]);

  const orderedColumnIds = useMemo(
    () => normalizeColumnOrder(savedColumnOrder, customFieldIds),
    [savedColumnOrder, customFieldIds]
  );

  const persistColumnOrder = useCallback(
    async (nextOrder: string[]) => {
      const normalized = normalizeColumnOrder(nextOrder, customFieldIds);
      setSavedColumnOrder(normalized);
      try {
        localStorage.setItem("orbitwork_table_col_order_v1", JSON.stringify(normalized));
        document.cookie = `${TABLE_COL_COOKIE}=${encodeURIComponent(
          JSON.stringify(normalized)
        )}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      } catch {
        // Ignore storage quota issues
      }
      try {
        await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listColumnOrder: normalized }),
        });
      } catch {
        // Cookie + localStorage already saved locally for this user
      }
    },
    [customFieldIds]
  );

  const reorderColumns = useCallback(
    (fromId: string, toId: string) => {
      if (!fromId || !toId || fromId === toId) return;
      const next = [...orderedColumnIds];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      void persistColumnOrder(next);
    },
    [orderedColumnIds, persistColumnOrder]
  );

  const moveColumnStep = useCallback(
    (colId: string, delta: -1 | 1) => {
      const idx = orderedColumnIds.indexOf(colId);
      const nextIdx = idx + delta;
      if (idx < 0 || nextIdx < 0 || nextIdx >= orderedColumnIds.length) return;
      const next = [...orderedColumnIds];
      const [moved] = next.splice(idx, 1);
      next.splice(nextIdx, 0, moved);
      void persistColumnOrder(next);
    },
    [orderedColumnIds, persistColumnOrder]
  );

  const getColumnLabel = (colId: string): string => {
    if (colId.startsWith("cf:")) {
      return customFieldMap.get(colId.slice(3))?.name ?? "Custom field";
    }
    return BASE_TABLE_COLUMN_LABELS[colId as BaseTableColumnKey] ?? colId;
  };

  const nameColIndex = Math.max(0, orderedColumnIds.indexOf("name"));

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

  const colSpanCount = orderedColumnIds.length + 1;

  const renderTaskRow = (task: TaskRow, isSubtask = false, subtasks: TaskRow[] = []) => {
    const currentStatus = statusMap.get(task.status_id);
    const count = commentCounts?.get(task.id) ?? 0;
    const isCompleted = Boolean(
      currentStatus?.name.toLowerCase().includes("complete") ||
      currentStatus?.name.toLowerCase().includes("done") ||
      currentStatus?.name.toLowerCase().includes("closed")
    );
    const hasAttachments = Boolean((attachmentsMap?.get(task.id)?.length ?? 0) > 0);

    const renderCell = (colId: string) => {
      if (colId === "name") {
        return (
          <td
            key={colId}
            className={`task-title-cell${isSubtask ? " is-subtask-title-cell" : ""}`}
          >
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
        );
      }

      if (colId === "assignee") {
        return (
          <td key={colId}>
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
        );
      }

      if (colId === "due_date") {
        return (
          <td key={colId}>
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
        );
      }

      if (colId === "priority") {
        return (
          <td className="priority-td" key={colId}>
            <PriorityPickerCell
              projectId={projectId}
              taskId={task.id}
              priority={task.priority}
              canEdit={canEdit}
            />
          </td>
        );
      }

      if (colId === "status") {
        return (
          <td className="status-td" key={colId}>
            <StatusPickerCell
              projectId={projectId}
              taskId={task.id}
              statusId={task.status_id}
              statuses={statuses}
              canEdit={canEdit}
            />
          </td>
        );
      }

      if (colId === "created_by") {
        return <td key={colId}>{createdBy.get(task.created_by) ?? "Team member"}</td>;
      }

      if (colId === "estimate") {
        return (
          <td key={colId}>
            <TaskEstimateCell
              projectId={projectId}
              taskId={task.id}
              taskTitle={task.title}
              initialMinutes={task.estimate_minutes}
              canEdit={canEdit}
            />
          </td>
        );
      }

      if (colId === "worked") {
        return (
          <td key={colId}>
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
        );
      }

      if (colId === "remaining") {
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
          <td key={colId}>
            <span className={badgeClass} title={title}>
              {rem.status === "exhausting" && <span className="warning-dot">⚠️ </span>}
              {rem.status === "exceeded" && <span className="warning-dot">🚨 </span>}
              {rem.label}
            </span>
          </td>
        );
      }

      if (colId === "docs") {
        return (
          <td key={colId}>
            <TaskLinkedDocsCell
              projectId={projectId}
              taskId={task.id}
              taskTitle={task.title}
              attachments={attachmentsMap?.get(task.id) ?? []}
              availableDocs={projectDocuments}
              canEdit={canEdit}
            />
          </td>
        );
      }

      if (colId.startsWith("cf:")) {
        const fieldId = colId.slice(3);
        const field = customFieldMap.get(fieldId);
        if (!field) return null;
        return (
          <td className="custom-value-cell" key={colId}>
            <CustomFieldCell
              fieldType={field.field_type}
              val={customValues.get(task.id)?.get(field.id)}
            />
          </td>
        );
      }

      if (colId === "comments") {
        return (
          <td key={colId}>
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
        );
      }

      return null;
    };

    return (
      <tr key={task.id} className={`task-data-tr${isSubtask ? " is-subtask-row" : ""}`}>
        {orderedColumnIds.map((colId) => renderCell(colId))}
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
              nameColIndex={nameColIndex}
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
                  nameColIndex={nameColIndex}
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
              nameColIndex={nameColIndex}
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
            nameColIndex={nameColIndex}
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
      <div className="table-columns-toolbar" ref={columnsMenuRef}>
        <span className="table-columns-hint">
          Drag column headers to arrange your own view
        </span>
        <button
          type="button"
          className={`table-columns-btn${columnsMenuOpen ? " is-open" : ""}`}
          onClick={() => setColumnsMenuOpen((o) => !o)}
          aria-expanded={columnsMenuOpen}
        >
          <Columns3 size={13} />
          <span>Arrange columns</span>
        </button>

        {columnsMenuOpen && (
          <div className="table-columns-popover" role="dialog" aria-label="Customize your column order">
            <div className="view-tabs-popover-head">
              <div>
                <strong>Your Columns</strong>
                <small>Only changes your personal view.</small>
              </div>
              <button
                type="button"
                className="view-tabs-reset-btn"
                onClick={() => void persistColumnOrder(buildDefaultColumnOrder(customFieldIds))}
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
            <div className="view-tabs-popover-list">
              {orderedColumnIds.map((colId, idx) => (
                <div
                  key={colId}
                  className={`view-tabs-popover-item${dragOverColId === colId ? " is-drop-hover" : ""}`}
                  draggable
                  onDragStart={() => setDragColId(colId)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColId !== colId) setDragOverColId(colId);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragColId) reorderColumns(dragColId, colId);
                    setDragColId(null);
                    setDragOverColId(null);
                  }}
                  onDragEnd={() => {
                    setDragColId(null);
                    setDragOverColId(null);
                  }}
                >
                  <span className="view-tabs-grip">
                    <GripVertical size={13} />
                  </span>
                  <span className="view-tabs-item-name">{getColumnLabel(colId)}</span>
                  <div className="view-tabs-step-btns">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveColumnStep(colId, -1)}
                      aria-label={`Move ${getColumnLabel(colId)} left`}
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedColumnIds.length - 1}
                      onClick={() => moveColumnStep(colId, 1)}
                      aria-label={`Move ${getColumnLabel(colId)} right`}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="task-table-wrap" ref={tableWrapRef}>
        <table className={`task-table${nameColIndex !== 0 ? " has-moved-name-col" : ""}`}>
          <thead>
            <tr>
              {orderedColumnIds.map((colId) => {
                const label = getColumnLabel(colId);
                const isDropTarget = dragOverColId === colId && dragColId !== colId;
                return (
                  <th
                    key={colId}
                    draggable
                    onDragStart={(e) => {
                      setDragColId(colId);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", colId);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverColId !== colId) setDragOverColId(colId);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const source = e.dataTransfer.getData("text/plain") || dragColId;
                      setDragColId(null);
                      setDragOverColId(null);
                      if (source) reorderColumns(source, colId);
                    }}
                    onDragEnd={() => {
                      setDragColId(null);
                      setDragOverColId(null);
                    }}
                    className={`task-th-draggable${
                      colId === "name" ? " task-title-th" : ""
                    }${isDropTarget ? " is-col-drop-target" : ""}`}
                    title="Drag header to reorder column"
                  >
                    <span className="task-th-inner">
                      <GripVertical size={11} className="task-th-grip" />
                      <span>{label}</span>
                    </span>
                  </th>
                );
              })}
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
