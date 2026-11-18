import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserApplicableOrgPolicies,
  getUserPersonalCloudConnections,
  toPublicCloudConnection,
  type PersonalCloudProvider,
} from "@/lib/personal-cloud";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ connections, migrationMissing }, policies] = await Promise.all([
      getUserPersonalCloudConnections(supabase, user.id),
      getUserApplicableOrgPolicies(supabase, user.id),
    ]);

    return NextResponse.json({
      connections: connections.map(toPublicCloudConnection),
      policies,
      migrationMissing,
      googleConfigured: Boolean(
        process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY
      ),
      microsoftConfigured: Boolean(
        process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ),
    });
  } catch (err) {
    console.error("Personal cloud status GET error:", err);
    return NextResponse.json({ error: "Could not load cloud storage status" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      provider?: PersonalCloudProvider;
      folderName?: string;
    } | null;

    if (body?.provider !== "google_drive" && body?.provider !== "onedrive") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Mark selected provider active, others inactive
    await supabase
      .from("user_cloud_connections")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    const patch: Record<string, unknown> = {
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.folderName === "string" && body.folderName.trim()) {
      patch.folder_name = body.folderName.trim().slice(0, 80);
    }

    const { error } = await supabase
      .from("user_cloud_connections")
      .update(patch)
      .eq("user_id", user.id)
      .eq("provider", body.provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Personal cloud PATCH error:", err);
    return NextResponse.json({ error: "Could not update active cloud provider" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    if (provider !== "google_drive" && provider !== "onedrive") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_cloud_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If another provider remains connected, promote it to active
    const { data: remaining } = await supabase
      .from("user_cloud_connections")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (remaining && remaining[0]?.id) {
      await supabase
        .from("user_cloud_connections")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", remaining[0].id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Personal cloud DELETE error:", err);
    return NextResponse.json({ error: "Could not disconnect cloud provider" }, { status: 500 });
  }
}
