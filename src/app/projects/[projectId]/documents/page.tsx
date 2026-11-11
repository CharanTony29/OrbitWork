import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import ClickUpDocWorkspace from "./ClickUpDocWorkspace";

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
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: documents } = await supabase
    .from("project_documents")
    .select("id, title, body_markdown, updated_at, created_by")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (documents && documents.length > 0) {
    redirect(`/projects/${projectId}/documents/${documents[0].id}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const currentUserName = profile?.display_name?.trim() || user.email || "Team member";

  const { data: rawAttachments } = await supabase
    .from("task_attachments")
    .select(
      "id, task_id, project_id, file_name, mime_type, file_size_bytes, storage_provider, external_file_id, created_at, tasks(id, title)"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const taskAttachments = (rawAttachments ?? [])
    .filter((a) => {
      const isCanvas =
        a.mime_type.includes("whiteboard") ||
        a.mime_type.includes("flowchart") ||
        a.file_name.toLowerCase().endsWith(".whiteboard") ||
        a.file_name.toLowerCase().endsWith(".flowchart");
      return !isCanvas;
    })
    .map((a) => ({
      id: a.id,
      task_id: a.task_id,
      task_title: (a.tasks as any)?.title || "Task",
      file_name: a.file_name,
      mime_type: a.mime_type,
      file_size_bytes: a.file_size_bytes ?? undefined,
      created_at: a.created_at,
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

  return (
    <main className="app-shell clickup-doc-page-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <div className="topbar-right">
          <CurrentUserBadge email={user.email ?? ""} />
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
        documents={[]}
        currentUserName={currentUserName}
        taskAttachments={taskAttachments}
        favoriteDocIds={favoriteDocIds}
      />
    </main>
  );
}
