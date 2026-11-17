import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildPresentationDeck,
  PresentationReportOptions,
  ReportPeriodType,
  ResourceMetric,
  StatusMetric,
  TaskReportItem,
} from "@/lib/export-presentation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Fetch project details and workspace / organization info
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, workspace_id, workspaces(name, organization_id, organizations(name))")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    return new Response("Project not found or access denied", { status: 404 });
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const period = (searchParams.get("period") as ReportPeriodType) || "all";
  const customStartDate = searchParams.get("startDate");
  const customEndDate = searchParams.get("endDate");
  const monthParam = searchParams.get("month"); // e.g. "2026-11"
  const yearParam = searchParams.get("year"); // e.g. "2026"
  const includeCatalog = searchParams.get("includeCatalog") !== "false";
  const aiPrompt = searchParams.get("aiPrompt") || undefined;

  // Determine period boundaries and human label
  const now = new Date();
  let filterStart: Date | null = null;
  let filterEnd: Date | null = null;
  let periodLabel = "All Active Tasks (Full Snapshot)";

  if (period === "weekly") {
    // Current or specified week (Monday to Sunday)
    const curr = new Date();
    const firstDay = curr.getDate() - curr.getDay() + 1; // Monday
    const startOfWeek = new Date(curr.setDate(firstDay));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    filterStart = startOfWeek;
    filterEnd = endOfWeek;
    periodLabel = `Weekly Report: ${startOfWeek.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} – ${endOfWeek.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  } else if (period === "monthly") {
    const targetMonthStr = monthParam || now.toISOString().slice(0, 7);
    const [y, m] = targetMonthStr.split("-").map(Number);
    filterStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    filterEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    const monthName = filterStart.toLocaleString("en-US", { month: "long", year: "numeric" });
    periodLabel = `Monthly Report: ${monthName}`;
  } else if (period === "yearly") {
    const targetYear = Number(yearParam) || now.getFullYear();
    filterStart = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
    filterEnd = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));
    periodLabel = `Annual Status Report: ${targetYear}`;
  } else if (period === "custom" && (customStartDate || customEndDate)) {
    filterStart = customStartDate ? new Date(customStartDate) : null;
    filterEnd = customEndDate ? new Date(`${customEndDate}T23:59:59`) : null;
    periodLabel = `Custom Date Range: ${customStartDate || "Start"} to ${
      customEndDate || "Current"
    }`;
  }

  // Fetch statuses, tasks, assignees, and profiles in parallel
  const [statusesResult, tasksResult, assigneesResult, profilesResult] = await Promise.all([
    supabase
      .from("project_statuses")
      .select("id, name, color, category, position")
      .eq("project_id", projectId)
      .order("position"),
    supabase
      .from("tasks")
      .select(
        "id, generated_key, title, task_type, priority, start_date, due_date, status_id, created_at, primary_assignee_id, secondary_assignee_id"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase.from("task_assignees").select("task_id, user_id"),
    supabase.from("profiles").select("id, display_name, email"),
  ]);

  const rawStatuses = statusesResult.data ?? [];
  const rawTasks = tasksResult.data ?? [];
  const rawAssignees = assigneesResult.data ?? [];
  const rawProfiles = profilesResult.data ?? [];

  const profileMap = new Map(
    rawProfiles.map((p) => [p.id, p.display_name?.trim() || p.email || "Team member"])
  );
  const statusMap = new Map(rawStatuses.map((s) => [s.id, s]));

  // Index task assignees
  const taskAssigneeMap = new Map<string, Set<string>>();
  for (const t of rawTasks) {
    const s = new Set<string>();
    if (t.primary_assignee_id) s.add(t.primary_assignee_id);
    if (t.secondary_assignee_id) s.add(t.secondary_assignee_id);
    taskAssigneeMap.set(t.id, s);
  }
  for (const row of rawAssignees) {
    let s = taskAssigneeMap.get(row.task_id);
    if (!s) {
      s = new Set<string>();
      taskAssigneeMap.set(row.task_id, s);
    }
    s.add(row.user_id);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter and shape tasks
  const filteredTasks: TaskReportItem[] = [];

  for (const t of rawTasks) {
    const taskCreated = new Date(t.created_at);
    const taskDue = t.due_date ? new Date(t.due_date) : null;

    // Apply period filtering if set
    if (filterStart || filterEnd) {
      let matches = false;
      // If task created in period
      if (
        (!filterStart || taskCreated >= filterStart) &&
        (!filterEnd || taskCreated <= filterEnd)
      ) {
        matches = true;
      }
      // Or if task due in period
      if (
        taskDue &&
        (!filterStart || taskDue >= filterStart) &&
        (!filterEnd || taskDue <= filterEnd)
      ) {
        matches = true;
      }
      if (!matches) {
        // Skip tasks completely outside the window unless period is "all"
        continue;
      }
    }

    const st = statusMap.get(t.status_id);
    const stName = (st?.name || "To Do").toLowerCase();
    const stCategory = st?.category || "not_started";

    const isCompleted =
      stCategory === "completed" ||
      stCategory === "cancelled" ||
      stName.includes("done") ||
      stName.includes("complete") ||
      stName.includes("closed");

    const isHold =
      stName.includes("hold") ||
      stName.includes("block") ||
      stName.includes("wait") ||
      stName.includes("pause");

    const isInProgress =
      !isCompleted &&
      !isHold &&
      (stCategory === "in_progress" ||
        stName.includes("progress") ||
        stName.includes("doing") ||
        stName.includes("active") ||
        stName.includes("re open") ||
        stName.includes("review") ||
        stName.includes("qa"));

    const isPending = !isCompleted && !isHold && !isInProgress;

    const isOverdue = Boolean(t.due_date && t.due_date < todayStr && !isCompleted);

    const userIds = Array.from(taskAssigneeMap.get(t.id) ?? []);
    const assignees = userIds.map((uid) => ({
      id: uid,
      name: profileMap.get(uid) || "Team member",
    }));

    filteredTasks.push({
      id: t.id,
      key: t.generated_key || `#${t.id.slice(0, 6)}`,
      title: t.title,
      taskType: t.task_type || "task",
      statusId: t.status_id,
      statusName: st?.name || "To Do",
      statusColor: st?.color,
      statusCategory: st?.category,
      priority: (t.priority as TaskReportItem["priority"]) || "normal",
      dueDate: t.due_date,
      startDate: t.start_date,
      createdAt: t.created_at,
      assignees,
      isCompleted,
      isOverdue,
      isHold,
      isInProgress,
      isPending,
    });
  }

  // Calculate status counts
  const statusCounts = new Map<string, number>();
  for (const t of filteredTasks) {
    statusCounts.set(t.statusId, (statusCounts.get(t.statusId) || 0) + 1);
  }
  const statusMetrics: StatusMetric[] = rawStatuses.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    category: s.category,
    count: statusCounts.get(s.id) || 0,
  }));

  // Calculate resource metrics ("Who is working on it")
  const resourceStats = new Map<string, ResourceMetric>();

  for (const t of filteredTasks) {
    if (t.assignees.length === 0) {
      const uid = "unassigned";
      if (!resourceStats.has(uid)) {
        resourceStats.set(uid, {
          id: uid,
          name: "Unassigned Deliverables",
          totalAssigned: 0,
          completedCount: 0,
          inProgressCount: 0,
          holdCount: 0,
          pendingCount: 0,
          overdueCount: 0,
        });
      }
      const st = resourceStats.get(uid)!;
      st.totalAssigned += 1;
      if (t.isCompleted) st.completedCount += 1;
      if (t.isInProgress) st.inProgressCount += 1;
      if (t.isHold) st.holdCount += 1;
      if (t.isPending) st.pendingCount += 1;
      if (t.isOverdue) st.overdueCount += 1;
    } else {
      for (const a of t.assignees) {
        if (!resourceStats.has(a.id)) {
          resourceStats.set(a.id, {
            id: a.id,
            name: a.name,
            totalAssigned: 0,
            completedCount: 0,
            inProgressCount: 0,
            holdCount: 0,
            pendingCount: 0,
            overdueCount: 0,
          });
        }
        const st = resourceStats.get(a.id)!;
        st.totalAssigned += 1;
        if (t.isCompleted) st.completedCount += 1;
        if (t.isInProgress) st.inProgressCount += 1;
        if (t.isHold) st.holdCount += 1;
        if (t.isPending) st.pendingCount += 1;
        if (t.isOverdue) st.overdueCount += 1;
      }
    }
  }

  const resourceMetrics = Array.from(resourceStats.values()).sort(
    (a, b) => b.totalAssigned - a.totalAssigned
  );

  // Extract workspace / org names
  const workspaceObj = Array.isArray(project.workspaces)
    ? project.workspaces[0]
    : project.workspaces;
  const orgObj = workspaceObj && "organizations" in workspaceObj
    ? (workspaceObj as { organizations?: { name?: string } | { name?: string }[] }).organizations
    : null;
  const orgName = orgObj
    ? Array.isArray(orgObj)
      ? orgObj[0]?.name
      : orgObj.name
    : undefined;

  const style = (searchParams.get("style") as any) || "executive";
  const customPrimary = searchParams.get("customPrimary");
  const customSecondary = searchParams.get("customSecondary");
  const customAccent = searchParams.get("customAccent");
  const customBg = searchParams.get("customBg");

  const options: PresentationReportOptions = {
    projectName: project.name,
    workspaceName: workspaceObj?.name,
    organizationName: orgName,
    periodType: period,
    periodLabel,
    startDate: customStartDate || undefined,
    endDate: customEndDate || undefined,
    includeCatalog,
    style,
    customColors:
      customPrimary || customSecondary || customAccent || customBg
        ? {
            primary: customPrimary || undefined,
            secondary: customSecondary || undefined,
            accent: customAccent || undefined,
            background: customBg || undefined,
          }
        : undefined,
    aiPrompt,
  };

  // Build the presentation deck
  const pptx = buildPresentationDeck(options, filteredTasks, statusMetrics, resourceMetrics);

  // Generate binary node buffer
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  const safeProjectSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const fileName = `${safeProjectSlug}-status-report-${period}.pptx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
