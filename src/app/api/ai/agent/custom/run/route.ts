import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeCustomAgent, type CustomAIAgent } from "@/lib/ai/agent/custom-agents.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow long-running agent executions up to 5 minutes

const runSchema = z.object({
  projectId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  runAllTasks: z.boolean().optional(),
  runAllAgents: z.boolean().optional(),
  batchOffset: z.number().int().min(0).optional(),
  batchSize: z.number().int().min(1).max(30).optional(),
  jobId: z.string().optional(),
});

type BatchLog = {
  taskId: string;
  taskTitle: string;
  status: "success" | "skipped" | "failed";
  actionTaken: string;
  timestamp: string;
};

// In-flight concurrency lock to prevent duplicate concurrent executions on the same project
const inFlightRuns = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized", reason: authError?.message || "No user found" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid execution payload", details: parsed.error.format() }, { status: 400 });
    }

    const {
      agentId,
      taskId,
      projectId,
      runAllAgents,
    } = parsed.data;

    // Check project permission
    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("id, name, workspace_id")
      .eq("id", projectId)
      .single();

    if (projectErr || !project) {
      return NextResponse.json({ error: "Project not found or inaccessible" }, { status: 404 });
    }

    // Check concurrency lock
    const lockKey = `${projectId}:${agentId || "all"}`;
    const now = Date.now();
    const runningSince = inFlightRuns.get(lockKey);
    if (runningSince && now - runningSince < 60000) {
      return NextResponse.json(
        { error: "This AI Agent is already actively running for this project. Please wait for it to complete." },
        { status: 409 }
      );
    }
    inFlightRuns.set(lockKey, now);

    try {
      // Case A: Run all active agents across the project
      if (runAllAgents) {
        const { data: agents, error: agentsErr } = await supabase
          .from("custom_ai_agents")
          .select("*")
          .eq("project_id", projectId)
          .eq("enabled", true);

        if (agentsErr || !agents || agents.length === 0) {
          return NextResponse.json(
            { error: "No enabled AI agents found for this project." },
            { status: 404 }
          );
        }

        const aggregatedLogs: BatchLog[] = [];
        let totalVerified = 0;
        let totalFailed = 0;
        const summaries: string[] = [];

        for (const agent of agents) {
          const res = await executeCustomAgent({
            agent: agent as CustomAIAgent,
            projectId,
            userId: user.id,
            scope: "project",
          });

          totalVerified += res.verifiedCount;
          totalFailed += res.failedCount;
          summaries.push(`**${agent.name}**: ${res.summary}`);

          for (const vu of res.verifiedUpdates) {
            aggregatedLogs.push({
              taskId: vu.taskId,
              taskTitle: vu.taskTitle || "Task",
              status: "success",
              actionTaken: `Verified: ${vu.field}`,
              timestamp: vu.timestamp || new Date().toLocaleTimeString(),
            });
          }

          for (const fu of res.failedUpdates) {
            aggregatedLogs.push({
              taskId: fu.taskId,
              taskTitle: fu.taskTitle || "Task",
              status: "failed",
              actionTaken: `Failed: ${fu.reason}`,
              timestamp: fu.timestamp || new Date().toLocaleTimeString(),
            });
          }

          if (res.verifiedUpdates.length === 0 && res.failedUpdates.length === 0) {
            aggregatedLogs.push({
              taskId: projectId,
              taskTitle: agent.name,
              status: "skipped",
              actionTaken: res.summary,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        }

        const overallStatus = totalFailed > 0 && totalVerified > 0
          ? "partially_completed"
          : totalFailed > 0 && totalVerified === 0
          ? "failed"
          : "completed";

        return NextResponse.json({
          success: overallStatus !== "failed",
          done: true,
          status: overallStatus,
          summary: summaries.join("\n\n"),
          verifiedCount: totalVerified,
          failedCount: totalFailed,
          totalTasks: Math.max(totalVerified, 1),
          processedInBatch: Math.max(totalVerified, 1),
          nextOffset: null,
          batchLogs: aggregatedLogs,
        });
      }

      // Case B: Run a specific agent (either on single task or on project)
      if (agentId) {
        const { data: agent, error: agentErr } = await supabase
          .from("custom_ai_agents")
          .select("*")
          .eq("id", agentId)
          .single();

        if (agentErr || !agent) {
          return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        const scope = taskId ? "task" : "project";
        const res = await executeCustomAgent({
          agent: agent as CustomAIAgent,
          projectId,
          userId: user.id,
          taskId,
          scope,
        });

        const batchLogs: BatchLog[] = [];

        // Add logs from verified updates
        for (const vu of res.verifiedUpdates) {
          batchLogs.push({
            taskId: vu.taskId,
            taskTitle: vu.taskTitle || "Task",
            status: "success",
            actionTaken: `Verified: ${vu.field}`,
            timestamp: vu.timestamp || new Date().toLocaleTimeString(),
          });
        }

        // Add logs from failed updates
        for (const fu of res.failedUpdates) {
          batchLogs.push({
            taskId: fu.taskId,
            taskTitle: fu.taskTitle || "Task",
            status: "failed",
            actionTaken: `Failed: ${fu.reason}`,
            timestamp: fu.timestamp || new Date().toLocaleTimeString(),
          });
        }

        // If no mutations were needed (e.g. all subtasks already completed), add an informative log
        if (batchLogs.length === 0) {
          batchLogs.push({
            taskId: taskId || projectId,
            taskTitle: agent.name,
            status: "skipped",
            actionTaken: res.summary,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        return NextResponse.json({
          success: res.ok,
          done: true,
          status: res.status,
          summary: res.summary,
          verifiedCount: res.verifiedCount,
          failedCount: res.failedCount,
          totalTasks: Math.max(res.verifiedCount, 1),
          processedInBatch: Math.max(res.verifiedCount, 1),
          nextOffset: null,
          batchLogs,
        });
      }

      return NextResponse.json({ error: "Missing agentId or runAllAgents parameter" }, { status: 400 });
    } finally {
      inFlightRuns.delete(lockKey);
    }
  } catch (err: unknown) {
    console.error("[Custom Agent Run API Error]:", err);
    const msg = err instanceof Error ? err.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
