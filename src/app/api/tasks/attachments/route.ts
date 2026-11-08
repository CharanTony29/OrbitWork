import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteDriveFile, GoogleDriveError, googleDriveAccessToken, uploadProjectDriveFile } from "@/lib/google-drive";
import { getWorkspaceStorageConfig } from "@/lib/storage-config";

const maxBytes = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return new Response("Invalid origin", { status: 403 });
    } catch {
      return new Response("Invalid origin", { status: 403 });
    }
  } else if (referer && host) {
    try {
      if (new URL(referer).host !== host) return new Response("Invalid referer", { status: 403 });
    } catch {
      return new Response("Invalid referer", { status: 403 });
    }
  }
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
  const linkUrl = String(form.get("linkUrl") ?? "").trim();
  const linkTitle = String(form.get("linkTitle") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(taskId) || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return new Response("Valid task and project IDs are required", { status: 400 });
  }

  const { data: task } = await supabase.from("tasks").select("id, project_id").eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (!task) return new Response("Task not found", { status: 404 });

  const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", { target_project: projectId });
  if (!canEdit) {
    const target = new URL(`/projects/${projectId}/tasks/${taskId}`, request.url);
    target.searchParams.set("attachment", "forbidden");
    return NextResponse.redirect(target, 303);
  }

  // 1. Handle Link Attachment (SharePoint, OneDrive, Google Drive link, Web link)
  if (linkUrl) {
    let provider = "external_link";
    const lower = linkUrl.toLowerCase();
    if (lower.includes("sharepoint.com")) provider = "sharepoint";
    else if (lower.includes("1drv.ms") || lower.includes("onedrive.live.com")) provider = "onedrive";
    else if (lower.includes("drive.google.com")) provider = "google_drive";

    const title = linkTitle || (provider === "sharepoint" ? "SharePoint Document" : provider === "onedrive" ? "OneDrive Document" : "Web Attachment");

    const { error: linkErr } = await supabase.from("task_attachments").insert({
      project_id: projectId,
      task_id: taskId,
      file_name: title.slice(0, 255),
      mime_type: "application/x-external-link",
      file_size_bytes: 0,
      storage_provider: provider,
      external_file_id: linkUrl,
      external_url: linkUrl,
      uploaded_by: user.id,
    });

    if (linkErr) {
      return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=save_failed`, request.url), 303);
    }
    return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
  }

  // 2. Handle File Upload (Direct file upload)
  if (!(file instanceof File)) {
    return new Response("A file or valid link is required", { status: 400 });
  }
  if (!file.size || file.size > maxBytes) {
    return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=too_large`, request.url), 303);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id, workspaces(id, name, organization_id)")
    .eq("id", projectId)
    .maybeSingle();
  const workspaceRelation = project?.workspaces;
  const workspace = Array.isArray(workspaceRelation) ? workspaceRelation[0] : workspaceRelation;
  if (!project || !workspace?.organization_id) return new Response("Project not found", { status: 404 });

  const safeName = file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim().slice(0, 255) || "attachment";
  const contentType = (file.type || "application/octet-stream").slice(0, 150);
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  // Determine active storage provider configured for this workspace
  const storageConfig = await getWorkspaceStorageConfig(supabase, workspace.id || project.workspace_id, workspace.organization_id);
  const targetProvider = storageConfig.activeProvider;

  // 1. If Google Drive is active, upload to Google Drive
  if (targetProvider === "google_drive") {
    try {
      const accessToken = await googleDriveAccessToken(supabase, workspace.organization_id, workspace.id || project.workspace_id);
      if (accessToken) {
        const uploaded = await uploadProjectDriveFile(
          accessToken,
          projectId,
          safeName,
          contentType,
          fileBytes,
          { workspaceName: workspace.name, projectName: project.name }
        );
        const { error } = await supabase.from("task_attachments").insert({
          project_id: projectId,
          task_id: taskId,
          file_name: uploaded.name,
          mime_type: uploaded.mimeType || contentType,
          file_size_bytes: Number(uploaded.size) || file.size,
          storage_provider: "google_drive",
          external_file_id: uploaded.id,
          external_url: null,
          uploaded_by: user.id,
        });
        if (!error) {
          return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
        } else {
          await deleteDriveFile(accessToken, uploaded.id).catch(() => undefined);
        }
      }
    } catch (driveErr) {
      console.info("Google Drive upload failed or not connected, falling back to local storage", driveErr instanceof Error ? driveErr.message : driveErr);
    }
  }

  // 2. Direct Storage (Local Storage, OneDrive, SharePoint, or Fallback)
  // Store file securely in attachment_files table with the appropriate provider tag
  const saveProvider = targetProvider === "onedrive" ? "onedrive" : targetProvider === "sharepoint" ? "sharepoint" : "built_in";
  try {
    const hexData = `\\x${Buffer.from(fileBytes).toString("hex")}`;
    const { data: inserted, error: insertErr } = await supabase
      .from("task_attachments")
      .insert({
        project_id: projectId,
        task_id: taskId,
        file_name: safeName,
        mime_type: contentType,
        file_size_bytes: file.size,
        storage_provider: saveProvider,
        external_file_id: saveProvider,
        external_url: null,
        uploaded_by: user.id,
      })
      .select("id")
      .maybeSingle();

    if (insertErr || !inserted?.id) {
      return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=save_failed`, request.url), 303);
    }

    const { error: fileErr } = await supabase.from("attachment_files").insert({
      id: inserted.id,
      file_bytes: hexData,
    });

    if (fileErr) {
      await supabase.from("task_attachments").delete().eq("id", inserted.id);
      return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=save_failed`, request.url), 303);
    }

    return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
  } catch (fallbackErr) {
    console.error("Direct attachment storage failed", fallbackErr);
    return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=save_failed`, request.url), 303);
  }
}
