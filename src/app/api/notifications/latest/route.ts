import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ notifications: [] }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, event_type, project_id, task_id, message, read_at, created_at")
    .eq("recipient_id", user.id)
    .in("event_type", [
      "channel_mentioned",
      "task_mentioned",
      "task_completed",
      "task_assigned",
      "task_unassigned",
    ])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ notifications: [] });
  }

  return NextResponse.json({ notifications: rows ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const notificationId = typeof body?.id === "string" ? body.id : null;
  if (!notificationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  return NextResponse.json({ ok: true });
}
