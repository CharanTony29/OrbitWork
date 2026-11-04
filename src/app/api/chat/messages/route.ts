import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// In-memory fallback if the database table is not yet migrated
type FallbackMsg = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  channel: string;
  message: string;
  created_at: string;
};
const memoryFallbackMessages: FallbackMsg[] = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "channel";
  const channel = searchParams.get("channel") || "general";
  const recipientId = searchParams.get("recipientId");
  const workspaceId = searchParams.get("workspaceId");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (type === "latest") {
      let query = supabase
        .from("workspace_chat_messages")
        .select("*")
        .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: messages, error } = await query;
      let rawList = messages ?? [];
      if (error || !messages) {
        rawList = memoryFallbackMessages
          .filter((m) => m.recipient_id === user.id || !m.recipient_id)
          .slice(-10)
          .reverse();
      }

      const senderIds = [...new Set(rawList.map((m) => m.sender_id))];
      const { data: profiles } = senderIds.length
        ? await supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", senderIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      const formatted = rawList.map((m) => {
        const prof = profileMap.get(m.sender_id);
        return {
          id: m.id,
          senderId: m.sender_id,
          recipientId: m.recipient_id,
          channel: m.channel,
          message: m.message,
          createdAt: m.created_at,
          senderName: prof?.display_name?.trim() || prof?.email || "Team member",
          senderAvatar: prof?.avatar_url || null,
          isCurrentUser: m.sender_id === user.id,
        };
      });

      return NextResponse.json({ messages: formatted, currentUserId: user.id });
    }

    let query = supabase.from("workspace_chat_messages").select("*").order("created_at", { ascending: true });

    if (type === "direct" && recipientId) {
      query = query
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`);
    } else {
      query = query.is("recipient_id", null).eq("channel", channel);
      if (workspaceId) {
        query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
      }
    }

    const { data: messages, error } = await query.limit(300);

    let rawList: any[] = [];
    if (error || !messages) {
      // Use fallback
      if (type === "direct" && recipientId) {
        rawList = memoryFallbackMessages.filter(
          (m) =>
            (m.sender_id === user.id && m.recipient_id === recipientId) ||
            (m.sender_id === recipientId && m.recipient_id === user.id)
        );
      } else {
        rawList = memoryFallbackMessages.filter((m) => m.channel === channel && !m.recipient_id);
      }
    } else {
      rawList = messages;
    }

    const senderIds = [...new Set(rawList.map((m) => m.sender_id))];
    const { data: profiles } = senderIds.length
      ? await supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", senderIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const formatted = rawList.map((m) => {
      const prof = profileMap.get(m.sender_id);
      return {
        id: m.id,
        senderId: m.sender_id,
        recipientId: m.recipient_id,
        channel: m.channel,
        message: m.message,
        createdAt: m.created_at,
        senderName: prof?.display_name?.trim() || prof?.email || "Team member",
        senderAvatar: prof?.avatar_url || null,
        isCurrentUser: m.sender_id === user.id,
      };
    });

    return NextResponse.json({ messages: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const message = String(json?.message ?? "").trim();
  const type = json?.type === "direct" ? "direct" : "channel";
  const channel = String(json?.channel ?? "general");
  const recipientId = json?.recipientId ? String(json.recipientId) : null;
  const workspaceId = json?.workspaceId ? String(json.workspaceId) : null;

  if (!message) {
    return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
  }

  try {
    const { data: newMsg, error } = await supabase
      .from("workspace_chat_messages")
      .insert({
        workspace_id: workspaceId,
        sender_id: user.id,
        recipient_id: type === "direct" ? recipientId : null,
        channel: type === "direct" ? "direct" : channel,
        message,
      })
      .select("*")
      .single();

    let createdRecord = newMsg;
    if (error || !newMsg) {
      // Store in memory fallback
      createdRecord = {
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        workspace_id: workspaceId,
        sender_id: user.id,
        recipient_id: type === "direct" ? recipientId : null,
        channel: type === "direct" ? "direct" : channel,
        message,
        created_at: new Date().toISOString(),
      };
      memoryFallbackMessages.push(createdRecord);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      message: {
        id: createdRecord.id,
        senderId: user.id,
        recipientId: createdRecord.recipient_id,
        channel: createdRecord.channel,
        message: createdRecord.message,
        createdAt: createdRecord.created_at,
        senderName: profile?.display_name?.trim() || user.email || "Team member",
        senderAvatar: profile?.avatar_url || null,
        isCurrentUser: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
