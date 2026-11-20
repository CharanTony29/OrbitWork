// src/lib/brain/analytics.ts
// Deterministic Intelligence Engine for Orbitwork Project Brain

import { calculateWorkload, MemberProfileInput, TaskWorkloadInput } from "@/lib/workload/engine";
import type {
  ActionableRecommendation,
  AnalyticsContext,
  ChangeImpactResult,
  ChangeSimulationInput,
  DependencyAnalysis,
  DependencyChainNode,
  DependencyNodeInfo,
  HealthCategoryKey,
  HealthCategoryScore,
  HealthStatusLevel,
  MemberWorkloadInfo,
  ProjectDecision,
  ProjectHealthBreakdown,
  RawActivityEvent,
  RawDependencyItem,
  RawDocumentItem,
  RawGoalItem,
  RawProfileItem,
  RawStatusItem,
  RawTaskItem,
  RiskItem,
  SmartGraphEdge,
  SmartGraphNode,
  SmartProjectGraph,
  TimelineEvent,
  TodayProjectBrief,
  WhyAtRiskExplanation,
  WorkloadAnalysis,
} from "./types.ts";


/**
 * Builds a fast lookup mapping for profiles and statuses
 */
export function buildProfileMap(profiles: RawProfileItem[]): Map<string, { id: string; name: string; email: string; avatarUrl: string | null }> {
  const map = new Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>();
  for (const p of profiles) {
    const rawName = p.display_name?.trim() || p.email?.split("@")[0] || "Team Member";
    map.set(p.id, {
      id: p.id,
      name: rawName,
      email: p.email || "",
      avatarUrl: p.avatar_url,
    });
  }
  return map;
}

export function buildStatusMap(statuses: RawStatusItem[]): Map<string, RawStatusItem> {
  const map = new Map<string, RawStatusItem>();
  for (const s of statuses) {
    map.set(s.id, s);
  }
  return map;
}

/**
 * Extract all assignees for a task
 */
export function getTaskAssigneeIds(
  task: RawTaskItem,
  taskAssigneesMap: Map<string, Set<string>>
): string[] {
  const set = new Set<string>();
  if (task.primary_assignee_id) set.add(task.primary_assignee_id);
  if (task.secondary_assignee_id) set.add(task.secondary_assignee_id);
  const extra = taskAssigneesMap.get(task.id);
  if (extra) {
    for (const uid of extra) set.add(uid);
  }
  return [...set];
}

/**
 * Dependency Graph Analysis (Cycle Detection, Fan-out, Chain Traversal)
 */
export function analyzeDependencies(ctx: AnalyticsContext): DependencyAnalysis {
  const statusMap = buildStatusMap(ctx.statuses);
  const profileMap = buildProfileMap(ctx.profiles);

  const taskAssigneesMap = new Map<string, Set<string>>();
  for (const a of ctx.taskAssignees) {
    if (!taskAssigneesMap.has(a.task_id)) taskAssigneesMap.set(a.task_id, new Set());
    taskAssigneesMap.get(a.task_id)!.add(a.user_id);
  }

  const taskMap = new Map<string, RawTaskItem>();
  for (const t of ctx.tasks) taskMap.set(t.id, t);

  const todayStr = new Date().toISOString().split("T")[0];

  const toNodeInfo = (t: RawTaskItem): DependencyNodeInfo => {
    const s = statusMap.get(t.status_id);
    const uids = getTaskAssigneeIds(t, taskAssigneesMap);
    const assignees = uids.map((uid) => profileMap.get(uid)?.name || "Unassigned");
    const dStr = t.due_date ? String(t.due_date).split("T")[0] : null;
    const isCompleted = s?.category === "completed" || s?.category === "cancelled";
    return {
      taskId: t.id,
      taskKey: t.generated_key || t.id.slice(0, 8),
      title: t.title,
      statusName: s?.name || "To Do",
      statusCategory: s?.category || "active",
      priority: t.priority || "normal",
      dueDate: dStr,
      isOverdue: Boolean(dStr && dStr < todayStr && !isCompleted),
      assignees: assignees.length ? assignees : ["Unassigned"],
    };
  };

  // Build Adjacency List for dependencies
  // relation === 'blocks': task_id blocks linked_task_id
  // relation === 'blocked_by': task_id is blocked by linked_task_id -> (linked_task_id blocks task_id)
  const blocksMap = new Map<string, Set<string>>(); // blockerId -> Set of blockedIds
  const blockedByMap = new Map<string, Set<string>>(); // blockedId -> Set of blockerIds

  for (const dep of ctx.dependencies) {
    let blockerId = "";
    let blockedId = "";

    if (dep.relation === "blocks") {
      blockerId = dep.task_id;
      blockedId = dep.linked_task_id;
    } else if (dep.relation === "blocked_by") {
      blockerId = dep.linked_task_id;
      blockedId = dep.task_id;
    }

    if (blockerId && blockedId && taskMap.has(blockerId) && taskMap.has(blockedId)) {
      if (!blocksMap.has(blockerId)) blocksMap.set(blockerId, new Set());
      blocksMap.get(blockerId)!.add(blockedId);

      if (!blockedByMap.has(blockedId)) blockedByMap.set(blockedId, new Set());
      blockedByMap.get(blockedId)!.add(blockerId);
    }
  }

  // Detect Circular Dependencies using DFS
  const circularChains: string[][] = [];
  const visited = new Map<string, "visiting" | "visited">();
  const path: string[] = [];

  const dfsCycle = (nodeId: string) => {
    visited.set(nodeId, "visiting");
    path.push(nodeId);

    const neighbors = blocksMap.get(nodeId);
    if (neighbors) {
      for (const n of neighbors) {
        if (visited.get(n) === "visiting") {
          const cycleStart = path.indexOf(n);
          const cycle = path.slice(cycleStart).map((id) => taskMap.get(id)?.title || id);
          cycle.push(taskMap.get(n)?.title || n);
          circularChains.push(cycle);
        } else if (!visited.has(n)) {
          dfsCycle(n);
        }
      }
    }

    path.pop();
    visited.set(nodeId, "visited");
  };

  for (const taskId of taskMap.keys()) {
    if (!visited.has(taskId)) {
      dfsCycle(taskId);
    }
  }

  // Identify Active Blockers (only non-completed blockers matter!)
  const blockedTasks: Array<{ task: DependencyNodeInfo; blockedBy: DependencyNodeInfo[] }> = [];
  for (const [blockedId, blockerIds] of blockedByMap.entries()) {
    const blockedRaw = taskMap.get(blockedId);
    if (!blockedRaw) continue;
    const blockedStatus = statusMap.get(blockedRaw.status_id);
    if (blockedStatus?.category === "completed" || blockedStatus?.category === "cancelled") {
      continue;
    }

    const activeBlockers: DependencyNodeInfo[] = [];
    for (const bId of blockerIds) {
      const bRaw = taskMap.get(bId);
      if (!bRaw) continue;
      const bStatus = statusMap.get(bRaw.status_id);
      if (bStatus?.category !== "completed" && bStatus?.category !== "cancelled") {
        activeBlockers.push(toNodeInfo(bRaw));
      }
    }

    if (activeBlockers.length > 0) {
      blockedTasks.push({
        task: toNodeInfo(blockedRaw),
        blockedBy: activeBlockers,
      });
    }
  }

  const blockingTasks: Array<{ task: DependencyNodeInfo; blocksCount: number; blockedTasks: DependencyNodeInfo[] }> = [];
  let overdueDepsCount = 0;

  for (const [blockerId, blockedSet] of blocksMap.entries()) {
    const blockerRaw = taskMap.get(blockerId);
    if (!blockerRaw) continue;
    const blockerStatus = statusMap.get(blockerRaw.status_id);
    if (blockerStatus?.category === "completed" || blockerStatus?.category === "cancelled") {
      continue;
    }

    const activeBlockedList: DependencyNodeInfo[] = [];
    for (const bId of blockedSet) {
      const bRaw = taskMap.get(bId);
      if (!bRaw) continue;
      const bStatus = statusMap.get(bRaw.status_id);
      if (bStatus?.category !== "completed" && bStatus?.category !== "cancelled") {
        activeBlockedList.push(toNodeInfo(bRaw));
      }
    }

    if (activeBlockedList.length > 0) {
      const blockerInfo = toNodeInfo(blockerRaw);
      if (blockerInfo.isOverdue) overdueDepsCount += activeBlockedList.length;

      blockingTasks.push({
        task: blockerInfo,
        blocksCount: activeBlockedList.length,
        blockedTasks: activeBlockedList,
      });
    }
  }

  // Critical dependencies: blockers with high fan-out (>= 2) or overdue blockers
  const criticalDependencies: DependencyAnalysis["criticalDependencies"] = [];
  for (const item of blockingTasks) {
    if (item.task.isOverdue || item.blocksCount >= 2) {
      criticalDependencies.push({
        blockerTask: item.task,
        downstreamCount: item.blocksCount,
        isOverdue: item.task.isOverdue,
        reason: item.task.isOverdue
          ? `Overdue blocker delaying ${item.blocksCount} downstream task${item.blocksCount > 1 ? "s" : ""}`
          : `High-impact bottleneck blocking ${item.blocksCount} downstream tasks`,
      });
    }
  }

  // Build top-level dependency chains (trees) for visualization
  const buildChain = (nodeId: string, currentDepth: number, visitedInPath: Set<string>): DependencyChainNode | null => {
    if (currentDepth > 5 || visitedInPath.has(nodeId)) return null;
    const raw = taskMap.get(nodeId);
    if (!raw) return null;

    const newPath = new Set(visitedInPath);
    newPath.add(nodeId);

    const childrenNodes: DependencyChainNode[] = [];
    const directBlocked = blocksMap.get(nodeId);
    if (directBlocked) {
      for (const childId of directBlocked) {
        const cNode = buildChain(childId, currentDepth + 1, newPath);
        if (cNode) childrenNodes.push(cNode);
      }
    }

    return {
      task: toNodeInfo(raw),
      relation: "blocks",
      children: childrenNodes,
      depth: currentDepth,
    };
  };

  const topBlockers = blockingTasks
    .filter((bt) => !blockedByMap.has(bt.task.taskId)) // Root blockers
    .slice(0, 5);

  const dependencyChains: DependencyChainNode[] = [];
  for (const b of topBlockers) {
    const chain = buildChain(b.task.taskId, 0, new Set());
    if (chain) dependencyChains.push(chain);
  }

  return {
    blockedTaskCount: blockedTasks.length,
    blockingTaskCount: blockingTasks.length,
    blockedTasks,
    blockingTasks,
    criticalDependencies,
    dependencyChains,
    hasCircularDependencies: circularChains.length > 0,
    circularChains,
    overdueDependenciesCount: overdueDepsCount,
  };
}

