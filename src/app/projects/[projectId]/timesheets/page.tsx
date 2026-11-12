import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import BackButton from "@/app/BackButton";
import { notFound, redirect } from "next/navigation";
import { Clock3, Calendar, ListFilter, BarChart3, Settings } from "lucide-react";
import { reviewProjectTimesheet, signOut, submitProjectTimesheet } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import DateInput from "@/app/DateInput";

function isoWeekStart(value: string | undefined) {
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date();
  if (!Number.isFinite(parsed.getTime())) return isoWeekStart(undefined);
  parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
  return parsed.toISOString().slice(0, 10);
}

export default async function ProjectTimesheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ week?: string; month?: string; period?: string; error?: string; targetHours?: string; view?: string }>;
}) {
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

  // Manager setting: Daily target hours (default 8)
  const targetHours = Number(filters.targetHours) > 0 ? Math.min(24, Math.max(1, Number(filters.targetHours))) : 8;
  const viewMode = filters.view === "list" ? "list" : "calendar";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase.from("projects").select("id, name, workspace_id, workspaces(organization_id)").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const workspaceRel = project.workspaces as unknown as
    | { organization_id?: string | null }
    | Array<{ organization_id?: string | null }>
    | null;
  const orgId =
    (Array.isArray(workspaceRel) ? workspaceRel[0]?.organization_id : workspaceRel?.organization_id) ??
    null;
  const managerResult = await supabase.rpc("can_manage_project", { target_project: projectId });
  const canManage = managerResult.data === true;

  let entryQuery = supabase
    .from("time_entries")
    .select("id, user_id, task_id, started_at, ended_at, duration_minutes, description, billable, timesheet_id, tasks(generated_key, title)")
    .eq("project_id", projectId)
    .gte("started_at", `${rangeStart}T00:00:00Z`)
    .lt("started_at", `${endDate}T00:00:00Z`)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true })
    .limit(5000);
  if (!canManage) entryQuery = entryQuery.eq("user_id", user.id);

  let sheetQuery = supabase
    .from("timesheets")
    .select("id, user_id, week_start, status, submitted_at, reviewed_by, reviewed_at, review_note")
    .eq("project_id", projectId)
    .gte("week_start", rangeStart)
    .lt("week_start", endDate);
  if (!canManage) sheetQuery = sheetQuery.eq("user_id", user.id);

  const [entriesResult, sheetsResult, holidaysResult] = await Promise.all([
    entryQuery,
    sheetQuery,
    orgId
      ? supabase
          .from("organization_holidays")
          .select("id, name, holiday_date, location")
          .eq("organization_id", orgId)
          .gte("holiday_date", rangeStart)
          .lt("holiday_date", endDate)
      : Promise.resolve({ data: [] }),
  ]);
  const holidays = holidaysResult.data ?? [];
  const holidayByDate = new Map<string, string>();
  for (const h of holidays) {
    const prev = holidayByDate.get(h.holiday_date);
    holidayByDate.set(h.holiday_date, prev ? `${prev}, ${h.name}` : h.name);
  }
  const entries = entriesResult.data ?? [];
  const sheets = sheetsResult.data ?? [];
  const userIds = [
    ...new Set([
      ...entries.map((entry) => entry.user_id),
      ...sheets.map((sheet) => sheet.user_id),
      ...sheets.map((sheet) => sheet.reviewed_by).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "Team member"]));
  const sheetByUser = new Map(sheets.map((sheet) => [sheet.user_id, sheet]));
  const rows = new Map<string, typeof entries>();
  for (const entry of entries) rows.set(entry.user_id, [...(rows.get(entry.user_id) ?? []), entry]);
  const meEntries = rows.get(user.id) ?? [];
  const mySheet = sheetByUser.get(user.id);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Build Day-by-Day Calendar Cards
  const daysInView = period === "month"
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
    : 7;

  const dayCards: Array<{
    dateStr: string;
    dayName: string;
    formattedDate: string;
    isWeekend: boolean;
    holidayName: string | null;
    isToday: boolean;
    totalMinutes: number;
    entries: typeof entries;
  }> = [];

  for (let i = 0; i < daysInView; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holidayName = holidayByDate.get(dateStr) ?? null;
    const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const dayEntries = (canManage ? entries : meEntries).filter((e) => e.started_at.slice(0, 10) === dateStr);
    const dayMinutes = dayEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

    dayCards.push({
      dateStr,
      dayName,
      formattedDate,
      isWeekend,
      holidayName,
      isToday: dateStr === todayStr,
      totalMinutes: dayMinutes,
      entries: dayEntries,
    });
  }

  // Workload calculations based on Manager Daily Target Hours (excluding weekends & organization holidays)
  const workingDays = dayCards.filter((d) => !d.isWeekend && !d.holidayName).length || 0;
  const expectedMinutes = workingDays * targetHours * 60;
  const totalWorkedMinutes = (canManage ? entries : meEntries).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const totalWorkedHours = Math.floor(totalWorkedMinutes / 60);
  const totalWorkedRemMinutes = totalWorkedMinutes % 60;
  const workloadPercent = expectedMinutes > 0 ? Math.round((totalWorkedMinutes / expectedMinutes) * 100) : 0;

  let workloadStatus: "optimal" | "under" | "over" = "under";
  let workloadLabel = "Under Capacity";
  if (workloadPercent >= 90 && workloadPercent <= 110) {
    workloadStatus = "optimal";
    workloadLabel = "Target Met (Balanced)";
  } else if (workloadPercent > 110) {
    workloadStatus = "over";
    workloadLabel = `Over Capacity (+${workloadPercent - 100}%)`;
  }

  return (
    <main className="app-shell">
      <AppTopBar email={user.email ?? ""} projectId={projectId} />

      <section className="timesheets-page">
        <BackButton fallbackHref={`/projects/${projectId}`} label={project.name} />

        <div className="timesheets-heading">
          <div>
            <p className="eyebrow">TIME AND WORKLOAD</p>
            <h1>{canManage ? "Team Timesheets & Workload" : "My Timesheet & Workload"}</h1>
            <p className="muted">
              {period === "month"
                ? start.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
                : `Week of ${start.toLocaleDateString(undefined, { dateStyle: "long", timeZone: "UTC" })}`}
            </p>
          </div>

          <div className="timesheet-period-controls">
            {/* Manager Target Hours Setting */}
            {canManage && (
              <form method="get" className="timesheet-target-form" title="Set required work hours per day to calculate workload">
                <input type="hidden" name="period" value={period} />
                <input type="hidden" name={period === "month" ? "month" : "week"} value={period === "month" ? month : weekStart} />
                <input type="hidden" name="view" value={viewMode} />
                <Settings size={12} style={{ color: "var(--muted)" }} />
                <span>Daily Target:</span>
                <input
                  type="number"
                  name="targetHours"
                  defaultValue={targetHours}
                  min={1}
                  max={24}
                  aria-label="Target hours per day"
                />
                <span>hrs/day</span>
                <button type="submit" className="mini-save">Apply</button>
              </form>
            )}

            <form method="get" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="hidden" name="targetHours" value={targetHours} />
              <input type="hidden" name="view" value={viewMode} />
              <select name="period" defaultValue={period} aria-label="Timesheet period">
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
              {period === "week" ? (
                <DateInput name="week" defaultValue={weekStart} ariaLabel="Week of" containerClassName="timesheet-date-picker" />
              ) : (
                <input type="month" name="month" defaultValue={month} aria-label="Month" />
              )}
              <button className="mini-save">Go</button>
            </form>

            <div className="week-controls">
              <Link href={`/projects/${projectId}/timesheets?period=${period}&targetHours=${targetHours}&view=${viewMode}&${period === "month" ? `month=${previous}` : `week=${previous}`}`}>
                ← Previous
              </Link>
              <Link href={`/projects/${projectId}/timesheets?period=${period}&targetHours=${targetHours}&view=${viewMode}&${period === "month" ? `month=${next}` : `week=${next}`}`}>
                Next →
              </Link>
            </div>
          </div>
        </div>

        {filters.error && (
          <p className="error" role="alert">
            The timesheet action could not be completed. Confirm entries exist and your project role allows this action.
          </p>
        )}

        {/* Workload & Capacity Banner */}
        <div className="timesheet-workload-banner">
          <div className="workload-stats-left">
            <div className="workload-stat-box">
              <span className="workload-stat-label">Hours Logged</span>
              <span className="workload-stat-val">
                {totalWorkedHours}h {totalWorkedRemMinutes}m
              </span>
            </div>
            <div style={{ width: "1px", height: "30px", background: "var(--line)" }} />
            <div className="workload-stat-box">
              <span className="workload-stat-label">Target Capacity</span>
              <span className="workload-stat-val">
                {workingDays * targetHours}h ({targetHours}h/day)
              </span>
            </div>
            <div style={{ width: "1px", height: "30px", background: "var(--line)" }} />
            <div className="workload-stat-box">
              <span className="workload-stat-label">Workload</span>
              <span className="workload-stat-val">{workloadPercent}%</span>
            </div>
          </div>

          <div className="workload-bar-wrap">
            <div className="workload-bar-header">
              <span>Capacity utilization ({totalWorkedHours}h of {workingDays * targetHours}h expected)</span>
              <span className={`workload-badge status-${workloadStatus}`}>{workloadLabel}</span>
            </div>
            <div className="workload-meter">
              <div
                className={`workload-fill status-${workloadStatus}`}
                style={{ width: `${Math.min(100, workloadPercent)}%` }}
              />
            </div>
          </div>

          <div className="timesheet-view-tabs">
            <Link
              href={`/projects/${projectId}/timesheets?period=${period}&${period === "month" ? `month=${month}` : `week=${weekStart}`}&targetHours=${targetHours}&view=calendar`}
              className={`timesheet-view-tab${viewMode === "calendar" ? " is-active" : ""}`}
            >
              <Calendar size={12} />
              <span>Calendar</span>
            </Link>
            <Link
              href={`/projects/${projectId}/timesheets?period=${period}&${period === "month" ? `month=${month}` : `week=${weekStart}`}&targetHours=${targetHours}&view=list`}
              className={`timesheet-view-tab${viewMode === "list" ? " is-active" : ""}`}
            >
              <ListFilter size={12} />
              <span>Detailed List</span>
            </Link>
          </div>
        </div>

        {/* Calendar Day-by-Day Format View (Default) */}
        {viewMode === "calendar" && (
          <div className="timesheet-calendar-matrix">
            {dayCards.map((card) => {
              const dayHours = Math.floor(card.totalMinutes / 60);
              const dayMins = card.totalMinutes % 60;
              const isNonWorking = card.isWeekend || Boolean(card.holidayName);
              const dayTargetMinutes = isNonWorking ? 0 : targetHours * 60;
              const dayProgress = dayTargetMinutes > 0 ? Math.min(100, Math.round((card.totalMinutes / dayTargetMinutes) * 100)) : 0;

              return (
                <div
                  key={card.dateStr}
                  className={`timesheet-day-card${card.isToday ? " is-today" : ""}${isNonWorking ? " is-weekend" : ""}`}
                >
                  <div className="day-card-header">
                    <div className="day-card-title">
                      <span className="day-card-name">{card.dayName}</span>
                      <span className="day-card-date">{card.formattedDate}</span>
                    </div>
                    {card.holidayName ? (
                      <span
                        className="today-pill"
                        style={{ background: "#fff3cf", color: "#854d0e", border: "1px solid #fde68a" }}
                        title={card.holidayName}
                      >
                        Holiday: {card.holidayName}
                      </span>
                    ) : (
                      card.isToday && <span className="today-pill">Today</span>
                    )}
                  </div>

                  <div className="day-card-body">
                    <div className="day-card-hours-row">
                      <span className="day-card-hours">
                        {dayHours}h {dayMins}m
                      </span>
                      <span className="day-card-target">
                        {card.holidayName ? "Holiday" : card.isWeekend ? "Weekend" : `Target ${targetHours}h`}
                      </span>
                    </div>

                    {!isNonWorking && (
                      <div className="day-card-progress" title={`${dayProgress}% of daily target`}>
                        <div className="day-card-fill" style={{ width: `${dayProgress}%` }} />
                      </div>
                    )}

                    <div className="day-tasks-list">
                      {card.entries.length > 0 ? (
                        card.entries.map((entry) => {
                          const task = Array.isArray(entry.tasks) ? entry.tasks[0] : entry.tasks;
                          const eHours = Math.floor((entry.duration_minutes ?? 0) / 60);
                          const eMins = (entry.duration_minutes ?? 0) % 60;
                          return (
                            <Link
                              key={entry.id}
                              href={`/projects/${projectId}/tasks/${entry.task_id}`}
                              className="day-task-item"
                              title={`${task?.generated_key ?? "TASK"}: ${task?.title ?? "Task"}`}
                            >
                              <span className="day-task-key">
                                {task?.generated_key ?? "TASK"}
                              </span>
                              <span className="day-task-time">
                                {eHours > 0 ? `${eHours}h ${eMins}m` : `${eMins}m`}
                              </span>
                            </Link>
                          );
                        })
                      ) : (
                        <span className="day-no-time">
                          {card.isWeekend ? "Off day" : "No time logged"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* My Timesheet Summary Card */}
        <div className="timesheet-own-card">
          <div>
            <Clock3 size={18} />
            <div>
              <strong>My time</strong>
              <span>
                {Math.floor(meEntries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0) / 60)}h{" "}
                {meEntries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0) % 60}m ·{" "}
                {meEntries.length} entries
              </span>
            </div>
          </div>
          {mySheet && period === "week" && (
            <span className={`timesheet-status state-${mySheet.status}`}>{mySheet.status}</span>
          )}
          {period === "week" && (!mySheet || mySheet.status === "rejected") && meEntries.length > 0 && (
            <form action={submitProjectTimesheet}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="weekStart" value={weekStart} />
              <button className="button button-primary">Submit week</button>
            </form>
          )}
          {mySheet?.status === "rejected" && (
            <p className="timesheet-review-note">
              Returned for changes: {mySheet.review_note || "No note provided."}
            </p>
          )}
        </div>

        {/* Detailed Timesheet Entries Groups (List View or below Calendar) */}
        <div className="timesheet-groups">
          {[...rows.entries()].map(([userId, userEntries]) => {
            const total = userEntries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0);
            const sheet = sheetByUser.get(userId);
            return (
              <section className="timesheet-user-group" key={userId}>
                <header>
                  <strong>{names.get(userId) ?? "Team member"}</strong>
                  <span>
                    {Math.floor(total / 60)}h {total % 60}m · {userEntries.length} entries
                  </span>
                  {sheet && <span className={`timesheet-status state-${sheet.status}`}>{sheet.status}</span>}
                </header>

                {userEntries.map((entry) => {
                  const task = Array.isArray(entry.tasks) ? entry.tasks[0] : entry.tasks;
                  return (
                    <div className="timesheet-entry" key={entry.id}>
                      <Link href={`/projects/${projectId}/tasks/${entry.task_id}`}>
                        {task?.generated_key} · {task?.title ?? "Task"}
                      </Link>
                      <span>
                        {Math.floor((entry.duration_minutes ?? 0) / 60)}h {(entry.duration_minutes ?? 0) % 60}m
                      </span>
                      <time>{new Date(entry.started_at).toLocaleString()}</time>
                      <span>{entry.billable ? "Billable" : "Non-billable"}</span>
                      {entry.description && <p>{entry.description}</p>}
                    </div>
                  );
                })}

                {canManage && sheet?.status === "submitted" && (
                  <form action={reviewProjectTimesheet} className="timesheet-review-form">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="timesheetId" value={sheet.id} />
                    <input name="note" maxLength={2000} placeholder="Review note (required if returning)" />
                    <button className="mini-save" name="decision" value="approved">
                      Approve
                    </button>
                    <button className="mini-remove" name="decision" value="rejected">
                      Return
                    </button>
                  </form>
                )}
              </section>
            );
          })}

          {!entries.length && (
            <div className="empty-tasks">
              <h3>No completed time entries this {period}</h3>
              <p>Start a timer or add manual time on a task first.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
