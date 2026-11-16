import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeCustomAgent, type CustomAIAgent } from "@/lib/ai/agent/custom-agents.ts";

export const dynamic = "force-dynamic";

const runSchema = z.object({
  projectId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  runAllTasks: z.boolean().optional(),
  runAllAgents: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
        return NextResponse.json({ error: "No active AI agents declared for this project" }, { status: 404 });
      }

      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (tasksErr || !tasks || tasks.length === 0) {
        return NextResponse.json({ error: "No tasks found in project to process" }, { status: 404 });
      }

      let totalSuccess = 0;
      for (const agent of agents) {
        for (const task of tasks) {
          try {
            const res = await executeCustomAgent({
              agent: agent as CustomAIAgent,
              taskId: task.id,
              projectId,
              userId: user.id,
            });
            if (res.ok) totalSuccess++;
          } catch (err) {
            console.error(`[Batch Run Error Agent ${agent.id} on Task ${task.id}]:`, err);
          }
        }
      }

      return NextResponse.json({
        success: true,
        processedCount: tasks.length,
        agentsCount: agents.length,
        summary: `Successfully executed ${agents.length} agent(s) across ${tasks.length} task(s). Project data updated.`,
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

      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (tasksErr || !tasks || tasks.length === 0) {
        return NextResponse.json({ error: "No tasks found in project to process" }, { status: 404 });
      }

      let totalSuccess = 0;
      for (const task of tasks) {
        try {
          const res = await executeCustomAgent({
            agent: agent as CustomAIAgent,
            taskId: task.id,
            projectId,
            userId: user.id,
          });
          if (res.ok) totalSuccess++;
        } catch (err) {
          console.error(`[Batch Run Error Agent ${agent.id} on Task ${task.id}]:`, err);
        }
      }

      return NextResponse.json({
        success: true,
        processedCount: tasks.length,
        summary: `Successfully ran "${agent.name}" on ${tasks.length} task(s). Past data has been updated.`,
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