/**
 * Workload Analysis across Project Team Members
 */
export function analyzeWorkload(ctx: AnalyticsContext): WorkloadAnalysis {
  const statusMap = buildStatusMap(ctx.statuses);
  const profileMap = buildProfileMap(ctx.profiles);

  const taskAssigneesMap = new Map<string, Set<string>>();
  for (const a of ctx.taskAssignees) {
    if (!taskAssigneesMap.has(a.task_id)) taskAssigneesMap.set(a.task_id, new Set());
    taskAssigneesMap.get(a.task_id)!.add(a.user_id);
  }

  // 1. Prepare Member Profiles for Workload Engine
  const profileInputs: MemberProfileInput[] = ctx.profiles.map((p) => {
    const rawName = p.display_name?.trim() || p.email?.split("@")[0] || "Team Member";
    return {
      userId: p.id,
      name: rawName,
      email: p.email || "",
      avatarUrl: p.avatar_url,
      role: "Software Engineer",
      rawCapacityHours: 40,
    };
  });

  // Ensure all known assignees exist in profiles
  for (const a of ctx.taskAssignees) {
    if (!profileInputs.some((p) => p.userId === a.user_id)) {
      profileInputs.push({
        userId: a.user_id,
        name: profileMap.get(a.user_id)?.name || "Team Member",
        email: profileMap.get(a.user_id)?.email || "",
        avatarUrl: profileMap.get(a.user_id)?.avatarUrl || null,
        rawCapacityHours: 40,
      });
    }
  }

  // 2. Prepare Tasks for Workload Engine
  const taskInputs: TaskWorkloadInput[] = ctx.tasks.map((t) => {
    const s = statusMap.get(t.status_id);
    const isCompleted = s?.category === "completed" || s?.category === "cancelled";
    const assignees = getTaskAssigneeIds(t, taskAssigneesMap);

    return {
      id: t.id,
      title: t.title,
      estimateMinutes: t.estimate_minutes,
      priority: (t.priority as any) || "normal",
      dueDate: t.due_date,
      primaryAssigneeId: assignees[0] || t.primary_assignee_id,
      secondaryAssigneeId: assignees[1] || t.secondary_assignee_id,
      category: t.task_type || s?.category,
      isCompleted,
      parentTaskId: t.parent_task_id,
    };
  });

  // 3. Execute Authoritative Workload Calculation
  const engineRes = calculateWorkload(profileInputs, taskInputs);

  // 4. Map to MemberWorkloadInfo format
  const members: MemberWorkloadInfo[] = engineRes.members.map((m) => {
    const legacyStatus: MemberWorkloadInfo["status"] =
      m.status === "over_capacity" || m.status === "severely_overloaded"
        ? "overloaded"
        : m.status === "healthy"
        ? "underutilized"
        : "balanced";

    const overdueCount = m.taskBreakdown.filter((t) => t.isOverdue).length;
    const criticalCount = m.taskBreakdown.filter((t) => t.priority === "urgent" || t.priority === "high").length;

    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl || null,
      activeTaskCount: m.assignedTasksCount,
      overdueTaskCount: overdueCount,
      criticalTaskCount: criticalCount,
      estimatedMinutesTotal: Math.round(m.estimatedWorkloadHours * 60),
      workloadPercentage: m.utilizationPercentage,
      status: legacyStatus,
      rawCapacityHours: m.rawCapacityHours,
      effectiveCapacityHours: m.effectiveCapacityHours,
      confidence: m.confidence,
      confidenceReason: m.confidenceReason,
      explanation: m.explanation,
      role: m.role,
      experienceLevel: m.experienceLevel,
      unestimatedTasksCount: m.unestimatedTasksCount,
      potentialRedistribution: m.potentialRedistribution
        ? {
            recommended: m.potentialRedistribution.recommended,
            reason: m.potentialRedistribution.reason,
            targetMemberId: m.potentialRedistribution.targetMemberId,
            targetMemberName: m.potentialRedistribution.targetMemberName,
            taskId: m.potentialRedistribution.taskId,
            taskTitle: m.potentialRedistribution.taskTitle,
          }
        : undefined,
      taskTitles: m.taskBreakdown.map((t) => t.title).slice(0, 5),
    };
  });

  // Sort overloaded first, then highest workload
  members.sort((a, b) => b.workloadPercentage - a.workloadPercentage);

  return {
    members,
    overloadedCount: engineRes.metrics.overloadedMembersCount,
    underutilizedCount: engineRes.metrics.underutilizedMembersCount,
    unassignedTaskCount: engineRes.metrics.unassignedTasksCount,
    recommendations: engineRes.metrics.recommendations,
  };
}

/**
 * Deterministic Project Health Calculator
 */
