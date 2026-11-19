import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { indexAttachment } from "@/lib/ai/rag/index-service";

/**
 * Chunked attachment upload handler.
 * Avoids Vercel's 4.5 MB serverless function payload limit (FUNCTION_PAYLOAD_TOO_LARGE)
 * by receiving file slices in 3 MB chunks and assembling them into attachment_files.
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

  // 1. ACTION: INIT (Initialize task_attachment record)
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

      const { data: inserted, error: insertErr } = await supabase
        .from("task_attachments")
        .insert({
          project_id: projectId,
          task_id: taskId,
          file_name: safeName,
          mime_type: contentType,
          file_size_bytes: Number(fileSize) || 0,
          storage_provider: "built_in",
          external_file_id: "built_in",
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

      return NextResponse.json({ ok: true, attachmentId: inserted.id });
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

  // 3. ACTION: COMPLETE (Trigger RAG indexing and return final attachment object)
  if (action === "complete") {
    try {
      const body = await request.json();
      const { attachmentId, projectId, taskId } = body;

      if (!attachmentId) {
        return NextResponse.json({ ok: false, error: "attachmentId required" }, { status: 400 });
      }

      const { data: attachment } = await supabase
        .from("task_attachments")
        .select("id, project_id, task_id, file_name, mime_type, file_size_bytes")
        .eq("id", attachmentId)
        .maybeSingle();

      if (!attachment) {
        return NextResponse.json({ ok: false, error: "Attachment not found" }, { status: 404 });
      }

      // Read completed file bytes to index for RAG
      const { data: fileRow } = await supabase
        .from("attachment_files")
        .select("file_bytes")
        .eq("id", attachmentId)
        .maybeSingle();

      if (fileRow?.file_bytes) {
        let fullBuffer: Buffer;
        if (typeof fileRow.file_bytes === "string") {
          const h = fileRow.file_bytes.startsWith("\\x")
            ? fileRow.file_bytes.slice(2)
            : fileRow.file_bytes;
          fullBuffer = Buffer.from(h, "hex");
        } else {
          fullBuffer = Buffer.from(fileRow.file_bytes);
        }

        // Trigger RAG concept indexing in background
        void indexAttachment({
          supabase,
          attachmentId: attachment.id,
          buffer: fullBuffer,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
          projectId: projectId || attachment.project_id,
          taskId: taskId || attachment.task_id,
        }).catch(() => undefined);
      }

      return NextResponse.json({
        ok: true,
        id: attachment.id,
        fileName: attachment.file_name,
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
