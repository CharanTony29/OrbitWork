import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface SearchDocumentResult {
  id: string;
  projectId?: string;
  projectName?: string;
  workspaceId: string;
  workspaceName?: string;
  title: string;
  snippet: string;
  updatedAt: string;
  scope: "project" | "workspace" | "organization";
  isPrivate: boolean;
  href: string;
  type: "document";
  isAttachment?: boolean;
  mimeType?: string;
  fileSizeBytes?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 1) {
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

  const cleanQuery = q.replace(/[,%()]/g, " ").slice(0, 80).trim();
  if (!cleanQuery) {
    return NextResponse.json({
      workspaces: [],
      projects: [],
      tasks: [],
      documents: [],
      discussions: [],
    });
  }
  const pattern = `%${cleanQuery}%`;

  // 1. Get current workspace & organization
  const { data: currentWs } = await supabase
    .from("workspaces")
    .select("id, name, description, organization_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const orgId = currentWs?.organization_id;

  // 2. Workspaces in same organization
  const { data: matchedWsList } = orgId
    ? await supabase
        .from("workspaces")
        .select("id, name, description")
        .eq("organization_id", orgId)
        .ilike("name", pattern)
        .limit(6)
    : { data: [] };

  const workspaces = (matchedWsList ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description ?? "",
    type: "workspace" as const,
  }));

  // 3. Projects in this workspace
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name, description, workspace_id")
    .eq("workspace_id", workspaceId);

  const matchedProjects = (allProjects ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(cleanQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(cleanQuery.toLowerCase()))
  );

  const projects = matchedProjects.slice(0, 8).map((p) => ({
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name,
    description: p.description ?? "",
    type: "project" as const,
  }));

  const projectMap = new Map((allProjects ?? []).map((p) => [p.id, p.name]));
  const projectIds = (allProjects ?? []).map((p) => p.id);

  // 4. Parallel search across tasks, collaborative docs, doc pages, project docs, discussions, and attachments
  const [tasksRes, docsRes, pagesRes, projDocsRes, commentsRes, taskAttachmentsRes, channelFilesRes] = await Promise.all([
    // Tasks
    projectIds.length > 0
      ? supabase
          .from("tasks")
          .select("id, project_id, title, generated_key, description, priority, status_id")
          .in("project_id", projectIds)
          .or(`title.ilike.${pattern},generated_key.ilike.${pattern},description.ilike.${pattern}`)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Collaborative docs in this workspace
    supabase
      .from("docs")
      .select("id, workspace_id, project_id, title, icon, description, is_wiki, is_private, tags, template_category, created_by, updated_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(15),

    // Collaborative doc pages
    supabase
      .from("doc_pages")
      .select(
        "id, doc_id, title, icon, content_markdown, updated_at, docs!inner(id, workspace_id, project_id, title, is_private, is_wiki, tags, created_by)"
      )
      .eq("docs.workspace_id", workspaceId)
      .is("deleted_at", null)
      .or(`title.ilike.${pattern},content_markdown.ilike.${pattern}`)
      .limit(20),

    // Traditional project docs
    projectIds.length > 0
      ? supabase
          .from("project_documents")
          .select("id, project_id, title, body_markdown, updated_at")
          .in("project_id", projectIds)
          .or(`title.ilike.${pattern},body_markdown.ilike.${pattern}`)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Task comments
    projectIds.length > 0
      ? supabase
          .from("task_comments")
          .select("id, project_id, task_id, body, created_at, tasks(id, title, generated_key)")
          .in("project_id", projectIds)
          .ilike("body", pattern)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Task attachments in this workspace's projects
    projectIds.length > 0
      ? supabase
          .from("task_attachments")
          .select("id, project_id, task_id, file_name, mime_type, file_size_bytes, external_url, created_at, tasks(title, generated_key)")
          .in("project_id", projectIds)
          .ilike("file_name", pattern)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Project channel files
    projectIds.length > 0
      ? supabase
          .from("project_channel_files")
          .select("id, project_id, post_id, file_name, mime_type, file_size_bytes, created_at")
          .in("project_id", projectIds)
          .ilike("file_name", pattern)
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const tasks = (tasksRes.data ?? []).map((t: any) => ({
    id: t.id,
    projectId: t.project_id,
    projectName: projectMap.get(t.project_id) ?? "Project",
    title: t.title,
    generatedKey: t.generated_key,
    description: t.description ? t.description.slice(0, 140) : "",
    type: "task" as const,
  }));

  // Process unified documents
  const documentsMap = new Map<string, SearchDocumentResult>();
  const wsName = currentWs?.name || "Workspace";

  for (const d of docsRes.data ?? []) {
    const isPrivate = Boolean(d.is_private);
    const isProjectDoc = Boolean(d.project_id);
    const tags = Array.isArray(d.tags) ? d.tags : [];
    const isOrgTagged =
      tags.includes("org") ||
      tags.includes("organization") ||
      tags.includes("company") ||
      tags.includes("handbook") ||
      d.template_category === "organization";

    const scope: "project" | "workspace" | "organization" = isProjectDoc
      ? "project"
      : isOrgTagged
      ? "organization"
      : "workspace";

    const projName = d.project_id ? projectMap.get(d.project_id) : undefined;

    documentsMap.set(d.id, {
      id: d.id,
      projectId: d.project_id ?? undefined,
      projectName: projName,
      workspaceId,
      workspaceName: wsName,
      title: d.title || "Untitled Document",
      snippet: d.description ? d.description.slice(0, 140) : "Collaborative Document",
      updatedAt: d.updated_at,
      scope,
      isPrivate,
      href: `/workspaces/${workspaceId}/docs/${d.id}`,
      type: "document",
    });
  }

  for (const p of pagesRes.data ?? []) {
    const parentDoc = p.docs as any;
    if (!parentDoc) continue;
    const docId = parentDoc.id || p.doc_id;

    if (!documentsMap.has(docId)) {
      const isPrivate = Boolean(parentDoc.is_private);
      const isProjectDoc = Boolean(parentDoc.project_id);
      const tags = Array.isArray(parentDoc.tags) ? parentDoc.tags : [];
      const isOrgTagged =
        tags.includes("org") ||
        tags.includes("organization") ||
        tags.includes("company") ||
        tags.includes("handbook");

      const scope: "project" | "workspace" | "organization" = isProjectDoc
        ? "project"
        : isOrgTagged
        ? "organization"
        : "workspace";

      const projName = parentDoc.project_id ? projectMap.get(parentDoc.project_id) : undefined;

      let snippet = `Page: ${p.title || "Untitled"}`;
      if (p.content_markdown) {
        const cleanContent = p.content_markdown.replace(/[#*`_~\[\]]/g, " ");
        const idx = cleanContent.toLowerCase().indexOf(cleanQuery.toLowerCase());
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(cleanContent.length, idx + cleanQuery.length + 80);
          snippet = `…${cleanContent.slice(start, end).replace(/\s+/g, " ").trim()}…`;
        } else {
          snippet = cleanContent.slice(0, 120);
        }
      }

      documentsMap.set(docId, {
        id: docId,
        projectId: parentDoc.project_id ?? undefined,
        projectName: projName,
        workspaceId,
        workspaceName: wsName,
        title: parentDoc.title || p.title || "Document",
        snippet,
        updatedAt: p.updated_at,
        scope,
        isPrivate,
        href: `/workspaces/${workspaceId}/docs/${docId}`,
        type: "document",
      });
    }
  }

  for (const d of projDocsRes.data ?? []) {
    if (!documentsMap.has(d.id)) {
      documentsMap.set(d.id, {
        id: d.id,
        projectId: d.project_id,
        projectName: projectMap.get(d.project_id) ?? "Project",
        workspaceId,
        workspaceName: wsName,
        title: d.title,
        snippet: d.body_markdown ? d.body_markdown.replace(/[#*`_~]/g, "").slice(0, 140) : "",
        updatedAt: d.updated_at,
        scope: "project",
        isPrivate: false,
        href: `/projects/${d.project_id}/documents/${d.id}`,
        type: "document",
      });
    }
  }

  // Task attachments
  for (const att of (taskAttachmentsRes?.data ?? []) as any[]) {
    if (!documentsMap.has(att.id)) {
      const taskObj = Array.isArray(att.tasks) ? att.tasks[0] : att.tasks;
      const projName = projectMap.get(att.project_id) ?? "Project";
      const taskKey = taskObj?.generated_key ? `[${taskObj.generated_key}] ` : "";
      const taskTitle = taskObj?.title || "Task";

      documentsMap.set(att.id, {
        id: att.id,
        projectId: att.project_id,
        projectName: projName,
        workspaceId,
        workspaceName: wsName,
        title: att.file_name,
        snippet: `Task Attachment: ${taskKey}${taskTitle} (${formatBytes(att.file_size_bytes)})`,
        updatedAt: att.created_at,
        scope: "project",
        isPrivate: false,
        href: `/projects/${att.project_id}/tasks/${att.task_id}`,
        type: "document",
        isAttachment: true,
        mimeType: att.mime_type,
        fileSizeBytes: att.file_size_bytes,
      });
    }
  }

  // Channel files
  for (const cf of (channelFilesRes?.data ?? []) as any[]) {
    if (!documentsMap.has(cf.id)) {
      const projName = projectMap.get(cf.project_id) ?? "Project";

      documentsMap.set(cf.id, {
        id: cf.id,
        projectId: cf.project_id,
        projectName: projName,
        workspaceId,
        workspaceName: wsName,
        title: cf.file_name,
        snippet: `Channel File (${formatBytes(cf.file_size_bytes)})`,
        updatedAt: cf.created_at,
        scope: "project",
        isPrivate: false,
        href: `/projects/${cf.project_id}`,
        type: "document",
        isAttachment: true,
        mimeType: cf.mime_type,
        fileSizeBytes: cf.file_size_bytes,
      });
    }
  }

  const documents = Array.from(documentsMap.values()).slice(0, 30);

  const discussions = (commentsRes.data ?? []).map((c: any) => {
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

  return NextResponse.json({ workspaces, projects, tasks, documents, discussions });
}