export function computeProjectHealth(
  ctx: AnalyticsContext,
  deps: DependencyAnalysis,
  workload: WorkloadAnalysis
): ProjectHealthBreakdown {
  const statusMap = buildStatusMap(ctx.statuses);
  const todayStr = new Date().toISOString().split("T")[0];

  const totalTasks = ctx.tasks.length;

  if (totalTasks === 0) {
    const emptyScore = 100;
    return {
      overallScore: emptyScore,
      overallStatus: "healthy",
      statusLabel: "Healthy (Empty)",
      headlineExplanation: "Project has no tasks yet. Add tasks or goals to begin intelligence tracking.",
      categories: {
        schedule: {
          key: "schedule",
          label: "Schedule",
          score: 100,
          status: "good",
          details: "No tasks scheduled.",
          metricLabel: "0 overdue",
        },
        tasks: {
          key: "tasks",
          label: "Task Completion",
          score: 100,
          status: "good",
          details: "No tasks created yet.",
          metricLabel: "0% complete",
        },
        dependencies: {
          key: "dependencies",
          label: "Dependencies",
          score: 100,
          status: "good",
          details: "No dependencies defined.",
          metricLabel: "0 blockers",
        },
        workload: {
          key: "workload",
          label: "Workload",
          score: 100,
          status: "good",
          details: "No workload assigned yet.",
          metricLabel: "Balanced",
        },
        blockers: {
          key: "blockers",
          label: "Blockers",
          score: 100,
          status: "good",
          details: "No active blockers.",
          metricLabel: "0 blocked",
        },
        risks: {
          key: "risks",
          label: "Risks",
          score: 100,
          status: "good",
          details: "No risks detected.",
          metricLabel: "Low risk",
        },
        milestones: {
          key: "milestones",
          label: "Milestones",
          score: 100,
          status: "good",
          details: "No milestones defined.",
          metricLabel: "0 milestones",
        },
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  // 1. Task Execution & Completion Score
  const completedTasks = ctx.tasks.filter((t) => {
    const s = statusMap.get(t.status_id);
    return s?.category === "completed";
  }).length;

  // 2. Schedule Score & Active Tasks
  const activeTasks = ctx.tasks.filter((t) => {
    const s = statusMap.get(t.status_id);
    return s?.category !== "completed" && s?.category !== "cancelled";
  });
  const overdueTasks = activeTasks.filter((t) => {
    const d = t.due_date ? String(t.due_date).split("T")[0] : null;
    return Boolean(d && d < todayStr);
  });
  const overdueRatio = activeTasks.length > 0 ? overdueTasks.length / activeTasks.length : 0;

  const completionRatio = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  // Non-overdue active tasks represent deliverables progressing smoothly on schedule
  const onScheduleActiveTasks = Math.max(0, activeTasks.length - overdueTasks.length);
  const healthyExecutionRatio = totalTasks > 0 ? (completedTasks + onScheduleActiveTasks) / totalTasks : 1;
  const overduePenaltyRatio = activeTasks.length > 0 ? (overdueTasks.length / activeTasks.length) * 50 : 0;

  const taskCompletionScore = Math.min(
    100,
    Math.max(
      20,
      Math.round(55 + healthyExecutionRatio * 35 + completionRatio * 0.1 - overduePenaltyRatio)
    )
  );

  // Check project deadline
  let projectDeadlineOverdue = false;
  if (ctx.projectDueDate) {
    const pDue = String(ctx.projectDueDate).split("T")[0];
    if (pDue < todayStr && activeTasks.length > 0) {
      projectDeadlineOverdue = true;
    }
  }

  let scheduleScore = Math.max(0, 100 - Math.round(overdueRatio * 70));
  if (projectDeadlineOverdue) scheduleScore = Math.min(scheduleScore, 45);
  if (overdueTasks.length >= 3) scheduleScore = Math.min(scheduleScore, 65);

  // 3. Dependencies Score
  let depScore = 100;
  if (deps.hasCircularDependencies) depScore -= 35;
  depScore -= Math.min(40, deps.criticalDependencies.length * 15);
  depScore -= Math.min(25, deps.overdueDependenciesCount * 10);
  depScore = Math.max(10, depScore);

  // 4. Blockers Score
  let blockerScore = 100;
  blockerScore -= Math.min(60, deps.blockedTaskCount * 15);
  blockerScore = Math.max(15, blockerScore);

  // 5. Workload Score: Continuous Mean Absolute Deviation (MAD) & Imbalance Ratio
  const assignedCounts = workload.members.map((m) => m.activeTaskCount);
  const totalActiveAssigned = assignedCounts.reduce((acc, c) => acc + c, 0);
  const memberCount = assignedCounts.length;
  const meanLoad = memberCount > 0 ? totalActiveAssigned / memberCount : 0;

  // Mean Absolute Deviation from the team average
  const mad =
    memberCount > 0
      ? assignedCounts.reduce((acc, c) => acc + Math.abs(c - meanLoad), 0) / memberCount
      : 0;

  // Imbalance ratio: 0.0 is perfectly balanced, >0.8 is heavy single-person concentration
  const imbalanceRatio = meanLoad > 0 ? Math.min(1.5, mad / meanLoad) : 0;

  // Base score from workload balance:
  // Perfectly balanced (imbalanceRatio = 0) -> 100
  // Mild spread (imbalanceRatio = 0.3) -> 88
  // Moderate imbalance (imbalanceRatio = 0.6) -> 76
  // Severe bottleneck (imbalanceRatio >= 1.0) -> 60
  let workloadScore = Math.max(30, Math.round(100 - imbalanceRatio * 40));

  // Deduct for overdue pressure on team members
  const totalOverdueOnTeam = workload.members.reduce((acc, m) => acc + m.overdueTaskCount, 0);
  if (totalOverdueOnTeam > 0) {
    workloadScore = Math.max(20, workloadScore - Math.min(25, totalOverdueOnTeam * 6));
  }

  // Deduct for unassigned tasks
  if (workload.unassignedTaskCount > 0) {
    workloadScore = Math.max(20, workloadScore - Math.min(15, workload.unassignedTaskCount * 3));
  }

  // 6. Milestones Score
  let milestoneScore = 85;
  let totalMilestones = 0;
  let completedMilestones = 0;
  let overdueMilestones = 0;

  for (const g of ctx.goals) {
    for (const m of g.milestones || []) {
      totalMilestones++;
      if (m.completed) completedMilestones++;
      else if (m.dueDate && String(m.dueDate).split("T")[0] < todayStr) {
        overdueMilestones++;
      }
    }
  }

  if (totalMilestones > 0) {
    const mRatio = completedMilestones / totalMilestones;
    milestoneScore = Math.round(mRatio * 60) + 40;
    milestoneScore -= overdueMilestones * 20;
    milestoneScore = Math.max(15, Math.min(100, milestoneScore));
  }

  // 7. Risks Score
  let riskScore = 100;
  if (overdueTasks.length > 0) riskScore -= Math.min(30, overdueTasks.length * 8);
  if (deps.criticalDependencies.length > 0) riskScore -= Math.min(25, deps.criticalDependencies.length * 10);
  if (workload.overloadedCount > 0) riskScore -= 15;
  riskScore = Math.max(15, riskScore);

  // Weighted Overall Health Score
  // Weights: Schedule (25%), Dependencies (20%), Blockers (15%), Workload (15%), Tasks (10%), Milestones (10%), Risks (5%)
  const overallScore = Math.round(
    scheduleScore * 0.25 +
      depScore * 0.2 +
      blockerScore * 0.15 +
      workloadScore * 0.15 +
      taskCompletionScore * 0.1 +
      milestoneScore * 0.1 +
      riskScore * 0.05
  );

  let overallStatus: HealthStatusLevel = "healthy";
  let statusLabel = "Healthy";
  if (overallScore < 50) {
    overallStatus = "critical";
    statusLabel = "Critical";
  } else if (overallScore < 70) {
    overallStatus = "at_risk";
    statusLabel = "At Risk";
  } else if (overallScore < 85) {
    overallStatus = "needs_attention";
    statusLabel = "Needs Attention";
  }

  // Build Explanations
  const reasons: string[] = [];
  if (overdueTasks.length > 0) {
    reasons.push(
      `${overdueTasks.length} task${overdueTasks.length > 1 ? "s are" : " is"} overdue`
    );
  }
  if (deps.criticalDependencies.length > 0) {
    const count = deps.criticalDependencies.length;
    reasons.push(
      `${count} critical dependenc${count > 1 ? "ies are" : "y is"} blocking progress`
    );
  }
  if (workload.overloadedCount > 0) {
    reasons.push(
      `${workload.overloadedCount} team member${workload.overloadedCount > 1 ? "s are" : " is"} overloaded`
    );
  }
  if (deps.hasCircularDependencies) {
    reasons.push("circular dependencies detected in task flow");
  }

  let headlineExplanation = "Project is on track with steady task velocity and healthy schedule alignment.";
  if (reasons.length > 0) {
    headlineExplanation = `Project health decreased because ${reasons.join(", ")}.`;
  }

  const toCatStatus = (score: number): "good" | "warning" | "danger" => {
    if (score >= 80) return "good";
    if (score >= 60) return "warning";
    return "danger";
  };

  const categories: Record<HealthCategoryKey, HealthCategoryScore> = {
    schedule: {
      key: "schedule",
      label: "Schedule",
      score: scheduleScore,
      status: toCatStatus(scheduleScore),
      details: overdueTasks.length
        ? `${overdueTasks.length} active task${overdueTasks.length > 1 ? "s" : ""} past deadline.`
        : "All active tasks are currently within scheduled deadlines.",
      metricLabel: `${overdueTasks.length} overdue`,
    },
    tasks: {
      key: "tasks",
      label: "Task Completion",
      score: taskCompletionScore,
      status: toCatStatus(taskCompletionScore),
      details: `${completedTasks} of ${totalTasks} tasks completed across project.`,
      metricLabel: `${completionRatio}% complete`,
    },
    dependencies: {
      key: "dependencies",
      label: "Dependencies",
      score: depScore,
      status: toCatStatus(depScore),
      details: deps.hasCircularDependencies
        ? "Warning: Circular dependencies found in tasks."
        : deps.criticalDependencies.length
        ? `${deps.criticalDependencies.length} bottleneck dependency chains detected.`
        : "Dependency graph is healthy with no unresolved bottlenecks.",
      metricLabel: `${deps.blockingTaskCount} blockers`,
    },
    workload: {
      key: "workload",
      label: "Workload",
      score: workloadScore,
      status: toCatStatus(workloadScore),
      details: workload.overloadedCount
        ? `${workload.overloadedCount} teammate${workload.overloadedCount > 1 ? "s" : ""} carrying excessive task concentration.`
        : "Workload is evenly distributed across available project members.",
      metricLabel: workload.overloadedCount ? `${workload.overloadedCount} overloaded` : "Balanced",
    },
    blockers: {
      key: "blockers",
      label: "Blockers",
      score: blockerScore,
      status: toCatStatus(blockerScore),
      details: deps.blockedTaskCount
        ? `${deps.blockedTaskCount} task${deps.blockedTaskCount > 1 ? "s" : ""} currently blocked by upstream deliverables.`
        : "No tasks are currently stalled by upstream blockers.",
      metricLabel: `${deps.blockedTaskCount} blocked`,
    },
    risks: {
      key: "risks",
      label: "Risks",
      score: riskScore,
      status: toCatStatus(riskScore),
      details:
        overdueTasks.length > 0 || deps.criticalDependencies.length > 0
          ? "Potential schedule slippage identified due to active delays."
          : "Low risk profile across schedule and resources.",
      metricLabel: overallStatus === "critical" ? "Critical" : overallStatus === "at_risk" ? "High" : "Low",
    },
    milestones: {
      key: "milestones",
      label: "Milestones",
      score: milestoneScore,
      status: toCatStatus(milestoneScore),
      details: totalMilestones
        ? `${completedMilestones}/${totalMilestones} milestones reached (${overdueMilestones} overdue).`
        : "No structured milestones configured for this project.",
      metricLabel: totalMilestones ? `${completedMilestones}/${totalMilestones}` : "N/A",
    },
  };

  return {
    overallScore,
    overallStatus,
    statusLabel,
    headlineExplanation,
    categories,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Predictive Risk Detection Engine
 */
export function detectRisks(
  ctx: AnalyticsContext,
  deps: DependencyAnalysis,
  workload: WorkloadAnalysis
): RiskItem[] {
  const statusMap = buildStatusMap(ctx.statuses);
  const profileMap = buildProfileMap(ctx.profiles);
  const todayStr = new Date().toISOString().split("T")[0];

  const risks: RiskItem[] = [];

  const activeTasks = ctx.tasks.filter((t) => {
    const s = statusMap.get(t.status_id);
    return s?.category !== "completed" && s?.category !== "cancelled";
  });

  const taskMap = new Map(ctx.tasks.map((t) => [t.id, t]));

  // Risk 1: Overdue Blockers (Critical Impact)
  for (const crit of deps.criticalDependencies) {
    const blocker = crit.blockerTask;
    const probabilityScore = blocker.isOverdue ? 88 : 65;
    risks.push({
      id: `risk-dep-${blocker.taskId}`,
      title: `Blocker: ${blocker.title}`,
      severity: blocker.isOverdue ? "critical" : "high",
      probabilityScore,
      probabilityLevel: blocker.isOverdue ? "Critical" : "High",
      reason: blocker.isOverdue
        ? `Task is overdue and currently blocking ${crit.downstreamCount} downstream task${crit.downstreamCount > 1 ? "s" : ""}.`
        : `Task has high downstream fan-out, blocking ${crit.downstreamCount} tasks.`,
      rootCause: `Upstream completion for "${blocker.title}" has stalled while dependencies remain linked.`,
      affectedTasks: [blocker.title],
      affectedMilestones: [],
      affectedPeople: blocker.assignees,
      scheduleImpactDays: blocker.isOverdue ? 4 : 2,
      recommendedAction: `Expedite "${blocker.title}" or temporarily remove blocker links to unstick downstream execution.`,
      mitigationStrategy: `Prioritize "${blocker.title}" as urgent or remove dependency link to unblock ${crit.downstreamCount} downstream tasks.`,
      potentialRiskReductionPercent: blocker.isOverdue ? 65 : 45,
      preventiveMeasureId: `rec-blocker-${blocker.taskId}`,
    });
  }

  // Risk 2: Circular Dependency Risk
  if (deps.hasCircularDependencies) {
    risks.push({
      id: "risk-circular-deps",
      title: "Circular Task Dependency Detected",
      severity: "critical",
      probabilityScore: 95,
      probabilityLevel: "Critical",
      reason: "Two or more tasks are mutually blocking each other, forming a deadlock.",
      rootCause: deps.circularChains[0]?.join(" ➔ ") || "Cyclic dependency links in project.",
      affectedTasks: deps.circularChains[0] || [],
      affectedMilestones: [],
      affectedPeople: [],
      scheduleImpactDays: 7,
      recommendedAction: "Review and remove cyclic relationship links in the task dependencies list.",
      mitigationStrategy: "Break the dependency loop by unlinking mutually blocking tasks.",
      potentialRiskReductionPercent: 90,
      preventiveMeasureId: "rec-break-cycle",
    });
  }

  // Risk 3: Overloaded Key Performers
  for (const m of workload.members) {
    if (m.status === "overloaded" && (m.activeTaskCount >= 6 || m.overdueTaskCount >= 2)) {
      risks.push({
        id: `risk-workload-${m.userId}`,
        title: `Workload Concentration: ${m.name}`,
        severity: m.overdueTaskCount >= 2 ? "critical" : "high",
        probabilityScore: 75,
        probabilityLevel: "High",
        reason: `${m.name} is assigned ${m.activeTaskCount} active tasks (${m.overdueTaskCount} overdue), creating an execution bottleneck.`,
        rootCause: `Single team member has too many high-priority deliverables concentrated on them.`,
        affectedTasks: m.taskTitles,
        affectedMilestones: [],
        affectedPeople: [m.name],
        scheduleImpactDays: 3,
        recommendedAction: `Reassign 1-2 tasks from ${m.name} to available teammates to balance velocity.`,
        mitigationStrategy: `Reallocate active tasks to teammates with capacity and stagger milestone due dates to reduce overload.`,
        potentialRiskReductionPercent: 50,
      });
    }
  }

  // Risk 4: Approaching Project Deadline with Incomplete Scope
  if (ctx.projectDueDate) {
    const pDue = String(ctx.projectDueDate).split("T")[0];
    const daysLeft = Math.round(
      (new Date(pDue).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 7 && activeTasks.length > 5) {
      risks.push({
        id: "risk-project-deadline-crunch",
        title: "Approaching Project Deadline with High Remaining Scope",
        severity: daysLeft < 0 ? "critical" : "high",
        probabilityScore: 82,
        probabilityLevel: "High",
        reason: `Target deadline is ${daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `in ${daysLeft} days`} with ${activeTasks.length} active tasks remaining.`,
        rootCause: "Task completion rate is trailing behind original timeline expectations.",
        affectedTasks: activeTasks.slice(0, 5).map((t) => t.title),
        affectedMilestones: [],
        affectedPeople: [],
        scheduleImpactDays: Math.max(5, Math.ceil(activeTasks.length / 2)),
        recommendedAction: "Descope non-essential tasks or extend the project target date.",
        mitigationStrategy: "Add a 5-7 day timeline buffer or descope non-blocking tasks to subsequent releases.",
        potentialRiskReductionPercent: 60,
        preventiveMeasureId: "rec-extend-deadline",
      });
    }
  }

  // Risk 5: Repeated Deadline Changes (from activity events)
  const scheduleEvents = ctx.activity.filter((e) => e.event_type === "schedule_changed");
  if (scheduleEvents.length >= 3) {
    risks.push({
      id: "risk-repeated-schedule-slip",
      title: "Pattern of Frequent Schedule Extensions",
      severity: "medium",
      probabilityScore: 68,
      probabilityLevel: "Medium",
      reason: `Tasks in this project have undergone ${scheduleEvents.length} schedule changes recently, indicating estimation volatility.`,
      rootCause: "Initial task estimations may have undercounted scope or integration complexity.",
      affectedTasks: [],
      affectedMilestones: [],
      affectedPeople: [],
      scheduleImpactDays: 3,
      recommendedAction: "Audit task scope and conduct an estimation calibration before next milestone.",
      mitigationStrategy: "Calibrate estimation margins and conduct a scope breakdown for upcoming tasks.",
      potentialRiskReductionPercent: 40,
    });
  }

  // Sort by severity (critical, high, medium, low)
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  return risks;
}

/**
 * "Why is my project at risk?" Causal Chain Builder
 */
export function computeWhyAtRisk(
  ctx: AnalyticsContext,
  health: ProjectHealthBreakdown,
  risks: RiskItem[],
  deps: DependencyAnalysis,
  workload: WorkloadAnalysis
): WhyAtRiskExplanation {
  if (health.overallScore >= 85 && risks.length === 0) {
    return {
      headline: "Project is healthy and progressing according to schedule.",
      isAtRisk: false,
      chain: [
        {
          stage: "Current Status",
          description: "All critical deliverables are on track.",
          evidence: "0 overdue tasks and no blocking dependencies.",
        },
      ],
      rootCause: "No significant risks or blockers identified in current project data.",
      directImpact: "Work is proceeding normally.",
      downstreamImpact: "Expected completion aligns with planned milestones.",
      affectedTasks: [],
      affectedMilestones: [],
      affectedPeople: [],
      expectedScheduleImpact: "On schedule (0 days delay)",
    };
  }

  const primaryRisk = risks[0];
  const affectedTasks: Array<{ id: string; key: string; title: string }> = [];
  const affectedPeople = new Set<string>();

  // Collect affected tasks
  if (deps.blockedTasks.length > 0) {
    for (const bt of deps.blockedTasks) {
      affectedTasks.push({
        id: bt.task.taskId,
        key: bt.task.taskKey,
        title: bt.task.title,
      });
      for (const a of bt.task.assignees) {
        if (a !== "Unassigned") affectedPeople.add(a);
      }
    }
  }

  for (const m of workload.members) {
    if (m.status === "overloaded") {
      affectedPeople.add(m.name);
    }
  }

  const chain: WhyAtRiskExplanation["chain"] = [];

  chain.push({
    stage: "Project Health Assessment",
    description: `Project is currently rated ${health.statusLabel} (${health.overallScore}%).`,
    evidence: health.headlineExplanation,
  });

  if (deps.criticalDependencies.length > 0) {
    const crit = deps.criticalDependencies[0];
    chain.push({
      stage: "Active Blocker",
      description: `Task "${crit.blockerTask.title}" is blocking ${crit.downstreamCount} downstream tasks.`,
      evidence: crit.isOverdue
        ? `Blocker is overdue (due: ${crit.blockerTask.dueDate || "N/A"}).`
        : "Downstream tasks cannot proceed until this task finishes.",
    });
  }

  if (deps.blockedTasks.length > 0) {
    chain.push({
      stage: "Downstream Bottleneck",
      description: `${deps.blockedTasks.length} task${deps.blockedTasks.length > 1 ? "s are" : " is"} stalled awaiting prerequisites.`,
      evidence: deps.blockedTasks
        .slice(0, 3)
        .map((b) => `"${b.task.title}"`)
        .join(", "),
    });
  }

  if (workload.overloadedCount > 0) {
    const top = workload.members[0];
    chain.push({
      stage: "Resource Workload Pressure",
      description: `${top.name} is carrying ${top.activeTaskCount} tasks (${top.workloadPercentage}% capacity).`,
      evidence: "Workload concentration limits velocity on critical path.",
    });
  }

  const rootCause =
    primaryRisk?.rootCause ||
    (deps.criticalDependencies.length > 0
      ? `Task "${deps.criticalDependencies[0].blockerTask.title}" has stalled, halting dependent execution.`
      : "Schedule compression due to accumulated overdue tasks.");

  const directImpact =
    deps.blockedTasks.length > 0
      ? `${deps.blockedTasks.length} downstream tasks cannot begin.`
      : "Execution velocity has dropped below planned burn rate.";

  const downstreamImpact =
    ctx.projectDueDate
      ? `Project delivery deadline (${ctx.projectDueDate}) is at risk of slipping.`
      : "Key project milestones and release deliverables are being delayed.";

  return {
    headline: health.headlineExplanation,
    isAtRisk: true,
    chain,
    rootCause,
    directImpact,
    downstreamImpact,
    affectedTasks: affectedTasks.slice(0, 8),
    affectedMilestones: [],
    affectedPeople: [...affectedPeople],
    expectedScheduleImpact: primaryRisk?.scheduleImpactDays
      ? `Estimated ${primaryRisk.scheduleImpactDays} - ${primaryRisk.scheduleImpactDays + 3} days delay`
      : "Estimated 3 - 5 days schedule delay",
  };
}

/**
 * Change Impact Simulation Engine
 */
export function simulateChangeImpact(
  ctx: AnalyticsContext,
  input: ChangeSimulationInput,
  deps: DependencyAnalysis,
  workload: WorkloadAnalysis
): ChangeImpactResult {
  const statusMap = buildStatusMap(ctx.statuses);
  const profileMap = buildProfileMap(ctx.profiles);
  const taskMap = new Map(ctx.tasks.map((t) => [t.id, t]));

  let summary = "";
  let changeDescription = "";
  let affectedTaskCount = 0;
  let affectedDependencyCount = 0;
  const affectedPeople = new Set<string>();
  const affectedMilestones: string[] = [];
  const criticalTasks: Array<{ id: string; key: string; title: string }> = [];
  let potentialResult = "";
  const recommendedActions: string[] = [];

  if (input.changeType === "project_deadline") {
    const currentDue = ctx.projectDueDate ? new Date(ctx.projectDueDate) : new Date();
    const targetDue = input.newDate ? new Date(input.newDate) : new Date();
    const daysDelta = Math.round((targetDue.getTime() - currentDue.getTime()) / (1000 * 60 * 60 * 24));

    changeDescription = `Project deadline shifted by ${Math.abs(daysDelta)} days (${daysDelta < 0 ? "earlier" : "later"}) to ${input.newDate || "new date"}.`;

    const activeTasks = ctx.tasks.filter((t) => {
      const s = statusMap.get(t.status_id);
      return s?.category !== "completed" && s?.category !== "cancelled";
    });

    affectedTaskCount = activeTasks.length;
    affectedDependencyCount = ctx.dependencies.length;

    for (const m of workload.members) {
      if (m.activeTaskCount > 0) affectedPeople.add(m.name);
    }

    for (const t of activeTasks.slice(0, 5)) {
      criticalTasks.push({
        id: t.id,
        key: t.generated_key || t.id.slice(0, 8),
        title: t.title,
      });
    }

    if (daysDelta < 0) {
      summary = `Compressing schedule by ${Math.abs(daysDelta)} days creates high pressure on ${activeTasks.length} active tasks.`;
      potentialResult = `Current plan is unlikely to meet the accelerated deadline without descaling scope or reallocating resources.`;
      recommendedActions.push("Move secondary priority tasks into a subsequent milestone.");
      recommendedActions.push("Audit critical dependencies and parallelize independent tasks.");
      recommendedActions.push("Add additional team member capacity to the longest critical path.");
    } else {
      summary = `Extending deadline by ${daysDelta} days provides buffer for current active tasks.`;
      potentialResult = `Gives team ${daysDelta} additional days to resolve ${deps.blockedTaskCount} blocked tasks and conduct thorough QA.`;
      recommendedActions.push("Realign task milestones to use the newly available buffer.");
    }
  } else if (input.changeType === "task_due_date" && input.taskId) {
    const task = taskMap.get(input.taskId);
    const taskTitle = task?.title || "Selected Task";
    changeDescription = `Task "${taskTitle}" due date changed to ${input.newDate}.`;

    // Find all downstream tasks blocked by this task
    const downstreamBlocked: RawTaskItem[] = [];
    const collectDownstream = (id: string) => {
      for (const d of ctx.dependencies) {
        if (d.task_id === id && d.relation === "blocks") {
          const dt = taskMap.get(d.linked_task_id);
          if (dt) {
            downstreamBlocked.push(dt);
            collectDownstream(dt.id);
          }
        }
      }
    };
    collectDownstream(input.taskId);

    affectedTaskCount = downstreamBlocked.length + 1;
    affectedDependencyCount = downstreamBlocked.length;

    criticalTasks.push({
      id: input.taskId,
      key: task?.generated_key || input.taskId.slice(0, 8),
      title: taskTitle,
    });

    for (const dt of downstreamBlocked.slice(0, 4)) {
      criticalTasks.push({
        id: dt.id,
        key: dt.generated_key || dt.id.slice(0, 8),
        title: dt.title,
      });
    }

    summary = `Changing date on "${taskTitle}" directly impacts ${downstreamBlocked.length} downstream dependent tasks.`;
    potentialResult =
      downstreamBlocked.length > 0
        ? `Downstream tasks will need to be pushed forward to accommodate this delay.`
        : "Isolated task date change with minimal downstream chain disruption.";

    if (downstreamBlocked.length > 0) {
      recommendedActions.push(`Reschedule dependent tasks starting with "${downstreamBlocked[0].title}".`);
      recommendedActions.push("Notify assignees of downstream tasks about schedule adjustment.");
    }
  } else if (input.changeType === "task_reassign" && input.taskId && input.newAssigneeName) {
    const task = taskMap.get(input.taskId);
    changeDescription = `Reassign "${task?.title || "Task"}" to ${input.newAssigneeName}.`;

    affectedTaskCount = 1;
    affectedPeople.add(input.newAssigneeName);
    criticalTasks.push({
      id: input.taskId,
      key: task?.generated_key || input.taskId.slice(0, 8),
      title: task?.title || "Task",
    });

    summary = `Reassigning task to ${input.newAssigneeName} shifts estimated workload.`;
    potentialResult = `Decreases workload concentration on previous owner and accelerates task execution.`;
    recommendedActions.push(`Confirm ${input.newAssigneeName}'s availability and context before handoff.`);
  } else {
    changeDescription = `Project scope or priority update.`;
    summary = `Simulated project change affecting task execution order.`;
    affectedTaskCount = 1;
    potentialResult = `Plan adjusted to reflect modified project attributes.`;
    recommendedActions.push("Review updated project health score after saving.");
  }

  return {
    summary,
    changeDescription,
    affectedTaskCount,
    affectedDependencyCount,
    affectedPeopleCount: affectedPeople.size,
    affectedMilestoneCount: affectedMilestones.length,
    criticalTasks,
    affectedPeople: [...affectedPeople],
    affectedMilestones,
    potentialResult,
    recommendedActions,
  };
}

/**
 * Generates Actionable Recommendations & Preventive Measures based on Deterministic Data
 */
export function generateDeterministicRecommendations(
  ctx: AnalyticsContext,
  health: ProjectHealthBreakdown,
  risks: RiskItem[],
  deps: DependencyAnalysis,
  workload: WorkloadAnalysis
): ActionableRecommendation[] {
  const recommendations: ActionableRecommendation[] = [];
  const statusMap = buildStatusMap(ctx.statuses);
  const todayStr = new Date().toISOString().split("T")[0];

  const activeTasks = ctx.tasks.filter((t) => {
    const s = statusMap.get(t.status_id);
    return s?.category !== "completed" && s?.category !== "cancelled";
  });

  // 1. Preventive Measure: Resolve Critical Overdue Blockers
  for (const crit of deps.criticalDependencies) {
    recommendations.push({
      id: `rec-blocker-${crit.blockerTask.taskId}`,
      projectId: ctx.projectId,
      title: `Prioritize blocker: "${crit.blockerTask.title}"`,
      description: `This task is currently holding up ${crit.downstreamCount} downstream task${crit.downstreamCount > 1 ? "s" : ""}. Elevating priority restores unblocked progress.`,
      whyRecommended: `Currently on the project critical path; unblocks ${crit.downstreamCount} dependent deliverables.`,
      affectsDescription: `Elevates priority of "${crit.blockerTask.title}" to Urgent.`,
      expectedBenefit: `Clears execution bottleneck, unfreezing ${crit.downstreamCount} tasks immediately.`,
      possibleRisk: "May require temporary reallocation of team focus from secondary items.",
      actionType: "change_priority",
      actionPayload: {
        taskId: crit.blockerTask.taskId,
        priority: "urgent",
      },
      status: "pending",
      createdAt: new Date().toISOString(),
      riskId: `risk-dep-${crit.blockerTask.taskId}`,
      riskReductionScore: crit.isOverdue ? 65 : 45,
      riskReductionLabel: `↓ ${crit.isOverdue ? 65 : 45}% Blocker Risk`,
      healthImpactLabel: "+12% Health Score",
      category: "blocker",
    });
  }

  // 2. Preventive Measure: Balance Overloaded Contributors & Mitigate Workload Risks
  const activeAssignedTotal = workload.members.reduce((acc, m) => acc + m.activeTaskCount, 0);
  const teamMean = workload.members.length > 0 ? activeAssignedTotal / workload.members.length : 0;

  // Only consider true outliers that are noticeably above team mean (or carrying multiple overdue tasks)
  const overloadedMembers = workload.members
    .filter(
      (m) =>
        m.status === "overloaded" &&
        (m.activeTaskCount > teamMean + 2 || m.overdueTaskCount >= 2)
    )
    .sort((a, b) => b.activeTaskCount - a.activeTaskCount)
    .slice(0, 2); // At most top 2 bottlenecks to prevent recommendation flood

  for (const srcMember of overloadedMembers) {
    // Collect active tasks assigned to this member
    const memberTasks = activeTasks.filter(
      (t) => t.primary_assignee_id === srcMember.userId || t.secondary_assignee_id === srcMember.userId
    );

    if (memberTasks.length === 0) continue;

    // Pick task with lowest priority or farthest deadline first (safest to reassign)
    const taskToReassign =
      memberTasks.find((t) => t.priority === "low" || t.priority === "normal") || memberTasks[0];

    // Find best target teammate to receive this task:
    // First: underutilized members
    // Second: any teammate strictly below team average with at least 3 fewer tasks
    // Third: any profile with 0 tasks
    let targetMember = workload.members.find(
      (m) => m.status === "underutilized" && m.userId !== srcMember.userId
    );

    if (!targetMember) {
      const candidates = workload.members
        .filter(
          (m) =>
            m.userId !== srcMember.userId &&
            m.status !== "overloaded" &&
            m.activeTaskCount < teamMean && // Must be below average so we never create new overloaded members
            srcMember.activeTaskCount - m.activeTaskCount >= 3
        )
        .sort((a, b) => a.activeTaskCount - b.activeTaskCount);

      if (candidates.length > 0) {
        targetMember = candidates[0];
      } else {
        const unassignedProfile = ctx.profiles.find(
          (p) =>
            p.id !== srcMember.userId &&
            !workload.members.some((m) => m.userId === p.id && m.activeTaskCount >= teamMean)
        );
        if (unassignedProfile) {
          targetMember = {
            userId: unassignedProfile.id,
            name: unassignedProfile.display_name || "Team Member",
            email: unassignedProfile.email || "",
            avatarUrl: unassignedProfile.avatar_url || null,
            activeTaskCount: 0,
            overdueTaskCount: 0,
            criticalTaskCount: 0,
            estimatedMinutesTotal: 0,
            workloadPercentage: 0,
            status: "balanced",
            taskTitles: [],
          };
        }
      }
    }

    if (targetMember && taskToReassign) {
      const reductionPercent = Math.min(
        60,
        Math.max(30, Math.round((2 / Math.max(1, srcMember.activeTaskCount)) * 100) + 20)
      );
      recommendations.push({
        id: `rec-reassign-${srcMember.userId}-${taskToReassign.id}`,
        projectId: ctx.projectId,
        title: `Rebalance workload: Move "${taskToReassign.title}" from ${srcMember.name} to ${targetMember.name}`,
        description: `${srcMember.name} is currently assigned ${srcMember.activeTaskCount} active tasks (${srcMember.workloadPercentage}% load), creating a delivery bottleneck.`,
        whyRecommended: `Reduces single-contributor overload on ${srcMember.name} and utilizes available capacity with ${targetMember.name} (${targetMember.activeTaskCount} tasks).`,
        affectsDescription: `Reassigns task "${taskToReassign.title}" to ${targetMember.name}.`,
        expectedBenefit: `Decreases ${srcMember.name}'s workload risk by ${reductionPercent}% and balances team sprint velocity.`,
        possibleRisk: "Brief 10-minute context handoff between assignees.",
        actionType: "reassign_task",
        actionPayload: {
          taskId: taskToReassign.id,
          newPrimaryAssigneeId: targetMember.userId,
          newAssigneeName: targetMember.name,
          oldAssigneeName: srcMember.name,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
        riskId: `risk-workload-${srcMember.userId}`,
        riskReductionScore: reductionPercent,
        riskReductionLabel: `↓ ${reductionPercent}% Risk Reduction`,
        healthImpactLabel: "+6% Health Score",
        category: "workload",
      });
    }

    // Schedule Staggering: ONLY if contributor has multiple tasks colliding on the EXACT same deadline
    const deadlineBuckets = new Map<string, RawTaskItem[]>();
    for (const t of memberTasks) {
      if (t.due_date) {
        const dStr = String(t.due_date).split("T")[0];
        const list = deadlineBuckets.get(dStr) || [];
        list.push(t);
        deadlineBuckets.set(dStr, list);
      }
    }

    const collision = [...deadlineBuckets.entries()].find(([_, list]) => list.length >= 2);
    if (collision) {
      const collidingTask = collision[1][1];
      const nextDue = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
      recommendations.push({
        id: `rec-stagger-${srcMember.userId}-${collidingTask.id}`,
        projectId: ctx.projectId,
        title: `Prevent bottleneck: Stagger deadline for "${collidingTask.title}" (+5 days)`,
        description: `Spreads out ${srcMember.name}'s delivery commitments to prevent concurrent deadline collisions on ${collision[0]}.`,
        whyRecommended: "Concurrent delivery dates on an overloaded contributor frequently trigger schedule slippage.",
        affectsDescription: `Reschedules due date of "${collidingTask.title}" to ${nextDue}.`,
        expectedBenefit: "Provides breathing room for focused execution and decreases concurrency pressure.",
        possibleRisk: "Ensure downstream milestones are updated if linked.",
        actionType: "reschedule_task",
        actionPayload: {
          taskId: collidingTask.id,
          newDueDate: nextDue,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
        riskId: `risk-workload-${srcMember.userId}`,
        riskReductionScore: 35,
        riskReductionLabel: "↓ 35% Concurrency Relief",
        healthImpactLabel: "+4% Health Score",
        category: "schedule",
      });
    }
  }

  // 3. Preventive Measure: Reschedule Overdue Non-blocking Tasks
  const overdueNonBlockers = activeTasks.filter((t) => {
    const d = t.due_date ? String(t.due_date).split("T")[0] : null;
    const isOverdue = Boolean(d && d < todayStr);
    const isBlocker = deps.blockingTasks.some((b) => b.task.taskId === t.id);
    return isOverdue && !isBlocker;
  });

  if (overdueNonBlockers.length > 0) {
    const topOverdue = overdueNonBlockers[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    recommendations.push({
      id: `rec-reschedule-${topOverdue.id}`,
      projectId: ctx.projectId,
      title: `Update schedule for "${topOverdue.title}"`,
      description: `Task is past its due date (${topOverdue.due_date?.split("T")[0]}). Resetting to a realistic target date restores schedule integrity.`,
      whyRecommended: "Overdue tasks degrade project health scores and cause false schedule alarms.",
      affectsDescription: `Updates due date of "${topOverdue.title}" to ${nextWeek}.`,
      expectedBenefit: "Improves schedule health score and establishes an achievable target.",
      possibleRisk: "Ensure no unlinked commitments depend on the original date.",
      actionType: "reschedule_task",
      actionPayload: {
        taskId: topOverdue.id,
        newDueDate: nextWeek,
      },
      status: "pending",
      createdAt: new Date().toISOString(),
      riskReductionScore: 40,
      riskReductionLabel: "↓ 40% Overdue Penalty",
      healthImpactLabel: "+8% Health Score",
      category: "schedule",
    });
  }

  // 4. Preventive Measure: Break Circular Dependencies
  if (deps.hasCircularDependencies && deps.circularChains.length > 0) {
    recommendations.push({
      id: "rec-break-cycle",
      projectId: ctx.projectId,
      title: "Remove circular dependency link",
      description: `Break the dependency cycle: ${deps.circularChains[0].join(" ➔ ")}. Circular dependencies prevent automated scheduling and cause deadlocks.`,
      whyRecommended: "Circular links create impossible execution orders where tasks wait on each other.",
      affectsDescription: "Removes circular dependency between tasks.",
      expectedBenefit: "Restores linear execution path and unblocks scheduling.",
      possibleRisk: "None. Circular dependencies are invalid project logic.",
      actionType: "remove_dependency",
      actionPayload: {
        cycle: deps.circularChains[0],
      },
      status: "pending",
      createdAt: new Date().toISOString(),
      riskId: "risk-circular-deps",
      riskReductionScore: 90,
      riskReductionLabel: "↓ 90% Deadlock Elimination",
      healthImpactLabel: "+20% Health Score",
      category: "dependency",
    });
  }

  // 5. Preventive Measure: Project Deadline Buffer Injection
  if (ctx.projectDueDate) {
    const pDue = String(ctx.projectDueDate).split("T")[0];
    const daysLeft = Math.round(
      (new Date(pDue).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 7 && activeTasks.length > 5) {
      const bufferDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
      recommendations.push({
        id: "rec-extend-deadline",
        projectId: ctx.projectId,
        title: `Inject timeline buffer: Adjust target deadline (+7 days)`,
        description: `Current deadline (${pDue}) leaves insufficient runway for ${activeTasks.length} remaining tasks. Extending by 7 days accommodates testing and QA without emergency crunch.`,
        whyRecommended: "High active task volume with less than 7 days remaining creates acute risk of release slip.",
        affectsDescription: `Adjusts target project deadline to ${bufferDate}.`,
        expectedBenefit: "Provides realistic delivery buffer and protects project health score.",
        possibleRisk: "Requires stakeholder notification.",
        actionType: "adjust_deadline",
        actionPayload: {
          newDeadline: bufferDate,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
        riskId: "risk-project-deadline-crunch",
        riskReductionScore: 65,
        riskReductionLabel: "↓ 65% Deadline Crunch Risk",
        healthImpactLabel: "+15% Health Score",
        category: "schedule",
      });
    }
  }

  // Return focused list of highest-impact recommendations (max 4 items)
  return recommendations.slice(0, 4);
}

/**
 * Builds Smart Project Graph (Nodes & Edges)
 */
export function buildSmartProjectGraph(
  ctx: AnalyticsContext,
  deps: DependencyAnalysis
): SmartProjectGraph {
  const nodes: SmartGraphNode[] = [];
  const edges: SmartGraphEdge[] = [];
  const statusMap = buildStatusMap(ctx.statuses);
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Project Root Node
  nodes.push({
    id: `project-${ctx.projectId}`,
    label: ctx.projectName,
    type: "project",
    status: "active",
    linkUrl: `/projects/${ctx.projectId}`,
  });

  // 2. Goal Nodes
  for (const g of ctx.goals) {
    const goalNodeId = `goal-${g.id}`;
    nodes.push({
      id: goalNodeId,
      label: g.title,
      type: "goal",
      progress: g.progress,
      linkUrl: `/projects/${ctx.projectId}?view=goals`,
    });

    edges.push({
      id: `edge-proj-${g.id}`,
      source: `project-${ctx.projectId}`,
      target: goalNodeId,
      relation: "contains",
    });

    // Milestone Nodes
    for (const m of g.milestones || []) {
      const mNodeId = `milestone-${m.id}`;
      nodes.push({
        id: mNodeId,
        label: m.title,
        type: "milestone",
        status: m.completed ? "completed" : "pending",
        isOverdue: Boolean(m.dueDate && String(m.dueDate).split("T")[0] < todayStr && !m.completed),
      });

      edges.push({
        id: `edge-goal-${m.id}`,
        source: goalNodeId,
        target: mNodeId,
        relation: "contains",
      });
    }
  }

  // 3. Task Nodes (Top 25 most relevant to avoid DOM overload)
  const taskMap = new Map(ctx.tasks.map((t) => [t.id, t]));
  const primaryTasks = ctx.tasks
    .filter((t) => !t.parent_task_id) // parent tasks
    .slice(0, 25);

  for (const t of primaryTasks) {
    const s = statusMap.get(t.status_id);
    const dStr = t.due_date ? String(t.due_date).split("T")[0] : null;
    const isCompleted = s?.category === "completed";
    const isOverdue = Boolean(dStr && dStr < todayStr && !isCompleted);

    const taskNodeId = `task-${t.id}`;
    nodes.push({
      id: taskNodeId,
      label: t.title,
      type: "task",
      status: s?.name || "To Do",
      priority: t.priority,
      isOverdue,
      progress: t.progress,
      linkUrl: `/projects/${ctx.projectId}/tasks/${t.id}`,
    });

    edges.push({
      id: `edge-proj-${t.id}`,
      source: `project-${ctx.projectId}`,
      target: taskNodeId,
      relation: "contains",
    });

    // Subtasks for this task
    const subtasks = ctx.tasks.filter((st) => st.parent_task_id === t.id);
    for (const st of subtasks.slice(0, 5)) {
      const subtaskNodeId = `subtask-${st.id}`;
      nodes.push({
        id: subtaskNodeId,
        label: st.title,
        type: "subtask",
        status: statusMap.get(st.status_id)?.name || "To Do",
        linkUrl: `/projects/${ctx.projectId}/tasks/${st.id}`,
      });

      edges.push({
        id: `edge-parent-${st.id}`,
        source: taskNodeId,
        target: subtaskNodeId,
        relation: "child_of",
      });
    }
  }

  // 4. Dependency Edges between tasks
  for (const dep of ctx.dependencies) {
    if (taskMap.has(dep.task_id) && taskMap.has(dep.linked_task_id)) {
      if (dep.relation === "blocks") {
        edges.push({
          id: `dep-${dep.task_id}-${dep.linked_task_id}`,
          source: `task-${dep.task_id}`,
          target: `task-${dep.linked_task_id}`,
          relation: "blocks",
          label: "blocks",
        });
      } else if (dep.relation === "blocked_by") {
        edges.push({
          id: `dep-${dep.linked_task_id}-${dep.task_id}`,
          source: `task-${dep.linked_task_id}`,
          target: `task-${dep.task_id}`,
          relation: "blocks",
          label: "blocks",
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Builds Today's Project Brief (Personalized & Actionable)
 */
export function generateTodayBrief(
  ctx: AnalyticsContext,
  currentUserId: string,
  health: ProjectHealthBreakdown,
  deps: DependencyAnalysis
): TodayProjectBrief {
  const statusMap = buildStatusMap(ctx.statuses);
  const profileMap = buildProfileMap(ctx.profiles);
  const todayStr = new Date().toISOString().split("T")[0];

  const taskAssigneesMap = new Map<string, Set<string>>();
  for (const a of ctx.taskAssignees) {
    if (!taskAssigneesMap.has(a.task_id)) taskAssigneesMap.set(a.task_id, new Set());
    taskAssigneesMap.get(a.task_id)!.add(a.user_id);
  }

  const currentUser = profileMap.get(currentUserId);
  const greeting = currentUser ? `Good day, ${currentUser.name}.` : "Good day.";

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const priorityItems: TodayProjectBrief["priorityItems"] = [];

  // 1. Immediate blocker resolutions
  for (const b of deps.blockingTasks) {
    const isAssignedToUser = b.task.assignees.includes(currentUser?.name || "");
    priorityItems.push({
      id: `brief-blocker-${b.task.taskId}`,
      severity: "critical",
      title: `Resolve Blocker: "${b.task.title}"`,
      detail: `Currently blocking ${b.blocksCount} downstream task${b.blocksCount > 1 ? "s" : ""}. ${isAssignedToUser ? "Assigned to you." : `Assigned to ${b.task.assignees.join(", ")}.`}`,
      taskId: b.task.taskId,
      actionLabel: "View Blocker",
    });
    if (priorityItems.length >= 2) break;
  }

  // 2. Tasks Due Today or Tomorrow
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  for (const t of ctx.tasks) {
    const s = statusMap.get(t.status_id);
    if (s?.category === "completed" || s?.category === "cancelled") continue;

    const d = t.due_date ? String(t.due_date).split("T")[0] : null;
    if (d === todayStr) {
      priorityItems.push({
        id: `brief-due-today-${t.id}`,
        severity: "high",
        title: `Deliverable Due Today: "${t.title}"`,
        detail: `Scheduled for completion today. Priority: ${t.priority.toUpperCase()}.`,
        taskId: t.id,
        actionLabel: "Open Task",
      });
    } else if (d === tomorrow) {
      priorityItems.push({
        id: `brief-due-tomorrow-${t.id}`,
        severity: "normal",
        title: `Upcoming Tomorrow: "${t.title}"`,
        detail: `Due tomorrow. Ready for final review.`,
        taskId: t.id,
        actionLabel: "Review Task",
      });
    }
    if (priorityItems.length >= 4) break;
  }

  // 3. Fallback priority if no urgent items
  if (priorityItems.length === 0) {
    const openTasks = ctx.tasks.filter((t) => {
      const s = statusMap.get(t.status_id);
      return s?.category !== "completed" && s?.category !== "cancelled";
    });

    if (openTasks.length > 0) {
      const nextTask = openTasks[0];
      priorityItems.push({
        id: `brief-next-${nextTask.id}`,
        severity: "normal",
        title: `Next Up: "${nextTask.title}"`,
        detail: `Next scheduled work item in "${ctx.projectName}".`,
        taskId: nextTask.id,
        actionLabel: "Work on Task",
      });
    }
  }

  // Expected vs Original Completion
  const originalCompletion = ctx.projectDueDate ? String(ctx.projectDueDate).split("T")[0] : null;

  // Calculate expected completion based on active tasks and health
  const activeCount = ctx.tasks.filter((t) => {
    const s = statusMap.get(t.status_id);
    return s?.category !== "completed" && s?.category !== "cancelled";
  }).length;

  let expectedDateObj = originalCompletion ? new Date(originalCompletion) : new Date(Date.now() + 14 * 86400000);
  if (health.overallStatus === "at_risk" || health.overallStatus === "critical") {
    // Add slip days
    expectedDateObj = new Date(expectedDateObj.getTime() + 5 * 86400000);
  }

  const expectedCompletion = expectedDateObj.toISOString().split("T")[0];
  let completionVariance = "On track with deadline";
  if (originalCompletion) {
    const diffDays = Math.round(
      (new Date(expectedCompletion).getTime() - new Date(originalCompletion).getTime()) / (1000 * 86400000)
    );
    if (diffDays > 0) {
      completionVariance = `${diffDays} day${diffDays > 1 ? "s" : ""} after original deadline`;
    } else if (diffDays < 0) {
      completionVariance = `${Math.abs(diffDays)} days ahead of deadline`;
    }
  }

  const summaryText =
    health.overallStatus === "healthy"
      ? `Project is performing well at ${health.overallScore}% health. Focus on finishing scheduled deliverables today.`
      : `Project is currently rated ${health.statusLabel} (${health.overallScore}%). Address critical blockers to prevent schedule drift.`;

  return {
    todayDateFormatted: todayFormatted,
    greeting,
    priorityItems,
    projectHealthScore: health.overallScore,
    projectHealthLabel: health.statusLabel,
    expectedCompletion,
    originalCompletion,
    completionVariance,
    summaryText,
  };
}

/**
 * Transforms Database Activity Events into Project Timeline / Time Machine
 */
export function buildTimelineEvents(
  activity: RawActivityEvent[],
  profiles: RawProfileItem[],
  tasks: RawTaskItem[]
): TimelineEvent[] {
  const profileMap = buildProfileMap(profiles);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const events: TimelineEvent[] = [];

  for (const a of activity) {
    const actor = a.actor_id ? profileMap.get(a.actor_id)?.name || "Team Member" : "System / Orbitwork";
    const task = a.task_id ? taskMap.get(a.task_id) : null;
    const taskTitle = task?.title || (a.details?.title as string) || "Task";

    let title = "Project Update";
    let description = "";
    let impactLevel: TimelineEvent["impactLevel"] = "low";

    switch (a.event_type) {
      case "schedule_changed": {
        const dueFrom = a.details?.due_from || "None";
        const dueTo = a.details?.due_to || "None";
        title = `Schedule Changed for "${taskTitle}"`;
        description = `Deadline moved from ${dueFrom} ➔ ${dueTo}`;
        impactLevel = "high";
        break;
      }
      case "status_changed": {
        title = `Status Transition on "${taskTitle}"`;
        description = `Task status updated by ${actor}`;
        impactLevel = "medium";
        break;
      }
      case "task_created": {
        title = `Task Created: "${taskTitle}"`;
        description = `New task added to project scope by ${actor}`;
        impactLevel = "low";
        break;
      }
      case "assignees_changed": {
        title = `Assignees Updated on "${taskTitle}"`;
        description = `Task ownership reassigned by ${actor}`;
        impactLevel = "medium";
        break;
      }
      case "priority_changed": {
        const from = a.details?.from || "normal";
        const to = a.details?.to || "normal";
        title = `Priority Adjusted on "${taskTitle}"`;
        description = `Priority changed from ${from} ➔ ${to}`;
        impactLevel = "medium";
        break;
      }
      case "comment_added": {
        title = `Comment on "${taskTitle}"`;
        description = `${actor} posted an update or feedback.`;
        impactLevel = "low";
        break;
      }
      default: {
        title = `${a.event_type.replace(/_/g, " ")} on "${taskTitle}"`;
        description = `Activity recorded by ${actor}`;
      }
    }

    const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent";

    events.push({
      id: String(a.id),
      date: dateStr,
      timestamp: a.created_at,
      eventType: a.event_type,
      title,
      description,
      actorName: actor,
      details: a.details,
      impactLevel,
    });
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}
