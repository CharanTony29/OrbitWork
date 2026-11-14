// src/app/api/workspaces/[workspaceId]/docs/[docId]/pages/[pageId]/versions/route.ts
import { NextResponse } from "next/server";
import { getVersions, restoreVersion } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string; pageId: string }> }
) {
  try {
    const { pageId } = await params;
    const versions = await getVersions(pageId);
    return NextResponse.json({ versions });
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

    const versionId = Number(body.versionId || body.version_id);
    if (!versionId) {
      return NextResponse.json({ error: "versionId is required" }, { status: 400 });
    }

    const result = await restoreVersion(docId, pageId, versionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
