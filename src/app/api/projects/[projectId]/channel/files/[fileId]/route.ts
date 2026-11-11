import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
  context: { params: Promise<{ projectId: string; fileId: string }> }
) {
  const { projectId, fileId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("project_channel_files")
    .select("id, file_name, mime_type, file_bytes")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const bytes = decodeBytea(row.file_bytes);
  const downloadRequested = req.nextUrl.searchParams.get("download") === "1";
  const isInlineSafe =
    row.mime_type.startsWith("image/") || row.mime_type === "application/pdf";
  const dispositionType =
    !downloadRequested && isInlineSafe ? "inline" : "attachment";
  const safeName = (row.file_name || "file").replace(/[\r\n"]/g, "_");

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Disposition": `${dispositionType}; filename="${safeName}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
