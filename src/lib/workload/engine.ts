// src/lib/workload/engine.ts
// Centralized, Authoritative Workload Calculation & Rebalancing Engine for Orbitwork
// Evaluates effort, available capacity, effective capacity, experience, role compatibility, and task divisibility.

export type ExperienceLevel = "junior" | "mid" | "senior" | "lead";

export type OverloadStatus =
  | "healthy"              // 0 - 60%
  | "normal"               // 60 - 80%
  | "high"                 // 80 - 100%
  | "over_capacity"        // 100 - 120%
  | "severely_overloaded"; // > 120%

export type WorkloadConfidence = "high" | "medium" | "low";

export interface ExperienceConfig {
  juniorFactor: number; // default 0.80
  midFactor: number;    // default 1.00
  seniorFactor: number; // default 1.20
  leadFactor: number;   // default 1.25
}

export const DEFAULT_EXPERIENCE_CONFIG: ExperienceConfig = {
  juniorFactor: 0.80,
  midFactor: 1.00,
  seniorFactor: 1.20,
  leadFactor: 1.25,
};

export interface WorkloadThresholds {
  healthyMax: number;        // default 60%
  normalMax: number;         // default 80%
  highMax: number;           // default 100%
  overCapacityMax: number;   // default 120%
}

export const DEFAULT_WORKLOAD_THRESHOLDS: WorkloadThresholds = {
  healthyMax: 60,
  normalMax: 80,
  highMax: 100,
  overCapacityMax: 120,
};

export interface MemberProfileInput {
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
  designations?: string[];
  experienceLevel?: ExperienceLevel;
  rawCapacityHours?: number; // calculated from period, holidays & leaves
  workingDays?: number;      // default 5
  workingHoursPerDay?: number; // default 8
  holidaysHours?: number;    // default 0
  leaveHours?: number;       // default 0
}

export interface PeriodCapacityOptions {
  userId: string;
  period: "daily" | "weekly" | "monthly" | "yearly" | "custom" | "all";
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  month?: string | null; // e.g. "2026-11"
  year?: number | null;
  workingHoursPerDay?: number; // default 8
  holidays?: Array<{ holiday_date: string; name?: string }>;
  leaveRequests?: Array<{
    user_id: string;
    start_date: string;
    end_date: string;
    status?: string;
  }>;
}

export interface PeriodCapacityResult {
  periodType: string;
  startDate: string;
  endDate: string;
  totalCalendarDays: number;
  totalWorkingDays: number; // weekdays
  holidayDays: number;
  holidayHours: number;
  leaveDays: number;
  leaveHours: number;
  netWorkingDays: number;
  rawCapacityHours: number;
}

/**
 * Calculates authentic working capacity for a team member over a given planning period,
 * strictly counting Monday-Friday weekdays and excluding organization holidays and approved leaves.
 */
