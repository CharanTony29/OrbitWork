import { generateText, isStepCount } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getModelFallbackChain } from "../client.ts";
import { createAutonomousAgentTools } from "./tools.ts";

export interface RunAutonomousAgentOptions {
  supabase: SupabaseClient;
  projectId: string;
  userId: string;
  targetTaskId: string;
  agentName: string;
  systemInstructions: string;
  triggerEvent?: string;
}

export interface RunAutonomousAgentResult {
  ok: boolean;
  summary: string;
  actionLog: string[];
  providerUsed?: string;
}

const AUTONOMOUS_AGENT_SYSTEM_PROMPT = `You are Orbitwork's Autonomous AI Agent.
You operate directly on project management workflows and database entities (tasks, subtasks, checklists, dependencies, schedules, estimates, assignees).

Your job is to understand user natural language requests, analyze project data dynamically, and determine and execute the appropriate actions.

OPERATIONAL PRINCIPLES:
1. DISCOVER FIRST:
   - Use your tools (get_task_details, get_subtasks, get_project_context, etc.) to inspect the task, existing dates, estimates, parent bounds, existing subtasks, and team members.
   - Do NOT assume facts or hallucinate missing data. Retrieve the real context first.

2. REASON DYNAMICALLY:
   - Understand what the user wants to accomplish.
   - For scheduling requests: Check the parent task start and due dates. Calculate durations based on existing estimates (e.g. 120m = 2 hours, 480m = 1 working day). Sequence subtasks logically within the scheduling window. Ensure every subtask gets appropriate dates.
   - For planning/breakdown requests: Identify missing technical steps, create appropriate subtasks with estimates, and generate actionable acceptance checklists.
   - For estimation/prioritization: Evaluate task complexity and assign realistic minutes and priority levels.

3. EXECUTE SAFELY:
   - Call mutation tools (update_task, create_subtasks, create_checklist, add_task_comment, etc.) to apply changes.
   - Never attempt arbitrary destructive SQL. Use the provided tools.
   - If an action cannot be performed safely or information is fundamentally missing, state the reason clearly.

4. USER TRANSPARENCY:
   - Conclude with a clear, concise, professional summary of what you inspected and what changes you executed (e.g., "Scheduled 4 subtasks between Nov 16 and Nov 25 based on the parent task's scheduling window and subtask estimates.").
   - Mention task titles cleanly in bold (e.g., **Design UI**).
   - NEVER output internal tool call syntax, JSON blobs, database queries, UUIDs, or raw URL links in your final text.`;

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
  } = options;

  // 1. Fetch target task to provide immediate orientation
  const { data: initialTask } = await supabase
    .from("tasks")
    .select("id, title, description, start_date, due_date, estimate_minutes, priority, parent_task_id")
    .eq("id", targetTaskId)
    .single();

  if (!initialTask) {
    return {
      ok: false,
      summary: "Target task not found.",
      actionLog: [],
    };
  }

  // 2. Initialize tools with authorization context
  const { tools, getActionLog } = createAutonomousAgentTools({
    supabase,
    projectId,
    userId,
    targetTaskId,
    agentName,
  });

  // 3. Assemble dynamic prompt
  const taskContextStr = `
Target Task Orientation:
- Title: "${initialTask.title}"
- Current Start Date: ${initialTask.start_date || "Not set"}
- Current Due Date: ${initialTask.due_date || "Not set"}
- Current Estimate: ${initialTask.estimate_minutes ? `${initialTask.estimate_minutes}m` : "Not set"}
- Current Priority: ${initialTask.priority || "normal"}
- Is Subtask: ${Boolean(initialTask.parent_task_id)}
- Trigger Event: ${triggerEvent}
- Task ID: "${initialTask.id}"
`.trim();

  const userPrompt = `
You are executing agent "${agentName}".

User Instructions / Rules:
"""
${systemInstructions}
"""

${taskContextStr}

Instructions:
1. Use your inspection tools (get_task_details, get_subtasks, get_project_context, etc.) to examine the context.
2. Reason through the user's instructions and determine the necessary actions.
3. Call the appropriate mutation tools (e.g. update_task, create_subtasks, create_checklist) to carry out the instructions.
4. Conclude with a concise, plain-English summary of what you verified and executed.
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
        temperature: 0.2,
      });

      const actions = getActionLog();
      let summary = res.text.trim();

      // Clean up markdown quotes or JSON artifacts if the model wrapped it
      summary = summary
        .replace(/^```(?:markdown)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      // If the model produced empty text but executed tools, build summary from actionLog
      if (!summary || summary.length < 5) {
        if (actions.length > 0) {
          summary = `Successfully executed: ${actions.join("; ")}`;
        } else {
          summary = `Agent "${agentName}" analyzed task "${initialTask.title}" and found no modifications required.`;
        }
      }

      return {
        ok: true,
        summary,
        actionLog: actions,
        providerUsed: entry.name,
      };
    } catch (err: unknown) {
      console.warn(`[AutonomousAgent Failover]: Provider ${entry.name} failed:`, err instanceof Error ? err.message : err);
      lastError = err;
    }
  }

  throw lastError || new Error("All configured AI providers failed to run autonomous agent.");
}
