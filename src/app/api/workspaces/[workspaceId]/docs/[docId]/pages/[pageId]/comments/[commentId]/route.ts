// src/app/api/workspaces/[workspaceId]/docs/[docId]/pages/[pageId]/comments/[commentId]/route.ts
import { NextResponse } from "next/server";
import { resolveComment } from "@/lib/docs/service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const body = await req.json();

    const resolved = Boolean(body.resolved || body.is_resolved);
    const result = await resolveComment(commentId, resolved);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, is_resolved: resolved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
