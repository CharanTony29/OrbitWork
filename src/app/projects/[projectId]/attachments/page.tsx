import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { createClient } from "@/lib/supabase/server";
import ProjectAttachmentsClient, { ProjectAttachmentItem } from "./ProjectAttachmentsClient";

export default async function ProjectAttachmentsPage({
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
    .select("id, name, workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: rawAttachments } = await supabase
    .from("task_attachments")
    .select(
      "id, task_id, project_id, file_name, mime_type, file_size_bytes, storage_provider, external_file_id, created_at, tasks(id, title)"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const attachments: ProjectAttachmentItem[] = (rawAttachments ?? [])
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

  return (
    <main className="app-shell project-app-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <div className="topbar-right">
          <CurrentUserBadge email={user.email ?? ""} />
        </div>
      </header>

      <div
        className="project-page"
        style={{
          height: "calc(100vh - 46px)",
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          margin: 0,
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <ProjectAttachmentsClient
          projectId={projectId}
          projectName={project.name}
          attachments={attachments}
        />
      </div>
    </main>
  );
}
