"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MessageSquare, X, Bell } from "lucide-react";

type ToastMessage = {
  id: string;
  senderName: string;
  senderId: string;
  channel: string;
  message: string;
  createdAt: string;
  isDirect: boolean;
};

export default function ChatNotificationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeToast, setActiveToast] = useState<ToastMessage | null>(null);
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission>("default");
  const [showPermPrompt, setShowPermPrompt] = useState(false);
  const lastKnownIdRef = useRef<string | null>(null);
  const isFirstPollRef = useRef(true);

  // Check desktop notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setDesktopPerm(Notification.permission);
      if (Notification.permission === "default") {
        setShowPermPrompt(true);
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setDesktopPerm(perm);
        setShowPermPrompt(false);
      } catch (err) {
        console.error("Error requesting notification permission", err);
      }
    }
  };

  // Poll for latest messages every 5 seconds
  useEffect(() => {
    let ignore = false;

    async function pollLatest() {
      try {
        const res = await fetch("/api/chat/messages?type=latest");
        if (!res.ok) return;
        const data = await res.json();
        const messages: any[] = data.messages ?? [];
        if (ignore || messages.length === 0) return;

        const newest = messages[0];
        if (!newest) return;

        // On first poll, just record latest ID
        if (isFirstPollRef.current) {
          lastKnownIdRef.current = newest.id;
          isFirstPollRef.current = false;
          return;
        }

        // If there's a new message and it's NOT from the current user
        if (lastKnownIdRef.current && newest.id !== lastKnownIdRef.current) {
          lastKnownIdRef.current = newest.id;

          if (!newest.isCurrentUser && pathname !== "/chat") {
            const toast: ToastMessage = {
              id: newest.id,
              senderName: newest.senderName,
              senderId: newest.senderId,
              channel: newest.channel,
              message: newest.message,
              createdAt: newest.createdAt,
              isDirect: Boolean(newest.recipientId),
            };

            // 1. In-app popup toast
            setActiveToast(toast);

            // 2. Machine/Desktop OS notification
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              const notifTitle = toast.isDirect
                ? `💬 ${toast.senderName}`
                : `💬 ${toast.senderName} in #${toast.channel}`;
              const notif = new Notification(notifTitle, {
                body: toast.message,
                icon: "/favicon.ico",
              });
              notif.onclick = () => {
                window.focus();
                router.push("/chat");
              };
            }
          }
        }
      } catch (err) {
        // Silently catch background poll errors
      }
    }

    const interval = setInterval(pollLatest, 5000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [pathname, router]);

  // Auto-dismiss in-app toast after 8 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  return (
    <>
      {/* Desktop Notification Enable Pill / Prompt */}
      {showPermPrompt && (
        <aside
          role="region"
          aria-label="Desktop notifications"
          style={{
            position: "fixed",
            bottom: 20,
            left: 20,
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            background: "var(--paper, #ffffff)",
            color: "var(--ink, #1e293b)",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            fontSize: 12,
          }}
        >
          <Bell size={15} color="var(--green, #167c58)" />
          <span>Allow machine popups for chat messages?</span>
          <button
            type="button"
            onClick={requestNotificationPermission}
            style={{
              padding: "4px 10px",
              background: "var(--green, #167c58)",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Allow
          </button>
          <button
            type="button"
            onClick={() => setShowPermPrompt(false)}
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              color: "var(--muted)",
              padding: 2,
            }}
          >
            <X size={13} />
          </button>
        </aside>
      )}

      {/* In-App Toast Popup Notification */}
      {activeToast && (
        <aside
          role="region"
          aria-label="New chat notification"
          onClick={() => {
            setActiveToast(null);
            router.push("/chat");
          }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 320,
            background: "var(--paper, #ffffff)",
            color: "var(--ink, #1e293b)",
            border: "1px solid var(--green, #167c58)",
            borderRadius: 12,
            boxShadow: "0 12px 36px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "12px 14px",
            cursor: "pointer",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#167c58",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {activeToast.senderName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{activeToast.senderName}</div>
                <div style={{ fontSize: 10, color: "var(--green, #167c58)", fontWeight: 600 }}>
                  {activeToast.isDirect ? "Direct Message" : `#${activeToast.channel}`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--muted)",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <X size={14} />
            </button>
          </div>

          <p
            style={{
              margin: "0 0 6px",
              fontSize: 12,
              lineHeight: 1.4,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {activeToast.message}
          </p>

          <div style={{ fontSize: 10.5, color: "var(--green, #167c58)", fontWeight: 700, textAlign: "right" }}>
            Click to reply →
          </div>
        </aside>
      )}
    </>
  );
}
