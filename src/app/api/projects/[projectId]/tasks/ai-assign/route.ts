import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client";
import { normalizeMemberDesignations, memberMatchesRole } from "@/lib/designations";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface CandidateMember {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  designations: string[];
  workloadCount: number;
  totalEstimateMinutes: number;
}

interface AssignmentResult {
  taskId: string;
  taskTitle: string;
  assignedUserId: string;
  assignedUserName: string;
  requiredRole: string;
  workloadCount: number;
  reason: string;
}

/**
 * Heuristic role classifier for tasks based on common keywords.
 * Used when AI output is offline, empty, or fails.
 */
function classifyTaskRoleHeuristic(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes("test") ||
    text.includes("qa") ||
    text.includes("verify") ||
    text.includes("regression") ||
    text.includes("e2e") ||
    text.includes("defect") ||
    text.includes("playwright") ||
    text.includes("cypress") ||
    text.includes("repro") ||
    text.includes("validation")
  ) {
    return "Tester";
  }

  if (
    text.includes("support") ||
    text.includes("ticket") ||
    text.includes("customer") ||
    text.includes("client issue") ||
    text.includes("helpdesk") ||
    text.includes("complaint")
  ) {
    return "Support";
  }

  if (
    text.includes("hr") ||
    text.includes("onboard") ||
    text.includes("interview") ||
    text.includes("payroll") ||
    text.includes("leave") ||
    text.includes("benefits") ||
    text.includes("candidate") ||
    text.includes("hiring")
  ) {
    return "HR";
  }

  if (
    text.includes("permission") ||
    text.includes("rbac") ||
    text.includes("credentials") ||
    text.includes("billing") ||
    text.includes("subscription") ||
    text.includes("dns") ||
    text.includes("tenant")
  ) {
    return "Admin";
  }

  // Developer is the primary category for code, bugs, features, and technical tasks
  return "Developer";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const db = adminClient ?? supabase;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", {
      target_project: projectId,
    });
    if (!canEdit) {
      return NextResponse.json(
        { error: "Forbidden: editor permissions required" },
        { status: 403 }
      );
    }

    let body: {
      taskId?: string;
      taskIds?: string[];
      autoAssignAll?: boolean;
      dryRun?: boolean;
    } = {};

    try {
      body = await req.json();
    } catch {
      body = { autoAssignAll: true };
    }

    const { taskId, taskIds, autoAssignAll = false, dryRun = false } = body;

    // 1. Fetch Candidate Team Members with their Designations
    const { data: projMembers } = await db
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId);

    let candidateUserIds = (projMembers || []).map((m: any) => m.user_id);

    // Fallback to workspace / organization members if project_members list is empty
    let orgId: string | null = null;
    if (candidateUserIds.length === 0) {
      const { data: project } = await db
        .from("projects")
        .select("workspaces ( organization_id )")
        .eq("id", projectId)
        .maybeSingle();

      const ws = Array.isArray(project?.workspaces)
        ? project?.workspaces[0]
        : project?.workspaces;
      orgId = ws?.organization_id ?? null;

      if (orgId) {
        const { data: orgMembers } = await db
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("status", "active");
        candidateUserIds = (orgMembers || []).map((m: any) => m.user_id);
      }
    }

    if (candidateUserIds.length === 0) {
      candidateUserIds = [user.id];
    }

    // Deduplicate candidate user IDs
    candidateUserIds = Array.from(new Set(candidateUserIds));

    // Fetch profiles & organization memberships for designations
    const [{ data: profiles }, { data: orgMembershipRows }] = await Promise.all([
      db
        .from("profiles")
        .select("id, display_name, email, avatar_url, designation, designations")
        .in("id", candidateUserIds),
      orgId
        ? db
            .from("organization_members")
            .select("user_id, designations, primary_designation")
            .eq("organization_id", orgId)
            .in("user_id", candidateUserIds)
        : Promise.resolve({ data: [] }),
    ]);

    const orgMemberMap = new Map(
      (orgMembershipRows || []).map((m: any) => [m.user_id, m])
    );

    // 2. Compute current active workload for each candidate member
    // Query open tasks in the project to count active load
    const [{ data: projectStatuses }, { data: activeTasks }, { data: extraAssignees }] =
      await Promise.all([
        db
          .from("project_statuses")
          .select("id, category")
          .eq("project_id", projectId),
        db
          .from("tasks")
          .select("id, primary_assignee_id, secondary_assignee_id, status_id, estimate_minutes")
          .eq("project_id", projectId),
        db
          .from("task_assignees")
          .select("task_id, user_id")
          .eq("project_id", projectId),
      ]);

    const closedStatusIds = new Set(
      (projectStatuses || [])
        .filter((s: any) => s.category === "completed" || s.category === "cancelled")
        .map((s: any) => s.id)
    );

    const taskLoadCounts = new Map<string, number>();
    const taskEstimateMinutes = new Map<string, number>();
    for (const uid of candidateUserIds) {
      taskLoadCounts.set(uid, 0);
      taskEstimateMinutes.set(uid, 0);
    }

    const extraMap = new Map<string, string[]>();
    for (const row of extraAssignees || []) {
      extraMap.set(row.task_id, [...(extraMap.get(row.task_id) ?? []), row.user_id]);
    }

    for (const t of activeTasks || []) {
      if (closedStatusIds.has(t.status_id)) continue;
      const assigneesOnTask = new Set<string>();
      if (t.primary_assignee_id) assigneesOnTask.add(t.primary_assignee_id);
      if (t.secondary_assignee_id) assigneesOnTask.add(t.secondary_assignee_id);
      for (const extraUid of extraMap.get(t.id) ?? []) {
        assigneesOnTask.add(extraUid);
      }

      for (const uid of assigneesOnTask) {
        if (taskLoadCounts.has(uid)) {
          taskLoadCounts.set(uid, (taskLoadCounts.get(uid) ?? 0) + 1);
          taskEstimateMinutes.set(
            uid,
            (taskEstimateMinutes.get(uid) ?? 0) + (Number(t.estimate_minutes) || 0)
          );
        }
      }
    }

    // Build Candidates List
    const candidates: CandidateMember[] = (profiles || []).map((p: any) => {
      const orgRow = orgMemberMap.get(p.id);
      const desigs = normalizeMemberDesignations(
        orgRow?.designations || p.designations,
        orgRow?.primary_designation || p.designation
      );

      return {
        id: p.id,
        name: p.display_name?.trim() || p.email || "Teammate",
        email: p.email,
        avatarUrl: p.avatar_url,
        designations: desigs,
        workloadCount: taskLoadCounts.get(p.id) ?? 0,
        totalEstimateMinutes: taskEstimateMinutes.get(p.id) ?? 0,
      };
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No candidate members found in project or organization" },
        { status: 400 }
      );
    }

    // 3. Fetch Tasks to Assign
    let tasksToAssignQuery = db
      .from("tasks")
      .select("id, title, description, priority, status_id, primary_assignee_id")
      .eq("project_id", projectId);

    if (taskId) {
      tasksToAssignQuery = tasksToAssignQuery.eq("id", taskId);
    } else if (taskIds && taskIds.length > 0) {
      tasksToAssignQuery = tasksToAssignQuery.in("id", taskIds);
    } else if (autoAssignAll) {
      tasksToAssignQuery = tasksToAssignQuery
        .is("primary_assignee_id", null)
        .order("created_at", { ascending: true })
        .limit(50);
    } else {
      return NextResponse.json(
        { error: "Must specify taskId, taskIds, or autoAssignAll" },
        { status: 400 }
      );
    }

    const { data: rawTasks, error: taskQueryErr } = await tasksToAssignQuery;

    if (taskQueryErr || !rawTasks || rawTasks.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No unassigned tasks found needing assignment.",
        assignedCount: 0,
        assignments: [],
      });
    }

    // Filter out already closed tasks
    const unassignedTasks = rawTasks.filter((t: any) => !closedStatusIds.has(t.status_id));

    if (unassignedTasks.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "All matched tasks are already completed or closed.",
        assignedCount: 0,
        assignments: [],
      });
    }

    // 4. Run AI Agent Triage and Role-Aware Workload Assignment in Batch
    const assignments: AssignmentResult[] = [];

    // Helper map of current live workloads to ensure fair distribution during this batch
    const liveWorkloads = new Map<string, number>();
    for (const c of candidates) {
      liveWorkloads.set(c.id, c.workloadCount);
    }

    // Batch AI classification for all tasks in a single LLM invocation
    const aiResultsMap = new Map<string, { requiredRole: string; reason: string }>();
    try {
      const taskSummaries = unassignedTasks.map((t: any) => ({
        id: t.id,
        title: t.title || "Untitled Task",
        desc: (t.description || "").slice(0, 160),
        priority: t.priority || "normal",
      }));

      const prompt = `You are an AI Task Assignment Agent for a software project management platform.
Analyze the following list of tasks and determine the best functional role required for each (choose from: Developer, Tester, Support, Admin, HR, Manager).

Tasks:
${JSON.stringify(taskSummaries, null, 2)}

Respond with ONLY a JSON array with one object per task:
[
  {
    "id": "task_id_here",
    "requiredRole": "Developer",
    "reason": "1-sentence justification"
  }
]`;

      const aiRes = await generateTextWithFallback({
        prompt,
        temperature: 0.1,
        maxOutputTokens: 2500,
      });

      if (aiRes.text) {
        const match = aiRes.text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item?.id && item?.requiredRole) {
                aiResultsMap.set(item.id, {
                  requiredRole: item.requiredRole,
                  reason: item.reason || "",
                });
              }
            }
          }
        }
      }
    } catch (batchErr) {
      // Graceful fallback to heuristic classification
      console.warn("AI Task Assignment batch LLM fallback to heuristics:", batchErr);
    }

    for (const task of unassignedTasks) {
      const taskTitle = task.title || "Untitled Task";
      const taskDesc = (task.description || "").slice(0, 1000);

      const aiClass = aiResultsMap.get(task.id);
      const requiredRole = aiClass?.requiredRole || classifyTaskRoleHeuristic(taskTitle, taskDesc);
      const aiExplanation = aiClass?.reason || "";

      // Filter candidate members matching the required role
      let matchingCandidates = candidates.filter((c) =>
        memberMatchesRole(c.designations, requiredRole)
      );

      // If no candidate has this specific designation, consider all candidates
      if (matchingCandidates.length === 0) {
        matchingCandidates = candidates;
      }

      // Sort matching candidates by current live workload (ascending: lowest workload first)
      matchingCandidates.sort((a, b) => {
        const loadA = liveWorkloads.get(a.id) ?? a.workloadCount;
        const loadB = liveWorkloads.get(b.id) ?? b.workloadCount;
        if (loadA !== loadB) return loadA - loadB;
        if (a.totalEstimateMinutes !== b.totalEstimateMinutes) {
          return a.totalEstimateMinutes - b.totalEstimateMinutes;
        }
        return a.name.localeCompare(b.name);
      });

      const bestCandidate = matchingCandidates[0] || candidates[0];
      const currentLoad = liveWorkloads.get(bestCandidate.id) ?? bestCandidate.workloadCount;

      const reason =
        aiExplanation ||
        `Assigned based on task description matching ${requiredRole} designation with lowest active workload (${currentLoad} open tasks).`;

      assignments.push({
        taskId: task.id,
        taskTitle,
        assignedUserId: bestCandidate.id,
        assignedUserName: bestCandidate.name,
        requiredRole,
        workloadCount: currentLoad,
        reason,
      });

      // Update live workload for next tasks in the batch
      liveWorkloads.set(bestCandidate.id, currentLoad + 1);
    }

    // Execute database assignments in bulk parallel chunks
    if (!dryRun && assignments.length > 0) {
      const dbOperations = assignments.map(async (assign) => {
        await db
          .from("tasks")
          .update({ primary_assignee_id: assign.assignedUserId })
          .eq("id", assign.taskId);

        try {
          await db.from("task_assignees").upsert(
            {
              project_id: projectId,
              task_id: assign.taskId,
              user_id: assign.assignedUserId,
              assigned_by: user.id,
            },
            { onConflict: "task_id,user_id" }
          );
        } catch {}

        try {
          await db.from("project_activity_events").insert({
            project_id: projectId,
            task_id: assign.taskId,
            actor_id: user.id,
            event_type: "ai_assigned",
            details: {
              assigned_to: assign.assignedUserName,
              assigned_user_id: assign.assignedUserId,
              required_role: assign.requiredRole,
              workload_count: assign.workloadCount,
              reason: assign.reason,
            },
          });
        } catch {}
      });

      // Run in parallel chunks of 10 to avoid connection pool congestion
      for (let i = 0; i < dbOperations.length; i += 10) {
        await Promise.all(dbOperations.slice(i, i + 10));
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      assignedCount: assignments.length,
      assignments,
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.name,
        designations: c.designations,
        workloadCount: liveWorkloads.get(c.id) ?? c.workloadCount,
      })),
    });
  } catch (err: any) {
    console.error("AI Task Assignment Agent Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to execute AI task assignment" },
      { status: 500 }
    );
  }
}
