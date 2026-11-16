// src/lib/__tests__/brain.test.ts
// Unit tests for Orbitwork Project Brain Intelligence Engine

import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeDependencies,
  analyzeWorkload,
  computeProjectHealth,
  computeWhyAtRisk,
  detectRisks,
  generateDeterministicRecommendations,
  simulateChangeImpact,
} from "../brain/analytics.ts";
import type { AnalyticsContext, RawDependencyItem, RawStatusItem, RawTaskItem } from "../brain/types.ts";

const mockStatuses: RawStatusItem[] = [
  { id: "s-todo", name: "To Do", color: "#64748b", category: "planned", position: 0 },
  { id: "s-progress", name: "In Progress", color: "#3b82f6", category: "active", position: 1 },
  { id: "s-done", name: "Done", color: "#16a34a", category: "completed", position: 2 },
];

test("Project Brain: empty project returns healthy empty status without crashes", () => {
  const emptyCtx: AnalyticsContext = {
    projectId: "proj-empty",
    projectName: "Empty Project",
    projectDueDate: null,
    tasks: [],
    statuses: mockStatuses,
    dependencies: [],
    goals: [],
    documents: [],
    activity: [],
    profiles: [],
    taskAssignees: [],
    checklists: [],
    checklistItems: [],
  };

  const deps = analyzeDependencies(emptyCtx);
  assert.equal(deps.blockedTaskCount, 0);
  assert.equal(deps.blockingTaskCount, 0);
  assert.equal(deps.hasCircularDependencies, false);

  const workload = analyzeWorkload(emptyCtx);
  assert.equal(workload.overloadedCount, 0);

  const health = computeProjectHealth(emptyCtx, deps, workload);
  assert.equal(health.overallScore, 100);
  assert.equal(health.overallStatus, "healthy");
  assert.equal(health.categories.schedule.score, 100);
  assert.equal(health.categories.dependencies.score, 100);
});

test("Project Brain: calculates health penalties for overdue tasks and blockers", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const tasks: RawTaskItem[] = [
    {
      id: "t1",
      project_id: "p1",
      generated_key: "TSK-1",
      title: "API Backend Core",
      description: null,
      priority: "urgent",
      status_id: "s-progress",
      start_date: null,
      due_date: yesterday, // Overdue!
      estimate_minutes: 240,
      progress: 20,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u1",
      primary_assignee_id: "u1",
      secondary_assignee_id: null,
    },
    {
      id: "t2",
      project_id: "p1",
      generated_key: "TSK-2",
      title: "Mobile App Integration",
      description: null,
      priority: "normal",
      status_id: "s-todo",
      start_date: null,
      due_date: "2030-01-01",
      estimate_minutes: 180,
      progress: 0,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u2",
      primary_assignee_id: "u2",
      secondary_assignee_id: null,
    },
    {
      id: "t3",
      project_id: "p1",
      generated_key: "TSK-3",
      title: "QA Validation",
      description: null,
      priority: "normal",
      status_id: "s-todo",
      start_date: null,
      due_date: "2030-01-05",
      estimate_minutes: 120,
      progress: 0,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u2",
      primary_assignee_id: "u2",
      secondary_assignee_id: null,
    },
  ];

  // t1 blocks t2 and t3
  const dependencies: RawDependencyItem[] = [
    { project_id: "p1", task_id: "t1", linked_task_id: "t2", relation: "blocks" },
    { project_id: "p1", task_id: "t1", linked_task_id: "t3", relation: "blocks" },
  ];

  const ctx: AnalyticsContext = {
    projectId: "p1",
    projectName: "Test Project",
    projectDueDate: "2030-01-10",
    tasks,
    statuses: mockStatuses,
    dependencies,
    goals: [],
    documents: [],
    activity: [],
    profiles: [
      { id: "u1", display_name: "Rahul Dev", email: "rahul@example.com", avatar_url: null },
      { id: "u2", display_name: "Priya QA", email: "priya@example.com", avatar_url: null },
    ],
    taskAssignees: [],
    checklists: [],
    checklistItems: [],
  };

  const deps = analyzeDependencies(ctx);
  assert.equal(deps.blockingTaskCount, 1);
  assert.equal(deps.blockedTaskCount, 2);
  assert.equal(deps.criticalDependencies.length, 1);
  assert.equal(deps.criticalDependencies[0].blockerTask.taskId, "t1");
  assert.equal(deps.criticalDependencies[0].isOverdue, true);

  const workload = analyzeWorkload(ctx);
  const health = computeProjectHealth(ctx, deps, workload);

  // Health should be penalized due to overdue blocker
  assert.ok(health.overallScore < 85);
  assert.ok(health.categories.schedule.status === "warning" || health.categories.schedule.status === "danger");
  assert.ok(health.categories.blockers.score < 100);
});

