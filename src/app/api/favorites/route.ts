import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ ok: false, favorites: [] }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_favorites")
      .select("id, entity_type, entity_id, project_id, title, subtitle, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, favorites: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, favorites: data || [] });
  } catch (err) {
    return NextResponse.json(
      { ok: false, favorites: [], error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
