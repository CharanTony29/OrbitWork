import Link from "next/link";

type Task = { id: string; generated_key: string; title: string; estimate_minutes: number | null; primary_assignee_id: string | null; secondary_assignee_id: string | null; due_date: string | null };

export default function TaskWorkload({ projectId, tasks, people }: { projectId: string; tasks: Task[]; people: Map<string, string> }) {
  const rows = new Map<string, { minutes: number; tasks: Task[] }>();
  for (const task of tasks) {
    const ids = [...new Set([task.primary_assignee_id, task.secondary_assignee_id].filter((id): id is string => Boolean(id)))];
    const owners = ids.length ? ids : [""];
    for (const id of owners) {
      const entry = rows.get(id) ?? { minutes: 0, tasks: [] };
      entry.minutes += Math.ceil((task.estimate_minutes ?? 0) / owners.length);
      entry.tasks.push(task);
      rows.set(id, entry);
    }
  }
  const sorted = [...rows.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
  return <div className="workload-view">{sorted.length ? sorted.map(([id, row]) => <section className="workload-person" key={id || "unassigned"}><header><span className="assignee-avatar">{(id ? people.get(id) ?? "T" : "?")[0].toUpperCase()}</span><strong>{id ? people.get(id) ?? "Team member" : "Unassigned"}</strong><span>{Math.floor(row.minutes / 60)}h {row.minutes % 60}m estimated</span><div className="workload-meter"><i style={{ width: `${Math.min(100, row.minutes / 24)}%` }}/></div></header><div className="workload-tasks">{row.tasks.map((task) => <Link key={task.id} href={`/projects/${projectId}/tasks/${task.id}`}><span>{task.generated_key}</span>{task.title}<small>{task.estimate_minutes ?? 0}m · {task.due_date ?? "No due date"}</small></Link>)}</div></section>) : <div className="empty-tasks"><h3>No workload to show</h3><p>Tasks appear here when they match the selected filters.</p></div>}</div>;
}
