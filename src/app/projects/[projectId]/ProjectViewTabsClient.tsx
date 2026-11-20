"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MessageSquare,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Bot,
  ListTodo,
  Kanban,
  CalendarDays,
  GanttChart,
  Users,
  Presentation,
  Workflow,
  Brain,
  Radio,
  Loader2,
} from "lucide-react";
import { notifyNavigationStart } from "@/app/TopProgressBar";
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
  onViewSelect?: (view: ProjectTabKey) => void;
};

const STORAGE_KEY = "orbitwork_project_tab_order_v1";

function renderTabIcon(key: ProjectTabKey, isSelected: boolean, isPending: boolean = false) {
  if (isPending) {
    return <Loader2 size={13} className="spin tab-loading-spinner" />;
  }
  switch (key) {
    case "live":
      return <Radio size={13} style={{ color: isSelected ? "inherit" : "#eab308" }} />;
    case "list":
      return <ListTodo size={13} />;
    case "board":
      return <Kanban size={13} />;
    case "calendar":
      return <CalendarDays size={13} />;
    case "gantt":
      return <GanttChart size={13} />;
    case "workload":
      return <Users size={13} />;
    case "whiteboard":
      return <Presentation size={13} />;
    case "flowchart":
      return <Workflow size={13} />;
    case "channel":
      return <MessageSquare size={13} />;
    case "goals":
      return <Target size={13} />;
    case "agents":
      return <Bot size={13} />;
    case "brain":
      return <Brain size={13} />;
    default:
      return null;
  }
}

