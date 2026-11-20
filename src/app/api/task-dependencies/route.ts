import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("task_dependencies")
      .select("task_id, linked_task_id, relation")
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dependencies: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch dependencies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, taskId, linkedTaskId, relation = "blocks" } = body;

    if (!projectId || !taskId || !linkedTaskId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (taskId === linkedTaskId) {
      return NextResponse.json({ error: "A task cannot depend on itself" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("task_dependencies")
      .upsert(
        {
          project_id: projectId,
          task_id: taskId,
          linked_task_id: linkedTaskId,
          relation,
          created_by: user.id,
        },
        { onConflict: "task_id,linked_task_id,relation" }
      )
      .select("task_id, linked_task_id, relation")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, dependency: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create dependency" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, taskId, linkedTaskId, relation } = body;

    if (!projectId || !taskId || !linkedTaskId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let query = supabase
      .from("task_dependencies")
      .delete()
      .eq("project_id", projectId)
      .eq("task_id", taskId)
      .eq("linked_task_id", linkedTaskId);

    if (relation) {
      query = query.eq("relation", relation);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to remove dependency" }, { status: 500 });
  }
}
