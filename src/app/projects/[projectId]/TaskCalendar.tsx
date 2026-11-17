"use client";

import { useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  generated_key: string;
  title: string;
  priority: string;
  status_id: string;
  status_category?: string;
  start_date?: string | null;
  created_at?: string;
  due_date: string | null;
};
type Status = { id: string; name: string; color: string };
type CalendarEvent = { id: string; label: string; start: string; end?: string; kind: "holiday" | "leave"; person?: string };

function validMonth(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function TaskCalendar({
  projectId,
  tasks,
  statuses,
  month: monthParam,
  events = [],
}: {
  projectId: string;
  tasks: Task[];
  statuses: Status[];
  month?: string;
  events?: CalendarEvent[];
}) {
  const initial = validMonth(monthParam);
  const [activeYearMonth, setActiveYearMonth] = useState<{ year: number; month: number }>(initial);
  const { year, month } = activeYearMonth;

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = monthStart.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const slots = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const taskByDay = new Map<number, Task[]>();
  const eventByDay = new Map<number, CalendarEvent[]>();
  const undated: Task[] = [];
  const noDueDate: Task[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const task of tasks) {
    if (!task.due_date) noDueDate.push(task);
    const start = task.start_date ?? task.created_at?.slice(0, 10) ?? task.due_date;
    const late = !!task.due_date && task.due_date < today && !["completed", "cancelled"].includes(task.status_category ?? "");
    const end = late ? today : task.due_date ?? start;
    if (!start || !end) {
      undated.push(task);
      continue;
    }
    const from = Math.max(1, start < `${monthKey}-01` ? 1 : start.startsWith(monthKey) ? Number(start.slice(8, 10)) : daysInMonth + 1);
    const to = Math.min(daysInMonth, end > `${monthKey}-${String(daysInMonth).padStart(2, "0")}` ? daysInMonth : end.startsWith(monthKey) ? Number(end.slice(8, 10)) : 0);
    if (from <= to) {
      for (let day = from; day <= to; day++) {
        taskByDay.set(day, [...(taskByDay.get(day) ?? []), task]);
      }
    }
  }

  for (const event of events) {
    const from = Math.max(1, event.start < `${monthKey}-01` ? 1 : event.start.startsWith(monthKey) ? Number(event.start.slice(8, 10)) : daysInMonth + 1);
    const until = event.end ?? event.start;
    const to = Math.min(daysInMonth, until > `${monthKey}-${String(daysInMonth).padStart(2, "0")}` ? daysInMonth : until.startsWith(monthKey) ? Number(until.slice(8, 10)) : 0);
    if (from <= to) {
      for (let day = from; day <= to; day++) {
        eventByDay.set(day, [...(eventByDay.get(day) ?? []), event]);
      }
    }
  }

  const navigateMonth = (targetYear: number, targetMonth: number) => {
    setActiveYearMonth({ year: targetYear, month: targetMonth });
    const newMonthKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "calendar");
      url.searchParams.set("month", newMonthKey);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const handlePrev = () => {
    const prevDate = new Date(Date.UTC(year, month - 2, 1));
    navigateMonth(prevDate.getUTCFullYear(), prevDate.getUTCMonth() + 1);
  };

  const handleNext = () => {
    const nextDate = new Date(Date.UTC(year, month, 1));
    navigateMonth(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1);
  };

  const handleToday = () => {
    const now = new Date();
    navigateMonth(now.getFullYear(), now.getMonth() + 1);
  };

  return (
    <div className="calendar-wrap">
      <div className="calendar-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={handlePrev}
            className="calendar-nav-btn"
            aria-label="Previous month"
            style={{
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: "6px",
              padding: "5px 11px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ink, #33413a)",
              cursor: "pointer",
            }}
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="calendar-today-btn"
            aria-label="Jump to current month"
            style={{
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--green, #167c58)",
              cursor: "pointer",
            }}
          >
            Today
          </button>
        </div>

        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--ink, #1e293b)" }}>
          {monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
        </h3>

        <button
          type="button"
          onClick={handleNext}
          className="calendar-nav-btn"
          aria-label="Next month"
          style={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: "6px",
            padding: "5px 11px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--ink, #33413a)",
            cursor: "pointer",
          }}
        >
          Next →
        </button>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div className="calendar-weekday" key={day}>
            {day}
          </div>
        ))}
        {Array.from({ length: slots }, (_, slot) => {
          const day = slot - startOffset + 1;
          const inMonth = day >= 1 && day <= daysInMonth;
          const date = `${monthKey}-${String(day).padStart(2, "0")}`;
          const dayEvents = inMonth ? eventByDay.get(day) ?? [] : [];
          const hasHoliday = dayEvents.some((ev) => ev.kind === "holiday");
          return (
            <div
              className={`calendar-day${inMonth ? "" : " outside"}${date === today ? " is-today" : ""}${hasHoliday ? " is-holiday" : ""}`}
              key={slot}
            >
              {inMonth && <span className="calendar-day-number">{day}</span>}
              {dayEvents.map((event) => (
                <div
                  className={`calendar-event calendar-event-${event.kind}`}
                  key={`${event.id}-${day}`}
                  title={`${event.label}${event.person ? ` · ${event.person}` : ""}`}
                >
                  {event.kind === "holiday" ? "🎉 " : ""}
                  {event.label}
                  {event.person && <small> · {event.person}</small>}
                </div>
              ))}
              {inMonth &&
                (taskByDay.get(day) ?? []).map((task) => {
                  const color = statuses.find((status) => status.id === task.status_id)?.color ?? "#87938b";
                  const late = !!task.due_date && task.due_date < today && !["completed", "cancelled"].includes(task.status_category ?? "");
                  const dim = !late && (task.status_category === "not_started" || task.status_category == null);
                  return (
                    <Link
                      className={`calendar-task${dim ? " is-planned" : " is-active"}${late ? " is-overdue" : ""}`}
                      key={task.id}
                      href={`/projects/${projectId}/tasks/${task.id}`}
                      style={{ "--task-color": color } as React.CSSProperties}
                      title={`${task.title}${task.due_date ? ` · Due ${task.due_date}` : ""}`}
                    >
                      <span>{task.title}</span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </div>

      {(noDueDate.length > 0 || undated.length > 0) && (
        <section className="undated-tasks">
          <h3>Tasks without a due date</h3>
          {[...new Map([...noDueDate, ...undated].map((task) => [task.id, task])).values()].map((task) => (
            <Link href={`/projects/${projectId}/tasks/${task.id}`} key={task.id}>
              {task.title} <span className={`priority priority-${task.priority}`}>{task.priority}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
