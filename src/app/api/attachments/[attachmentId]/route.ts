import { createClient } from "@/lib/supabase/server";
import { getDriveFile, googleDriveAccessToken } from "@/lib/google-drive";

export async function GET(request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";
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
    if (!driveFile.buffer || driveFile.buffer.length === 0) return new Response("File is empty", { status: 502 });
    const fileName = driveFile.metadata.name.replace(/[\r\n]/g, "_");
    const lowerName = fileName.toLowerCase();

    // Accurately determine previewable content types
    let contentType = attachment.mime_type;
    if (lowerName.endsWith(".pdf")) contentType = "application/pdf";
    else if (lowerName.endsWith(".xml")) contentType = "application/xml; charset=utf-8";
    else if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) contentType = "text/html; charset=utf-8";
    else if (lowerName.endsWith(".txt") || lowerName.endsWith(".log") || lowerName.endsWith(".ini") || lowerName.endsWith(".env")) contentType = "text/plain; charset=utf-8";
    else if (lowerName.endsWith(".json")) contentType = "application/json; charset=utf-8";
    else if (lowerName.endsWith(".csv")) contentType = "text/csv; charset=utf-8";
    else if (lowerName.endsWith(".md")) contentType = "text/markdown; charset=utf-8";
    else if (lowerName.endsWith(".svg")) contentType = "image/svg+xml";
    else if (lowerName.endsWith(".png")) contentType = "image/png";
    else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (lowerName.endsWith(".webp")) contentType = "image/webp";
    else if (lowerName.endsWith(".gif")) contentType = "image/gif";

    const totalBytes = driveFile.buffer.byteLength;
    const rangeHeader = request.headers.get("range");

    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const parts = rangeHeader.replace("bytes=", "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : totalBytes - 1;
      const chunk = driveFile.buffer.subarray(start, end + 1);

      return new Response(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType || "application/octet-stream",
          "Content-Range": `bytes ${start}-${end}/${totalBytes}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunk.byteLength.toString(),
          "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new Response(driveFile.buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Content-Length": totalBytes.toString(),
        "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Attachment retrieval error:", err);
    return new Response("Google Drive file unavailable", { status: 502 });
  }
}
