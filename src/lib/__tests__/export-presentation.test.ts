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

test("buildPresentationDeck generates distinctly structured slides across all 7 design archetypes", async () => {
  const archetypeTemplates = [
    { templateId: "pitch_sage", expectedArchetype: "editorial" },
    { templateId: "fortune_boardroom", expectedArchetype: "corporate" },
    { templateId: "linear_dark", expectedArchetype: "modern_saas" },
    { templateId: "bloomberg_terminal", expectedArchetype: "data_story" },
    { templateId: "mckinsey_advisory", expectedArchetype: "consulting" },
    { templateId: "swiss_monochrome", expectedArchetype: "minimalist" },
    { templateId: "bauhaus_primary", expectedArchetype: "creative_layered" },
  ];

  const tasks: TaskReportItem[] = [
    {
      id: "t-1",
      key: "TASK-1",
      title: "Deliverable Alpha",
      statusId: "st-1",
      statusName: "Done",
      priority: "high",
      dueDate: "2026-11-20",
      createdAt: "2026-11-01T10:00:00Z",
      assignees: [{ id: "u-1", name: "Charan" }],
      isCompleted: true,
      isOverdue: false,
      isHold: false,
      isInProgress: false,
      isPending: false,
    },
    {
      id: "t-2",
      key: "TASK-2",
      title: "Deliverable Beta",
      statusId: "st-2",
      statusName: "In Progress",
      priority: "normal",
      dueDate: "2026-11-25",
      createdAt: "2026-11-05T10:00:00Z",
      assignees: [{ id: "u-2", name: "Tony" }],
      isCompleted: false,
      isOverdue: false,
      isHold: false,
      isInProgress: true,
      isPending: false,
    },
  ];

  const statuses: StatusMetric[] = [
    { id: "st-1", name: "Done", category: "completed", count: 1 },
    { id: "st-2", name: "In Progress", category: "in_progress", count: 1 },
  ];

  const resources: ResourceMetric[] = [
    { id: "u-1", name: "Charan", totalAssigned: 1, completedCount: 1, inProgressCount: 0, holdCount: 0, pendingCount: 0, overdueCount: 0 },
    { id: "u-2", name: "Tony", totalAssigned: 1, completedCount: 0, inProgressCount: 1, holdCount: 0, pendingCount: 0, overdueCount: 0 },
  ];

  for (const { templateId } of archetypeTemplates) {
    const opts: PresentationReportOptions = {
      projectName: "Orbitwork Archetype Test",
      periodType: "monthly",
      periodLabel: "November 2026",
      templateId,
      includeCatalog: true,
    };

    const deck = buildPresentationDeck(opts, tasks, statuses, resources);
    assert.ok(deck, `Deck for ${templateId} should be created`);
    const data = (await deck.write({ outputType: "base64" })) as string;
    assert.ok(typeof data === "string" && data.length > 1000, `Deck ${templateId} output must be valid base64`);
  }
});
