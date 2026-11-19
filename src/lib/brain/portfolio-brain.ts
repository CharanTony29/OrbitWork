// src/lib/brain/portfolio-brain.ts
// Multi-Project Portfolio Intelligence for Workspace Brain and Organization Brain

import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client";
import type {
  HealthCategoryScore,
  ProjectHealthBreakdown,
  DependencyNodeInfo,
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
  avatarUrl?: string;
  totalTasks: number;
  totalEstimatedHours: number;
  overdueTasks: number;
  projectCount: number;
  status: "optimal" | "heavy" | "overloaded";
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
      "id, project_id, generated_key, title, priority, status_id, due_date, estimate_minutes, primary_assignee_id, secondary_assignee_id, parent_task_id"
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

  // Fetch profiles for workload calculation
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url");

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Fetch dependencies across target projects
  const { data: deps } = await supabase
    .from("task_dependencies")
    .select("id, task_id, depends_on_task_id");

  // Calculate metrics
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

  const memberStats = new Map<
    string,
    {
      name: string;
      email: string;
      avatarUrl?: string;
      tasks: number;
      minutes: number;
      overdue: number;
      projectSet: Set<string>;
    }
  >();

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const t of tasks) {
    const status = statusMap.get(t.status_id);
    const category = status?.category || "todo";
    const isCompleted = category === "done";
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

    // Assignee stats
    const assignees = [t.primary_assignee_id, t.secondary_assignee_id].filter(Boolean) as string[];
    for (const uid of assignees) {
      if (!memberStats.has(uid)) {
        const prof = profileMap.get(uid);
        memberStats.set(uid, {
          name: prof?.full_name || "Team Member",
          email: prof?.email || "",
          avatarUrl: prof?.avatar_url || undefined,
          tasks: 0,
          minutes: 0,
          overdue: 0,
          projectSet: new Set(),
        });
      }
      const m = memberStats.get(uid)!;
      m.tasks++;
      m.minutes += est;
      if (isOverdue) m.overdue++;
      m.projectSet.add(t.project_id);
    }
  }

  // Cross-project dependencies
  const projectNameMap = new Map(targetProjects.map((p) => [p.id, p.name]));
  const crossProjectDeps: PortfolioBrainPayload["crossProjectDependencies"] = [];

  for (const d of deps || []) {
    const blocked = taskMap.get(d.task_id);
    const blocker = taskMap.get(d.depends_on_task_id);
    if (blocked && blocker && blocked.project_id !== blocker.project_id) {
      crossProjectDeps.push({
        blockingProject: projectNameMap.get(blocker.project_id) || "External Project",
        blockingTask: blocker.title,
        blockedProject: projectNameMap.get(blocked.project_id) || "Target Project",
        blockedTask: blocked.title,
      });
    }
  }

  // Calculate overall portfolio health
  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const overduePercentage = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  let overallScore = 100;
  if (totalTasks > 0) {
    overallScore = Math.max(
      20,
      Math.min(100, Math.round(completionPercentage * 0.4 + (100 - overduePercentage * 2.5) * 0.4 + (crossProjectDeps.length === 0 ? 20 : 10)))
    );
  }

  const overallStatus =
    overallScore >= 80 ? "healthy" : overallScore >= 60 ? "needs_attention" : overallScore >= 40 ? "at_risk" : "critical";

  // Build Portfolio Member Workloads
  const workloads: PortfolioMemberWorkload[] = [];
  for (const [uid, m] of memberStats) {
    const hours = Math.round(m.minutes / 60);
    const status: PortfolioMemberWorkload["status"] =
      hours > 45 || m.tasks > 12 ? "overloaded" : hours > 30 || m.tasks > 8 ? "heavy" : "optimal";

    workloads.push({
      userId: uid,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl,
      totalTasks: m.tasks,
      totalEstimatedHours: hours,
      overdueTasks: m.overdue,
      projectCount: m.projectSet.size,
      status,
    });
  }

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

  // Synthesize AI Executive Summary
  const prompt = `You are a Chief Technology Officer and Portfolio Director.
Synthesize an executive intelligence brief for Workspace: "${workspace.name}".

METRICS:
- Total Projects in Scope: ${targetProjects.length}
- Total Tasks Analyzed: ${totalTasks}
- Completed: ${completedTasks} (${completionPercentage}%)
- Overdue: ${overdueTasks} (${overduePercentage}%)
- Cross-Project Blocking Dependencies: ${crossProjectDeps.length}
- Overloaded Team Members: ${workloads.filter((w) => w.status === "overloaded").length}

Provide a concise 3-part JSON output:
{
  "headline": "A sharp 1-sentence executive summary headline",
  "summary": "2-3 sentences synthesizing current velocity, delivery bottlenecks, and portfolio trajectory.",
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
      score: workloads.some((w) => w.status === "overloaded") ? 55 : 90,
      status: workloads.some((w) => w.status === "overloaded") ? "warning" : "good",
      details: `${workloads.filter((w) => w.status === "overloaded").length} members overloaded across projects`,
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
      "id, project_id, generated_key, title, priority, status_id, due_date, estimate_minutes, primary_assignee_id, secondary_assignee_id"
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

  const now = new Date();
  let completedTasks = 0;
  let overdueTasks = 0;
  let inProgressTasks = 0;
  let totalEstimatedMinutes = 0;

  for (const t of tasks) {
    const status = statusMap.get(t.status_id);
    const category = status?.category || "todo";
    const isCompleted = category === "done";
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
      categories: {} as any,
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
    workload: [],
    crossProjectDependencies: [],
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
  };
}
