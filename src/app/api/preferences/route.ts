import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  clampColumnWidth,
  normalizeTabOrder,
  PROJECT_TAB_COOKIE,
  TABLE_COL_COOKIE,
  TABLE_COL_WIDTHS_COOKIE,
  TABLE_FROZEN_COLS_COOKIE,
} from "@/lib/project-preferences";

const updateSchema = z.object({
  projectTabOrder: z.array(z.string().min(1).max(40)).max(20).optional(),
  listColumnOrder: z.array(z.string().min(1).max(80)).max(80).optional(),
  listColumnWidths: z.record(z.string().min(1).max(80), z.number().min(70).max(800)).optional(),
  listFrozenColumns: z.array(z.string().min(1).max(80)).max(20).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let data: {
    project_tab_order?: unknown;
    list_column_order?: unknown;
    list_column_widths?: unknown;
    list_frozen_columns?: unknown;
  } | null = null;

  const extRes = await supabase
    .from("user_preferences")
    .select("project_tab_order, list_column_order, list_column_widths, list_frozen_columns")
    .eq("user_id", user.id)
    .maybeSingle();

  if (extRes.error) {
    const baseRes = await supabase
      .from("user_preferences")
      .select("project_tab_order, list_column_order")
      .eq("user_id", user.id)
      .maybeSingle();
    if (baseRes.error) {
      return NextResponse.json({
        projectTabOrder: null,
        listColumnOrder: null,
        listColumnWidths: null,
        listFrozenColumns: null,
        fallback: true,
      });
    }
    data = baseRes.data;
  } else {
    data = extRes.data;
  }

  return NextResponse.json({
    projectTabOrder: Array.isArray(data?.project_tab_order)
      ? normalizeTabOrder(data.project_tab_order)
      : null,
    listColumnOrder: Array.isArray(data?.list_column_order)
      ? data.list_column_order
      : null,
    listColumnWidths:
      data?.list_column_widths && typeof data.list_column_widths === "object"
        ? data.list_column_widths
        : null,
    listFrozenColumns: Array.isArray(data?.list_frozen_columns)
      ? data.list_frozen_columns
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
  const colOrder = parsed.data.listColumnOrder ? parsed.data.listColumnOrder : undefined;

  let colWidths: Record<string, number> | undefined;
  if (parsed.data.listColumnWidths) {
    colWidths = {};
    for (const [k, v] of Object.entries(parsed.data.listColumnWidths)) {
      colWidths[k] = clampColumnWidth(v);
    }
  }

  const frozenCols = parsed.data.listFrozenColumns
    ? [...new Set(parsed.data.listFrozenColumns)]
    : undefined;

  const upsertPayload: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (tabOrder) upsertPayload.project_tab_order = tabOrder;
  if (colOrder) upsertPayload.list_column_order = colOrder;
  if (colWidths !== undefined) upsertPayload.list_column_widths = colWidths;
  if (frozenCols !== undefined) upsertPayload.list_frozen_columns = frozenCols;

  let persistedToDb = false;
  const { error } = await supabase
    .from("user_preferences")
    .upsert(upsertPayload, { onConflict: "user_id" });

  if (!error) {
    persistedToDb = true;
  } else if (tabOrder || colOrder) {
    // Graceful fallback if new columns haven't been migrated yet
    const basePayload: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    if (tabOrder) basePayload.project_tab_order = tabOrder;
    if (colOrder) basePayload.list_column_order = colOrder;
    const baseRes = await supabase
      .from("user_preferences")
      .upsert(basePayload, { onConflict: "user_id" });
    persistedToDb = !baseRes.error;
  }

  const response = NextResponse.json({
    ok: true,
    persistedToDb,
    projectTabOrder: tabOrder ?? null,
    listColumnOrder: colOrder ?? null,
    listColumnWidths: colWidths ?? null,
    listFrozenColumns: frozenCols ?? null,
  });

  const cookieOpts = {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };

  if (tabOrder) {
    response.cookies.set(PROJECT_TAB_COOKIE, JSON.stringify(tabOrder), cookieOpts);
  }
  if (colOrder) {
    response.cookies.set(TABLE_COL_COOKIE, JSON.stringify(colOrder), cookieOpts);
  }
  if (colWidths !== undefined) {
    response.cookies.set(TABLE_COL_WIDTHS_COOKIE, JSON.stringify(colWidths), cookieOpts);
  }
  if (frozenCols !== undefined) {
    response.cookies.set(TABLE_FROZEN_COLS_COOKIE, JSON.stringify(frozenCols), cookieOpts);
  }

  return response;
}
