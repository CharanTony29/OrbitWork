// src/app/api/workspaces/[workspaceId]/docs/[docId]/page_listing/route.ts
import { NextResponse } from "next/server";
import { getPageListing } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const pages = await getPageListing(docId);
    return NextResponse.json({ pages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