export default function ProjectViewTabsClient({
  projectId,
  activeView,
  initialTabOrder,
  preservedFilters,
  onViewSelect,
}: Props) {
  const router = useRouter();
  const [tabOrder, setTabOrder] = useState<ProjectTabKey[]>(() =>
    normalizeTabOrder(initialTabOrder)
  );
  const [dragKey, setDragKey] = useState<ProjectTabKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<ProjectTabKey | null>(null);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(6);
  const popoverRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [pendingView, setPendingView] = useState<ProjectTabKey | null>(null);

  // When activeView updates from server props, clear pendingView immediately without artificial delay
  useEffect(() => {
    setPendingView(null);
  }, [activeView]);

  // Failsafe & error cleanup
  useEffect(() => {
    if (!pendingView) return;
    const handleDone = () => setPendingView(null);
    window.addEventListener("orbitwork-nav-done", handleDone);
    window.addEventListener("orbitwork-nav-error", handleDone);
    const timer = setTimeout(() => setPendingView(null), 7000);
    return () => {
      window.removeEventListener("orbitwork-nav-done", handleDone);
      window.removeEventListener("orbitwork-nav-error", handleDone);
      clearTimeout(timer);
    };
  }, [pendingView]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setTabOrder(normalizeTabOrder(initialTabOrder));
  }, [initialTabOrder]);

  const toggleMore = () => {
    if (!moreOpen && moreRef.current) {
      const rect = moreRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + 5,
        left: Math.max(8, Math.min(window.innerWidth - 215, rect.left)),
      });
    }
    setMoreOpen((prev) => !prev);
  };

  // Close dropdown on scroll or window resize
  useEffect(() => {
    if (!moreOpen) return;
    const handleClose = () => setMoreOpen(false);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [moreOpen]);

  // Responsive visible tab count measured from actual container width (prevents overlapping right-side actions at any resolution)
  useEffect(() => {
    const el = popoverRef.current;
    const computeCount = () => {
      if (typeof window === "undefined") return;
      const containerW = el?.getBoundingClientRect().width || window.innerWidth - 360;
      // Reserve ~195px for "More >" and "Arrange tabs" controls; each tab averages ~106px
      const usable = Math.max(0, containerW - 195);
      const fit = Math.floor(usable / 106);
      setVisibleCount(Math.max(1, Math.min(tabOrder.length, fit)));
    };
    computeCount();
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(computeCount) : null;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", computeCount);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", computeCount);
    };
  }, [tabOrder.length]);

  useEffect(() => {
    if (!customizerOpen && !moreOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (customizerOpen && popoverRef.current && !popoverRef.current.contains(target)) {
        setCustomizerOpen(false);
      }
      if (moreOpen) {
        if (moreRef.current && moreRef.current.contains(target)) return;
        if (target.closest?.(".view-tabs-more-menu")) return;
        setMoreOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCustomizerOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [customizerOpen, moreOpen]);

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

  const visibleTabs = tabOrder.slice(0, visibleCount);
  const overflowTabs = tabOrder.slice(visibleCount);
  const isOverflowActive = overflowTabs.includes(activeView);
  const isOverflowPending = Boolean(pendingView && overflowTabs.includes(pendingView));

  return (
    <div className="view-tabs-customizable" ref={popoverRef}>
      <div className="view-tabs-strip">
        {visibleTabs.map((key) => {
          const isSelected = activeView === key;
          const isPending = pendingView === key;
          const isDropTarget = dragOverKey === key && dragKey !== key;
          return (
            <Link
              key={key}
              href={buildViewHref(key)}
              prefetch={true}
              draggable
              data-no-progress="true"
              onClick={(e) => {
                if (key === activeView) {
                  e.preventDefault();
                  return;
                }
                if (onViewSelect) {
                  e.preventDefault();
                  setPendingView(null);
                  onViewSelect(key);
                  return;
                }
                if (pendingView === key) {
                  e.preventDefault();
                  return;
                }
                setPendingView(key);
              }}
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
              className={`${isSelected ? "selected" : ""}${isPending ? " is-pending-tab" : ""}${
                isDropTarget ? " is-tab-drop-target" : ""
              }`}
              title={isPending ? `Loading ${PROJECT_TAB_LABELS[key]} view...` : `Open ${PROJECT_TAB_LABELS[key]} view (drag to reorder tabs)`}
              aria-busy={isPending}
            >
              {renderTabIcon(key, isSelected, isPending)}
              <span>{PROJECT_TAB_LABELS[key]}</span>
            </Link>
          );
        })}

        {overflowTabs.length > 0 && (
          <div className="view-tabs-more-wrap" ref={moreRef} style={{ position: "relative" }}>
            <button
              type="button"
              className={`view-tabs-more-btn${isOverflowActive ? " selected" : ""}${isOverflowPending ? " is-pending-tab" : ""}${moreOpen ? " is-open" : ""}`}
              onClick={toggleMore}
              title={
                isOverflowPending
                  ? `Loading ${PROJECT_TAB_LABELS[pendingView!]}...`
                  : isOverflowActive
                  ? `Active: ${PROJECT_TAB_LABELS[activeView]} (Click to show remaining tabs)`
                  : "Show remaining tabs"
              }
              aria-expanded={moreOpen}
              aria-label="Show remaining tabs"
              aria-busy={isOverflowPending}
            >
              {isOverflowPending ? (
                <>
                  <Loader2 size={13} className="spin tab-loading-spinner" />
                  <span>Loading {PROJECT_TAB_LABELS[pendingView!]}...</span>
                  <ChevronRight size={13} className={`view-tabs-chevron-icon${moreOpen ? " is-rotated" : ""}`} />
                </>
              ) : isOverflowActive ? (
                <>
                  {renderTabIcon(activeView, true)}
                  <span>{PROJECT_TAB_LABELS[activeView]}</span>
                  <ChevronRight size={13} className={`view-tabs-chevron-icon${moreOpen ? " is-rotated" : ""}`} />
                </>
              ) : (
                <>
                  <span>More</span>
                  <ChevronRight size={13} className={`view-tabs-chevron-icon${moreOpen ? " is-rotated" : ""}`} />
                </>
              )}
            </button>

            {moreOpen && menuCoords && mounted && typeof document !== "undefined" && createPortal(
              <div
                className="view-tabs-more-menu"
                role="menu"
                aria-label="Remaining project tabs"
                style={{
                  position: "fixed",
                  top: `${menuCoords.top}px`,
                  left: `${menuCoords.left}px`,
                  zIndex: 800,
                  minWidth: 200,
                  boxShadow: "0 18px 45px rgba(0,0,0,0.32)",
                }}
              >
                <div className="view-tabs-more-menu-header">
                  <span>Remaining Tabs ({overflowTabs.length})</span>
                </div>
                {overflowTabs.map((key) => {
                  const isSelected = activeView === key;
                  const isPending = pendingView === key;
                  return (
                    <Link
                      key={key}
                      href={buildViewHref(key)}
                      prefetch={true}
                      data-no-progress="true"
                      onClick={(e) => {
                        setMoreOpen(false);
                        if (key === activeView) {
                          e.preventDefault();
                          return;
                        }
                        if (onViewSelect) {
                          e.preventDefault();
                          setPendingView(null);
                          onViewSelect(key);
                          return;
                        }
                        if (pendingView === key) {
                          e.preventDefault();
                          return;
                        }
                        setPendingView(key);
                      }}
                      className={`view-tabs-more-item${isSelected ? " selected" : ""}${isPending ? " is-pending-tab" : ""}`}
                      role="menuitem"
                      aria-busy={isPending}
                    >
                      {renderTabIcon(key, isSelected, isPending)}
                      <span>{PROJECT_TAB_LABELS[key]}</span>
                      {isSelected && <span className="view-tabs-active-dot" />}
                    </Link>
                  );
                })}
              </div>,
              document.body
            )}
          </div>
        )}

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
                  {renderTabIcon(key, false)}
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
