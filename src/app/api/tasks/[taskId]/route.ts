import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if ("start_date" in body) updates.start_date = body.start_date || null;
    if ("due_date" in body) updates.due_date = body.due_date || null;
    if ("priority" in body) updates.priority = body.priority;
    if ("status_id" in body) updates.status_id = body.status_id;
    if ("title" in body) updates.title = body.title?.trim();
    if ("progress" in body) updates.progress = Number(body.progress) || 0;
    if ("primary_assignee_id" in body) updates.primary_assignee_id = body.primary_assignee_id || null;
    if ("secondary_assignee_id" in body) updates.secondary_assignee_id = body.secondary_assignee_id || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .select("id, title, start_date, due_date, priority, status_id, progress, primary_assignee_id, secondary_assignee_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, task: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update task" }, { status: 500 });
  }
}
