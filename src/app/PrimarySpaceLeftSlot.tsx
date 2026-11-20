"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, Layers3, LayoutDashboard, MessageSquare } from "lucide-react";
import { BrandMark } from "./BrandMark";
import ChatUnreadBadge from "./ChatUnreadBadge";
import TopBarMobileMenuToggle from "./TopBarMobileMenuToggle";

export type PrimarySpaceNavKey = "overview" | "dashboard" | "inbox" | "planner" | "chat";

/**
 * Persistent top-bar brand and primary navigation pills shared across the
 * workspace overview, personal dashboard, inbox, and chat pages.
 */
export default function PrimarySpaceLeftSlot({
  activeNav,
  assignedTaskCount = 0,
}: {
  activeNav: PrimarySpaceNavKey;
  assignedTaskCount?: number;
}) {
  const router = useRouter();

  // Warm up the route cache immediately on mount so navigation between pages is instant
  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/my-dashboard");
    router.prefetch("/inbox");
    router.prefetch("/planner");
    router.prefetch("/chat");
  }, [router]);

  return (
    <div className="ov-topbar-left-nav">
      <TopBarMobileMenuToggle />
      <Link className="brand ov-brand" href="/dashboard" prefetch={true}>
        <BrandMark size={27} />
        <span>
          Orbit<span className="ov-brand-accent">Work</span>
        </span>
      </Link>
      <nav className="ov-topbar-links" aria-label="Primary navigation">
        <Link
          href="/dashboard"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/dashboard")}
          className={activeNav === "overview" ? "is-active" : undefined}
          aria-current={activeNav === "overview" ? "page" : undefined}
        >
          <Layers3 size={14} />
          <span>Overview</span>
        </Link>
        <Link
          href="/my-dashboard"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/my-dashboard")}
          className={activeNav === "dashboard" ? "is-active" : undefined}
          aria-current={activeNav === "dashboard" ? "page" : undefined}
        >
          <LayoutDashboard size={14} />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/inbox"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/inbox")}
          className={activeNav === "inbox" ? "is-active" : undefined}
          aria-current={activeNav === "inbox" ? "page" : undefined}
        >
          <Bell size={14} />
          <span>Inbox</span>
          {assignedTaskCount > 0 && (
            <span className="ov-topbar-count">{assignedTaskCount}</span>
          )}
        </Link>
        <Link
          href="/planner"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/planner")}
          className={activeNav === "planner" ? "is-active" : undefined}
          aria-current={activeNav === "planner" ? "page" : undefined}
        >
          <CalendarDays size={14} />
          <span>Planner</span>
        </Link>
        <Link
          href="/chat"
          prefetch={true}
          onMouseEnter={() => router.prefetch("/chat")}
          className={activeNav === "chat" ? "is-active" : undefined}
          aria-current={activeNav === "chat" ? "page" : undefined}
        >
          <MessageSquare size={14} />
          <span>Chat</span>
          <ChatUnreadBadge />
        </Link>
      </nav>
    </div>
  );
}
