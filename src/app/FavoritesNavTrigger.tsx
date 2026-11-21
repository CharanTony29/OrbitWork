"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Star, CheckSquare, FolderKanban, FileText, ChevronRight, X } from "lucide-react";

type FavoriteItem = {
  id: string;
  entity_type: "document" | "project" | "task";
  entity_id: string;
  project_id: string | null;
  title: string;
  subtitle: string;
  created_at?: string;
};

let cachedFavorites: FavoriteItem[] | null = null;

function getFavoriteUrl(item: FavoriteItem): string {
  if (item.entity_type === "document" && item.project_id) {
    return `/projects/${item.project_id}/documents/${item.entity_id}`;
  }
  if (item.entity_type === "task" && item.project_id) {
    return `/projects/${item.project_id}/tasks/${item.entity_id}`;
  }
  if (item.entity_type === "project") {
    return `/projects/${item.entity_id}`;
  }
  return "/dashboard";
}

function getItemIcon(type: FavoriteItem["entity_type"]) {
  if (type === "project") return <FolderKanban size={14} style={{ color: "#10b981", flexShrink: 0 }} />;
  if (type === "document") return <FileText size={14} style={{ color: "#8b5cf6", flexShrink: 0 }} />;
  return <CheckSquare size={14} style={{ color: "#3b82f6", flexShrink: 0 }} />;
}

export default function FavoritesNavTrigger() {
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => cachedFavorites || []);
  const [activeTab, setActiveTab] = useState<"all" | "task" | "project" | "document">("all");
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.favorites)) {
        cachedFavorites = data.favorites;
        setFavorites(data.favorites);
      }
    } catch {}
  }, []);

  // Pre-fetch favorites immediately on mount
  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  // Listen to external updates and toggle events
  useEffect(() => {
    const handleUpdate = () => void fetchFavorites();
    const handleToggle = () => setOpen((prev) => !prev);

    window.addEventListener("orbitwork:favorites-updated", handleUpdate);
    window.addEventListener("orbitwork:toggle-favorites-menu", handleToggle);

    return () => {
      window.removeEventListener("orbitwork:favorites-updated", handleUpdate);
      window.removeEventListener("orbitwork:toggle-favorites-menu", handleToggle);
    };
  }, [fetchFavorites]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const filtered = favorites.filter((f) => {
    if (activeTab === "all") return true;
    return f.entity_type === activeTab;
  });

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => {
          if (!cachedFavorites) void fetchFavorites();
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          height: "28px",
          padding: "0 10px",
          borderRadius: "6px",
          border: open ? "1px solid var(--accent, #eab308)" : "1px solid var(--line, #e2e8f0)",
          background: open ? "rgba(234, 179, 8, 0.08)" : "var(--surface, #ffffff)",
          color: "var(--ink, #1e293b)",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        title="View favorited projects, tasks, and documents"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Star
          size={13}
          style={{ color: "#eab308" }}
          fill={favorites.length > 0 ? "#eab308" : "none"}
        />
        <span>Favorites</span>
        {favorites.length > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "16px",
              height: "16px",
              padding: "0 4px",
              borderRadius: "10px",
              background: "#eab308",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {favorites.length}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Favorites menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: "320px",
            maxHeight: "440px",
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: "10px",
            boxShadow:
              "0 12px 30px -4px rgba(0, 0, 0, 0.15), 0 4px 12px -2px rgba(0, 0, 0, 0.08)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
              background: "var(--surface-subtle, #f8fafc)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Star size={14} style={{ color: "#eab308" }} fill="#eab308" />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--ink, #1e293b)",
                }}
              >
                Starred Favorites
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted, #64748b)",
                  background: "var(--line, #e2e8f0)",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontWeight: 600,
                }}
              >
                {favorites.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "var(--muted, #64748b)",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Close favorites"
            >
              <X size={14} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "6px 10px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
              background: "var(--surface, #ffffff)",
            }}
          >
            {(
              [
                ["all", "All"],
                ["task", "Tasks"],
                ["project", "Projects"],
                ["document", "Docs"],
              ] as const
            ).map(([key, label]) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "5px",
                    border: "none",
                    background: active
                      ? "var(--ink, #1e293b)"
                      : "transparent",
                    color: active ? "#ffffff" : "var(--muted, #64748b)",
                    fontSize: "11px",
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* List of Favorites */}
          <div
            style={{
              overflowY: "auto",
              maxHeight: "330px",
              padding: "4px 0",
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  color: "var(--muted, #64748b)",
                  fontSize: "12px",
                }}
              >
                <Star
                  size={24}
                  style={{ color: "#cbd5e1", margin: "0 auto 8px", display: "block" }}
                />
                <p style={{ margin: 0, fontWeight: 600 }}>No favorites yet</p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                  Star tasks, projects, or documents to open them instantly from here.
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const href = getFavoriteUrl(item);
                return (
                  <Link
                    key={`${item.entity_type}-${item.entity_id}`}
                    href={href}
                    prefetch={true}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      padding: "8px 12px",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "background 0.1s ease",
                      borderBottom: "1px solid rgba(226, 232, 240, 0.5)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--surface-subtle, #f8fafc)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {getItemIcon(item.entity_type)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: "var(--ink, #1e293b)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--muted, #64748b)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={13} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
