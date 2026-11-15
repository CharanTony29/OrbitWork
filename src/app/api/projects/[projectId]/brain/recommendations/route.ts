// src/app/api/projects/[projectId]/brain/recommendations/route.ts
// Actionable Recommendation Execution API with explicit user confirmation & audit trail

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const applyRecommendationSchema = z.object({
  recommendationId: z.string(),
  actionType: z.enum([
    "reschedule_task",
    "reassign_task",
    "remove_dependency",
    "adjust_deadline",
    "change_priority",
    "custom",
  ]),
  actionPayload: z.record(z.unknown()),
  title: z.string().optional(),
  reason: z.string().optional(),
});

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

    const body = await req.json();
    const parsed = applyRecommendationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid recommendation payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { recommendationId, actionType, actionPayload, title, reason } = parsed.data;
    let changeSummary = "";

    // 1. Execute the confirmed change safely based on actionType
    if (actionType === "change_priority") {
      const taskId = String(actionPayload.taskId);
      const newPriority = String(actionPayload.priority || "urgent");

      const { data: oldTask } = await supabase
        .from("tasks")
        .select("title, priority")
        .eq("id", taskId)
        .eq("project_id", projectId)
        .single();

      if (!oldTask) {
        return NextResponse.json({ error: "Target task not found" }, { status: 404 });
      }

      await supabase
        .from("tasks")
        .update({ priority: newPriority })
        .eq("id", taskId)
        .eq("project_id", projectId);

      changeSummary = `Priority on "${oldTask.title}" changed from ${oldTask.priority} ➔ ${newPriority}`;
    } else if (actionType === "reschedule_task") {
      const taskId = String(actionPayload.taskId);
      const newDueDate = String(actionPayload.newDueDate);

      const { data: oldTask } = await supabase
        .from("tasks")
        .select("title, due_date")
        .eq("id", taskId)
        .eq("project_id", projectId)
        .single();

      if (!oldTask) {
        return NextResponse.json({ error: "Target task not found" }, { status: 404 });
      }

      await supabase
        .from("tasks")
        .update({ due_date: newDueDate })
        .eq("id", taskId)
        .eq("project_id", projectId);

      changeSummary = `Due date on "${oldTask.title}" rescheduled from ${oldTask.due_date || "none"} ➔ ${newDueDate}`;
    } else if (actionType === "reassign_task") {
      const taskId = String(actionPayload.taskId);
      const newAssigneeId = String(actionPayload.newPrimaryAssigneeId);
      const newAssigneeName = String(actionPayload.newAssigneeName || "new owner");

      const { data: oldTask } = await supabase
        .from("tasks")
        .select("title, primary_assignee_id")
        .eq("id", taskId)
        .eq("project_id", projectId)
        .single();

      if (!oldTask) {
        return NextResponse.json({ error: "Target task not found" }, { status: 404 });
      }

      await supabase
        .from("tasks")
        .update({ primary_assignee_id: newAssigneeId })
        .eq("id", taskId)
        .eq("project_id", projectId);

      changeSummary = `Reassigned "${oldTask.title}" to ${newAssigneeName}`;
    } else if (actionType === "adjust_deadline") {
      const newDeadline = String(actionPayload.newDeadline);
      await supabase
        .from("projects")
        .update({ due_date: newDeadline })
        .eq("id", projectId);

      changeSummary = `Project deadline adjusted to ${newDeadline}`;
    } else if (actionType === "remove_dependency") {
      const task1 = String(actionPayload.taskId || "");
      const task2 = String(actionPayload.linkedTaskId || "");
      if (task1 && task2) {
        await supabase
          .from("task_dependencies")
          .delete()
          .eq("project_id", projectId)
          .or(`and(task_id.eq.${task1},linked_task_id.eq.${task2}),and(task_id.eq.${task2},linked_task_id.eq.${task1})`);
        changeSummary = "Removed conflicting dependency link";
      }
    }

    // 2. Log comprehensive audit trail to project_activity_events
    try {
      await supabase.from("project_activity_events").insert({
        project_id: projectId,
        actor_id: user.id,
        event_type: "ai_recommendation_applied",
        details: {
          recommendationId,
          recommendationTitle: title || "Project Brain Recommendation",
          actionType,
          changeSummary,
          userApproved: true,
          appliedAt: new Date().toISOString(),
        },
      });
    } catch {
      // Non-blocking
    }

    // 3. Mark in project_recommendations if table exists
    try {
      await supabase.from("project_recommendations").upsert(
        {
          id: recommendationId.includes("-") ? undefined : undefined,
          project_id: projectId,
          title: title || "Recommendation",
          action_type: actionType,
          action_payload: actionPayload,
          status: "applied",
          applied_at: new Date().toISOString(),
          applied_by: user.id,
        },
        { onConflict: "id" }
      );
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      changeSummary,
      appliedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[Apply Recommendation Error]:", err);
    const msg = err instanceof Error ? err.message : "Failed to apply recommendation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
