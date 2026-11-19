import type { SupabaseClient } from "@supabase/supabase-js";
import { runAutonomousAgent, type RunAutonomousAgentResult } from "./autonomous-runner.ts";
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
  const { createClient } = await import("../../supabase/server.ts");
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
 * Generic AI Agent Execution Engine.
 * Executes ANY custom agent based on its name, natural-language instructions, trigger, and project context.
 * Performs real tool calls against the Orbitwork database, verifies persistence, and logs results.
 */
export async function executeCustomAgent({
  agent,
  projectId,
  userId,
  taskId,
  scope = taskId ? "task" : "project",
  supabaseClient,
}: {
  agent: CustomAIAgent;
  projectId: string;
  userId: string;
  taskId?: string;
  scope?: "project" | "task";
  supabaseClient?: SupabaseClient;
}): Promise<RunAutonomousAgentResult> {
  let supabase: SupabaseClient;
  if (supabaseClient) {
    supabase = supabaseClient;
  } else {
    const { createClient } = await import("../../supabase/server.ts");
    supabase = await createClient();
  }

  // Determine effective instructions from agent definition
  let effectiveInstructions = agent.system_instructions?.trim() || "";
  if (!effectiveInstructions) {
    if (agent.description?.trim()) {
      effectiveInstructions = agent.description.trim();
    } else {
      effectiveInstructions = `Execute actions appropriate for agent "${agent.name}" on project data. Inspect current tasks and apply necessary updates.`;
    }
  }

  // Execute using the generic autonomous reasoning engine
  let result: RunAutonomousAgentResult;

  try {
    result = await runAutonomousAgent({
      supabase,
      projectId,
      userId,
      targetTaskId: taskId,
      agentName: agent.name,
      systemInstructions: effectiveInstructions,
      triggerEvent: agent.trigger_type,
      scope,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Agent execution failed";
    console.error(`[Custom Agent "${agent.name}" Execution Error]:`, err);
    result = {
      ok: false,
      status: "failed",
      summary: `Execution encountered an error: ${errorMsg}`,
      actionLog: [`Execution error: ${errorMsg}`],
      verifiedUpdates: [],
      failedUpdates: [{ taskId: taskId || "project", reason: errorMsg, timestamp: new Date().toLocaleTimeString() }],
      verifiedCount: 0,
      failedCount: 1,
    };
  }

  // Update agent statistics in custom_ai_agents
  try {
    await supabase
      .from("custom_ai_agents")
      .update({
        runs_count: (agent.runs_count || 0) + 1,
        last_run_at: new Date().toISOString(),
      })
      .eq("id", agent.id);
  } catch (statErr) {
    console.warn("[CustomAgents] Stats update warning:", statErr);
  }

  // Write detailed execution log to custom_ai_agent_logs table
  try {
    const dbStatus: "success" | "failed" | "skipped" =
      result.status === "failed" ? "failed" : result.verifiedCount === 0 ? "skipped" : "success";

    await supabase.from("custom_ai_agent_logs").insert({
      agent_id: agent.id,
      task_id: taskId || null,
      project_id: projectId,
      status: dbStatus,
      summary: result.summary.slice(0, 1000),
    });
  } catch (logErr) {
    console.warn("[CustomAgents] Audit log insert warning:", logErr);
  }

  return result;
}

/**
 * Trigger active agents matching a specific trigger event (e.g. on_subtask_created, on_task_created, on_status_change)
 */
export async function triggerAgentsForEvent({
  triggerType,
  projectId,
  taskId,
  userId,
  supabaseClient,
}: {
  triggerType: AgentTriggerType;
  projectId: string;
  taskId: string;
  userId: string;
  supabaseClient?: SupabaseClient;
}) {
  let supabase: SupabaseClient;
  if (supabaseClient) {
    supabase = supabaseClient;
  } else {
    const { createClient } = await import("../../supabase/server.ts");
    supabase = await createClient();
  }
  const { data: agents, error } = await supabase
    .from("custom_ai_agents")
    .select("*")
    .eq("project_id", projectId)
    .eq("trigger_type", triggerType)
    .eq("enabled", true);

  if (error || !agents || agents.length === 0) return;

  for (const agent of agents) {
    try {
      await executeCustomAgent({
        agent: agent as CustomAIAgent,
        projectId,
        userId,
        taskId,
        scope: "task",
      });
    } catch (err) {
      console.error(`[CustomAgent Trigger Error for "${agent.name}"]:`, err);
    }
  }
}
