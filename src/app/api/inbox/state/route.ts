import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InboxBucket = "primary" | "other" | "later" | "cleared";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      action?: "set_bucket" | "set_read" | "clear_all" | "mark_all_read";
      itemKeys?: string[];
      notificationIds?: string[];
      bucket?: InboxBucket;
      isRead?: boolean;
    } | null;

    if (!body?.action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const itemKeys = Array.isArray(body.itemKeys)
      ? body.itemKeys.map((k) => String(k).trim()).filter(Boolean).slice(0, 200)
      : [];
    const notificationIds = Array.isArray(body.notificationIds)
      ? body.notificationIds.map((id) => String(id).trim()).filter(Boolean).slice(0, 200)
      : [];

    const nowIso = new Date().toISOString();

    // Update notifications.read_at when marking read or clearing
    if (body.action === "mark_all_read") {
      await supabase
        .from("notifications")
        .update({ read_at: nowIso })
        .eq("recipient_id", user.id)
        .is("read_at", null);
    } else if (
      notificationIds.length > 0 &&
      (body.action === "clear_all" ||
        (body.action === "set_bucket" && body.bucket === "cleared") ||
        (body.action === "set_read" && body.isRead === true))
    ) {
      await supabase
        .from("notifications")
        .update({ read_at: nowIso })
        .in("id", notificationIds);
    } else if (notificationIds.length > 0 && body.action === "set_read" && body.isRead === false) {
      await supabase
        .from("notifications")
        .update({ read_at: null })
        .in("id", notificationIds);
    }

    let persisted = true;
    if (itemKeys.length > 0) {
      const rows = itemKeys.map((itemKey) => {
        const base: Record<string, unknown> = {
          user_id: user.id,
          item_key: itemKey,
          updated_at: nowIso,
        };
        if (body.action === "clear_all") {
          base.bucket = "cleared";
          base.is_read = true;
        } else if (body.action === "set_bucket" && body.bucket) {
          base.bucket = body.bucket;
          if (body.bucket === "cleared") base.is_read = true;
        } else if (body.action === "set_read") {
          base.is_read = Boolean(body.isRead);
        } else if (body.action === "mark_all_read") {
          base.is_read = true;
        }
        return base;
      });

      const { error } = await supabase
        .from("user_inbox_states")
        .upsert(rows, { onConflict: "user_id,item_key" });

      if (error) {
        // Table may not be migrated yet — degrade gracefully without failing UI
        persisted = false;
      }
    }

    return NextResponse.json({ ok: true, persisted });
  } catch (err) {
    console.error("Inbox state update error:", err);
    return NextResponse.json({ error: "Could not update inbox state" }, { status: 500 });
  }
}
