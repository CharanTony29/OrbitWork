// src/lib/brain/portfolio-brain.ts
// Multi-Project Portfolio Intelligence for Workspace Brain and Organization Brain

import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client";
import {
  calculateWorkload,
  MemberProfileInput,
  TaskWorkloadInput,
  OverloadStatus,
  WorkloadConfidence,
} from "@/lib/workload/engine";
import type {
  HealthCategoryScore,
  ProjectHealthBreakdown,
  RiskItem,
  ActionableRecommendation,
  TimelineEvent,
} from "./types";

export interface TaskCatalogFilter {
  selectedProjectIds?: string[];
  priorities?: string[];
  statusCategories?: string[];
  searchQuery?: string;
}

export interface PortfolioProjectInfo {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  taskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  healthScore: number;
}

export interface PortfolioMemberWorkload {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
  experienceLevel: string;
  experienceFactor: number;
  totalTasks: number;
  unestimatedTasksCount: number;
  confidence: WorkloadConfidence;
  confidenceReason: string;
  totalEstimatedHours: number;
  rawCapacityHours: number;
  effectiveCapacityHours: number;
  utilizationPercentage: number;
  overdueTasks: number;
  projectCount: number;
  status: OverloadStatus;
  statusLabel: string;
  explanation: string;
  potentialRedistribution?: {
    recommended: boolean;
    reason: string;
    targetMemberId?: string;
    targetMemberName?: string;
    taskId?: string;
    taskTitle?: string;
    hoursToShift?: number;
    resultingUtilizationSelf?: number;
    resultingUtilizationTarget?: number;
  };
}

export interface PortfolioBrainPayload {
  scopeType: "workspace" | "organization";
  scopeId: string;
  scopeName: string;
  availableProjects: Array<{ id: string; name: string }>;
  activeFilter: TaskCatalogFilter;
  health: ProjectHealthBreakdown;
  portfolioProjects: PortfolioProjectInfo[];
  workload: PortfolioMemberWorkload[];
  crossProjectDependencies: Array<{
    blockingProject: string;
    blockingTask: string;
    blockedProject: string;
    blockedTask: string;
  }>;
  aiExecutiveSummary: {
    headline: string;
    summary: string;
    recommendations: string[];
  };
  metrics: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    inProgressTasks: number;
    totalEstimatedHours: number;
    completionPercentage: number;
  };
  risks: Array<{
    id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    reason: string;
    affectedProject?: string;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    category: "workload" | "schedule" | "dependency";
    expectedBenefit: string;
  }>;
  timeline: Array<{
    id: string;
    title: string;
    date: string;
    type: "milestone" | "deadline" | "delivery";
    projectName: string;
  }>;
}

