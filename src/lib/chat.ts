export type ChatConversationType = "channel" | "direct" | "group";

export type ChatPresenceState = "online" | "away" | "offline";

export const CHAT_CHANNELS = [
  { id: "general", name: "general", desc: "Team-wide updates and everyday collaboration" },
  { id: "announcements", name: "announcements", desc: "Key milestones, releases, and announcements" },
  { id: "dev-team", name: "dev-team", desc: "Engineering, specs, and sprint handoffs" },
  { id: "random", name: "random", desc: "Team culture, shout-outs, and casual sharing" },
] as const;

export const CHAT_REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👀"] as const;

export const CHAT_COMPOSER_EMOJIS = [
  "👍", "❤️", "🔥", "🎉", "🚀", "😀",
  "😂", "😊", "👀", "💡", "✅", "⚡",
  "🙏", "👏", "💯", "📌", "⏳", "🛠️",
] as const;

export type LinkedWorkEntity = {
  kind: "task" | "project" | "document";
  id: string;
  title: string;
  href: string;
  subtitle?: string;
};

export type ChatAttachmentMeta = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string;
};

export type ChatMessageMetadata = {
  linkedEntities?: LinkedWorkEntity[];
  attachments?: ChatAttachmentMeta[];
  replyPreview?: {
    id: string;
    senderName: string;
    excerpt: string;
  };
};

export function buildDirectThreadKey(userA: string, userB: string): string {
  const pair = [userA, userB].sort();
  return `dm:${pair[0]}:${pair[1]}`;
}

export function buildChannelThreadKey(channel: string, organizationId?: string | null): string {
  return `ch:${organizationId || "global"}:${channel}`;
}

export function buildGroupThreadKey(threadId: string): string {
  return `grp:${threadId}`;
}

/**
 * Resolves the safe, proxied URL for a colleague's or own profile avatar,
 * avoiding massive base64 blobs inside SSR props and JSON payloads.
 */
export function resolveProfileAvatarSrc(userId: string, rawAvatarUrl: string | null | undefined): string | null {
  const trimmed = rawAvatarUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (trimmed.startsWith("data:")) {
    return `/api/profile/avatar?userId=${encodeURIComponent(userId)}&v=${trimmed.length}`;
  }
  return null;
}

export function getPresenceState(lastSeenAt?: string | null): ChatPresenceState {
  if (!lastSeenAt) return "offline";
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (diffMs <= 2.5 * 60 * 1000) return "online";
  if (diffMs <= 12 * 60 * 1000) return "away";
  return "offline";
}

export function formatSidebarTimestamp(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
}

export function stripMarkdownForPreview(text: string): string {
  return text
    .replace(/!\[.*?\]\((.*?)\)/g, "[Image]")
    .replace(/📎\s*\[(.*?)\]\((.*?)\)/g, "📎 $1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSchemaMissingError(error: { code?: string; message?: string; details?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the") ||
    msg.includes("schema cache")
  );
}
