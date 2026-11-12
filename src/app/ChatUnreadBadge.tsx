"use client";

import { useEffect, useState } from "react";

export default function ChatUnreadBadge() {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const win = window as Window & { __orbitworkChatUnreadCount?: number };
    if (typeof win.__orbitworkChatUnreadCount === "number") {
      setUnreadCount(win.__orbitworkChatUnreadCount);
    }

    const onUnreadUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ totalUnread?: number }>;
      if (typeof custom.detail?.totalUnread === "number") {
        setUnreadCount(custom.detail.totalUnread);
      }
    };

    window.addEventListener("orbitwork-chat-unread", onUnreadUpdate);
    return () => {
      window.removeEventListener("orbitwork-chat-unread", onUnreadUpdate);
    };
  }, []);

  if (unreadCount <= 0) return null;

  return (
    <span className="ov-topbar-count" aria-label={`${unreadCount} unread messages`}>
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
