// src/lib/brain/types.ts
// Orbitwork Project Brain Type System

export type HealthStatusLevel = "healthy" | "needs_attention" | "at_risk" | "critical";

export type HealthCategoryKey =
  | "schedule"
  | "tasks"
  | "dependencies"
  | "workload"
  | "blockers"
  | "risks"
  | "milestones";

export interface HealthCategoryScore {
  key: HealthCategoryKey;
  label: string;
  score: number; // 0 - 100
  status: "good" | "warning" | "danger";
  details: string;
  metricLabel: string;
}

export interface ProjectHealthBreakdown {
  overallScore: number; // 0 - 100
  overallStatus: HealthStatusLevel;
  statusLabel: string;
  headlineExplanation: string;
  categories: Record<HealthCategoryKey, HealthCategoryScore>;
  calculatedAt: string;
}

export interface DependencyNodeInfo {
  taskId: string;
  taskKey: string;
  title: string;
  statusName: string;
  statusCategory: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  assignees: string[];
}

export interface DependencyChainNode {
  task: DependencyNodeInfo;
  relation: "blocks" | "blocked_by" | "related";
  children: DependencyChainNode[];
  depth: number;
}

export interface DependencyAnalysis {
  blockedTaskCount: number;
  blockingTaskCount: number;
  blockedTasks: Array<{
    task: DependencyNodeInfo;
    blockedBy: DependencyNodeInfo[];
  }>;
  blockingTasks: Array<{
    task: DependencyNodeInfo;
    blocksCount: number;
    blockedTasks: DependencyNodeInfo[];
  }>;
  criticalDependencies: Array<{
    blockerTask: DependencyNodeInfo;
    downstreamCount: number;
    isOverdue: boolean;
    reason: string;
  }>;
  dependencyChains: DependencyChainNode[];
  hasCircularDependencies: boolean;
  circularChains: string[][];
  overdueDependenciesCount: number;
}

export interface MemberWorkloadInfo {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  activeTaskCount: number;
  overdueTaskCount: number;
  criticalTaskCount: number;
  estimatedMinutesTotal: number;
  workloadPercentage: number;
  status: "underutilized" | "balanced" | "overloaded";
  taskTitles: string[];
  rawCapacityHours?: number;
  effectiveCapacityHours?: number;
  confidence?: "high" | "medium" | "low";
  confidenceReason?: string;
  explanation?: string;
  role?: string;
  experienceLevel?: string;
  unestimatedTasksCount?: number;
  potentialRedistribution?: {
    recommended: boolean;
    reason: string;
    targetMemberId?: string;
    targetMemberName?: string;
    taskId?: string;
    taskTitle?: string;
  };
}

export interface WorkloadAnalysis {
  members: MemberWorkloadInfo[];
  overloadedCount: number;
  underutilizedCount: number;
  unassignedTaskCount: number;
  recommendations: string[];
}

export interface RiskItem {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  probabilityScore: number | null; // e.g. 78 or null if qualitative
  probabilityLevel: "Critical" | "High" | "Medium" | "Low";
  reason: string;
  rootCause: string;
  affectedTasks: string[];
  affectedMilestones: string[];
  affectedPeople: string[];
  scheduleImpactDays: number | null;
  recommendedAction: string;
  // Preventive Measures Link
  preventiveMeasureId?: string;
  mitigationStrategy?: string;
  potentialRiskReductionPercent?: number;
}

export interface WhyAtRiskExplanation {
  headline: string;
  isAtRisk: boolean;
  chain: Array<{
    stage: string;
    description: string;
    evidence: string;
  }>;
  rootCause: string;
  directImpact: string;
  downstreamImpact: string;
  affectedTasks: Array<{ id: string; key: string; title: string }>;
  affectedMilestones: string[];
  affectedPeople: string[];
  expectedScheduleImpact: string;
}

export interface ProjectDecision {
  id: string;
  projectId: string;
  title: string;
  decisionDate: string;
  reason: string;
  impact: string;
  status: "proposed" | "accepted" | "superseded" | "deprecated" | "rejected";
  relatedTasks: string[];
  relatedDocuments: string[];
  tags: string[];
  decidedByName: string;
  decidedBy: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  timestamp: string;
  eventType: string;
  title: string;
  description: string;
  actorName: string;
  details: Record<string, unknown>;
  impactLevel: "low" | "medium" | "high";
}

export interface ChangeSimulationInput {
  changeType:
    | "project_deadline"
    | "task_due_date"
    | "task_reassign"
    | "task_status"
    | "dependency_add"
    | "dependency_remove"
    | "task_priority";
  taskId?: string;
  newDate?: string;
  newAssigneeId?: string;
  newAssigneeName?: string;
  newPriority?: string;
  newStatusCategory?: string;
  linkedTaskId?: string;
  deadlineDaysDelta?: number;
}

