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
import { getCompanyTemplateById } from "@/lib/presentation/company-template";
import {
  injectProjectDataIntoCompanyTemplate,
  getOrbitworkMasterTemplateBuffer,
} from "@/lib/presentation/template-injector";
import {
  calculatePeriodCapacity,
  calculateWorkload,
  inferExperienceLevel,
  type MemberProfileInput,
  type TaskWorkloadInput,
} from "@/lib/workload/engine";

interface PptxExportConfig {
  period?: ReportPeriodType;
  startDate?: string;
  endDate?: string;
  month?: string;
  year?: string;
  includeCatalog?: boolean;
  aiPrompt?: string;
  templateId?: string;
  style?: string;
  customPrimary?: string;
  customSecondary?: string;
  customAccent?: string;
  customBg?: string;
  selectedTaskIds?: string[];
  selectedSections?: string[];
  selectedCharts?: string[];
  rawZipBase64?: string;
}

async function handleGeneratePptx(
  projectId: string,
  config: PptxExportConfig
) {
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

  const workspaceObj = Array.isArray(project.workspaces)
    ? project.workspaces[0]
    : project.workspaces;
  const orgId = workspaceObj?.organization_id;

  const period: ReportPeriodType = config.period || "all";
  const customStartDate = config.startDate;
  const customEndDate = config.endDate;
  const monthParam = config.month;
  const yearParam = config.year;
  const includeCatalog = config.includeCatalog !== false;
  const aiPrompt = config.aiPrompt || undefined;
  const templateId = config.templateId || config.style || "orbitwork_workload_review";
  const selectedTaskSet =
    config.selectedTaskIds && config.selectedTaskIds.length > 0
      ? new Set(config.selectedTaskIds)
      : null;

  // Determine period boundaries and human label
  const now = new Date();
  let filterStart: Date | null = null;
  let filterEnd: Date | null = null;
  let periodLabel = "All Active Tasks (Full Snapshot)";

  if (period === "weekly") {
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

  // Fetch statuses, tasks, assignees, profiles, dependencies, goals, decisions, members, holidays, and leaves in parallel
  const [
    statusesResult,
    tasksResult,
    assigneesResult,
    profilesResult,
    dependenciesResult,
    goalsResult,
    decisionsResult,
    membersResult,
    holidaysResult,
    leavesResult,
  ] = await Promise.all([
    supabase
      .from("project_statuses")
      .select("id, name, color, category, position")
      .eq("project_id", projectId)
      .order("position"),
    supabase
      .from("tasks")
      .select(
        "id, generated_key, title, task_type, priority, start_date, due_date, status_id, created_at, primary_assignee_id, secondary_assignee_id, estimate_minutes, parent_task_id"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase.from("task_assignees").select("task_id, user_id"),
    supabase.from("profiles").select("id, display_name, email, avatar_url, designation"),
    supabase
      .from("task_dependencies")
      .select("project_id, task_id, linked_task_id, relation")
      .eq("project_id", projectId),
    supabase
      .from("project_goals")
      .select("id, project_id, title, description, target_date, progress, status, completed_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("project_decisions")
      .select("id, project_id, title, decision_date, reason, impact, status, decided_by")
      .eq("project_id", projectId)
      .order("decision_date", { ascending: false }),
    supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId),
    orgId
      ? supabase
          .from("organization_holidays")
          .select("id, name, holiday_date")
          .eq("organization_id", orgId)
      : Promise.resolve({ data: [] }),
    orgId
      ? supabase
          .from("leave_requests")
          .select("id, user_id, start_date, end_date, status, leave_type")
          .eq("organization_id", orgId)
          .or("status.eq.approved,status.eq.Approved")
      : Promise.resolve({ data: [] }),
  ]);

  const rawStatuses = statusesResult.data ?? [];
  const rawTasks = tasksResult.data ?? [];
  const rawAssignees = assigneesResult.data ?? [];
  const rawProfiles = profilesResult.data ?? [];
  const rawDependencies = dependenciesResult.data ?? [];
  const rawGoals = goalsResult.data ?? [];
  const rawDecisions = decisionsResult.data ?? [];
  const rawMembers = membersResult.data ?? [];
  const rawHolidays = holidaysResult.data ?? [];
  const rawLeaves = leavesResult.data ?? [];

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
    // If selective tasks are requested, filter strictly
    if (selectedTaskSet && !selectedTaskSet.has(t.id)) {
      continue;
    }

    const taskCreated = new Date(t.created_at);
    const taskDue = t.due_date ? new Date(t.due_date) : null;

    // Apply period filtering if set
    if (filterStart || filterEnd) {
      let matches = false;
      if (
        (!filterStart || taskCreated >= filterStart) &&
        (!filterEnd || taskCreated <= filterEnd)
      ) {
        matches = true;
      }
      if (
        taskDue &&
        (!filterStart || taskDue >= filterStart) &&
        (!filterEnd || taskDue <= filterEnd)
      ) {
        matches = true;
      }
      if (!matches) {
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

  // Calculate status counts based on selected/filtered tasks
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

  // Calculate resource metrics based on selected/filtered tasks
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
  const orgObj = workspaceObj && "organizations" in workspaceObj
    ? (workspaceObj as { organizations?: { name?: string } | { name?: string }[] }).organizations
    : null;
  const orgName = orgObj
    ? Array.isArray(orgObj)
      ? orgObj[0]?.name
      : orgObj.name
    : undefined;

  const style = (config.style as any) || "executive";
  const customPrimary = config.customPrimary;
  const customSecondary = config.customSecondary;
  const customAccent = config.customAccent;
  const customBg = config.customBg;

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
    templateId,
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
    selectedSections: config.selectedSections,
    selectedCharts: config.selectedCharts,
  };

  // Check if this is Orbitwork Master Review template or uploaded corporate template
  const isOrbitworkMaster = templateId === "orbitwork_workload_review";
  const companyDef = templateId.startsWith("company_") ? getCompanyTemplateById(templateId) : null;
  const rawZipBase64 = config.rawZipBase64 || companyDef?.rawZipBase64;

  let buffer: Uint8Array | Buffer;

  if (isOrbitworkMaster || rawZipBase64 || templateId.startsWith("company_")) {
    const templateBuffer = isOrbitworkMaster
      ? getOrbitworkMasterTemplateBuffer()
      : rawZipBase64
      ? Buffer.from(rawZipBase64, "base64")
      : getOrbitworkMasterTemplateBuffer();

    const completedTasks = filteredTasks.filter((t) => t.isCompleted);
    const inProgressTasks = filteredTasks.filter((t) => t.isInProgress);
    const holdTasks = filteredTasks.filter((t) => t.isHold);
    const pendingTasks = filteredTasks.filter((t) => t.isPending);
    const overdueTasks = filteredTasks.filter((t) => t.isOverdue && !t.isCompleted);

    const completionRate = filteredTasks.length
      ? Math.round((completedTasks.length * 100) / filteredTasks.length)
      : 0;

    // Calculate total estimated hours across all tasks
    const totalEstimatedHours = Math.round(
      rawTasks.reduce((acc, t) => acc + (t.estimate_minutes || 0) / 60, 0)
    );

    // Build unique set of project team members
    const memberUserIds = new Set<string>();
    for (const m of rawMembers) {
      if (m.user_id) memberUserIds.add(m.user_id);
    }
    for (const t of rawTasks) {
      const assignees = taskAssigneeMap.get(t.id);
      if (assignees) {
        for (const uid of assignees) memberUserIds.add(uid);
      }
    }

    const memberProfiles: MemberProfileInput[] = Array.from(memberUserIds).map((uid) => {
      const p = rawProfiles.find((x) => x.id === uid);
      const pm = rawMembers.find((x) => x.user_id === uid);
      const roleStr = p?.designation || pm?.role || "Software Engineer";

      const periodCap = calculatePeriodCapacity({
        userId: uid,
        period,
        startDate: filterStart,
        endDate: filterEnd,
        month: monthParam,
        year: yearParam ? Number(yearParam) : undefined,
        workingHoursPerDay: 8,
        holidays: (rawHolidays as any) || [],
        leaveRequests: (rawLeaves as any) || [],
      });

      return {
        userId: uid,
        name: p?.display_name?.trim() || p?.email?.split("@")[0] || "Team Member",
        email: p?.email || "",
        avatarUrl: p?.avatar_url || null,
        role: roleStr,
        experienceLevel: inferExperienceLevel(roleStr),
        rawCapacityHours: periodCap.rawCapacityHours,
        workingDays: periodCap.netWorkingDays,
        workingHoursPerDay: 8,
        holidaysHours: periodCap.holidayHours,
        leaveHours: periodCap.leaveHours,
      };
    });

    const workloadTasks: TaskWorkloadInput[] = rawTasks.map((t) => {
      const st = t.status_id ? statusMap.get(t.status_id) : undefined;
      const isCompleted =
        st?.category === "completed" ||
        st?.category === "cancelled" ||
        (st?.name &&
          (st.name.toLowerCase().includes("done") ||
            st.name.toLowerCase().includes("complete") ||
            st.name.toLowerCase().includes("closed")));
      const assignees = Array.from(taskAssigneeMap.get(t.id) || []);
      return {
        id: t.id,
        title: t.title,
        estimateMinutes: t.estimate_minutes || 0,
        priority: t.priority as any,
        dueDate: t.due_date,
        primaryAssigneeId: t.primary_assignee_id || assignees[0] || null,
        secondaryAssigneeId: t.secondary_assignee_id || assignees[1] || null,
        assigneeIds:
          assignees.length > 0
            ? assignees
            : ([t.primary_assignee_id].filter(Boolean) as string[]),
        isCompleted: Boolean(isCompleted),
        parentTaskId: t.parent_task_id,
      };
    });

    const workloadResult = calculateWorkload(memberProfiles, workloadTasks);

    // Map dependencies to real task keys and titles
    const rawTaskMap = new Map(rawTasks.map((t) => [t.id, t]));
    const dependencies = rawDependencies.map((d) => {
      const t1 = rawTaskMap.get(d.task_id);
      const t2 = rawTaskMap.get(d.linked_task_id);
      return {
        relation: d.relation || "blocks",
        taskKey: t1?.generated_key || `#${d.task_id.slice(0, 6)}`,
        taskTitle: t1?.title || "Deliverable",
        linkedKey: t2?.generated_key || `#${d.linked_task_id.slice(0, 6)}`,
        linkedTitle: t2?.title || "Linked Deliverable",
      };
    });

    // Map goals
    const goals = rawGoals.map((g) => ({
      title: g.title,
      targetDate: g.target_date || undefined,
      progress: g.progress ?? undefined,
      status: g.status || "active",
    }));

    // Map decisions
    const decisions = rawDecisions.map((d) => ({
      title: d.title,
      owner: d.decided_by ? profileMap.get(d.decided_by) || "PMO" : "PMO",
      dueDate: d.decision_date || undefined,
      status: d.status || "CONFIRMED",
    }));

    buffer = await injectProjectDataIntoCompanyTemplate(templateBuffer, {
      projectName: project.name,
      workspaceName: workspaceObj?.name,
      organizationName: orgName,
      periodLabel,
      totalTasks: filteredTasks.length,
      completedTasks,
      inProgressTasks,
      holdTasks,
      pendingTasks,
      overdueTasks,
      completionRate,
      inProgressRate: filteredTasks.length
        ? Math.round((inProgressTasks.length * 100) / filteredTasks.length)
        : 0,
      holdRate: filteredTasks.length
        ? Math.round((holdTasks.length * 100) / filteredTasks.length)
        : 0,
      pendingRate: filteredTasks.length
        ? Math.round((pendingTasks.length * 100) / filteredTasks.length)
        : 0,
      statusMetrics,
      resourceMetrics,
      allTasks: filteredTasks,
      totalEstimatedHours,
      workloadResult,
      dependencies,
      goals,
      decisions,
      risks: [],
    });
  } else {
    // Build the presentation deck using PptxGenJS
    const pptx = buildPresentationDeck(options, filteredTasks, statusMetrics, resourceMetrics);
    buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  }

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const taskIdsParam = searchParams.get("taskIds");
    const selectedTaskIds = taskIdsParam ? taskIdsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const sectionsParam = searchParams.get("sections");
    const selectedSections = sectionsParam ? sectionsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const chartsParam = searchParams.get("charts");
    const selectedCharts = chartsParam ? chartsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const config: PptxExportConfig = {
      period: (searchParams.get("period") as ReportPeriodType) || "all",
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      month: searchParams.get("month") || undefined,
      year: searchParams.get("year") || undefined,
      includeCatalog: searchParams.get("includeCatalog") !== "false",
      aiPrompt: searchParams.get("aiPrompt") || undefined,
      templateId: searchParams.get("templateId") || searchParams.get("style") || "pitch_sage",
      style: searchParams.get("style") || undefined,
      customPrimary: searchParams.get("customPrimary") || undefined,
      customSecondary: searchParams.get("customSecondary") || undefined,
      customAccent: searchParams.get("customAccent") || undefined,
      customBg: searchParams.get("customBg") || undefined,
      selectedTaskIds,
      selectedSections,
      selectedCharts,
    };

    return await handleGeneratePptx(projectId, config);
  } catch (err: any) {
    console.error("[presentation.pptx] GET error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to generate presentation" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    let body: PptxExportConfig = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    return await handleGeneratePptx(projectId, body);
  } catch (err: any) {
    console.error("[presentation.pptx] POST error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to generate presentation" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
