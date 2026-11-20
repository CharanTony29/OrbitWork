import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ReportPeriodType,
  ResourceMetric,
  StatusMetric,
  TaskReportItem,
} from "@/lib/export-presentation";
import type { ProjectTemplateData } from "@/lib/presentation/template-injector";
import {
  calculateWorkload,
  inferExperienceLevel,
  type MemberProfileInput,
  type TaskWorkloadInput,
} from "@/lib/workload/engine";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch project details and workspace / organization info
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, workspace_id, workspaces(name, organization_id, organizations(name))")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const period: ReportPeriodType = (searchParams.get("period") as ReportPeriodType) || "all";
    const customStartDate = searchParams.get("startDate");
    const customEndDate = searchParams.get("endDate");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");
    const taskIdsParam = searchParams.get("taskIds");
    const selectedTaskSet = taskIdsParam
      ? new Set(taskIdsParam.split(",").map((s) => s.trim()).filter(Boolean))
      : null;

    // Determine period boundaries and human label
    const now = new Date();
    let filterStart: Date | null = null;
    let filterEnd: Date | null = null;
    let periodLabel = "All Active Tasks (Full Snapshot)";

    if (period === "weekly") {
      const curr = new Date();
      const firstDay = curr.getDate() - curr.getDay() + 1;
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

    // Fetch statuses, tasks, assignees, profiles, dependencies, goals, decisions, and members in parallel
    const [
      statusesResult,
      tasksResult,
      assigneesResult,
      profilesResult,
      dependenciesResult,
      goalsResult,
      decisionsResult,
      membersResult,
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
    ]);

    const rawStatuses = statusesResult.data ?? [];
    const rawTasks = tasksResult.data ?? [];
    const rawAssignees = assigneesResult.data ?? [];
    const rawProfiles = profilesResult.data ?? [];
    const rawDependencies = dependenciesResult.data ?? [];
    const rawGoals = goalsResult.data ?? [];
    const rawDecisions = decisionsResult.data ?? [];
    const rawMembers = membersResult.data ?? [];

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

    const todayDateOnly = new Date().toISOString().slice(0, 10);

    // Transform raw tasks to TaskReportItem
    const allReportTasks: TaskReportItem[] = rawTasks.map((t) => {
      const st = t.status_id ? statusMap.get(t.status_id) : undefined;
      const statusCategory = st?.category || "not_started";
      const statusName = st?.name || "To Do";
      const statusColor = st?.color || "#64748B";

      const isCompleted =
        statusCategory === "completed" ||
        statusCategory === "cancelled" ||
        statusName.toLowerCase().includes("done") ||
        statusName.toLowerCase().includes("complete") ||
        statusName.toLowerCase().includes("closed");

      const isInProgress =
        statusCategory === "in_progress" ||
        statusName.toLowerCase().includes("progress") ||
        statusName.toLowerCase().includes("dev") ||
        statusName.toLowerCase().includes("review");

      const isHold =
        statusCategory === "on_hold" ||
        statusName.toLowerCase().includes("hold") ||
        statusName.toLowerCase().includes("blocked");

      const isPending = !isCompleted;
      const isOverdue = Boolean(t.due_date && t.due_date < todayDateOnly && !isCompleted);

      const assigneeIds = Array.from(taskAssigneeMap.get(t.id) || []);
      const assignees = assigneeIds.map((uid) => ({
        id: uid,
        name: profileMap.get(uid) || "Team member",
      }));

      return {
        id: t.id,
        key: t.generated_key || `#${t.id.slice(0, 6)}`,
        title: t.title,
        priority: t.priority || "normal",
        startDate: t.start_date || undefined,
        dueDate: t.due_date || undefined,
        statusId: t.status_id || undefined,
        statusName,
        statusCategory,
        statusColor,
        isCompleted,
        isInProgress,
        isHold,
        isPending,
        isOverdue,
        assignees,
        createdAt: t.created_at,
        estimatedHours: Math.round(((t.estimate_minutes || 0) / 60) * 10) / 10,
      };
    });

    // Filter tasks by period and selection
    const filteredTasks = allReportTasks.filter((t) => {
      if (selectedTaskSet && !selectedTaskSet.has(t.id)) {
        return false;
      }
      if (period !== "all") {
        const itemDate = t.dueDate ? new Date(t.dueDate) : new Date(t.createdAt);
        if (filterStart && itemDate < filterStart) return false;
        if (filterEnd && itemDate > filterEnd) return false;
      }
      return true;
    });

    // Calculate status counts
    const statusCounts = new Map<string, number>();
    for (const t of filteredTasks) {
      if (t.statusId) {
        statusCounts.set(t.statusId, (statusCounts.get(t.statusId) || 0) + 1);
      }
    }

    const statusMetrics: StatusMetric[] = rawStatuses.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      category: s.category,
      count: statusCounts.get(s.id) || 0,
    }));

    // Calculate resource metrics based on filtered tasks
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

    const completedTasks = filteredTasks.filter((t) => t.isCompleted);
    const inProgressTasks = filteredTasks.filter((t) => t.isInProgress);
    const holdTasks = filteredTasks.filter((t) => t.isHold);
    const pendingTasks = filteredTasks.filter((t) => t.isPending);
    const overdueTasks = filteredTasks.filter((t) => t.isOverdue && !t.isCompleted);

    const totalCount = filteredTasks.length;
    const completionRate = totalCount ? Math.round((completedTasks.length * 100) / totalCount) : 0;
    const inProgressRate = totalCount ? Math.round((inProgressTasks.length * 100) / totalCount) : 0;
    const holdRate = totalCount ? Math.round((holdTasks.length * 100) / totalCount) : 0;
    const pendingRate = totalCount ? Math.round((pendingTasks.length * 100) / totalCount) : 0;

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
      return {
        userId: uid,
        name: p?.display_name?.trim() || p?.email?.split("@")[0] || "Team Member",
        email: p?.email || "",
        avatarUrl: p?.avatar_url || null,
        role: roleStr,
        experienceLevel: inferExperienceLevel(roleStr),
        rawCapacityHours: 40,
        workingDays: 5,
        workingHoursPerDay: 8,
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

    const data: ProjectTemplateData = {
      projectName: project.name,
      workspaceName: workspaceObj?.name,
      organizationName: orgName,
      periodLabel,
      totalTasks: totalCount,
      completedTasks,
      inProgressTasks,
      holdTasks,
      pendingTasks,
      overdueTasks,
      completionRate,
      inProgressRate,
      holdRate,
      pendingRate,
      statusMetrics,
      resourceMetrics,
      allTasks: filteredTasks,
      totalEstimatedHours,
      workloadResult,
      dependencies,
      goals,
      decisions,
      risks: [], // 0 risks recorded in project
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Presentation data error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load presentation data" },
      { status: 500 }
    );
  }
}
