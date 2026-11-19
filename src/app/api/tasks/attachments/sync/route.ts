import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { googleDriveAccessToken, uploadProjectDriveFile } from "@/lib/google-drive";
import { getOneDriveAccessToken, uploadProjectOneDriveFile } from "@/lib/onedrive";
import { getWorkspaceStorageConfig } from "@/lib/storage-config";

/**
 * Syncs any local built_in attachments to the workspace's selected cloud drive (Google Drive / OneDrive).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { taskId, projectId, attachmentId } = body;

    let query = supabase.from("task_attachments").select("id, project_id, task_id, file_name, mime_type, file_size_bytes, storage_provider");
    if (attachmentId) {
      query = query.eq("id", attachmentId);
    } else if (taskId) {
      query = query.eq("task_id", taskId);
    } else if (projectId) {
      query = query.eq("project_id", projectId);
    } else {
      return NextResponse.json({ ok: false, error: "taskId or projectId required" }, { status: 400 });
    }

    const { data: rawAttachments } = await query;
    const localAttachments = (rawAttachments ?? []).filter((a) => a.storage_provider === "built_in");

    if (localAttachments.length === 0) {
      return NextResponse.json({ ok: true, syncedCount: 0 });
    }

    const targetProjectId = projectId || localAttachments[0].project_id;
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, workspace_id, workspaces(id, name, organization_id)")
      .eq("id", targetProjectId)
      .maybeSingle();

    const wsRel = project?.workspaces;
    const workspace = Array.isArray(wsRel) ? wsRel[0] : wsRel;

    if (!project || !workspace?.organization_id) {
      return NextResponse.json({ ok: true, syncedCount: 0 });
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;
    const storageConfig = await getWorkspaceStorageConfig(
      dbClient,
      workspace.id || project.workspace_id,
      workspace.organization_id
    );
    const targetProvider = storageConfig.activeProvider;

    if (targetProvider !== "google_drive" && targetProvider !== "onedrive") {
      return NextResponse.json({ ok: true, syncedCount: 0, reason: "Local storage is active" });
    }

    let syncedCount = 0;
    const syncedList: Array<{ id: string; fileName: string; storageProvider: string }> = [];

    for (const att of localAttachments) {
      const { data: fileRow } = await supabase
        .from("attachment_files")
        .select("file_bytes")
        .eq("id", att.id)
        .maybeSingle();

      if (!fileRow?.file_bytes) continue;

      let buffer: Buffer;
      if (typeof fileRow.file_bytes === "string") {
        const h = fileRow.file_bytes.startsWith("\\x") ? fileRow.file_bytes.slice(2) : fileRow.file_bytes;
        buffer = Buffer.from(h, "hex");
      } else {
        buffer = Buffer.from(fileRow.file_bytes);
      }

      if (buffer.length === 0) continue;

      if (targetProvider === "google_drive") {
        const accessToken = await googleDriveAccessToken(
          supabase,
          workspace.organization_id,
          workspace.id || project.workspace_id
        );
        if (accessToken) {
          const uploaded = await uploadProjectDriveFile(
            accessToken,
            att.project_id,
            att.file_name,
            att.mime_type,
            buffer,
            { workspaceName: workspace.name, projectName: project.name }
          );

          await supabase
            .from("task_attachments")
            .update({
              storage_provider: "google_drive",
              external_file_id: uploaded.id,
              file_size_bytes: Number(uploaded.size) || buffer.length,
            })
            .eq("id", att.id);

          await supabase.from("attachment_files").delete().eq("id", att.id);

          syncedCount++;
          syncedList.push({ id: att.id, fileName: att.file_name, storageProvider: "google_drive" });
        }
      } else if (targetProvider === "onedrive") {
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
            att.file_name,
            att.mime_type,
            buffer
          );

          await supabase
            .from("task_attachments")
            .update({
              storage_provider: "onedrive",
              external_file_id: uploaded.id,
              file_size_bytes: uploaded.size || buffer.length,
            })
            .eq("id", att.id);

          await supabase.from("attachment_files").delete().eq("id", att.id);

          syncedCount++;
          syncedList.push({ id: att.id, fileName: att.file_name, storageProvider: "onedrive" });
        }
      }
    }

    return NextResponse.json({ ok: true, syncedCount, syncedList });
  } catch (err) {
    console.error("[Attachment Sync Error]:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
