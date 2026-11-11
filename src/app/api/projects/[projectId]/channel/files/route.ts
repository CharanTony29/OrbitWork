import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_CHANNEL_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: canAccess } = await supabase.rpc("can_access_project", {
    target_project: projectId,
  });
  if (canAccess !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_CHANNEL_FILE_BYTES) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 15 MB" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hexBytea = `\\x${buffer.toString("hex")}`;
  const cleanName = (file.name || "attachment.bin").slice(0, 240);
  const mimeType = file.type || "application/octet-stream";

  const { data: inserted, error } = await supabase
    .from("project_channel_files")
    .insert({
      project_id: projectId,
      uploaded_by: user.id,
      file_name: cleanName,
      mime_type: mimeType,
      file_size_bytes: file.size,
      file_bytes: hexBytea,
    })
    .select("id, file_name, mime_type, file_size_bytes, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Could not save channel file. Confirm migration 202611110002 is applied.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    file: {
      ...inserted,
      url: `/api/projects/${projectId}/channel/files/${inserted.id}`,
    },
  });
}
