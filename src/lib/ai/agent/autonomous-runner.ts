import { generateText, isStepCount } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getModelFallbackChain } from "../client.ts";
import { createAutonomousAgentTools, type VerifiedUpdate, type FailedUpdate } from "./tools.ts";

export interface RunAutonomousAgentOptions {
  supabase: SupabaseClient;
  projectId: string;
  userId: string;
  targetTaskId?: string;
  agentName: string;
  systemInstructions: string;
  triggerEvent?: string;
  scope?: "project" | "task";
}

export interface RunAutonomousAgentResult {
  ok: boolean;
  status: "completed" | "partially_completed" | "failed";
  summary: string;
  actionLog: string[];
  verifiedUpdates: VerifiedUpdate[];
  failedUpdates: FailedUpdate[];
  verifiedCount: number;
  failedCount: number;
  providerUsed?: string;
}

const AUTONOMOUS_AGENT_SYSTEM_PROMPT = `You are Orbitwork's Autonomous Enterprise AI Agent.
You execute real project management workflows, database mutations, and cross-functional operations on Orbitwork Postgres database entities (tasks, subtasks, checklists, dependencies, schedules, estimates, assignees, workload, meetings, emails, documentation, presentations, and diagrams).

OPERATIONAL CAPABILITIES:
1. TASK MANAGEMENT:
   - create_task: Add new top-level project tasks with priority, estimates, and dates.
   - update_task & batch_update_tasks: Modify statuses, priorities, due dates, estimates, or assignees across multiple tasks at once.
   - auto_schedule_tasks: Automatically assign realistic, dependency-aware start and due dates to tasks missing deadlines.

2. WORKLOAD & CAPACITY INTELLIGENCE:
   - analyze_workload_and_capacity: Calculate member task counts, estimated minutes, detect overloaded members (>40 hrs) and available members.
   - rebalance_team_workload: Reassign tasks from overloaded contributors to members with spare capacity.

3. MEETINGS & VIRTUAL ROOMS:
   - create_project_meeting: Schedule meetings, set agendas, invite task owners, and generate Jitsi virtual meeting rooms.

4. EMAIL NOTIFICATIONS:
   - send_email_notification: Dispatch outbound emails to assignees with urgent/overdue tasks, sprint recaps, or meeting invites.

5. DOCUMENTATION & PRESENTATIONS:
   - create_project_document: Author specifications, release notes, sprint retrospectives, or SOPs in project_documents.
   - generate_project_presentation: Generate executive PowerPoint (.pptx) decks using real metrics and Orbitwork's 260+ corporate templates.
   - create_workflow_diagram: Author interactive node/edge flowcharts in project_documents.

OPERATIONAL MANDATE:
1. DISCOVER FIRST:
   - Retrieve real project data using inspection tools (query_project_tasks, get_project_context, analyze_workload_and_capacity).
   - Never assume facts or hallucinate database state. Examine actual database rows first.

2. REASON DYNAMICALLY OVER USER INTENT:
   - When asked to analyze sprint workload and redistribute tasks: call analyze_workload_and_capacity, identify overloaded members, then call rebalance_team_workload.
   - When asked to schedule meetings: identify relevant assignees (e.g. owners of critical/overdue tasks) and invoke create_project_meeting.
   - When asked to notify or email team members: call send_email_notification with task details.
   - When asked for documents, summaries, or presentations: call create_project_document and generate_project_presentation.
   - Multi-goal requests: Orchestrate multiple tools sequentially to fulfill the entire user intent.

3. EXECUTE REAL DATABASE ACTIONS:
   - Your tool calls perform real SQL updates/inserts against the Orbitwork database.
   - If no tasks match the user's criteria, DO NOT fabricate changes. Simply report findings honestly.

4. VERIFICATION & HONESTY:
   - Your mutation tools automatically verify database updates by re-querying Postgres.
   - NEVER claim an action succeeded unless verified by a tool.
   - Conclude with a clear, professional summary describing what you inspected and what was verified in the database.
   - Mention task titles clearly in bold (e.g. **Design UI**).`;

