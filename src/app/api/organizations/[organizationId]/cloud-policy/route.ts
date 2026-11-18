import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgChatCloudPolicy, normalizeDomainList } from "@/lib/personal-cloud";
import { isSchemaMissingError } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const policy = await getOrgChatCloudPolicy(supabase, organizationId);
    return NextResponse.json({ policy });
  } catch (err) {
    console.error("Org cloud policy GET error:", err);
    return NextResponse.json({ error: "Could not load organization cloud policy" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: canManage } = await supabase.rpc("has_org_role", {
      target_org: organizationId,
      allowed_roles: ["owner", "admin", "manager"],
    });
    if (!canManage) {
      return NextResponse.json(
        { error: "Only organization owners, admins, or managers can update chat storage policy." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      policy?: "any" | "org_domain_only";
      allowedProviders?: "both" | "onedrive" | "google_drive";
      allowedDomains?: string[] | string;
    } | null;

    const policyMode = body?.policy === "org_domain_only" ? "org_domain_only" : "any";
    const allowedProviders =
      body?.allowedProviders === "onedrive" || body?.allowedProviders === "google_drive"
        ? body.allowedProviders
        : "both";
    const allowedDomains = normalizeDomainList(body?.allowedDomains);

    if (policyMode === "org_domain_only" && allowedDomains.length === 0) {
      return NextResponse.json(
        {
          error:
            "Please enter at least one valid organization email domain (for example: myorg.com or *@myorg.com).",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("organizations")
      .update({
        chat_storage_policy: policyMode,
        chat_storage_allowed_providers: allowedProviders,
        chat_storage_allowed_domains: allowedDomains,
      })
      .eq("id", organizationId);

    if (error) {
      if (isSchemaMissingError(error)) {
        return NextResponse.json(
          {
            error:
              "Database migration required: please apply supabase/migrations/202611180001_user_prefs_personal_cloud_inbox.sql in your Supabase SQL Editor.",
            migrationMissing: true,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      policy: {
        organizationId,
        policy: policyMode,
        allowedProviders,
        allowedDomains,
      },
    });
  } catch (err) {
    console.error("Org cloud policy POST error:", err);
    return NextResponse.json({ error: "Could not save organization cloud policy" }, { status: 500 });
  }
}
