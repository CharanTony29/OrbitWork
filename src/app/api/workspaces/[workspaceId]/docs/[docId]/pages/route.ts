// src/app/api/workspaces/[workspaceId]/docs/[docId]/pages/route.ts
import { NextResponse } from "next/server";
import { createPage, getPageListing } from "@/lib/docs/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const supabase = await createClient();
    const { data: pages, error } = await supabase
      .from("doc_pages")
      .select("id, doc_id, parent_page_id, title, icon, position, page_type, is_archived, created_at, updated_at")
      .eq("doc_id", docId)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ pages: pages || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const body = await req.json();

    const result = await createPage(docId, {
      parentPageId: body.parentPageId || body.parent_page_id || null,
      title: body.title || "Untitled Page",
      icon: body.icon || "📄",
      position: body.position,
      contentJson: body.contentJson || body.content_json,
      contentMarkdown: body.contentMarkdown || body.content_markdown,
      pageType: body.pageType || body.page_type || "standard",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ page: result.page }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
