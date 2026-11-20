"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type RailNavItem = {
  key: string;
  label: string;
  title: string;
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  isActive: boolean;
};

/**
 * Shared dynamic height-aware rail items list.
 * Measures the available vertical height of `.work-icon-rail` via ResizeObserver
 * and automatically moves any bottom items that wouldn't fit on smaller screen
 * resolutions into a crisp `More >` flyout menu so nothing is ever cut off.
 */
export function NavRailDynamicItems({
  railRef,
  items,
  moreHref,
  moreTitle = "More navigation items",
  moreIsActive = false,
  moreIcon,
}: {
  railRef: React.RefObject<HTMLElement | null>;
  items: RailNavItem[];
  moreHref: string;
  moreTitle?: string;
  moreIsActive?: boolean;
  moreIcon: ReactNode;
}) {
  const [maxVisible, setMaxVisible] = useState<number>(items.length);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const railEl = railRef.current;
    const recalc = () => {
      const railHeight = railEl?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 900);
      // Reserve space for: top logo (~42px) + sidebar toggle (~40px) + padding (~22px) + bottom More button (~56px)
      const reservedPx = 166;
      const itemSlotPx = 54; // 47px min-height + 7px gap
      const avail = Math.max(0, railHeight - reservedPx);
      const fit = Math.max(2, Math.floor(avail / itemSlotPx));
      setMaxVisible(fit);
    };

    recalc();
    const ro = typeof ResizeObserver !== "undefined" && railEl ? new ResizeObserver(recalc) : null;
    if (ro && railEl) ro.observe(railEl);
    window.addEventListener("resize", recalc);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [railRef, items.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (moreBtnRef.current?.contains(target)) return;
      if (target.closest(".work-rail-more-menu")) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => setMenuOpen(false);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  const hasOverflow = maxVisible < items.length;
  const visibleItems = hasOverflow ? items.slice(0, maxVisible) : items;
  const overflowItems = hasOverflow ? items.slice(maxVisible) : [];
  const anyOverflowActive = overflowItems.some((item) => item.isActive) || moreIsActive;

  const toggleMenu = () => {
    if (!menuOpen && moreBtnRef.current) {
      const rect = moreBtnRef.current.getBoundingClientRect();
      const bottomOffset = Math.max(12, window.innerHeight - rect.bottom);
      setMenuPos({
        left: rect.right + 8,
        bottom: Math.min(bottomOffset, window.innerHeight - 240),
      });
    }
    setMenuOpen((prev) => !prev);
  };

  return (
    <>
      {visibleItems.map((item) =>
        item.href ? (
          <Link
            key={item.key}
            href={item.href}
            prefetch={true}
            title={item.title}
            className={item.isActive ? "is-active" : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            title={item.title}
            className={`work-rail-action-btn${item.isActive ? " is-active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      )}

      {hasOverflow ? (
        <>
          <button
            ref={moreBtnRef}
            type="button"
            className={`work-rail-action-btn work-rail-more work-rail-more-trigger${
              anyOverflowActive || menuOpen ? " is-active" : ""
            }`}
            onClick={toggleMenu}
            title={`Show ${overflowItems.length + 1} more navigation items`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="work-rail-more-icons">
              {moreIcon}
              <ChevronRight
                size={11}
                className={`work-rail-more-chevron${menuOpen ? " is-open" : ""}`}
              />
            </span>
            <span>More</span>
          </button>

          {menuOpen &&
            menuPos &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                className="work-rail-more-menu"
                role="menu"
                aria-label="More navigation items"
                style={{
                  position: "fixed",
                  left: `${menuPos.left}px`,
                  bottom: `${menuPos.bottom}px`,
                  zIndex: 800,
                }}
              >
                <div className="work-rail-more-menu-head">More Navigation</div>
                {overflowItems.map((item) =>
                  item.href ? (
                    <Link
                      key={item.key}
                      href={item.href}
                      prefetch={true}
                      role="menuitem"
                      className={`work-rail-more-menu-item${item.isActive ? " is-active" : ""}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      {item.isActive && <span className="work-rail-more-dot" />}
                    </Link>
                  ) : (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      className={`work-rail-more-menu-item${item.isActive ? " is-active" : ""}`}
                      onClick={() => {
                        setMenuOpen(false);
                        item.onClick?.();
                      }}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      {item.isActive && <span className="work-rail-more-dot" />}
                    </button>
                  )
                )}
                <Link
                  href={moreHref}
                  prefetch={true}
                  role="menuitem"
                  className={`work-rail-more-menu-item${moreIsActive ? " is-active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {moreIcon}
                  <span>{moreTitle}</span>
                  {moreIsActive && <span className="work-rail-more-dot" />}
                </Link>
              </div>,
              document.body
            )}
        </>
      ) : (
        <Link
          className={`work-rail-more${moreIsActive ? " is-active" : ""}`}
          href={moreHref}
          prefetch={true}
          title={moreTitle}
        >
          {moreIcon}
          <span>More</span>
        </Link>
      )}
    </>
  );
}
