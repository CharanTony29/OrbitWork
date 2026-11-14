// src/app/api/workspaces/[workspaceId]/docs/route.ts
import { NextResponse } from "next/server";
import { getWorkspaceDocs, createDoc } from "@/lib/docs/service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(req.url);

    const filter = searchParams.get("filter") || undefined;
    const query = searchParams.get("query") || searchParams.get("q") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const sort = searchParams.get("sort") || undefined;
    const projectId = searchParams.get("project_id") || undefined;
    const isArchived = searchParams.has("is_archived")
      ? searchParams.get("is_archived") === "true"
      : undefined;
    const isTrash = searchParams.get("is_trash") === "true";
    const limit = searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.has("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const result = await getWorkspaceDocs(workspaceId, {
      filter,
      query,
      tag,
      sort,
      projectId,
      isArchived,
      isTrash,
      limit,
      offset,
    });

    return NextResponse.json({
      docs: result.docs,
      total: result.total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("GET /api/workspaces/[workspaceId]/docs error", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const body = await req.json();

    const result = await createDoc({
      workspaceId,
      projectId: body.projectId || body.project_id || null,
      title: body.title || "Untitled Document",
      icon: body.icon || "📄",
      description: body.description || "",
      isWiki: Boolean(body.isWiki || body.is_wiki),
      isPrivate: Boolean(body.isPrivate || body.is_private),
      templateId: body.templateId || body.template_id,
      tags: body.tags || [],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        doc: result.doc,
        page: result.page,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/workspaces/[workspaceId]/docs error", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
