// src/app/api/workspaces/[workspaceId]/docs/[docId]/route.ts
import { NextResponse } from "next/server";
import { getDoc, updateDoc, deleteDoc, duplicateDoc, restoreDoc } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const doc = await getDoc(docId);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ doc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const body = await req.json();

    const result = await updateDoc(docId, {
      title: body.title,
      icon: body.icon,
      cover_url: body.cover_url,
      description: body.description,
      is_wiki: body.is_wiki !== undefined ? Boolean(body.is_wiki) : undefined,
      is_protected: body.is_protected !== undefined ? Boolean(body.is_protected) : undefined,
      is_private: body.is_private !== undefined ? Boolean(body.is_private) : undefined,
      is_archived: body.is_archived !== undefined ? Boolean(body.is_archived) : undefined,
      tags: body.tags,
      deleted_at: body.deleted_at,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await getDoc(docId);
    return NextResponse.json({ doc: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    const result = await deleteDoc(docId, permanent);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
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
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "duplicate") {
      const res = await duplicateDoc(docId);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true, newDocId: res.newDocId });
    }

    if (action === "restore") {
      const res = await restoreDoc(docId);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
