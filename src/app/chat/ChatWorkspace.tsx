"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  AtSign,
  Bold,
  CheckSquare,
  Code,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Hash,
  Image as ImageIcon,
  List,
  MessageSquare,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
  X,
  AlertTriangle,
  Italic,
  ListFilter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CHAT_CHANNELS,
  CHAT_COMPOSER_EMOJIS,
  CHAT_REACTION_EMOJIS,
  buildChannelThreadKey,
  buildDirectThreadKey,
  buildGroupThreadKey,
  stripMarkdownForPreview,
  type ChatAttachmentMeta,
  type ChatConversationType,
  type ChatPresenceState,
  type LinkedWorkEntity,
} from "@/lib/chat";
import type { HydratedChatMessage } from "@/lib/chat-server";
import type {
  ThreadMemberSummary,
  UnifiedThreadSummary,
} from "@/app/api/chat/threads/route";

export type ChatWorkspaceProjectOption = {
  id: string;
  name: string;
  workspaceName: string;
};

export type ChatWorkspaceWorkItemOption = {
  kind: "task" | "project" | "document";
  id: string;
  title: string;
  href: string;
  subtitle?: string;
};

type Props = {
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
  currentUserAvatarUrl: string | null;
  primaryOrgId: string | null;
  initialMembers: ThreadMemberSummary[];
  accessibleProjects: ChatWorkspaceProjectOption[];
  linkableItems: ChatWorkspaceWorkItemOption[];
  initialSelection: {
    type: ChatConversationType;
    target: string;
  };
};

type FilterTab = "all" | "unread" | "people" | "groups";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((today - target) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function presenceLabel(state?: ChatPresenceState | null): string {
  if (state === "online") return "Online";
  if (state === "away") return "Away";
  return "Offline";
}

async function compressImageForFallback(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        resolve(dataUrl.length <= 260_000 ? dataUrl : null);
      };
      img.onerror = () => resolve(null);
      img.src = typeof reader.result === "string" ? reader.result : "";
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function renderInlineSpans(text: string): React.ReactNode[] {
  // Safe tokenizer without dangerouslySetInnerHTML
  const tokenRegex =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|@[A-Za-z0-9._-]+(?:\s[A-Za-z0-9._-]+)?|https?:\/\/[^\s)]+|\/(?:projects|tasks|documents|inbox|dashboard|api\/chat\/attachments)\/[^\s)]+)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={`c-${key++}`} className="chat-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("@")) {
      nodes.push(
        <span key={`m-${key++}`} className="chat-mention-tag">
          {token}
        </span>
      );
    } else if (token.startsWith("/")) {
      nodes.push(
        <Link
          key={`l-${key++}`}
          href={token}
          style={{ color: "var(--green)", textDecoration: "underline" }}
        >
          {token}
        </Link>
      );
    } else {
      nodes.push(
        <a
          key={`u-${key++}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--green)", textDecoration: "underline" }}
        >
          {token}
        </a>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function ChatMessageBody({
  text,
  metadataAttachments,
  onOpenImage,
}: {
  text: string;
  metadataAttachments?: ChatAttachmentMeta[];
  onOpenImage: (url: string, alt: string) => void;
}) {
  const renderedUrls = new Set<string>();
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyBase: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${keyBase}`} className="chat-md-ul">
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInlineSpans(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    const imgMatch = /^!\[(.*?)\]\(((?:\/api\/|https?:\/\/|data:image\/)[^)\s]+)\)$/.exec(
      trimmed
    );
    if (imgMatch) {
      flushList(`b-${idx}`);
      const alt = imgMatch[1] || "Shared screenshot";
      const url = imgMatch[2];
      renderedUrls.add(url);
      blocks.push(
        <button
          key={`img-${idx}`}
          type="button"
          className="chat-inline-image-btn"
          onClick={() => onOpenImage(url, alt)}
          title="Click to enlarge image"
        >
          <img src={url} alt={alt} loading="lazy" />
        </button>
      );
      return;
    }

    const fileMatch = /^(?:📎\s*)?\[([^\]]+)\]\((\/api\/chat\/attachments\/[^)\s]+)\)$/.exec(
      trimmed
    );
    if (fileMatch) {
      flushList(`f-${idx}`);
      const fileName = fileMatch[1];
      const url = fileMatch[2];
      renderedUrls.add(url);
      blocks.push(
        <a
          key={`att-${idx}`}
          href={`${url}?download=1`}
          className="chat-attachment-chip"
        >
          <Download size={13} />
          <span>{fileName}</span>
        </a>
      );
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList(`p-${idx}`);
    if (trimmed.length > 0) {
      blocks.push(
        <p key={`p-${idx}`} className="chat-md-p">
          {renderInlineSpans(rawLine)}
        </p>
      );
    }
  });

  flushList("end");

  // Render any metadata attachments that were not already embedded as markdown lines
  const extraAttachments = (metadataAttachments ?? []).filter(
    (att) => !renderedUrls.has(att.url)
  );

  return (
    <div>
      {blocks}
      {extraAttachments.map((att) =>
        att.mimeType.startsWith("image/") ? (
          <button
            key={att.id}
            type="button"
            className="chat-inline-image-btn"
            onClick={() => onOpenImage(att.url, att.fileName)}
          >
            <img src={att.url} alt={att.fileName} loading="lazy" />
          </button>
        ) : (
          <a
            key={att.id}
            href={`${att.url}?download=1`}
            className="chat-attachment-chip"
          >
            <Download size={13} />
            <span>{att.fileName}</span>
          </a>
        )
      )}
    </div>
  );
}

function buildSmartQuickReplies(lastIncomingText: string | null): string[] {
  if (!lastIncomingText) return [];
  const lower = lastIncomingText.toLowerCase();
  if (lower.includes("call") || lower.includes("meet") || lower.includes("sync")) {
    return ["Call me now", "Ready in 5 mins", "Sounds good!"];
  }
  if (lower.includes("?") || lower.includes("check") || lower.includes("review")) {
    return ["Yes, on it!", "Checking now", "Looks good 👍"];
  }
  return ["Got it, thanks!", "Looks good 👍", "Let's discuss"];
}

