import { createClient } from "@/lib/supabase/server";
import { getDriveFile, googleDriveAccessToken } from "@/lib/google-drive";

export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: attachment, error } = await supabase.from("task_attachments").select("id, project_id, file_name, mime_type, file_size_bytes, storage_provider, external_file_id").eq("id", attachmentId).maybeSingle();
  if (error || !attachment) return new Response("Attachment not found", { status: 404 });
  if (attachment.storage_provider !== "google_drive") return new Response("Unsupported storage provider", { status: 501 });
  const { data: project } = await supabase.from("projects").select("workspaces(organization_id)").eq("id", attachment.project_id).maybeSingle();
  const workspaceRelation = project?.workspaces;
  const workspace = Array.isArray(workspaceRelation) ? workspaceRelation[0] : workspaceRelation;
  if (!workspace?.organization_id) return new Response("Project not found", { status: 404 });
  try {
    const accessToken = await googleDriveAccessToken(supabase, workspace.organization_id);
    const driveFile = await getDriveFile(accessToken, attachment.external_file_id);
    if (!driveFile.body) return new Response("File is empty", { status: 502 });
    const fileName = driveFile.metadata.name.replace(/[\r\n]/g, "_");
    return new Response(driveFile.body, { headers: {
      "Content-Type": attachment.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return new Response("Google Drive file unavailable", { status: 502 });
  }
}
