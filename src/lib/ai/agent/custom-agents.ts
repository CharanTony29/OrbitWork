import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "../client.ts";
import { AGENT_SYSTEM_PROMPT } from "./index.ts";
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
 * Execute an agent against a task
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

  // 1. Fetch task details
  const { data: task } = await supabase
    .from("tasks")
    .select("id, project_id, parent_task_id, title, description, priority, estimate_minutes, primary_assignee_id")
    .eq("id", taskId)
    .single();

  if (!task) {
    return { ok: false, summary: "Task not found" };
  }

  let summary = "";

  // 2. Action Execution
  switch (agent.action_type) {
    case "auto_assign_parent": {
      if (!task.parent_task_id) {
        summary = "Skipped: Task is not a subtask (no parent task to inherit from).";
        break;
      }

      // Fetch parent task assignee
      const { data: parent } = await supabase
        .from("tasks")
        .select("primary_assignee_id, secondary_assignee_id")
        .eq("id", task.parent_task_id)
        .single();

      if (!parent || !parent.primary_assignee_id) {
        summary = "Skipped: Parent task has no assignee.";
        break;
      }

      // Update subtask assignee
      await supabase
        .from("tasks")
        .update({
          primary_assignee_id: parent.primary_assignee_id,
          secondary_assignee_id: parent.secondary_assignee_id,
        })
        .eq("id", taskId);

      // Sync task_assignees relation table
      try {
        await supabase.from("task_assignees").upsert({
          project_id: projectId,
          task_id: taskId,
          user_id: parent.primary_assignee_id,
          assigned_by: userId,
        });
      } catch (err) {
        console.warn("[Agent auto-assign] upsert error:", err);
      }

      summary = `Assigned subtask "${task.title}" to parent task assignee.`;
      break;
    }

    case "generate_checklist": {
      const prompt = `
Task Title: "${task.title}"
${task.description ? `Description: "${task.description.slice(0, 1000)}"` : ""}

Generate 3 to 5 concrete, actionable acceptance criteria checklist items for this task.
Respond with ONLY a JSON array of strings, for example:
["Verify user authentication flow", "Test edge cases on mobile view", "Add integration tests"]
`.trim();

      const aiRes = await generateTextWithFallback({
        prompt,
        system: agent.system_instructions || AGENT_SYSTEM_PROMPT,
        temperature: 0.3,
      });

      const cleanJson = aiRes.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      let items: string[] = [];
      try {
        items = JSON.parse(cleanJson);
      } catch {
        items = cleanJson.split("\n").map((line) => line.replace(/^[-*•\d.]\s*/, "").trim()).filter(Boolean);
      }

      if (items.length > 0) {
        // Create checklist container
        const { data: cl } = await supabase
          .from("task_checklists")
          .insert({
            project_id: projectId,
            task_id: taskId,
            title: "Acceptance Criteria",
            created_by: userId,
          })
          .select("id")
          .single();

        if (cl) {
          for (let i = 0; i < items.length; i++) {
            await supabase.from("checklist_items").insert({
              checklist_id: cl.id,
              title: items[i],
              position: (i + 1) * 1000.0,
              created_by: userId,
            });
          }
        }
      }

      summary = `Generated ${items.length} acceptance checklist items.`;
      break;
    }

    case "estimate_time": {
      const prompt = `
Task Title: "${task.title}"
${task.description ? `Description: "${task.description.slice(0, 1000)}"` : ""}

Estimate realistic working duration in minutes and priority.
Respond with JSON matching:
{"estimateMinutes": 60, "priority": "normal"}
Where priority is one of: "urgent", "high", "normal", "low".
`.trim();

      const aiRes = await generateTextWithFallback({
        prompt,
        system: agent.system_instructions || AGENT_SYSTEM_PROMPT,
        temperature: 0.2,
      });

      const cleanJson = aiRes.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      try {
        const parsed = JSON.parse(cleanJson);
        const estimate = Number(parsed.estimateMinutes) || 60;
        const priority = ["urgent", "high", "normal", "low"].includes(parsed.priority)
          ? parsed.priority
          : "normal";

        await supabase
          .from("tasks")
          .update({
            estimate_minutes: estimate,
            priority,
          })
          .eq("id", taskId);

        summary = `Estimated at ${estimate}m with priority "${priority}".`;
      } catch {
        summary = "Completed estimation analysis.";
      }
      break;
    }

    case "custom_agent":
    default: {
      const prompt = `
Task Title: "${task.title}"
${task.description ? `Description: "${task.description.slice(0, 1000)}"` : ""}

Execute instructions:
${agent.system_instructions}

Provide a concise action summary.
`.trim();

      const aiRes = await generateTextWithFallback({
        prompt,
        system: AGENT_SYSTEM_PROMPT,
        temperature: 0.3,
      });

      summary = aiRes.text.slice(0, 300);
      break;
    }
  }

  // 3. Update agent stats
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
      status: "success",
      summary,
    });
  } catch (statErr) {
    console.warn("[CustomAgents] Stats update warning:", statErr);
  }

  return { ok: true, summary };
}

/**
 * Trigger active agents matching a specific trigger event (e.g. on_subtask_created)
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