test("Project Brain: detects circular dependency loops", () => {
  const tasks: RawTaskItem[] = [
    {
      id: "ta",
      project_id: "p2",
      generated_key: "A",
      title: "Task A",
      description: null,
      priority: "normal",
      status_id: "s-progress",
      start_date: null,
      due_date: null,
      estimate_minutes: null,
      progress: 0,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u1",
      primary_assignee_id: null,
      secondary_assignee_id: null,
    },
    {
      id: "tb",
      project_id: "p2",
      generated_key: "B",
      title: "Task B",
      description: null,
      priority: "normal",
      status_id: "s-progress",
      start_date: null,
      due_date: null,
      estimate_minutes: null,
      progress: 0,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u1",
      primary_assignee_id: null,
      secondary_assignee_id: null,
    },
  ];

  // A blocks B, and B blocks A
  const dependencies: RawDependencyItem[] = [
    { project_id: "p2", task_id: "ta", linked_task_id: "tb", relation: "blocks" },
    { project_id: "p2", task_id: "tb", linked_task_id: "ta", relation: "blocks" },
  ];

  const ctx: AnalyticsContext = {
    projectId: "p2",
    projectName: "Circular Project",
    projectDueDate: null,
    tasks,
    statuses: mockStatuses,
    dependencies,
    goals: [],
    documents: [],
    activity: [],
    profiles: [],
    taskAssignees: [],
    checklists: [],
    checklistItems: [],
  };

  const deps = analyzeDependencies(ctx);
  assert.equal(deps.hasCircularDependencies, true);
  assert.ok(deps.circularChains.length > 0);
});

test("Project Brain: simulates change impact accurately", () => {
  const tasks: RawTaskItem[] = [
    {
      id: "t-root",
      project_id: "p3",
      generated_key: "ROOT",
      title: "Root Dependency",
      description: null,
      priority: "high",
      status_id: "s-progress",
      start_date: null,
      due_date: "2026-12-01",
      estimate_minutes: 300,
      progress: 10,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u1",
      primary_assignee_id: "u1",
      secondary_assignee_id: null,
    },
    {
      id: "t-child",
      project_id: "p3",
      generated_key: "CHILD",
      title: "Child Dependent",
      description: null,
      priority: "normal",
      status_id: "s-todo",
      start_date: null,
      due_date: "2026-12-05",
      estimate_minutes: 120,
      progress: 0,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u1",
      primary_assignee_id: "u1",
      secondary_assignee_id: null,
    },
  ];

  const dependencies: RawDependencyItem[] = [
    { project_id: "p3", task_id: "t-root", linked_task_id: "t-child", relation: "blocks" },
  ];

  const ctx: AnalyticsContext = {
    projectId: "p3",
    projectName: "Impact Test",
    projectDueDate: "2026-12-15",
    tasks,
    statuses: mockStatuses,
    dependencies,
    goals: [],
    documents: [],
    activity: [],
    profiles: [{ id: "u1", display_name: "Rahul", email: "rahul@test.com", avatar_url: null }],
    taskAssignees: [],
    checklists: [],
    checklistItems: [],
  };

  const deps = analyzeDependencies(ctx);
  const workload = analyzeWorkload(ctx);

  // Simulate task due date change
  const impact = simulateChangeImpact(
    ctx,
    { changeType: "task_due_date", taskId: "t-root", newDate: "2026-12-08" },
    deps,
    workload
  );

  assert.equal(impact.affectedTaskCount, 2);
  assert.ok(impact.criticalTasks.some((t) => t.id === "t-root"));
  assert.ok(impact.criticalTasks.some((t) => t.id === "t-child"));
});

