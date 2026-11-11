import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import BackButton from "@/app/BackButton";
import { notFound, redirect } from "next/navigation";
import { Calendar, ListFilter, Settings, FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DateInput from "@/app/DateInput";

function isoWeekStart(value: string | undefined) {
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date();
  if (!Number.isFinite(parsed.getTime())) return isoWeekStart(undefined);
  parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
  return parsed.toISOString().slice(0, 10);
}

export default async function WorkspaceTimesheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    week?: string;
    month?: string;
    period?: string;
    error?: string;
    targetHours?: string;
    view?: string;
    projectId?: string;
  }>;
}) {
  const { workspaceId } = await params;
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

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, organization_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) notFound();

  // Fetch all projects in this workspace
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("workspace_id", workspaceId);

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const projectIds = (projects ?? []).map((p) => p.id);

  const canManageResult = await supabase.rpc("can_manage_workspace", { target_workspace: workspaceId });
  const canManage = canManageResult.data === true;

  // Time entries across all projects in the workspace
  let entryQuery = supabase
    .from("time_entries")
    .select("id, user_id, task_id, project_id, started_at, ended_at, duration_minutes, description, billable, timesheet_id, tasks(generated_key, title)")
    .gte("started_at", `${rangeStart}T00:00:00Z`)
    .lt("started_at", `${endDate}T00:00:00Z`)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true })
    .limit(5000);

  if (filters.projectId && projectIds.includes(filters.projectId)) {
    entryQuery = entryQuery.eq("project_id", filters.projectId);
  } else if (projectIds.length > 0) {
    entryQuery = entryQuery.in("project_id", projectIds);
  }

  if (!canManage) {
    entryQuery = entryQuery.eq("user_id", user.id);
  }

  const { data: rawEntries } = projectIds.length ? await entryQuery : { data: [] };
  const entries = rawEntries ?? [];

  const userIds = [...new Set(entries.map((e) => e.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds)
    : { data: [] };
  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name?.trim() || p.email || "Team member"])
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const daysInView = period === "month"
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
    : 7;

  const dayCards: Array<{
    dateStr: string;
    dayName: string;
    formattedDate: string;
    isWeekend: boolean;
    isToday: boolean;
    totalMinutes: number;
    entries: typeof entries;
  }> = [];

  for (let i = 0; i < daysInView; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const dayEntries = entries.filter((e) => e.started_at.slice(0, 10) === dateStr);
    const dayMinutes = dayEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

    dayCards.push({
      dateStr,
      dayName,
      formattedDate,
      isWeekend,
      isToday: dateStr === todayStr,
      totalMinutes: dayMinutes,
      entries: dayEntries,
    });
  }

  // Workload calculations based on Manager Daily Target Hours
  const workingDays = dayCards.filter((d) => !d.isWeekend).length || 5;
  const expectedMinutes = workingDays * targetHours * 60;
  const totalWorkedMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const totalWorkedHours = Math.floor(totalWorkedMinutes / 60);
  const totalWorkedRemMinutes = totalWorkedMinutes % 60;
  const workloadPercent = expectedMinutes > 0 ? Math.round((totalWorkedMinutes / expectedMinutes) * 100) : 0;

  const billableMinutes = entries.filter((e) => e.billable).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const billableHours = Math.floor(billableMinutes / 60);

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
      <AppTopBar
        email={user.email ?? ""}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        organizationId={workspace.organization_id}
      />
      <div className="timesheets-page" style={{ padding: "20px 28px 60px" }}>
      <BackButton fallbackHref={`/workspaces/${workspaceId}`} label={workspace.name} />

      <div className="timesheets-heading">
        <div>
          <p className="eyebrow">WORKSPACE TIMESHEETS · {workspace.name.toUpperCase()}</p>
          <h1>Workspace Time &amp; Workload</h1>
          <p className="muted">
            {period === "month"
              ? start.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
              : `Week of ${start.toLocaleDateString(undefined, { dateStyle: "long", timeZone: "UTC" })}`}
            {" · "}Tracking across all {projects?.length ?? 0} projects
          </p>
        </div>

        <div className="timesheet-period-controls">
          {canManage && (
            <form method="get" className="timesheet-target-form" title="Set daily target hours to calculate workload">
              <input type="hidden" name="period" value={period} />
              <input type="hidden" name={period === "month" ? "month" : "week"} value={period === "month" ? month : weekStart} />
              <input type="hidden" name="view" value={viewMode} />
              {filters.projectId && <input type="hidden" name="projectId" value={filters.projectId} />}
              <Settings size={12} style={{ color: "var(--muted)" }} />
              <span>Target:</span>
              <input
                type="number"
                name="targetHours"
                defaultValue={targetHours}
                min={1}
                max={24}
                aria-label="Target hours per day"
              />
              <span>h/day</span>
              <button type="submit" className="mini-save">Apply</button>
            </form>
          )}

          <form method="get" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input type="hidden" name="targetHours" value={targetHours} />
            <input type="hidden" name="view" value={viewMode} />
            {filters.projectId && <input type="hidden" name="projectId" value={filters.projectId} />}
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
            <Link href={`/workspaces/${workspaceId}/timesheets?period=${period}&targetHours=${targetHours}&view=${viewMode}&${period === "month" ? `month=${previous}` : `week=${previous}`}${filters.projectId ? `&projectId=${filters.projectId}` : ""}`}>
              ← Previous
            </Link>
            <Link href={`/workspaces/${workspaceId}/timesheets?period=${period}&targetHours=${targetHours}&view=${viewMode}&${period === "month" ? `month=${next}` : `week=${next}`}${filters.projectId ? `&projectId=${filters.projectId}` : ""}`}>
              Next →
            </Link>
          </div>
        </div>
      </div>

      {/* Project Filter Pills */}
      {projects && projects.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Filter Project:</span>
          <Link
            href={`/workspaces/${workspaceId}/timesheets?period=${period}&${period === "month" ? `month=${month}` : `week=${weekStart}`}&targetHours=${targetHours}&view=${viewMode}`}
            style={{
              padding: "4px 11px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              textDecoration: "none",
              background: !filters.projectId ? "var(--green, #167c58)" : "var(--soft, #f1f5f2)",
              color: !filters.projectId ? "#fff" : "var(--ink)",
            }}
          >
            All Projects ({projects.length})
          </Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/workspaces/${workspaceId}/timesheets?period=${period}&${period === "month" ? `month=${month}` : `week=${weekStart}`}&targetHours=${targetHours}&view=${viewMode}&projectId=${p.id}`}
              style={{
                padding: "4px 11px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                textDecoration: "none",
                background: filters.projectId === p.id ? "var(--green, #167c58)" : "var(--soft, #f1f5f2)",
                color: filters.projectId === p.id ? "#fff" : "var(--ink)",
              }}
            >
              {p.name}
            </Link>
          ))}
        </div>
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
            <span className="workload-stat-label">Billable</span>
            <span className="workload-stat-val" style={{ color: "var(--green, #167c58)" }}>
              {billableHours}h ({totalWorkedMinutes > 0 ? Math.round((billableMinutes / totalWorkedMinutes) * 100) : 0}%)
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
            href={`/workspaces/${workspaceId}/timesheets?period=${period}&${period === "month" ? `month=${month}` : `week=${weekStart}`}&targetHours=${targetHours}&view=calendar${filters.projectId ? `&projectId=${filters.projectId}` : ""}`}
            className={`timesheet-view-tab${viewMode === "calendar" ? " is-active" : ""}`}
          >
            <Calendar size={12} />
            <span>Calendar</span>
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/timesheets?period=${period}&${period === "month" ? `month=${month}` : `week=${weekStart}`}&targetHours=${targetHours}&view=list${filters.projectId ? `&projectId=${filters.projectId}` : ""}`}
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
            const dayTargetMinutes = card.isWeekend ? 0 : targetHours * 60;
            const dayProgress = dayTargetMinutes > 0 ? Math.min(100, Math.round((card.totalMinutes / dayTargetMinutes) * 100)) : 0;

            return (
              <div
                key={card.dateStr}
                className={`timesheet-day-card${card.isToday ? " is-today" : ""}${card.isWeekend ? " is-weekend" : ""}`}
              >
                <div className="day-card-header">
                  <div className="day-card-title">
                    <span className="day-card-name">{card.dayName}</span>
                    <span className="day-card-date">{card.formattedDate}</span>
                  </div>
                  {card.isToday && <span className="today-pill">Today</span>}
                </div>

                <div className="day-card-body">
                  <div className="day-card-hours-row">
                    <span className="day-card-hours">
                      {dayHours}h {dayMins}m
                    </span>
                    {!card.isWeekend && (
                      <span className="day-card-target">/{targetHours}h</span>
                    )}
                  </div>

                  {!card.isWeekend && (
                    <div className="day-card-progress" title={`${dayProgress}% of daily target`}>
                      <div
                        className="day-card-fill"
                        style={{
                          width: `${dayProgress}%`,
                          backgroundColor: dayProgress >= 100 ? "#10b981" : dayProgress >= 50 ? "#3b82f6" : "#f59e0b",
                        }}
                      />
                    </div>
                  )}

                  <div className="day-tasks-list">
                    {card.entries.slice(0, 5).map((entry) => {
                      const task = Array.isArray(entry.tasks) ? entry.tasks[0] : entry.tasks;
                      const durationH = Math.floor((entry.duration_minutes ?? 0) / 60);
                      const durationM = (entry.duration_minutes ?? 0) % 60;
                      const projName = projectMap.get(entry.project_id) ?? "Project";

                      return (
                        <div
                          key={entry.id}
                          className="day-task-item"
                          title={`${task?.generated_key}: ${task?.title} [${projName}] (${durationH}h ${durationM}m)`}
                        >
                          <span className="day-task-key">
                            {task?.generated_key ?? "Task"}
                          </span>
                          <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 600, maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {projName}
                          </span>
                          <span className="day-task-time">
                            {durationH > 0 ? `${durationH}h ` : ""}{durationM}m
                          </span>
                        </div>
                      );
                    })}
                    {card.entries.length > 5 && (
                      <span style={{ fontSize: "9px", color: "var(--muted)", textAlign: "center" }}>
                        +{card.entries.length - 5} more
                      </span>
                    )}
                    {card.entries.length === 0 && (
                      <span className="day-no-time">No time logged</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed List View */}
      {viewMode === "list" && (
        <div className="timesheet-user-group" style={{ background: "var(--surface, #fff)" }}>
          <header>
            <strong>Workspace Time Entries ({entries.length})</strong>
            <span>Total: {totalWorkedHours}h {totalWorkedRemMinutes}m</span>
          </header>
          {entries.map((entry) => {
            const task = Array.isArray(entry.tasks) ? entry.tasks[0] : entry.tasks;
            const projName = projectMap.get(entry.project_id) ?? "Project";
            const durationH = Math.floor((entry.duration_minutes ?? 0) / 60);
            const durationM = (entry.duration_minutes ?? 0) % 60;

            return (
              <div className="timesheet-entry" key={entry.id}>
                <div>
                  <Link href={`/projects/${entry.project_id}/tasks/${entry.task_id}`}>
                    {task?.generated_key ?? "Task"}: {task?.title ?? "Logged work"}
                  </Link>
                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--green, #167c58)", fontWeight: 600 }}>
                    [{projName}]
                  </span>
                  {entry.description && <p>{entry.description}</p>}
                </div>
                <span>
                  {durationH}h {durationM}m
                </span>
                <span>{names.get(entry.user_id) ?? "Team member"}</span>
                <time dateTime={entry.started_at}>
                  {new Date(entry.started_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
            );
          })}
          {!entries.length && (
            <p className="muted small" style={{ padding: "16px", margin: 0, textAlign: "center" }}>
              No time entries found in this period across the workspace.
            </p>
          )}
        </div>
      )}
      </div>
    </main>
  );
}
