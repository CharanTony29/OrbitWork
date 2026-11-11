import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyMentionedUsers } from "@/lib/email";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch comments
  const { data: comments, error } = await supabase
    .from("task_comments")
    .select("id, author_id, body, created_at, project_id")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", authorIds)
    : { data: [] };

  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  const formatted = (comments ?? []).map((c) => {
    const author = authorMap.get(c.author_id);
    return {
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      authorId: c.author_id,
      authorName: author?.display_name?.trim() || author?.email || "Team member",
      avatarUrl: author?.avatar_url || null,
      isCurrentUser: c.author_id === user.id,
    };
  });

  return NextResponse.json({ comments: formatted });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const body = String(json?.body ?? "").trim();
  const projectId = String(json?.projectId ?? "");

  if (!body) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }

  // Verify task exists and get project_id if not provided
  let targetProjectId = projectId;
  if (!targetProjectId) {
    const { data: task } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("id", taskId)
      .maybeSingle();
    targetProjectId = task?.project_id;
  }

  if (!targetProjectId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: newComment, error } = await supabase
    .from("task_comments")
    .insert({
      project_id: targetProjectId,
      task_id: taskId,
      author_id: user.id,
      body,
    })
    .select("id, author_id, body, created_at")
    .single();

  if (error || !newComment) {
    return NextResponse.json({ error: error?.message || "Failed to post comment" }, { status: 500 });
  }

  // Send mention notification emails before returning response
  await notifyMentionedUsers({
    projectId: targetProjectId,
    taskId,
    commentBody: body,
    authorId: user.id,
  });

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    comment: {
      id: newComment.id,
      body: newComment.body,
      createdAt: newComment.created_at,
      authorId: user.id,
      authorName: profile?.display_name?.trim() || user.email || "Team member",
      avatarUrl: profile?.avatar_url || null,
      isCurrentUser: true,
    },
  });
}
