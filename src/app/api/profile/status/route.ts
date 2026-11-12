import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, resolveEffectivePresence } from "@/lib/chat";

const updateSchema = z.object({
  presenceStatus: z.enum(["available", "busy", "dnd", "brb", "away", "offline"]).optional(),
  durationMinutes: z.union([z.number().int().positive().max(10080), z.literal("today"), z.literal("week"), z.null()]).optional(),
  statusMessage: z.string().trim().max(80).optional(),
  reset: z.boolean().optional(),
});

function computeExpiresAt(duration: number | "today" | "week" | null | undefined): string | null {
  if (!duration) return null;
  const now = new Date();
  if (duration === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }
  if (duration === "week") {
    const end = new Date(now);
    const daysLeft = 7 - end.getDay();
    end.setDate(end.getDate() + (daysLeft === 0 ? 7 : daysLeft));
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }
  return new Date(now.getTime() + duration * 60_000).toISOString();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("presence_status, presence_expires_at, status_message, last_seen_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error && isSchemaMissingError(error)) {
    return NextResponse.json({
      presenceStatus: "available",
      presenceExpiresAt: null,
      statusMessage: "",
      schemaMissing: true,
    });
  }

  const effective = resolveEffectivePresence(
    data?.last_seen_at ?? new Date().toISOString(),
    data?.presence_status ?? "available",
    data?.presence_expires_at ?? null
  );

  return NextResponse.json({
    presenceStatus: effective === "online" ? "available" : effective,
    presenceExpiresAt: data?.presence_expires_at ?? null,
    statusMessage: data?.status_message ?? "",
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
    return NextResponse.json({ error: "Invalid status payload" }, { status: 400 });
  }

  if (parsed.data.reset) {
    const { error } = await supabase
      .from("profiles")
      .update({
        presence_status: "available",
        presence_expires_at: null,
        status_message: "",
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error && !isSchemaMissingError(error)) {
      return NextResponse.json({ error: "Could not reset status" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      presenceStatus: "available",
      presenceExpiresAt: null,
      statusMessage: "",
    });
  }

  const updates: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
  };
  if (parsed.data.presenceStatus !== undefined) {
    updates.presence_status = parsed.data.presenceStatus;
  }
  if (parsed.data.durationMinutes !== undefined) {
    updates.presence_expires_at = computeExpiresAt(parsed.data.durationMinutes);
  }
  if (parsed.data.statusMessage !== undefined) {
    updates.status_message = parsed.data.statusMessage;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error && !isSchemaMissingError(error)) {
    return NextResponse.json({ error: "Could not update status" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    presenceStatus: parsed.data.presenceStatus ?? "available",
    presenceExpiresAt: updates.presence_expires_at ?? null,
    statusMessage: parsed.data.statusMessage,
  });
}
