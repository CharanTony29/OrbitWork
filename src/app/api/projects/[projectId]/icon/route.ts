import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const icon = typeof body.icon === "string" ? body.icon.trim().slice(0, 8) : "📁";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("projects")
      .update({ icon: icon || "📁", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, icon: icon || "📁" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, icon")
      .eq("id", projectId)
      .maybeSingle();

    return NextResponse.json({
      icon: (project as any)?.icon || "📁",
      name: project?.name,
    });
  } catch {
    return NextResponse.json({ icon: "📁" });
  }
}
