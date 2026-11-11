import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { deleteDriveFile, GoogleDriveError, googleDriveAccessToken, uploadProjectDriveFile } from "@/lib/google-drive";
import { deleteOneDriveFile, getOneDriveAccessToken, uploadProjectOneDriveFile } from "@/lib/onedrive";
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
  const wantsJson =
    String(form.get("responseMode") ?? "") === "json" ||
    (request.headers.get("accept") ?? "").includes("application/json");

  const failResponse = (message: string, status = 400, queryCode = "save_failed") => {
    if (wantsJson) {
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    const redirectUrl = new URL(`/projects/${projectId}/tasks/${taskId}`, request.url);
    redirectUrl.searchParams.set("attachment", queryCode);
    if (message) redirectUrl.searchParams.set("attachment_error", message);
    return NextResponse.redirect(redirectUrl, 303);
  };

  if (!/^[0-9a-f-]{36}$/i.test(taskId) || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return wantsJson
      ? NextResponse.json({ ok: false, error: "Valid task and project IDs are required" }, { status: 400 })
      : new Response("Valid task and project IDs are required", { status: 400 });
  }

  const { data: task } = await supabase.from("tasks").select("id, project_id").eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (!task) {
    return wantsJson
      ? NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 })
      : new Response("Task not found", { status: 404 });
  }

  const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", { target_project: projectId });
  if (!canEdit) {
    return failResponse("You do not have permission to edit this task.", 403, "forbidden");
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
      console.error("[Attachment Link Error] Failed to insert link attachment:", linkErr);
      const redirectUrl = new URL(`/projects/${projectId}/tasks/${taskId}`, request.url);
      redirectUrl.searchParams.set("attachment", "save_failed");
      redirectUrl.searchParams.set("attachment_error", linkErr.message || "Failed to save link reference");
      return NextResponse.redirect(redirectUrl, 303);
    }
    return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
  }

  // 2. Handle File Upload (Direct file upload)
  if (!(file instanceof File)) {
    return wantsJson
      ? NextResponse.json({ ok: false, error: "A file or valid link is required" }, { status: 400 })
      : new Response("A file or valid link is required", { status: 400 });
  }
  if (!file.size || file.size > maxBytes) {
    return failResponse("Files must be between 1 byte and 15 MB.", 413, "too_large");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id, workspaces(id, name, organization_id)")
    .eq("id", projectId)
    .maybeSingle();
  const workspaceRelation = project?.workspaces;
  const workspace = Array.isArray(workspaceRelation) ? workspaceRelation[0] : workspaceRelation;
  if (!project || !workspace?.organization_id) return failResponse("Project not found", 404, "not_found");

  const safeName = file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim().slice(0, 255) || "attachment";
  const contentType = (file.type || "application/octet-stream").slice(0, 150);
  let fileBytes: Uint8Array;
  let storageConfig: Awaited<ReturnType<typeof getWorkspaceStorageConfig>>;
  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;
  try {
    fileBytes = new Uint8Array(await file.arrayBuffer());
    storageConfig = await getWorkspaceStorageConfig(dbClient, workspace.id || project.workspace_id, workspace.organization_id);
  } catch (prepErr) {
    console.error("Attachment upload preparation failed:", prepErr);
    return failResponse(prepErr instanceof Error ? prepErr.message : "Failed to process upload", 500, "save_failed");
  }
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
        const { data: insertedDrive, error } = await supabase.from("task_attachments").insert({
          project_id: projectId,
          task_id: taskId,
          file_name: uploaded.name,
          mime_type: uploaded.mimeType || contentType,
          file_size_bytes: Number(uploaded.size) || file.size,
          storage_provider: "google_drive",
          external_file_id: uploaded.id,
          external_url: null,
          uploaded_by: user.id,
        }).select("id").maybeSingle();
        if (!error && insertedDrive?.id) {
          if (wantsJson) {
            return NextResponse.json({
              ok: true,
              id: insertedDrive.id,
              url: `/api/attachments/${insertedDrive.id}`,
              fileName: uploaded.name,
            });
          }
          return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
        } else {
          console.error("[Attachment Drive Error] Failed to save Google Drive reference:", error);
          await deleteDriveFile(accessToken, uploaded.id).catch(() => undefined);
          return failResponse(error?.message || "Failed to save Google Drive reference", 500, "save_failed");
        }
      }
    } catch (driveErr) {
      console.info("Google Drive upload failed or not connected, falling back to local storage", driveErr instanceof Error ? driveErr.message : driveErr);
    }
  }

  // 2. If OneDrive is active, upload directly to Microsoft OneDrive via Graph API
  if (targetProvider === "onedrive") {
    try {
      const accessToken = await getOneDriveAccessToken(
        supabase,
        workspace.id || project.workspace_id,
        workspace.organization_id,
        adminClient
      );
      if (accessToken) {
        const folder = storageConfig.oneDrive.folderName || "Orbitwork";
        const uploaded = await uploadProjectOneDriveFile(
          accessToken,
          folder,
          safeName,
          contentType,
          fileBytes
        );
        const { data: insertedOd, error: odErr } = await supabase.from("task_attachments").insert({
          project_id: projectId,
          task_id: taskId,
          file_name: uploaded.name,
          mime_type: contentType,
          file_size_bytes: uploaded.size || file.size,
          storage_provider: "onedrive",
          external_file_id: uploaded.id,
          external_url: null,
          uploaded_by: user.id,
        }).select("id").maybeSingle();
        if (!odErr && insertedOd?.id) {
          if (wantsJson) {
            return NextResponse.json({
              ok: true,
              id: insertedOd.id,
              url: `/api/attachments/${insertedOd.id}`,
              fileName: uploaded.name,
            });
          }
          return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
        } else {
          console.error("[Attachment OneDrive DB Error] Failed to save OneDrive reference:", odErr);
          await deleteOneDriveFile(accessToken, uploaded.id).catch(() => undefined);
          return failResponse(odErr?.message || "Failed to save OneDrive reference", 500, "save_failed");
        }
      }
    } catch (odErr) {
      console.warn("Microsoft OneDrive live upload failed or tokens not present, falling back to direct storage:", odErr);
    }
  }

  // 3. Direct Storage (Local Storage, SharePoint, or Fallback)
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
      console.error("[Attachment Upload Error] Failed to insert into task_attachments:", insertErr);
      return failResponse(insertErr?.message || "Failed to save attachment", 500, "save_failed");
    }

    const { error: fileErr } = await supabase.from("attachment_files").insert({
      id: inserted.id,
      file_bytes: hexData,
    });

    if (fileErr) {
      console.error("[Attachment Upload Error] Failed to insert into attachment_files:", fileErr);
      await supabase.from("task_attachments").delete().eq("id", inserted.id);
      return failResponse(fileErr?.message || "Failed to save attachment bytes", 500, "save_failed");
    }

    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        id: inserted.id,
        url: `/api/attachments/${inserted.id}`,
        fileName: safeName,
      });
    }
    return NextResponse.redirect(new URL(`/projects/${projectId}/tasks/${taskId}?attachment=uploaded`, request.url), 303);
  } catch (fallbackErr) {
    console.error("Direct attachment storage failed", fallbackErr);
    const msg = fallbackErr instanceof Error ? fallbackErr.message : "Unexpected upload error";
    return failResponse(msg, 500, "save_failed");
  }
}
