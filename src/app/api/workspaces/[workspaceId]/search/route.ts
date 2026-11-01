import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ tasks: [], documents: [], discussions: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all accessible projects in this workspace
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  if (projectsError || !projects?.length) {
    return NextResponse.json({ tasks: [], documents: [], discussions: [] });
  }

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const projectIds = projects.map((p) => p.id);
  const cleanQuery = q.replace(/[,%()]/g, " ").slice(0, 80);

  // Parallel search across tasks, documents, and discussions
  const [tasksRes, docsRes, commentsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, project_id, title, generated_key, description, priority, status_id")
      .in("project_id", projectIds)
      .or(`title.ilike.%${cleanQuery}%,generated_key.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`)
      .limit(15),

    supabase
      .from("project_documents")
      .select("id, project_id, title, body_markdown, updated_at")
      .in("project_id", projectIds)
      .or(`title.ilike.%${cleanQuery}%,body_markdown.ilike.%${cleanQuery}%`)
      .limit(15),

    supabase
      .from("task_comments")
      .select("id, project_id, task_id, body, created_at, tasks(id, title, generated_key)")
      .in("project_id", projectIds)
      .ilike("body", `%${cleanQuery}%`)
      .limit(15),
  ]);

  const tasks = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    projectId: t.project_id,
    projectName: projectMap.get(t.project_id) ?? "Project",
    title: t.title,
    generatedKey: t.generated_key,
    description: t.description ? t.description.slice(0, 140) : "",
    type: "task" as const,
  }));

  const documents = (docsRes.data ?? []).map((d) => ({
    id: d.id,
    projectId: d.project_id,
    projectName: projectMap.get(d.project_id) ?? "Project",
    title: d.title,
    snippet: d.body_markdown ? d.body_markdown.replace(/[#*`_~]/g, "").slice(0, 140) : "",
    updatedAt: d.updated_at,
    type: "document" as const,
  }));

  const discussions = (commentsRes.data ?? []).map((c) => {
    const taskInfo = Array.isArray(c.tasks) ? c.tasks[0] : c.tasks;
    return {
      id: c.id,
      projectId: c.project_id,
      taskId: c.task_id,
      projectName: projectMap.get(c.project_id) ?? "Project",
      taskTitle: taskInfo?.title ?? "Task",
      taskKey: taskInfo?.generated_key ?? "",
      bodySnippet: c.body ? c.body.slice(0, 140) : "",
      createdAt: c.created_at,
      type: "discussion" as const,
    };
  });

  return NextResponse.json({ tasks, documents, discussions });
}
