// src/app/api/workspaces/[workspaceId]/docs/[docId]/activity/route.ts
import { NextResponse } from "next/server";
import { getDocActivities } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const activities = await getDocActivities(docId);
    return NextResponse.json({ activities });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
