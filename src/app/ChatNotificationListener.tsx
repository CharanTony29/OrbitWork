"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, MessageSquare, Send, Volume2, VolumeX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  buildChannelThreadKey,
  buildDirectThreadKey,
  buildGroupThreadKey,
  stripMarkdownForPreview,
  type ChatConversationType,
} from "@/lib/chat";
import type { HydratedChatMessage } from "@/lib/chat-server";

type LiveChatToast = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  threadType: ChatConversationType;
  threadTarget: string;
  threadKey: string;
  threadLabel: string;
  organizationId: string | null;
  previewText: string;
  createdAt: string;
  replyDraft: string;
  replySending: boolean;
  replySent: boolean;
  replyError: string | null;
};

type LiveAppToast = {
  id: string;
  eventType: string;
  message: string;
  href: string;
  createdAt: string;
};

const SEEN_STORAGE_KEY = "orbitwork_seen_toast_ids_v1";
const SEEN_APP_NOTIF_KEY = "orbitwork_seen_app_notif_ids_v1";
const MUTE_STORAGE_KEY = "orbitwork_chat_sound_muted";
const PERMISSION_DISMISSED_KEY = "orbitwork_chat_notif_dismissed";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function loadSeenIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.slice(-100).map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    const arr = [...ids].slice(-100);
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage errors
  }
}

function playNotificationChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.09); // A5
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 350);
  } catch {
    // Audio playback blocked before user gesture; safe to ignore
  }
}

