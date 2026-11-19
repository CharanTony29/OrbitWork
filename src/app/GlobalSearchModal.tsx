"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { notifyNavigationStart } from "@/app/TopProgressBar";
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
  Lock,
  Paperclip,
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
  projectId?: string;
  projectName?: string;
  workspaceId?: string;
  workspaceName?: string;
  title: string;
  snippet: string;
  updatedAt: string;
  scope: "project" | "workspace" | "organization";
  isPrivate?: boolean;
  href: string;
  type: "document";
  isAttachment?: boolean;
  mimeType?: string;
  fileSizeBytes?: number;
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
  const [docScopeFilter, setDocScopeFilter] = useState<"all" | "project" | "workspace" | "organization">("all");
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
    notifyNavigationStart(href);
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

        {/* Document Sub-Scopes (Project / Workspace / Organization) */}
        {category === "documents" && results.documents.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 18px",
              borderBottom: "1px solid var(--line)",
              background: "var(--app-bg, #f7f9f7)",
              overflowX: "auto",
            }}
          >
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 9px",
                borderRadius: "6px",
                border: "1px solid " + (docScopeFilter === "all" ? "var(--green)" : "var(--line)"),
                background: docScopeFilter === "all" ? "rgba(16, 185, 129, 0.12)" : "var(--surface, #fff)",
                color: docScopeFilter === "all" ? "var(--green)" : "var(--muted)",
                fontSize: "11px",
                fontWeight: docScopeFilter === "all" ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => setDocScopeFilter("all")}
            >
              All Docs ({results.documents.length})
            </button>
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 9px",
                borderRadius: "6px",
                border: "1px solid " + (docScopeFilter === "project" ? "#0284c7" : "var(--line)"),
                background: docScopeFilter === "project" ? "rgba(2, 132, 199, 0.12)" : "var(--surface, #fff)",
                color: docScopeFilter === "project" ? "#0284c7" : "var(--muted)",
                fontSize: "11px",
                fontWeight: docScopeFilter === "project" ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => setDocScopeFilter("project")}
            >
              <FolderKanban size={11} /> Project Docs (
              {results.documents.filter((d) => d.scope === "project").length})
            </button>
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 9px",
                borderRadius: "6px",
                border: "1px solid " + (docScopeFilter === "workspace" ? "#059669" : "var(--line)"),
                background: docScopeFilter === "workspace" ? "rgba(5, 150, 105, 0.12)" : "var(--surface, #fff)",
                color: docScopeFilter === "workspace" ? "#059669" : "var(--muted)",
                fontSize: "11px",
                fontWeight: docScopeFilter === "workspace" ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => setDocScopeFilter("workspace")}
            >
              <FileText size={11} /> Workspace Docs (
              {results.documents.filter((d) => d.scope === "workspace").length})
            </button>
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 9px",
                borderRadius: "6px",
                border: "1px solid " + (docScopeFilter === "organization" ? "#7e22ce" : "var(--line)"),
                background: docScopeFilter === "organization" ? "rgba(126, 34, 206, 0.12)" : "var(--surface, #fff)",
                color: docScopeFilter === "organization" ? "#7e22ce" : "var(--muted)",
                fontSize: "11px",
                fontWeight: docScopeFilter === "organization" ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => setDocScopeFilter("organization")}
            >
              <Building2 size={11} /> Org Docs (
              {results.documents.filter((d) => d.scope === "organization").length})
            </button>
          </div>
        )}

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
                <span className="group-count">
                  {category === "documents" && docScopeFilter !== "all"
                    ? results.documents.filter((d) => d.scope === docScopeFilter).length
                    : results.documents.length}
                </span>
              </div>
              {results.documents
                .filter((doc) => {
                  if (category !== "documents") return true;
                  if (docScopeFilter === "all") return true;
                  return doc.scope === docScopeFilter;
                })
                .map((doc) => {
                  const iconBg = doc.isAttachment
                    ? "#ecfdf5"
                    : doc.isPrivate
                    ? "#fef3c7"
                    : doc.scope === "organization"
                    ? "#f3e8ff"
                    : doc.scope === "workspace"
                    ? "#e0f2fe"
                    : "#e8effa";

                  const iconColor = doc.isAttachment
                    ? "#059669"
                    : doc.isPrivate
                    ? "#d97706"
                    : doc.scope === "organization"
                    ? "#7e22ce"
                    : doc.scope === "workspace"
                    ? "#0284c7"
                    : "#3567a5";

                  return (
                    <div
                      key={`${doc.scope}-${doc.id}`}
                      className="search-item"
                      onClick={() =>
                        navigateTo(
                          doc.href ||
                            (doc.projectId
                              ? `/projects/${doc.projectId}/documents/${doc.id}`
                              : `/workspaces/${doc.workspaceId}/docs/${doc.id}`)
                        )
                      }
                    >
                      <div className="search-item-icon" style={{ background: iconBg, color: iconColor }}>
                        {doc.isAttachment ? (
                          <Paperclip size={14} />
                        ) : doc.isPrivate ? (
                          <Lock size={14} />
                        ) : doc.scope === "organization" ? (
                          <Building2 size={14} />
                        ) : doc.scope === "workspace" ? (
                          <FileText size={14} />
                        ) : (
                          <FolderKanban size={14} />
                        )}
                      </div>
                      <div className="search-item-info">
                        <div className="search-item-header" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong className="search-item-title">{doc.title}</strong>
                          {doc.isPrivate && (
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 700,
                                color: "#b45309",
                                background: "#fef3c7",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                            >
                              <Lock size={9} /> Private
                            </span>
                          )}
                        </div>
                        {doc.snippet && (
                          <p className="search-item-snippet">{doc.snippet}</p>
                        )}
                      </div>
                      <span
                        className="search-item-project"
                        style={
                          doc.isAttachment
                            ? { background: "#ecfdf5", color: "#047857" }
                            : doc.scope === "organization"
                            ? { background: "#f3e8ff", color: "#7e22ce" }
                            : doc.scope === "workspace"
                            ? { background: "#e0f2fe", color: "#0369a1" }
                            : undefined
                        }
                      >
                        {doc.isAttachment ? (
                          <>
                            <Paperclip size={11} /> Attachment: {doc.projectName || "Project"}
                          </>
                        ) : doc.scope === "organization" ? (
                          <>
                            <Building2 size={11} /> Org Doc
                          </>
                        ) : doc.scope === "workspace" ? (
                          <>
                            <FileText size={11} /> Workspace: {doc.workspaceName || "Workspace"}
                          </>
                        ) : (
                          <>
                            <FolderKanban size={11} /> Project: {doc.projectName || "Project"}
                          </>
                        )}
                      </span>
                      <ArrowRight size={13} className="search-item-arrow" />
                    </div>
                  );
                })}
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
