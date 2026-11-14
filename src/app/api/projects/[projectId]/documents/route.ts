// src/app/api/projects/[projectId]/documents/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDoc, getWorkspaceDocs } from "@/lib/docs/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await getWorkspaceDocs(project.workspace_id, {
      projectId,
    });

    return NextResponse.json({ documents: result.docs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = await createDoc({
      workspaceId: project.workspace_id,
      projectId,
      title: body.title || "Untitled Document",
      icon: body.icon || "📄",
      description: body.description || "",
      isWiki: Boolean(body.isWiki || body.is_wiki),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ document: result.doc, page: result.page }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
