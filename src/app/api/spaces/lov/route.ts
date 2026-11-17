import { NextResponse } from "next/server";
import { getUserSpaceData } from "@/lib/workspace-space";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const spaceData = await getUserSpaceData();
    if (!spaceData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      organizations: spaceData.organizations,
      workspaces: spaceData.workspaces,
      projects: spaceData.projects,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load workspace list";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
