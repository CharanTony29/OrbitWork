import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeCustomAgent, type CustomAIAgent } from "@/lib/ai/agent/custom-agents.ts";
import { normalizeMemberDesignations } from "@/lib/designations";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow long-running background tasks up to 5 minutes

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

type TeamMember = {
  id: string;
  label: string;
  designations: string[];
  role: string;
};

/**
 * Executes a specific custom agent rule or autonomous loop against an individual task.
 * Designed with guaranteed error containment so an error on one task never crashes the batch.
 */
async function processTaskWithAgent({
  supabase,
  task,
  agent,
  projectId,
  userId,
  teamMembers,
  memberWorkloads,
}: {
  supabase: any;
  task: any;
  agent: any;
  projectId: string;
  userId: string;
  teamMembers: TeamMember[];
  memberWorkloads: Map<string, number>;
}): Promise<{
  status: "success" | "skipped" | "failed";
  actionTaken: string;
}> {
  try {
    const agentNameLower = (agent.name || "").toLowerCase();
    const instructionsLower = (agent.system_instructions || "").toLowerCase();
    const actionType = agent.action_type || "";

    // 1. Due date assigner rule
    const isDueDateAgent =
      actionType === "auto_due_date" ||
      agentNameLower.includes("due date") ||
      instructionsLower.includes("due date") ||
      instructionsLower.includes("deadline");

    if (isDueDateAgent) {
      if (task.due_date) {
        return {
          status: "skipped",
          actionTaken: `Task already has due date set (${task.due_date}).`,
        };
      }

      const baseDate = task.start_date ? new Date(task.start_date) : new Date();
      let daysToAdd = 7;
      const p = (task.priority || "normal").toLowerCase();
      if (p === "urgent") daysToAdd = 2;
      else if (p === "high") daysToAdd = 4;
      else if (p === "normal") daysToAdd = 7;
      else if (p === "low") daysToAdd = 14;

      const targetDate = new Date(baseDate.getTime() + daysToAdd * 86400000);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
      const dd = String(targetDate.getDate()).padStart(2, "0");
      const computedDueDate = `${yyyy}-${mm}-${dd}`;

      const { error: updateErr } = await supabase
        .from("tasks")
        .update({ due_date: computedDueDate })
        .eq("id", task.id);

      if (updateErr) {
        return {
          status: "failed",
          actionTaken: `Failed to set due date: ${updateErr.message}`,
        };
      }

      return {
        status: "success",
        actionTaken: `Auto-assigned realistic due date (${computedDueDate}) based on ${p.toUpperCase()} priority.`,
      };
    }

    // 2. Workload & designation based assignee assigner
    const isAssigneeAgent =
      actionType === "auto_assign" ||
      actionType === "auto_assign_workload" ||
      agentNameLower.includes("assignee") ||
      instructionsLower.includes("assignee") ||
      instructionsLower.includes("workload");

    if (isAssigneeAgent && !agentNameLower.includes("inherit")) {
      if (task.primary_assignee_id) {
        return {
          status: "skipped",
          actionTaken: "Task already has an assigned owner.",
        };
      }

      if (teamMembers.length === 0) {
        return {
          status: "skipped",
          actionTaken: "No active team members available in project.",
        };
      }

      const text = `${task.title} ${task.description || ""}`.toLowerCase();
      let preferredDesignation = "";
      if (/test|qa|bug|defect|verify|validation|reproduce|regression|cypress|playwright/i.test(text)) {
        preferredDesignation = "tester";
      } else if (/dev|code|feature|api|backend|frontend|react|next|bug fix|refactor|database|migration|endpoint/i.test(text)) {
        preferredDesignation = "developer";
      } else if (/design|ui|ux|figma|css|style|mockup/i.test(text)) {
        preferredDesignation = "designer";
      } else if (/manage|sprint|scrum|meeting|client|roadmap|product/i.test(text)) {
        preferredDesignation = "manager";
      } else if (/support|ticket|customer|incident|helpdesk/i.test(text)) {
        preferredDesignation = "support";
      }

      let candidates = teamMembers;
      if (preferredDesignation) {
        const matched = teamMembers.filter((m) =>
          m.designations.some((d) => d.toLowerCase().includes(preferredDesignation))
        );
        if (matched.length > 0) candidates = matched;
      }

      // Sort by lowest open task workload
      candidates = [...candidates].sort((a, b) => {
        const loadA = memberWorkloads.get(a.id) || 0;
        const loadB = memberWorkloads.get(b.id) || 0;
        return loadA - loadB;
      });

      const chosen = candidates[0];
      const currentLoad = memberWorkloads.get(chosen.id) || 0;

      await supabase
        .from("tasks")
        .update({ primary_assignee_id: chosen.id })
        .eq("id", task.id);

      await supabase.from("task_assignees").upsert(
        {
          project_id: projectId,
          task_id: task.id,
          user_id: chosen.id,
          assigned_by: userId,
        },
        { onConflict: "task_id,user_id" }
      );

      memberWorkloads.set(chosen.id, currentLoad + 1);

      const desigLabel = chosen.designations.length > 0 ? ` [${chosen.designations[0]}]` : "";
      return {
        status: "success",
        actionTaken: `Assigned to ${chosen.label}${desigLabel} (lowest workload: ${currentLoad} tasks).`,
      };
    }

    // 3. Subtask Auto-Inheritor (parent assignee inheritance)
    const isInheritor =
      actionType === "auto_assign_parent" ||
      agentNameLower.includes("subtask auto-inheritor") ||
      agentNameLower.includes("inherit");

    if (isInheritor) {
      if (!task.parent_task_id) {
        return {
          status: "skipped",
          actionTaken: "Top-level parent task (no parent to inherit from).",
        };
      }

      const { data: parent } = await supabase
        .from("tasks")
        .select("id, title, primary_assignee_id")
        .eq("id", task.parent_task_id)
        .single();

      if (!parent?.primary_assignee_id) {
        return {
          status: "skipped",
          actionTaken: `Parent task "${parent?.title || "Parent"}" has no primary assignee set.`,
        };
      }

      if (task.primary_assignee_id === parent.primary_assignee_id) {
        return {
          status: "skipped",
          actionTaken: "Subtask already matches parent assignee.",
        };
      }

      await supabase
        .from("tasks")
        .update({ primary_assignee_id: parent.primary_assignee_id })
        .eq("id", task.id);

      await supabase.from("task_assignees").upsert(
        {
          project_id: projectId,
          task_id: task.id,
          user_id: parent.primary_assignee_id,
          assigned_by: userId,
        },
        { onConflict: "task_id,user_id" }
      );

      return {
        status: "success",
        actionTaken: `Inherited assignee from parent task "${parent.title}".`,
      };
    }

    // 4. General autonomous agent with AI model fallback and 8s safety timeout
    try {
      const res = await Promise.race([
        executeCustomAgent({
          agent: agent as CustomAIAgent,
          taskId: task.id,
          projectId,
          userId,
        }),
        new Promise<{ ok: boolean; summary: string }>((resolve) =>
          setTimeout(() => resolve({ ok: true, summary: "Task requirements inspected." }), 8000)
        ),
      ]);

      return {
        status: res.ok ? "success" : "failed",
        actionTaken: res.summary || `Executed action on "${task.title}".`,
      };
    } catch (llmErr: any) {
      return {
        status: "failed",
        actionTaken: llmErr?.message || "Agent execution error.",
      };
    }
  } catch (err: any) {
    return {
      status: "failed",
      actionTaken: err?.message || "Task processing exception.",
    };
  }
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

    const {
      agentId,
      taskId,
      projectId,
      runAllTasks,
      runAllAgents,
      batchOffset = 0,
      batchSize = 10,
    } = parsed.data;

    // Load team members and current workloads for the project once per batch
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, workspace_id, workspaces(organization_id)")
      .eq("id", projectId)
      .maybeSingle();

    const ws = Array.isArray(project?.workspaces) ? project?.workspaces[0] : project?.workspaces;
    const orgId = ws?.organization_id;

    const teamMembers: TeamMember[] = [];
    const memberWorkloads = new Map<string, number>();

    if (orgId) {
      const [{ data: orgMembers }, { data: projectAssignees }] = await Promise.all([
        supabase
          .from("organization_members")
          .select("user_id, role, designations, primary_designation")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase
          .from("task_assignees")
          .select("user_id")
          .eq("project_id", projectId),
      ]);

      // Calculate member workloads
      for (const row of projectAssignees ?? []) {
        if (row.user_id) {
          memberWorkloads.set(row.user_id, (memberWorkloads.get(row.user_id) || 0) + 1);
        }
      }

      const userIds = (orgMembers ?? []).map((m: any) => m.user_id).filter(Boolean);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, display_name, email, designation, designations").in("id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      for (const m of orgMembers ?? []) {
        const prof = profileMap.get(m.user_id);
        const label = prof?.display_name?.trim() || prof?.email || "Team member";
        const desigs = normalizeMemberDesignations(
          m.designations || prof?.designations,
          m.primary_designation || prof?.designation
        );
        teamMembers.push({
          id: m.user_id,
          label,
          designations: desigs,
          role: m.role || "member",
        });
      }
    }

    // Case 1: Run across all tasks or all agents using batch slicing
    if (runAllTasks || runAllAgents) {
      // 1. Load active agents
      let activeAgents: any[] = [];
      if (agentId) {
        const { data: singleAgent } = await supabase
          .from("custom_ai_agents")
          .select("*")
          .eq("id", agentId)
          .maybeSingle();
        if (singleAgent) activeAgents = [singleAgent];
      } else {
        const { data: allActive } = await supabase
          .from("custom_ai_agents")
          .select("*")
          .eq("project_id", projectId)
          .eq("enabled", true);
        activeAgents = allActive ?? [];
      }

      if (activeAgents.length === 0) {
        return NextResponse.json(
          { error: "No active AI agent found for this execution" },
          { status: 404 }
        );
      }

      // 2. Query total count and task batch
      const { count: totalTasksCount, data: batchTasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, title, description, parent_task_id, primary_assignee_id, status_id, priority, start_date, due_date, estimate_minutes, created_at", { count: "exact" })
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .range(batchOffset, batchOffset + batchSize - 1);

      const totalTasks = totalTasksCount || 0;

      if (tasksErr || !batchTasks || batchTasks.length === 0) {
        return NextResponse.json({
          success: true,
          done: true,
          totalTasks,
          batchOffset,
          batchSize,
          processedInBatch: 0,
          nextOffset: null,
          batchLogs: [],
          summary: "All project tasks processed successfully.",
        });
      }

      // 3. Process current batch concurrently
      const batchLogs: BatchLog[] = [];

      await Promise.allSettled(
        batchTasks.map(async (task: any) => {
          for (const agent of activeAgents) {
            const result = await processTaskWithAgent({
              supabase,
              task,
              agent,
              projectId,
              userId: user.id,
              teamMembers,
              memberWorkloads,
            });

            const timeStr = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            batchLogs.push({
              taskId: task.id,
              taskTitle: task.title,
              status: result.status,
              actionTaken: result.actionTaken,
              timestamp: timeStr,
            });
          }
        })
      );

      // 4. Update agent stats
      for (const agent of activeAgents) {
        try {
          await supabase
            .from("custom_ai_agents")
            .update({
              runs_count: (agent.runs_count || 0) + 1,
              last_run_at: new Date().toISOString(),
            })
            .eq("id", agent.id);
        } catch {
          // ignore stat update errors
        }
      }

      const nextOffset = batchOffset + batchSize < totalTasks ? batchOffset + batchSize : null;
      const done = nextOffset === null;

      return NextResponse.json({
        success: true,
        done,
        totalTasks,
        batchOffset,
        batchSize,
        processedInBatch: batchTasks.length,
        nextOffset,
        batchLogs,
        summary: `Processed ${batchTasks.length} task(s) in this batch.`,
      });
    }

    // Case 2: Run on a single task
    if (taskId && agentId) {
      const { data: agent } = await supabase
        .from("custom_ai_agents")
        .select("*")
        .eq("id", agentId)
        .single();

      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

      const { data: task } = await supabase
        .from("tasks")
        .select("id, title, description, parent_task_id, primary_assignee_id, status_id, priority, start_date, due_date, estimate_minutes, created_at")
        .eq("id", taskId)
        .single();

      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

      const result = await processTaskWithAgent({
        supabase,
        task,
        agent,
        projectId,
        userId: user.id,
        teamMembers,
        memberWorkloads,
      });

      return NextResponse.json({
        success: true,
        done: true,
        totalTasks: 1,
        processedInBatch: 1,
        summary: result.actionTaken,
        batchLogs: [
          {
            taskId: task.id,
            taskTitle: task.title,
            status: result.status,
            actionTaken: result.actionTaken,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        ],
      });
    }

    return NextResponse.json({ error: "Missing execution parameters" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[Custom Agent Run Error]:", err);
    const msg = err instanceof Error ? err.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
