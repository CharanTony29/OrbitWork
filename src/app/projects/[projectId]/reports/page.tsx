import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import BackButton from "@/app/BackButton";
import { notFound, redirect } from "next/navigation";
import {
  Download,
  Gauge,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Metric = {
  status_id: string;
  status_name: string;
  status_color: string;
  task_count: number;
  completed_count: number;
  overdue_count: number;
  estimated_minutes: number;
  actual_minutes: number;
};

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  // 1. Fetch metrics via RPC and direct queries in parallel
  const [
    metricsResult,
    tasksResult,
    assigneesResult,
    timeEntriesResult,
    profilesResult,
  ] = await Promise.all([
    supabase.rpc("get_project_report_metrics", { target_project: projectId }),
    supabase
      .from("tasks")
      .select("id, title, status_id, priority, due_date, estimate_minutes, primary_assignee_id, secondary_assignee_id")
      .eq("project_id", projectId),
    supabase
      .from("task_assignees")
      .select("task_id, user_id"),
    supabase
      .from("time_entries")
      .select("task_id, duration_minutes, billable, user_id")
      .eq("project_id", projectId),
    supabase
      .from("profiles")
      .select("id, full_name, email"),
  ]);

  if (metricsResult.error) {
    throw new Error(
      "Project report metrics are unavailable. Apply database migration 012 first."
    );
  }

  const metrics = (metricsResult.data ?? []) as Metric[];
  const tasks = tasksResult.data ?? [];
  const taskAssignees = assigneesResult.data ?? [];
  const timeEntries = timeEntriesResult.data ?? [];
  const profiles = profilesResult.data ?? [];

  const profileMap = new Map(
    profiles.map((p) => [p.id, p.full_name || p.email || "Team member"])
  );

  // Summary figures
  const total = metrics.reduce((sum, row) => sum + row.task_count, 0);
  const completed = metrics.reduce((sum, row) => sum + row.completed_count, 0);
  const overdue = metrics.reduce((sum, row) => sum + row.overdue_count, 0);
  const estimate = metrics.reduce((sum, row) => sum + row.estimated_minutes, 0);
  const actual = metrics.reduce((sum, row) => sum + row.actual_minutes, 0);
  const completion = total ? Math.round((completed * 100) / total) : 0;
  const variance = actual - estimate;

  // Billable vs Non-Billable calculation
  let totalBillableMinutes = 0;
  let totalNonBillableMinutes = 0;
  for (const entry of timeEntries) {
    const mins = entry.duration_minutes || 0;
    if (entry.billable) {
      totalBillableMinutes += mins;
    } else {
      totalNonBillableMinutes += mins;
    }
  }
  const totalTrackedMinutes = totalBillableMinutes + totalNonBillableMinutes;
  const billablePercent = totalTrackedMinutes
    ? Math.round((totalBillableMinutes * 100) / totalTrackedMinutes)
    : 100;

  // People performance breakdown
  const memberStats = new Map<
    string,
    {
      id: string;
      name: string;
      assignedCount: number;
      completedCount: number;
      totalMinutes: number;
      billableMinutes: number;
    }
  >();

  // Determine completed task IDs from metrics
  const completedStatusIds = new Set(
    metrics.filter((m) => m.completed_count > 0).map((m) => m.status_id)
  );

  // Index assignees
  for (const task of tasks) {
    const assignedUserIds = new Set<string>();
    if (task.primary_assignee_id) assignedUserIds.add(task.primary_assignee_id);
    if (task.secondary_assignee_id) assignedUserIds.add(task.secondary_assignee_id);
    for (const row of taskAssignees) {
      if (row.task_id === task.id) assignedUserIds.add(row.user_id);
    }

    const isTaskDone = completedStatusIds.has(task.status_id);

    for (const uid of assignedUserIds) {
      if (!memberStats.has(uid)) {
        memberStats.set(uid, {
          id: uid,
          name: profileMap.get(uid) ?? "Team member",
          assignedCount: 0,
          completedCount: 0,
          totalMinutes: 0,
          billableMinutes: 0,
        });
      }
      const st = memberStats.get(uid)!;
      st.assignedCount += 1;
      if (isTaskDone) st.completedCount += 1;
    }
  }

  // Add time entries to people
  for (const entry of timeEntries) {
    const uid = entry.user_id;
    if (uid) {
      if (!memberStats.has(uid)) {
        memberStats.set(uid, {
          id: uid,
          name: profileMap.get(uid) ?? "Team member",
          assignedCount: 0,
          completedCount: 0,
          totalMinutes: 0,
          billableMinutes: 0,
        });
      }
      const st = memberStats.get(uid)!;
      const mins = entry.duration_minutes || 0;
      st.totalMinutes += mins;
      if (entry.billable) st.billableMinutes += mins;
    }
  }

  const peopleList = Array.from(memberStats.values()).sort(
    (a, b) => b.totalMinutes - a.totalMinutes || b.assignedCount - a.assignedCount
  );

  // Priority breakdown
  const priorityCounts = { urgent: 0, high: 0, normal: 0, low: 0 };
  for (const t of tasks) {
    const p = t.priority as keyof typeof priorityCounts;
    if (priorityCounts[p] !== undefined) {
      priorityCounts[p] += 1;
    } else {
      priorityCounts.normal += 1;
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <div className="topbar-right">
          <CurrentUserBadge email={user.email ?? ""} />
          <form action={signOut}>
            <button className="quiet-button">Sign out</button>
          </form>
        </div>
      </header>

      <section className="project-report-page">
        <BackButton fallbackHref={`/projects/${projectId}`} label={project.name} />

        <div className="project-report-heading">
          <div>
            <p className="eyebrow">ANALYTICS & REPORTING</p>
            <h1>Project report</h1>
            <p className="muted">
              Live task totals, team workload, and logged time across categories.
            </p>
          </div>
          <a
            className="button button-secondary"
            href={`/api/projects/${projectId}/reports.csv`}
          >
            <Download size={15} /> Export CSV
          </a>
        </div>

        {/* Top Summary Stat Cards */}
        <div className="report-stat-grid">
          <article>
            <span>Total tasks</span>
            <strong>{total}</strong>
          </article>
          <article>
            <span>Completion rate</span>
            <strong>{completion}%</strong>
            <div className="report-progress">
              <i style={{ width: `${completion}%` }} />
            </div>
          </article>
          <article>
            <span>Overdue active</span>
            <strong style={{ color: overdue > 0 ? "#dc2626" : undefined }}>
              {overdue}
            </strong>
          </article>
          <article>
            <span>Estimated budget</span>
            <strong>
              {Math.floor(estimate / 60)}h {estimate % 60}m
            </strong>
          </article>
          <article>
            <span>Actual time logged</span>
            <strong>
              {Math.floor(actual / 60)}h {actual % 60}m
            </strong>
          </article>
          <article>
            <span>Billable ratio</span>
            <strong>{billablePercent}%</strong>
          </article>
          <article>
            <span>Estimate variance</span>
            <strong style={{ color: variance > 0 ? "#dc2626" : "#10b981" }}>
              {variance > 0 ? "+" : variance < 0 ? "−" : ""}
              {Math.floor(Math.abs(variance) / 60)}h {Math.abs(variance) % 60}m
            </strong>
          </article>
        </div>

        {/* Multi-Category Breakdown Grid */}
        <div className="report-categories-grid">
          {/* Category 1: Workflow & Statuses */}
          <section className="report-card">
            <header>
              <div>
                <p className="eyebrow">WORKFLOW</p>
                <h2>Tasks by status</h2>
              </div>
              <Gauge size={18} />
            </header>
            <div className="report-status-feed">
              {metrics.map((row) => {
                const pct = total ? Math.round((row.task_count * 100) / total) : 0;
                return (
                  <div className="report-status-row" key={row.status_id}>
                    <div>
                      <i style={{ backgroundColor: row.status_color }} />
                      <strong>{row.status_name}</strong>
                      <span>
                        {row.task_count} task{row.task_count === 1 ? "" : "s"} ({pct}%)
                      </span>
                    </div>
                    <div className="report-status-meter">
                      <i
                        style={{
                          width: `${pct}%`,
                          backgroundColor: row.status_color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {!metrics.length && (
                <p className="muted small">No task statuses available.</p>
              )}
            </div>
          </section>

          {/* Category 2: People & Workload */}
          <section className="report-card">
            <header>
              <div>
                <p className="eyebrow">TEAM WORKLOAD</p>
                <h2>People & Performance</h2>
              </div>
              <Users size={18} />
            </header>
            <div className="report-people-feed">
              {peopleList.map((person) => {
                const totalH = Math.floor(person.totalMinutes / 60);
                const totalM = person.totalMinutes % 60;
                const billableH = Math.floor(person.billableMinutes / 60);
                const billableM = person.billableMinutes % 60;
                const completionRate = person.assignedCount
                  ? Math.round((person.completedCount * 100) / person.assignedCount)
                  : 0;

                return (
                  <div className="report-people-row" key={person.id}>
                    <div className="report-person-avatar">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="report-person-info">
                      <div className="report-person-name">{person.name}</div>
                      <div className="report-person-meta">
                        <span>
                          {person.assignedCount} assigned · {person.completedCount}{" "}
                          done ({completionRate}%)
                        </span>
                      </div>
                    </div>
                    <div className="report-person-stats">
                      <div className="report-person-hours">
                        {totalH}h {totalM}m
                      </div>
                      <div className="report-person-billable">
                        {billableH}h {billableM}m billable
                      </div>
                    </div>
                  </div>
                );
              })}
              {peopleList.length === 0 && (
                <p className="muted small">
                  No members have been assigned tasks or logged time yet.
                </p>
              )}
            </div>
          </section>

          {/* Category 3: Time & Billable Breakdown */}
          <section className="report-card">
            <header>
              <div>
                <p className="eyebrow">TIME TRACKING</p>
                <h2>Billable vs Non-Billable</h2>
              </div>
              <Clock size={18} />
            </header>
            <div className="time-split-card">
              <div className="time-split-bar">
                <div
                  className="time-bar-billable"
                  style={{ width: `${billablePercent}%` }}
                  title={`Billable: ${billablePercent}%`}
                />
                <div
                  className="time-bar-nonbillable"
                  style={{ width: `${100 - billablePercent}%` }}
                  title={`Non-billable: ${100 - billablePercent}%`}
                />
              </div>

              <div className="time-split-legend">
                <div className="time-legend-item">
                  <span className="time-legend-dot billable" />
                  <span>
                    <strong>Billable:</strong>{" "}
                    {Math.floor(totalBillableMinutes / 60)}h{" "}
                    {totalBillableMinutes % 60}m ({billablePercent}%)
                  </span>
                </div>
                <div className="time-legend-item">
                  <span className="time-legend-dot nonbillable" />
                  <span>
                    <strong>Non-billable:</strong>{" "}
                    {Math.floor(totalNonBillableMinutes / 60)}h{" "}
                    {totalNonBillableMinutes % 60}m ({100 - billablePercent}%)
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid var(--line, #edf0ed)",
                }}
              >
                <div>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    Total Time Tracked
                  </small>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {Math.floor(totalTrackedMinutes / 60)}h{" "}
                    {totalTrackedMinutes % 60}m
                  </p>
                </div>
                <div>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                    Average Per Done Task
                  </small>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {completed > 0
                      ? `${Math.floor(totalTrackedMinutes / completed / 60)}h ${Math.round((totalTrackedMinutes / completed) % 60)}m`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Category 4: Priority Distribution */}
          <section className="report-card">
            <header>
              <div>
                <p className="eyebrow">RISK & PRIORITY</p>
                <h2>Priority Breakdown</h2>
              </div>
              <AlertTriangle size={18} />
            </header>
            <div className="priority-report-feed">
              {(
                [
                  { key: "urgent", label: "Urgent", count: priorityCounts.urgent, class: "priority-urgent-pill" },
                  { key: "high", label: "High", count: priorityCounts.high, class: "priority-high-pill" },
                  { key: "normal", label: "Normal", count: priorityCounts.normal, class: "priority-normal-pill" },
                  { key: "low", label: "Low", count: priorityCounts.low, class: "priority-low-pill" },
                ] as const
              ).map((p) => {
                const pct = total ? Math.round((p.count * 100) / total) : 0;
                return (
                  <div className="priority-report-row" key={p.key}>
                    <div className="priority-report-header">
                      <span className={`priority-pill-mini ${p.class}`}>
                        {p.label}
                      </span>
                      <span>
                        <strong>{p.count}</strong> ({pct}%)
                      </span>
                    </div>
                    <div className="report-status-meter">
                      <i
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            p.key === "urgent"
                              ? "#dc2626"
                              : p.key === "high"
                              ? "#d97706"
                              : p.key === "normal"
                              ? "#0284c7"
                              : "#64748b",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <p className="report-footnote">
          Overdue excludes tasks in completed and cancelled workflow categories.
          Actual time includes completed timer and manual entries.
        </p>
      </section>
    </main>
  );
}
