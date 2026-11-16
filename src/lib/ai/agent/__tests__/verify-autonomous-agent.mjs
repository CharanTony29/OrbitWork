import { runAutonomousAgent } from "../autonomous-runner.ts";
import assert from "node:assert/strict";

/**
 * In-memory Mock Supabase for verifying autonomous tool calling
 */
function createMockSupabase(initialData) {
  const db = {
    tasks: JSON.parse(JSON.stringify(initialData.tasks || [])),
    task_checklists: JSON.parse(JSON.stringify(initialData.task_checklists || [])),
    checklist_items: JSON.parse(JSON.stringify(initialData.checklist_items || [])),
    task_comments: JSON.parse(JSON.stringify(initialData.task_comments || [])),
    project_statuses: JSON.parse(JSON.stringify(initialData.project_statuses || [])),
    projects: JSON.parse(JSON.stringify(initialData.projects || [])),
    profiles: JSON.parse(JSON.stringify(initialData.profiles || [])),
    task_dependencies: JSON.parse(JSON.stringify(initialData.task_dependencies || [])),
  };

  const client = {
    _db: db,
    from(table) {
      let rows = db[table] || [];
      let filters = [];
      let orderBy = null;
      let limitCount = null;

      const query = {
        select(fields) {
          return query;
        },
        eq(col, val) {
          filters.push((r) => r[col] === val);
          return query;
        },
        is(col, val) {
          filters.push((r) => r[col] === val);
          return query;
        },
        ilike(col, pattern) {
          const needle = pattern.replace(/%/g, "").toLowerCase();
          filters.push((r) => String(r[col] || "").toLowerCase().includes(needle));
          return query;
        },
        or(conditionStr) {
          return query;
        },
        order(col, { ascending = true } = {}) {
          orderBy = { col, ascending };
          return query;
        },
        limit(n) {
          limitCount = n;
          return query;
        },
        async single() {
          let filtered = rows.filter((r) => filters.every((f) => f(r)));
          return { data: filtered[0] || null, error: filtered[0] ? null : { message: "Row not found" } };
        },
        async then(resolve) {
          let filtered = rows.filter((r) => filters.every((f) => f(r)));
          if (orderBy) {
            filtered.sort((a, b) => (a[orderBy.col] > b[orderBy.col] ? 1 : -1));
            if (!orderBy.ascending) filtered.reverse();
          }
          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount);
          }
          resolve({ data: filtered, error: null });
        },
        insert(records) {
          const recArray = Array.isArray(records) ? records : [records];
          const inserted = recArray.map((r) => ({
            id: r.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...r,
          }));
          db[table].push(...inserted);

          return {
            select(fields) {
              return {
                async single() {
                  return { data: inserted[0], error: null };
                },
                then(resolve) {
                  resolve({ data: inserted, error: null });
                },
              };
            },
            then(resolve) {
              resolve({ data: inserted, error: null });
            },
          };
        },
        update(updates) {
          return {
            eq(col, val) {
              for (const r of db[table]) {
                if (r[col] === val) {
                  Object.assign(r, updates);
                }
              }
              return {
                eq(col2, val2) {
                  for (const r of db[table]) {
                    if (r[col] === val && r[col2] === val2) {
                      Object.assign(r, updates);
                    }
                  }
                  return Promise.resolve({ data: null, error: null });
                },
                then(resolve) {
                  resolve({ data: null, error: null });
                },
              };
            },
          };
        },
        upsert(record) {
          db[table].push(record);
          return Promise.resolve({ data: record, error: null });
        },
      };

      return query;
    },
  };

  return client;
}