export default function ChatNotificationListener() {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<LiveChatToast[]>([]);
  const [appToasts, setAppToasts] = useState<LiveAppToast[]>([]);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [showPermissionPrompt, setShowPermissionPrompt] =
    useState<boolean>(false);

  const pathnameRef = useRef<string>(pathname);
  const activeChatKeyRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seenAppNotifsRef = useRef<Set<string>>(new Set());
  const baselinedRef = useRef<boolean>(false);
  const appNotifBaselinedRef = useRef<boolean>(false);
  const soundMutedRef = useRef<boolean>(false);
  const mountTimeMsRef = useRef<number>(Date.now());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    seenIdsRef.current = loadSeenIds();
    try {
      const muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
      setSoundMuted(muted);
      soundMutedRef.current = muted;
    } catch {
      // ignore
    }

    const win = window as Window & { __orbitworkActiveChatKey?: string };
    activeChatKeyRef.current = win.__orbitworkActiveChatKey ?? null;

    const onActiveChat = (event: Event) => {
      const custom = event as CustomEvent<{ threadKey?: string | null }>;
      activeChatKeyRef.current = custom.detail?.threadKey ?? null;
      // Auto-clear toasts for the thread user just opened
      if (custom.detail?.threadKey) {
        setToasts((prev) =>
          prev.filter((t) => t.threadKey !== custom.detail?.threadKey)
        );
      }
    };

    window.addEventListener("orbitwork-active-chat", onActiveChat);
    return () => {
      window.removeEventListener("orbitwork-active-chat", onActiveChat);
    };
  }, []);

  // Track auth state once
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const uid = data.user?.id ?? null;
      currentUserIdRef.current = uid;
      setCurrentUserId(uid);

      if (
        uid &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        try {
          const dismissed =
            window.localStorage.getItem(PERMISSION_DISMISSED_KEY) === "1";
          if (!dismissed) setShowPermissionPrompt(true);
        } catch {
          // ignore
        }
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      currentUserIdRef.current = uid;
      setCurrentUserId(uid);
      baselinedRef.current = false;
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const navigateToThread = useCallback(
    (toast: LiveChatToast) => {
      setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      const url = `/chat?type=${encodeURIComponent(
        toast.threadType
      )}&target=${encodeURIComponent(toast.threadTarget)}`;

      if (pathnameRef.current.startsWith("/chat")) {
        window.dispatchEvent(
          new CustomEvent("orbitwork-open-chat-thread", {
            detail: { type: toast.threadType, target: toast.threadTarget },
          })
        );
      }
      router.push(url);
    },
    [router]
  );

  const pollLatestMessages = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;

    try {
      const res = await fetch("/api/chat/messages?type=latest", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();

      if (typeof data.totalUnread === "number") {
        const win = window as Window & { __orbitworkChatUnreadCount?: number };
        win.__orbitworkChatUnreadCount = data.totalUnread;
        window.dispatchEvent(
          new CustomEvent("orbitwork-chat-unread", {
            detail: { totalUnread: data.totalUnread },
          })
        );
      }

      const incomingList = Array.isArray(data.messages)
        ? (data.messages as HydratedChatMessage[])
        : [];
      if (incomingList.length === 0) {
        baselinedRef.current = true;
        return;
      }

      const isInitialBaseline = !baselinedRef.current;
      baselinedRef.current = true;

      const freshToNotify: LiveChatToast[] = [];

      for (const msg of incomingList) {
        if (!msg.id || msg.sender_id === uid) continue;
        if (seenIdsRef.current.has(msg.id)) continue;

        seenIdsRef.current.add(msg.id);

        const msgCreatedMs = new Date(msg.created_at).getTime();
        const arrivedNearOrAfterMount =
          msgCreatedMs >= mountTimeMsRef.current - 12_000;

        if (isInitialBaseline && !arrivedNearOrAfterMount) {
          continue;
        }

        const threadType: ChatConversationType = msg.thread_id
          ? "group"
          : msg.recipient_id
            ? "direct"
            : "channel";
        const threadTarget =
          msg.thread_id ||
          (msg.recipient_id ? msg.sender_id : msg.channel || "general");
        const threadKey = msg.thread_id
          ? buildGroupThreadKey(msg.thread_id)
          : msg.recipient_id
            ? buildDirectThreadKey(uid, msg.sender_id)
            : buildChannelThreadKey(
                msg.channel || "general",
                msg.organization_id
              );

        // Suppress toast only when viewing that exact active thread while tab is visible
        const viewingThisThread =
          pathnameRef.current.startsWith("/chat") &&
          activeChatKeyRef.current === threadKey &&
          document.visibilityState === "visible";

        if (viewingThisThread) continue;

        const previewText =
          stripMarkdownForPreview(msg.message).slice(0, 140) || "Sent an attachment";
        const threadLabel =
          threadType === "group"
            ? "Group chat"
            : threadType === "direct"
              ? "Direct message"
              : `#${msg.channel || "general"}`;

        freshToNotify.push({
          id: msg.id,
          senderId: msg.sender_id,
          senderName: msg.sender_name || "Teammate",
          senderAvatarUrl: msg.sender_avatar_url ?? null,
          threadType,
          threadTarget,
          threadKey,
          threadLabel,
          organizationId: msg.organization_id ?? null,
          previewText,
          createdAt: msg.created_at,
          replyDraft: "",
          replySending: false,
          replySent: false,
          replyError: null,
        });
      }

      saveSeenIds(seenIdsRef.current);

      if (freshToNotify.length > 0) {
        if (!soundMutedRef.current) {
          playNotificationChime();
        }

        // Oldest of the fresh batch first, capped at 3 visible stacked cards
        const ordered = freshToNotify.reverse().slice(-3);
        setToasts((prev) => {
          const merged = [...prev];
          for (const item of ordered) {
            if (!merged.some((t) => t.id === item.id)) {
              merged.push(item);
            }
          }
          return merged.slice(-3);
        });

        // Fire OS Desktop Notifications
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const latestItem = ordered[ordered.length - 1];
          try {
            const notif = new Notification(
              `${latestItem.senderName} (${latestItem.threadLabel})`,
              {
                body: latestItem.previewText,
                tag: `orbitwork-chat-${latestItem.id}`,
              }
            );
            notif.onclick = () => {
              window.focus();
              navigateToThread(latestItem);
              notif.close();
            };
          } catch {
            // Browser rejected notification constructor
          }
        }
      }
    } catch {
      // Non-blocking poll error
    }
  }, [navigateToThread]);

  const pollAppNotifications = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;

    try {
      const res = await fetch("/api/notifications/latest", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const rows = Array.isArray(data.notifications) ? data.notifications : [];

      if (seenAppNotifsRef.current.size === 0) {
        try {
          const raw = window.localStorage.getItem(SEEN_APP_NOTIF_KEY);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) seenAppNotifsRef.current = new Set(arr.slice(-100).map(String));
          }
        } catch {}
      }

      const isInitial = !appNotifBaselinedRef.current;
      appNotifBaselinedRef.current = true;

      const fresh: LiveAppToast[] = [];
      for (const n of rows) {
        if (!n?.id || n.read_at) continue;
        const id = String(n.id);
        if (seenAppNotifsRef.current.has(id)) continue;

        const createdMs = new Date(n.created_at ?? 0).getTime();
        if (isInitial && Number.isFinite(createdMs) && mountTimeMsRef.current - createdMs > 15_000) {
          seenAppNotifsRef.current.add(id);
          continue;
        }

        seenAppNotifsRef.current.add(id);
        const href =
          (typeof n.action_url === "string" && n.action_url) ||
          (n.task_id && n.project_id
            ? `/projects/${n.project_id}/tasks/${n.task_id}`
            : n.organization_id && String(n.event_type ?? "").startsWith("leave")
              ? `/organizations/${n.organization_id}/calendar`
              : n.project_id
                ? `/projects/${n.project_id}`
                : "/inbox");

        fresh.push({
          id,
          eventType: String(n.event_type ?? "notification"),
          message: String(n.message ?? "New activity in Orbitwork"),
          href,
          createdAt: String(n.created_at ?? new Date().toISOString()),
        });
      }

      try {
        window.localStorage.setItem(
          SEEN_APP_NOTIF_KEY,
          JSON.stringify([...seenAppNotifsRef.current].slice(-100))
        );
      } catch {}

      if (fresh.length > 0) {
        if (!soundMutedRef.current) playNotificationChime();
        setAppToasts((prev) => {
          const existing = new Set(prev.map((x) => x.id));
          return [...prev, ...fresh.filter((x) => !existing.has(x.id))].slice(-4);
        });
      }
    } catch {
      // Non-blocking poll error
    }
  }, []);

  // Persistent session-level polling + Realtime + focus triggers + presence heartbeat
  useEffect(() => {
    if (!currentUserId) return;

    void pollLatestMessages();
    void pollAppNotifications();

    const sendHeartbeat = () => {
      if (document.visibilityState === "visible") {
        void fetch("/api/chat/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ heartbeatOnly: true }),
        }).catch(() => {});
      }
    };
    sendHeartbeat();

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void pollLatestMessages();
        void pollAppNotifications();
      }
    }, 5500);

    const heartbeatInterval = window.setInterval(sendHeartbeat, 45_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void pollLatestMessages();
        void pollAppNotifications();
        sendHeartbeat();
      }
    };

    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);

    const supabase = createClient();
    const realtimeChannel = supabase
      .channel(`orbitwork-global-chat-alerts-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "workspace_chat_messages" },
        () => {
          void pollLatestMessages();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${currentUserId}` },
        () => {
          void pollAppNotifications();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(pollInterval);
      window.clearInterval(heartbeatInterval);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(realtimeChannel);
    };
  }, [currentUserId, pollLatestMessages, pollAppNotifications]);

  // Auto-dismiss non-hovered/idle toasts cleanly after 10s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setToasts((prev) =>
        prev.filter((t) => {
          if (t.replyDraft.trim().length > 0 || t.replySending) return true;
          const age = now - new Date(t.createdAt).getTime();
          return t.replySent ? age < 2500 : age < 14_000;
        })
      );
    }, 2000);
    return () => window.clearInterval(timer);
  }, [toasts.length]);

  const handleQuickReplySubmit = async (
    e: React.FormEvent,
    toast: LiveChatToast
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const text = toast.replyDraft.trim();
    if (!text || toast.replySending) return;

    setToasts((prev) =>
      prev.map((item) =>
        item.id === toast.id
          ? { ...item, replySending: true, replyError: null }
          : item
      )
    );

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: toast.threadType,
          target: toast.threadTarget,
          organizationId: toast.organizationId,
          message: text,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setToasts((prev) =>
          prev.map((item) =>
            item.id === toast.id
              ? {
                  ...item,
                  replySending: false,
                  replyError: errData.error || "Could not send reply",
                }
              : item
          )
        );
        return;
      }

      setToasts((prev) =>
        prev.map((item) =>
          item.id === toast.id
            ? { ...item, replySending: false, replySent: true, replyDraft: "" }
            : item
        )
      );
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 1400);
    } catch {
      setToasts((prev) =>
        prev.map((item) =>
          item.id === toast.id
            ? {
                ...item,
                replySending: false,
                replyError: "Network error sending reply",
              }
            : item
        )
      );
    }
  };

  const toggleSoundMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    soundMutedRef.current = next;
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const requestDesktopAlerts = async () => {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
    setShowPermissionPrompt(false);
  };

  const dismissPermissionPrompt = () => {
    setShowPermissionPrompt(false);
    try {
      window.localStorage.setItem(PERMISSION_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!currentUserId) return null;

  return (
    <>
      {showPermissionPrompt && (
        <div
          style={{
            position: "fixed",
            bottom: "18px",
            left: "18px",
            zIndex: 9998,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "11px 14px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            maxWidth: "350px",
          }}
        >
          <Bell size={17} style={{ color: "var(--green)", flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: "12px", color: "var(--ink)" }}>
            <strong>Desktop Chat Alerts</strong>
            <div style={{ color: "var(--muted)", marginTop: "2px" }}>
              Get instant desktop notifications for new team &amp; DM messages.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void requestDesktopAlerts()}
            style={{
              background: "var(--green)",
              color: "#fff",
              border: 0,
              borderRadius: "7px",
              padding: "6px 10px",
              fontSize: "11.5px",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            Allow
          </button>
          <button
            type="button"
            onClick={dismissPermissionPrompt}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--muted)",
              cursor: "pointer",
              padding: "2px",
            }}
            aria-label="Dismiss alert prompt"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {(toasts.length > 0 || appToasts.length > 0) && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "350px",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          {appToasts.map((nt) => (
            <div
              key={`app-${nt.id}`}
              style={{
                background: "var(--surface)",
                border: "1px solid rgba(22, 124, 88, 0.4)",
                borderRadius: "12px",
                padding: "12px 14px",
                boxShadow: "0 14px 36px rgba(0, 0, 0, 0.22)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--green)" }}>
                  <Bell size={14} />
                  {nt.eventType === "leave_requested"
                    ? "Leave Request"
                    : nt.eventType === "leave_reviewed"
                      ? "Leave Update"
                      : nt.eventType === "task_delegated"
                        ? "Task Delegated"
                        : nt.eventType === "goal_completed"
                          ? "Goal Completed"
                          : "Task Notification"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppToasts((prev) => prev.filter((item) => item.id !== nt.id));
                    void fetch("/api/notifications/latest", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: nt.id }),
                    }).catch(() => {});
                  }}
                  aria-label="Dismiss notification"
                  style={{ background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer", padding: "3px" }}
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ fontSize: "12.5px", lineHeight: 1.4, color: "var(--ink)" }}>{nt.message}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setAppToasts((prev) => prev.filter((item) => item.id !== nt.id));
                    void fetch("/api/notifications/latest", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: nt.id }),
                    }).catch(() => {});
                    router.push(nt.href);
                  }}
                  style={{
                    border: 0,
                    background: "var(--green)",
                    color: "#fff",
                    padding: "5px 11px",
                    borderRadius: "7px",
                    fontSize: "11.5px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                background: "var(--surface)",
                border: "1px solid rgba(22, 124, 88, 0.35)",
                borderRadius: "12px",
                padding: "12px 14px",
                boxShadow: "0 14px 36px rgba(0, 0, 0, 0.22)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => navigateToThread(toast)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    border: 0,
                    background: "transparent",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    className="chat-avatar-circle"
                    style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}
                  >
                    {toast.senderAvatarUrl ? (
                      <img
                        src={toast.senderAvatarUrl}
                        alt={toast.senderName}
                      />
                    ) : (
                      getInitials(toast.senderName)
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {toast.senderName}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 650,
                          padding: "1px 6px",
                          borderRadius: "999px",
                          background: "var(--nav-hover)",
                          color: "var(--green)",
                          flexShrink: 0,
                        }}
                      >
                        {toast.threadLabel}
                      </span>
                    </div>
                  </div>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  <button
                    type="button"
                    onClick={toggleSoundMute}
                    title={soundMuted ? "Unmute chat sound" : "Mute chat sound"}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: "3px",
                    }}
                  >
                    {soundMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setToasts((prev) => prev.filter((item) => item.id !== toast.id))
                    }
                    aria-label="Dismiss popup"
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: "3px",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigateToThread(toast)}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  lineHeight: 1.4,
                  color: "var(--ink)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {toast.previewText}
              </button>

              {toast.replySent ? (
                <div
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 650,
                    color: "var(--green)",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <MessageSquare size={12} />
                  <span>Reply sent!</span>
                </div>
              ) : (
                <form
                  className="chat-toast-quick-form"
                  onSubmit={(e) => void handleQuickReplySubmit(e, toast)}
                >
                  <input
                    type="text"
                    placeholder={`Reply to ${toast.senderName}...`}
                    value={toast.replyDraft}
                    onChange={(e) =>
                      setToasts((prev) =>
                        prev.map((item) =>
                          item.id === toast.id
                            ? { ...item, replyDraft: e.target.value, replyError: null }
                            : item
                        )
                      )
                    }
                  />
                  <button
                    type="submit"
                    disabled={toast.replySending || !toast.replyDraft.trim()}
                    title="Send quick reply"
                  >
                    {toast.replySending ? "..." : <Send size={12} />}
                  </button>
                </form>
              )}

              {toast.replyError && (
                <div style={{ fontSize: "11px", color: "#dc2626" }}>
                  {toast.replyError}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
