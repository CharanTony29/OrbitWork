import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWorkspaceBrain, TaskCatalogFilter } from "@/lib/brain/portfolio-brain";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectsParam = searchParams.get("projects");
    const prioritiesParam = searchParams.get("priorities");

    const filter: TaskCatalogFilter = {};
    if (projectsParam) {
      filter.selectedProjectIds = projectsParam.split(",").filter(Boolean);
    }
    if (prioritiesParam) {
      filter.priorities = prioritiesParam.split(",").filter(Boolean);
    }

    const brainData = await buildWorkspaceBrain(workspaceId, user.id, filter);
    return NextResponse.json({ ok: true, data: brainData });
  } catch (err: any) {
    console.error("Workspace Brain API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load Workspace Brain" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const filter: TaskCatalogFilter = {
      selectedProjectIds: body.selectedProjectIds,
      priorities: body.priorities,
      statusCategories: body.statusCategories,
      searchQuery: body.searchQuery,
    };

    const brainData = await buildWorkspaceBrain(workspaceId, user.id, filter);
    return NextResponse.json({ ok: true, data: brainData });
  } catch (err: any) {
    console.error("Workspace Brain POST error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to calculate Workspace Brain" },
      { status: 500 }
    );
  }
}
