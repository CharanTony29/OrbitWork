export type ChatConversationType = "channel" | "direct" | "group";

export type ChatPresenceState =
  | "available"
  | "online"
  | "busy"
  | "dnd"
  | "brb"
  | "away"
  | "offline";

export type ManualPresenceKey = "available" | "busy" | "dnd" | "brb" | "away" | "offline";

export const PRESENCE_STATUS_OPTIONS: Array<{
  key: ManualPresenceKey;
  label: string;
  color: string;
}> = [
  { key: "available", label: "Available", color: "#16a34a" },
  { key: "busy", label: "Busy", color: "#dc2626" },
  { key: "dnd", label: "Do not disturb", color: "#dc2626" },
  { key: "brb", label: "Be right back", color: "#f59e0b" },
  { key: "away", label: "Appear away", color: "#f59e0b" },
  { key: "offline", label: "Appear offline", color: "#64748b" },
];

export const PRESENCE_DURATION_OPTIONS: Array<{
  id: string;
  label: string;
  minutes: number | "today" | "week";
}> = [
  { id: "30m", label: "30 minutes", minutes: 30 },
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "2h", label: "2 hours", minutes: 120 },
  { id: "4h", label: "4 hours", minutes: 240 },
  { id: "today", label: "Today", minutes: "today" },
  { id: "week", label: "This week", minutes: "week" },
];

export function formatPresenceLabel(state?: ChatPresenceState | null): string {
  switch (state) {
    case "available":
    case "online":
      return "Available";
    case "busy":
      return "Busy";
    case "dnd":
      return "Do not disturb";
    case "brb":
      return "Be right back";
    case "away":
      return "Appear away";
    default:
      return "Offline";
  }
}

export function getPresenceColor(state?: ChatPresenceState | null): string {
  switch (state) {
    case "available":
    case "online":
      return "#16a34a";
    case "busy":
    case "dnd":
      return "#dc2626";
    case "brb":
    case "away":
      return "#f59e0b";
    default:
      return "#64748b";
  }
}

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
  if (diffMs <= 2.5 * 60 * 1000) return "available";
  if (diffMs <= 12 * 60 * 1000) return "away";
  return "offline";
}

export function resolveEffectivePresence(
  lastSeenAt?: string | null,
  manualStatus?: string | null,
  expiresAt?: string | null
): ChatPresenceState {
  const validManual: ManualPresenceKey[] = [
    "available",
    "busy",
    "dnd",
    "brb",
    "away",
    "offline",
  ];
  const normalized = manualStatus?.toLowerCase() as ManualPresenceKey | undefined;
  const notExpired =
    !expiresAt || Number.isNaN(new Date(expiresAt).getTime())
      ? true
      : new Date(expiresAt).getTime() > Date.now();

  if (normalized && validManual.includes(normalized) && notExpired) {
    if (normalized === "available") {
      // If explicitly set to Available, show available while active/recent or within expiry
      return expiresAt ? "available" : getPresenceState(lastSeenAt) === "offline" ? "offline" : "available";
    }
    return normalized;
  }
  return getPresenceState(lastSeenAt);
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
