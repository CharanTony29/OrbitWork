"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  CheckSquare,
  FileText,
  MessageSquare,
  ArrowRight,
  Loader2,
  FolderKanban,
  Building2,
} from "lucide-react";

type SearchWorkspace = {
  id: string;
  name: string;
  description: string;
  type: "workspace";
};

type SearchProject = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: "project";
};

type SearchTask = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  generatedKey: string;
  description: string;
  type: "task";
};

type SearchDocument = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  snippet: string;
  updatedAt: string;
  type: "document";
};

type SearchDiscussion = {
  id: string;
  projectId: string;
  taskId: string;
  projectName: string;
  taskTitle: string;
  taskKey: string;
  bodySnippet: string;
  createdAt: string;
  type: "discussion";
};

type SearchResults = {
  workspaces: SearchWorkspace[];
  projects: SearchProject[];
  tasks: SearchTask[];
  documents: SearchDocument[];
  discussions: SearchDiscussion[];
};

const searchHosts: Array<{ id: string; priority: number }> = [];

function registerSearchHost(id: string, priority: number) {
  searchHosts.push({ id, priority });
  return () => {
    const idx = searchHosts.findIndex((h) => h.id === id);
    if (idx !== -1) searchHosts.splice(idx, 1);
  };
}

function isPrimarySearchHost(id: string): boolean {
  if (searchHosts.length === 0) return true;
  let best = searchHosts[0];
  for (const h of searchHosts) {
    if (h.priority > best.priority) best = h;
  }
  return best.id === id;
}

