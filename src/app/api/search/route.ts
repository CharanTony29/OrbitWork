import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizePattern(q: string): string {
  return q.replace(/[%_\\,()]/g, " ").trim();
}

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

  // 1. Fetch accessible workspaces & projects
  const [wsAllRes, allProjectsRes] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, description, organization_id")
      .limit(100),
    workspaceId
      ? supabase
          .from("projects")
          .select("id, name, description, workspace_id")
          .eq("workspace_id", workspaceId)
          .limit(300)
      : supabase.from("projects").select("id, name, description, workspace_id").limit(300),
  ]);

  const allWorkspaces = wsAllRes.data ?? [];
  const workspaceMap = new Map(allWorkspaces.map((w) => [w.id, w]));
  const targetWorkspaceIds = workspaceId
    ? [workspaceId]
    : allWorkspaces.map((w) => w.id);

  const projectsList = allProjectsRes.data ?? [];
  const projectMap = new Map(projectsList.map((p) => [p.id, p]));
  const scopedProjectIds = projectsList.map((p) => p.id);

  // Matching workspaces
  const matchingWorkspaces = allWorkspaces
    .filter(
      (w) =>
        w.name.toLowerCase().includes(rawQuery.toLowerCase()) ||
        (w.description || "").toLowerCase().includes(rawQuery.toLowerCase())
    )
    .slice(0, 12)
    .map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description || "Workspace",
      type: "workspace" as const,
    }));

  // Matching projects
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

  // 2. Parallel queries across tasks, collaborative docs, doc pages, project documents, discussions, and attachments
  const [tasksRes, docsRes, pagesRes, projDocsRes, commentsRes, taskAttachmentsRes, channelFilesRes] = await Promise.all([
    // Tasks (if accessible projects exist)
    scopedProjectIds.length > 0
      ? supabase
          .from("tasks")
          .select("id, project_id, title, generated_key, description")
          .in("project_id", scopedProjectIds)
          .or(`title.ilike.${pattern},generated_key.ilike.${pattern}`)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Collaborative docs container (docs)
    targetWorkspaceIds.length > 0
      ? supabase
          .from("docs")
          .select(
            "id, workspace_id, project_id, title, icon, description, is_wiki, is_private, tags, template_category, created_by, updated_at"
          )
          .in("workspace_id", targetWorkspaceIds)
          .is("deleted_at", null)
          .or(`title.ilike.${pattern},description.ilike.${pattern}`)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Collaborative doc pages (doc_pages content search)
    targetWorkspaceIds.length > 0
      ? supabase
          .from("doc_pages")
          .select(
            "id, doc_id, title, icon, content_markdown, updated_at, docs!inner(id, workspace_id, project_id, title, is_private, is_wiki, tags, created_by)"
          )
          .in("docs.workspace_id", targetWorkspaceIds)
          .is("deleted_at", null)
          .or(`title.ilike.${pattern},content_markdown.ilike.${pattern}`)
          .limit(20)
      : Promise.resolve({ data: [] }),

    // Traditional project documents
    scopedProjectIds.length > 0
      ? supabase
          .from("project_documents")
          .select("id, project_id, title, body_markdown, updated_at")
          .in("project_id", scopedProjectIds)
          .or(`title.ilike.${pattern},body_markdown.ilike.${pattern}`)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Task comments / discussions
    scopedProjectIds.length > 0
      ? supabase
          .from("task_comments")
          .select("id, project_id, task_id, body, created_at, tasks(title, generated_key)")
          .in("project_id", scopedProjectIds)
          .ilike("body", pattern)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),

    // Project & Workspace task attachments (non-chat attachments)
    scopedProjectIds.length > 0
      ? supabase
          .from("task_attachments")
          .select("id, project_id, task_id, file_name, mime_type, file_size_bytes, external_url, created_at, tasks(title, generated_key)")
          .in("project_id", scopedProjectIds)
          .ilike("file_name", pattern)
          .limit(15)
      : Promise.resolve({ data: [] }),

    // Project & Workspace channel files
    scopedProjectIds.length > 0
      ? supabase
          .from("project_channel_files")
          .select("id, project_id, post_id, file_name, mime_type, file_size_bytes, created_at")
          .in("project_id", scopedProjectIds)
          .ilike("file_name", pattern)
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  // 3. Process tasks
  const tasks = (tasksRes.data ?? []).map((t: any) => ({
    id: t.id,
    projectId: t.project_id,
    projectName: projectMap.get(t.project_id)?.name || "Project",
    title: t.title,
    generatedKey: t.generated_key,
    description: (t.description || "").slice(0, 120),
    type: "task" as const,
  }));

  // 4. Process unified documents with Project / Workspace / Organization scope
  const documentsMap = new Map<string, SearchDocumentResult>();

  // A. Collaborative Docs
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

    const wsName = workspaceMap.get(d.workspace_id)?.name || "Workspace";
    const projName = d.project_id ? projectMap.get(d.project_id)?.name : undefined;

    documentsMap.set(d.id, {
      id: d.id,
      projectId: d.project_id ?? undefined,
      projectName: projName,
      workspaceId: d.workspace_id,
      workspaceName: wsName,
      title: d.title || "Untitled Document",
      snippet: d.description ? d.description.slice(0, 140) : "Collaborative Document",
      updatedAt: d.updated_at,
      scope,
      isPrivate,
      href: `/workspaces/${d.workspace_id}/docs/${d.id}`,
      type: "document",
    });
  }

  // B. Page content matches
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

      const wsName = workspaceMap.get(parentDoc.workspace_id)?.name || "Workspace";
      const projName = parentDoc.project_id ? projectMap.get(parentDoc.project_id)?.name : undefined;

      let snippet = `Page: ${p.title || "Untitled"}`;
      if (p.content_markdown) {
        const cleanContent = p.content_markdown.replace(/[#*`_~\[\]]/g, " ");
        const idx = cleanContent.toLowerCase().indexOf(cleanQ.toLowerCase());
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(cleanContent.length, idx + cleanQ.length + 80);
          snippet = `…${cleanContent.slice(start, end).replace(/\s+/g, " ").trim()}…`;
        } else {
          snippet = cleanContent.slice(0, 120);
        }
      }

      documentsMap.set(docId, {
        id: docId,
        projectId: parentDoc.project_id ?? undefined,
        projectName: projName,
        workspaceId: parentDoc.workspace_id,
        workspaceName: wsName,
        title: parentDoc.title || p.title || "Document",
        snippet,
        updatedAt: p.updated_at,
        scope,
        isPrivate,
        href: `/workspaces/${parentDoc.workspace_id}/docs/${docId}`,
        type: "document",
      });
    }
  }

  // C. Traditional Project Documents
  for (const d of projDocsRes.data ?? []) {
    if (!documentsMap.has(d.id)) {
      const rawBody = d.body_markdown || "";
      const isCanvas =
        rawBody.includes('"kind":"whiteboard"') ||
        rawBody.includes('"kind":"flowchart"');
      const cleanTitle = d.title.replace(/^\[(?:Whiteboard|Flowchart)\]\s*/i, "");
      const cleanSnippet = isCanvas
        ? "Interactive project diagram"
        : rawBody.replace(/[#*`_~\[\]]/g, " ").slice(0, 130);

      const proj = projectMap.get(d.project_id);
      const wsId = proj?.workspace_id || targetWorkspaceIds[0] || "";
      const wsName = wsId ? workspaceMap.get(wsId)?.name : "Workspace";

      documentsMap.set(d.id, {
        id: d.id,
        projectId: d.project_id,
        projectName: proj?.name || "Project",
        workspaceId: wsId,
        workspaceName: wsName,
        title: cleanTitle || d.title,
        snippet: cleanSnippet,
        updatedAt: d.updated_at,
        scope: "project",
        isPrivate: false,
        href: `/projects/${d.project_id}/documents/${d.id}`,
        type: "document",
      });
    }
  }

  // D. Task Attachments (Project & Workspace level attachments)
  for (const att of (taskAttachmentsRes?.data ?? []) as any[]) {
    if (!documentsMap.has(att.id)) {
      const taskObj = Array.isArray(att.tasks) ? att.tasks[0] : att.tasks;
      const proj = projectMap.get(att.project_id);
      const wsId = proj?.workspace_id || targetWorkspaceIds[0] || "";
      const wsName = wsId ? workspaceMap.get(wsId)?.name : "Workspace";
      const taskKey = taskObj?.generated_key ? `[${taskObj.generated_key}] ` : "";
      const taskTitle = taskObj?.title || "Task";

      documentsMap.set(att.id, {
        id: att.id,
        projectId: att.project_id,
        projectName: proj?.name || "Project",
        workspaceId: wsId,
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

  // E. Project Channel Files
  for (const cf of (channelFilesRes?.data ?? []) as any[]) {
    if (!documentsMap.has(cf.id)) {
      const proj = projectMap.get(cf.project_id);
      const wsId = proj?.workspace_id || targetWorkspaceIds[0] || "";
      const wsName = wsId ? workspaceMap.get(wsId)?.name : "Workspace";

      documentsMap.set(cf.id, {
        id: cf.id,
        projectId: cf.project_id,
        projectName: proj?.name || "Project",
        workspaceId: wsId,
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

  // 5. Process discussions
  const discussions = (commentsRes.data ?? []).map((c: any) => {
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
