import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: row, error } = await supabase
    .from("chat_attachments")
    .select("id, file_name, mime_type, file_bytes")
    .eq("id", attachmentId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const bytes = decodeBytea(row.file_bytes);
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
