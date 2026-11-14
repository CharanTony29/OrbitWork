import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ClickUpDocWorkspace from "@/app/projects/[projectId]/documents/ClickUpDocWorkspace";
import { getDoc, getPageListing, getPage } from "@/lib/docs/service";

export default async function WorkspaceDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; docId: string }>;
  searchParams: Promise<{ pageId?: string }>;
}) {
  const { workspaceId, docId } = await params;
  const { pageId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, organization_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) notFound();

  const doc = await getDoc(docId);
  if (!doc) notFound();

  const pageTree = await getPageListing(docId);

  // Determine active page
  const targetPageId = pageId || pageTree[0]?.id;
  let activePage = targetPageId ? await getPage(docId, targetPageId) : null;

  if (!activePage) {
    const { data: fallback } = await supabase
      .from("doc_pages")
      .insert({
        doc_id: docId,
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

  let favoriteDocIds: string[] = [];
  const { data: favRows, error: favErr } = await supabase
    .from("user_favorites")
    .select("entity_id")
    .eq("user_id", user.id)
    .eq("entity_type", "document");
  if (!favErr && favRows) {
    favoriteDocIds = favRows.map((f) => f.entity_id);
  }

  return (
    <main className="app-shell clickup-doc-page-shell">
      <AppTopBar
        email={user.email ?? ""}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        organizationId={workspace.organization_id}
      />

      <div className="doc-page-subbar">
        <Link className="back-link" href={`/workspaces/${workspaceId}/docs`}>
          <ArrowLeft size={15} /> Back to Documents
        </Link>
      </div>

      <ClickUpDocWorkspace
        workspaceId={workspaceId}
        projectId={doc.project_id || undefined}
        workspaceName={workspace.name}
        doc={doc}
        initialPages={pageTree}
        initialActivePage={activePage}
        currentUserId={user.id}
        currentUserName={currentUserName}
        favoriteDocIds={favoriteDocIds}
      />
    </main>
  );
}
