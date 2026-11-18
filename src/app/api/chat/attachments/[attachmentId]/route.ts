import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { downloadChatFileFromPersonalCloud } from "@/lib/personal-cloud";
import { isSchemaMissingError } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_INLINE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
]);

function decodeBytea(raw: unknown): Buffer {
  if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
    return Buffer.from(raw);
  }
  if (typeof raw === "string") {
    const cleanHex = raw.startsWith("\\x") ? raw.slice(2) : raw;
    return Buffer.from(cleanHex, "hex");
  }
  return Buffer.alloc(0);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let row: {
    id: string;
    file_name: string;
    mime_type: string;
    file_bytes: unknown;
    storage_provider?: string | null;
    external_file_id?: string | null;
    owner_user_id?: string | null;
    uploader_id?: string | null;
  } | null = null;

  const extRes = await supabase
    .from("chat_attachments")
    .select(
      "id, file_name, mime_type, file_bytes, storage_provider, external_file_id, owner_user_id, uploader_id"
    )
    .eq("id", attachmentId)
    .maybeSingle();

  if (extRes.error && isSchemaMissingError(extRes.error)) {
    const baseRes = await supabase
      .from("chat_attachments")
      .select("id, file_name, mime_type, file_bytes")
      .eq("id", attachmentId)
      .maybeSingle();
    if (baseRes.error || !baseRes.data) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    row = baseRes.data;
  } else if (extRes.error || !extRes.data) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  } else {
    row = extRes.data;
  }

  let bytes: Buffer;
  if (
    (row.storage_provider === "google_drive" || row.storage_provider === "onedrive") &&
    row.external_file_id
  ) {
    const ownerId = row.owner_user_id || row.uploader_id;
    if (!ownerId) {
      return NextResponse.json({ error: "Attachment owner missing" }, { status: 404 });
    }
    // Use adminClient so authorized chat recipients (verified by RLS on chat_attachments above)
    // can stream the file from the sender's personal cloud drive securely without exposing tokens.
    const dbClient = ownerId === user.id ? supabase : createAdminClient() ?? supabase;
    try {
      bytes = await downloadChatFileFromPersonalCloud(
        dbClient,
        ownerId,
        row.storage_provider,
        row.external_file_id
      );
    } catch (cloudErr) {
      console.error("Chat personal cloud download failed:", cloudErr);
      return NextResponse.json(
        {
          error:
            "This file could not be loaded from the sender's personal cloud drive (it may have been moved, deleted, or disconnected).",
        },
        { status: 502 }
      );
    }
  } else {
    bytes = decodeBytea(row.file_bytes);
  }

  const mime = (row.mime_type || "application/octet-stream").toLowerCase();
  const downloadRequested = req.nextUrl.searchParams.get("download") === "1";
  const isInlineSafe =
    SAFE_INLINE_IMAGE_TYPES.has(mime) || mime === "application/pdf";
  const dispositionType =
    !downloadRequested && isInlineSafe ? "inline" : "attachment";
  const safeName = (row.file_name || "attachment").replace(/[\r\n"]/g, "_");

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Disposition": `${dispositionType}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
