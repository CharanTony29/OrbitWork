import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ClickUpDocWorkspace from "../ClickUpDocWorkspace";
import { getDoc, getPageListing, getPage } from "@/lib/docs/service";

export default async function ProjectDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
  searchParams: Promise<{ pageId?: string }>;
}) {
  const { projectId, documentId } = await params;
  const { pageId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { createAdminClient } = await import("@/lib/supabase/server");
  const db = createAdminClient() || supabase;

  const { data: project } = await db
    .from("projects")
    .select("id, name, workspace_id, workspaces(id, name, organization_id)")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const doc = await getDoc(documentId);
  if (!doc) notFound();

  const pageTree = await getPageListing(documentId);

  // Determine active page
  const targetPageId = pageId || pageTree[0]?.id;
  let activePage = targetPageId ? await getPage(documentId, targetPageId) : null;

  if (!activePage) {
    // Fallback: create a primary page if somehow none exists
    const { data: fallback } = await supabase
      .from("doc_pages")
      .insert({
        doc_id: documentId,
        title: doc.title,
        icon: doc.icon || "📄",
        position: 1000.0,
        content_json: [{ id: "b1", type: "paragraph", data: { text: "" } }],
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (fallback) {
      activePage = {
        id: fallback.id,
        doc_id: fallback.doc_id,
        parent_page_id: fallback.parent_page_id,
        title: fallback.title,
        icon: fallback.icon,
        position: fallback.position,
        content_json: fallback.content_json,
        content_markdown: fallback.content_markdown || "",
        page_type: fallback.page_type,
        is_archived: fallback.is_archived,
        created_at: fallback.created_at,
        updated_at: fallback.updated_at,
      };
    }
  }

  if (!activePage) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const currentUserName = profile?.display_name?.trim() || user.email || "Team member";

  // Load project tasks for live embedding
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, priority, project_statuses(name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(30);

  const tasksInProject = (tasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    status: t.project_statuses?.name || "To Do",
    priority: t.priority,
  }));

  let favoriteDocIds: string[] = [];
  const { data: favRows, error: favErr } = await supabase
    .from("user_favorites")
    .select("entity_id")
    .eq("user_id", user.id)
    .eq("entity_type", "document");
  if (!favErr && favRows) {
    favoriteDocIds = favRows.map((f) => f.entity_id);
  }

  const workspaceId = project.workspace_id;
  const workspaceName = (project.workspaces as any)?.name || "Workspace";
  const organizationId = (project.workspaces as any)?.organization_id;

  return (
    <main className="app-shell clickup-doc-page-shell">
      <AppTopBar
        email={user.email ?? ""}
        projectId={projectId}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        organizationId={organizationId}
      />

      <div className="doc-page-subbar">
        <Link className="back-link" href={`/projects/${projectId}/documents`}>
          <ArrowLeft size={15} /> Back to Documents
        </Link>
      </div>

      <ClickUpDocWorkspace
        workspaceId={workspaceId}
        projectId={projectId}
        projectName={project.name}
        workspaceName={workspaceName}
        doc={doc}
        initialPages={pageTree}
        initialActivePage={activePage}
        currentUserId={user.id}
        currentUserName={currentUserName}
        favoriteDocIds={favoriteDocIds}
        tasksInProject={tasksInProject}
      />
    </main>
  );
}