export default function GlobalSearchModal({
  workspaceId,
  workspaceName,
  variant = "sidebar",
}: {
  workspaceId?: string;
  workspaceName?: string;
  variant?: "sidebar" | "topbar" | "hidden";
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "workspaces" | "projects" | "tasks" | "documents" | "discussions">("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    workspaces: [],
    projects: [],
    tasks: [],
    documents: [],
    discussions: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const instanceIdRef = useRef(`search-${Math.random().toString(36).slice(2)}`);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const priority = variant === "topbar" ? 2 : 1;
    return registerSearchHost(instanceIdRef.current, priority);
  }, [variant]);

  // Listen for Cmd+K / Ctrl+K, custom open event, and Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (!isPrimarySearchHost(instanceIdRef.current)) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function handleOpenEvent() {
      if (!isPrimarySearchHost(instanceIdRef.current)) return;
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("orbitwork:open-search", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("orbitwork:open-search", handleOpenEvent);
    };
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({ workspaces: [], projects: [], tasks: [], documents: [], discussions: [] });
    }
  }, [open]);

  // Fetch search results debounced
  const performSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || q.trim().length < 2) {
        setResults({ workspaces: [], projects: [], tasks: [], documents: [], discussions: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const endpoint = workspaceId
          ? `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q.trim())}`
          : `/api/search?q=${encodeURIComponent(q.trim())}`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setResults({
            workspaces: data.workspaces ?? [],
            projects: data.projects ?? [],
            tasks: data.tasks ?? [],
            documents: data.documents ?? [],
            discussions: data.discussions ?? [],
          });
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const totalResults =
    results.workspaces.length +
    results.projects.length +
    results.tasks.length +
    results.documents.length +
    results.discussions.length;

  const navigateTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const modalDialog = (
    <div
      className="global-search-backdrop"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="global-search-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="global-search-input-wrap">
          <Search size={18} className="global-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder={
              workspaceName
                ? `Search workspaces, projects, tasks, docs in ${workspaceName}...`
                : "Search workspaces, projects, tasks, docs..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 size={16} className="global-search-spinner animate-spin" />}
          {query && !loading && (
            <button
              type="button"
              className="global-search-clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear query"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className="global-search-close-btn"
            onClick={() => setOpen(false)}
            aria-label="Close search"
          >
            ESC
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="global-search-tabs">
          <button
            type="button"
            className={`global-search-tab${category === "all" ? " is-active" : ""}`}
            onClick={() => setCategory("all")}
          >
            All
            {query.length >= 2 && (
              <span className="tab-count">{totalResults}</span>
            )}
          </button>
          <button
            type="button"
            className={`global-search-tab${category === "workspaces" ? " is-active" : ""}`}
            onClick={() => setCategory("workspaces")}
          >
            <Building2 size={12} />
            Workspaces
            {query.length >= 2 && (
              <span className="tab-count">{results.workspaces.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`global-search-tab${category === "projects" ? " is-active" : ""}`}
            onClick={() => setCategory("projects")}
          >
            <FolderKanban size={12} />
            Projects
            {query.length >= 2 && (
              <span className="tab-count">{results.projects.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`global-search-tab${category === "tasks" ? " is-active" : ""}`}
            onClick={() => setCategory("tasks")}
          >
            <CheckSquare size={12} />
            Tasks
            {query.length >= 2 && (
              <span className="tab-count">{results.tasks.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`global-search-tab${category === "documents" ? " is-active" : ""}`}
            onClick={() => setCategory("documents")}
          >
            <FileText size={12} />
            Docs
            {query.length >= 2 && (
              <span className="tab-count">{results.documents.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`global-search-tab${category === "discussions" ? " is-active" : ""}`}
            onClick={() => setCategory("discussions")}
          >
            <MessageSquare size={12} />
            Discussions
            {query.length >= 2 && (
              <span className="tab-count">{results.discussions.length}</span>
            )}
          </button>
        </div>

        {/* Results Area */}
        <div className="global-search-results">
          {!query.trim() && (
            <div className="global-search-prompt">
              <p>Type to search workspaces, projects, tasks, documents, and discussions.</p>
              <div className="global-search-hints">
                <span><Building2 size={13} /> Workspaces by name</span>
                <span><FolderKanban size={13} /> Projects by name or description</span>
                <span><CheckSquare size={13} /> Tasks by title or key</span>
                <span><FileText size={13} /> Documents by title</span>
              </div>
            </div>
          )}

          {query.trim().length >= 2 && !loading && totalResults === 0 && (
            <div className="global-search-empty">
              <p>No results found for &ldquo;<strong>{query}</strong>&rdquo;</p>
              <small>Try checking your spelling or searching with broader keywords.</small>
            </div>
          )}

          {/* Workspaces List */}
          {(category === "all" || category === "workspaces") && results.workspaces.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">
                <Building2 size={13} />
                <span>Workspaces</span>
                <span className="group-count">{results.workspaces.length}</span>
              </div>
              {results.workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="search-item"
                  onClick={() => navigateTo(`/workspaces/${ws.id}`)}
                >
                  <div className="search-item-icon" style={{ background: "#e8f4ed", color: "var(--green)" }}>
                    <Building2 size={14} />
                  </div>
                  <div className="search-item-info">
                    <strong className="search-item-title">{ws.name}</strong>
                    {ws.description && (
                      <p className="search-item-snippet">{ws.description}</p>
                    )}
                  </div>
                  <span className="search-item-project">Workspace</span>
                  <ArrowRight size={13} className="search-item-arrow" />
                </div>
              ))}
            </div>
          )}

          {/* Projects List */}
          {(category === "all" || category === "projects") && results.projects.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">
                <FolderKanban size={13} />
                <span>Projects</span>
                <span className="group-count">{results.projects.length}</span>
              </div>
              {results.projects.map((proj) => (
                <div
                  key={proj.id}
                  className="search-item"
                  onClick={() => navigateTo(`/projects/${proj.id}`)}
                >
                  <div className="search-item-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                    <FolderKanban size={14} />
                  </div>
                  <div className="search-item-info">
                    <strong className="search-item-title">{proj.name}</strong>
                    {proj.description && (
                      <p className="search-item-snippet">{proj.description}</p>
                    )}
                  </div>
                  <span className="search-item-project">Project</span>
                  <ArrowRight size={13} className="search-item-arrow" />
                </div>
              ))}
            </div>
          )}

          {/* Tasks List */}
          {(category === "all" || category === "tasks") && results.tasks.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">
                <CheckSquare size={13} />
                <span>Tasks</span>
                <span className="group-count">{results.tasks.length}</span>
              </div>
              {results.tasks.map((task) => (
                <div
                  key={task.id}
                  className="search-item"
                  onClick={() => navigateTo(`/projects/${task.projectId}/tasks/${task.id}`)}
                >
                  <div className="search-item-icon task-icon">
                    <CheckSquare size={14} />
                  </div>
                  <div className="search-item-info">
                    <div className="search-item-header">
                      <span className="search-item-key">{task.generatedKey}</span>
                      <strong className="search-item-title">{task.title}</strong>
                    </div>
                    {task.description && (
                      <p className="search-item-snippet">{task.description}</p>
                    )}
                  </div>
                  <span className="search-item-project">
                    <FolderKanban size={11} />
                    {task.projectName}
                  </span>
                  <ArrowRight size={13} className="search-item-arrow" />
                </div>
              ))}
            </div>
          )}

          {/* Documents List */}
          {(category === "all" || category === "documents") && results.documents.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">
                <FileText size={13} />
                <span>Documents</span>
                <span className="group-count">{results.documents.length}</span>
              </div>
              {results.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="search-item"
                  onClick={() => navigateTo(`/projects/${doc.projectId}/documents/${doc.id}`)}
                >
                  <div className="search-item-icon doc-icon">
                    <FileText size={14} />
                  </div>
                  <div className="search-item-info">
                    <strong className="search-item-title">{doc.title}</strong>
                    {doc.snippet && (
                      <p className="search-item-snippet">{doc.snippet}</p>
                    )}
                  </div>
                  <span className="search-item-project">
                    <FolderKanban size={11} />
                    {doc.projectName}
                  </span>
                  <ArrowRight size={13} className="search-item-arrow" />
                </div>
              ))}
            </div>
          )}

          {/* Discussions List */}
          {(category === "all" || category === "discussions") && results.discussions.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">
                <MessageSquare size={13} />
                <span>Discussions</span>
                <span className="group-count">{results.discussions.length}</span>
              </div>
              {results.discussions.map((disc) => (
                <div
                  key={disc.id}
                  className="search-item"
                  onClick={() =>
                    navigateTo(
                      `/projects/${disc.projectId}/tasks/${disc.taskId}#comment-${disc.id}`
                    )
                  }
                >
                  <div className="search-item-icon disc-icon">
                    <MessageSquare size={14} />
                  </div>
                  <div className="search-item-info">
                    <div className="search-item-header">
                      <span className="search-item-key">{disc.taskKey}</span>
                      <strong className="search-item-title">{disc.taskTitle}</strong>
                    </div>
                    <p className="search-item-snippet">&ldquo;{disc.bodySnippet}&rdquo;</p>
                  </div>
                  <span className="search-item-project">
                    <FolderKanban size={11} />
                    {disc.projectName}
                  </span>
                  <ArrowRight size={13} className="search-item-arrow" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with hints */}
        <div className="global-search-footer">
          <span>Search workspaces, projects, tasks &amp; docs</span>
          <span>Close with <strong>ESC</strong></span>
        </div>
      </div>
    </div>
  );

  const triggerOpen = () => {
    if (isPrimarySearchHost(instanceIdRef.current)) {
      setOpen(true);
    } else {
      window.dispatchEvent(new CustomEvent("orbitwork:open-search"));
    }
  };

  return (
    <>
      {variant === "topbar" ? (
        <button
          type="button"
          className="topbar-search-trigger"
          onClick={triggerOpen}
          aria-label={workspaceName ? `Search ${workspaceName}` : "Search everything"}
        >
          <Search size={15} className="topbar-search-icon" />
          <span className="topbar-search-placeholder">
            {workspaceName ? `Search ${workspaceName}, tasks, docs…` : "Search tasks, projects, docs, workspaces…"}
          </span>
          <kbd className="topbar-search-kbd">Ctrl + K</kbd>
        </button>
      ) : variant === "sidebar" ? (
        <button
          type="button"
          className="global-search-trigger"
          onClick={triggerOpen}
          aria-label="Search workspace"
        >
          <Search size={13} />
          <span className="global-search-trigger-text">Search workspace...</span>
          <kbd className="global-search-kbd">⌘K</kbd>
        </button>
      ) : null}

      {/* Global Search Dialog Modal mounted to document body via portal */}
      {open && mounted && createPortal(modalDialog, document.body)}
    </>
  );
}
