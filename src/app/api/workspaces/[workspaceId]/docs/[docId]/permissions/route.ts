// src/app/api/workspaces/[workspaceId]/docs/[docId]/permissions/route.ts
import { NextResponse } from "next/server";
import { getDocMembers, updateDocMember, removeDocMember } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const members = await getDocMembers(docId);
    return NextResponse.json({ members });
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

    const targetUserId = body.userId || body.user_id;
    const role = body.role as "owner" | "editor" | "commenter" | "viewer";

    if (!targetUserId || !role) {
      return NextResponse.json({ error: "userId and valid role are required" }, { status: 400 });
    }

    const result = await updateDocMember(docId, targetUserId, role);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const members = await getDocMembers(docId);
    return NextResponse.json({ ok: true, members });
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
    const targetUserId = searchParams.get("userId") || searchParams.get("user_id");

    if (!targetUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const result = await removeDocMember(docId, targetUserId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const members = await getDocMembers(docId);
    return NextResponse.json({ ok: true, members });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
