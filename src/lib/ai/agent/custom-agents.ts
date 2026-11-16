import { createClient } from "../../supabase/server.ts";
import { runAutonomousAgent } from "./autonomous-runner.ts";
import type {
  AgentTriggerType,
  AgentActionType,
  CustomAIAgent,
} from "./custom-agent-types.ts";
import { AGENT_TEMPLATES } from "./custom-agent-types.ts";

export type { AgentTriggerType, AgentActionType, CustomAIAgent };
export { AGENT_TEMPLATES };

/**
 * Fetch all declared custom AI agents for a project
 */
export async function getProjectCustomAgents(projectId: string): Promise<CustomAIAgent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_ai_agents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[CustomAgents] Table custom_ai_agents error:", error.message);
    return [];
  }

  return (data ?? []) as CustomAIAgent[];
}

/**
 * Execute an agent against a task using the autonomous tool-calling engine
 */
export async function executeCustomAgent({
  agent,
  taskId,
  projectId,
  userId,
}: {
  agent: CustomAIAgent;
  taskId: string;
  projectId: string;
  userId: string;
}): Promise<{ ok: boolean; summary: string }> {
  const supabase = await createClient();

  // 1. Verify task exists
  const { data: task } = await supabase
    .from("tasks")
    .select("id, project_id, title")
    .eq("id", taskId)
    .single();

  if (!task) {
    return { ok: false, summary: "Task not found" };
  }

  // 2. Determine effective instructions
  let effectiveInstructions = agent.system_instructions?.trim() || "";

  if (!effectiveInstructions) {
    switch (agent.action_type) {
      case "auto_assign_parent":
        effectiveInstructions =
          "If this task is a subtask with a parent task, check the parent task's primary assignee and assign this subtask to that same assignee.";
        break;
      case "generate_checklist":
        effectiveInstructions =
          "Inspect this task's title and description. Generate 3 to 5 concrete, actionable acceptance criteria checklist items for this task.";
        break;
      case "estimate_time":
        effectiveInstructions =
          "Inspect the task scope. Estimate a realistic duration in minutes and assign an appropriate priority level (low, normal, high, urgent).";
        break;
      default:
        effectiveInstructions =
          "Analyze the task requirements and perform any appropriate planning, subtask creation, or checklist generation.";
        break;
    }
  }

  // 3. Run autonomous agent loop with dynamic tool access
  let summary = "";
  let success = false;

  try {
    const result = await runAutonomousAgent({
      supabase,
      projectId,
      userId,
      targetTaskId: taskId,
      agentName: agent.name,
      systemInstructions: effectiveInstructions,
      triggerEvent: agent.trigger_type,
    });

    summary = result.summary;
    success = result.ok;
  } catch (err: unknown) {
    console.error(`[Custom Agent "${agent.name}" Execution Error]:`, err);
    summary = err instanceof Error ? err.message : "Agent execution failed";
    success = false;
  }

  // 4. Update agent statistics and audit log
  try {
    await supabase
      .from("custom_ai_agents")
      .update({
        runs_count: (agent.runs_count || 0) + 1,
        last_run_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    await supabase.from("custom_ai_agent_logs").insert({
      agent_id: agent.id,
      task_id: taskId,
      project_id: projectId,
      status: success ? "success" : "failed",
      summary: summary.slice(0, 500),
    });
  } catch (statErr) {
    console.warn("[CustomAgents] Stats update warning:", statErr);
  }

  return { ok: success, summary };
}

/**
 * Trigger active agents matching a specific trigger event (e.g. on_subtask_created, on_task_created)
 */
export async function triggerAgentsForEvent({
  triggerType,
  projectId,
  taskId,
  userId,
}: {
  triggerType: AgentTriggerType;
  projectId: string;
  taskId: string;
  userId: string;
}) {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("custom_ai_agents")
    .select("*")
    .eq("project_id", projectId)
    .eq("trigger_type", triggerType)
    .eq("enabled", true);

  if (!agents || agents.length === 0) return;

  for (const agent of agents) {
    try {
      await executeCustomAgent({
        agent: agent as CustomAIAgent,
        taskId,
        projectId,
        userId,
      });
    } catch (err) {
      console.error(`[CustomAgent Trigger Error for ${agent.name}]:`, err);
    }
  }
}
