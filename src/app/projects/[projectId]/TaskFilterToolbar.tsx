"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
} from "lucide-react";
import UniversalCreateModal from "@/app/UniversalCreateModal";

type WorkflowStatus = { id: string; name: string; color: string; category?: string };
type Member = { id: string; label: string };

export default function TaskFilterToolbar({
  projectId,
  projectName = "OrbitWork Application",
  statuses,
  members,
  currentFilters,
}: {
  projectId: string;
  projectName?: string;
  statuses: WorkflowStatus[];
  members: Member[];
  currentFilters: {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    sort?: string;
    view?: string;
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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [isUniversalCreateOpen, setIsUniversalCreateOpen] = useState(false);

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
    router.push(`${pathname}?${params.toString()}`);
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
    router.push(`${pathname}?${params.toString()}`);
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
        {/* Group: Status pill (ClickUp style) */}
        <div className="toolbar-popover-wrap" ref={groupRef}>
          <button
            type="button"
            className="toolbar-pill toolbar-pill-highlighted"
            onClick={() => setGroupMenuOpen((v) => !v)}
            aria-expanded={groupMenuOpen}
          >
            <Layers size={13} className="pill-icon" />
            <span>Group: Status</span>
            <ChevronDown size={11} className="pill-chevron" />
          </button>
          {groupMenuOpen && (
            <div className="toolbar-dropdown">
              <span className="toolbar-dropdown-title">Grouping</span>
              <button
                type="button"
                className="toolbar-dropdown-item is-active"
                onClick={() => setGroupMenuOpen(false)}
              >
                <Layers size={13} /> Status
              </button>
              <button
                type="button"
                className="toolbar-dropdown-item"
                onClick={() => {
                  updateParam("sort", "due");
                  setGroupMenuOpen(false);
                }}
              >
                Due date
              </button>
              <button
                type="button"
                className="toolbar-dropdown-item"
                onClick={() => {
                  updateParam("priority", "urgent");
                  setGroupMenuOpen(false);
                }}
              >
                Priority
              </button>
            </div>
          )}
        </div>

        {/* Subtasks pill */}
        <button type="button" className="toolbar-pill" title="Subtasks">
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
                aria-label="Clear"
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
    </div>
  );
}
