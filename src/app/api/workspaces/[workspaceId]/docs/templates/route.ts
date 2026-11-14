// src/app/api/workspaces/[workspaceId]/docs/templates/route.ts
import { NextResponse } from "next/server";
import { DOC_TEMPLATES } from "@/lib/docs/templates";
import { createDoc } from "@/lib/docs/service";

export async function GET() {
  return NextResponse.json({ templates: DOC_TEMPLATES });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const body = await req.json();

    const templateId = body.templateId || body.template_id;
    const template = DOC_TEMPLATES.find((t) => t.id === templateId);

    const result = await createDoc({
      workspaceId,
      projectId: body.projectId || body.project_id || null,
      title: body.title || template?.title || "Untitled from Template",
      templateId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ doc: result.doc, page: result.page }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
