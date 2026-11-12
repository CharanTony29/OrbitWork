import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSchemaMissingError,
  resolveEffectivePresence,
  resolveProfileAvatarSrc,
  type ChatMessageMetadata,
  type ChatPresenceState,
} from "./chat";

export type ChatProfileInfo = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  presence: ChatPresenceState;
};

export type HydratedChatReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type HydratedChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_url: string | null;
  sender_presence: ChatPresenceState;
  recipient_id: string | null;
  thread_id: string | null;
  organization_id: string | null;
  channel: string;
  message: string;
  reply_to_id: string | null;
  edited_at: string | null;
  metadata: ChatMessageMetadata;
  created_at: string;
  reactions: HydratedChatReaction[];
};

export type RawChatRow = {
  id: string;
  workspace_id?: string | null;
  organization_id?: string | null;
  thread_id?: string | null;
  sender_id: string;
  recipient_id: string | null;
  channel: string;
  message: string;
  reply_to_id?: string | null;
  edited_at?: string | null;
  metadata?: ChatMessageMetadata | null;
  created_at: string;
};

export const CHAT_SELECT_EXTENDED =
  "id, workspace_id, organization_id, thread_id, sender_id, recipient_id, channel, message, reply_to_id, edited_at, metadata, created_at";

export const CHAT_SELECT_BASE =
  "id, workspace_id, sender_id, recipient_id, channel, message, created_at";

export async function getUserActiveOrgIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active");
  return (data ?? []).map((row) => String(row.organization_id));
}

export async function fetchProfilesMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ChatProfileInfo>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ChatProfileInfo>();
  if (uniqueIds.length === 0) return map;

  let rows: Array<{
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    last_seen_at?: string | null;
    presence_status?: string | null;
    presence_expires_at?: string | null;
  }> = [];

  const extRes = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url, last_seen_at, presence_status, presence_expires_at")
    .in("id", uniqueIds);

  if (extRes.error && isSchemaMissingError(extRes.error)) {
    const fallbackSeen = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url, last_seen_at")
      .in("id", uniqueIds);
    if (fallbackSeen.error && isSchemaMissingError(fallbackSeen.error)) {
      const baseRes = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", uniqueIds);
      rows = baseRes.data ?? [];
    } else {
      rows = fallbackSeen.data ?? [];
    }
  } else {
    rows = extRes.data ?? [];
  }

  for (const row of rows) {
    const name =
      row.display_name?.trim() ||
      (row.email ? row.email.split("@")[0] : "") ||
      "Teammate";
    const lastSeenAt = row.last_seen_at ?? null;
    map.set(row.id, {
      id: row.id,
      name,
      email: row.email ?? "",
      avatarUrl: resolveProfileAvatarSrc(row.id, row.avatar_url),
      lastSeenAt,
      presence: resolveEffectivePresence(
        lastSeenAt,
        row.presence_status ?? null,
        row.presence_expires_at ?? null
      ),
    });
  }

  return map;
}

export async function hydrateReactionsMap(
  supabase: SupabaseClient,
  messageIds: string[],
  currentUserId: string
): Promise<{
  map: Map<string, HydratedChatReaction[]>;
  schemaMissing: boolean;
}> {
  const map = new Map<string, HydratedChatReaction[]>();
  const uniqueIds = [...new Set(messageIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { map, schemaMissing: false };

  const { data, error } = await supabase
    .from("chat_message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", uniqueIds);

  if (error) {
    return { map, schemaMissing: isSchemaMissingError(error) };
  }

  const grouped = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
  for (const row of data ?? []) {
    const msgId = String(row.message_id);
    const emoji = String(row.emoji);
    let emojiMap = grouped.get(msgId);
    if (!emojiMap) {
      emojiMap = new Map();
      grouped.set(msgId, emojiMap);
    }
    const existing = emojiMap.get(emoji) ?? { count: 0, reactedByMe: false };
    existing.count += 1;
    if (row.user_id === currentUserId) {
      existing.reactedByMe = true;
    }
    emojiMap.set(emoji, existing);
  }

  for (const [msgId, emojiMap] of grouped.entries()) {
    const list: HydratedChatReaction[] = [];
    for (const [emoji, info] of emojiMap.entries()) {
      list.push({ emoji, count: info.count, reactedByMe: info.reactedByMe });
    }
    map.set(msgId, list);
  }

  return { map, schemaMissing: false };
}

export function formatHydratedMessage(
  row: RawChatRow,
  profilesMap: Map<string, ChatProfileInfo>,
  reactionsMap: Map<string, HydratedChatReaction[]>
): HydratedChatMessage {
  const profile = profilesMap.get(row.sender_id);
  const rawMetadata =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};

  return {
    id: row.id,
    sender_id: row.sender_id,
    sender_name: profile?.name ?? "Teammate",
    sender_avatar_url: profile?.avatarUrl ?? null,
    sender_presence: profile?.presence ?? "offline",
    recipient_id: row.recipient_id ?? null,
    thread_id: row.thread_id ?? null,
    organization_id: row.organization_id ?? null,
    channel: row.channel ?? "general",
    message: row.message,
    reply_to_id: row.reply_to_id ?? null,
    edited_at: row.edited_at ?? null,
    metadata: rawMetadata,
    created_at: row.created_at,
    reactions: reactionsMap.get(row.id) ?? [],
  };
}

export async function touchUserPresence(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    // Non-blocking heartbeat if last_seen_at column is not yet migrated
  }
}

export function noStoreJson(
  payload: Record<string, unknown>,
  status = 200
): Response {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
