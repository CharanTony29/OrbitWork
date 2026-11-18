"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Inbox as InboxIcon,
  Activity,
  Clock,
  CheckCheck,
  ListFilter,
  User,
  FolderKanban,
  RotateCcw,
  Circle,
  CheckCircle2,
  ExternalLink,
  CalendarClock,
} from "lucide-react";
import { showAppConfirm, showAppToast } from "@/lib/app-feedback";

export type InboxBucket = "primary" | "other" | "later" | "cleared";

export type InboxItemKind = "assignment" | "mention" | "activity" | "leave" | "overdue";

export interface InboxRowItem {
  itemKey: string;
  defaultBucket: "primary" | "other";
  bucket: InboxBucket;
  isRead: boolean;
  kind: InboxItemKind;
  title: string;
  actorName: string;
  summaryText: string;
  href: string | null;
  projectName: string | null;
  statusColor: string | null;
  statusName: string | null;
  priority: string | null;
  isOverdue: boolean;
  eventCount: number;
  createdAt: string;
  notificationIds: string[];
}

const LOCAL_STORAGE_KEY = "orbitwork_inbox_overrides_v1";

type LocalOverrideMap = Record<string, { bucket?: InboxBucket; isRead?: boolean }>;

function getTimeBucketLabel(isoDate: string): "Today" | "This week" | "Earlier this month" | "Older" {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "Older";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ts = d.getTime();
  if (ts >= startOfToday) return "Today";
  if (ts >= startOfToday - 6 * 86400_000) return "This week";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
    return "Earlier this month";
  }
  return "Older";
}

