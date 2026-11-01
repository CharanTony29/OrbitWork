"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";

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
  tasks: SearchTask[];
  documents: SearchDocument[];
  discussions: SearchDiscussion[];
};

export default function GlobalSearchModal({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "tasks" | "documents" | "discussions">("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    tasks: [],
    documents: [],
    discussions: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({ tasks: [], documents: [], discussions: [] });
    }
  }, [open]);

  // Fetch search results debounced
  const performSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || q.trim().length < 2) {
        setResults({ tasks: [], documents: [], discussions: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
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
    }, 280);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const totalResults =
    results.tasks.length + results.documents.length + results.discussions.length;

  const navigateTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Sidebar search trigger button */}
      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search workspace"
      >
        <Search size={13} />
        <span className="global-search-trigger-text">Search workspace...</span>
        <kbd className="global-search-kbd">⌘K</kbd>
      </button>

      {/* Global Search Dialog Modal */}
      {open && (
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
                    ? `Search tasks, documents, discussions in ${workspaceName}...`
                    : "Search tasks, documents, discussions..."
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
                Documents
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
                  <p>Type to search across all tasks, documents, and discussions in this workspace.</p>
                  <div className="global-search-hints">
                    <span><CheckSquare size={13} /> Tasks by title, ID, or description</span>
                    <span><FileText size={13} /> Documents by title or content</span>
                    <span><MessageSquare size={13} /> Discussions by comment content</span>
                  </div>
                </div>
              )}

              {query.trim().length >= 2 && !loading && totalResults === 0 && (
                <div className="global-search-empty">
                  <p>No results found for &ldquo;<strong>{query}</strong>&rdquo;</p>
                  <small>Try checking your spelling or searching with broader keywords.</small>
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
              <span>Navigate with <strong>↑</strong> <strong>↓</strong></span>
              <span>Select with <strong>↵</strong></span>
              <span>Close with <strong>ESC</strong></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
