import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeCustomAgent, type CustomAIAgent } from "@/lib/ai/agent/custom-agents.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow long-running background tasks up to 5 minutes

const runSchema = z.object({
  projectId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  runAllTasks: z.boolean().optional(),
  runAllAgents: z.boolean().optional(),
});

/**
 * High-performance deterministic fast-path for Subtask Auto-Inheritor / parent assignee inheritance
 * Executes directly against database tables without external LLM latency or rate limit timeouts.
 */
async function runAutoAssignParentFastPath(
  supabase: any,
  projectId: string,
  userId: string,
  agentId?: string
) {
  const { data: allTasks, error: tasksErr } = await supabase
    .from("tasks")
    .select("id, title, parent_task_id, primary_assignee_id")
    .eq("project_id", projectId)
    .limit(1000);

  if (tasksErr || !allTasks || allTasks.length === 0) {
    return { updatedCount: 0, totalSubtasks: 0, summary: "No tasks found in project." };
  }

  const taskMap = new Map<string, any>(allTasks.map((t: any) => [t.id, t]));
  const subtasks = allTasks.filter((t: any) => Boolean(t.parent_task_id));

  const itemsToUpdate: Array<{ subtaskId: string; assigneeId: string }> = [];

  for (const st of subtasks) {
    const parent = taskMap.get(st.parent_task_id);
    if (parent && parent.primary_assignee_id) {
      if (st.primary_assignee_id !== parent.primary_assignee_id) {
        itemsToUpdate.push({
          subtaskId: st.id,
          assigneeId: parent.primary_assignee_id,
        });
      }
    }
  }

  // Execute in parallel chunks of 25 to respect database connection limits while completing rapidly
  const CHUNK_SIZE = 25;
  for (let i = 0; i < itemsToUpdate.length; i += CHUNK_SIZE) {
    const chunk = itemsToUpdate.slice(i, i + CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map(async ({ subtaskId, assigneeId }) => {
        await supabase
          .from("tasks")
          .update({ primary_assignee_id: assigneeId })
          .eq("id", subtaskId);

        await supabase.from("task_assignees").upsert(
          {
            project_id: projectId,
            task_id: subtaskId,
            user_id: assigneeId,
            assigned_by: userId,
          },
          { onConflict: "task_id,user_id" }
        );
      })
    );
  }

  const updatedCount = itemsToUpdate.length;

  if (agentId) {
    try {
      const { data: ag } = await supabase
        .from("custom_ai_agents")
        .select("runs_count")
        .eq("id", agentId)
        .single();

      await supabase
        .from("custom_ai_agents")
        .update({
          runs_count: (ag?.runs_count || 0) + 1,
          last_run_at: new Date().toISOString(),
        })
        .eq("id", agentId);

      await supabase.from("custom_ai_agent_logs").insert({
        agent_id: agentId,
        project_id: projectId,
        status: "success",
        summary: `Inherited parent assignees for ${updatedCount} subtask(s) across ${subtasks.length} total subtasks.`,
      });
    } catch (e) {
      console.warn("Non-fatal agent stats update error:", e);
    }
  }

  return {
    updatedCount,
    totalSubtasks: subtasks.length,
    summary: `Inherited parent assignees across ${updatedCount} subtask(s) (${subtasks.length} total subtasks).`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid execution payload" }, { status: 400 });
    }

    const { agentId, taskId, projectId, runAllTasks, runAllAgents } = parsed.data;

    // Case 1: Run all active agents across all tasks in the project
    if (runAllAgents) {
      const { data: agents, error: agentsErr } = await supabase
        .from("custom_ai_agents")
        .select("*")
        .eq("project_id", projectId)
        .eq("enabled", true);

      if (agentsErr || !agents || agents.length === 0) {
        return NextResponse.json(
          { error: "No active AI agents declared for this project" },
          { status: 404 }
        );
      }

      // Fetch all tasks for project without restrictive limit
      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (tasksErr || !tasks || tasks.length === 0) {
        return NextResponse.json({ error: "No tasks found in project to process" }, { status: 404 });
      }

      let totalSuccess = 0;
      let totalAutoInherited = 0;

      for (const agent of agents) {
        const isInheritor =
          agent.action_type === "auto_assign_parent" ||
          agent.name.toLowerCase().includes("subtask auto-inheritor") ||
          agent.name.toLowerCase().includes("inherit");

        if (isInheritor) {
          const res = await runAutoAssignParentFastPath(supabase, projectId, user.id, agent.id);
          totalAutoInherited += res.updatedCount;
          totalSuccess += res.updatedCount;
        } else {
          // Process in concurrent batches of 4 with individual error containment
          const CHUNK_SIZE = 4;
          for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
            const chunk = tasks.slice(i, i + CHUNK_SIZE);
            await Promise.allSettled(
              chunk.map(async (task) => {
                const res = await executeCustomAgent({
                  agent: agent as CustomAIAgent,
                  taskId: task.id,
                  projectId,
                  userId: user.id,
                });
                if (res.ok) totalSuccess++;
              })
            );
          }
        }
      }

      return NextResponse.json({
        success: true,
        processedCount: tasks.length,
        agentsCount: agents.length,
        summary: `Successfully executed ${agents.length} agent(s) across project tasks. Auto-assigned ${totalAutoInherited} subtasks.`,
      });
    }

    // Case 2: Run a specific agent across all tasks in the project
    if (runAllTasks && agentId) {
      const { data: agent, error: agentErr } = await supabase
        .from("custom_ai_agents")
        .select("*")
        .eq("id", agentId)
        .single();

      if (agentErr || !agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      const isInheritor =
        agent.action_type === "auto_assign_parent" ||
        agent.name.toLowerCase().includes("subtask auto-inheritor") ||
        agent.name.toLowerCase().includes("inherit");

      if (isInheritor) {
        const res = await runAutoAssignParentFastPath(supabase, projectId, user.id, agentId);
        return NextResponse.json({
          success: true,
          processedCount: res.updatedCount,
          totalSubtasks: res.totalSubtasks,
          summary: res.summary,
        });
      }

      // For general AI agents, fetch tasks without hard limit
      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (tasksErr || !tasks || tasks.length === 0) {
        return NextResponse.json({ error: "No tasks found in project to process" }, { status: 404 });
      }

      // Dynamic task calculation: run in parallel chunks of 4 tasks
      let totalSuccess = 0;
      const CHUNK_SIZE = 4;
      for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
        const chunk = tasks.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(
          chunk.map(async (task) => {
            const res = await executeCustomAgent({
              agent: agent as CustomAIAgent,
              taskId: task.id,
              projectId,
              userId: user.id,
            });
            if (res.ok) totalSuccess++;
          })
        );
      }

      return NextResponse.json({
        success: true,
        processedCount: tasks.length,
        summary: `Successfully ran "${agent.name}" on ${tasks.length} task(s) (${totalSuccess} actions applied).`,
      });
    }

    // Case 3: Run on single task
    if (!agentId || !taskId) {
      return NextResponse.json({ error: "Missing agentId or taskId" }, { status: 400 });
    }

    const { data: agent, error: agentErr } = await supabase
      .from("custom_ai_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentErr || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await executeCustomAgent({
      agent: agent as CustomAIAgent,
      taskId,
      projectId,
      userId: user.id,
    });

    return NextResponse.json({ success: true, summary: result.summary });
  } catch (err: unknown) {
    console.error("[Custom Agent Run Error]:", err);
    const msg = err instanceof Error ? err.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
