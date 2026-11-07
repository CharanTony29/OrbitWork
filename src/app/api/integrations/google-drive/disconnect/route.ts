import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url), 303);

  let workspaceId = "";
  let organizationId = "";

  try {
    const formData = await request.formData();
    workspaceId = formData.get("workspaceId")?.toString() || "";
    organizationId = formData.get("organizationId")?.toString() || "";
  } catch {
    const url = new URL(request.url);
    workspaceId = url.searchParams.get("workspaceId") || "";
    organizationId = url.searchParams.get("organizationId") || "";
  }

  // 1. Workspace-Level Google Drive Disconnect
  if (workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId)) {
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      target_workspace: workspaceId,
    });
    if (!canManage) {
      return NextResponse.redirect(new URL(`/workspaces/${workspaceId}?drive=forbidden`, request.url), 303);
    }

    await supabase.from("google_drive_connections").delete().eq("workspace_id", workspaceId);
    return NextResponse.redirect(new URL(`/workspaces/${workspaceId}?drive=disconnected`, request.url), 303);
  }

  // 2. Organization-Level Google Drive Disconnect
  if (organizationId && /^[0-9a-f-]{36}$/i.test(organizationId)) {
    const { data: canManage } = await supabase.rpc("has_org_role", {
      target_org: organizationId,
      allowed_roles: ["owner", "admin"],
    });
    if (!canManage) {
      return NextResponse.redirect(
        new URL(`/organizations/${organizationId}/integrations?drive=forbidden`, request.url),
        303
      );
    }

    await supabase
      .from("google_drive_connections")
      .delete()
      .eq("organization_id", organizationId)
      .is("workspace_id", null);
    return NextResponse.redirect(
      new URL(`/organizations/${organizationId}/integrations?drive=disconnected`, request.url),
      303
    );
  }

  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}

export async function GET(request: Request) {
  return POST(request);
}
