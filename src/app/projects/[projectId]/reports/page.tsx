import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Gauge } from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Metric = { status_id: string; status_name: string; status_color: string; task_count: number; completed_count: number; overdue_count: number; estimated_minutes: number; actual_minutes: number };

export default async function ProjectReportsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const { data, error } = await supabase.rpc("get_project_report_metrics", { target_project: projectId });
  if (error) throw new Error("Project report metrics are unavailable. Apply database migration 012 first.");
  const metrics = (data ?? []) as Metric[];
  const total = metrics.reduce((sum, row) => sum + row.task_count, 0);
  const completed = metrics.reduce((sum, row) => sum + row.completed_count, 0);
  const overdue = metrics.reduce((sum, row) => sum + row.overdue_count, 0);
  const estimate = metrics.reduce((sum, row) => sum + row.estimated_minutes, 0);
  const actual = metrics.reduce((sum, row) => sum + row.actual_minutes, 0);
  const completion = total ? Math.round(completed * 100 / total) : 0;
  const variance = actual - estimate;
  return <main className="app-shell"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/><form action={signOut}><button className="quiet-button">Sign out</button></form></div></header><section className="project-report-page"><Link className="back-link" href={`/projects/${projectId}`}><ArrowLeft size={15}/>{project.name}</Link><div className="project-report-heading"><div><p className="eyebrow">ANALYTICS</p><h1>Project report</h1><p className="muted">Live task totals and logged time, calculated by the database.</p></div><a className="button button-secondary" href={`/api/projects/${projectId}/reports.csv`}><Download size={15}/> Export CSV</a></div><div className="report-stat-grid"><article><span>Total tasks</span><strong>{total}</strong></article><article><span>Completion</span><strong>{completion}%</strong><div className="report-progress"><i style={{ width: `${completion}%` }}/></div></article><article><span>Overdue active</span><strong>{overdue}</strong></article><article><span>Estimated time</span><strong>{Math.floor(estimate / 60)}h {estimate % 60}m</strong></article><article><span>Actual time</span><strong>{Math.floor(actual / 60)}h {actual % 60}m</strong></article><article><span>Estimate variance</span><strong>{variance > 0 ? "+" : variance < 0 ? "−" : ""}{Math.floor(Math.abs(variance) / 60)}h {Math.abs(variance) % 60}m</strong></article></div><section className="report-status-card"><header><div><p className="eyebrow">WORKFLOW</p><h2>Tasks by status</h2></div><Gauge size={18}/></header>{metrics.map((row) => <div className="report-status-row" key={row.status_id}><div><i style={{ backgroundColor: row.status_color }}/><strong>{row.status_name}</strong><span>{row.task_count}</span></div><div className="report-status-meter"><i style={{ width: `${total ? row.task_count * 100 / total : 0}%`, backgroundColor: row.status_color }}/></div></div>)}{!metrics.length && <p className="muted small">No task statuses are available.</p>}</section><p className="report-footnote">Overdue excludes tasks in completed and cancelled workflow categories. Actual time includes completed timer and manual entries.</p></section></main>;
}
