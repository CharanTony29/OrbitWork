import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteDriveFile, GoogleDriveError, googleDriveAccessToken, uploadProjectDriveFile } from "@/lib/google-drive";

const maxBytes = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return new Response("Invalid origin", { status: 403 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes + 1024 * 1024) return new Response("Files must be 15 MB or smaller", { status: 413 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url), 303);
  let form: FormData;
  try { form = await request.formData(); } catch { return new Response("Invalid form data", { status: 400 }); }
  const taskId = String(form.get("taskId") ?? "");
  const projectId = String(form.get("projectId") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(taskId) || !/^[0-9a-f-]{36}$/i.test(projectId) || !(file instanceof File)) return new Response("Task and file are required", { status: 400 });
  if (!file.size || file.size > maxBytes) return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=too_large`, request.url), 303);
  const { data: task } = await supabase.from("tasks").select("id, project_id").eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (!task) return new Response("Task not found", { status: 404 });
  const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", { target_project: projectId });
  if (!canEdit) {
    const target = new URL(`/projects/${projectId}/tasks/${taskId}`, request.url);
    target.searchParams.set("attachment", "forbidden");
    return NextResponse.redirect(target, 303);
  }
  const { data: project } = await supabase.from("projects").select("workspaces(organization_id)").eq("id", projectId).maybeSingle();
  const workspaceRelation = project?.workspaces;
  const workspace = Array.isArray(workspaceRelation) ? workspaceRelation[0] : workspaceRelation;
  if (!workspace?.organization_id) return new Response("Project not found", { status: 404 });
  const safeName = file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim().slice(0, 255) || "attachment";
  const contentType = (file.type || "application/octet-stream").slice(0, 150);
  try {
    const accessToken = await googleDriveAccessToken(supabase, workspace.organization_id);
    const uploaded = await uploadProjectDriveFile(accessToken, projectId, safeName, contentType, new Uint8Array(await file.arrayBuffer()));
    const { error } = await supabase.from("task_attachments").insert({
      project_id: projectId, task_id: taskId, file_name: uploaded.name, mime_type: uploaded.mimeType || contentType,
      file_size_bytes: Number(uploaded.size) || file.size, storage_provider: "google_drive", external_file_id: uploaded.id,
      external_url: null, uploaded_by: user.id,
    });
    if (error) {
      await deleteDriveFile(accessToken, uploaded.id).catch(() => undefined);
      return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=save_failed`, request.url), 303);
    }
    return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
  } catch (error) {
    const driveError = error instanceof GoogleDriveError ? error.failure : "request_failed";
    console.error("Google Drive attachment upload failed", { failure: driveError, status: error instanceof GoogleDriveError ? error.status : undefined });
    const target = new URL(`/projects/${projectId}/tasks/${taskId}`, request.url);
    target.searchParams.set("attachment", "drive_failed");
    target.searchParams.set("driveError", driveError);
    return NextResponse.redirect(target, 303);
  }
}