test("Project Brain: generates actionable preventive measures for workload concentration risks", () => {
  // Scenario matching user's project: Member u1 has 8 tasks, Member u2 has 2 tasks
  const tasks: RawTaskItem[] = [];
  for (let i = 1; i <= 8; i++) {
    tasks.push({
      id: `task-u1-${i}`,
      project_id: "p-workload",
      generated_key: `T-${i}`,
      title: `Feature Deliverable ${i}`,
      description: null,
      priority: i % 2 === 0 ? "high" : "normal",
      status_id: "s-progress",
      start_date: null,
      due_date: "2026-12-10",
      estimate_minutes: 120,
      progress: 0,
      parent_task_id: null,
      created_at: new Date().toISOString(),
      created_by: "u1",
      primary_assignee_id: "u1",
      secondary_assignee_id: null,
    });
  }
  tasks.push({
    id: "task-u2-1",
    project_id: "p-workload",
    generated_key: "T-9",
    title: "Support Task",
    description: null,
    priority: "normal",
    status_id: "s-progress",
    start_date: null,
    due_date: "2026-12-10",
    estimate_minutes: 60,
    progress: 0,
    parent_task_id: null,
    created_at: new Date().toISOString(),
    created_by: "u2",
    primary_assignee_id: "u2",
    secondary_assignee_id: null,
  });

  const ctx: AnalyticsContext = {
    projectId: "p-workload",
    projectName: "Workload Test Project",
    projectDueDate: "2026-12-25",
    tasks,
    statuses: mockStatuses,
    dependencies: [],
    goals: [],
    documents: [],
    activity: [],
    profiles: [
      { id: "u1", display_name: "Leela Lead", email: "leela@example.com", avatar_url: null },
      { id: "u2", display_name: "Lavanya Dev", email: "lavanya@example.com", avatar_url: null },
    ],
    taskAssignees: [],
    checklists: [],
    checklistItems: [],
  };

  const deps = analyzeDependencies(ctx);
  const workload = analyzeWorkload(ctx);
  const health = computeProjectHealth(ctx, deps, workload);
  const risks = detectRisks(ctx, deps, workload);

  // Risk should be detected for overloaded user
  const workloadRisk = risks.find((r) => r.id.startsWith("risk-workload-u1"));
  assert.ok(workloadRisk, "Expected workload concentration risk for u1");
  assert.equal(workloadRisk.probabilityLevel, "High");
  assert.ok(workloadRisk.mitigationStrategy);

  // Recommendations MUST contain concrete preventive measure for workload rebalancing
  const recommendations = generateDeterministicRecommendations(ctx, health, risks, deps, workload);
  assert.ok(recommendations.length > 0, "Recommendations should NOT be empty when workload risks exist");

  const rebalanceRec = recommendations.find((r) => r.actionType === "reassign_task");
  assert.ok(rebalanceRec, "Expected reassign_task preventive recommendation");
  assert.equal(rebalanceRec.actionPayload.newPrimaryAssigneeId, "u2");
  assert.ok(rebalanceRec.riskReductionScore && rebalanceRec.riskReductionScore > 0);
  assert.ok(rebalanceRec.healthImpactLabel);
});
