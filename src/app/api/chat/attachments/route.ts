import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";
import { getUserActiveOrgIds, noStoreJson } from "@/lib/chat-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHAT_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const orgIdRaw = formData.get("organizationId");
    const orgParam = typeof orgIdRaw === "string" ? orgIdRaw.trim() : null;

    if (!(file instanceof File)) {
      return noStoreJson({ error: "Missing file." }, 400);
    }
    if (file.size <= 0) {
      return noStoreJson({ error: "Uploaded file is empty." }, 400);
    }
    if (file.size > MAX_CHAT_UPLOAD_BYTES) {
      return noStoreJson(
        { error: "File exceeds the 8 MB chat upload limit." },
        413
      );
    }

    const activeOrgIds = await getUserActiveOrgIds(supabase, user.id);
    const resolvedOrgId =
      orgParam && activeOrgIds.includes(orgParam)
        ? orgParam
        : activeOrgIds[0] ?? null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const hexPayload = `\\x${buffer.toString("hex")}`;
    const mimeType = file.type || "application/octet-stream";
    const fileName = (file.name || "attachment").slice(0, 180);

    const { data: created, error } = await supabase
      .from("chat_attachments")
      .insert({
        uploader_id: user.id,
        organization_id: resolvedOrgId,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: file.size,
        file_bytes: hexPayload,
      })
      .select("id, file_name, mime_type, file_size_bytes, created_at")
      .single();

    if (error) {
      if (isSchemaMissingError(error)) {
        return noStoreJson(
          {
            ok: false,
            migrationMissing: true,
            error:
              "Chat file attachments table is not migrated yet. Apply supabase/migrations/202611120001_enterprise_chat.sql.",
          },
          503
        );
      }
      return noStoreJson({ error: error.message }, 500);
    }

    return noStoreJson(
      {
        ok: true,
        attachment: {
          id: created.id,
          fileName: created.file_name,
          mimeType: created.mime_type,
          fileSizeBytes: created.file_size_bytes,
          url: `/api/chat/attachments/${created.id}`,
        },
      },
      201
    );
  } catch (err) {
    console.error("Chat attachment upload error:", err);
    return noStoreJson({ error: "Failed to upload chat attachment." }, 500);
  }
}
