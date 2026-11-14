// src/app/api/workspaces/[workspaceId]/docs/[docId]/publish/route.ts
import { NextResponse } from "next/server";
import { toggleDocPublish } from "@/lib/docs/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const body = await req.json();

    const publish = Boolean(body.publish !== undefined ? body.publish : body.is_published);
    const result = await toggleDocPublish(docId, publish);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      is_published: publish,
      public_slug: result.publicSlug,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
