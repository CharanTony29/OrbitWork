import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { indexAttachment } from "@/lib/ai/rag/index-service";
import { googleDriveAccessToken, uploadProjectDriveFile } from "@/lib/google-drive";
import { getOneDriveAccessToken, uploadProjectOneDriveFile } from "@/lib/onedrive";
import { getWorkspaceStorageConfig } from "@/lib/storage-config";

/**
 * Chunked attachment upload handler.
 * Avoids Vercel's 4.5 MB serverless function payload limit (FUNCTION_PAYLOAD_TOO_LARGE)
 * by receiving file slices in 3 MB chunks and streaming them to the workspace's selected
 * drive (Google Drive, OneDrive, or built-in direct storage).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "chunk";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 1. ACTION: INIT (Initialize task_attachment record with target storage provider)
  if (action === "init") {
    try {
      const body = await request.json();
      const { projectId, taskId, fileName, fileSize, mimeType } = body;

      if (!projectId || !taskId || !fileName) {
        return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
      }

      // Check user permission
      const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", {
        target_project: projectId,
      });
      if (!canEdit) {
        return NextResponse.json(
          { ok: false, error: "You do not have permission to edit this task" },
          { status: 403 }
        );
      }

      const safeName =
        fileName.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim().slice(0, 255) || "attachment";
      const contentType = (mimeType || "application/octet-stream").slice(0, 150);

      // Determine active storage provider (Google Drive, OneDrive, or built_in)
      let initialProvider = "built_in";
      const { data: project } = await supabase
        .from("projects")
        .select("id, workspace_id, workspaces(id, organization_id)")
        .eq("id", projectId)
        .maybeSingle();

      const wsRel = project?.workspaces;
      const workspace = Array.isArray(wsRel) ? wsRel[0] : wsRel;
      if (project && workspace?.organization_id) {
        try {
          const adminClient = createAdminClient();
          const dbClient = adminClient || supabase;
          const storageConfig = await getWorkspaceStorageConfig(
            dbClient,
            workspace.id || project.workspace_id,
            workspace.organization_id
          );
          initialProvider = storageConfig.activeProvider;
        } catch {
          // fallback to built_in
        }
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("task_attachments")
        .insert({
          project_id: projectId,
          task_id: taskId,
          file_name: safeName,
          mime_type: contentType,
          file_size_bytes: Number(fileSize) || 0,
          storage_provider: initialProvider,
          external_file_id: initialProvider,
          uploaded_by: user.id,
        })
        .select("id")
        .maybeSingle();

      if (insertErr || !inserted?.id) {
        return NextResponse.json(
          { ok: false, error: insertErr?.message || "Failed to initialize attachment" },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, attachmentId: inserted.id, storageProvider: initialProvider });
    } catch (err) {
      console.error("[Chunk Upload Init Error]:", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Failed to init upload" },
        { status: 500 }
      );
    }
  }

  // 2. ACTION: CHUNK (Receive one 3 MB slice)
  if (action === "chunk") {
    try {
      const formData = await request.formData();
      const attachmentId = String(formData.get("attachmentId") || "");
      const chunkIndex = Number(formData.get("chunkIndex") || 0);
      const chunkFile = formData.get("chunk");

      if (!attachmentId || !(chunkFile instanceof Blob)) {
        return NextResponse.json({ ok: false, error: "Invalid chunk payload" }, { status: 400 });
      }

      // Verify attachment exists and user has edit rights on the project
      const { data: attachment } = await supabase
        .from("task_attachments")
        .select("id, project_id")
        .eq("id", attachmentId)
        .maybeSingle();

      if (!attachment) {
        return NextResponse.json({ ok: false, error: "Attachment not found" }, { status: 404 });
      }

      const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", {
        target_project: attachment.project_id,
      });
      if (!canEdit) {
        return NextResponse.json({ ok: false, error: "Permission denied" }, { status: 403 });
      }

      const chunkBuffer = Buffer.from(await chunkFile.arrayBuffer());

      if (chunkIndex === 0) {
        // First chunk: insert into attachment_files
        const hex = `\\x${chunkBuffer.toString("hex")}`;
        const { error: fileErr } = await supabase.from("attachment_files").upsert(
          {
            id: attachmentId,
            file_bytes: hex,
          },
          { onConflict: "id" }
        );

        if (fileErr) {
          return NextResponse.json({ ok: false, error: fileErr.message }, { status: 500 });
        }
      } else {
        // Subsequent chunks: try PostgreSQL append_attachment_chunk RPC, or fallback to Node concat
        const hex = `\\x${chunkBuffer.toString("hex")}`;
        const { error: rpcErr } = await supabase.rpc("append_attachment_chunk", {
          p_attachment_id: attachmentId,
          p_chunk: hex,
          p_is_first: false,
        });

        if (rpcErr) {
          // Fallback: Node buffer concat
          const { data: existing, error: readErr } = await supabase
            .from("attachment_files")
            .select("file_bytes")
            .eq("id", attachmentId)
            .maybeSingle();

          if (readErr) {
            return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
          }

          let prevBuffer = Buffer.alloc(0);
          if (existing?.file_bytes) {
            if (typeof existing.file_bytes === "string") {
              const h = existing.file_bytes.startsWith("\\x")
                ? existing.file_bytes.slice(2)
                : existing.file_bytes;
              prevBuffer = Buffer.from(h, "hex");
            } else {
              prevBuffer = Buffer.from(existing.file_bytes);
            }
          }

          const combined = Buffer.concat([prevBuffer, chunkBuffer]);
          const combinedHex = `\\x${combined.toString("hex")}`;

          const { error: updateErr } = await supabase
            .from("attachment_files")
            .update({ file_bytes: combinedHex })
            .eq("id", attachmentId);

          if (updateErr) {
            return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
          }
        }
      }

      return NextResponse.json({ ok: true, chunkIndex });
    } catch (err) {
      console.error("[Chunk Upload Write Error]:", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Chunk write error" },
        { status: 500 }
      );
    }
  }

  // 3. ACTION: COMPLETE (Promote to Google Drive / OneDrive if active, trigger RAG, return final object)
  if (action === "complete") {
    try {
      const body = await request.json();
      const { attachmentId, projectId, taskId } = body;

      if (!attachmentId) {
        return NextResponse.json({ ok: false, error: "attachmentId required" }, { status: 400 });
      }

      const { data: attachment } = await supabase
        .from("task_attachments")
        .select("id, project_id, task_id, file_name, mime_type, file_size_bytes, storage_provider")
        .eq("id", attachmentId)
        .maybeSingle();

      if (!attachment) {
        return NextResponse.json({ ok: false, error: "Attachment not found" }, { status: 404 });
      }

      // Read completed file bytes
      const { data: fileRow } = await supabase
        .from("attachment_files")
        .select("file_bytes")
        .eq("id", attachmentId)
        .maybeSingle();

      if (!fileRow?.file_bytes) {
        return NextResponse.json({ ok: false, error: "File content not found" }, { status: 404 });
      }

      let fullBuffer: Buffer;
      if (typeof fileRow.file_bytes === "string") {
        const h = fileRow.file_bytes.startsWith("\\x")
          ? fileRow.file_bytes.slice(2)
          : fileRow.file_bytes;
        fullBuffer = Buffer.from(h, "hex");
      } else {
        fullBuffer = Buffer.from(fileRow.file_bytes);
      }

      let finalProvider = attachment.storage_provider || "built_in";
      let finalExternalId = "built_in";
      let finalFileSize = attachment.file_size_bytes || fullBuffer.length;

      // 4. Check workspace storage configuration and upload to selected Drive
      const { data: project } = await supabase
        .from("projects")
        .select("id, name, workspace_id, workspaces(id, name, organization_id)")
        .eq("id", projectId || attachment.project_id)
        .maybeSingle();

      const wsRel = project?.workspaces;
      const workspace = Array.isArray(wsRel) ? wsRel[0] : wsRel;

      if (project && workspace?.organization_id) {
        try {
          const adminClient = createAdminClient();
          const dbClient = adminClient || supabase;
          const storageConfig = await getWorkspaceStorageConfig(
            dbClient,
            workspace.id || project.workspace_id,
            workspace.organization_id
          );
          const targetProvider = storageConfig.activeProvider;

          if (targetProvider === "google_drive") {
            const accessToken = await googleDriveAccessToken(
              supabase,
              workspace.organization_id,
              workspace.id || project.workspace_id
            );
            if (accessToken) {
              const uploaded = await uploadProjectDriveFile(
                accessToken,
                projectId || attachment.project_id,
                attachment.file_name,
                attachment.mime_type,
                fullBuffer,
                { workspaceName: workspace.name, projectName: project.name }
              );

              finalProvider = "google_drive";
              finalExternalId = uploaded.id;
              if (uploaded.size) finalFileSize = Number(uploaded.size);

              await supabase
                .from("task_attachments")
                .update({
                  storage_provider: "google_drive",
                  external_file_id: uploaded.id,
                  file_size_bytes: finalFileSize,
                })
                .eq("id", attachment.id);

              // Clean up local bytes now that it is safely stored in Google Drive
              await supabase.from("attachment_files").delete().eq("id", attachment.id);
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
                attachment.file_name,
                attachment.mime_type,
                fullBuffer
              );

              finalProvider = "onedrive";
              finalExternalId = uploaded.id;
              if (uploaded.size) finalFileSize = uploaded.size;

              await supabase
                .from("task_attachments")
                .update({
                  storage_provider: "onedrive",
                  external_file_id: uploaded.id,
                  file_size_bytes: finalFileSize,
                })
                .eq("id", attachment.id);

              await supabase.from("attachment_files").delete().eq("id", attachment.id);
            }
          }
        } catch (storageErr) {
          console.warn("[Chunk Upload Storage Warning] Live drive upload failed, falling back to local:", storageErr);
        }
      }

      // Trigger RAG concept indexing safely before returning response
      await indexAttachment({
        supabase,
        attachmentId: attachment.id,
        buffer: fullBuffer,
        fileName: attachment.file_name,
        mimeType: attachment.mime_type,
        projectId: projectId || attachment.project_id,
        taskId: taskId || attachment.task_id,
      }).catch((idxErr) => {
        console.warn("[Chunk Upload Complete] RAG indexing notice:", idxErr);
      });

      return NextResponse.json({
        ok: true,
        id: attachment.id,
        fileName: attachment.file_name,
        storageProvider: finalProvider,
        url: `/api/attachments/${attachment.id}`,
      });
    } catch (err) {
      console.error("[Chunk Upload Complete Error]:", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Complete failed" },
        { status: 500 }
      );
    }
  }

  // 4. ACTION: ABORT (Clean up on failure or user cancellation)
  if (action === "abort") {
    try {
      const body = await request.json();
      const { attachmentId } = body;
      if (attachmentId) {
        await supabase.from("task_attachments").delete().eq("id", attachmentId);
        await supabase.from("attachment_files").delete().eq("id", attachmentId);
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