export async function runAutonomousAgent(
  options: RunAutonomousAgentOptions
): Promise<RunAutonomousAgentResult> {
  const {
    supabase,
    projectId,
    userId,
    targetTaskId,
    agentName,
    systemInstructions,
    triggerEvent = "manual",
    scope = targetTaskId ? "task" : "project",
  } = options;

  // 1. Initialize tools with authorization context
  const { tools, getActionLog, getVerifiedUpdates, getFailedUpdates } = createAutonomousAgentTools({
    supabase,
    projectId,
    userId,
    targetTaskId,
    agentName,
  });

  // 2. Fetch project context for orientation
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, priority, status")
    .eq("id", projectId)
    .single();

  const projectName = project?.name || "Current Project";

  // 3. Assemble context & prompt depending on scope
  let orientationStr = "";

  if (scope === "task" && targetTaskId) {
    const { data: initialTask } = await supabase
      .from("tasks")
      .select("id, title, description, start_date, due_date, estimate_minutes, priority, parent_task_id, status_id")
      .eq("id", targetTaskId)
      .eq("project_id", projectId)
      .single();

    if (initialTask) {
      orientationStr = `
Execution Scope: Single Task
Target Task Orientation:
- ID: "${initialTask.id}"
- Title: "${initialTask.title}"
- Description: "${initialTask.description || ""}"
- Current Start Date: ${initialTask.start_date || "Not set"}
- Current Due Date: ${initialTask.due_date || "Not set"}
- Current Estimate: ${initialTask.estimate_minutes ? `${initialTask.estimate_minutes}m` : "Not set"}
- Current Priority: ${initialTask.priority || "normal"}
- Is Subtask: ${Boolean(initialTask.parent_task_id)}
- Parent Task ID: ${initialTask.parent_task_id || "None (Root task)"}
- Trigger Event: ${triggerEvent}
`.trim();
    }
  }

  if (!orientationStr) {
    orientationStr = `
Execution Scope: Project-Wide ("${projectName}")
- Project ID: "${projectId}"
- Current System Time: ${new Date().toISOString()} (${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" })})
- Trigger: ${triggerEvent}
- Mode: Autonomous Agent scanning and acting across project tasks according to instructions.
`.trim();
  }

  const userPrompt = `
You are executing AI Agent "${agentName}".

User Instructions / Rules:
"""
${systemInstructions || "Inspect project tasks and perform any required maintenance or updates based on task scope."}
"""

${orientationStr}

Execution Steps:
1. DISCOVER: Call query_project_tasks to inspect existing tasks and find any items matching the user's rules (use filters like parentStatusCategory: 'completed', isSubtask: true, statusCategory, etc.).
2. REASON: Analyze the retrieved data. If no tasks need action, conclude honestly. If tasks match the rules, prepare the exact updates.
3. EXECUTE: Call update_task or batch_update_tasks or create_subtasks to apply changes.
4. VERIFY: Note the verified database updates returned by your tools.
5. SUMMARIZE: Conclude with a concise, professional summary stating the verified changes.
`.trim();

  // 4. Run with multi-provider failover
  const chain = getModelFallbackChain();
  let lastError: unknown = null;

  for (const entry of chain) {
    try {
      const res = await generateText({
        model: entry.model,
        system: AUTONOMOUS_AGENT_SYSTEM_PROMPT,
        prompt: userPrompt,
        tools,
        stopWhen: isStepCount(12),
        temperature: 0.1,
        abortSignal: AbortSignal.timeout(90000), // 90s safety timeout per provider for multi-step agent tool loops
      });

      const actions = getActionLog();
      const verified = getVerifiedUpdates();
      const failed = getFailedUpdates();

      let summary = res.text.trim();

      // Clean up markdown code wraps if present
      summary = summary
        .replace(/^```(?:markdown)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      if (!summary || summary.length < 5) {
        if (verified.length > 0) {
          summary = `Successfully executed and verified changes across ${verified.length} task(s).`;
        } else if (actions.length > 0) {
          summary = actions[actions.length - 1];
        } else {
          summary = `Agent "${agentName}" inspected project tasks and verified no changes were required.`;
        }
      }

      let status: "completed" | "partially_completed" | "failed" = "completed";
      if (failed.length > 0 && verified.length > 0) {
        status = "partially_completed";
      } else if (failed.length > 0 && verified.length === 0) {
        status = "failed";
      }

      return {
        ok: status !== "failed",
        status,
        summary,
        actionLog: actions,
        verifiedUpdates: verified,
        failedUpdates: failed,
        verifiedCount: verified.length,
        failedCount: failed.length,
        providerUsed: entry.name,
      };
    } catch (err: unknown) {
      console.warn(`[AutonomousAgent Failover]: Provider ${entry.name} failed:`, err instanceof Error ? err.message : err);
      lastError = err;
    }
  }

  throw lastError || new Error("All configured AI providers failed to run autonomous agent.");
}
