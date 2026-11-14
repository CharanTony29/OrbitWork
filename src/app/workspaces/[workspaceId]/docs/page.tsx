import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DocumentsHub from "@/app/docs/DocumentsHub";
import { getWorkspaceDocs } from "@/lib/docs/service";

export default async function WorkspaceDocsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
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

  const result = await getWorkspaceDocs(workspaceId);

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
        <Link className="back-link" href={`/workspaces/${workspaceId}`}>
          <ArrowLeft size={15} /> Back to {workspace.name}
        </Link>
      </div>

      <DocumentsHub
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        organizationId={workspace.organization_id}
        initialDocs={result.docs}
        currentUserId={user.id}
        favoriteDocIds={favoriteDocIds}
      />
    </main>
  );
}
