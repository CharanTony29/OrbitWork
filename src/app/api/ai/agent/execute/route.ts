import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const executeSchema = z.object({
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid(),
  autoAssignToParent: z.boolean().default(true),
  subtasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(240),
        description: z.string().max(4000).optional(),
        estimateMinutes: z.number().int().nonnegative().optional(),
        priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = executeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid execution payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId, parentTaskId, autoAssignToParent, subtasks } = parsed.data;

    // 1. Fetch parent task to inherit status and assignees
    const { data: parent, error: parentErr } = await supabase
      .from("tasks")
      .select("id, status_id, priority, primary_assignee_id, secondary_assignee_id")
      .eq("id", parentTaskId)
      .eq("project_id", projectId)
      .single();

    if (parentErr || !parent) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }

    // Determine assignee to inherit
    const primaryAssigneeId = autoAssignToParent ? parent.primary_assignee_id : null;
    const secondaryAssigneeId = autoAssignToParent ? parent.secondary_assignee_id : null;

    let createdCount = 0;

    for (const sub of subtasks) {
      const { data: inserted, error: insertErr } = await supabase
        .from("tasks")
        .insert({
          project_id: projectId,
          parent_task_id: parentTaskId,
          status_id: parent.status_id,
          title: sub.title,
          description: sub.description || "",
          estimate_minutes: sub.estimateMinutes || 60,
          priority: sub.priority || parent.priority || "normal",
          primary_assignee_id: primaryAssigneeId,
          secondary_assignee_id: secondaryAssigneeId,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (!insertErr && inserted) {
        createdCount++;

        // If inherited parent assignees, sync task_assignees relation table
        if (autoAssignToParent && primaryAssigneeId) {
          const assigneesToInsert = [primaryAssigneeId];
          if (secondaryAssigneeId && secondaryAssigneeId !== primaryAssigneeId) {
            assigneesToInsert.push(secondaryAssigneeId);
          }

          try {
            await supabase.from("task_assignees").insert(
              assigneesToInsert.map((uid) => ({
                project_id: projectId,
                task_id: inserted.id,
                user_id: uid,
                assigned_by: user.id,
              }))
            );
          } catch (syncErr) {
            console.warn("[Agent] task_assignees sync warning:", syncErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      createdCount,
      inheritedAssignee: Boolean(autoAssignToParent && primaryAssigneeId),
    });
  } catch (err: unknown) {
    console.error("[AI Agent Execute Error]:", err);
    const msg = err instanceof Error ? err.message : "Agent execution failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
