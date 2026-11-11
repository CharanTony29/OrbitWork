import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizePattern(q: string): string {
  return q.replace(/[%_\\,()]/g, " ").trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") || "").trim();
  const workspaceId = (url.searchParams.get("workspaceId") || "").trim();

  if (rawQuery.length < 1) {
    return NextResponse.json({
      workspaces: [],
      projects: [],
      tasks: [],
      documents: [],
      discussions: [],
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleanQ = sanitizePattern(rawQuery);
  if (!cleanQ) {
    return NextResponse.json({
      workspaces: [],
      projects: [],
      tasks: [],
      documents: [],
      discussions: [],
    });
  }

  const pattern = `%${cleanQ}%`;

  // Fetch accessible workspaces & projects first for clean mapping
  const [{ data: allProjects }, wsRes] = await Promise.all([
    workspaceId
      ? supabase
          .from("projects")
          .select("id, name, description, workspace_id")
          .eq("workspace_id", workspaceId)
          .limit(300)
      : supabase.from("projects").select("id, name, description, workspace_id").limit(300),
    supabase
      .from("workspaces")
      .select("id, name, description")
      .ilike("name", pattern)
      .limit(12),
  ]);

  const projectsList = allProjects ?? [];
  const projectMap = new Map(projectsList.map((p) => [p.id, p]));
  const scopedProjectIds = projectsList.map((p) => p.id);

  const matchingWorkspaces = (wsRes.data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description || "Workspace",
    type: "workspace" as const,
  }));

  const matchingProjects = projectsList
    .filter(
      (p) =>
        p.name.toLowerCase().includes(rawQuery.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(rawQuery.toLowerCase())
    )
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      workspaceId: p.workspace_id,
      name: p.name,
      description: p.description || "Project",
      type: "project" as const,
    }));

  if (scopedProjectIds.length === 0) {
    return NextResponse.json({
      workspaces: matchingWorkspaces,
      projects: matchingProjects,
      tasks: [],
      documents: [],
      discussions: [],
    });
  }

  const [tasksRes, docsRes, commentsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, project_id, title, generated_key, description")
      .in("project_id", scopedProjectIds)
      .or(`title.ilike.${pattern},generated_key.ilike.${pattern}`)
      .limit(15),
    supabase
      .from("project_documents")
      .select("id, project_id, title, body_markdown, updated_at")
      .in("project_id", scopedProjectIds)
      .or(`title.ilike.${pattern},body_markdown.ilike.${pattern}`)
      .limit(12),
    supabase
      .from("task_comments")
      .select("id, project_id, task_id, body, created_at, tasks(title, generated_key)")
      .in("project_id", scopedProjectIds)
      .ilike("body", pattern)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const tasks = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    projectId: t.project_id,
    projectName: projectMap.get(t.project_id)?.name || "Project",
    title: t.title,
    generatedKey: t.generated_key,
    description: (t.description || "").slice(0, 120),
    type: "task" as const,
  }));

  const documents = (docsRes.data ?? []).map((d) => {
    const rawBody = d.body_markdown || "";
    const isCanvas = rawBody.includes('"kind":"whiteboard"') || rawBody.includes('"kind":"flowchart"');
    const cleanTitle = d.title.replace(/^\[(?:Whiteboard|Flowchart)\]\s*/i, "");
    return {
      id: d.id,
      projectId: d.project_id,
      projectName: projectMap.get(d.project_id)?.name || "Project",
      title: cleanTitle || d.title,
      snippet: isCanvas ? "Interactive project diagram" : rawBody.slice(0, 110),
      updatedAt: d.updated_at,
      type: "document" as const,
    };
  });

  const discussions = (commentsRes.data ?? []).map((c) => {
    const taskRel = Array.isArray(c.tasks) ? c.tasks[0] : c.tasks;
    return {
      id: c.id,
      projectId: c.project_id,
      taskId: c.task_id,
      projectName: projectMap.get(c.project_id)?.name || "Project",
      taskTitle: (taskRel as { title?: string } | null)?.title || "Task",
      taskKey: (taskRel as { generated_key?: string } | null)?.generated_key || "",
      bodySnippet: (c.body || "").slice(0, 120),
      createdAt: c.created_at,
      type: "discussion" as const,
    };
  });

  return NextResponse.json({
    workspaces: matchingWorkspaces,
    projects: matchingProjects,
    tasks,
    documents,
    discussions,
  });
}
