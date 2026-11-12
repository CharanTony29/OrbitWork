import Link from "next/link";

type Task = { id: string; generated_key: string; title: string; start_date: string | null; due_date: string | null; progress: number; created_at?: string; status_category?: string };
type ScheduleEvent = { id: string; label: string; start: string; end?: string; kind: "holiday" | "leave"; person?: string };

export default function TaskGantt({ projectId, tasks, month, events = [] }: { projectId: string; tasks: Task[]; month?: string; events?: ScheduleEvent[] }) {
  const now = new Date();
  const [year, monthNumber] = month && /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const key = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const fmt = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const columns = `minmax(220px, 1.2fr) repeat(${days}, minmax(22px, 1fr))`;

  // Map day-of-month (1..days) -> holiday names for vertical column highlights in Timeline
  const holidayByDay = new Map<number, string[]>();
  for (const event of events) {
    if (event.kind !== "holiday") continue;
    const end = event.end ?? event.start;
    const startDay = event.start.startsWith(key) ? Number(event.start.slice(8, 10)) : event.start < `${key}-01` ? 1 : days + 1;
    const endDay = end.startsWith(key) ? Number(end.slice(8, 10)) : end > `${key}-${String(days).padStart(2, "0")}` ? days : 0;
    if (startDay <= days && endDay >= 1) {
      for (let d = Math.max(1, startDay); d <= Math.min(days, endDay); d++) {
        holidayByDay.set(d, [...(holidayByDay.get(d) ?? []), event.label]);
      }
    }
  }
  const monthHolidays = events.filter((e) => e.kind === "holiday" && e.start.startsWith(key));

  return <section className="gantt-view">
    <header className="gantt-header"><Link href={`/projects/${projectId}?view=gantt&month=${fmt(previous)}`}>← Previous</Link><h3>{first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</h3><Link href={`/projects/${projectId}?view=gantt&month=${fmt(next)}`}>Next →</Link></header>
    {monthHolidays.length > 0 && (
      <div className="gantt-holiday-strip">
        <strong>Holidays:</strong>
        {monthHolidays.map((h) => (
          <span key={`pill-${h.id}`} className="calendar-event calendar-event-holiday" style={{ marginTop: 0 }}>
            {new Date(`${h.start}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} · {h.label}
          </span>
        ))}
      </div>
    )}
    <div className="gantt-scale" style={{ gridTemplateColumns: columns }}><span>Task</span>{Array.from({ length: days }, (_, index) => { const d = index + 1; const hLabels = holidayByDay.get(d); return <span className={`gantt-day${hLabels ? " is-holiday" : ""}`} key={index} title={hLabels ? `Holiday: ${hLabels.join(", ")}` : undefined}>{d}</span>; })}</div>
    {tasks.map((task) => {
      const start = task.start_date ?? task.created_at?.slice(0, 10) ?? task.due_date;
      const today = new Date().toISOString().slice(0, 10);
      const late = !!task.due_date && task.due_date < today && !["completed", "cancelled"].includes(task.status_category ?? "");
      const end = late ? today : task.due_date ?? task.start_date;
      const startDay = start?.startsWith(key) ? Number(start.slice(8, 10)) : start && start < `${key}-01` ? 1 : days + 1;
      const endDay = end?.startsWith(key) ? Number(end.slice(8, 10)) : end && end > `${key}-${String(days).padStart(2, "0")}` ? days : 0;
      const visible = !!start && !!end && startDay <= days && endDay >= 1;
      const clampedStart = Math.max(1, Math.min(days, startDay ?? 1));
      const clampedEnd = Math.max(clampedStart, Math.min(days, endDay ?? clampedStart));
      const planned = task.status_category === "not_started";
      const progress = task.progress > 0 ? task.progress : task.status_category === "active" || task.status_category === "completed" ? 100 : 0;
      return <div className="gantt-row" key={task.id} style={{ gridTemplateColumns: columns }}>
        <Link className="gantt-task-name" href={`/projects/${projectId}/tasks/${task.id}`}><span>{task.generated_key}</span>{task.title}</Link>
        {Array.from({ length: days }, (_, index) => { const hLabels = holidayByDay.get(index + 1); return <span className={`gantt-cell${hLabels ? " is-holiday" : ""}`} key={index} title={hLabels ? `Holiday: ${hLabels.join(", ")}` : undefined}/>; })}
        {visible && <Link className={`gantt-bar${planned ? " is-planned" : ""}${late ? " is-overdue" : ""}`} href={`/projects/${projectId}/tasks/${task.id}`} style={{ gridColumn: `${clampedStart + 1} / ${clampedEnd + 2}`, left: 0, "--bar-progress": `${Math.max(0, Math.min(100, progress))}%` } as React.CSSProperties} title={`${start} to ${task.due_date ?? end}${late ? " · Overdue" : ""}`}/>}
        {!visible && <span className="gantt-unscheduled">No schedule</span>}
      </div>;
    })}
    {events.map((event) => {
      const end = event.end ?? event.start;
      const startDay = event.start.startsWith(key) ? Number(event.start.slice(8, 10)) : event.start < `${key}-01` ? 1 : days + 1;
      const endDay = end.startsWith(key) ? Number(end.slice(8, 10)) : end > `${key}-${String(days).padStart(2, "0")}` ? days : 0;
      if (startDay > days || endDay < 1) return null;
      const from = Math.max(1, startDay); const to = Math.max(from, Math.min(days, endDay));
      return <div className="gantt-row gantt-event-row" key={`event-${event.id}`} style={{ gridTemplateColumns: columns }}><span className="gantt-task-name">{event.label}{event.person ? ` · ${event.person}` : ""}</span>{Array.from({ length: days }, (_, index) => <span className="gantt-cell" key={index}/>)}<span className={`gantt-event-bar gantt-event-${event.kind}`} style={{ gridColumn: `${from + 1} / ${to + 2}` }} title={`${event.start}${event.end ? ` to ${event.end}` : ""}`}/></div>;
    })}
    {!tasks.length && <p className="muted small">No tasks match the current filters.</p>}
  </section>;
}
