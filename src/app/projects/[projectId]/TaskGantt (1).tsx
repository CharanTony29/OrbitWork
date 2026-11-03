import Link from "next/link";
type Task = { id: string; generated_key: string; title: string; start_date: string | null; due_date: string | null; progress: number };

export default function TaskGantt({ projectId, tasks, month }: { projectId: string; tasks: Task[]; month?: string }) {
  const now = new Date();
  const [year, monthNumber] = month && /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const key = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const fmt = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  return <section className="gantt-view"><header className="gantt-header"><Link href={`/projects/${projectId}?view=gantt&month=${fmt(previous)}`}>← Previous</Link><h3>{first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</h3><Link href={`/projects/${projectId}?view=gantt&month=${fmt(next)}`}>Next →</Link></header><div className="gantt-scale" style={{ gridTemplateColumns: `minmax(220px, 1.2fr) repeat(${days}, minmax(22px, 1fr))` }}><span>Task</span>{Array.from({ length: days }, (_, index) => <span className="gantt-day" key={index}>{index + 1}</span>)}</div>{tasks.map((task) => {
    const start = task.start_date ?? task.due_date;
    const end = task.due_date ?? task.start_date;
    const startDay = start?.startsWith(key) ? Number(start.slice(8, 10)) : start && start < `${key}-01` ? 1 : days + 1;
    const endDay = end?.startsWith(key) ? Number(end.slice(8, 10)) : end && end > `${key}-${String(days).padStart(2, "0")}` ? days : 0;
    const visible = !!start && !!end && startDay <= days && endDay >= 1;
    const clampedStart = Math.max(1, Math.min(days, startDay ?? 1));
    const clampedEnd = Math.max(clampedStart, Math.min(days, endDay ?? clampedStart));
    return <div className="gantt-row" key={task.id} style={{ gridTemplateColumns: `minmax(220px, 1.2fr) repeat(${days}, minmax(22px, 1fr))` }}><Link className="gantt-task-name" href={`/projects/${projectId}/tasks/${task.id}`}><span>{task.generated_key}</span>{task.title}</Link>{Array.from({ length: days }, (_, index) => <span className="gantt-cell" key={index}/>)}{visible && <Link className="gantt-bar" href={`/projects/${projectId}/tasks/${task.id}`} style={{ gridColumn: `${clampedStart + 1} / ${clampedEnd + 2}`, left: 0, background: `linear-gradient(90deg, var(--green) ${Math.max(0, Math.min(100, task.progress))}%, #a7d3b3 ${Math.max(0, Math.min(100, task.progress))}%)` }} title={`${start} to ${end}`}/>}{!visible && <span className="gantt-unscheduled">No schedule</span>}</div>;
  })}{!tasks.length && <p className="muted small">No tasks match the current filters.</p>}</section>;
}
