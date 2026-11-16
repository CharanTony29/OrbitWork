import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPresentationDeck,
  type PresentationReportOptions,
  type TaskReportItem,
  type StatusMetric,
  type ResourceMetric,
} from "../export-presentation.ts";

test("buildPresentationDeck generates valid PPTX with executive slides", async () => {
  const options: PresentationReportOptions = {
    projectName: "CEBI Engineering",
    workspaceName: "CEBI",
    organizationName: "CEBI Corp",
    periodType: "monthly",
    periodLabel: "Monthly Report: November 2026",
    includeCatalog: true,
  };

  const tasks: TaskReportItem[] = [
    {
      id: "task-1",
      key: "CEBI-101",
      title: "Release status - ITK Utility",
      taskType: "Task",
      statusId: "st-1",
      statusName: "In Progress",
      priority: "high",
      dueDate: "2026-11-20",
      createdAt: "2026-11-01T10:00:00Z",
      assignees: [{ id: "user-1", name: "Charan Dukka" }],
      isCompleted: false,
      isOverdue: false,
      isHold: false,
      isInProgress: true,
      isPending: false,
    },
    {
      id: "task-2",
      key: "CEBI-102",
      title: "LOV list to be created (First import Automate)",
      taskType: "Task",
      statusId: "st-2",
      statusName: "Hold",
      priority: "normal",
      dueDate: "2026-10-30",
      createdAt: "2026-10-15T10:00:00Z",
      assignees: [{ id: "user-2", name: "Leelavathi" }],
      isCompleted: false,
      isOverdue: true,
      isHold: true,
      isInProgress: false,
      isPending: false,
    },
    {
      id: "task-3",
      key: "CEBI-103",
      title: "NX Configurations",
      taskType: "Task",
      statusId: "st-3",
      statusName: "Done",
      priority: "normal",
      dueDate: "2026-11-10",
      createdAt: "2026-10-20T10:00:00Z",
      assignees: [{ id: "user-2", name: "Leelavathi" }],
      isCompleted: true,
      isOverdue: false,
      isHold: false,
      isInProgress: false,
      isPending: false,
    },
  ];

  const statuses: StatusMetric[] = [
    { id: "st-1", name: "In Progress", category: "in_progress", count: 1 },
    { id: "st-2", name: "Hold", category: "in_progress", count: 1 },
    { id: "st-3", name: "Done", category: "completed", count: 1 },
  ];

  const resources: ResourceMetric[] = [
    {
      id: "user-1",
      name: "Charan Dukka",
      totalAssigned: 1,
      completedCount: 0,
      inProgressCount: 1,
      holdCount: 0,
      pendingCount: 0,
      overdueCount: 0,
    },
    {
      id: "user-2",
      name: "Leelavathi",
      totalAssigned: 2,
      completedCount: 1,
      inProgressCount: 0,
      holdCount: 1,
      pendingCount: 0,
      overdueCount: 1,
    },
  ];

  const pptx = buildPresentationDeck(options, tasks, statuses, resources);
  assert.ok(pptx, "Presentation object should be created");

  const base64 = (await pptx.write({ outputType: "base64" })) as string;
  assert.ok(typeof base64 === "string", "Generated output should be string base64");
  assert.ok(base64.length > 1000, "Generated presentation should be non-empty");
});
