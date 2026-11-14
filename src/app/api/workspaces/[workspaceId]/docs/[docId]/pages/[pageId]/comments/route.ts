// src/app/api/workspaces/[workspaceId]/docs/[docId]/pages/[pageId]/comments/route.ts
import { NextResponse } from "next/server";
import { getComments, createComment } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const comments = await getComments(pageId);
    return NextResponse.json({ comments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string }> }
) {
  try {
    const { docId, pageId } = await params;
    const body = await req.json();

    const result = await createComment(docId, pageId, {
      content: body.content,
      selectedText: body.selected_text || body.selectedText,
      blockId: body.block_id || body.blockId,
      parentCommentId: body.parent_comment_id || body.parentCommentId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ comment: result.comment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