function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function InboxClient({
  initialItems,
}: {
  initialItems: InboxRowItem[];
}) {
  const [items, setItems] = useState<InboxRowItem[]>(initialItems);
  const [activeTab, setActiveTab] = useState<InboxBucket>("primary");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | InboxItemKind>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  // Merge any localStorage fallback overrides (in case DB migration hasn't run yet)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;
      const overrides = JSON.parse(raw) as LocalOverrideMap;
      if (!overrides || typeof overrides !== "object") return;
      setItems((prev) =>
        prev.map((item) => {
          const ov = overrides[item.itemKey];
          if (!ov) return item;
          return {
            ...item,
            bucket: ov.bucket ?? item.bucket,
            isRead: typeof ov.isRead === "boolean" ? ov.isRead : item.isRead,
          };
        })
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  function saveLocalOverrides(updates: Record<string, { bucket?: InboxBucket; isRead?: boolean }>) {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      const current: LocalOverrideMap = raw ? JSON.parse(raw) : {};
      for (const [k, v] of Object.entries(updates)) {
        current[k] = { ...current[k], ...v };
      }
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // ignore
    }
  }

  async function persistState(payload: {
    action: "set_bucket" | "set_read" | "clear_all" | "mark_all_read";
    itemKeys?: string[];
    notificationIds?: string[];
    bucket?: InboxBucket;
    isRead?: boolean;
  }) {
    try {
      await fetch("/api/inbox/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // local state + localStorage already updated
    }
  }

  function moveItem(item: InboxRowItem, targetBucket: InboxBucket) {
    const nextRead = targetBucket === "cleared" ? true : item.isRead;
    setItems((prev) =>
      prev.map((row) =>
        row.itemKey === item.itemKey ? { ...row, bucket: targetBucket, isRead: nextRead } : row
      )
    );
    saveLocalOverrides({ [item.itemKey]: { bucket: targetBucket, isRead: nextRead } });
    void persistState({
      action: "set_bucket",
      itemKeys: [item.itemKey],
      notificationIds: item.notificationIds,
      bucket: targetBucket,
    });
    if (targetBucket === "later") {
      showAppToast("Moved to Later", "info");
    } else if (targetBucket === "cleared") {
      showAppToast("Item cleared", "success");
    } else {
      showAppToast("Restored to inbox", "info");
    }
  }

  function toggleRead(item: InboxRowItem, forceRead?: boolean) {
    const nextRead = typeof forceRead === "boolean" ? forceRead : !item.isRead;
    if (item.isRead === nextRead) return;
    setItems((prev) =>
      prev.map((row) => (row.itemKey === item.itemKey ? { ...row, isRead: nextRead } : row))
    );
    saveLocalOverrides({ [item.itemKey]: { isRead: nextRead } });
    void persistState({
      action: "set_read",
      itemKeys: [item.itemKey],
      notificationIds: item.notificationIds,
      isRead: nextRead,
    });
  }

  async function handleClearAllVisible() {
    const targets = items.filter((item) => item.bucket === activeTab && activeTab !== "cleared");
    if (targets.length === 0) return;

    const ok = await showAppConfirm({
      title: `Clear ${targets.length} ${targets.length === 1 ? "item" : "items"}?`,
      message: `Move all items in "${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}" to Cleared and mark them as read?`,
      confirmLabel: "Clear all",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setBusy(true);
    const keySet = new Set(targets.map((t) => t.itemKey));
    const allNotifIds = targets.flatMap((t) => t.notificationIds);
    const overridePatch: LocalOverrideMap = {};
    for (const t of targets) {
      overridePatch[t.itemKey] = { bucket: "cleared", isRead: true };
    }

    setItems((prev) =>
      prev.map((row) => (keySet.has(row.itemKey) ? { ...row, bucket: "cleared", isRead: true } : row))
    );
    saveLocalOverrides(overridePatch);
    await persistState({
      action: "clear_all",
      itemKeys: [...keySet],
      notificationIds: allNotifIds,
    });
    setBusy(false);
    showAppToast(`Cleared ${targets.length} inbox ${targets.length === 1 ? "item" : "items"}.`, "success");
  }

  async function handleMarkTabRead() {
    const unreadTargets = items.filter((item) => item.bucket === activeTab && !item.isRead);
    if (unreadTargets.length === 0) return;
    setBusy(true);
    const keySet = new Set(unreadTargets.map((t) => t.itemKey));
    const allNotifIds = unreadTargets.flatMap((t) => t.notificationIds);
    const overridePatch: LocalOverrideMap = {};
    for (const t of unreadTargets) {
      overridePatch[t.itemKey] = { isRead: true };
    }
    setItems((prev) => prev.map((row) => (keySet.has(row.itemKey) ? { ...row, isRead: true } : row)));
    saveLocalOverrides(overridePatch);
    await persistState({
      action: "set_read",
      itemKeys: [...keySet],
      notificationIds: allNotifIds,
      isRead: true,
    });
    setBusy(false);
    showAppToast("Marked as read.", "success");
  }

  const projectNames = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.projectName) set.add(item.projectName);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const counts = useMemo(() => {
    let primaryUnread = 0;
    let primaryTotal = 0;
    let otherUnread = 0;
    let otherTotal = 0;
    let laterTotal = 0;
    let clearedTotal = 0;
    for (const item of items) {
      if (item.bucket === "primary") {
        primaryTotal += 1;
        if (!item.isRead) primaryUnread += 1;
      } else if (item.bucket === "other") {
        otherTotal += 1;
        if (!item.isRead) otherUnread += 1;
      } else if (item.bucket === "later") {
        laterTotal += 1;
      } else if (item.bucket === "cleared") {
        clearedTotal += 1;
      }
    }
    return { primaryUnread, primaryTotal, otherUnread, otherTotal, laterTotal, clearedTotal };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => item.bucket === activeTab)
      .filter((item) => (kindFilter === "all" ? true : item.kind === kindFilter))
      .filter((item) => (projectFilter === "all" ? true : item.projectName === projectFilter))
      .filter((item) => (unreadOnly ? !item.isRead : true))
      .filter((item) => {
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.actorName.toLowerCase().includes(q) ||
          item.summaryText.toLowerCase().includes(q) ||
          (item.projectName ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, activeTab, kindFilter, projectFilter, unreadOnly, searchQuery]);

  const groupedByTime = useMemo(() => {
    const order: Array<"Today" | "This week" | "Earlier this month" | "Older"> = [
      "Today",
      "This week",
      "Earlier this month",
      "Older",
    ];
    const map = new Map<string, InboxRowItem[]>();
    for (const label of order) map.set(label, []);
    for (const item of filteredItems) {
      const label = getTimeBucketLabel(item.createdAt);
      map.get(label)!.push(item);
    }
    return order
      .map((label) => ({ label, rows: map.get(label) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [filteredItems]);

  const activeFilterCount =
    (kindFilter !== "all" ? 1 : 0) +
    (projectFilter !== "all" ? 1 : 0) +
    (unreadOnly ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const tabUnreadCount =
    activeTab === "primary"
      ? counts.primaryUnread
      : activeTab === "other"
      ? counts.otherUnread
      : items.filter((i) => i.bucket === activeTab && !i.isRead).length;

  return (
    <div className="ow-inbox-wrap">
      {/* Top 4-Tab Bar */}
      <div className="ow-inbox-tabs" role="tablist" aria-label="Inbox sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "primary"}
          className={`ow-inbox-tab${activeTab === "primary" ? " is-active" : ""}`}
          onClick={() => setActiveTab("primary")}
        >
          <span className="ow-inbox-tab-icon">
            <InboxIcon size={15} />
          </span>
          <span className="ow-inbox-tab-copy">
            <span className="ow-inbox-tab-title">Primary</span>
            <span className="ow-inbox-tab-sub">
              {counts.primaryUnread > 0
                ? `${counts.primaryUnread} unread`
                : `${counts.primaryTotal} items`}
            </span>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "other"}
          className={`ow-inbox-tab${activeTab === "other" ? " is-active" : ""}`}
          onClick={() => setActiveTab("other")}
        >
          <span className="ow-inbox-tab-icon">
            <Activity size={15} />
          </span>
          <span className="ow-inbox-tab-copy">
            <span className="ow-inbox-tab-title">Other</span>
            <span className="ow-inbox-tab-sub">
              {counts.otherUnread > 0
                ? `${counts.otherUnread} unread`
                : `${counts.otherTotal} items`}
            </span>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "later"}
          className={`ow-inbox-tab${activeTab === "later" ? " is-active" : ""}`}
          onClick={() => setActiveTab("later")}
        >
          <span className="ow-inbox-tab-icon">
            <Clock size={15} />
          </span>
          <span className="ow-inbox-tab-copy">
            <span className="ow-inbox-tab-title">Later</span>
            <span className="ow-inbox-tab-sub">{counts.laterTotal} snoozed</span>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "cleared"}
          className={`ow-inbox-tab${activeTab === "cleared" ? " is-active" : ""}`}
          onClick={() => setActiveTab("cleared")}
        >
          <span className="ow-inbox-tab-icon">
            <CheckCheck size={15} />
          </span>
          <span className="ow-inbox-tab-copy">
            <span className="ow-inbox-tab-title">Cleared</span>
            <span className="ow-inbox-tab-sub">{counts.clearedTotal} done</span>
          </span>
        </button>
      </div>

      {/* Toolbar Row */}
      <div className="ow-inbox-toolbar">
        <div className="ow-inbox-toolbar-left">
          <button
            type="button"
            className={`ow-inbox-pill-btn${showFilters || activeFilterCount > 0 ? " is-active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <ListFilter size={14} />
            <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              className="ow-inbox-pill-btn"
              onClick={() => {
                setKindFilter("all");
                setProjectFilter("all");
                setUnreadOnly(false);
                setSearchQuery("");
              }}
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="ow-inbox-toolbar-right">
          {tabUnreadCount > 0 && (
            <button
              type="button"
              className="ow-inbox-pill-btn"
              disabled={busy}
              onClick={handleMarkTabRead}
            >
              <CheckCircle2 size={14} />
              <span>Mark read</span>
            </button>
          )}
          {activeTab !== "cleared" && (
            <button
              type="button"
              className="ow-inbox-pill-btn"
              disabled={busy || filteredItems.length === 0}
              onClick={handleClearAllVisible}
            >
              <CheckCheck size={14} />
              <span>Clear all</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="ow-inbox-filter-panel">
          <input
            type="search"
            className="ow-inbox-filter-input"
            placeholder="Search tasks, teammates, or activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="ow-inbox-filter-select"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | InboxItemKind)}
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            <option value="assignment">Assigned to me</option>
            <option value="mention">Mentions &amp; comments</option>
            <option value="overdue">Overdue</option>
            <option value="leave">Leave requests</option>
            <option value="activity">Project activity</option>
          </select>
          {projectNames.length > 0 && (
            <select
              className="ow-inbox-filter-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filter by project"
            >
              <option value="all">All projects</option>
              {projectNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <label className="ow-inbox-filter-toggle">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            <span>Unread only</span>
          </label>
        </div>
      )}

      {/* Time-Grouped Rows */}
      {groupedByTime.length > 0 ? (
        groupedByTime.map((group) => (
          <section className="ow-inbox-group" key={group.label}>
            <h2 className="ow-inbox-group-label">{group.label}</h2>
            <div className="ow-inbox-rows">
              {group.rows.map((item) => (
                <article
                  key={item.itemKey}
                  className={`ow-inbox-row${item.isRead ? "" : " is-unread"}`}
                >
                  {/* Left: Status indicator + Title + Project */}
                  <div className="ow-inbox-row-left">
                    <span
                      className={`ow-inbox-status-ring${item.statusColor ? " is-solid" : ""}`}
                      style={
                        item.statusColor
                          ? { borderColor: item.statusColor, backgroundColor: `${item.statusColor}22` }
                          : undefined
                      }
                      title={item.statusName || item.kind}
                    />
                    <div className="ow-inbox-title-wrap">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="ow-inbox-title-link"
                          onClick={() => toggleRead(item, true)}
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span className="ow-inbox-title-link">{item.title}</span>
                      )}
                      {(item.projectName || item.isOverdue || item.kind === "leave") && (
                        <div className="ow-inbox-submeta">
                          {item.projectName && (
                            <span className="ow-inbox-project-chip">
                              <FolderKanban size={10} />
                              {item.projectName}
                            </span>
                          )}
                          {item.isOverdue && (
                            <span className="ow-inbox-overdue-chip">Overdue</span>
                          )}
                          {item.kind === "leave" && (
                            <span className="ow-inbox-project-chip">
                              <CalendarClock size={10} />
                              Leave Approval
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Actor + Action Summary */}
                  <div className="ow-inbox-row-mid">
                    <User size={13} className="ow-inbox-actor-icon" />
                    <span className="ow-inbox-summary-text">
                      <strong>{item.actorName}</strong> {item.summaryText}
                    </span>
                  </div>

                  {/* Right: Count circle + Short Date + Quick actions */}
                  <div className="ow-inbox-row-right">
                    <span
                      className="ow-inbox-count-circle"
                      title={`${item.eventCount} ${item.eventCount === 1 ? "update" : "updates"}`}
                    >
                      {item.eventCount}
                    </span>
                    <time className="ow-inbox-date" dateTime={item.createdAt}>
                      {formatShortDate(item.createdAt)}
                    </time>
                    <div className="ow-inbox-row-actions">
                      <button
                        type="button"
                        className="ow-inbox-icon-btn"
                        title={item.isRead ? "Mark as unread" : "Mark as read"}
                        onClick={() => toggleRead(item)}
                      >
                        {item.isRead ? (
                          <Circle size={13} />
                        ) : (
                          <Circle size={13} fill="var(--green, #167c58)" color="var(--green, #167c58)" />
                        )}
                      </button>
                      {item.bucket !== "later" && item.bucket !== "cleared" && (
                        <button
                          type="button"
                          className="ow-inbox-icon-btn"
                          title="Move to Later"
                          onClick={() => moveItem(item, "later")}
                        >
                          <Clock size={14} />
                        </button>
                      )}
                      {item.bucket !== "cleared" ? (
                        <button
                          type="button"
                          className="ow-inbox-icon-btn is-done"
                          title="Clear item"
                          onClick={() => moveItem(item, "cleared")}
                        >
                          <CheckCheck size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ow-inbox-icon-btn"
                          title="Restore to inbox"
                          onClick={() => moveItem(item, item.defaultBucket)}
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {item.bucket === "later" && (
                        <button
                          type="button"
                          className="ow-inbox-icon-btn"
                          title="Move back to inbox"
                          onClick={() => moveItem(item, item.defaultBucket)}
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {item.href && (
                        <Link
                          href={item.href}
                          className="ow-inbox-icon-btn"
                          title="Open item"
                          onClick={() => toggleRead(item, true)}
                        >
                          <ExternalLink size={13} />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="ow-inbox-empty">
          <InboxIcon size={28} style={{ color: "var(--muted)" }} />
          <h3>
            {activeTab === "cleared"
              ? "No cleared items yet"
              : activeTab === "later"
              ? "Nothing snoozed for later"
              : "You’re all caught up"}
          </h3>
          <p>
            {activeFilterCount > 0
              ? "Try clearing your active filters to see more inbox updates."
              : activeTab === "primary"
              ? "Tasks assigned to you, mentions, and approvals will show up here."
              : activeTab === "other"
              ? "General project updates and activity notifications will appear here."
              : activeTab === "later"
              ? "Use the clock button on any inbox row to snooze it for later."
              : "Items you clear will be archived here for reference."}
          </p>
        </div>
      )}
    </div>
  );
}