export default function ChatWorkspace({
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  primaryOrgId,
  initialMembers,
  accessibleProjects,
  linkableItems,
  initialSelection,
}: Props) {
  const [selectedType, setSelectedType] = useState<ChatConversationType>(
    initialSelection.type
  );
  const [selectedTarget, setSelectedTarget] = useState<string>(
    initialSelection.target
  );
  const [mobileShowStage, setMobileShowStage] = useState<boolean>(
    Boolean(initialSelection.target && initialSelection.type !== "channel")
  );

  const [threads, setThreads] = useState<UnifiedThreadSummary[]>(() => {
    // Immediate optimistic seed so the sidebar renders immediately before API resolves
    const channelSeed: UnifiedThreadSummary[] = CHAT_CHANNELS.map((ch) => ({
      threadKey: buildChannelThreadKey(ch.id, primaryOrgId),
      type: "channel",
      target: ch.id,
      title: `#${ch.name}`,
      subtitle: ch.desc,
      lastSnippet: ch.desc,
      lastSenderName: null,
      lastMessageAt: null,
      formattedTime: "",
      unreadCount: 0,
    }));
    const dmSeed: UnifiedThreadSummary[] = initialMembers.map((m) => ({
      threadKey: buildDirectThreadKey(currentUserId, m.id),
      type: "direct",
      target: m.id,
      title: m.name,
      subtitle: m.email,
      lastSnippet: m.email || "Direct message",
      lastSenderName: null,
      lastMessageAt: null,
      formattedTime: "",
      unreadCount: 0,
      presence: m.presence,
      avatarUrl: m.avatarUrl,
    }));
    return [...channelSeed, ...dmSeed];
  });

  const [messages, setMessages] = useState<HydratedChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState<boolean>(false);
  const [enhancedMigrationMissing, setEnhancedMigrationMissing] =
    useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Rail filter & search
  const [railSearch, setRailSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  // Header utilities
  const [showInlineSearch, setShowInlineSearch] = useState(false);
  const [inlineSearchQuery, setInlineSearchQuery] = useState("");
  const [showSharedModal, setShowSharedModal] = useState(false);

  // Composer state
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragOverComposer, setDragOverComposer] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [replyingTo, setReplyingTo] = useState<HydratedChatMessage | null>(null);
  const [stagedAttachments, setStagedAttachments] = useState<ChatAttachmentMeta[]>(
    []
  );
  const [stagedLinks, setStagedLinks] = useState<LinkedWorkEntity[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // Modals (New Group Chat, Convert Message to Task, Image Lightbox)
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [quickTaskSourceMsg, setQuickTaskSourceMsg] =
    useState<HydratedChatMessage | null>(null);
  const [quickTaskProjectId, setQuickTaskProjectId] = useState<string>(
    accessibleProjects[0]?.id ?? ""
  );
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskPriority, setQuickTaskPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [creatingQuickTask, setCreatingQuickTask] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const prevThreadKeyRef = useRef<string>("");
  const lastSeenMsgIdRef = useRef<string>("");
  const forceScrollRef = useRef<boolean>(true);

  const activeThreadKey = useMemo(() => {
    if (selectedType === "group") return buildGroupThreadKey(selectedTarget);
    if (selectedType === "direct")
      return buildDirectThreadKey(currentUserId, selectedTarget);
    return buildChannelThreadKey(selectedTarget, primaryOrgId);
  }, [selectedType, selectedTarget, currentUserId, primaryOrgId]);

  const activeThreadSummary = useMemo(() => {
    const found = threads.find(
      (t) => t.type === selectedType && t.target === selectedTarget
    );
    if (found) return found;
    if (selectedType === "direct") {
      const m = initialMembers.find((item) => item.id === selectedTarget);
      if (m) {
        return {
          threadKey: activeThreadKey,
          type: "direct" as const,
          target: m.id,
          title: m.name,
          subtitle: m.email,
          lastSnippet: "",
          lastSenderName: null,
          lastMessageAt: null,
          formattedTime: "",
          unreadCount: 0,
          presence: m.presence,
          avatarUrl: m.avatarUrl,
        };
      }
    }
    return {
      threadKey: activeThreadKey,
      type: selectedType,
      target: selectedTarget,
      title: selectedType === "channel" ? `#${selectedTarget}` : "Conversation",
      subtitle: "",
      lastSnippet: "",
      lastSenderName: null,
      lastMessageAt: null,
      formattedTime: "",
      unreadCount: 0,
    };
  }, [threads, selectedType, selectedTarget, activeThreadKey, initialMembers]);

  // Sync URL prop updates (e.g. navigating from notification toast to /chat?type=direct&target=...)
  useEffect(() => {
    setSelectedType(initialSelection.type);
    setSelectedTarget(initialSelection.target);
  }, [initialSelection.type, initialSelection.target]);

  // Listen to custom open-thread event when toast clicked on /chat page
  useEffect(() => {
    const onOpenThread = (event: Event) => {
      const custom = event as CustomEvent<{
        type: ChatConversationType;
        target: string;
      }>;
      if (custom.detail?.type && custom.detail?.target) {
        setSelectedType(custom.detail.type);
        setSelectedTarget(custom.detail.target);
        setMobileShowStage(true);
      }
    };
    window.addEventListener("orbitwork-open-chat-thread", onOpenThread);
    return () => {
      window.removeEventListener("orbitwork-open-chat-thread", onOpenThread);
    };
  }, []);

  // Broadcast active thread to ChatNotificationListener
  useEffect(() => {
    const win = window as Window & { __orbitworkActiveChatKey?: string };
    win.__orbitworkActiveChatKey = activeThreadKey;
    window.dispatchEvent(
      new CustomEvent("orbitwork-active-chat", {
        detail: { threadKey: activeThreadKey },
      })
    );
    return () => {
      if (win.__orbitworkActiveChatKey === activeThreadKey) {
        win.__orbitworkActiveChatKey = undefined;
      }
    };
  }, [activeThreadKey]);

  const markThreadAsRead = useCallback(async (threadKey: string) => {
    // Optimistically clear local unread counter and notify topbar badge
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.threadKey === threadKey ? { ...t, unreadCount: 0 } : t
      );
      const totalUnread = next.reduce((sum, item) => sum + item.unreadCount, 0);
      window.dispatchEvent(
        new CustomEvent("orbitwork-chat-unread", { detail: { totalUnread } })
      );
      return next;
    });

    try {
      await fetch("/api/chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadKey }),
      });
    } catch {
      // Non-critical
    }
  }, []);

  const fetchThreads = useCallback(async () => {
    try {
      const orgPart = primaryOrgId
        ? `?organizationId=${encodeURIComponent(primaryOrgId)}`
        : "";
      const res = await fetch(`/api/chat/threads${orgPart}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        const synced = (data.conversations as UnifiedThreadSummary[]).map((t) =>
          t.threadKey === activeThreadKey ? { ...t, unreadCount: 0 } : t
        );
        setThreads(synced);
        const totalUnread = synced.reduce((s, t) => s + t.unreadCount, 0);
        window.dispatchEvent(
          new CustomEvent("orbitwork-chat-unread", { detail: { totalUnread } })
        );
      }
      if (data.migrationMissing) setMigrationMissing(true);
      if (data.enhancedMigrationMissing) setEnhancedMigrationMissing(true);
    } catch {
      // Keep UI responsive even during brief offline spikes
    }
  }, [primaryOrgId, activeThreadKey]);

  const fetchMessages = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      if (opts?.showLoading) setLoadingMessages(true);
      try {
        const params = new URLSearchParams({
          type: selectedType,
          target: selectedTarget,
        });
        if (primaryOrgId) params.set("organizationId", primaryOrgId);
        const res = await fetch(`/api/chat/messages?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.migrationMissing) {
            setMigrationMissing(true);
            setErrorBanner(data.error || "Chat migration required in Supabase.");
          } else {
            setErrorBanner(data.error || "Could not load chat messages.");
          }
          return;
        }

        setMigrationMissing(false);
        setErrorBanner(null);
        setEnhancedMigrationMissing(Boolean(data.enhancedMigrationMissing));
        setPeerLastReadAt(data.peerLastReadAt ?? null);
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch {
        setErrorBanner("Network error while loading chat messages.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [selectedType, selectedTarget, primaryOrgId]
  );

  // Switching thread triggers immediate load, read mark & forced bottom scroll
  useEffect(() => {
    forceScrollRef.current = true;
    prevThreadKeyRef.current = activeThreadKey;
    void fetchMessages({ showLoading: true });
    void markThreadAsRead(activeThreadKey);
  }, [activeThreadKey, fetchMessages, markThreadAsRead]);

  // Initial threads load + live backup polling (visible tabs only)
  useEffect(() => {
    void fetchThreads();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchMessages();
        void fetchThreads();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchMessages, fetchThreads]);

  // Supabase Realtime instant sync
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orbitwork-chat-${activeThreadKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_chat_messages" },
        () => {
          void fetchMessages();
          void fetchThreads();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_message_reactions" },
        () => {
          void fetchMessages();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_read_receipts" },
        () => {
          void fetchMessages();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeThreadKey, fetchMessages, fetchThreads]);

  // Smart scroll: only scroll on switch, own send, or when user is already near bottom
  useEffect(() => {
    const feedEl = feedRef.current;
    const latestId = messages[messages.length - 1]?.id ?? "";
    const hasNewLast = latestId !== lastSeenMsgIdRef.current;

    const isNearBottom = feedEl
      ? feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 150
      : true;

    if (forceScrollRef.current || (hasNewLast && isNearBottom)) {
      feedEndRef.current?.scrollIntoView({
        behavior: forceScrollRef.current ? "auto" : "smooth",
      });
      forceScrollRef.current = false;
    }

    if (hasNewLast && messages.length > 0) {
      const latestMsg = messages[messages.length - 1];
      if (latestMsg && latestMsg.sender_id !== currentUserId) {
        void markThreadAsRead(activeThreadKey);
      }
    }
    lastSeenMsgIdRef.current = latestId;
  }, [messages, activeThreadKey, currentUserId, markThreadAsRead]);

  // Upload pasted or selected files to /api/chat/attachments (bytea Postgres persistence)
  const uploadAttachmentFile = useCallback(
    async (file: File) => {
      setUploadingFile(true);
      setErrorBanner(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (primaryOrgId) fd.append("organizationId", primaryOrgId);
        const res = await fetch("/api/chat/attachments", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.migrationMissing && file.type.startsWith("image/")) {
            const compressed = await compressImageForFallback(file);
            if (compressed) {
              setStagedAttachments((prev) => [
                ...prev,
                {
                  id: `inline-${Date.now()}`,
                  fileName: file.name || "screenshot.jpg",
                  mimeType: "image/jpeg",
                  fileSizeBytes: compressed.length,
                  url: compressed,
                },
              ]);
              setEnhancedMigrationMissing(true);
              return;
            }
          }
          setErrorBanner(data.error || "Failed to upload file.");
          return;
        }

        if (data.attachment) {
          setStagedAttachments((prev) => [...prev, data.attachment]);
        }
      } catch {
        setErrorBanner("Upload failed. Check network and retry.");
      } finally {
        setUploadingFile(false);
      }
    },
    [primaryOrgId]
  );

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const fileItems = items.filter((item) => item.kind === "file");
    if (fileItems.length === 0) return;

    e.preventDefault();
    for (const item of fileItems) {
      const file = item.getAsFile();
      if (file) {
        await uploadAttachmentFile(file);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverComposer(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    for (const f of files.slice(0, 4)) {
      await uploadAttachmentFile(f);
    }
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    const match = /(?:^|\s)@([^\s@]{0,24})$/.exec(val);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  };

  const insertFormatting = (prefix: string, suffix = prefix) => {
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => `${prev}${prefix}text${suffix}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = draft.slice(start, end) || "text";
    const updated =
      draft.slice(0, start) + prefix + selected + suffix + draft.slice(end);
    setDraft(updated);
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const insertMention = (member: ThreadMemberSummary) => {
    const replaced = draft.replace(/@([^\s@]{0,24})$/, `@${member.name} `);
    setDraft(replaced);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const sendMessage = async (overrideText?: string) => {
    const baseText = (overrideText ?? draft).trim();
    const attachmentLines = stagedAttachments.map((att) =>
      att.mimeType.startsWith("image/")
        ? `![${att.fileName}](${att.url})`
        : `📎 [${att.fileName}](${att.url})`
    );
    const combinedText = [baseText, ...attachmentLines].filter(Boolean).join("\n");
    const finalMessage =
      combinedText ||
      (stagedLinks.length > 0
        ? `Shared ${stagedLinks.map((l) => l.title).join(", ")}`
        : "");

    if (!finalMessage || sending) return;

    setSending(true);
    setErrorBanner(null);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          target: selectedTarget,
          organizationId: primaryOrgId,
          message: finalMessage,
          replyToId: replyingTo?.id ?? null,
          metadata: {
            ...(stagedAttachments.length > 0
              ? { attachments: stagedAttachments }
              : {}),
            ...(stagedLinks.length > 0 ? { linkedEntities: stagedLinks } : {}),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.migrationMissing) setMigrationMissing(true);
        setErrorBanner(data.error || "Could not send message.");
        return;
      }

      if (!overrideText) setDraft("");
      setReplyingTo(null);
      setStagedAttachments([]);
      setStagedLinks([]);
      setMentionQuery(null);
      forceScrollRef.current = true;

      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id)
            ? prev
            : [...prev, data.message]
        );
      }
      if (data.enhancedMigrationMissing) setEnhancedMigrationMissing(true);
      void fetchThreads();
    } catch {
      setErrorBanner("Failed to deliver message. Retry in a moment.");
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await fetch("/api/chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.migrationMissing) setEnhancedMigrationMissing(true);
        return;
      }
      if (Array.isArray(data.reactions)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions: data.reactions } : m
          )
        );
      }
    } catch {
      // ignore transient error
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const res = await fetch(`/api/chat/messages?id=${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      void fetchThreads();
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupMemberIds.length === 0 || creatingGroup)
      return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim(),
          memberIds: selectedGroupMemberIds,
          organizationId: primaryOrgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Could not create group chat.");
        return;
      }
      setShowNewGroupModal(false);
      setGroupName("");
      setGroupDesc("");
      setSelectedGroupMemberIds([]);
      await fetchThreads();
      if (data.thread?.id) {
        setSelectedType("group");
        setSelectedTarget(data.thread.id);
        setMobileShowStage(true);
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskSourceMsg || !quickTaskProjectId || !quickTaskTitle.trim()) return;
    setCreatingQuickTask(true);
    try {
      const excerpt = stripMarkdownForPreview(quickTaskSourceMsg.message);
      const res = await fetch("/api/chat/quick-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: quickTaskProjectId,
          title: quickTaskTitle.trim(),
          priority: quickTaskPriority,
          description: `Created from OrbitWork Chat (${quickTaskSourceMsg.sender_name}):\n\n${excerpt}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "Could not create task.");
        return;
      }
      setQuickTaskSourceMsg(null);
      setStatusNotice(`Created task "${data.task.title}" cleanly.`);
      window.setTimeout(() => setStatusNotice(null), 4000);
    } finally {
      setCreatingQuickTask(false);
    }
  };

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + t.unreadCount, 0),
    [threads]
  );

  const filteredThreads = useMemo(() => {
    const q = railSearch.trim().toLowerCase();
    return threads.filter((t) => {
      if (filterTab === "unread" && t.unreadCount <= 0) return false;
      if (filterTab === "people" && t.type !== "direct") return false;
      if (filterTab === "groups" && t.type === "direct") return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.lastSnippet.toLowerCase().includes(q)
      );
    });
  }, [threads, railSearch, filterTab]);

  const visibleMessages = useMemo(() => {
    const q = inlineSearchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.message.toLowerCase().includes(q) ||
        m.sender_name.toLowerCase().includes(q)
    );
  }, [messages, inlineSearchQuery]);

  const lastOwnReadMessageId = useMemo(() => {
    if (!peerLastReadAt) return null;
    const readMs = new Date(peerLastReadAt).getTime();
    let candidate: string | null = null;
    for (const m of messages) {
      if (m.sender_id === currentUserId && new Date(m.created_at).getTime() <= readMs) {
        candidate = m.id;
      }
    }
    return candidate;
  }, [messages, currentUserId, peerLastReadAt]);

  const smartQuickReplies = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.sender_id === currentUserId) return [];
    return buildSmartQuickReplies(lastMsg.message);
  }, [messages, currentUserId]);

  const sharedArtifacts = useMemo(() => {
    const items: Array<{ label: string; href: string; kind: string }> = [];
    for (const m of messages) {
      for (const linked of m.metadata?.linkedEntities ?? []) {
        items.push({ label: linked.title, href: linked.href, kind: linked.kind });
      }
      for (const att of m.metadata?.attachments ?? []) {
        items.push({ label: att.fileName, href: att.url, kind: att.mimeType.startsWith("image/") ? "image" : "file" });
      }
    }
    return items;
  }, [messages]);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    return initialMembers
      .filter((m) => m.name.toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [mentionQuery, initialMembers]);

  const filteredLinkItems = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    if (!q) return linkableItems.slice(0, 10);
    return linkableItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle ?? "").toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [linkableItems, linkSearch]);

  return (
    <div className="chat-layout-main">
      <div className="chat-workspace-frame">
        {/* Left Teams-inspired OrbitWork Conversation Rail */}
        <aside className={`chat-rail ${mobileShowStage ? "is-hidden-mobile" : ""}`}>
          <div className="chat-rail-head">
            <div className="chat-rail-title-wrap">
              <h1 className="chat-rail-title">Chats</h1>
              {totalUnread > 0 && (
                <span className="chat-total-pill">{totalUnread}</span>
              )}
            </div>
            <div className="chat-rail-actions">
              <button
                type="button"
                className={`chat-icon-btn ${filterTab === "unread" ? "is-active" : ""}`}
                title="Filter unread conversations"
                onClick={() =>
                  setFilterTab((prev) => (prev === "unread" ? "all" : "unread"))
                }
              >
                <ListFilter size={15} />
              </button>
              <button
                type="button"
                className="chat-icon-btn"
                title="Create new group chat"
                onClick={() => setShowNewGroupModal(true)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="chat-rail-search">
            <label className="chat-search-box">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search people, groups, #channels..."
                value={railSearch}
                onChange={(e) => setRailSearch(e.target.value)}
              />
              {railSearch && (
                <button
                  type="button"
                  className="chat-hover-btn"
                  onClick={() => setRailSearch("")}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </label>
          </div>

          <div className="chat-filter-pills">
            {(
              [
                { id: "all", label: "All" },
                { id: "unread", label: "Unread" },
                { id: "people", label: "People" },
                { id: "groups", label: "Groups & Channels" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`chat-filter-pill ${filterTab === tab.id ? "is-active" : ""}`}
                onClick={() => setFilterTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="chat-rail-list">
            {filteredThreads.length === 0 ? (
              <div
                style={{
                  padding: "24px 12px",
                  textAlign: "center",
                  fontSize: "12.5px",
                  color: "var(--muted)",
                }}
              >
                No matching conversations.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected =
                  thread.type === selectedType && thread.target === selectedTarget;
                const isUnread = thread.unreadCount > 0;
                return (
                  <button
                    key={thread.threadKey}
                    type="button"
                    className={`chat-thread-row ${isSelected ? "is-selected" : ""} ${isUnread ? "is-unread" : ""}`}
                    onClick={() => {
                      setSelectedType(thread.type);
                      setSelectedTarget(thread.target);
                      setMobileShowStage(true);
                    }}
                  >
                    <div className="chat-avatar-wrap">
                      {thread.type === "channel" ? (
                        <div className="chat-channel-badge">
                          <Hash size={16} />
                        </div>
                      ) : thread.type === "group" ? (
                        <div className="chat-collage-avatar">
                          {(thread.members ?? []).slice(0, 4).map((m) => (
                            <div key={m.id} className="chat-collage-cell">
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt={m.name} />
                              ) : (
                                getInitials(m.name)
                              )}
                            </div>
                          ))}
                          {(thread.members ?? []).length < 2 && (
                            <div className="chat-collage-cell">
                              {getInitials(currentUserName)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="chat-avatar-circle">
                            {thread.avatarUrl ? (
                              <img src={thread.avatarUrl} alt={thread.title} />
                            ) : (
                              getInitials(thread.title)
                            )}
                          </div>
                          <span
                            className={`chat-presence-dot is-${thread.presence ?? "offline"}`}
                            title={presenceLabel(thread.presence)}
                          />
                        </>
                      )}
                    </div>

                    <div className="chat-thread-meta">
                      <div className="chat-thread-top">
                        <span className="chat-thread-name">{thread.title}</span>
                        {thread.formattedTime && (
                          <span className="chat-thread-time">
                            {thread.formattedTime}
                          </span>
                        )}
                      </div>
                      <div className="chat-thread-bottom">
                        <span className="chat-thread-preview">
                          {thread.lastSnippet || "Start a conversation"}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span className="chat-unread-badge">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main Chat Stage */}
        <section className={`chat-stage ${!mobileShowStage ? "is-hidden-mobile" : ""}`}>
          <header className="chat-stage-header">
            <div className="chat-stage-peer">
              <button
                type="button"
                className="chat-icon-btn"
                style={{ display: "none" }}
                aria-label="Back to chats"
              />
              <div className="chat-avatar-wrap">
                {selectedType === "channel" ? (
                  <div className="chat-channel-badge">
                    <Hash size={16} />
                  </div>
                ) : selectedType === "group" ? (
                  <div className="chat-channel-badge">
                    <Users size={16} />
                  </div>
                ) : (
                  <>
                    <div className="chat-avatar-circle">
                      {activeThreadSummary.avatarUrl ? (
                        <img
                          src={activeThreadSummary.avatarUrl}
                          alt={activeThreadSummary.title}
                        />
                      ) : (
                        getInitials(activeThreadSummary.title)
                      )}
                    </div>
                    <span
                      className={`chat-presence-dot is-${activeThreadSummary.presence ?? "offline"}`}
                    />
                  </>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <h2>{activeThreadSummary.title}</h2>
                <p>
                  {selectedType === "direct"
                    ? `${presenceLabel(activeThreadSummary.presence)} · ${activeThreadSummary.subtitle || "Direct Message"}`
                    : selectedType === "group"
                      ? `${(activeThreadSummary.members?.length ?? 0) + 1} participants · Group chat`
                      : activeThreadSummary.subtitle || "Organization workspace channel"}
                </p>
              </div>
            </div>

            <div className="chat-stage-tools">
              <button
                type="button"
                className={`chat-stage-tab-pill ${showInlineSearch ? "is-active" : ""}`}
                onClick={() => setShowInlineSearch((prev) => !prev)}
                title="Search inside this conversation"
              >
                <Search size={13} />
                <span>Find</span>
              </button>
              <button
                type="button"
                className={`chat-stage-tab-pill ${showSharedModal ? "is-active" : ""}`}
                onClick={() => setShowSharedModal(true)}
                title="View shared tasks, documents, and files"
              >
                <FolderOpen size={13} />
                <span>Shared ({sharedArtifacts.length})</span>
              </button>
              {mobileShowStage && (
                <button
                  type="button"
                  className="chat-stage-tab-pill"
                  onClick={() => setMobileShowStage(false)}
                >
                  <span>Chats</span>
                </button>
              )}
            </div>
          </header>

          {showInlineSearch && (
            <div className="chat-inline-search-bar">
              <Search size={14} style={{ color: "var(--muted)" }} />
              <input
                type="text"
                autoFocus
                placeholder="Search messages or senders in this chat..."
                value={inlineSearchQuery}
                onChange={(e) => setInlineSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className="chat-hover-btn"
                onClick={() => {
                  setInlineSearchQuery("");
                  setShowInlineSearch(false);
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {(migrationMissing || enhancedMigrationMissing) && (
            <div className="chat-migration-banner">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={15} />
                <span>
                  {migrationMissing
                    ? "Database setup required: Run "
                    : "Upgrade available: Apply "}
                  <code>supabase/migrations/202611120001_enterprise_chat.sql</code>{" "}
                  in Supabase SQL Editor for group chats, reactions, read receipts &amp; file persistence.
                </span>
              </div>
            </div>
          )}

          {errorBanner && (
            <div
              className="chat-migration-banner"
              style={{
                background: "rgba(220, 38, 38, 0.1)",
                borderColor: "rgba(220, 38, 38, 0.28)",
              }}
            >
              <span>{errorBanner}</span>
              <button
                type="button"
                className="chat-hover-btn"
                onClick={() => setErrorBanner(null)}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {statusNotice && (
            <div
              className="chat-migration-banner"
              style={{
                background: "rgba(22, 124, 88, 0.1)",
                borderColor: "rgba(22, 124, 88, 0.28)",
                color: "var(--green)",
              }}
            >
              <span>{statusNotice}</span>
            </div>
          )}

          {/* Message Feed */}
          <div className="chat-feed" ref={feedRef}>
            {loadingMessages && messages.length === 0 ? (
              <div
                style={{
                  margin: "auto",
                  fontSize: "13px",
                  color: "var(--muted)",
                }}
              >
                Loading conversation history...
              </div>
            ) : visibleMessages.length === 0 ? (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  maxWidth: 340,
                  color: "var(--muted)",
                }}
              >
                <MessageSquare
                  size={28}
                  style={{ opacity: 0.45, marginBottom: 8 }}
                />
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--ink)",
                    marginBottom: 4,
                  }}
                >
                  {inlineSearchQuery
                    ? "No messages matched your search"
                    : `Start chatting in ${activeThreadSummary.title}`}
                </div>
                <div style={{ fontSize: "12.5px" }}>
                  Messages are saved permanently in Postgres. Paste screenshots
                  directly with Ctrl+V or link OrbitWork tasks &amp; docs using +.
                </div>
              </div>
            ) : (
              visibleMessages.map((msg, idx) => {
                const isOwn = msg.sender_id === currentUserId;
                const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                const prevDate = prev ? formatDateDivider(prev.created_at) : "";
                const curDate = formatDateDivider(msg.created_at);
                const showDateDivider = idx === 0 || curDate !== prevDate;

                const isGroupedWithPrev =
                  !showDateDivider &&
                  prev?.sender_id === msg.sender_id &&
                  new Date(msg.created_at).getTime() -
                    new Date(prev.created_at).getTime() <
                    4 * 60 * 1000;

                const showSeenEye = msg.id === lastOwnReadMessageId;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="chat-date-divider">{curDate}</div>
                    )}

                    <div
                      className={`chat-msg-row ${isOwn ? "is-own" : ""} ${
                        !isGroupedWithPrev ? "is-grouped-top" : ""
                      }`}
                    >
                      {!isOwn && (
                        <div className="chat-msg-avatar-col">
                          {!isGroupedWithPrev && (
                            <button
                              type="button"
                              className="chat-avatar-wrap"
                              style={{
                                border: 0,
                                background: "transparent",
                                padding: 0,
                                width: 30,
                                height: 30,
                                cursor: "pointer",
                              }}
                              title={`Message ${msg.sender_name}`}
                              onClick={() => {
                                if (msg.sender_id !== currentUserId) {
                                  setSelectedType("direct");
                                  setSelectedTarget(msg.sender_id);
                                }
                              }}
                            >
                              <div className="chat-avatar-circle">
                                {msg.sender_avatar_url ? (
                                  <img
                                    src={msg.sender_avatar_url}
                                    alt={msg.sender_name}
                                  />
                                ) : (
                                  getInitials(msg.sender_name)
                                )}
                              </div>
                              <span
                                className={`chat-presence-dot is-${msg.sender_presence}`}
                                style={{ width: 9, height: 9 }}
                              />
                            </button>
                          )}
                        </div>
                      )}

                      <div className="chat-msg-content-col">
                        {!isGroupedWithPrev && (
                          <div className="chat-msg-sender-line">
                            {!isOwn && (
                              <span className="chat-msg-sender-name">
                                {msg.sender_name}
                              </span>
                            )}
                            <span>{formatMessageTime(msg.created_at)}</span>
                          </div>
                        )}

                        <div className="chat-msg-bubble-wrap">
                          {/* Hover Actions Toolbar */}
                          <div className="chat-msg-hover-toolbar">
                            {CHAT_REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="chat-hover-btn"
                                onClick={() => void toggleReaction(msg.id, emoji)}
                                title={`React ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="chat-hover-btn"
                              onClick={() => {
                                setReplyingTo(msg);
                                textareaRef.current?.focus();
                              }}
                              title="Reply to message"
                            >
                              <Reply size={13} />
                            </button>
                            {accessibleProjects.length > 0 && (
                              <button
                                type="button"
                                className="chat-hover-btn"
                                onClick={() => {
                                  setQuickTaskSourceMsg(msg);
                                  setQuickTaskTitle(
                                    stripMarkdownForPreview(msg.message).slice(0, 120) ||
                                      "Follow-up task from chat"
                                  );
                                }}
                                title="Create OrbitWork task from message"
                              >
                                <CheckSquare size={13} />
                              </button>
                            )}
                            {isOwn && (
                              <button
                                type="button"
                                className="chat-hover-btn is-danger"
                                onClick={() => void handleDeleteMessage(msg.id)}
                                title="Delete message"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {showSeenEye && (
                            <span
                              className="chat-seen-indicator"
                              title={`Seen ${formatMessageTime(peerLastReadAt ?? msg.created_at)}`}
                            >
                              <Eye size={13} />
                            </span>
                          )}

                          <div className="chat-msg-bubble">
                            {msg.metadata?.replyPreview && (
                              <div className="chat-reply-quote">
                                <strong>{msg.metadata.replyPreview.senderName}</strong>
                                <span>{msg.metadata.replyPreview.excerpt}</span>
                              </div>
                            )}

                            <ChatMessageBody
                              text={msg.message}
                              metadataAttachments={msg.metadata?.attachments}
                              onOpenImage={(url, alt) =>
                                setLightboxImage({ url, alt })
                              }
                            />

                            {(msg.metadata?.linkedEntities ?? []).map((entity) => (
                              <Link
                                key={`${entity.kind}-${entity.id}`}
                                href={entity.href}
                                className="chat-linked-card"
                              >
                                <div>
                                  <div className="chat-linked-card-kind">
                                    OrbitWork {entity.kind}
                                  </div>
                                  <div className="chat-linked-card-title">
                                    {entity.title}
                                  </div>
                                  {entity.subtitle && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "var(--muted)",
                                      }}
                                    >
                                      {entity.subtitle}
                                    </div>
                                  )}
                                </div>
                                <ArrowUpRight
                                  size={14}
                                  style={{ color: "var(--green)" }}
                                />
                              </Link>
                            ))}
                          </div>
                        </div>

                        {msg.reactions.length > 0 && (
                          <div className="chat-reactions-bar">
                            {msg.reactions.map((rx) => (
                              <button
                                key={rx.emoji}
                                type="button"
                                className={`chat-reaction-pill ${
                                  rx.reactedByMe ? "is-mine" : ""
                                }`}
                                onClick={() => void toggleReaction(msg.id, rx.emoji)}
                              >
                                <span>{rx.emoji}</span>
                                <span>{rx.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Context-aware Smart Quick Replies */}
          {smartQuickReplies.length > 0 && (
            <div className="chat-quick-replies">
              {smartQuickReplies.map((replyText) => (
                <button
                  key={replyText}
                  type="button"
                  className="chat-quick-reply-btn"
                  onClick={() => void sendMessage(replyText)}
                >
                  {replyText}
                </button>
              ))}
            </div>
          )}

          {/* Rich Composer Card */}
          <div className="chat-composer-shell">
            <div
              className={`chat-composer-card ${dragOverComposer ? "is-dragover" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverComposer(true);
              }}
              onDragLeave={() => setDragOverComposer(false)}
              onDrop={handleDrop}
            >
              {replyingTo && (
                <div className="chat-composer-reply-banner">
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: "var(--green)" }}>
                      Replying to {replyingTo.sender_name}:{" "}
                    </strong>
                    <span style={{ color: "var(--muted)" }}>
                      {stripMarkdownForPreview(replyingTo.message).slice(0, 90)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="chat-hover-btn"
                    onClick={() => setReplyingTo(null)}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {(stagedAttachments.length > 0 || stagedLinks.length > 0) && (
                <div className="chat-staged-strip">
                  {stagedAttachments.map((att) => (
                    <div key={att.id} className="chat-staged-chip">
                      {att.mimeType.startsWith("image/") ? (
                        <img src={att.url} alt={att.fileName} />
                      ) : (
                        <FileText size={13} />
                      )}
                      <span>{att.fileName}</span>
                      <button
                        type="button"
                        className="chat-hover-btn"
                        onClick={() =>
                          setStagedAttachments((prev) =>
                            prev.filter((a) => a.id !== att.id)
                          )
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {stagedLinks.map((lnk) => (
                    <div
                      key={`${lnk.kind}-${lnk.id}`}
                      className="chat-staged-chip"
                      style={{ borderColor: "rgba(22, 124, 88, 0.35)" }}
                    >
                      <CheckSquare size={12} style={{ color: "var(--green)" }} />
                      <span>
                        {lnk.kind}: {lnk.title}
                      </span>
                      <button
                        type="button"
                        className="chat-hover-btn"
                        onClick={() =>
                          setStagedLinks((prev) =>
                            prev.filter(
                              (item) => !(item.id === lnk.id && item.kind === lnk.kind)
                            )
                          )
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showFormatToolbar && (
                <div className="chat-format-toolbar">
                  <button
                    type="button"
                    className="chat-hover-btn"
                    onClick={() => insertFormatting("**")}
                    title="Bold"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    className="chat-hover-btn"
                    onClick={() => insertFormatting("*")}
                    title="Italic"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    className="chat-hover-btn"
                    onClick={() => insertFormatting("`")}
                    title="Inline code"
                  >
                    <Code size={13} />
                  </button>
                  <button
                    type="button"
                    className="chat-hover-btn"
                    onClick={() => setDraft((prev) => `${prev}\n- `)}
                    title="Bullet list"
                  >
                    <List size={13} />
                  </button>
                  <button
                    type="button"
                    className="chat-hover-btn"
                    onClick={() => {
                      setDraft((prev) => `${prev}@`);
                      setMentionQuery("");
                      textareaRef.current?.focus();
                    }}
                    title="Mention teammate"
                  >
                    <AtSign size={13} />
                  </button>
                </div>
              )}

              {/* @Mention Picker Popover */}
              {mentionQuery !== null && filteredMentions.length > 0 && (
                <div className="chat-popover is-left">
                  <div
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 700,
                      color: "var(--muted)",
                      padding: "2px 6px 6px",
                    }}
                  >
                    Mention Teammate
                  </div>
                  {filteredMentions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="chat-picker-option"
                      onClick={() => insertMention(m)}
                    >
                      <strong>@{m.name}</strong>
                      <small>{m.email}</small>
                    </button>
                  ))}
                </div>
              )}

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="chat-popover">
                  <div className="chat-emoji-grid">
                    {CHAT_COMPOSER_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="chat-emoji-btn"
                        onClick={() => {
                          setDraft((prev) => `${prev}${emoji}`);
                          setShowEmojiPicker(false);
                          textareaRef.current?.focus();
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* OrbitWork Share Task/Project/Doc Popover */}
              {showLinkPicker && (
                <div className="chat-popover">
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--muted)",
                      marginBottom: 6,
                    }}
                  >
                    Share OrbitWork Task, Project or Doc
                  </div>
                  <input
                    type="text"
                    placeholder="Filter tasks, docs, projects..."
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--app-bg)",
                      color: "var(--ink)",
                      fontSize: 12,
                      marginBottom: 6,
                      outline: "none",
                    }}
                  />
                  {filteredLinkItems.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted)", padding: 6 }}>
                      No matching OrbitWork items.
                    </div>
                  ) : (
                    filteredLinkItems.map((item) => (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        className="chat-picker-option"
                        onClick={() => {
                          setStagedLinks((prev) =>
                            prev.some((x) => x.id === item.id && x.kind === item.kind)
                              ? prev
                              : [...prev, item]
                          );
                          setShowLinkPicker(false);
                        }}
                      >
                        <strong>{item.title}</strong>
                        <small>
                          {item.kind.toUpperCase()}
                          {item.subtitle ? ` · ${item.subtitle}` : ""}
                        </small>
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="chat-composer-row">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  className="chat-composer-textarea"
                  placeholder={
                    uploadingFile
                      ? "Uploading attachment..."
                      : `Message ${activeThreadSummary.title}... (Ctrl+V to paste image, @ to mention)`
                  }
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAttachmentFile(f);
                    e.target.value = "";
                  }}
                />

                <div className="chat-composer-actions">
                  <button
                    type="button"
                    className={`chat-icon-btn ${showFormatToolbar ? "is-active" : ""}`}
                    onClick={() => setShowFormatToolbar((prev) => !prev)}
                    title="Formatting options"
                  >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>A</span>
                  </button>
                  <button
                    type="button"
                    className={`chat-icon-btn ${showEmojiPicker ? "is-active" : ""}`}
                    onClick={() => {
                      setShowEmojiPicker((prev) => !prev);
                      setShowLinkPicker(false);
                    }}
                    title="Insert emoji"
                  >
                    <Smile size={16} />
                  </button>
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Attach image or file"
                  >
                    <Paperclip size={16} />
                  </button>
                  <button
                    type="button"
                    className={`chat-icon-btn ${showLinkPicker ? "is-active" : ""}`}
                    onClick={() => {
                      setShowLinkPicker((prev) => !prev);
                      setShowEmojiPicker(false);
                    }}
                    title="Link Task, Project, or Document"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    className="chat-send-btn"
                    onClick={() => void sendMessage()}
                    disabled={
                      sending ||
                      uploadingFile ||
                      (!draft.trim() &&
                        stagedAttachments.length === 0 &&
                        stagedLinks.length === 0)
                    }
                  >
                    <Send size={14} />
                    <span>{sending ? "Sending..." : "Send"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modal: Create Group Chat */}
      {showNewGroupModal && (
        <div
          className="chat-modal-backdrop"
          onClick={() => setShowNewGroupModal(false)}
        >
          <form
            className="chat-modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateGroup}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>New Group Chat</h3>
              <button
                type="button"
                className="chat-hover-btn"
                onClick={() => setShowNewGroupModal(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="chat-field">
              <label>Group Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sprint Planning Sync"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="chat-field">
              <label>Purpose (Optional)</label>
              <input
                type="text"
                placeholder="Shared release & engineering channel"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
              />
            </div>
            <div className="chat-field">
              <label>Select Team Members ({selectedGroupMemberIds.length})</label>
              <div className="chat-member-checklist">
                {initialMembers.map((member) => {
                  const checked = selectedGroupMemberIds.includes(member.id);
                  return (
                    <label key={member.id} className="chat-member-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedGroupMemberIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== member.id)
                              : [...prev, member.id]
                          )
                        }
                      />
                      <span>{member.name}</span>
                      <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                        {member.email}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="chat-stage-tab-pill"
                onClick={() => setShowNewGroupModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="chat-send-btn"
                disabled={
                  creatingGroup ||
                  !groupName.trim() ||
                  selectedGroupMemberIds.length === 0
                }
              >
                {creatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Convert Chat Message to OrbitWork Task */}
      {quickTaskSourceMsg && (
        <div
          className="chat-modal-backdrop"
          onClick={() => setQuickTaskSourceMsg(null)}
        >
          <form
            className="chat-modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateQuickTask}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>Convert Message to Task</h3>
              <button
                type="button"
                className="chat-hover-btn"
                onClick={() => setQuickTaskSourceMsg(null)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="chat-field">
              <label>Target Project</label>
              <select
                value={quickTaskProjectId}
                onChange={(e) => setQuickTaskProjectId(e.target.value)}
              >
                {accessibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.workspaceName})
                  </option>
                ))}
              </select>
            </div>
            <div className="chat-field">
              <label>Task Title</label>
              <input
                type="text"
                required
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
              />
            </div>
            <div className="chat-field">
              <label>Priority</label>
              <select
                value={quickTaskPriority}
                onChange={(e) =>
                  setQuickTaskPriority(
                    e.target.value as "low" | "normal" | "high" | "urgent"
                  )
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="chat-stage-tab-pill"
                onClick={() => setQuickTaskSourceMsg(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="chat-send-btn"
                disabled={creatingQuickTask}
              >
                {creatingQuickTask ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Shared Artifacts in Thread */}
      {showSharedModal && (
        <div
          className="chat-modal-backdrop"
          onClick={() => setShowSharedModal(false)}
        >
          <div className="chat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>Shared in {activeThreadSummary.title}</h3>
              <button
                type="button"
                className="chat-hover-btn"
                onClick={() => setShowSharedModal(false)}
              >
                <X size={15} />
              </button>
            </div>
            {sharedArtifacts.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                No linked OrbitWork tasks, documents, or uploaded attachments yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {sharedArtifacts.map((item, idx) => (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    className="chat-linked-card"
                    style={{ marginTop: 0 }}
                    onClick={() => setShowSharedModal(false)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {item.kind === "image" ? (
                        <ImageIcon size={14} style={{ color: "var(--green)" }} />
                      ) : (
                        <FileText size={14} style={{ color: "var(--green)" }} />
                      )}
                      <div>
                        <div className="chat-linked-card-kind">{item.kind}</div>
                        <div className="chat-linked-card-title">{item.label}</div>
                      </div>
                    </div>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Image Modal */}
      {lightboxImage && (
        <div
          className="chat-modal-backdrop"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage.url}
            alt={lightboxImage.alt}
            className="chat-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
