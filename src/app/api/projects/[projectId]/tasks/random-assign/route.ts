import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

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
      return NextResponse.json({ error: "Forbidden: editor permissions required" }, { status: 403 });
    }

    // 1. Fetch candidate members for the project
    const { data: projectMembers } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId);

    let candidateUserIds = (projectMembers || []).map((m: any) => m.user_id);

    // Fallback to workspace / organization members if project members list is empty
    if (candidateUserIds.length === 0) {
      const { data: project } = await supabase
        .from("projects")
        .select("workspaces ( organization_id )")
        .eq("id", projectId)
        .single();

      const ws = Array.isArray(project?.workspaces) ? project?.workspaces[0] : project?.workspaces;
      const orgId = ws?.organization_id;

      if (orgId) {
        const { data: orgMembers } = await supabase
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

    // Fetch display names
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name, email")
      .in("id", candidateUserIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, p.display_name?.trim() || p.email || p.id])
    );

    // 2. Fetch all top-level parent tasks in project
    const { data: parentTasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("project_id", projectId)
      .is("parent_task_id", null)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (tasksErr || !parentTasks || parentTasks.length === 0) {
      return NextResponse.json({ error: "No parent tasks found in project to assign" }, { status: 404 });
    }

    // 3. Assign each parent task randomly across the candidate members
    const assignments: Array<{ taskId: string; title: string; userId: string; userName: string }> = [];

    // Distribute among all candidate members with random jitter
    const shuffledPool = [...candidateUserIds].sort(() => 0.5 - Math.random());
    for (let i = 0; i < parentTasks.length; i++) {
      const task = parentTasks[i];
      const assignedUserId = shuffledPool[i % shuffledPool.length] || candidateUserIds[Math.floor(Math.random() * candidateUserIds.length)];
      assignments.push({
        taskId: task.id,
        title: task.title,
        userId: assignedUserId,
        userName: profileMap.get(assignedUserId) || "Team Member",
      });
    }

    // Update in parallel batches of 25
    const CHUNK_SIZE = 25;
    for (let i = 0; i < assignments.length; i += CHUNK_SIZE) {
      const chunk = assignments.slice(i, i + CHUNK_SIZE);
      await Promise.allSettled(
        chunk.map(async (item) => {
          await supabase
            .from("tasks")
            .update({ primary_assignee_id: item.userId })
            .eq("id", item.taskId);

          await supabase.from("task_assignees").upsert(
            {
              project_id: projectId,
              task_id: item.taskId,
              user_id: item.userId,
              assigned_by: user.id,
            },
            { onConflict: "task_id,user_id" }
          );
        })
      );
    }

    return NextResponse.json({
      success: true,
      assignedCount: assignments.length,
      membersPoolCount: candidateUserIds.length,
      members: candidateUserIds.map((id) => profileMap.get(id) || id),
      sampleAssignments: assignments.slice(0, 10).map((a) => ({ task: a.title, assignee: a.userName })),
    });
  } catch (err: any) {
    console.error("[Random Assign Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to assign tasks randomly" },
      { status: 500 }
    );
  }
}