export async function buildWorkspaceBrain(
  workspaceId: string,
  userId: string,
  filter?: TaskCatalogFilter
): Promise<PortfolioBrainPayload> {
  const supabase = await createClient();

  // 1. Fetch workspace details
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, description, organization_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  // 2. Fetch all projects in workspace
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name, description, status, priority, due_date")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const projectsList = allProjects || [];
  const availableProjects = projectsList.map((p) => ({ id: p.id, name: p.name }));

  // Filter projects if specified in Task Catalog
  const targetProjects =
    filter?.selectedProjectIds && filter.selectedProjectIds.length > 0
      ? projectsList.filter((p) => filter.selectedProjectIds!.includes(p.id))
      : projectsList;

  const targetProjectIds = targetProjects.map((p) => p.id);

  // 3. Fetch tasks across target projects
  let tasksQuery = supabase
    .from("tasks")
    .select(
      "id, project_id, generated_key, title, priority, status_id, due_date, estimate_minutes, primary_assignee_id, secondary_assignee_id, parent_task_id, task_type"
    )
    .in("project_id", targetProjectIds.length > 0 ? targetProjectIds : ["00000000-0000-0000-0000-000000000000"]);

  if (filter?.priorities && filter.priorities.length > 0) {
    tasksQuery = tasksQuery.in("priority", filter.priorities);
  }

  const { data: allTasks } = await tasksQuery;
  const tasks = allTasks || [];

  // Fetch statuses
  const { data: statuses } = await supabase
    .from("task_statuses")
    .select("id, name, category, project_id");
  const statusMap = new Map((statuses || []).map((s) => [s.id, s]));

  // Fetch profiles with display_name
  const { data: rawProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url");

  const profileMap = new Map(
    (rawProfiles || []).map((p) => {
      const cleanName = p.display_name?.trim() || p.email?.split("@")[0] || "Team Member";
      return [p.id, { id: p.id, name: cleanName, email: p.email || "", avatarUrl: p.avatar_url }];
    })
  );

  // Fetch dependencies across target projects
  const { data: deps } = await supabase
    .from("task_dependencies")
    .select("task_id, linked_task_id, relation");

  // Collect all assignees
  const assigneeUserIds = new Set<string>();
  for (const t of tasks) {
    if (t.primary_assignee_id) assigneeUserIds.add(t.primary_assignee_id);
    if (t.secondary_assignee_id) assigneeUserIds.add(t.secondary_assignee_id);
  }

  // Build profile inputs for centralized Workload Engine
  const profileInputs: MemberProfileInput[] = [];
  for (const uid of assigneeUserIds) {
    const prof = profileMap.get(uid);
    profileInputs.push({
      userId: uid,
      name: prof?.name || "Team Member",
      email: prof?.email || "",
      avatarUrl: prof?.avatarUrl || null,
      role: "Software Engineer",
      rawCapacityHours: 40,
    });
  }

  // Also include project profiles if few
  for (const [, prof] of profileMap) {
    if (!profileInputs.some((p) => p.userId === prof.id)) {
      profileInputs.push({
        userId: prof.id,
        name: prof.name,
        email: prof.email,
        avatarUrl: prof.avatarUrl,
        role: "Software Engineer",
        rawCapacityHours: 40,
      });
    }
  }

  // Prepare tasks for Workload Engine
  const taskInputs: TaskWorkloadInput[] = tasks.map((t) => {
    const s = statusMap.get(t.status_id);
    const isCompleted = s?.category === "done" || s?.category === "completed" || s?.category === "cancelled";
    return {
      id: t.id,
      title: t.title,
      estimateMinutes: t.estimate_minutes,
      priority: (t.priority as any) || "normal",
      dueDate: t.due_date,
      primaryAssigneeId: t.primary_assignee_id,
      secondaryAssigneeId: t.secondary_assignee_id,
      category: t.task_type || s?.category,
      isCompleted,
      parentTaskId: t.parent_task_id,
    };
  });

  // RUN CENTRALIZED WORKLOAD ENGINE
  const workloadEngineResult = calculateWorkload(profileInputs, taskInputs);

  // Calculate project tracking metrics
  const now = new Date();
  let completedTasks = 0;
  let overdueTasks = 0;
  let inProgressTasks = 0;
  let totalEstimatedMinutes = 0;

  const projectStats = new Map<
    string,
    { total: number; completed: number; overdue: number }
  >();

  targetProjects.forEach((p) => {
    projectStats.set(p.id, { total: 0, completed: 0, overdue: 0 });
  });

  // Track project counts per member
  const memberProjectCount = new Map<string, Set<string>>();
  for (const t of tasks) {
    const status = statusMap.get(t.status_id);
    const category = status?.category || "todo";
    const isCompleted = category === "done" || category === "completed";
    const isOverdue = !isCompleted && t.due_date ? new Date(t.due_date) < now : false;
    const est = t.estimate_minutes || 0;

    totalEstimatedMinutes += est;
    if (isCompleted) completedTasks++;
    else if (category === "in_progress") inProgressTasks++;
    if (isOverdue) overdueTasks++;

    const pStat = projectStats.get(t.project_id);
    if (pStat) {
      pStat.total++;
      if (isCompleted) pStat.completed++;
      if (isOverdue) pStat.overdue++;
    }

    const assignees = [t.primary_assignee_id, t.secondary_assignee_id].filter(Boolean) as string[];
    for (const uid of assignees) {
      if (!memberProjectCount.has(uid)) memberProjectCount.set(uid, new Set());
      memberProjectCount.get(uid)!.add(t.project_id);
    }
  }

  // Cross-project dependencies
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const projectNameMap = new Map(targetProjects.map((p) => [p.id, p.name]));
  const crossProjectDeps: PortfolioBrainPayload["crossProjectDependencies"] = [];

  for (const d of deps || []) {
    const blocked = taskMap.get(d.task_id);
    const blocker = taskMap.get(d.linked_task_id);
    if (blocked && blocker && blocked.project_id !== blocker.project_id) {
      crossProjectDeps.push({
        blockingProject: projectNameMap.get(blocker.project_id) || "External Project",
        blockingTask: blocker.title,
        blockedProject: projectNameMap.get(blocked.project_id) || "Target Project",
        blockedTask: blocked.title,
      });
    }
  }

  // Map workload engine results to PortfolioMemberWorkload
  const workloads: PortfolioMemberWorkload[] = workloadEngineResult.members
    .filter((m) => m.assignedTasksCount > 0 || profileInputs.length <= 6)
    .map((m) => {
      const projSet = memberProjectCount.get(m.userId);
      return {
        userId: m.userId,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatarUrl,
        role: m.role,
        experienceLevel: m.experienceLevel,
        experienceFactor: m.experienceFactor,
        totalTasks: m.assignedTasksCount,
        unestimatedTasksCount: m.unestimatedTasksCount,
        confidence: m.confidence,
        confidenceReason: m.confidenceReason,
        totalEstimatedHours: m.estimatedWorkloadHours,
        rawCapacityHours: m.rawCapacityHours,
        effectiveCapacityHours: m.effectiveCapacityHours,
        utilizationPercentage: m.utilizationPercentage,
        overdueTasks: m.taskBreakdown.filter((t) => t.isOverdue).length,
        projectCount: projSet ? projSet.size : 1,
        status: m.status,
        statusLabel: m.statusLabel,
        explanation: m.explanation,
        potentialRedistribution: m.potentialRedistribution,
      };
    });

  // Overall Health Score
  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const overduePercentage = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  let overallScore = 100;
  if (totalTasks > 0) {
    overallScore = Math.max(
      20,
      Math.min(
        100,
        Math.round(
          completionPercentage * 0.4 +
            (100 - overduePercentage * 2.5) * 0.4 +
            (crossProjectDeps.length === 0 ? 20 : 10)
        )
      )
    );
  }

  const overallStatus =
    overallScore >= 80 ? "healthy" : overallScore >= 60 ? "needs_attention" : overallScore >= 40 ? "at_risk" : "critical";

  // Synthesize AI Executive Summary
  const prompt = `You are a Chief Technology Officer and Portfolio Director.
Synthesize an executive intelligence brief for Workspace: "${workspace.name}".

METRICS:
- Total Projects in Scope: ${targetProjects.length}
- Total Tasks Analyzed: ${totalTasks}
- Completed: ${completedTasks} (${completionPercentage}%)
- Overdue: ${overdueTasks} (${overduePercentage}%)
- Cross-Project Blocking Dependencies: ${crossProjectDeps.length}
- Overloaded Team Members: ${workloads.filter((w) => w.status === "over_capacity" || w.status === "severely_overloaded").length}

Provide a concise 3-part JSON output:
{
  "headline": "A sharp 1-sentence executive summary headline",
  "summary": "2-3 sentences synthesizing velocity, delivery bottlenecks, and portfolio trajectory.",
  "recommendations": [
    "Concrete actionable recommendation 1",
    "Concrete actionable recommendation 2",
    "Concrete actionable recommendation 3"
  ]
}
Return only JSON.`;

  let aiExecutiveSummary = {
    headline: `Workspace Portfolio Health: ${overallScore}/100 (${overallStatus.replace("_", " ").toUpperCase()})`,
    summary: `${workspace.name} has ${targetProjects.length} projects with ${totalTasks} tasks. Overall delivery velocity is at ${completionPercentage}% completion with ${overdueTasks} overdue items.`,
    recommendations: [
      "Prioritize overdue critical path items before beginning new sprint initiatives.",
      "Rebalance tasks for team members working concurrently across multiple projects.",
      "Review cross-project dependencies to prevent downstream blockage.",
    ],
  };

  try {
    const aiResp = await generateTextWithFallback({
      prompt,
      temperature: 0.1,
      maxOutputTokens: 1000,
    });
    const parsed = JSON.parse(aiResp.text.replace(/```json/g, "").replace(/```/g, "").trim());
    if (parsed.headline && parsed.summary) {
      aiExecutiveSummary = parsed;
    }
  } catch (aiErr) {
    console.warn("AI synthesis fallback for portfolio brain:", aiErr);
  }

  const categoryScores: Record<string, HealthCategoryScore> = {
    schedule: {
      key: "schedule",
      label: "Timeline & Velocity",
      score: Math.max(30, 100 - overduePercentage * 3),
      status: overduePercentage > 25 ? "danger" : overduePercentage > 10 ? "warning" : "good",
      details: `${overdueTasks} overdue tasks across portfolio`,
      metricLabel: `${completionPercentage}% Completed`,
    },
    tasks: {
      key: "tasks",
      label: "Backlog Delivery",
      score: completionPercentage,
      status: completionPercentage >= 70 ? "good" : completionPercentage >= 40 ? "warning" : "danger",
      details: `${completedTasks} of ${totalTasks} tasks finished`,
      metricLabel: `${totalTasks} Total Tasks`,
    },
    dependencies: {
      key: "dependencies",
      label: "Cross-Project Alignment",
      score: crossProjectDeps.length === 0 ? 100 : Math.max(30, 100 - crossProjectDeps.length * 20),
      status: crossProjectDeps.length > 2 ? "danger" : crossProjectDeps.length > 0 ? "warning" : "good",
      details: `${crossProjectDeps.length} cross-project dependencies detected`,
      metricLabel: `${crossProjectDeps.length} Bottlenecks`,
    },
    workload: {
      key: "workload",
      label: "Resource Allocation",
      score: workloads.some((w) => w.status === "over_capacity" || w.status === "severely_overloaded") ? 55 : 90,
      status: workloads.some((w) => w.status === "over_capacity" || w.status === "severely_overloaded") ? "warning" : "good",
      details: `${workloads.filter((w) => w.status === "over_capacity" || w.status === "severely_overloaded").length} members over capacity`,
      metricLabel: `${workloads.length} Active Members`,
    },
    blockers: {
      key: "blockers",
      label: "Delivery Risks",
      score: overdueTasks === 0 ? 100 : Math.max(40, 100 - overdueTasks * 10),
      status: overdueTasks > 5 ? "danger" : overdueTasks > 0 ? "warning" : "good",
      details: `${overdueTasks} critical deadline slips`,
      metricLabel: `${overdueTasks} Risks`,
    },
    risks: {
      key: "risks",
      label: "Portfolio Risk",
      score: overallScore,
      status: overallScore >= 70 ? "good" : overallScore >= 50 ? "warning" : "danger",
      details: `Calculated from ${targetProjects.length} projects`,
      metricLabel: `${targetProjects.length} Projects`,
    },
    milestones: {
      key: "milestones",
      label: "Milestone Attainment",
      score: completionPercentage,
      status: completionPercentage >= 60 ? "good" : "warning",
      details: `${completedTasks} items landed`,
      metricLabel: `${completionPercentage}%`,
    },
  };

  const health: ProjectHealthBreakdown = {
    overallScore,
    overallStatus,
    statusLabel: overallStatus.replace("_", " ").toUpperCase(),
    headlineExplanation: aiExecutiveSummary.headline,
    categories: categoryScores as any,
    calculatedAt: new Date().toISOString(),
  };

  // Build Portfolio Projects Info
  const portfolioProjects: PortfolioProjectInfo[] = targetProjects.map((p) => {
    const st = projectStats.get(p.id) || { total: 0, completed: 0, overdue: 0 };
    const pScore = st.total > 0 ? Math.max(30, Math.min(100, Math.round((st.completed / st.total) * 60 + (1 - st.overdue / st.total) * 40))) : 100;
    return {
      id: p.id,
      name: p.name,
      description: p.description || "",
      status: p.status,
      priority: p.priority,
      due_date: p.due_date,
      taskCount: st.total,
      completedTaskCount: st.completed,
      overdueTaskCount: st.overdue,
      healthScore: pScore,
    };
  });

  // Generate Risks
  const risks: PortfolioBrainPayload["risks"] = [];
  if (overdueTasks > 0) {
    risks.push({
      id: "risk-overdue",
      title: `${overdueTasks} Overdue Portfolio Deliverables`,
      severity: overdueTasks > 10 ? "critical" : "high",
      reason: `Slipped delivery commitments in active sprints are accumulating schedule variance.`,
    });
  }
  for (const m of workloads.filter((w) => w.status === "over_capacity" || w.status === "severely_overloaded")) {
    risks.push({
      id: `risk-workload-${m.userId}`,
      title: `Resource Overallocation: ${m.name} (${m.utilizationPercentage}% load)`,
      severity: m.status === "severely_overloaded" ? "critical" : "high",
      reason: `${m.name} has ${m.totalEstimatedHours}h of estimated work against ${m.effectiveCapacityHours}h effective capacity.`,
    });
  }

  // Generate Recommendations
  const recs: PortfolioBrainPayload["recommendations"] = [];
  for (const m of workloads) {
    if (m.potentialRedistribution && m.potentialRedistribution.recommended) {
      recs.push({
        id: `rec-${m.userId}`,
        title: `Rebalance workload: Shift work from ${m.name}`,
        description: m.potentialRedistribution.reason,
        category: "workload",
        expectedBenefit: `Prevents burn-out and levels contributor utilization across the sprint.`,
      });
    }
  }

  // Generate Timeline
  const timeline: PortfolioBrainPayload["timeline"] = targetProjects
    .filter((p) => p.due_date)
    .map((p) => ({
      id: `timeline-${p.id}`,
      title: `${p.name} Final Milestone`,
      date: p.due_date!,
      type: "deadline",
      projectName: p.name,
    }));

  return {
    scopeType: "workspace",
    scopeId: workspaceId,
    scopeName: workspace.name,
    availableProjects,
    activeFilter: filter || {},
    health,
    portfolioProjects,
    workload: workloads,
    crossProjectDependencies: crossProjectDeps,
    aiExecutiveSummary,
    metrics: {
      totalProjects: targetProjects.length,
      totalTasks,
      completedTasks,
      overdueTasks,
      inProgressTasks,
      totalEstimatedHours: Math.round(totalEstimatedMinutes / 60),
      completionPercentage,
    },
    risks,
    recommendations: recs,
    timeline,
  };
}

export async function buildOrganizationBrain(
  organizationId: string,
  userId: string,
  filter?: TaskCatalogFilter
): Promise<PortfolioBrainPayload> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  // Fetch all workspaces in organization
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("organization_id", organizationId);

  const workspaceIds = (workspaces || []).map((w) => w.id);

  // Fetch all projects across all workspaces
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, status, priority, due_date, workspace_id")
    .in("workspace_id", workspaceIds.length > 0 ? workspaceIds : ["00000000-0000-0000-0000-000000000000"]);

  const projectsList = projects || [];
  const availableProjects = projectsList.map((p) => ({ id: p.id, name: p.name }));

  const targetProjects =
    filter?.selectedProjectIds && filter.selectedProjectIds.length > 0
      ? projectsList.filter((p) => filter.selectedProjectIds!.includes(p.id))
      : projectsList;

  const targetProjectIds = targetProjects.map((p) => p.id);

  // Fetch tasks
  let tasksQuery = supabase
    .from("tasks")
    .select(
      "id, project_id, generated_key, title, priority, status_id, due_date, estimate_minutes, primary_assignee_id, secondary_assignee_id, parent_task_id, task_type"
    )
    .in("project_id", targetProjectIds.length > 0 ? targetProjectIds : ["00000000-0000-0000-0000-000000000000"]);

  if (filter?.priorities && filter.priorities.length > 0) {
    tasksQuery = tasksQuery.in("priority", filter.priorities);
  }

  const { data: allTasks } = await tasksQuery;
  const tasks = allTasks || [];

  const { data: statuses } = await supabase
    .from("task_statuses")
    .select("id, name, category, project_id");
  const statusMap = new Map((statuses || []).map((s) => [s.id, s]));

  // Profiles with display_name
  const { data: rawProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url");

  const profileMap = new Map(
    (rawProfiles || []).map((p) => {
      const cleanName = p.display_name?.trim() || p.email?.split("@")[0] || "Team Member";
      return [p.id, { id: p.id, name: cleanName, email: p.email || "", avatarUrl: p.avatar_url }];
    })
  );

  // Fetch dependencies across organization projects
  const { data: deps } = await supabase
    .from("task_dependencies")
    .select("task_id, linked_task_id, relation");

  // Collect assignees
  const assigneeUserIds = new Set<string>();
  for (const t of tasks) {
    if (t.primary_assignee_id) assigneeUserIds.add(t.primary_assignee_id);
    if (t.secondary_assignee_id) assigneeUserIds.add(t.secondary_assignee_id);
  }

  const profileInputs: MemberProfileInput[] = [];
  for (const uid of assigneeUserIds) {
    const prof = profileMap.get(uid);
    profileInputs.push({
      userId: uid,
      name: prof?.name || "Team Member",
      email: prof?.email || "",
      avatarUrl: prof?.avatarUrl || null,
      role: "Software Engineer",
      rawCapacityHours: 40,
    });
  }

  const taskInputs: TaskWorkloadInput[] = tasks.map((t) => {
    const s = statusMap.get(t.status_id);
    const isCompleted = s?.category === "done" || s?.category === "completed" || s?.category === "cancelled";
    return {
      id: t.id,
      title: t.title,
      estimateMinutes: t.estimate_minutes,
      priority: (t.priority as any) || "normal",
      dueDate: t.due_date,
      primaryAssigneeId: t.primary_assignee_id,
      secondaryAssigneeId: t.secondary_assignee_id,
      category: t.task_type || s?.category,
      isCompleted,
      parentTaskId: t.parent_task_id,
    };
  });

  const workloadEngineResult = calculateWorkload(profileInputs, taskInputs);

  const now = new Date();
  let completedTasks = 0;
  let overdueTasks = 0;
  let inProgressTasks = 0;
  let totalEstimatedMinutes = 0;

  for (const t of tasks) {
    const status = statusMap.get(t.status_id);
    const category = status?.category || "todo";
    const isCompleted = category === "done" || category === "completed";
    const isOverdue = !isCompleted && t.due_date ? new Date(t.due_date) < now : false;
    const est = t.estimate_minutes || 0;

    totalEstimatedMinutes += est;
    if (isCompleted) completedTasks++;
    else if (category === "in_progress") inProgressTasks++;
    if (isOverdue) overdueTasks++;
  }

  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const overduePercentage = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  const overallScore = totalTasks > 0 ? Math.max(30, Math.min(100, Math.round(completionPercentage * 0.5 + (100 - overduePercentage * 2) * 0.5))) : 100;
  const overallStatus =
    overallScore >= 80 ? "healthy" : overallScore >= 60 ? "needs_attention" : overallScore >= 40 ? "at_risk" : "critical";

  const orgWorkloads: PortfolioMemberWorkload[] = workloadEngineResult.members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatarUrl,
    role: m.role,
    experienceLevel: m.experienceLevel,
    experienceFactor: m.experienceFactor,
    totalTasks: m.assignedTasksCount,
    unestimatedTasksCount: m.unestimatedTasksCount,
    confidence: m.confidence,
    confidenceReason: m.confidenceReason,
    totalEstimatedHours: m.estimatedWorkloadHours,
    rawCapacityHours: m.rawCapacityHours,
    effectiveCapacityHours: m.effectiveCapacityHours,
    utilizationPercentage: m.utilizationPercentage,
    overdueTasks: m.taskBreakdown.filter((t) => t.isOverdue).length,
    projectCount: 1,
    status: m.status,
    statusLabel: m.statusLabel,
    explanation: m.explanation,
    potentialRedistribution: m.potentialRedistribution,
  }));

  // Cross-project dependencies
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const projectNameMap = new Map(targetProjects.map((p) => [p.id, p.name]));
  const crossProjectDeps: PortfolioBrainPayload["crossProjectDependencies"] = [];

  for (const d of deps || []) {
    const blocked = taskMap.get(d.task_id);
    const blocker = taskMap.get(d.linked_task_id);
    if (blocked && blocker && blocked.project_id !== blocker.project_id) {
      crossProjectDeps.push({
        blockingProject: projectNameMap.get(blocker.project_id) || "External Project",
        blockingTask: blocker.title,
        blockedProject: projectNameMap.get(blocked.project_id) || "Target Project",
        blockedTask: blocked.title,
      });
    }
  }

  // Generate Risks
  const risks: PortfolioBrainPayload["risks"] = [];
  if (overdueTasks > 0) {
    risks.push({
      id: "risk-overdue",
      title: `${overdueTasks} Overdue Organization Deliverables`,
      severity: overdueTasks > 10 ? "critical" : "high",
      reason: `Slipped delivery commitments across business units are impacting enterprise milestones.`,
    });
  }
  for (const m of orgWorkloads.filter((w) => w.status === "over_capacity" || w.status === "severely_overloaded")) {
    risks.push({
      id: `risk-workload-${m.userId}`,
      title: `Resource Overallocation: ${m.name} (${m.utilizationPercentage}% load)`,
      severity: m.status === "severely_overloaded" ? "critical" : "high",
      reason: `${m.name} has ${m.totalEstimatedHours}h of estimated work against ${m.effectiveCapacityHours}h effective capacity.`,
    });
  }

  // Generate Recommendations
  const recs: PortfolioBrainPayload["recommendations"] = [];
  for (const m of orgWorkloads) {
    if (m.potentialRedistribution && m.potentialRedistribution.recommended) {
      recs.push({
        id: `rec-${m.userId}`,
        title: `Rebalance workload: Shift work from ${m.name}`,
        description: m.potentialRedistribution.reason,
        category: "workload",
        expectedBenefit: `Prevents burn-out and levels contributor utilization across organization teams.`,
      });
    }
  }

  // Generate Timeline
  const timeline: PortfolioBrainPayload["timeline"] = targetProjects
    .filter((p) => p.due_date)
    .map((p) => ({
      id: `timeline-${p.id}`,
      title: `${p.name} Final Milestone`,
      date: p.due_date!,
      type: "deadline",
      projectName: p.name,
    }));

  return {
    scopeType: "organization",
    scopeId: organizationId,
    scopeName: org.name,
    availableProjects,
    activeFilter: filter || {},
    health: {
      overallScore,
      overallStatus,
      statusLabel: overallStatus.replace("_", " ").toUpperCase(),
      headlineExplanation: `Enterprise Portfolio Governance for ${org.name}: ${targetProjects.length} projects analyzed.`,
      categories: {
        schedule: {
          key: "schedule",
          label: "Schedule Alignment",
          score: Math.max(0, 100 - overduePercentage * 3),
          status: overduePercentage > 15 ? "danger" : overduePercentage > 5 ? "warning" : "good",
          metricLabel: `${overdueTasks} overdue deliverables`,
          details: `Across ${targetProjects.length} enterprise projects, ${overdueTasks} tasks have exceeded their due dates.`,
        },
        completion: {
          key: "completion",
          label: "Deliverables Completion",
          score: completionPercentage,
          status: completionPercentage >= 75 ? "good" : completionPercentage >= 40 ? "warning" : "danger",
          metricLabel: `${completionPercentage}% delivered (${completedTasks}/${totalTasks})`,
          details: `${completedTasks} of ${totalTasks} total portfolio work packages completed.`,
        },
        workload: {
          key: "workload",
          label: "Workload & Capacity",
          score: Math.max(30, Math.min(100, 100 - orgWorkloads.filter((w) => w.status === "over_capacity" || w.status === "severely_overloaded").length * 20)),
          status: orgWorkloads.some((w) => w.status === "severely_overloaded") ? "danger" : orgWorkloads.some((w) => w.status === "over_capacity") ? "warning" : "good",
          metricLabel: `${orgWorkloads.filter((w) => w.status === "over_capacity" || w.status === "severely_overloaded").length} overloaded members`,
          details: `Calculated from total estimated hours vs available member capacity across enterprise projects.`,
        },
        dependencies: {
          key: "dependencies",
          label: "Cross-Project Dependencies",
          score: crossProjectDeps.length === 0 ? 100 : Math.max(40, 100 - crossProjectDeps.length * 15),
          status: crossProjectDeps.length > 3 ? "danger" : crossProjectDeps.length > 0 ? "warning" : "good",
          metricLabel: `${crossProjectDeps.length} blocking links`,
          details: `${crossProjectDeps.length} cross-project dependencies detected between teams.`,
        },
      } as any,
      calculatedAt: new Date().toISOString(),
    },
    portfolioProjects: targetProjects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      status: p.status,
      priority: p.priority,
      due_date: p.due_date,
      taskCount: tasks.filter((t) => t.project_id === p.id).length,
      completedTaskCount: tasks.filter((t) => t.project_id === p.id && statusMap.get(t.status_id)?.category === "done").length,
      overdueTaskCount: tasks.filter((t) => t.project_id === p.id && t.due_date && new Date(t.due_date) < now && statusMap.get(t.status_id)?.category !== "done").length,
      healthScore: 85,
    })),
    workload: orgWorkloads,
    crossProjectDependencies: crossProjectDeps,
    aiExecutiveSummary: {
      headline: `Organization Enterprise Health: ${overallScore}/100`,
      summary: `${org.name} has ${workspaces?.length || 0} active workspaces and ${targetProjects.length} projects currently tracked in the enterprise portfolio catalog.`,
      recommendations: [
        "Align cross-department sprint cadences to ensure milestone synchronization.",
        "Review project priorities across business units to optimize engineering throughput.",
      ],
    },
    metrics: {
      totalProjects: targetProjects.length,
      totalTasks,
      completedTasks,
      overdueTasks,
      inProgressTasks,
      totalEstimatedHours: Math.round(totalEstimatedMinutes / 60),
      completionPercentage,
    },
    risks,
    recommendations: recs,
    timeline,
  };
}
