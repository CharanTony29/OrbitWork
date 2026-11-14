import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DOC_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    if (file.size > MAX_DOC_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 10 MB document upload limit" },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hexPayload = `\\x${buffer.toString("hex")}`;
    const mimeType = file.type || "application/octet-stream";
    const fileName = (file.name || "document-upload").slice(0, 180);

    const db = createAdminClient() || supabase;

    // Optional org lookup
    const { data: memberOrg } = await db
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const { data: created, error } = await db
      .from("chat_attachments")
      .insert({
        uploader_id: user.id,
        organization_id: memberOrg?.organization_id || null,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: file.size,
        file_bytes: hexPayload,
      })
      .select("id, file_name, mime_type, file_size_bytes, created_at")
      .single();

    if (error) {
      console.error("Docs upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        id: created.id,
        fileName: created.file_name,
        mimeType: created.mime_type,
        fileSizeBytes: created.file_size_bytes,
        url: `/api/chat/attachments/${created.id}`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Document upload exception:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload document file." },
      { status: 500 }
    );
  }
}
