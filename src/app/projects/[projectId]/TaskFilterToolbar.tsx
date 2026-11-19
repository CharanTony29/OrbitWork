"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { notifyNavigationStart } from "@/app/TopProgressBar";
import {
  Layers,
  Filter,
  User,
  CheckCircle2,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Plus,
  Calendar,
  Flag,
  List,
  Tag,
  Palette,
  Sparkles,
  Bot,
} from "lucide-react";
import UniversalCreateModal from "@/app/UniversalCreateModal";
import CustomThemeStudioModal from "@/app/CustomThemeStudioModal";
import MoMToTasksModal from "./MoMToTasksModal";
import AIAssignModal from "./AIAssignModal";

type WorkflowStatus = { id: string; name: string; color: string; category?: string };
type Member = { id: string; label: string };
type CustomField = { id: string; name: string; field_type: string };

export default function TaskFilterToolbar({
  projectId,
  projectName = "OrbitWork Application",
  statuses,
  members,
  customFields = [],
  currentFilters,
}: {
  projectId: string;
  projectName?: string;
  statuses: WorkflowStatus[];
  members: Member[];
  customFields?: CustomField[];
  currentFilters: {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    sort?: string;
    view?: string;
    group?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchOpen, setSearchOpen] = useState(Boolean(currentFilters.q));
  const [searchValue, setSearchValue] = useState(currentFilters.q ?? "");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);
  const [customGroupValue, setCustomGroupValue] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [isUniversalCreateOpen, setIsUniversalCreateOpen] = useState(false);
  const [isMoMOpen, setIsMoMOpen] = useState(false);
  const [isAIAssignOpen, setIsAIAssignOpen] = useState(false);
  const [isThemeStudioOpen, setIsThemeStudioOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setAssigneeMenuOpen(false);
      }
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupMenuOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // reset pagination on filter change
    const href = `${pathname}?${params.toString()}`;
    notifyNavigationStart(href);
    router.push(href);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("q", searchValue.trim() || null);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    updateParam("q", null);
    setSearchOpen(false);
  };

  // Find completed status ID if any for the "Closed" pill toggle
  const completedStatus = statuses.find(
    (s) => s.category === "completed" || s.name.toLowerCase().includes("completed")
  );
  const isClosedFilterActive = currentFilters.status === completedStatus?.id;

  const toggleClosedFilter = () => {
    if (!completedStatus) return;
    if (isClosedFilterActive) {
      updateParam("status", null);
    } else {
      updateParam("status", completedStatus.id);
    }
  };

  // Active filter counting
  const hasPriorityFilter = Boolean(currentFilters.priority);
  const hasStatusFilter = Boolean(currentFilters.status && !isClosedFilterActive);
  const activeFilterCount = (hasPriorityFilter ? 1 : 0) + (hasStatusFilter ? 1 : 0);

  const selectedAssignee = members.find((m) => m.id === currentFilters.assignee);

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    if (currentFilters.view) params.set("view", currentFilters.view);
    const href = `${pathname}?${params.toString()}`;
    notifyNavigationStart(href);
    router.push(href);
  };

  const hasAnyFilter = Boolean(
    currentFilters.q ||
      currentFilters.status ||
      currentFilters.priority ||
      currentFilters.assignee ||
      (currentFilters.sort && currentFilters.sort !== "created")
  );

  return (
    <div className="task-toolbar-container">
      {/* Left side pills */}
      <div className="task-toolbar-left">
        {/* Grouping pill (ClickUp style matching Image 1 & Image 6) */}
        {(() => {
          const currentGroup = searchParams.get("group") || currentFilters.group || "status";
          const groupLabels: Record<string, string> = {
            status: "Status",
            priority: "Priority",
            due_date: "Due date",
            assignee: "Assignee",
            tags: "Tags",
            none: "None",
          };
          customFields.forEach((cf) => {
            groupLabels[`cf_${cf.id}`] = cf.name;
            groupLabels[cf.name.toLowerCase()] = cf.name;
          });

          const handleApplyCustomGroup = (val?: string) => {
            const target = (val || customGroupValue).trim().toLowerCase();
            if (!target) return;
            updateParam("group", target);
            setCustomGroupValue("");
            setShowAddGroupInput(false);
            setGroupMenuOpen(false);
          };

          return (
            <div className="toolbar-popover-wrap" ref={groupRef}>
              <button
                type="button"
                className="toolbar-pill toolbar-pill-highlighted"
                onClick={() => setGroupMenuOpen((v) => !v)}
                aria-expanded={groupMenuOpen}
              >
                <Layers size={13} className="pill-icon" />
                <span>Group: {groupLabels[currentGroup] || currentGroup.charAt(0).toUpperCase() + currentGroup.slice(1)}</span>
                <ChevronDown size={11} className="pill-chevron" />
              </button>
              {groupMenuOpen && (
                <div className="toolbar-dropdown" style={{ minWidth: 220 }}>
                  <span className="toolbar-dropdown-title">Grouping</span>
                  <button
                    type="button"
                    className={`toolbar-dropdown-item${currentGroup === "status" ? " is-active" : ""}`}
                    onClick={() => {
                      updateParam("group", "status");
                      setGroupMenuOpen(false);
                    }}
                  >
                    <Layers size={13} /> Status
                  </button>
                  <button
                    type="button"
                    className={`toolbar-dropdown-item${currentGroup === "due_date" ? " is-active" : ""}`}
                    onClick={() => {
                      updateParam("group", "due_date");
                      setGroupMenuOpen(false);
                    }}
                  >
                    <Calendar size={13} /> Due date
                  </button>
                  <button
                    type="button"
                    className={`toolbar-dropdown-item${currentGroup === "priority" ? " is-active" : ""}`}
                    onClick={() => {
                      updateParam("group", "priority");
                      setGroupMenuOpen(false);
                    }}
                  >
                    <Flag size={13} /> Priority
                  </button>
                  <button
                    type="button"
                    className={`toolbar-dropdown-item${currentGroup === "assignee" ? " is-active" : ""}`}
                    onClick={() => {
                      updateParam("group", "assignee");
                      setGroupMenuOpen(false);
                    }}
                  >
                    <User size={13} /> Assignee
                  </button>
                  <button
                    type="button"
                    className={`toolbar-dropdown-item${currentGroup === "tags" ? " is-active" : ""}`}
                    onClick={() => {
                      updateParam("group", "tags");
                      setGroupMenuOpen(false);
                    }}
                  >
                    <Tag size={13} /> Tags
                  </button>

                  {customFields.length > 0 && (
                    <>
                      <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
                      <span className="toolbar-dropdown-title" style={{ fontSize: 10 }}>Custom Fields</span>
                      {customFields.map((cf) => {
                        const cfKey = `cf_${cf.id}`;
                        return (
                          <button
                            key={cf.id}
                            type="button"
                            className={`toolbar-dropdown-item${currentGroup === cfKey ? " is-active" : ""}`}
                            onClick={() => {
                              updateParam("group", cfKey);
                              setGroupMenuOpen(false);
                            }}
                          >
                            <SlidersHorizontal size={12} /> {cf.name}
                          </button>
                        );
                      })}
                    </>
                  )}

                  <button
                    type="button"
                    className={`toolbar-dropdown-item${currentGroup === "none" ? " is-active" : ""}`}
                    onClick={() => {
                      updateParam("group", "none");
                      setGroupMenuOpen(false);
                    }}
                  >
                    <List size={13} /> None
                  </button>

                  <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />

                  {/* Add Grouping Property / Field with + Icon (Image 6 feature) */}
                  {!showAddGroupInput ? (
                    <button
                      type="button"
                      className="toolbar-dropdown-item"
                      onClick={() => setShowAddGroupInput(true)}
                      style={{ color: "var(--green)", fontWeight: 700, gap: 6 }}
                    >
                      <Plus size={13} />
                      <span>Add Grouping Property</span>
                    </button>
                  ) : (
                    <div style={{ padding: "6px 8px", display: "grid", gap: 6 }}>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Property / field name..."
                        value={customGroupValue}
                        onChange={(e) => setCustomGroupValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleApplyCustomGroup();
                          if (e.key === "Escape") setShowAddGroupInput(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--line)",
                          fontSize: 12,
                          background: "var(--surface)",
                          color: "var(--ink)",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => setShowAddGroupInput(false)}
                          style={{
                            padding: "3px 8px",
                            fontSize: 11,
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--muted)",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyCustomGroup()}
                          disabled={!customGroupValue.trim()}
                          style={{
                            padding: "3px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 4,
                            border: 0,
                            background: "var(--green)",
                            color: "#fff",
                            cursor: customGroupValue.trim() ? "pointer" : "not-allowed",
                            opacity: customGroupValue.trim() ? 1 : 0.6,
                          }}
                        >
                          Group
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Subtasks pill */}
        <button
          type="button"
          className="toolbar-pill"
          title="Expand / Collapse Subtasks"
          onClick={() => {
            const btn = document.querySelector(".expand-collapse-all-btn") as HTMLButtonElement | null;
            if (btn) btn.click();
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pill-icon"
          >
            <path d="M6 3v12" />
            <circle cx="6" cy="3" r="1.5" />
            <circle cx="6" cy="15" r="1.5" />
            <path d="M18 9a9 9 0 0 1-9 9H6" />
            <circle cx="18" cy="9" r="1.5" />
          </svg>
          <span>Subtasks</span>
        </button>

        {/* Search trigger or expanded input */}
        {searchOpen ? (
          <form className="toolbar-search-expanded" onSubmit={handleSearchSubmit}>
            <Search size={13} className="search-expand-icon" />
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              placeholder="Filter tasks..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onBlur={() => {
                if (!searchValue.trim()) setSearchOpen(false);
              }}
            />
            {searchValue && (
              <button
                type="button"
                className="toolbar-search-clear-btn"
                onClick={handleClearSearch}
                aria-label="Clear search input"
              >
                <X size={12} />
              </button>
            )}
          </form>
        ) : (
          <button
            type="button"
            className="toolbar-icon-pill"
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            title="Search tasks"
            aria-label="Search tasks"
          >
            <Search size={13} />
          </button>
        )}

        {/* Sort / Customize pill */}
        <div className="toolbar-popover-wrap" ref={sortRef}>
          <button
            type="button"
            className={`toolbar-pill${currentFilters.sort === "due" ? " is-active" : ""}`}
            onClick={() => setSortMenuOpen((v) => !v)}
            aria-expanded={sortMenuOpen}
          >
            <SlidersHorizontal size={13} className="pill-icon" />
            <span>Customize</span>
          </button>
          {sortMenuOpen && (
            <div className="toolbar-dropdown">
              <span className="toolbar-dropdown-title">Sort order</span>
              <button
                type="button"
                className={`toolbar-dropdown-item${currentFilters.sort !== "due" ? " is-active" : ""}`}
                onClick={() => {
                  updateParam("sort", "created");
                  setSortMenuOpen(false);
                }}
              >
                Recently created
              </button>
              <button
                type="button"
                className={`toolbar-dropdown-item${currentFilters.sort === "due" ? " is-active" : ""}`}
                onClick={() => {
                  updateParam("sort", "due");
                  setSortMenuOpen(false);
                }}
              >
                Due date
              </button>
              <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
              <button
                type="button"
                className="toolbar-dropdown-item"
                onClick={() => {
                  setIsThemeStudioOpen(true);
                  setSortMenuOpen(false);
                }}
              >
                <Palette size={13} style={{ marginRight: 6 }} />
                <span>Theme & UI Studio</span>
              </button>
            </div>
          )}
        </div>

        {/* Add Task Button (Opens ClickUp-style Universal Create Modal) */}
        <button
          type="button"
          className="toolbar-pill toolbar-pill-action"
          onClick={() => setIsUniversalCreateOpen(true)}
          title="Create a new task (ClickUp style)"
        >
          <span>Add Task</span>
          <ChevronDown size={12} />
        </button>

        {/* Convert Minutes of Meeting to Tasks */}
        <button
          type="button"
          className="toolbar-pill"
          onClick={() => setIsMoMOpen(true)}
          title="Convert Minutes of Meeting (MoM) to Tasks with AI duplicate check"
          style={{ color: "var(--green, #167c58)", fontWeight: 650 }}
        >
          <Sparkles size={13} className="pill-icon" />
          <span>MoM to Tasks</span>
        </button>

        {/* AI Auto-Assign unassigned tasks */}
        <button
          type="button"
          className="toolbar-pill"
          onClick={() => setIsAIAssignOpen(true)}
          title="AI Auto-Assign — Triages unassigned tasks to role-aligned teammates with lowest workload"
          style={{ color: "#7c3aed", fontWeight: 650 }}
        >
          <Bot size={13} className="pill-icon" />
          <span>AI Auto-Assign</span>
        </button>
      </div>

      {/* Right side pills */}
      <div className="task-toolbar-right">
        {/* Filter Popover Pill */}
        <div className="toolbar-popover-wrap" ref={filterRef}>
          <button
            type="button"
            className={`toolbar-pill${activeFilterCount > 0 ? " is-active" : ""}`}
            onClick={() => setFilterMenuOpen((v) => !v)}
            aria-expanded={filterMenuOpen}
          >
            <Filter size={13} className="pill-icon" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="pill-badge">{activeFilterCount}</span>
            )}
          </button>

          {filterMenuOpen && (
            <div className="toolbar-dropdown filter-dropdown">
              <div className="filter-dropdown-section">
                <span className="toolbar-dropdown-title">Status</span>
                <div className="filter-options-grid">
                  <button
                    type="button"
                    className={`filter-opt-btn${!currentFilters.status ? " is-selected" : ""}`}
                    onClick={() => {
                      updateParam("status", null);
                      setFilterMenuOpen(false);
                    }}
                  >
                    All statuses
                  </button>
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      className={`filter-opt-btn${currentFilters.status === status.id ? " is-selected" : ""}`}
                      onClick={() => {
                        updateParam("status", status.id);
                        setFilterMenuOpen(false);
                      }}
                    >
                      <i className="status-color" style={{ backgroundColor: status.color }} />
                      {status.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-dropdown-section">
                <span className="toolbar-dropdown-title">Priority</span>
                <div className="filter-options-grid">
                  <button
                    type="button"
                    className={`filter-opt-btn${!currentFilters.priority ? " is-selected" : ""}`}
                    onClick={() => {
                      updateParam("priority", null);
                      setFilterMenuOpen(false);
                    }}
                  >
                    All priorities
                  </button>
                  {["low", "normal", "high", "urgent"].map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      className={`filter-opt-btn priority-${priority}${currentFilters.priority === priority ? " is-selected" : ""}`}
                      onClick={() => {
                        updateParam("priority", priority);
                        setFilterMenuOpen(false);
                      }}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="filter-clear-link"
                  onClick={() => {
                    updateParam("status", null);
                    updateParam("priority", null);
                    setFilterMenuOpen(false);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Closed Pill Toggle */}
        <button
          type="button"
          className={`toolbar-pill${isClosedFilterActive ? " is-active" : ""}`}
          onClick={toggleClosedFilter}
          title={isClosedFilterActive ? "Showing only closed tasks (click to show all)" : "Show closed/completed tasks"}
        >
          <CheckCircle2 size={13} className="pill-icon" />
          <span>Closed</span>
        </button>

        {/* Assignee Popover Pill */}
        <div className="toolbar-popover-wrap" ref={assigneeRef}>
          <button
            type="button"
            className={`toolbar-pill${selectedAssignee ? " is-active" : ""}`}
            onClick={() => setAssigneeMenuOpen((v) => !v)}
            aria-expanded={assigneeMenuOpen}
          >
            <User size={13} className="pill-icon" />
            <span>{selectedAssignee ? selectedAssignee.label : "Assignee"}</span>
          </button>

          {assigneeMenuOpen && (
            <div className="toolbar-dropdown assignee-dropdown">
              <span className="toolbar-dropdown-title">Filter by assignee</span>
              <button
                type="button"
                className={`toolbar-dropdown-item${!currentFilters.assignee ? " is-active" : ""}`}
                onClick={() => {
                  updateParam("assignee", null);
                  setAssigneeMenuOpen(false);
                }}
              >
                Anyone
              </button>
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`toolbar-dropdown-item${currentFilters.assignee === member.id ? " is-active" : ""}`}
                  onClick={() => {
                    updateParam("assignee", member.id);
                    setAssigneeMenuOpen(false);
                  }}
                >
                  <span className="assignee-avatar">
                    {member.label.charAt(0).toUpperCase()}
                  </span>
                  <span>{member.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear all indicator */}
        {hasAnyFilter && (
          <button
            type="button"
            className="toolbar-clear-all"
            onClick={clearAllFilters}
            title="Reset all filters"
          >
            <X size={11} />
            <span>Reset</span>
          </button>
        )}
      </div>

      <UniversalCreateModal
        isOpen={isUniversalCreateOpen}
        onClose={() => setIsUniversalCreateOpen(false)}
        initialTab="task"
        projectId={projectId}
        projectName={projectName}
        statuses={statuses}
        members={members}
      />

      <MoMToTasksModal
        isOpen={isMoMOpen}
        onClose={() => setIsMoMOpen(false)}
        projectId={projectId}
        projectName={projectName}
      />

      <CustomThemeStudioModal
        isOpen={isThemeStudioOpen}
        onClose={() => setIsThemeStudioOpen(false)}
      />

      <AIAssignModal
        isOpen={isAIAssignOpen}
        onClose={() => setIsAIAssignOpen(false)}
        projectId={projectId}
        projectName={projectName}
        members={members}
      />
    </div>
  );
}
