"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Clock3,
  FileText,
  House,
  Layers3,
  LayoutDashboard,
  MessageSquare,
  UsersRound,
  X,
  UserRound,
} from "lucide-react";
import { BrandMark } from "./BrandMark";

export default function GlobalMobileDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const onOpen = () => handleOpen();
    const onClose = () => handleClose();

    window.addEventListener("orbitwork:open-mobile-nav", onOpen);
    window.addEventListener("orbitwork:close-mobile-nav", onClose);

    return () => {
      window.removeEventListener("orbitwork:open-mobile-nav", onOpen);
      window.removeEventListener("orbitwork:close-mobile-nav", onClose);
    };
  }, [handleOpen, handleClose]);

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isLinkActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="mobile-drawer-portal" role="dialog" aria-modal="true" aria-label="Mobile navigation">
      <div
        className="mobile-drawer-backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="mobile-drawer-panel">
        <div className="mobile-drawer-header">
          <Link
            href="/dashboard"
            className="brand ov-brand"
            onClick={handleClose}
            prefetch={false}
          >
            <BrandMark size={27} />
            <span>
              Orbit<span className="ov-brand-accent">Work</span>
            </span>
          </Link>
          <button
            type="button"
            className="mobile-drawer-close-btn"
            onClick={handleClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mobile-drawer-nav" aria-label="Main menu">
          <div className="mobile-drawer-section-label">MAIN NAVIGATION</div>

          <Link
            href="/dashboard"
            className={`mobile-drawer-link${isLinkActive("/dashboard") ? " is-active" : ""}`}
            onClick={handleClose}
            prefetch={false}
          >
            <House size={18} />
            <span>Overview</span>
          </Link>

          <Link
            href="/my-dashboard"
            className={`mobile-drawer-link${isLinkActive("/my-dashboard") ? " is-active" : ""}`}
            onClick={handleClose}
            prefetch={false}
          >
            <LayoutDashboard size={18} />
            <span>Personal Dashboard</span>
          </Link>

          <Link
            href="/inbox"
            className={`mobile-drawer-link${isLinkActive("/inbox") ? " is-active" : ""}`}
            onClick={handleClose}
            prefetch={false}
          >
            <Bell size={18} />
            <span>Inbox</span>
          </Link>

          <Link
            href="/planner"
            className={`mobile-drawer-link${isLinkActive("/planner") ? " is-active" : ""}`}
            onClick={handleClose}
            prefetch={false}
          >
            <CalendarDays size={18} />
            <span>Planner &amp; Rooms</span>
          </Link>

          <Link
            href="/chat"
            className={`mobile-drawer-link${isLinkActive("/chat") ? " is-active" : ""}`}
            onClick={handleClose}
            prefetch={false}
          >
            <MessageSquare size={18} />
            <span>Chat</span>
          </Link>

          <div className="mobile-drawer-section-label">SPACES &amp; RESOURCES</div>

          <Link
            href="/dashboard"
            className="mobile-drawer-link"
            onClick={handleClose}
            prefetch={false}
          >
            <Layers3 size={18} />
            <span>Organizations &amp; Workspaces</span>
          </Link>

          <Link
            href="/profile"
            className={`mobile-drawer-link${isLinkActive("/profile") ? " is-active" : ""}`}
            onClick={handleClose}
            prefetch={false}
          >
            <UserRound size={18} />
            <span>Profile &amp; Settings</span>
          </Link>
        </nav>

        <div className="mobile-drawer-footer">
          <small className="mobile-drawer-footnote">Orbitwork Work Management</small>
        </div>
      </div>
    </div>
  );
}
