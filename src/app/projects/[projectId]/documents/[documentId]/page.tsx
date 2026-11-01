import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import ClickUpDocWorkspace from "../ClickUpDocWorkspace";

export default async function ProjectDocumentPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  const { projectId, documentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: allDocs } = await supabase
    .from("project_documents")
    .select("id, title, body_markdown, updated_at, created_by")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  const activeDocument = (allDocs ?? []).find((d) => d.id === documentId);
  if (!activeDocument) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const currentUserName = profile?.display_name?.trim() || user.email || "Team member";

  return (
    <main className="app-shell clickup-doc-page-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <div className="topbar-right">
          <CurrentUserBadge email={user.email ?? ""} />
          <form action={signOut}>
            <button className="quiet-button">Sign out</button>
          </form>
        </div>
      </header>

      <div className="doc-page-subbar">
        <Link className="back-link" href={`/projects/${projectId}`}>
          <ArrowLeft size={15} /> Back to {project.name}
        </Link>
      </div>

      <ClickUpDocWorkspace
        projectId={projectId}
        projectName={project.name}
        documents={allDocs ?? []}
        currentDocId={documentId}
        currentUserName={currentUserName}
      />
    </main>
  );
}
