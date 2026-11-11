"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MessageSquare,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  DEFAULT_PROJECT_TAB_ORDER,
  normalizeTabOrder,
  PROJECT_TAB_COOKIE,
  PROJECT_TAB_LABELS,
  ProjectTabKey,
} from "@/lib/project-preferences";

type Props = {
  projectId: string;
  activeView: ProjectTabKey;
  initialTabOrder: ProjectTabKey[];
  preservedFilters: {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    sort?: string;
    month?: string;
    group?: string;
  };
};

const STORAGE_KEY = "orbitwork_project_tab_order_v1";

export default function ProjectViewTabsClient({
  projectId,
  activeView,
  initialTabOrder,
  preservedFilters,
}: Props) {
  const router = useRouter();
  const [tabOrder, setTabOrder] = useState<ProjectTabKey[]>(() =>
    normalizeTabOrder(initialTabOrder)
  );
  const [dragKey, setDragKey] = useState<ProjectTabKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<ProjectTabKey | null>(null);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTabOrder(normalizeTabOrder(initialTabOrder));
  }, [initialTabOrder]);

  useEffect(() => {
    if (!customizerOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCustomizerOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCustomizerOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [customizerOpen]);

  const buildViewHref = (nextView: ProjectTabKey) => {
    const params = new URLSearchParams();
    params.set("view", nextView);
    for (const [k, v] of Object.entries(preservedFilters)) {
      if (v) params.set(k, v);
    }
    return `/projects/${projectId}?${params.toString()}`;
  };

  const persistOrder = async (next: ProjectTabKey[]) => {
    const normalized = normalizeTabOrder(next);
    setTabOrder(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      document.cookie = `${PROJECT_TAB_COOKIE}=${encodeURIComponent(
        JSON.stringify(normalized)
      )}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } catch {
      // Ignore storage quota issues
    }
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectTabOrder: normalized }),
      });
      router.refresh();
    } catch {
      // Cookie + localStorage already stored locally
    }
  };

  const reorderTabs = (fromKey: ProjectTabKey, toKey: ProjectTabKey) => {
    if (fromKey === toKey) return;
    const next = [...tabOrder];
    const fromIdx = next.indexOf(fromKey);
    const toIdx = next.indexOf(toKey);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    void persistOrder(next);
  };

  const moveTabStep = (key: ProjectTabKey, delta: -1 | 1) => {
    const idx = tabOrder.indexOf(key);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= tabOrder.length) return;
    const next = [...tabOrder];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIdx, 0, moved);
    void persistOrder(next);
  };

  return (
    <div className="view-tabs-customizable" ref={popoverRef}>
      <div className="view-tabs-strip">
        {tabOrder.map((key) => {
          const isSelected = activeView === key;
          const isDropTarget = dragOverKey === key && dragKey !== key;
          return (
            <Link
              key={key}
              href={buildViewHref(key)}
              draggable
              onDragStart={(e) => {
                setDragKey(key);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", key);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverKey !== key) setDragOverKey(key);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const source = (e.dataTransfer.getData("text/plain") || dragKey) as ProjectTabKey;
                setDragKey(null);
                setDragOverKey(null);
                if (source) reorderTabs(source, key);
              }}
              onDragEnd={() => {
                setDragKey(null);
                setDragOverKey(null);
              }}
              className={`${isSelected ? "selected" : ""}${
                isDropTarget ? " is-tab-drop-target" : ""
              }${key === "channel" ? " view-tab-channel" : ""}`}
              title={`Open ${PROJECT_TAB_LABELS[key]} view (drag to reorder tabs)`}
            >
              {key === "channel" && <MessageSquare size={12} />}
              <span>{PROJECT_TAB_LABELS[key]}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`view-tabs-customize-btn${customizerOpen ? " is-open" : ""}`}
          onClick={() => setCustomizerOpen((o) => !o)}
          title="Arrange tabs order for your view"
          aria-expanded={customizerOpen}
        >
          <SlidersHorizontal size={13} />
          <span>Arrange tabs</span>
        </button>
      </div>

      {customizerOpen && (
        <div
          className="view-tabs-popover"
          role="dialog"
          aria-label="Customize your project view tabs"
        >
          <div className="view-tabs-popover-head">
            <div>
              <strong>Your Tab Order</strong>
              <small>Only affects your view. The first tab opens by default.</small>
            </div>
            <button
              type="button"
              className="view-tabs-reset-btn"
              onClick={() => void persistOrder([...DEFAULT_PROJECT_TAB_ORDER])}
              title="Reset to default tab order"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          <div className="view-tabs-popover-list">
            {tabOrder.map((key, idx) => (
              <div
                key={key}
                className={`view-tabs-popover-item${
                  dragOverKey === key ? " is-drop-hover" : ""
                }`}
                draggable
                onDragStart={() => setDragKey(key)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverKey(key);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragKey) reorderTabs(dragKey, key);
                  setDragKey(null);
                  setDragOverKey(null);
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setDragOverKey(null);
                }}
              >
                <span className="view-tabs-grip">
                  <GripVertical size={13} />
                </span>
                <span className="view-tabs-item-name">
                  {PROJECT_TAB_LABELS[key]}
                  {idx === 0 && (
                    <span className="view-tabs-default-badge">Default</span>
                  )}
                </span>
                <div className="view-tabs-step-btns">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveTabStep(key, -1)}
                    aria-label={`Move ${PROJECT_TAB_LABELS[key]} left`}
                    title="Move earlier"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === tabOrder.length - 1}
                    onClick={() => moveTabStep(key, 1)}
                    aria-label={`Move ${PROJECT_TAB_LABELS[key]} right`}
                    title="Move later"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
