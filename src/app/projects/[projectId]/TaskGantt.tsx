"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  Link as LinkIcon,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Plus,
  Trash2,
  Check,
  Flag,
  User,
  X,
  Search,
} from "lucide-react";

type Task = {
  id: string;
  generated_key: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  created_at?: string;
  status_id?: string;
  status_category?: string;
  parent_task_id?: string | null;
  assigneeIds?: string[];
  priority?: string;
};

type ScheduleEvent = {
  id: string;
  label: string;
  start: string;
  end?: string;
  kind: "holiday" | "leave";
  person?: string;
  avatarUrl?: string | null;
};

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

function getAvatarColor(id?: string | null) {
  if (!id || typeof id !== "string") return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const TASK_COL_WIDTH = 250;
const DAY_COL_WIDTH = 36;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

interface MonthMetadata {
  index: number;
  key: string;
  name: string;
  shortName: string;
  daysCount: number;
  startDayIndex: number;
  endDayIndex: number;
  isCurrentMonth: boolean;
}

interface DayMetadata {
  dayIndex: number; // 0..totalDays-1
  dateStr: string; // YYYY-MM-DD
  dayOfMonth: number; // 1..31
  monthIndex: number; // 0..11
  dayOfWeek: number; // 0..6
  dayOfWeekShort: string;
  isWeekend: boolean;
  isToday: boolean;
  isFirstDayOfMonth: boolean;
  isLastDayOfMonth: boolean;
  holidayLabels?: string[];
}

export type TaskDependency = {
  task_id: string;
  linked_task_id: string;
  relation: string;
};

export default function TaskGantt({
  projectId,
  tasks = [],
  month,
  events = [],
  people,
  profileAvatars,
  dependencies = [],
}: {
  projectId: string;
  tasks: Task[];
  month?: string;
  events?: ScheduleEvent[];
  people?: Map<string, string>;
  profileAvatars?: Map<string, string | null>;
  dependencies?: TaskDependency[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasInitializedScroll = useRef(false);

  // Local optimistic tasks & dependencies for instant responsiveness
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const [localDeps, setLocalDeps] = useState<TaskDependency[]>(dependencies || []);
  useEffect(() => {
    setLocalDeps(dependencies || []);
  }, [dependencies]);

  // Dragging state for horizontal date moving and edge resizing
  const [dragState, setDragState] = useState<{
    taskId: string;
    mode: "move" | "resize-left" | "resize-right";
    startX: number;
    initialStartDay: number;
    initialDueDay: number;
    currentDelta: number;
  } | null>(null);

  // Custom context menu state (suppresses native browser menu)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    task?: Task;
    dateStr?: string;
  } | null>(null);

  // Blocker / Dependency Target Picker Modal state
  const [pickerModal, setPickerModal] = useState<{
    sourceTask: Task;
    relation: "blocks" | "depends_on" | "relates_to";
  } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  // Dependency line filter and hover state
  const [dependencyFilter, setDependencyFilter] = useState<"all" | "blocked" | "related" | "none">("all");
  const [hoveredDepKey, setHoveredDepKey] = useState<string | null>(null);
  const [computedDepLines, setComputedDepLines] = useState<
    Array<{
      key: string;
      relation: string;
      path: string;
      isBlocked: boolean;
      fromTitle: string;
      toTitle: string;
      midX: number;
      midY: number;
    }>
  >([]);

  // Time metrics for "Current Time Line" (e.g., at 12:00 PM it sits precisely at the middle 18px of the 36px cell)
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }, [now]);

  const { timeOffsetPx, timeLabel, timeFraction } = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const fraction = (hours + minutes / 60) / 24;
    const offsetPx = Math.max(1, Math.min(DAY_COL_WIDTH - 1, Math.round(fraction * DAY_COL_WIDTH)));
    const label = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return { timeOffsetPx: offsetPx, timeLabel: label, timeFraction: fraction };
  }, [now]);

  const [year, initialTargetMonth] = useMemo(() => {
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      return [y, Math.max(0, Math.min(11, m - 1))];
    }
    return [now.getFullYear(), now.getMonth()];
  }, [month, now]);

  const [visibleMonthIndex, setVisibleMonthIndex] = useState<number>(initialTargetMonth);

  // Generate continuous year metadata: strictly 12 months, 365 or 366 days, ending at 31st December
  const { months, days, totalDays, dateToDayIndex, holidayByDayIndex, todayDayIndex } = useMemo(() => {
    const monthsMeta: MonthMetadata[] = [];
    const daysMeta: DayMetadata[] = [];
    const dateMap = new Map<string, number>();

    let runningDayIndex = 0;

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
      const startDayIndex = runningDayIndex;
      const endDayIndex = runningDayIndex + daysInMonth - 1;

      monthsMeta.push({
        index: m,
        key: `${year}-${pad2(m + 1)}`,
        name: MONTH_NAMES[m],
        shortName: MONTH_SHORT[m],
        daysCount: daysInMonth,
        startDayIndex,
        endDayIndex,
        isCurrentMonth: year === now.getFullYear() && m === now.getMonth(),
      });

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${pad2(m + 1)}-${pad2(d)}`;
        const dateObj = new Date(Date.UTC(year, m, d));
        const dayOfWeek = dateObj.getUTCDay();
        const isToday = dateStr === todayStr;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        daysMeta.push({
          dayIndex: runningDayIndex,
          dateStr,
          dayOfMonth: d,
          monthIndex: m,
          dayOfWeek,
          dayOfWeekShort: WEEKDAYS[dayOfWeek],
          isWeekend,
          isToday,
          isFirstDayOfMonth: d === 1,
          isLastDayOfMonth: d === daysInMonth,
        });

        dateMap.set(dateStr, runningDayIndex);
        runningDayIndex++;
      }
    }

    // Map holidays to day indices
    const holidayMap = new Map<number, string[]>();
    for (const event of events) {
      if (event.kind !== "holiday" || !event.start) continue;
      const startStr = event.start.slice(0, 10);
      const endStr = (event.end ?? event.start).slice(0, 10);

      // Filter to this year
      if (startStr > `${year}-12-31` || endStr < `${year}-01-01`) continue;

      const sIdx = dateMap.get(startStr) ?? (startStr < `${year}-01-01` ? 0 : runningDayIndex);
      const eIdx = dateMap.get(endStr) ?? (endStr > `${year}-12-31` ? runningDayIndex - 1 : -1);

      if (sIdx <= runningDayIndex - 1 && eIdx >= 0) {
        for (let idx = Math.max(0, sIdx); idx <= Math.min(runningDayIndex - 1, eIdx); idx++) {
          holidayMap.set(idx, [...(holidayMap.get(idx) ?? []), event.label]);
          if (daysMeta[idx]) {
            daysMeta[idx].holidayLabels = holidayMap.get(idx);
          }
        }
      }
    }

    return {
      months: monthsMeta,
      days: daysMeta,
      totalDays: runningDayIndex,
      dateToDayIndex: dateMap,
      holidayByDayIndex: holidayMap,
      todayDayIndex: dateMap.get(todayStr),
    };
  }, [year, now, todayStr, events]);

  // Filter leaves that touch this year
  const yearLeaves = useMemo(() => {
    return events.filter((e) => {
      if (e.kind !== "leave" || !e.start) return false;
      const s = e.start.slice(0, 10);
      const end = (e.end ?? e.start).slice(0, 10);
      return s <= `${year}-12-31` && end >= `${year}-01-01`;
    });
  }, [events, year]);

  // Build recursive task hierarchy (parents first, then subtasks indented)
  const hierarchicalTasks = useMemo(() => {
    const subtasksByParent = new Map<string, Task[]>();
    const topParents: Task[] = [];
    const taskIdSet = new Set((localTasks ?? []).map((t) => t.id));

    for (const task of localTasks ?? []) {
      if (task.parent_task_id && taskIdSet.has(task.parent_task_id)) {
        const list = subtasksByParent.get(task.parent_task_id) ?? [];
        list.push(task);
        subtasksByParent.set(task.parent_task_id, list);
      } else {
        topParents.push(task);
      }
    }

    const result: Array<{ task: Task; depth: number }> = [];
    const visited = new Set<string>();

    function addNode(t: Task, depth: number) {
      if (visited.has(t.id)) return;
      visited.add(t.id);
      result.push({ task: t, depth });
      const children = subtasksByParent.get(t.id) ?? [];
      for (const c of children) {
        addNode(c, depth + 1);
      }
    }

    for (const p of topParents) {
      addNode(p, 0);
    }
    for (const t of localTasks ?? []) {
      if (!visited.has(t.id)) {
        result.push({ task: t, depth: t.parent_task_id ? 1 : 0 });
      }
    }

    return result;
  }, [localTasks]);

  // CSS Grid columns: 1 sticky Task/Member column + exactly 365 or 366 days ending on 31st December
  const gridColumns = useMemo(() => {
    return `${TASK_COL_WIDTH}px repeat(${totalDays}, ${DAY_COL_WIDTH}px)`;
  }, [totalDays]);

  // Scroll to a specific month smoothly
  const scrollToMonth = useCallback(
    (monthIdx: number, smooth = true) => {
      if (!containerRef.current || !months[monthIdx]) return;
      const targetDay = months[monthIdx].startDayIndex;
      const targetLeft = targetDay * DAY_COL_WIDTH;
      containerRef.current.scrollTo({
        left: targetLeft,
        behavior: smooth ? "smooth" : "auto",
      });
      setVisibleMonthIndex(monthIdx);
    },
    [months]
  );

  // Jump to today
  const scrollToToday = useCallback(() => {
    if (!containerRef.current) return;
    if (todayDayIndex !== undefined) {
      const targetLeft = Math.max(0, (todayDayIndex - 2) * DAY_COL_WIDTH);
      containerRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
      const mIdx = days[todayDayIndex]?.monthIndex ?? now.getMonth();
      setVisibleMonthIndex(mIdx);
    } else {
      scrollToMonth(now.getMonth(), true);
    }
  }, [todayDayIndex, days, now, scrollToMonth]);

  // Initial mount positioning: automatically scroll to current/target month!
  useEffect(() => {
    if (hasInitializedScroll.current) return;
    hasInitializedScroll.current = true;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      if (initialTargetMonth === now.getMonth() && todayDayIndex !== undefined) {
        const targetLeft = Math.max(0, (todayDayIndex - 2) * DAY_COL_WIDTH);
        containerRef.current.scrollLeft = targetLeft;
      } else if (months[initialTargetMonth]) {
        containerRef.current.scrollLeft = months[initialTargetMonth].startDayIndex * DAY_COL_WIDTH;
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [initialTargetMonth, months, now, todayDayIndex]);

  // Update visible month pill dynamically as user scrolls horizontally
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const approxDayIdx = Math.max(0, Math.min(totalDays - 1, Math.floor(scrollLeft / DAY_COL_WIDTH)));
    const activeDay = days[approxDayIdx];
    if (activeDay && activeDay.monthIndex !== visibleMonthIndex) {
      setVisibleMonthIndex(activeDay.monthIndex);
    }
  }, [days, totalDays, visibleMonthIndex]);

  // Dynamically compute exact SVG coordinate paths for task dependency lines inside the cell grid
  const updateDepLines = useCallback(() => {
    if (!gridRef.current || !localDeps || localDeps.length === 0) {
      setComputedDepLines([]);
      return;
    }

    const lines: Array<{
      key: string;
      relation: string;
      path: string;
      isBlocked: boolean;
      fromTitle: string;
      toTitle: string;
      midX: number;
      midY: number;
    }> = [];

    for (const dep of localDeps) {
      let sourceId = dep.task_id;
      let targetId = dep.linked_task_id;
      const isBlocked = dep.relation === "blocks" || dep.relation === "blocked_by";

      if (dep.relation === "blocked_by") {
        sourceId = dep.linked_task_id;
        targetId = dep.task_id;
      }

      const sourceEl = gridRef.current.querySelector(`[data-task-id="${sourceId}"]`) as HTMLElement | null;
      const targetEl = gridRef.current.querySelector(`[data-task-id="${targetId}"]`) as HTMLElement | null;

      if (!sourceEl || !targetEl) continue;

      const sourceBar = sourceEl.querySelector(`[data-gantt-bar="${sourceId}"]`) as HTMLElement | null;
      const targetBar = targetEl.querySelector(`[data-gantt-bar="${targetId}"]`) as HTMLElement | null;

      const sTop = sourceEl.offsetTop;
      const sH = sourceEl.offsetHeight || 40;
      const tTop = targetEl.offsetTop;
      const tH = targetEl.offsetHeight || 40;

      const y1 = sTop + sH / 2;
      const y2 = tTop + tH / 2;

      const x1 = sourceBar
        ? sourceBar.offsetLeft + sourceBar.offsetWidth
        : TASK_COL_WIDTH + 80;
      const x2 = targetBar
        ? targetBar.offsetLeft
        : TASK_COL_WIDTH + 10;

      let d = "";
      let midX = (x1 + x2) / 2;
      let midY = (y1 + y2) / 2;

      if (x2 >= x1 + 16) {
        // Smooth curved S-bezier forward
        const c1 = x1 + (x2 - x1) * 0.45;
        const c2 = x2 - (x2 - x1) * 0.45;
        d = `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2 - 3} ${y2}`;
      } else {
        // Orthogonal backward route
        const loopX = x1 + 16;
        const approachX = Math.max(TASK_COL_WIDTH + 10, x2 - 14);
        midX = loopX;
        d = `M ${x1} ${y1} L ${loopX} ${y1} L ${loopX} ${midY} L ${approachX} ${midY} L ${approachX} ${y2} L ${x2 - 3} ${y2}`;
      }

      lines.push({
        key: `${dep.task_id}-${dep.linked_task_id}-${dep.relation}`,
        relation: dep.relation,
        path: d,
        isBlocked,
        fromTitle: localTasks.find((t) => t.id === sourceId)?.title || "Task",
        toTitle: localTasks.find((t) => t.id === targetId)?.title || "Task",
        midX,
        midY,
      });
    }

    setComputedDepLines(lines);
  }, [localDeps, localTasks]);

  useEffect(() => {
    const timer = setTimeout(updateDepLines, 60);
    window.addEventListener("resize", updateDepLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateDepLines);
    };
  }, [updateDepLines, hierarchicalTasks]);

  // Window mouse listener during bar drag / resize
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const deltaDays = Math.round(dx / DAY_COL_WIDTH);
      if (deltaDays !== dragState.currentDelta) {
        setDragState((prev) => (prev ? { ...prev, currentDelta: deltaDays } : null));
      }
    };

    const handleMouseUp = () => {
      if (!dragState) return;
      const { taskId, mode, initialStartDay, initialDueDay, currentDelta } = dragState;

      let newStartIdx = initialStartDay;
      let newDueIdx = initialDueDay;

      if (mode === "move") {
        newStartIdx += currentDelta;
        newDueIdx += currentDelta;
      } else if (mode === "resize-left") {
        newStartIdx = Math.min(newDueIdx, newStartIdx + currentDelta);
      } else if (mode === "resize-right") {
        newDueIdx = Math.max(newStartIdx, newDueIdx + currentDelta);
      }

      newStartIdx = Math.max(0, Math.min(totalDays - 1, newStartIdx));
      newDueIdx = Math.max(newStartIdx, Math.min(totalDays - 1, newDueIdx));

      const newStartDate = days[newStartIdx]?.dateStr || null;
      const newDueDate = days[newDueIdx]?.dateStr || null;

      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, start_date: newStartDate, due_date: newDueDate } : t
        )
      );
      setDragState(null);

      // Persist to server in background
      void fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: newStartDate, due_date: newDueDate }),
      });
      setTimeout(updateDepLines, 50);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, days, totalDays, updateDepLines]);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleShiftDates = useCallback(
    (task: Task, deltaDays: number) => {
      const startStr = task.start_date?.slice(0, 10);
      const dueStr = task.due_date?.slice(0, 10) || startStr;

      let newStartStr: string | null = null;
      let newDueStr: string | null = null;

      if (startStr) {
        const sDate = new Date(startStr);
        sDate.setDate(sDate.getDate() + deltaDays);
        newStartStr = sDate.toISOString().slice(0, 10);
      }
      if (dueStr) {
        const dDate = new Date(dueStr);
        dDate.setDate(dDate.getDate() + deltaDays);
        newDueStr = dDate.toISOString().slice(0, 10);
      }

      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, start_date: newStartStr, due_date: newDueStr } : t
        )
      );
      setContextMenu(null);

      void fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: newStartStr, due_date: newDueStr }),
      });
      setTimeout(updateDepLines, 60);
    },
    [updateDepLines]
  );

  const handleStartDrag = (
    e: React.MouseEvent,
    taskId: string,
    mode: "move" | "resize-left" | "resize-right",
    startDay: number,
    dueDay: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      taskId,
      mode,
      startX: e.clientX,
      initialStartDay: startDay,
      initialDueDay: dueDay,
      currentDelta: 0,
    });
  };

  const handleChangePriority = useCallback((task: Task, priority: string) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, priority } : t))
    );
    setContextMenu(null);
    void fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
  }, []);

  const handleCreateDependency = useCallback(
    async (sourceTaskId: string, targetTaskId: string, relation: string) => {
      const newDep: TaskDependency = {
        task_id: sourceTaskId,
        linked_task_id: targetTaskId,
        relation,
      };

      setLocalDeps((prev) => [
        ...prev.filter(
          (d) => !(d.task_id === sourceTaskId && d.linked_task_id === targetTaskId)
        ),
        newDep,
      ]);
      setPickerModal(null);
      setContextMenu(null);

      try {
        await fetch(`/api/task-dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            taskId: sourceTaskId,
            linkedTaskId: targetTaskId,
            relation,
          }),
        });
        setTimeout(updateDepLines, 60);
      } catch (err) {
        console.error("Failed to create dependency:", err);
      }
    },
    [projectId, updateDepLines]
  );

  const handleRemoveDependency = useCallback(
    async (taskId: string, linkedTaskId: string, relation: string) => {
      setLocalDeps((prev) =>
        prev.filter(
          (d) =>
            !(
              d.task_id === taskId &&
              d.linked_task_id === linkedTaskId &&
              d.relation === relation
            )
        )
      );
      setContextMenu(null);

      try {
        await fetch(`/api/task-dependencies`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            taskId,
            linkedTaskId,
            relation,
          }),
        });
        setTimeout(updateDepLines, 60);
      } catch (err) {
        console.error("Failed to remove dependency:", err);
      }
    },
    [projectId, updateDepLines]
  );

  // Upcoming holidays in the year for the top strip
  const yearHolidays = useMemo(() => {
    return events.filter(
      (e) => e.kind === "holiday" && e.start && e.start >= `${year}-01-01` && e.start <= `${year}-12-31`
    );
  }, [events, year]);

  return (
    <section
      className="gantt-view"
      onContextMenu={(e) => {
        if (!e.defaultPrevented) {
          e.preventDefault();
        }
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        minHeight: 0,
        padding: "12px 16px 24px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Top Header & Continuous Month Navigator */}
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: 10,
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        {/* Left: Year Switcher & Current Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link
              href={`/projects/${projectId}?view=gantt&month=${year - 1}-11`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: 6,
                border: "1px solid var(--line, #cbd5e1)",
                color: "var(--muted, #64748b)",
                textDecoration: "none",
                background: "var(--surface, #ffffff)",
              }}
              title={`View ${year - 1} Timeline`}
            >
              <ChevronLeft size={14} />
            </Link>

            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: "var(--ink, #0f172a)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{year} Timeline</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#166534",
                  background: "#dcfce7",
                  padding: "1px 7px",
                  borderRadius: 9999,
                }}
              >
                Jan 1 → Dec 31
              </span>
            </h3>

            <Link
              href={`/projects/${projectId}?view=gantt&month=${year + 1}-01`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: 6,
                border: "1px solid var(--line, #cbd5e1)",
                color: "var(--muted, #64748b)",
                textDecoration: "none",
                background: "var(--surface, #ffffff)",
              }}
              title={`View ${year + 1} Timeline`}
            >
              <ChevronRight size={14} />
            </Link>
          </div>

          <button
            type="button"
            onClick={scrollToToday}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 26,
              padding: "0 10px",
              border: "1px solid #16a34a",
              borderRadius: 6,
              background: "#ecfdf5",
              color: "#166534",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title={`Jump to Today (${todayStr} · ${timeLabel})`}
          >
            <Clock size={12} />
            Today ({timeLabel})
          </button>

          {/* Dependencies Filter Controls */}
          {dependencies.length > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                background: "var(--app-bg, #f8fafc)",
                padding: "2px 5px",
                borderRadius: 7,
                border: "1px solid var(--line, #cbd5e1)",
                fontSize: 10.5,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted, #64748b)", padding: "0 3px" }}>
                Lines:
              </span>
              <button
                type="button"
                onClick={() => setDependencyFilter("all")}
                style={{
                  border: 0,
                  borderRadius: 5,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: dependencyFilter === "all" ? 700 : 500,
                  background: dependencyFilter === "all" ? "var(--green, #167c58)" : "transparent",
                  color: dependencyFilter === "all" ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                }}
                title="Show all dependency lines"
              >
                All ({dependencies.length})
              </button>
              <button
                type="button"
                onClick={() => setDependencyFilter("blocked")}
                style={{
                  border: 0,
                  borderRadius: 5,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: dependencyFilter === "blocked" ? 700 : 500,
                  background: dependencyFilter === "blocked" ? "#dc2626" : "transparent",
                  color: dependencyFilter === "blocked" ? "#fff" : "#dc2626",
                  cursor: "pointer",
                }}
                title="Filter blocked dependency lines only"
              >
                Blocked
              </button>
              <button
                type="button"
                onClick={() => setDependencyFilter("related")}
                style={{
                  border: 0,
                  borderRadius: 5,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: dependencyFilter === "related" ? 700 : 500,
                  background: dependencyFilter === "related" ? "#8b5cf6" : "transparent",
                  color: dependencyFilter === "related" ? "#fff" : "#8b5cf6",
                  cursor: "pointer",
                }}
                title="Filter related dependency lines only"
              >
                Related
              </button>
              <button
                type="button"
                onClick={() => setDependencyFilter("none")}
                style={{
                  border: 0,
                  borderRadius: 5,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: dependencyFilter === "none" ? 700 : 500,
                  background: dependencyFilter === "none" ? "#64748b" : "transparent",
                  color: dependencyFilter === "none" ? "#fff" : "var(--muted)",
                  cursor: "pointer",
                }}
                title="Hide all dependency lines"
              >
                Hide
              </button>
            </div>
          )}
        </div>

        {/* Center: Month Fast-Jump Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "var(--app-bg, #f8fafc)",
            padding: 3,
            borderRadius: 8,
            border: "1px solid var(--line, #e2e8f0)",
            overflowX: "auto",
            maxWidth: "100%",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {months.map((m) => {
            const isSelected = m.index === visibleMonthIndex;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => scrollToMonth(m.index, true)}
                style={{
                  border: 0,
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? "var(--green, #167c58)" : "transparent",
                  color: isSelected ? "#ffffff" : "var(--muted, #64748b)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.12s ease",
                }}
                title={`Glide to ${m.name} ${year}`}
              >
                {m.shortName}
              </button>
            );
          })}
        </div>

        {/* Right: Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            color: "var(--muted, #64748b)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#16a34a" }} />
            Completed
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#2563eb" }} />
            Active
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#dc2626" }} />
            Overdue
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#8b5cf6" }} />
            Time Off
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 2, background: "#16a34a" }} />
            Today Line
          </span>
          {dependencies.length > 0 && (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 14, height: 2.5, background: "#dc2626", borderRadius: 1 }} />
                ⛔ Blocks
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 14, height: 2, borderTop: "2px dashed #8b5cf6" }} />
                🔗 Relates
              </span>
            </>
          )}
        </div>
      </header>

      {/* Top Event Strip: Holidays & Upcoming Leaves */}
      {(yearHolidays.length > 0 || yearLeaves.length > 0) && (
        <div
          className="gantt-holiday-strip"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "var(--surface, #f8fafc)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 11,
            flexShrink: 0,
            maxHeight: 74,
            overflowY: "auto",
          }}
        >
          {yearHolidays.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 11, color: "var(--muted, #475569)" }}>Holidays:</strong>
              {yearHolidays.slice(0, 8).map((h) => {
                const sIdx = dateToDayIndex.get(h.start.slice(0, 10));
                return (
                  <button
                    key={`pill-${h.id}`}
                    type="button"
                    className="gantt-holiday-chip"
                    onClick={() => {
                      if (sIdx !== undefined && containerRef.current) {
                        const targetLeft = Math.max(0, (sIdx - 1) * DAY_COL_WIDTH);
                        containerRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
                      }
                    }}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title={`Click to scroll to ${h.label} on ${h.start}`}
                  >
                    🎉 {h.start.slice(5)} · {h.label}
                  </button>
                );
              })}
            </div>
          )}

          {yearLeaves.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 11, color: "var(--primary, #3b82f6)" }}>Team Time Off:</strong>
              {yearLeaves.slice(0, 6).map((l) => {
                const sIdx = dateToDayIndex.get(l.start.slice(0, 10));
                const isSick = l.label.toLowerCase().includes("sick");
                return (
                  <button
                    key={`pill-leave-${l.id}`}
                    type="button"
                    className={`gantt-timeoff-chip ${isSick ? "is-sick" : "is-vacation"}`}
                    onClick={() => {
                      if (sIdx !== undefined && containerRef.current) {
                        const targetLeft = Math.max(0, (sIdx - 1) * DAY_COL_WIDTH);
                        containerRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
                      }
                    }}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title={`Click to scroll to ${l.person || "Team member"}'s time off`}
                  >
                    {isSick ? "🤒" : "🏖️"} {l.start.slice(5)} · {l.person || "Member"} ({l.label})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Continuous Timeline Scroll Canvas */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowX: "auto",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: 10,
          background: "var(--surface, #ffffff)",
          position: "relative",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: gridColumns,
            minWidth: "max-content",
            position: "relative",
          }}
        >
          {/* ======================================================== */}
          {/* HEADER ROW 1: CONTINUOUS 12-MONTH SPANNING BANNERS       */}
          {/* ======================================================== */}
          <div
            style={{
              gridColumn: "1 / -1",
              gridRow: 1,
              display: "grid",
              gridTemplateColumns: gridColumns,
              background: "var(--app-bg, #f8fafc)",
              borderBottom: "1px solid var(--line, #cbd5e1)",
              position: "sticky",
              top: 0,
              zIndex: 30,
            }}
          >
            {/* Sticky Top-Left Corner: Month Header */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 1,
                width: TASK_COL_WIDTH,
                minWidth: TASK_COL_WIDTH,
                maxWidth: TASK_COL_WIDTH,
                boxSizing: "border-box",
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 700,
                fontSize: 11,
                color: "var(--muted, #475569)",
                position: "sticky",
                left: 0,
                zIndex: 35,
                background: "var(--app-bg, #f1f5f9)",
                borderRight: "2px solid var(--line, #cbd5e1)",
                boxShadow: "3px 0 6px -2px rgba(0,0,0,0.06)",
                height: 32,
              }}
            >
              <span>{year} OVERVIEW</span>
              <CalendarIcon size={12} style={{ opacity: 0.6 }} />
            </div>

            {/* Continuous 12 Months Banners */}
            {months.map((m) => {
              const isLastMonth = m.index === 11;
              return (
                <div
                  key={`m-hdr-${m.key}`}
                  style={{
                    gridColumn: `${m.startDayIndex + 2} / ${m.endDayIndex + 3}`,
                    gridRow: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 10px",
                    background: m.isCurrentMonth
                      ? "rgba(22, 163, 74, 0.14)"
                      : m.index % 2 === 0
                      ? "var(--surface, #ffffff)"
                      : "var(--app-bg, #f8fafc)",
                    borderRight: isLastMonth
                      ? "2px solid #64748b"
                      : "2px solid var(--line, #94a3b8)",
                    borderLeft: m.index > 0 ? "1px solid var(--line-light, #e2e8f0)" : "none",
                    height: 32,
                    boxSizing: "border-box",
                    position: "relative",
                  }}
                >
                  {/* Sticky Month Name inside its cell so it stays in view while scrolling the month */}
                  <span
                    style={{
                      position: "sticky",
                      left: TASK_COL_WIDTH + 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      fontSize: 12,
                      color: m.isCurrentMonth ? "var(--green, #16a34a)" : "var(--ink, #1e293b)",
                      zIndex: 2,
                    }}
                  >
                    <span>{m.name}</span>
                    <span style={{ fontSize: 10, color: "var(--muted, #64748b)", fontWeight: 500 }}>
                      {year}
                    </span>
                    {m.isCurrentMonth && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          background: "rgba(22, 163, 74, 0.2)",
                          color: "var(--green, #16a34a)",
                          padding: "1px 5px",
                          borderRadius: 4,
                        }}
                      >
                        Current
                      </span>
                    )}
                  </span>

                  <span
                    style={{
                      fontSize: 9.5,
                      color: "var(--muted, #64748b)",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.daysCount}d
                  </span>
                </div>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* HEADER ROW 2: DAYS OF YEAR (1..31 per month)             */}
          {/* ======================================================== */}
          <div
            className="gantt-scale"
            style={{
              gridColumn: "1 / -1",
              gridRow: 2,
              display: "grid",
              gridTemplateColumns: gridColumns,
              background: "var(--app-bg, #f8fafc)",
              borderBottom: "1px solid var(--line, #cbd5e1)",
              position: "sticky",
              top: 32,
              zIndex: 25,
            }}
          >
            {/* Sticky "Task / Member" Header Column */}
            <div
              style={{
                gridColumn: 1,
                gridRow: 1,
                width: TASK_COL_WIDTH,
                minWidth: TASK_COL_WIDTH,
                maxWidth: TASK_COL_WIDTH,
                boxSizing: "border-box",
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                fontWeight: 700,
                fontSize: 11,
                color: "var(--ink, #334155)",
                position: "sticky",
                left: 0,
                zIndex: 28,
                background: "var(--app-bg, #f1f5f9)",
                borderRight: "2px solid var(--line, #cbd5e1)",
                boxShadow: "3px 0 6px -2px rgba(0,0,0,0.06)",
                height: 34,
              }}
            >
              Task / Member
            </div>

            {/* Continuous Day Columns with Column Highlight & Current Time Line */}
            {days.map((day) => {
              const isTodayCell = day.dayIndex === todayDayIndex;
              const isLastDay = day.dayIndex === totalDays - 1;

              return (
                <div
                  key={`day-col-${day.dayIndex}`}
                  style={{
                    gridColumn: day.dayIndex + 2,
                    gridRow: 1,
                    width: DAY_COL_WIDTH,
                    minWidth: DAY_COL_WIDTH,
                    maxWidth: DAY_COL_WIDTH,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 34,
                    position: "relative",
                    borderRight: isLastDay
                      ? "2px solid #64748b"
                      : day.isLastDayOfMonth
                      ? "2px solid var(--line, #94a3b8)"
                      : "1px solid var(--line-light, #f1f5f9)",
                    background: isTodayCell
                      ? "rgba(22, 163, 74, 0.2)"
                      : day.holidayLabels
                      ? "rgba(245, 158, 11, 0.18)"
                      : day.isWeekend
                      ? "rgba(100, 116, 139, 0.08)"
                      : "transparent",
                    color: isTodayCell
                      ? "var(--green, #16a34a)"
                      : day.isWeekend
                      ? "var(--muted, #94a3b8)"
                      : "var(--ink, #334155)",
                    fontSize: 10,
                    fontWeight: isTodayCell ? 700 : 500,
                  }}
                  title={
                    isTodayCell
                      ? `📍 Today (${day.dateStr}) · Current Time: ${timeLabel}`
                      : day.holidayLabels
                      ? `🎉 Holiday: ${day.holidayLabels.join(", ")} (${day.dateStr})`
                      : day.dateStr
                  }
                >
                  <span style={{ fontSize: 8.5, opacity: 0.65, lineHeight: 1 }}>
                    {day.dayOfWeekShort}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: isTodayCell ? 18 : "auto",
                      height: isTodayCell ? 18 : "auto",
                      borderRadius: isTodayCell ? "50%" : 0,
                      background: isTodayCell ? "#16a34a" : "transparent",
                      color: isTodayCell ? "#ffffff" : "inherit",
                      fontSize: 10,
                      fontWeight: isTodayCell ? 700 : 500,
                      lineHeight: 1,
                      marginTop: 2,
                    }}
                  >
                    {day.dayOfMonth}
                  </span>

                  {/* Current Time Indicator on Today's Day Header */}
                  {isTodayCell && (
                    <span
                      style={{
                        position: "absolute",
                        left: timeOffsetPx,
                        bottom: 0,
                        transform: "translateX(-50%)",
                        width: 0,
                        height: 0,
                        borderLeft: "4px solid transparent",
                        borderRight: "4px solid transparent",
                        borderTop: "5px solid #16a34a",
                        zIndex: 10,
                      }}
                      title={`Current Time Marker (${timeLabel} · ${Math.round(timeFraction * 100)}% of day completed)`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* SECTION: TEAM TIME OFF (LEAVES)                           */}
          {/* ======================================================== */}
          {yearLeaves.length > 0 && (
            <>
              {/* Leaves Banner Row */}
              <div
                className="gantt-timeoff-banner"
                style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: gridColumns,
                  minHeight: 28,
                  alignItems: "center",
                }}
              >
                <div
                  className="gantt-timeoff-banner-sticky"
                  style={{
                    gridColumn: 1,
                    gridRow: 1,
                    position: "sticky",
                    left: 0,
                    zIndex: 15,
                    padding: "4px 12px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    boxShadow: "3px 0 6px -2px rgba(0,0,0,0.06)",
                    width: TASK_COL_WIDTH,
                    minWidth: TASK_COL_WIDTH,
                    maxWidth: TASK_COL_WIDTH,
                    boxSizing: "border-box",
                  }}
                >
                  🏖️ Team Time Off ({yearLeaves.length})
                </div>

                {/* Explicitly Placed Cells (Never Auto-Placed) */}
                {days.map((day) => {
                  const isTodayCell = day.dayIndex === todayDayIndex;
                  const isLastDay = day.dayIndex === totalDays - 1;

                  return (
                    <span
                      key={`leave-bg-${day.dayIndex}`}
                      style={{
                        gridColumn: day.dayIndex + 2,
                        gridRow: 1,
                        width: DAY_COL_WIDTH,
                        height: "100%",
                        position: "relative",
                        borderRight: isLastDay
                          ? "2px solid #64748b"
                          : day.isLastDayOfMonth
                          ? "2px solid var(--line, #94a3b8)"
                          : "1px solid var(--line-light, rgba(148, 163, 184, 0.15))",
                        background: isTodayCell ? "rgba(22, 163, 74, 0.09)" : "transparent",
                      }}
                    >
                      {/* Vertical Time Line on Today Cell */}
                      {isTodayCell && (
                        <span
                          style={{
                            position: "absolute",
                            left: timeOffsetPx,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: "#16a34a",
                            opacity: 0.8,
                            pointerEvents: "none",
                            zIndex: 2,
                          }}
                        />
                      )}
                    </span>
                  );
                })}
              </div>

              {/* Individual Leave Rows */}
              {yearLeaves.map((event) => {
                const sStr = event.start.slice(0, 10);
                const eStr = (event.end ?? event.start).slice(0, 10);

                const sIdx = dateToDayIndex.get(sStr) ?? (sStr < `${year}-01-01` ? 0 : totalDays);
                const eIdx = dateToDayIndex.get(eStr) ?? (eStr > `${year}-12-31` ? totalDays - 1 : -1);

                if (sIdx > totalDays - 1 || eIdx < 0) return null;

                const clampedStart = Math.max(0, sIdx);
                const clampedEnd = Math.max(clampedStart, Math.min(totalDays - 1, eIdx));
                const personName = event.person || "Team member";
                const isSick = event.label.toLowerCase().includes("sick");
                const spanDays = clampedEnd - clampedStart + 1;

                return (
                  <div
                    key={`event-${event.id}`}
                    className="gantt-row gantt-event-row gantt-leave-row"
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gridTemplateColumns: gridColumns,
                      minHeight: 38,
                      alignItems: "center",
                      position: "relative",
                    }}
                  >
                    {/* Sticky Person Cell */}
                    <div
                      className="gantt-task-name gantt-leave-sticky-person"
                      style={{
                        gridColumn: 1,
                        gridRow: 1,
                        width: TASK_COL_WIDTH,
                        minWidth: TASK_COL_WIDTH,
                        maxWidth: TASK_COL_WIDTH,
                        boxSizing: "border-box",
                        padding: "0 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        overflow: "hidden",
                        position: "sticky",
                        left: 0,
                        zIndex: 12,
                        boxShadow: "3px 0 6px -2px rgba(0,0,0,0.06)",
                        height: 38,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          overflow: "hidden",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          backgroundColor: isSick ? "#3b82f6" : "#8b5cf6",
                          color: "#ffffff",
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        {event.avatarUrl ? (
                          <img
                            src={event.avatarUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          (personName.charAt(0) || "?").toUpperCase()
                        )}
                      </span>
                      <span
                        className={`gantt-leave-person-name ${isSick ? "is-sick" : "is-vacation"}`}
                        style={{
                          fontSize: 11,
                          fontWeight: 650,
                          color: isSick ? "var(--primary, #2563eb)" : "#7c3aed",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={`${personName} · ${event.label}`}
                      >
                        {isSick ? "🤒" : "🏖️"} {personName}
                        <span style={{ fontSize: 10, color: "var(--muted, #64748b)", fontWeight: 500, marginLeft: 4 }}>
                          ({event.label})
                        </span>
                      </span>
                    </div>

                    {/* Explicitly Placed Day Grid Background Cells */}
                    {days.map((day) => {
                      const isTodayCell = day.dayIndex === todayDayIndex;
                      const isLastDay = day.dayIndex === totalDays - 1;

                      return (
                        <span
                          key={`cell-leave-${event.id}-${day.dayIndex}`}
                          style={{
                            gridColumn: day.dayIndex + 2,
                            gridRow: 1,
                            width: DAY_COL_WIDTH,
                            height: "100%",
                            position: "relative",
                            borderRight: isLastDay
                              ? "2px solid #64748b"
                              : day.isLastDayOfMonth
                              ? "2px solid var(--line, #94a3b8)"
                              : "1px solid var(--line-light, rgba(148, 163, 184, 0.15))",
                            background: isTodayCell
                              ? "rgba(22, 163, 74, 0.09)"
                              : day.holidayLabels
                              ? "rgba(245,158,11,0.06)"
                              : day.isWeekend
                              ? "rgba(100, 116, 139, 0.08)"
                              : "transparent",
                          }}
                        >
                          {/* Vertical Time Line on Today Cell */}
                          {isTodayCell && (
                            <span
                              style={{
                                position: "absolute",
                                left: timeOffsetPx,
                                top: 0,
                                bottom: 0,
                                width: 2,
                                background: "#16a34a",
                                opacity: 0.8,
                                pointerEvents: "none",
                                zIndex: 2,
                              }}
                            />
                          )}
                        </span>
                      );
                    })}

                    {/* Continuous Leave Bar across months sitting cleanly on top of cells */}
                    <span
                      className="gantt-event-bar gantt-event-leave"
                      style={{
                        gridColumn: `${clampedStart + 2} / ${clampedEnd + 3}`,
                        gridRow: 1,
                        alignSelf: "center",
                        height: 24,
                        borderRadius: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "0 8px",
                        overflow: "hidden",
                        minWidth: 0,
                        color: "#ffffff",
                        fontSize: 10,
                        fontWeight: 650,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        zIndex: 4,
                        margin: "0 1px",
                        background: isSick
                          ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                          : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                      }}
                      title={`${personName} · ${event.label} (${sStr}${eStr !== sStr ? ` to ${eStr}` : ""})`}
                    >
                      <span style={{ flexShrink: 0, fontSize: 10 }}>{isSick ? "🤒" : "🏖️"}</span>
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: 10,
                        }}
                      >
                        {spanDays > 1 ? `${personName}: ${event.label}` : event.label.replace(" leave", "")}
                      </span>
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {/* ======================================================== */}
          {/* SECTION: TASKS BANNER                                     */}
          {/* ======================================================== */}
          <div
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: gridColumns,
              background: "var(--app-bg, #f8fafc)",
              borderBottom: "1px solid var(--line, #cbd5e1)",
              minHeight: 28,
              alignItems: "center",
              marginTop: yearLeaves.length > 0 ? 6 : 0,
            }}
          >
            <div
              style={{
                gridColumn: 1,
                gridRow: 1,
                position: "sticky",
                left: 0,
                zIndex: 15,
                background: "var(--app-bg, #f8fafc)",
                padding: "4px 12px",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--muted, #475569)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderRight: "2px solid var(--line, #cbd5e1)",
                boxShadow: "3px 0 6px -2px rgba(0,0,0,0.06)",
                width: TASK_COL_WIDTH,
                minWidth: TASK_COL_WIDTH,
                maxWidth: TASK_COL_WIDTH,
                boxSizing: "border-box",
              }}
            >
              📋 Tasks ({tasks.length})
            </div>

            {/* Explicitly Placed Cells */}
            {days.map((day) => {
              const isTodayCell = day.dayIndex === todayDayIndex;
              const isLastDay = day.dayIndex === totalDays - 1;

              return (
                <span
                  key={`task-head-bg-${day.dayIndex}`}
                  style={{
                    gridColumn: day.dayIndex + 2,
                    gridRow: 1,
                    width: DAY_COL_WIDTH,
                    height: "100%",
                    position: "relative",
                    borderRight: isLastDay
                      ? "2px solid #64748b"
                      : day.isLastDayOfMonth
                      ? "2px solid var(--line, #94a3b8)"
                      : "1px solid var(--line-light, #f1f5f9)",
                    background: isTodayCell ? "rgba(22, 163, 74, 0.09)" : "transparent",
                  }}
                >
                  {/* Vertical Time Line on Today Cell */}
                  {isTodayCell && (
                    <span
                      style={{
                        position: "absolute",
                        left: timeOffsetPx,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: "#16a34a",
                        opacity: 0.8,
                        pointerEvents: "none",
                        zIndex: 2,
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* SECTION: CONTINUOUS TASK ROWS (Placed Over Grid Cells)   */}
          {/* ======================================================== */}
          {hierarchicalTasks.map(({ task, depth }) => {
            const isSubtask = depth > 0;
            const startRaw = task.start_date ?? task.created_at?.slice(0, 10) ?? task.due_date;
            const dueRaw = task.due_date ?? task.start_date;

            const isDone = task.status_category === "completed";
            const isLate =
              !!task.due_date &&
              task.due_date < todayStr &&
              !["completed", "cancelled"].includes(task.status_category ?? "");

            const endRaw = isLate ? todayStr : dueRaw;

            // Date calculations in this year
            const startInYear = startRaw ? startRaw.slice(0, 10) : null;
            const endInYear = endRaw ? endRaw.slice(0, 10) : null;

            let visible = false;
            let clampedStart = 0;
            let clampedEnd = 0;

            if (startInYear && endInYear) {
              const notInThisYear =
                startInYear > `${year}-12-31` || endInYear < `${year}-01-01`;

              if (!notInThisYear) {
                visible = true;
                const sIdx =
                  dateToDayIndex.get(startInYear) ?? (startInYear < `${year}-01-01` ? 0 : totalDays);
                const eIdx =
                  dateToDayIndex.get(endInYear) ??
                  (endInYear > `${year}-12-31` ? totalDays - 1 : -1);

                clampedStart = Math.max(0, Math.min(totalDays - 1, sIdx));
                clampedEnd = Math.max(clampedStart, Math.min(totalDays - 1, eIdx));
              }
            }

            const progress =
              task.progress > 0
                ? task.progress
                : task.status_category === "active" || task.status_category === "completed"
                ? 100
                : 0;

            const assigneeId = (task.assigneeIds ?? []).find(
              (id) => typeof id === "string" && id.trim().length > 0
            );
            const assigneeName = assigneeId ? people?.get(assigneeId) ?? "Team member" : "";
            const assigneeAvatar = assigneeId ? profileAvatars?.get(assigneeId) : null;

            return (
              <div
                key={task.id}
                data-task-id={task.id}
                className={`gantt-row${isSubtask ? " is-subtask-row" : ""}`}
                style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: gridColumns,
                  background: isSubtask ? "var(--app-bg, #fafbfa)" : "var(--surface, #ffffff)",
                  borderBottom: "1px solid var(--line, #e2e8f0)",
                  minHeight: 40,
                  alignItems: "center",
                  position: "relative",
                }}
              >
                {/* Sticky Task Name Column with Depth Indentation & Avatar */}
                <div
                  className="gantt-task-name"
                  style={{
                    gridColumn: 1,
                    gridRow: 1,
                    width: TASK_COL_WIDTH,
                    minWidth: TASK_COL_WIDTH,
                    maxWidth: TASK_COL_WIDTH,
                    boxSizing: "border-box",
                    paddingLeft: 10 + depth * 16,
                    paddingRight: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    overflow: "hidden",
                    background: isSubtask ? "var(--app-bg, #f8faf8)" : "var(--surface, #ffffff)",
                    position: "sticky",
                    left: 0,
                    zIndex: 10,
                    borderRight: "2px solid var(--line, #cbd5e1)",
                    boxShadow: "3px 0 6px -2px rgba(0,0,0,0.06)",
                    height: 40,
                  }}
                >
                  {isSubtask && (
                    <span
                      style={{
                        color: "var(--muted, #94a3b8)",
                        fontSize: 12,
                        fontWeight: 700,
                        marginRight: -2,
                        flexShrink: 0,
                      }}
                      title="Subtask"
                    >
                      ↳
                    </span>
                  )}

                  {assigneeId ? (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: getAvatarColor(assigneeId),
                        color: "#ffffff",
                        fontSize: 8.5,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                      title={assigneeName}
                    >
                      {assigneeAvatar ? (
                        <img
                          src={assigneeAvatar}
                          alt={assigneeName}
                          loading="lazy"
                          decoding="async"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        (assigneeName?.charAt(0) || "?").toUpperCase()
                      )}
                    </span>
                  ) : (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "1px dashed var(--line, #cbd5e1)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: 8,
                        color: "var(--muted, #94a3b8)",
                      }}
                      title="Unassigned"
                    >
                      —
                    </span>
                  )}

                  <Link
                    href={`/projects/${projectId}/tasks/${task.id}`}
                    title={task.title}
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: isSubtask ? "var(--muted, #475569)" : "var(--ink, #0f172a)",
                      fontSize: isSubtask ? 11 : 12,
                      fontWeight: isSubtask ? 550 : 700,
                      textDecoration: "none",
                      flex: 1,
                    }}
                  >
                    {task.title}
                  </Link>

                  {isSubtask && (
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        color: "var(--muted, #64748b)",
                        background: "var(--line-light, #e2e8f0)",
                        padding: "1px 4px",
                        borderRadius: 3,
                        flexShrink: 0,
                      }}
                    >
                      sub
                    </span>
                  )}
                </div>

                {/* Explicitly Placed Day Grid Background Cells (Never pushed by tasks!) */}
                {days.map((day) => {
                  const isTodayCell = day.dayIndex === todayDayIndex;
                  const isLastDay = day.dayIndex === totalDays - 1;

                  return (
                    <span
                      key={`cell-bg-${task.id}-${day.dayIndex}`}
                      className={`gantt-cell${day.holidayLabels ? " is-holiday" : ""}${isTodayCell ? " is-today" : ""}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          visible: true,
                          x: Math.min(window.innerWidth - 220, e.clientX),
                          y: Math.min(window.innerHeight - 200, e.clientY),
                          dateStr: day.dateStr,
                        });
                      }}
                      title={
                        isTodayCell
                          ? `Today (${day.dateStr}) · Time: ${timeLabel}`
                          : day.holidayLabels
                          ? `Holiday: ${day.holidayLabels.join(", ")}`
                          : undefined
                      }
                      style={{
                        gridColumn: day.dayIndex + 2,
                        gridRow: 1,
                        width: DAY_COL_WIDTH,
                        height: "100%",
                        boxSizing: "border-box",
                        position: "relative",
                        borderRight: isLastDay
                          ? "2px solid #64748b"
                          : day.isLastDayOfMonth
                          ? "2px solid var(--line, #94a3b8)"
                          : "1px solid var(--line-light, #eff1ef)",
                        background: isTodayCell
                          ? "rgba(22, 163, 74, 0.09)"
                          : day.holidayLabels
                          ? "rgba(245,158,11,0.06)"
                          : day.isWeekend
                          ? "var(--app-bg, #f8fafc)"
                          : "transparent",
                      }}
                    >
                      {/* Vertical Current Time Line on Today Cell */}
                      {isTodayCell && (
                        <span
                          style={{
                            position: "absolute",
                            left: timeOffsetPx,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: "#16a34a",
                            opacity: 0.8,
                            pointerEvents: "none",
                            zIndex: 2,
                          }}
                        />
                      )}
                    </span>
                  );
                })}

                {/* Continuous Task Bar Filling Inside the Cells directly OVER background */}
                {visible && (() => {
                  let displayStart = clampedStart;
                  let displayEnd = clampedEnd;
                  if (dragState && dragState.taskId === task.id) {
                    if (dragState.mode === "move") {
                      displayStart = Math.max(0, Math.min(totalDays - 1, clampedStart + dragState.currentDelta));
                      displayEnd = Math.max(displayStart, Math.min(totalDays - 1, clampedEnd + dragState.currentDelta));
                    } else if (dragState.mode === "resize-left") {
                      displayStart = Math.max(0, Math.min(clampedEnd, clampedStart + dragState.currentDelta));
                    } else if (dragState.mode === "resize-right") {
                      displayEnd = Math.max(clampedStart, Math.min(totalDays - 1, clampedEnd + dragState.currentDelta));
                    }
                  }

                  return (
                    <div
                      className={`gantt-bar${isLate ? " is-overdue" : ""}`}
                      data-gantt-bar={task.id}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          visible: true,
                          x: Math.min(window.innerWidth - 260, e.clientX),
                          y: Math.min(window.innerHeight - 380, e.clientY),
                          task,
                        });
                      }}
                      style={
                        {
                          gridColumn: `${displayStart + 2} / ${displayEnd + 3}`,
                          gridRow: 1,
                          height: 24,
                          borderRadius: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "0 4px",
                          overflow: "hidden",
                          minWidth: 0,
                          zIndex: 4,
                          position: "relative",
                          cursor: dragState?.taskId === task.id ? "grabbing" : "grab",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          margin: "0 1px",
                          background: isDone
                            ? "linear-gradient(135deg, #167c58, #10b981)"
                            : isLate
                            ? "linear-gradient(135deg, #dc2626, #ef4444)"
                            : isSubtask
                            ? "linear-gradient(135deg, #0284c7, #38bdf8)"
                            : "linear-gradient(135deg, #2563eb, #3b82f6)",
                          "--bar-progress": `${Math.max(0, Math.min(100, progress))}%`,
                          userSelect: "none",
                        } as React.CSSProperties
                      }
                      title={`${task.title} · ${startRaw} to ${task.due_date ?? endRaw}${
                        isLate ? " (Overdue)" : ""
                      } (Drag bar to move, drag edges to resize, right-click for options)`}
                      onMouseDown={(e) => {
                        if (e.button === 0) {
                          handleStartDrag(e, task.id, "move", clampedStart, clampedEnd);
                        }
                      }}
                    >
                      {/* Left Resize Handle */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 7,
                          cursor: "col-resize",
                          zIndex: 10,
                          background: "rgba(255,255,255,0.25)",
                          borderRadius: "6px 0 0 6px",
                        }}
                        title="Drag edge to change start date"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (e.button === 0) {
                            handleStartDrag(e, task.id, "resize-left", clampedStart, clampedEnd);
                          }
                        }}
                      />

                      {/* Content Area */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          overflow: "hidden",
                          padding: "0 4px",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {assigneeId && (
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              backgroundColor: "rgba(255, 255, 255, 0.25)",
                              color: "#fff",
                              fontSize: 8,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                              border: "1px solid rgba(255, 255, 255, 0.4)",
                            }}
                            title={assigneeName}
                          >
                            {assigneeAvatar ? (
                              <img
                                src={assigneeAvatar}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              (assigneeName?.charAt(0) || "?").toUpperCase()
                            )}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 650,
                            color: "#ffffff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                          }}
                        >
                          {task.title}
                        </span>
                      </div>

                      {/* Right Resize Handle */}
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 7,
                          cursor: "col-resize",
                          zIndex: 10,
                          background: "rgba(255,255,255,0.25)",
                          borderRadius: "0 6px 6px 0",
                        }}
                        title="Drag edge to change due date"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (e.button === 0) {
                            handleStartDrag(e, task.id, "resize-right", clampedStart, clampedEnd);
                          }
                        }}
                      />
                    </div>
                  );
                })()}

                {/* Unscheduled Indicator */}
                {!visible && (
                  <span
                    className="gantt-unscheduled"
                    style={{
                      gridColumn: "2 / 7",
                      gridRow: 1,
                      zIndex: 3,
                      color: "var(--muted, #94a3b8)",
                      fontSize: 10,
                      fontStyle: "italic",
                      paddingLeft: 8,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    No schedule
                  </span>
                )}
              </div>
            );
          })}

          {!tasks.length && (
            <p
              className="muted small"
              style={{
                gridColumn: "1 / -1",
                padding: "24px 16px",
                margin: 0,
                color: "var(--muted, #64748b)",
                textAlign: "center",
              }}
            >
              No tasks match the current filters.
            </p>
          )}

          {/* Non-intrusive SVG Task Dependency Connectors layer situated strictly inside cell grid canvas */}
          {dependencyFilter !== "none" && computedDepLines.length > 0 && (
            <svg
              className="gantt-dependency-lines-layer"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 8,
                overflow: "visible",
              }}
            >
              <defs>
                <marker
                  id="arrow-blocked"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#dc2626" />
                </marker>
                <marker
                  id="arrow-related"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#8b5cf6" />
                </marker>
              </defs>

              {computedDepLines
                .filter((l) => {
                  if (dependencyFilter === "all") return true;
                  if (dependencyFilter === "blocked") return l.isBlocked;
                  if (dependencyFilter === "related") return !l.isBlocked;
                  return false;
                })
                .map((line) => {
                  const isHovered = hoveredDepKey === line.key;
                  const color = line.isBlocked ? "#dc2626" : "#8b5cf6";
                  const marker = line.isBlocked ? "url(#arrow-blocked)" : "url(#arrow-related)";

                  return (
                    <g key={line.key}>
                      {/* Wider hit-area for easy hover */}
                      <path
                        d={line.path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onMouseEnter={() => setHoveredDepKey(line.key)}
                        onMouseLeave={() => setHoveredDepKey(null)}
                      >
                        <title>{`${line.isBlocked ? "Blocked By: " : "Related To: "} ${line.fromTitle} → ${line.toTitle}`}</title>
                      </path>

                      {/* Visual Line */}
                      <path
                        d={line.path}
                        fill="none"
                        stroke={color}
                        strokeWidth={line.isBlocked ? (isHovered ? 3.5 : 2.2) : isHovered ? 3 : 1.8}
                        strokeDasharray={line.isBlocked ? undefined : "5,4"}
                        markerEnd={marker}
                        style={{
                          pointerEvents: "none",
                          filter: isHovered
                            ? `drop-shadow(0 2px 4px ${color}88)`
                            : line.isBlocked
                            ? "drop-shadow(0 1px 2px rgba(220, 38, 38, 0.35))"
                            : undefined,
                          transition: "stroke-width 0.15s ease",
                        }}
                      />

                      {/* Midpoint badge for instant understanding */}
                      {line.midX > 0 && line.midY > 0 && (
                        <g
                          transform={`translate(${line.midX}, ${line.midY})`}
                          style={{ pointerEvents: "auto", cursor: "pointer" }}
                          onMouseEnter={() => setHoveredDepKey(line.key)}
                          onMouseLeave={() => setHoveredDepKey(null)}
                        >
                          <rect
                            x={-28}
                            y={-9}
                            width={56}
                            height={18}
                            rx={9}
                            fill={line.isBlocked ? "#fef2f2" : "#f5f3ff"}
                            stroke={color}
                            strokeWidth={1.2}
                          />
                          <text
                            x={0}
                            y={3.5}
                            textAnchor="middle"
                            fill={color}
                            fontSize={8.5}
                            fontWeight={700}
                            fontFamily="'DM Sans', sans-serif"
                          >
                            {line.isBlocked ? "⛔ BLOCKS" : "🔗 RELATES"}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
            </svg>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION: CUSTOM ORBITWORK CONTEXT MENU (Suppresses Native)*/}
      {/* ======================================================== */}
      {typeof document !== "undefined" && contextMenu?.visible && createPortal(
        <div
          className="orbitwork-timeline-context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 99999,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)",
            minWidth: 240,
            maxWidth: 320,
            padding: "6px 0",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#0f172a",
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.task ? (
            <>
              <div
                style={{
                  padding: "6px 12px 8px",
                  borderBottom: "1px solid #e2e8f0",
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: 0.5 }}>
                  Task Actions
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {contextMenu.task.title}
                </div>
              </div>

              {/* Blocker & Dependency triggers */}
              <button
                type="button"
                onClick={() => {
                  setPickerModal({ sourceTask: contextMenu.task!, relation: "blocks" });
                  setContextMenu(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 12px",
                  background: "transparent",
                  border: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#dc2626",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <ShieldAlert size={14} />
                <span>⛔ Add Blocker (Blocks Another Task)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickerModal({ sourceTask: contextMenu.task!, relation: "depends_on" });
                  setContextMenu(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 12px",
                  background: "transparent",
                  border: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ea580c",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fff7ed")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <AlertTriangle size={14} />
                <span>⚠️ Mark Blocked By Task...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickerModal({ sourceTask: contextMenu.task!, relation: "relates_to" });
                  setContextMenu(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 12px",
                  background: "transparent",
                  border: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#7c3aed",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LinkIcon size={14} />
                <span>🔗 Add Related Dependency...</span>
              </button>

              <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />

              {/* Date Shifting */}
              <div style={{ padding: "4px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                  Shift Task Schedule
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    { label: "-7d", days: -7 },
                    { label: "-1d", days: -1 },
                    { label: "+1d", days: 1 },
                    { label: "+7d", days: 7 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleShiftDates(contextMenu.task!, btn.days)}
                      style={{
                        flex: 1,
                        padding: "4px 0",
                        fontSize: 11,
                        fontWeight: 700,
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#f8fafc",
                        color: "#0f172a",
                        cursor: "pointer",
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />

              {/* Priority */}
              <div style={{ padding: "4px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                  Priority
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    { label: "Urgent", color: "#dc2626", bg: "#fef2f2" },
                    { label: "High", color: "#ea580c", bg: "#fff7ed" },
                    { label: "Medium", color: "#2563eb", bg: "#eff6ff" },
                    { label: "Low", color: "#64748b", bg: "#f1f5f9" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleChangePriority(contextMenu.task!, p.label.toLowerCase())}
                      style={{
                        flex: 1,
                        padding: "3px 0",
                        fontSize: 10,
                        fontWeight: 700,
                        border: `1px solid ${p.color}40`,
                        borderRadius: 4,
                        background: p.bg,
                        color: p.color,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Links list */}
              {localDeps.filter(
                (d) => d.task_id === contextMenu.task!.id || d.linked_task_id === contextMenu.task!.id
              ).length > 0 && (
                <>
                  <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
                  <div style={{ padding: "4px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                      Active Dependencies
                    </div>
                    {localDeps
                      .filter(
                        (d) =>
                          d.task_id === contextMenu.task!.id || d.linked_task_id === contextMenu.task!.id
                      )
                      .map((dep) => {
                        const otherId =
                          dep.task_id === contextMenu.task!.id ? dep.linked_task_id : dep.task_id;
                        const otherTask = localTasks.find((t) => t.id === otherId);
                        const isSource = dep.task_id === contextMenu.task!.id;
                        const label =
                          dep.relation === "blocks"
                            ? isSource
                              ? "Blocks"
                              : "Blocked by"
                            : "Related";

                        return (
                          <div
                            key={`${dep.task_id}-${dep.linked_task_id}-${dep.relation}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: 11,
                              padding: "3px 0",
                              gap: 6,
                            }}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: "#334155" }}>
                              <strong>{label}:</strong> {otherTask?.title || "Task"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDependency(dep.task_id, dep.linked_task_id, dep.relation)}
                              title="Delete dependency"
                              style={{
                                border: 0,
                                background: "transparent",
                                color: "#dc2626",
                                cursor: "pointer",
                                padding: 2,
                                display: "inline-flex",
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}

              <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />

              <Link
                href={`/projects/${projectId}/tasks/${contextMenu.task.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  color: "#0f172a",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 12,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <ArrowRight size={13} />
                <span>View Full Task Details</span>
              </Link>
            </>
          ) : (
            <div style={{ padding: "6px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                📅 Date: {contextMenu.dateStr}
              </div>
              <button
                type="button"
                onClick={() => {
                  scrollToToday();
                  setContextMenu(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  width: "100%",
                  padding: "6px 8px",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                <CalendarIcon size={13} />
                <span>Go to Today</span>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* SECTION: TARGET PICKER MODAL (Add Blocker / Dependency)   */}
      {/* ======================================================== */}
      {typeof document !== "undefined" && pickerModal && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPickerModal(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
              width: "100%",
              maxWidth: 480,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 750, color: "#0f172a" }}>
                  {pickerModal.relation === "blocks"
                    ? "Select Task to Block"
                    : pickerModal.relation === "depends_on"
                    ? "Select Prerequisite Task"
                    : "Select Related Dependency"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  Current Task: <strong>{pickerModal.sourceTask.title}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerModal(null)}
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "#64748b", padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid #e2e8f0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                }}
              >
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  placeholder="Filter tasks by name or key..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  style={{
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    fontSize: 12,
                    width: "100%",
                    color: "#0f172a",
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Task List */}
            <div style={{ overflowY: "auto", padding: "8px 12px", flex: 1, display: "grid", gap: 4 }}>
              {localTasks
                .filter(
                  (t) =>
                    t.id !== pickerModal.sourceTask.id &&
                    (!pickerSearch ||
                      t.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                      t.generated_key?.toLowerCase().includes(pickerSearch.toLowerCase()))
                )
                .map((targetTask) => {
                  const isBlocked = pickerModal.relation === "blocks";
                  return (
                    <button
                      key={targetTask.id}
                      type="button"
                      onClick={() =>
                        handleCreateDependency(
                          pickerModal.sourceTask.id,
                          targetTask.id,
                          pickerModal.relation
                        )
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isBlocked ? "#fef2f2" : "#f5f3ff";
                        e.currentTarget.style.borderColor = isBlocked ? "#dc2626" : "#8b5cf6";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#ffffff";
                        e.currentTarget.style.borderColor = "#e2e8f0";
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>
                          {targetTask.generated_key || "TASK"}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 650, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {targetTask.title}
                        </div>
                      </div>
                      <Plus size={14} color={isBlocked ? "#dc2626" : "#8b5cf6"} />
                    </button>
                  );
                })}

              {localTasks.filter((t) => t.id !== pickerModal.sourceTask.id).length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 12 }}>
                  No other tasks available to link.
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
