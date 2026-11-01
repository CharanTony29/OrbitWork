import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get project workspace and org
  const { data: project } = await supabase
    .from("projects")
    .select("id, workspace_id, workspaces(organization_id)")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const workspace = Array.isArray(project.workspaces) ? project.workspaces[0] : project.workspaces;
  const orgId = workspace?.organization_id;

  // Get org members
  let orgUserIds: string[] = [];
  if (orgId) {
    const { data: orgMembers } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active");
    orgUserIds = (orgMembers ?? []).map((m) => m.user_id);
  }

  // Get project members
  const { data: projectMembers } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  const memberIds = [...new Set([...orgUserIds, ...(projectMembers ?? []).map((m) => m.user_id)])];

  if (memberIds.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .in("id", memberIds);

  const members = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name?.trim() || p.email || "Team member",
    email: p.email || "",
    avatarUrl: p.avatar_url || null,
  }));

  return NextResponse.json({ members });
}
