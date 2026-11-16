"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Sparkles } from "lucide-react";

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

export default function TaskGantt({
  projectId,
  tasks = [],
  month,
  events = [],
  people,
  profileAvatars,
}: {
  projectId: string;
  tasks: Task[];
  month?: string;
  events?: ScheduleEvent[];
  people?: Map<string, string>;
  profileAvatars?: Map<string, string | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInitializedScroll = useRef(false);

  // Determine current year and initial target month
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }, [now]);

  const [year, initialTargetMonth] = useMemo(() => {
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      return [y, Math.max(0, Math.min(11, m - 1))];
    }
    return [now.getFullYear(), now.getMonth()];
  }, [month, now]);

  const [visibleMonthIndex, setVisibleMonthIndex] = useState<number>(initialTargetMonth);

  // Generate continuous year metadata: 12 months, 365 or 366 days
  const { months, days, totalDays, dateToDayIndex, holidayByDayIndex } = useMemo(() => {
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
    const taskIdSet = new Set((tasks ?? []).map((t) => t.id));

    for (const task of tasks ?? []) {
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
    for (const t of tasks ?? []) {
      if (!visited.has(t.id)) {
        result.push({ task: t, depth: t.parent_task_id ? 1 : 0 });
      }
    }

    return result;
  }, [tasks]);

  // CSS Grid columns: 1 sticky Task/Member column + all days of the year
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
    const todayIndex = dateToDayIndex.get(todayStr);
    if (todayIndex !== undefined) {
      // Center today slightly
      const targetLeft = Math.max(0, (todayIndex - 2) * DAY_COL_WIDTH);
      containerRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
      const mIdx = days[todayIndex]?.monthIndex ?? now.getMonth();
      setVisibleMonthIndex(mIdx);
    } else {
      scrollToMonth(now.getMonth(), true);
    }
  }, [dateToDayIndex, todayStr, days, now, scrollToMonth]);

  // Initial mount positioning: automatically scroll to current/target month!
  useEffect(() => {
    if (hasInitializedScroll.current) return;
    hasInitializedScroll.current = true;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const todayIndex = dateToDayIndex.get(todayStr);

      if (initialTargetMonth === now.getMonth() && todayIndex !== undefined) {
        // Position at today minus 2 days so current context is immediately visible
        const targetLeft = Math.max(0, (todayIndex - 2) * DAY_COL_WIDTH);
        containerRef.current.scrollLeft = targetLeft;
      } else if (months[initialTargetMonth]) {
        containerRef.current.scrollLeft = months[initialTargetMonth].startDayIndex * DAY_COL_WIDTH;
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [initialTargetMonth, months, now, todayStr, dateToDayIndex]);

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

  // Upcoming holidays in the year for the top strip
  const yearHolidays = useMemo(() => {
    return events.filter(
      (e) => e.kind === "holiday" && e.start && e.start >= `${year}-01-01` && e.start <= `${year}-12-31`
    );
  }, [events, year]);

  return (
    <section
      className="gantt-view"
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
          marginBottom: 12,
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
                Continuous 12 Months
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
              gap: 4,
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
            title="Jump directly to today's date in the timeline"
          >
            <Clock size={12} />
            Today
          </button>
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
                    onClick={() => {
                      if (sIdx !== undefined && containerRef.current) {
                        const targetLeft = Math.max(0, (sIdx - 1) * DAY_COL_WIDTH);
                        containerRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
                      }
                    }}
                    style={{
                      border: "1px solid #fde68a",
                      background: "#fef3c7",
                      color: "#92400e",
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
              <strong style={{ fontSize: 11, color: "#1d4ed8" }}>Team Time Off:</strong>
              {yearLeaves.slice(0, 6).map((l) => {
                const sIdx = dateToDayIndex.get(l.start.slice(0, 10));
                const isSick = l.label.toLowerCase().includes("sick");
                return (
                  <button
                    key={`pill-leave-${l.id}`}
                    type="button"
                    onClick={() => {
                      if (sIdx !== undefined && containerRef.current) {
                        const targetLeft = Math.max(0, (sIdx - 1) * DAY_COL_WIDTH);
                        containerRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
                      }
                    }}
                    style={{
                      border: isSick ? "1px solid #bfdbfe" : "1px solid #ddd6fe",
                      background: isSick ? "#eff6ff" : "#f5f3ff",
                      color: isSick ? "#1e40af" : "#6d28d9",
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
            {months.map((m) => (
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
                    ? "#f0fdf4"
                    : m.index % 2 === 0
                    ? "var(--surface, #ffffff)"
                    : "var(--app-bg, #f8fafc)",
                  borderRight: "2px solid var(--line, #94a3b8)",
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
                    color: m.isCurrentMonth ? "#166534" : "var(--ink, #1e293b)",
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
                        background: "#dcfce7",
                        color: "#166534",
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
            ))}
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

            {/* Continuous Day Columns */}
            {days.map((day) => {
              return (
                <div
                  key={`day-col-${day.dayIndex}`}
                  style={{
                    width: DAY_COL_WIDTH,
                    minWidth: DAY_COL_WIDTH,
                    maxWidth: DAY_COL_WIDTH,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 34,
                    borderRight: day.isLastDayOfMonth
                      ? "2px solid var(--line, #94a3b8)"
                      : "1px solid var(--line-light, #f1f5f9)",
                    background: day.isToday
                      ? "#ecfdf5"
                      : day.holidayLabels
                      ? "#fffbeb"
                      : day.isWeekend
                      ? "var(--app-bg, #f8fafc)"
                      : "transparent",
                    color: day.isToday
                      ? "#166534"
                      : day.isWeekend
                      ? "#94a3b8"
                      : "var(--ink, #334155)",
                    fontSize: 10,
                    fontWeight: day.isToday ? 700 : 500,
                  }}
                  title={
                    day.holidayLabels
                      ? `🎉 Holiday: ${day.holidayLabels.join(", ")} (${day.dateStr})`
                      : day.isToday
                      ? `📍 Today (${day.dateStr})`
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
                      width: day.isToday ? 18 : "auto",
                      height: day.isToday ? 18 : "auto",
                      borderRadius: day.isToday ? "50%" : 0,
                      background: day.isToday ? "#16a34a" : "transparent",
                      color: day.isToday ? "#ffffff" : "inherit",
                      fontSize: 10,
                      fontWeight: day.isToday ? 700 : 500,
                      lineHeight: 1,
                      marginTop: 2,
                    }}
                  >
                    {day.dayOfMonth}
                  </span>
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
                style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: gridColumns,
                  background: "#eff6ff",
                  borderBottom: "1px solid #bfdbfe",
                  minHeight: 28,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 15,
                    background: "#eff6ff",
                    padding: "4px 12px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#1d4ed8",
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
                  🏖️ Team Time Off ({yearLeaves.length})
                </div>

                {days.map((day) => (
                  <span
                    key={`leave-bg-${day.dayIndex}`}
                    style={{
                      width: DAY_COL_WIDTH,
                      borderRight: day.isLastDayOfMonth
                        ? "2px solid var(--line, #94a3b8)"
                        : "1px solid #e0e7ff",
                      height: "100%",
                    }}
                  />
                ))}
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
                    className="gantt-row gantt-event-row"
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gridTemplateColumns: gridColumns,
                      background: "#fafcff",
                      borderBottom: "1px solid var(--line-light, #e2e8f0)",
                      minHeight: 38,
                      alignItems: "center",
                      position: "relative",
                    }}
                  >
                    {/* Sticky Person Cell */}
                    <div
                      className="gantt-task-name"
                      style={{
                        width: TASK_COL_WIDTH,
                        minWidth: TASK_COL_WIDTH,
                        maxWidth: TASK_COL_WIDTH,
                        boxSizing: "border-box",
                        padding: "0 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        overflow: "hidden",
                        background: "#fafcff",
                        position: "sticky",
                        left: 0,
                        zIndex: 12,
                        borderRight: "2px solid var(--line, #cbd5e1)",
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
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          (personName.charAt(0) || "?").toUpperCase()
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 650,
                          color: isSick ? "#1e40af" : "#6d28d9",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={`${personName} · ${event.label}`}
                      >
                        {isSick ? "🤒" : "🏖️"} {personName}
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500, marginLeft: 4 }}>
                          ({event.label})
                        </span>
                      </span>
                    </div>

                    {/* Day Grid Background Cells */}
                    {days.map((day) => (
                      <span
                        key={`cell-leave-${event.id}-${day.dayIndex}`}
                        style={{
                          width: DAY_COL_WIDTH,
                          height: "100%",
                          borderRight: day.isLastDayOfMonth
                            ? "2px solid var(--line, #94a3b8)"
                            : "1px solid var(--line-light, #eff1ef)",
                          background: day.holidayLabels
                            ? "rgba(245,158,11,0.06)"
                            : day.isWeekend
                            ? "var(--app-bg, #f8fafc)"
                            : "transparent",
                        }}
                      />
                    ))}

                    {/* Continuous Leave Bar across months */}
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
                        zIndex: 5,
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

            {days.map((day) => (
              <span
                key={`task-head-bg-${day.dayIndex}`}
                style={{
                  width: DAY_COL_WIDTH,
                  borderRight: day.isLastDayOfMonth
                    ? "2px solid var(--line, #94a3b8)"
                    : "1px solid var(--line-light, #f1f5f9)",
                  height: "100%",
                }}
              />
            ))}
          </div>

          {/* ======================================================== */}
          {/* SECTION: CONTINUOUS TASK ROWS (Spanning Across Months)   */}
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

                {/* Day Grid Background Cells */}
                {days.map((day) => (
                  <span
                    key={`cell-bg-${task.id}-${day.dayIndex}`}
                    className={`gantt-cell${day.holidayLabels ? " is-holiday" : ""}`}
                    title={day.holidayLabels ? `Holiday: ${day.holidayLabels.join(", ")}` : undefined}
                    style={{
                      width: DAY_COL_WIDTH,
                      height: "100%",
                      boxSizing: "border-box",
                      borderRight: day.isLastDayOfMonth
                        ? "2px solid var(--line, #94a3b8)"
                        : "1px solid var(--line-light, #eff1ef)",
                      background: day.holidayLabels
                        ? "rgba(245,158,11,0.06)"
                        : day.isWeekend
                        ? "var(--app-bg, #f8fafc)"
                        : "transparent",
                    }}
                  />
                ))}

                {/* Continuous Task Bar across Months */}
                {visible && (
                  <Link
                    className={`gantt-bar${isLate ? " is-overdue" : ""}`}
                    href={`/projects/${projectId}/tasks/${task.id}`}
                    style={
                      {
                        gridColumn: `${clampedStart + 2} / ${clampedEnd + 3}`,
                        gridRow: 1,
                        height: 24,
                        borderRadius: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0 8px",
                        overflow: "hidden",
                        minWidth: 0,
                        zIndex: 4,
                        textDecoration: "none",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        background: isDone
                          ? "linear-gradient(135deg, #167c58, #10b981)"
                          : isLate
                          ? "linear-gradient(135deg, #dc2626, #ef4444)"
                          : isSubtask
                          ? "linear-gradient(135deg, #0284c7, #38bdf8)"
                          : "linear-gradient(135deg, #2563eb, #3b82f6)",
                        "--bar-progress": `${Math.max(0, Math.min(100, progress))}%`,
                      } as React.CSSProperties
                    }
                    title={`${task.title} · ${startRaw} to ${task.due_date ?? endRaw}${
                      isLate ? " (Overdue)" : ""
                    }`}
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
                  </Link>
                )}

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
        </div>
      </div>
    </section>
  );
}