async function runTests() {
  console.log("=== STARTING AUTONOMOUS AGENT VERIFICATION SUITE ===\n");

  // -------------------------------------------------------------
  // TEST 1: The User's Exact Case ("SubTask Dates assigner")
  // -------------------------------------------------------------
  console.log("[TEST 1]: Running user prompt 'SubTask Dates assigner'...");

  const test1Db = createMockSupabase({
    projects: [
      { id: "proj-1", name: "Orbit Project", start_date: "2026-11-16", due_date: "2026-11-25" },
    ],
    tasks: [
      {
        id: "task-parent-1",
        project_id: "proj-1",
        title: "Deploy application to production",
        description: "Parent deployment task",
        start_date: "2026-11-16",
        due_date: "2026-11-25",
        estimate_minutes: 600,
        priority: "high",
        parent_task_id: null,
      },
      {
        id: "sub-1",
        project_id: "proj-1",
        parent_task_id: "task-parent-1",
        title: "Prepare database migrations",
        description: "",
        start_date: null,
        due_date: null,
        estimate_minutes: 120,
        priority: "high",
      },
      {
        id: "sub-2",
        project_id: "proj-1",
        parent_task_id: "task-parent-1",
        title: "Run smoke & regression tests",
        description: "",
        start_date: null,
        due_date: null,
        estimate_minutes: 180,
        priority: "normal",
      },
      {
        id: "sub-3",
        project_id: "proj-1",
        parent_task_id: "task-parent-1",
        title: "Final security checklist & deploy",
        description: "",
        start_date: null,
        due_date: null,
        estimate_minutes: 120,
        priority: "urgent",
      },
    ],
  });

  const userRule1 = `Assign a start date and due date to each subtask based on the parent task's start date and due date. The parent task's start date and due date define the overall scheduling window. Use the existing estimation of each subtask as the primary reference when determining how much time each subtask should receive. Rules: - Do not change the parent task's start date or due date. - Use the parent task start date as the earliest possible start date for subtasks. - Use the parent task due date as the latest possible due date. - Use each subtask's existing estimation to determine its duration. - Schedule subtasks sequentially by default. - Ensure every subtask has a start date and due date.`;

  const res1 = await runAutonomousAgent({
    supabase: test1Db,
    projectId: "proj-1",
    userId: "user-123",
    targetTaskId: "task-parent-1",
    agentName: "SubTask Dates assigner",
    systemInstructions: userRule1,
    triggerEvent: "manual",
  });

  console.log("Test 1 Result:", res1.ok ? "SUCCESS" : "FAILED");
  console.log("Provider used:", res1.providerUsed);
  console.log("Summary:", res1.summary);
  console.log("Actions executed in DB:", res1.actionLog);

  // Assertions for Test 1
  assert.ok(res1.ok, "Agent run should succeed");
  const sub1 = test1Db._db.tasks.find((t) => t.id === "sub-1");
  const sub2 = test1Db._db.tasks.find((t) => t.id === "sub-2");
  const sub3 = test1Db._db.tasks.find((t) => t.id === "sub-3");

  console.log("Updated Subtask 1 dates:", sub1.start_date, "to", sub1.due_date);
  console.log("Updated Subtask 2 dates:", sub2.start_date, "to", sub2.due_date);
  console.log("Updated Subtask 3 dates:", sub3.start_date, "to", sub3.due_date);

  assert.ok(sub1.start_date && sub1.due_date, "Subtask 1 should have start and due dates assigned");
  assert.ok(sub2.start_date && sub2.due_date, "Subtask 2 should have start and due dates assigned");
  assert.ok(sub3.start_date && sub3.due_date, "Subtask 3 should have start and due dates assigned");
  console.log("✓ TEST 1 PASSED: Subtasks scheduled autonomously!\n");

  // -------------------------------------------------------------
  // TEST 2: Dynamic Feature Breakdown & Acceptance Checklist
  // -------------------------------------------------------------
  console.log("[TEST 2]: Running 'Prepare this feature for development'...");

  const test2Db = createMockSupabase({
    projects: [{ id: "proj-2", name: "Mobile App v2" }],
    tasks: [
      {
        id: "task-feature-1",
        project_id: "proj-2",
        title: "Implement Biometric Authentication",
        description: "Allow users to authenticate using Touch ID, Face ID, or device PIN on mobile devices.",
        priority: "normal",
        parent_task_id: null,
      },
    ],
    task_checklists: [],
    checklist_items: [],
  });

  const userRule2 = `Prepare this feature for development: Inspect the requirements, create appropriate subtasks with realistic estimates in minutes, and create an acceptance criteria checklist with at least 3 concrete verification points.`;

  const res2 = await runAutonomousAgent({
    supabase: test2Db,
    projectId: "proj-2",
    userId: "user-123",
    targetTaskId: "task-feature-1",
    agentName: "Dev Ready Agent",
    systemInstructions: userRule2,
    triggerEvent: "manual",
  });

  console.log("Test 2 Result:", res2.ok ? "SUCCESS" : "FAILED");
  console.log("Summary:", res2.summary);
  console.log("Actions executed:", res2.actionLog);

  assert.ok(res2.ok, "Test 2 should succeed");
  const createdSubtasks = test2Db._db.tasks.filter((t) => t.parent_task_id === "task-feature-1");
  const createdChecklists = test2Db._db.task_checklists.filter((c) => c.task_id === "task-feature-1");
  const createdItems = test2Db._db.checklist_items.filter((i) => i.task_id === "task-feature-1");

  console.log(`Created ${createdSubtasks.length} subtasks:`, createdSubtasks.map((s) => s.title));
  console.log(`Created ${createdChecklists.length} checklist with ${createdItems.length} items`);

  assert.ok(createdSubtasks.length >= 2, "Agent should have created subtasks");
  assert.ok(createdChecklists.length >= 1, "Agent should have created a checklist");
  assert.ok(createdItems.length >= 2, "Agent should have created checklist items");
  console.log("✓ TEST 2 PASSED: Feature prepared with subtasks and checklist autonomously!\n");

  // -------------------------------------------------------------
  // TEST 3: Priority Triage & Analysis Note
  // -------------------------------------------------------------
  console.log("[TEST 3]: Running 'Triage priority and add reminder comment'...");

  const test3Db = createMockSupabase({
    projects: [{ id: "proj-3", name: "Core API" }],
    tasks: [
      {
        id: "task-bug-1",
        project_id: "proj-3",
        title: "Fix Race Condition in Payment Webhook",
        description: "Intermittent double charge reported when webhook retries within 50ms.",
        priority: "normal",
        parent_task_id: null,
      },
    ],
    task_comments: [],
  });

  const userRule3 = `If this issue relates to billing or payments, upgrade its priority to urgent and post an analysis comment advising on idempotency keys.`;

  const res3 = await runAutonomousAgent({
    supabase: test3Db,
    projectId: "proj-3",
    userId: "user-123",
    targetTaskId: "task-bug-1",
    agentName: "Billing Safeguard Agent",
    systemInstructions: userRule3,
    triggerEvent: "manual",
  });

  console.log("Test 3 Result:", res3.ok ? "SUCCESS" : "FAILED");
  console.log("Summary:", res3.summary);
  console.log("Actions executed:", res3.actionLog);

  const bugTask = test3Db._db.tasks.find((t) => t.id === "task-bug-1");
  const comments = test3Db._db.task_comments.filter((c) => c.task_id === "task-bug-1");

  console.log("Updated priority:", bugTask.priority);
  console.log("Posted comments count:", comments.length);

  assert.equal(bugTask.priority, "urgent", "Task priority should be upgraded to urgent");
  assert.ok(comments.length >= 1, "An analysis comment should be posted");
  console.log("✓ TEST 3 PASSED: Priority triaged and comment posted autonomously!\n");

  console.log("=================================================");
  console.log("ALL 3 AUTONOMOUS AGENT TEST SCENARIOS PASSED 100%");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
