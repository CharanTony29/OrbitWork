import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { noStoreJson } from "@/lib/chat-server";

export const dynamic = "force-dynamic";

const quickTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const parsed = quickTaskSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        { error: parsed.error.issues[0]?.message || "Invalid task input." },
        400
      );
    }

    const { projectId, title, description, priority } = parsed.data;

    const { data: statusRows, error: statusErr } = await supabase
      .from("project_statuses")
      .select("id")
      .eq("project_id", projectId)
      .order("position", { ascending: true })
      .limit(1);

    if (statusErr || !statusRows || statusRows.length === 0) {
      return noStoreJson(
        { error: "Target project has no statuses or is inaccessible." },
        400
      );
    }

    const { data: newTask, error: insertErr } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        status_id: statusRows[0].id,
        title,
        description: description ?? "",
        priority: priority ?? "normal",
        task_type: "task",
        created_by: user.id,
      })
      .select("id, title")
      .single();

    if (insertErr || !newTask) {
      return noStoreJson(
        { error: insertErr?.message || "Could not create task (check project permissions)." },
        403
      );
    }

    return noStoreJson(
      {
        ok: true,
        task: {
          id: newTask.id,
          title: newTask.title,
          projectId,
          href: `/projects/${projectId}/tasks/${newTask.id}`,
        },
      },
      201
    );
  } catch (err) {
    console.error("Chat quick-task POST error:", err);
    return noStoreJson({ error: "Failed to convert message to task." }, 500);
  }
}
