import Link from "next/link";
import AppTopBar from "@/app/AppTopBar";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DocumentsHub from "@/app/docs/DocumentsHub";
import { getWorkspaceDocs } from "@/lib/docs/service";

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id, workspaces(id, name, organization_id)")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const workspaceId = project.workspace_id;
  const workspaceName = (project.workspaces as any)?.name || "Workspace";
  const organizationId = (project.workspaces as any)?.organization_id;

  const result = await getWorkspaceDocs(workspaceId, {
    projectId,
  });

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
        projectId={projectId}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        organizationId={organizationId}
      />

      <div className="doc-page-subbar">
        <Link className="back-link" href={`/projects/${projectId}`}>
          <ArrowLeft size={15} /> Back to {project.name}
        </Link>
      </div>

      <DocumentsHub
        workspaceId={workspaceId}
        projectId={projectId}
        workspaceName={workspaceName}
        projectName={project.name}
        organizationId={organizationId}
        initialDocs={result.docs}
        currentUserId={user.id}
        favoriteDocIds={favoriteDocIds}
      />
    </main>
  );
}
