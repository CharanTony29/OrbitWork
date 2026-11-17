// src/app/api/projects/[projectId]/brain/generate-tasks/route.ts
// AI Task Generation & Breakdown from Goal with Preview & Confirmation

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateTasksFromGoalAI } from "@/lib/brain/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow ample time for batch inserting up to 500 tasks and subtasks

const generateSchema = z.object({
  goalTitle: z.string().trim().min(1).max(2000),
  goalDescription: z.string().trim().max(100000).optional(),
  createTasks: z.boolean().optional().default(false),
  selectedTasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(500),
        description: z.string().optional().default(""),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        subtasks: z.array(z.string()).optional().default([]),
        checklists: z.array(z.string()).optional().default([]),
      })
    )
    .optional(),
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

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid task generation payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { goalTitle, goalDescription, createTasks, selectedTasks } = parsed.data;

    // Mode 1: Proposal / Preview mode (Calls AI to generate structured breakdown)
    if (!createTasks) {
      const breakdown = await generateTasksFromGoalAI({
        goalTitle,
        goalDescription,
        projectName: project.name,
      });

      return NextResponse.json({
        success: true,
        proposedTasks: breakdown.proposedTasks,
        milestones: breakdown.milestones,
        risks: breakdown.risks,
      });
    }

    // Mode 2: User Confirmed Creation Mode (Batch inserts approved tasks)
    if (!selectedTasks || selectedTasks.length === 0) {
      return NextResponse.json({ error: "No tasks selected to create" }, { status: 400 });
    }

    // Get default status for the project
    const { data: statuses } = await supabase
      .from("project_statuses")
      .select("id, is_default, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true });

    const defaultStatusId =
      statuses?.find((s) => s.is_default)?.id || statuses?.[0]?.id;

    if (!defaultStatusId) {
      return NextResponse.json({ error: "No project status available" }, { status: 400 });
    }

    const createdTasksCount = [];

    for (const taskItem of selectedTasks) {
      // 1. Insert parent task
      const { data: parentTask, error: taskError } = await supabase
        .from("tasks")
        .insert({
          project_id: projectId,
          title: taskItem.title,
          description: taskItem.description || null,
          priority: taskItem.priority || "normal",
          status_id: defaultStatusId,
          created_by: user.id,
        })
        .select("id, title")
        .single();

      if (taskError || !parentTask) {
        console.error("[Create Task Error]:", taskError);
        continue;
      }

      createdTasksCount.push(parentTask);

      // 2. Insert subtasks in bulk if any
      if (taskItem.subtasks && taskItem.subtasks.length > 0) {
        const subtaskRows = taskItem.subtasks.map((subTitle: string) => ({
          project_id: projectId,
          title: subTitle,
          priority: taskItem.priority || "normal",
          status_id: defaultStatusId,
          parent_task_id: parentTask.id,
          created_by: user.id,
        }));
        const { error: subErr } = await supabase.from("tasks").insert(subtaskRows);
        if (subErr) {
          console.error(`[Create Subtasks Error for Task ${parentTask.id}]:`, subErr);
        }
      }

      // 3. Insert checklist & items if any
      if (taskItem.checklists && taskItem.checklists.length > 0) {
        const { data: checklist } = await supabase
          .from("task_checklists")
          .insert({
            project_id: projectId,
            task_id: parentTask.id,
            title: "Checklist",
            created_by: user.id,
          })
          .select("id")
          .single();

        if (checklist) {
          const itemRows = taskItem.checklists.map((chk: string, i: number) => ({
            project_id: projectId,
            task_id: parentTask.id,
            checklist_id: checklist.id,
            title: chk,
            position: i,
            created_by: user.id,
          }));
          await supabase.from("checklist_items").insert(itemRows);
        }
      }
    }

    // Record activity event
    try {
      await supabase.from("project_activity_events").insert({
        project_id: projectId,
        actor_id: user.id,
        event_type: "ai_tasks_generated",
        details: {
          goalTitle,
          count: createdTasksCount.length,
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      createdCount: createdTasksCount.length,
      tasks: createdTasksCount,
    });
  } catch (err: unknown) {
    console.error("[Project Brain Generate Tasks Error]:", err);
    const msg = err instanceof Error ? err.message : "Failed to generate tasks";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
