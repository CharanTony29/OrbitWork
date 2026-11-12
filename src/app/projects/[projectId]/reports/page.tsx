import AppTopBar from "@/app/AppTopBar";
import BackButton from "@/app/BackButton";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ReportsChartsClient from "./ReportsChartsClient";

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
      .select("id, display_name, email"),
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
    profiles.map((p) => [p.id, p.display_name?.trim() || p.email || "Team member"])
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
      <AppTopBar email={user.email ?? ""} projectId={projectId} />

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

        {/* Multi-Category Breakdown Grid (Bar / Pie Switcher) */}
        <ReportsChartsClient
          total={total}
          completed={completed}
          metrics={metrics.map((m) => ({
            status_id: m.status_id,
            status_name: m.status_name,
            status_color: m.status_color,
            task_count: m.task_count,
          }))}
          peopleList={peopleList}
          totalBillableMinutes={totalBillableMinutes}
          totalNonBillableMinutes={totalNonBillableMinutes}
          totalTrackedMinutes={totalTrackedMinutes}
          billablePercent={billablePercent}
          priorityCounts={priorityCounts}
        />

        <p className="report-footnote">
          Overdue excludes tasks in completed and cancelled workflow categories.
          Actual time includes completed timer and manual entries.
        </p>
      </section>
    </main>
  );
}
