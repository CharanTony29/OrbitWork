// src/app/api/workspaces/[workspaceId]/docs/[docId]/pages/[pageId]/route.ts
import { NextResponse } from "next/server";
import { getPage, updatePage, deletePage, movePage } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string }> }
) {
  try {
    const { docId, pageId } = await params;
    const page = await getPage(docId, pageId);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    return NextResponse.json({ page });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string }> }
) {
  try {
    const { docId, pageId } = await params;
    const body = await req.json();

    const result = await updatePage(docId, pageId, {
      title: body.title,
      icon: body.icon,
      cover_url: body.cover_url,
      position: body.position,
      parent_page_id: body.parent_page_id,
      content_json: body.content_json || body.contentJson,
      content_markdown: body.content_markdown || body.contentMarkdown,
      page_type: body.page_type || body.pageType,
      is_archived: body.is_archived !== undefined ? Boolean(body.is_archived) : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await getPage(docId, pageId);
    return NextResponse.json({ page: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string }> }
) {
  try {
    const { docId, pageId } = await params;
    const body = await req.json();

    const result = await movePage(docId, pageId, {
      parentPageId: body.parent_page_id !== undefined ? body.parent_page_id : (body.parentPageId || null),
      position: body.position !== undefined ? body.position : 1000.0,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string }> }
) {
  try {
    const { docId, pageId } = await params;
    const result = await deletePage(docId, pageId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
