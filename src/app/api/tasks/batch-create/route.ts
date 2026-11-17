import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const batchSchema = z.object({
  projectId: z.string().uuid(),
  tasks: z.array(
    z.object({
      title: z.string().trim().min(1).max(240),
      description: z.string().trim().max(10000).optional().default(""),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
      dueDate: z.string().nullable().optional(),
    })
  ).min(1).max(100),
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
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId, tasks } = parsed.data;

    // Retrieve default status for this project
    const { data: statuses } = await supabase
      .from("project_statuses")
      .select("id, category, order_index")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true });

    const defaultStatus =
      statuses?.find((s) => s.category === "not_started") || statuses?.[0];

    if (!defaultStatus) {
      return NextResponse.json(
        { error: "Project has no valid workflow statuses configured." },
        { status: 400 }
      );
    }

    // Insert tasks in batch
    const insertPayload = tasks.map((t) => ({
      project_id: projectId,
      status_id: defaultStatus.id,
      title: t.title,
      description: t.description || "",
      priority: t.priority,
      task_type: "task",
      due_date: t.dueDate ? t.dueDate.slice(0, 10) : null,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: createdTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(insertPayload)
      .select("id, title");

    if (insertError) {
      console.error("[Batch Task Insert Error]:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      createdCount: createdTasks?.length ?? 0,
      tasks: createdTasks,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create tasks";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
