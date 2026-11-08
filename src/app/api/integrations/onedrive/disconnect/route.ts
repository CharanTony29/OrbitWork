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

  if (workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId)) {
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      target_workspace: workspaceId,
    });
    if (!canManage) {
      return NextResponse.redirect(new URL(`/workspaces/${workspaceId}?storage=forbidden`, request.url), 303);
    }

    const { data: existing } = await supabase
      .from("workspace_storage_configs")
      .select("active_provider")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      onedrive_connected: false,
      onedrive_account_email: null,
      onedrive_connected_at: null,
      updated_at: new Date().toISOString(),
    };
    if (existing?.active_provider === "onedrive") {
      updates.active_provider = "local";
    }

    await supabase.from("workspace_storage_configs").update(updates).eq("workspace_id", workspaceId);
    return NextResponse.redirect(new URL(`/workspaces/${workspaceId}?storage=onedrive_disconnected`, request.url), 303);
  }

  if (organizationId && /^[0-9a-f-]{36}$/i.test(organizationId)) {
    const { data: canManage } = await supabase.rpc("has_org_role", {
      target_org: organizationId,
      allowed_roles: ["owner", "admin"],
    });
    if (!canManage) {
      return NextResponse.redirect(
        new URL(`/organizations/${organizationId}/integrations?storage=forbidden`, request.url),
        303
      );
    }

    const { data: existing } = await supabase
      .from("organization_storage_configs")
      .select("active_provider")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      onedrive_connected: false,
      onedrive_account_email: null,
      onedrive_connected_at: null,
      updated_at: new Date().toISOString(),
    };
    if (existing?.active_provider === "onedrive") {
      updates.active_provider = "local";
    }

    await supabase.from("organization_storage_configs").update(updates).eq("organization_id", organizationId);
    return NextResponse.redirect(
      new URL(`/organizations/${organizationId}/integrations?storage=onedrive_disconnected`, request.url),
      303
    );
  }

  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}

export async function GET(request: Request) {
  return POST(request);
}
