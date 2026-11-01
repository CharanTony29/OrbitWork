import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { reviewProjectTimesheet, signOut, submitProjectTimesheet } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

function isoWeekStart(value: string | undefined) {
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date();
  if (!Number.isFinite(parsed.getTime())) return isoWeekStart(undefined);
  parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
  return parsed.toISOString().slice(0, 10);
}

export default async function ProjectTimesheetsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ week?: string; month?: string; period?: string; error?: string }> }) {
  const { projectId } = await params;
  const filters = await searchParams;
  const period = filters.period === "month" ? "month" : "week";
  const month = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : new Date().toISOString().slice(0, 7);
  const weekStart = isoWeekStart(filters.week);
  const start = period === "month" ? new Date(`${month}-01T00:00:00Z`) : new Date(`${weekStart}T00:00:00Z`);
  const end = period === "month" ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) : new Date(start.getTime() + 7 * 86400000);
  const rangeStart = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const previous = period === "month" ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1)).toISOString().slice(0, 7) : new Date(start.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const next = period === "month" ? start.toISOString().slice(0, 7) : endDate;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const managerResult = await supabase.rpc("can_manage_project", { target_project: projectId });
  const canManage = managerResult.data === true;
  let entryQuery = supabase.from("time_entries").select("id, user_id, task_id, started_at, ended_at, duration_minutes, description, billable, timesheet_id, tasks(generated_key, title)").eq("project_id", projectId).gte("started_at", `${rangeStart}T00:00:00Z`).lt("started_at", `${endDate}T00:00:00Z`).not("ended_at", "is", null).order("started_at", { ascending: true }).limit(5000);
  if (!canManage) entryQuery = entryQuery.eq("user_id", user.id);
  let sheetQuery = supabase.from("timesheets").select("id, user_id, week_start, status, submitted_at, reviewed_by, reviewed_at, review_note").eq("project_id", projectId).gte("week_start", rangeStart).lt("week_start", endDate);
  if (!canManage) sheetQuery = sheetQuery.eq("user_id", user.id);
  const [entriesResult, sheetsResult] = await Promise.all([entryQuery, sheetQuery]);
  const entries = entriesResult.data ?? [];
  const sheets = sheetsResult.data ?? [];
  const userIds = [...new Set([...entries.map((entry) => entry.user_id), ...sheets.map((sheet) => sheet.user_id), ...sheets.map((sheet) => sheet.reviewed_by).filter((id): id is string => Boolean(id))])];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "Team member"]));
  const sheetByUser = new Map(sheets.map((sheet) => [sheet.user_id, sheet]));
  const rows = new Map<string, typeof entries>();
  for (const entry of entries) rows.set(entry.user_id, [...(rows.get(entry.user_id) ?? []), entry]);
  const meEntries = rows.get(user.id) ?? [];
  const mySheet = sheetByUser.get(user.id);

  return <main className="app-shell"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/><form action={signOut}><button className="quiet-button">Sign out</button></form></div></header><section className="timesheets-page"><Link className="back-link" href={`/projects/${projectId}`}><ArrowLeft size={15}/>{project.name}</Link><div className="timesheets-heading"><div><p className="eyebrow">TIME AND RESOURCES</p><h1>{canManage ? "Team timesheets" : "My timesheets"}</h1><p className="muted">{period === "month" ? start.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }) : `Week of ${start.toLocaleDateString(undefined, { dateStyle: "long", timeZone: "UTC" })}`}</p></div><div className="timesheet-period-controls"><form method="get"><select name="period" defaultValue={period} aria-label="Timesheet period"><option value="week">Week</option><option value="month">Month</option></select>{period === "week" ? <input type="date" name="week" defaultValue={weekStart} aria-label="Week of"/> : <input type="month" name="month" defaultValue={month} aria-label="Month"/>}<button className="mini-save">Go</button></form><div className="week-controls"><Link href={`/projects/${projectId}/timesheets?period=${period}&${period === "month" ? `month=${previous}` : `week=${previous}`}`}>← Previous</Link><Link href={`/projects/${projectId}/timesheets?period=${period}&${period === "month" ? `month=${next}` : `week=${next}`}`}>Next →</Link></div></div></div>{filters.error && <p className="error" role="alert">The timesheet action could not be completed. Confirm entries exist and your project role allows this action.</p>}<div className="timesheet-own-card"><div><Clock3 size={18}/><div><strong>My time</strong><span>{Math.floor(meEntries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0) / 60)}h {meEntries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0) % 60}m · {meEntries.length} entries</span></div></div>{mySheet && period === "week" && <span className={`timesheet-status state-${mySheet.status}`}>{mySheet.status}</span>}{period === "week" && (!mySheet || mySheet.status === "rejected") && meEntries.length > 0 && <form action={submitProjectTimesheet}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="weekStart" value={weekStart}/><button className="button button-primary">Submit week</button></form>}{mySheet?.status === "rejected" && <p className="timesheet-review-note">Returned for changes: {mySheet.review_note || "No note provided."}</p>}</div><div className="timesheet-groups">{[...rows.entries()].map(([userId, userEntries]) => { const total = userEntries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0); const sheet = sheetByUser.get(userId); return <section className="timesheet-user-group" key={userId}><header><strong>{names.get(userId) ?? "Team member"}</strong><span>{Math.floor(total / 60)}h {total % 60}m · {userEntries.length} entries</span>{sheet && <span className={`timesheet-status state-${sheet.status}`}>{sheet.status}</span>}</header>{userEntries.map((entry) => { const task = Array.isArray(entry.tasks) ? entry.tasks[0] : entry.tasks; return <div className="timesheet-entry" key={entry.id}><Link href={`/projects/${projectId}/tasks/${entry.task_id}`}>{task?.generated_key} · {task?.title ?? "Task"}</Link><span>{Math.floor((entry.duration_minutes ?? 0) / 60)}h {(entry.duration_minutes ?? 0) % 60}m</span><time>{new Date(entry.started_at).toLocaleString()}</time><span>{entry.billable ? "Billable" : "Non-billable"}</span>{entry.description && <p>{entry.description}</p>}</div>; })}{canManage && sheet?.status === "submitted" && <form action={reviewProjectTimesheet} className="timesheet-review-form"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="timesheetId" value={sheet.id}/><input name="note" maxLength={2000} placeholder="Review note (required if returning)"/><button className="mini-save" name="decision" value="approved">Approve</button><button className="mini-remove" name="decision" value="rejected">Return</button></form>}</section>; })}{!entries.length && <div className="empty-tasks"><h3>No completed time entries this {period}</h3><p>Start a timer or add manual time on a task first.</p></div>}</div></section></main>;
}
