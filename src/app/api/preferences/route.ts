import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeTabOrder,
  PROJECT_TAB_COOKIE,
  TABLE_COL_COOKIE,
} from "@/lib/project-preferences";

const updateSchema = z.object({
  projectTabOrder: z.array(z.string().min(1).max(40)).max(20).optional(),
  listColumnOrder: z.array(z.string().min(1).max(80)).max(80).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("project_tab_order, list_column_order")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({
      projectTabOrder: null,
      listColumnOrder: null,
      fallback: true,
    });
  }

  return NextResponse.json({
    projectTabOrder: Array.isArray(data?.project_tab_order)
      ? normalizeTabOrder(data.project_tab_order)
      : null,
    listColumnOrder: Array.isArray(data?.list_column_order)
      ? data.list_column_order
      : null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preference payload" }, { status: 400 });
  }

  const tabOrder = parsed.data.projectTabOrder
    ? normalizeTabOrder(parsed.data.projectTabOrder)
    : undefined;
  const colOrder = parsed.data.listColumnOrder
    ? parsed.data.listColumnOrder
    : undefined;

  const upsertPayload: {
    user_id: string;
    updated_at: string;
    project_tab_order?: string[];
    list_column_order?: string[];
  } = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (tabOrder) upsertPayload.project_tab_order = tabOrder;
  if (colOrder) upsertPayload.list_column_order = colOrder;

  const { error } = await supabase
    .from("user_preferences")
    .upsert(upsertPayload, { onConflict: "user_id" });

  const response = NextResponse.json({
    ok: true,
    persistedToDb: !error,
    projectTabOrder: tabOrder ?? null,
    listColumnOrder: colOrder ?? null,
  });

  if (tabOrder) {
    response.cookies.set(PROJECT_TAB_COOKIE, JSON.stringify(tabOrder), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  if (colOrder) {
    response.cookies.set(TABLE_COL_COOKIE, JSON.stringify(colOrder), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}