export interface ChangeImpactResult {
  summary: string;
  changeDescription: string;
  affectedTaskCount: number;
  affectedDependencyCount: number;
  affectedPeopleCount: number;
  affectedMilestoneCount: number;
  criticalTasks: Array<{ id: string; key: string; title: string }>;
  affectedPeople: string[];
  affectedMilestones: string[];
  potentialResult: string;
  recommendedActions: string[];
}

export interface ActionableRecommendation {
  id: string;
  projectId: string;
  title: string;
  description: string;
  whyRecommended: string;
  affectsDescription: string;
  expectedBenefit: string;
  possibleRisk: string;
  actionType:
    | "reschedule_task"
    | "reassign_task"
    | "remove_dependency"
    | "adjust_deadline"
    | "change_priority"
    | "custom";
  actionPayload: Record<string, unknown>;
  status: "pending" | "approved" | "applied" | "rejected" | "dismissed";
  appliedAt?: string | null;
  appliedBy?: string | null;
  createdAt: string;
  // Preventive Measure & Risk Reduction Enhancements
  riskId?: string;
  riskReductionScore?: number; // e.g. 50 (percentage risk reduction)
  riskReductionLabel?: string; // e.g. "↓ 50% Risk Reduction"
  healthImpactLabel?: string; // e.g. "+6% Health Score"
  category?: "workload" | "schedule" | "dependency" | "blocker" | "risk";
}

export interface TodayProjectBrief {
  todayDateFormatted: string;
  greeting: string;
  priorityItems: Array<{
    id: string;
    severity: "critical" | "high" | "normal";
    title: string;
    detail: string;
    taskId?: string;
    actionLabel?: string;
  }>;
  projectHealthScore: number;
  projectHealthLabel: string;
  expectedCompletion: string;
  originalCompletion: string | null;
  completionVariance: string;
  summaryText: string;
}

export interface SmartGraphNode {
  id: string;
  label: string;
  type: "project" | "goal" | "milestone" | "task" | "subtask" | "checklist" | "blocker";
  status?: string;
  priority?: string;
  isOverdue?: boolean;
  linkUrl?: string;
  progress?: number;
}

export interface SmartGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation: "contains" | "depends_on" | "blocks" | "child_of";
  dashed?: boolean;
}

export interface SmartProjectGraph {
  nodes: SmartGraphNode[];
  edges: SmartGraphEdge[];
}

export interface RawTaskItem {
  id: string;
  project_id: string;
  generated_key: string | null;
  title: string;
  description: string | null;
  priority: string;
  status_id: string;
  start_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  progress: number;
  parent_task_id: string | null;
  created_at: string;
  created_by: string;
  primary_assignee_id: string | null;
  secondary_assignee_id: string | null;
  task_type?: string | null;
}

export interface RawStatusItem {
  id: string;
  name: string;
  color: string;
  category: "planned" | "active" | "completed" | "cancelled";
  position: number;
}

export interface RawDependencyItem {
  project_id: string;
  task_id: string;
  linked_task_id: string;
  relation: "blocks" | "blocked_by" | "related" | "duplicate";
  created_at?: string;
}

export interface RawGoalItem {
  id: string;
  project_id: string;
  title: string;
  description: string;
  target_date: string | null;
  progress: number;
  status: "in_progress" | "completed";
  milestones: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    completed: boolean;
    completedAt?: string | null;
  }>;
}

export interface RawDocumentItem {
  id: string;
  project_id: string;
  title: string;
  body_markdown: string;
  updated_at: string;
}

export interface RawActivityEvent {
  id: number | string;
  project_id: string;
  task_id: string | null;
  actor_id: string | null;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface RawProfileItem {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface AnalyticsContext {
  projectId: string;
  projectName: string;
  projectDueDate: string | null;
  tasks: RawTaskItem[];
  statuses: RawStatusItem[];
  dependencies: RawDependencyItem[];
  goals: RawGoalItem[];
  documents: RawDocumentItem[];
  activity: RawActivityEvent[];
  profiles: RawProfileItem[];
  taskAssignees: Array<{ task_id: string; user_id: string }>;
  checklists: Array<{ id: string; task_id: string; title: string }>;
  checklistItems: Array<{ id: string; checklist_id: string; is_complete: boolean }>;
  currentUserId?: string;
}

export interface ProjectBrainFullPayload {
  projectId: string;
  projectName: string;
  projectDescription: string;
  projectDueDate: string | null;
  projectCreatedAt: string;
  health: ProjectHealthBreakdown;
  aiSummary: {
    text: string;
    generatedAt: string;
    provider?: string;
    isAiGenerated: boolean;
  };
  whyAtRisk: WhyAtRiskExplanation;
  dependencies: DependencyAnalysis;
  workload: WorkloadAnalysis;
  risks: RiskItem[];
  recommendations: ActionableRecommendation[];
  decisions: ProjectDecision[];
  timeline: TimelineEvent[];
  todayBrief: TodayProjectBrief;
  smartGraph: SmartProjectGraph;
  hasInsufficientData: boolean;
  insufficientDataReason?: string;
}
