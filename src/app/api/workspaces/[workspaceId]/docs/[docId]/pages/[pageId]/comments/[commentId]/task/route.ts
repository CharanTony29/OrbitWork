// src/app/api/workspaces/[workspaceId]/docs/[docId]/pages/[pageId]/comments/[commentId]/task/route.ts
import { NextResponse } from "next/server";
import { convertCommentToTask, getDoc } from "@/lib/docs/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string; commentId: string }> }
) {
  try {
    const { docId, commentId } = await params;
    const body = await req.json();

    let projectId = body.projectId || body.project_id;
    if (!projectId) {
      const doc = await getDoc(docId);
      projectId = doc?.project_id;
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required to convert a comment to a task" }, { status: 400 });
    }

    const result = await convertCommentToTask(commentId, {
      projectId,
      title: body.title || "Follow-up task from doc comment",
      description: body.description,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, taskId: result.taskId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