export function calculatePeriodCapacity(options: PeriodCapacityOptions): PeriodCapacityResult {
  const {
    userId,
    period,
    startDate,
    endDate,
    month,
    year,
    workingHoursPerDay = 8,
    holidays = [],
    leaveRequests = [],
  } = options;

  const now = new Date();
  let start: Date;
  let end: Date;

  if (period === "daily") {
    start = startDate ? new Date(startDate) : new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
  } else if (period === "weekly") {
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const curr = new Date(now);
      const day = curr.getUTCDay();
      const diff = curr.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
      start = new Date(Date.UTC(curr.getUTCFullYear(), curr.getUTCMonth(), diff, 0, 0, 0));
      end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 4); // Friday
      end.setUTCHours(23, 59, 59, 999);
    }
  } else if (period === "monthly") {
    let y = now.getUTCFullYear();
    let m = now.getUTCMonth(); // 0-based
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const parts = month.split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        y = parts[0];
        m = parts[1] - 1;
      }
    }
    start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    // Last day of month
    end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  } else if (period === "yearly") {
    const y = year || (startDate ? new Date(startDate).getUTCFullYear() : now.getUTCFullYear());
    start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
  } else if (period === "custom" && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    // "all" or default fallback: align to month bounds of target date/now
    let y = now.getUTCFullYear();
    let m = now.getUTCMonth();
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const parts = month.split("-").map(Number);
      y = parts[0];
      m = parts[1] - 1;
    }
    start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  }

  // Pre-index holidays by date string 'YYYY-MM-DD'
  const holidayDateSet = new Set<string>();
  for (const h of holidays) {
    if (h.holiday_date) {
      holidayDateSet.add(h.holiday_date.slice(0, 10));
    }
  }

  // Pre-filter approved leave requests for this user
  const userLeaves = leaveRequests.filter(
    (l) =>
      l.user_id === userId &&
      (!l.status || l.status.toLowerCase() === "approved")
  );

  let totalCalendarDays = 0;
  let totalWorkingDays = 0;
  let holidayDays = 0;
  let leaveDays = 0;

  const cur = new Date(start);
  cur.setUTCHours(12, 0, 0, 0); // midday UTC to prevent DST shifts
  const endUtcTime = end.getTime();

  while (cur.getTime() <= endUtcTime) {
    totalCalendarDays++;
    const dayOfWeek = cur.getUTCDay();
    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6; // Sunday (0) or Saturday (6)

    if (!isWeekendDay) {
      totalWorkingDays++;
      const dateStr = cur.toISOString().slice(0, 10);

      // Check if organization holiday falls on this weekday
      if (holidayDateSet.has(dateStr)) {
        holidayDays++;
      } else {
        // Check if user has an approved leave request covering this weekday
        const hasLeave = userLeaves.some((l) => {
          const lStart = l.start_date.slice(0, 10);
          const lEnd = l.end_date.slice(0, 10);
          return dateStr >= lStart && dateStr <= lEnd;
        });
        if (hasLeave) {
          leaveDays++;
        }
      }
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const holidayHours = holidayDays * workingHoursPerDay;
  const leaveHours = leaveDays * workingHoursPerDay;
  const grossCapacityHours = totalWorkingDays * workingHoursPerDay;
  const netWorkingDays = Math.max(0, totalWorkingDays - holidayDays - leaveDays);
  // Ensure minimum capacity of at least 8h if there are working days in the period
  const rawCapacityHours = Math.max(
    totalWorkingDays > 0 ? 8 : 0,
    grossCapacityHours - holidayHours - leaveHours
  );

  return {
    periodType: period,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    totalCalendarDays,
    totalWorkingDays,
    holidayDays,
    holidayHours,
    leaveDays,
    leaveHours,
    netWorkingDays,
    rawCapacityHours,
  };
}

export interface TaskWorkloadInput {
  id: string;
  title: string;
  estimateMinutes?: number | null;
  priority?: "urgent" | "high" | "normal" | "low";
  dueDate?: string | null;
  primaryAssigneeId?: string | null;
  secondaryAssigneeId?: string | null;
  assigneeIds?: string[];
  category?: string | null;
  isCompleted?: boolean;
  parentTaskId?: string | null;
  hasSubtasks?: boolean;
}

export interface MemberTaskBreakdown {
  id: string;
  title: string;
  estimatedHours: number;
  hasEstimate: boolean;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  isDivisible: boolean;
  detectedDomain: "backend" | "frontend" | "qa" | "devops" | "design" | "general";
}

export interface MemberWorkloadResult {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
  experienceLevel: ExperienceLevel;
  experienceFactor: number;
  assignedTasksCount: number;
  unestimatedTasksCount: number;
  confidence: WorkloadConfidence;
  confidenceReason: string;
  estimatedWorkloadHours: number;
  rawCapacityHours: number;
  effectiveCapacityHours: number;
  utilizationPercentage: number;
  status: OverloadStatus;
  statusLabel: string;
  explanation: string;
  taskBreakdown: MemberTaskBreakdown[];
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

export interface OverallWorkloadMetrics {
  totalTeamMembers: number;
  overloadedMembersCount: number;
  highUtilizationCount: number;
  balancedMembersCount: number;
  underutilizedMembersCount: number;
  unassignedTasksCount: number;
  totalBacklogHours: number;
  totalTeamEffectiveCapacityHours: number;
  overallTeamUtilizationPercentage: number;
  overallHealthStatus: "balanced" | "congested" | "critical";
  recommendations: string[];
}

export interface WorkloadEngineResult {
  members: MemberWorkloadResult[];
  metrics: OverallWorkloadMetrics;
  calculatedAt: string;
}

/**
 * Detects the technical domain of a task from its title and metadata.
 */
export function detectTaskDomain(
  title: string,
  category?: string | null
): "backend" | "frontend" | "qa" | "devops" | "design" | "general" {
  const text = `${title} ${category || ""}`.toLowerCase();

  if (
    /backend|database|sql|postgres|oracle|api|server|schema|migration|prisma|supabase|auth|endpoint|controller|service|query|performance.*db/i.test(
      text
    )
  ) {
    return "backend";
  }
  if (
    /frontend|ui|ux|css|html|react|component|modal|view|styling|layout|responsive|tailwind|theme|client/i.test(
      text
    )
  ) {
    return "frontend";
  }
  if (
    /qa|test|testing|e2e|cypress|jest|playwright|audit|defect|verification|regression/i.test(
      text
    )
  ) {
    return "qa";
  }
  if (
    /devops|ci\/cd|pipeline|docker|kubernetes|aws|deployment|deploy|cloud|infra|monitoring|terraform/i.test(
      text
    )
  ) {
    return "devops";
  }
  if (/design|figma|wireframe|mockup|prototype|brand|typography|vector/i.test(text)) {
    return "design";
  }
  return "general";
}

/**
 * Checks whether a person's role is compatible with a task domain.
 */
export function isRoleCompatibleWithDomain(
  role: string,
  domain: "backend" | "frontend" | "qa" | "devops" | "design" | "general"
): boolean {
  if (domain === "general") return true;

  const r = role.toLowerCase();

  // Fullstack, Principal, Lead, or general "Software Engineer" / "Developer" can handle frontend and backend
  if (/fullstack|lead|principal|director|cto/i.test(r)) return true;
  if (/software engineer|developer|engineer/i.test(r) && !/frontend|backend|qa|devops/i.test(r)) {
    return true; // General developer
  }

  if (domain === "backend") {
    return /backend|server|database|data engineer|fullstack/i.test(r);
  }
  if (domain === "frontend") {
    return /frontend|ui|web developer|fullstack/i.test(r);
  }
  if (domain === "qa") {
    return /qa|tester|test engineer|quality/i.test(r);
  }
  if (domain === "devops") {
    return /devops|cloud|infrastructure|sre|system admin/i.test(r);
  }
  if (domain === "design") {
    return /design|ux|ui designer|product designer/i.test(r);
  }

  return false;
}

/**
 * Determines whether a task can be divided/split safely.
 */
export function isTaskDivisible(task: TaskWorkloadInput): boolean {
  const hours = (task.estimateMinutes || 0) / 60;
  const title = task.title.toLowerCase();

  // Tasks explicitly atomic (deployments, release fixes, critical hotfixes, short tasks)
  if (/deploy|release|hotfix|patch|prod.*push|go.*live/i.test(title)) {
    return false;
  }
  if (hours <= 4 && !task.hasSubtasks) {
    return false;
  }

  // Divisible if large effort (>= 8h) or has subtasks or covers composite fullstack deliverables
  if (hours >= 8 || task.hasSubtasks) {
    return true;
  }
  if (/implement.*and|system|feature|portal|module|integration/i.test(title) && hours >= 6) {
    return true;
  }

  return false;
}

/**
 * Calculates experience-based effective capacity factor.
 */
export function getExperienceFactor(
  level: ExperienceLevel,
  config: ExperienceConfig = DEFAULT_EXPERIENCE_CONFIG
): number {
  switch (level) {
    case "junior":
      return config.juniorFactor;
    case "mid":
      return config.midFactor;
    case "senior":
      return config.seniorFactor;
    case "lead":
      return config.leadFactor;
    default:
      return 1.0;
  }
}

/**
 * Infers experience level from role name if not explicitly set.
 */
export function inferExperienceLevel(role: string): ExperienceLevel {
  const r = role.toLowerCase();
  if (/lead|principal|architect|manager|head/i.test(r)) return "lead";
  if (/senior|sr\b|specialist/i.test(r)) return "senior";
  if (/junior|jr\b|intern|associate|trainee/i.test(r)) return "junior";
  return "mid";
}

/**
 * Core Workload Engine.
 * Evaluates effort, capacity, experience factor, role compatibility, and divisibility.
 */
export function calculateWorkload(
  profiles: MemberProfileInput[],
  tasks: TaskWorkloadInput[],
  experienceConfig: ExperienceConfig = DEFAULT_EXPERIENCE_CONFIG,
  thresholds: WorkloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS
): WorkloadEngineResult {
  const todayStr = new Date().toISOString().split("T")[0];

  // Active tasks only, or fall back to all tasks if all are completed (e.g. completed sprint/review)
  const nonCompletedTasks = tasks.filter((t) => !t.isCompleted);
  const activeTasks = nonCompletedTasks.length > 0 ? nonCompletedTasks : tasks;

  // Group active tasks by assignee
  const tasksByMember = new Map<string, TaskWorkloadInput[]>();
  let unassignedCount = 0;

  for (const m of profiles) {
    tasksByMember.set(m.userId, []);
  }

  for (const t of activeTasks) {
    const assignees =
      t.assigneeIds && t.assigneeIds.length > 0
        ? t.assigneeIds
        : ([t.primaryAssigneeId, t.secondaryAssigneeId].filter(Boolean) as string[]);
    if (assignees.length === 0) {
      unassignedCount++;
      continue;
    }

    for (const uid of assignees) {
      if (!tasksByMember.has(uid)) {
        tasksByMember.set(uid, []);
      }
      tasksByMember.get(uid)!.push(t);
    }
  }

  const memberResults: MemberWorkloadResult[] = [];

  for (const p of profiles) {
    const memberTasks = tasksByMember.get(p.userId) || [];
    const expLevel = p.experienceLevel || inferExperienceLevel(p.role || "");
    const expFactor = getExperienceFactor(expLevel, experienceConfig);

    // Calculate Available (Raw) Capacity:
    // Raw Capacity = (workingDays * workingHoursPerDay) - holidays - leave
    const wDays = p.workingDays ?? 5;
    const wHours = p.workingHoursPerDay ?? 8;
    const baseCapacity = p.rawCapacityHours ?? wDays * wHours;
    const holidays = p.holidaysHours ?? 0;
    const leave = p.leaveHours ?? 0;
    const rawCapacityHours = Math.max(1, baseCapacity - holidays - leave);

    // Effective Capacity = Raw Capacity * experienceFactor
    const effectiveCapacityHours = Number((rawCapacityHours * expFactor).toFixed(1));

    // Calculate Estimated Workload Hours & Track missing estimates
    let totalEstimatedHours = 0;
    let unestimatedCount = 0;
    const breakdown: MemberTaskBreakdown[] = [];

    for (const t of memberTasks) {
      const assigneesCount = [t.primaryAssigneeId, t.secondaryAssigneeId].filter(Boolean).length || 1;
      const hasEstimate = typeof t.estimateMinutes === "number" && t.estimateMinutes > 0;
      const taskHours = hasEstimate
        ? Number(((t.estimateMinutes! / 60) / assigneesCount).toFixed(2))
        : 0;

      if (!hasEstimate) {
        unestimatedCount++;
      }

      totalEstimatedHours += taskHours;

      const dStr = t.dueDate ? String(t.dueDate).split("T")[0] : null;
      const isOverdue = Boolean(dStr && dStr < todayStr);
      const domain = detectTaskDomain(t.title, t.category);
      const isDiv = isTaskDivisible(t);

      breakdown.push({
        id: t.id,
        title: t.title,
        estimatedHours: taskHours,
        hasEstimate,
        priority: t.priority || "normal",
        dueDate: t.dueDate || null,
        isOverdue,
        isDivisible: isDiv,
        detectedDomain: domain,
      });
    }

    totalEstimatedHours = Number(totalEstimatedHours.toFixed(1));

    // Confidence calculation
    let confidence: WorkloadConfidence = "high";
    let confidenceReason = "All assigned tasks have validated effort estimates.";

    if (memberTasks.length > 0 && unestimatedCount > 0) {
      const ratio = unestimatedCount / memberTasks.length;
      if (ratio > 0.4 || unestimatedCount >= 3) {
        confidence = "low";
        confidenceReason = `Workload confidence is low because ${unestimatedCount} of ${memberTasks.length} tasks have no effort estimate.`;
      } else {
        confidence = "medium";
        confidenceReason = `${unestimatedCount} task(s) missing estimates; workload calculated from available data.`;
      }
    }

    // Workload Utilization: TOTAL ESTIMATED EFFORT / EFFECTIVE CAPACITY
    const utilization = Math.round((totalEstimatedHours / effectiveCapacityHours) * 100);

    // Overload classification based on configurable thresholds
    let status: OverloadStatus = "normal";
    let statusLabel = "Normal";

    if (utilization <= thresholds.healthyMax) {
      status = "healthy";
      statusLabel = "Healthy / Available";
    } else if (utilization <= thresholds.normalMax) {
      status = "normal";
      statusLabel = "Balanced";
    } else if (utilization <= thresholds.highMax) {
      status = "high";
      statusLabel = "High Utilization";
    } else if (utilization <= thresholds.overCapacityMax) {
      status = "over_capacity";
      statusLabel = "Over Capacity";
    } else {
      status = "severely_overloaded";
      statusLabel = "Severely Overloaded";
    }

    // Explainable reasoning string
    const roleTitle = p.role || "Team Contributor";
    const expExplanation =
      expFactor !== 1.0
        ? ` (Adjusted by ${expLevel} factor of ${expFactor}x to ${effectiveCapacityHours}h effective capacity)`
        : "";

    const explanation =
      `Assigned effort: ${totalEstimatedHours}h across ${memberTasks.length} tasks | ` +
      `Available capacity: ${rawCapacityHours}h${expExplanation} | ` +
      `Utilization: ${utilization}% (${statusLabel}). Role: ${roleTitle}.`;

    memberResults.push({
      userId: p.userId,
      name: p.name,
      email: p.email || "",
      avatarUrl: p.avatarUrl,
      role: roleTitle,
      experienceLevel: expLevel,
      experienceFactor: expFactor,
      assignedTasksCount: memberTasks.length,
      unestimatedTasksCount: unestimatedCount,
      confidence,
      confidenceReason,
      estimatedWorkloadHours: totalEstimatedHours,
      rawCapacityHours,
      effectiveCapacityHours,
      utilizationPercentage: utilization,
      status,
      statusLabel,
      explanation,
      taskBreakdown: breakdown,
    });
  }

  // Workload Balancing Engine: Identify same-role / compatible-role redistribution opportunities
  for (const src of memberResults) {
    if (src.status === "over_capacity" || src.status === "severely_overloaded" || src.status === "high") {
      // Find candidate tasks to reassign or split
      const candidateTask = src.taskBreakdown.find((t) => t.hasEstimate && t.estimatedHours >= 2);

      if (candidateTask) {
        // Look for compatible team members with available capacity (healthy/normal status)
        const compatibleTarget = memberResults.find((target) => {
          if (target.userId === src.userId) return false;
          if (target.status !== "healthy" && target.status !== "normal") return false;

          // Check role compatibility with task domain
          const compatibleWithTask = isRoleCompatibleWithDomain(target.role, candidateTask.detectedDomain);
          return compatibleWithTask;
        });

        if (compatibleTarget) {
          const shiftHours = candidateTask.estimatedHours;
          const resultingSrcHours = Math.max(0, src.estimatedWorkloadHours - shiftHours);
          const resultingTargetHours = compatibleTarget.estimatedWorkloadHours + shiftHours;
          const newSrcUtil = Math.round((resultingSrcHours / src.effectiveCapacityHours) * 100);
          const newTargetUtil = Math.round((resultingTargetHours / compatibleTarget.effectiveCapacityHours) * 100);

          src.potentialRedistribution = {
            recommended: true,
            reason:
              `Move "${candidateTask.title}" (${shiftHours}h) from ${src.name} to ${compatibleTarget.name}. ` +
              `Reduces ${src.name}'s utilization from ${src.utilizationPercentage}% → ${newSrcUtil}% and brings ${compatibleTarget.name} to ${newTargetUtil}%.`,
            targetMemberId: compatibleTarget.userId,
            targetMemberName: compatibleTarget.name,
            taskId: candidateTask.id,
            taskTitle: candidateTask.title,
            hoursToShift: shiftHours,
            resultingUtilizationSelf: newSrcUtil,
            resultingUtilizationTarget: newTargetUtil,
          };
        } else {
          // If candidate members exist but role is incompatible:
          const hasAvailableMembers = memberResults.some(
            (m) => m.userId !== src.userId && (m.status === "healthy" || m.status === "normal")
          );
          if (hasAvailableMembers) {
            src.potentialRedistribution = {
              recommended: false,
              reason: `Team members have available capacity, but task "${candidateTask.title}" requires ${candidateTask.detectedDomain} skills. No role-compatible candidate identified.`,
            };
          }
        }
      }
    }
  }

  // Calculate high-level team metrics
  const totalEffort = memberResults.reduce((acc, m) => acc + m.estimatedWorkloadHours, 0);
  const totalEffectiveCap = memberResults.reduce((acc, m) => acc + m.effectiveCapacityHours, 0);
  const teamUtil = totalEffectiveCap > 0 ? Math.round((totalEffort / totalEffectiveCap) * 100) : 0;

  const overloadedCount = memberResults.filter(
    (m) => m.status === "over_capacity" || m.status === "severely_overloaded"
  ).length;
  const highCount = memberResults.filter((m) => m.status === "high").length;
  const balancedCount = memberResults.filter((m) => m.status === "normal").length;
  const healthyCount = memberResults.filter((m) => m.status === "healthy").length;

  const overallHealth =
    overloadedCount >= 2 || teamUtil > 100
      ? "critical"
      : overloadedCount > 0 || highCount > 2 || teamUtil > 80
      ? "congested"
      : "balanced";

  const recommendations: string[] = [];
  for (const m of memberResults) {
    if (m.potentialRedistribution && m.potentialRedistribution.recommended) {
      recommendations.push(m.potentialRedistribution.reason);
    }
  }

  if (unassignedCount > 0) {
    recommendations.push(
      `${unassignedCount} task(s) currently unassigned. Review priority and distribute to available members.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Workload is balanced across the team; capacity matches sprint commitments.");
  }

  return {
    members: memberResults.sort((a, b) => b.utilizationPercentage - a.utilizationPercentage),
    metrics: {
      totalTeamMembers: memberResults.length,
      overloadedMembersCount: overloadedCount,
      highUtilizationCount: highCount,
      balancedMembersCount: balancedCount,
      underutilizedMembersCount: healthyCount,
      unassignedTasksCount: unassignedCount,
      totalBacklogHours: Number(totalEffort.toFixed(1)),
      totalTeamEffectiveCapacityHours: Number(totalEffectiveCap.toFixed(1)),
      overallTeamUtilizationPercentage: teamUtil,
      overallHealthStatus: overallHealth,
      recommendations,
    },
    calculatedAt: new Date().toISOString(),
  };
}
