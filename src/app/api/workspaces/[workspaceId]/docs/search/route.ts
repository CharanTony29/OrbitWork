// src/app/api/workspaces/[workspaceId]/docs/search/route.ts
import { NextResponse } from "next/server";
import { searchDocs } from "@/lib/docs/service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";

    const results = await searchDocs(workspaceId, query);
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
