"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  LayoutGrid,
  List,
  SortAsc,
  Star,
  Trash2,
  Archive,
  RefreshCw,
  Share2,
  Copy,
  FolderPlus,
  Shield,
  Lock,
  Globe,
  Upload,
  Sparkles,
  MoreVertical,
  Check,
  X,
  ExternalLink,
  Tag,
  Clock,
  User,
  AlertCircle,
} from "lucide-react";
import { DocItem } from "@/lib/docs/types";
import { DOC_TEMPLATES } from "@/lib/docs/templates";
import FavoriteButton from "@/app/FavoriteButton";

type FilterTab =
  | "all"
  | "mine"
  | "recent"
  | "favorites"
  | "shared"
  | "wikis"
  | "templates"
  | "archived"
  | "trash";

interface DocumentsHubProps {
  workspaceId: string;
  projectId?: string;
  workspaceName?: string;
  projectName?: string;
  organizationId?: string;
  initialDocs: DocItem[];
  currentUserId: string;
  favoriteDocIds: string[];
}

export default function DocumentsHub({
  workspaceId,
  projectId,
  workspaceName,
  projectName,
  organizationId,
  initialDocs,
  currentUserId,
  favoriteDocIds = [],
}: DocumentsHubProps) {
  const router = useRouter();

  const [docs, setDocs] = useState<DocItem[]>(initialDocs);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "created">("updated");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [shareDoc, setShareDoc] = useState<DocItem | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("📄");
  const [newIsWiki, setNewIsWiki] = useState(false);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // File import ref
  const importFileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Collect all unique tags across docs
  const allTags = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => d.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [docs]);

  // Filter & sort docs
  const filteredDocs = useMemo(() => {
    return docs
      .filter((doc) => {
        // Trash tab
        if (activeTab === "trash") {
          if (!doc.deleted_at) return false;
        } else {
          if (doc.deleted_at) return false;

          // Archived tab
          if (activeTab === "archived") {
            if (!doc.is_archived) return false;
          } else {
            if (doc.is_archived) return false;

            if (activeTab === "mine" && doc.created_by !== currentUserId) return false;
            if (activeTab === "favorites" && !doc.is_favorited && !favoriteDocIds.includes(doc.id))
              return false;
            if (activeTab === "wikis" && !doc.is_wiki) return false;
            if (activeTab === "templates" && !doc.is_template) return false;
          }
        }

        // Tag filter
        if (selectedTag !== "all" && !doc.tags?.includes(selectedTag)) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = doc.title.toLowerCase().includes(q);
          const matchDesc = doc.description.toLowerCase().includes(q);
          const matchTags = doc.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchTags) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "created") return Date.parse(b.created_at) - Date.parse(a.created_at);
        return Date.parse(b.updated_at) - Date.parse(a.updated_at);
      });
  }, [docs, activeTab, selectedTag, searchQuery, sortBy, currentUserId, favoriteDocIds]);

  // Bulk selection toggles
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocs.map((d) => d.id)));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Document actions
  const getDocHref = (doc: DocItem) => {
    if (projectId) return `/projects/${projectId}/documents/${doc.id}`;
    if (doc.project_id) return `/projects/${doc.project_id}/documents/${doc.id}`;
    return `/workspaces/${workspaceId}/docs/${doc.id}`;
  };

  const handleCreateDoc = async (templateId?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim() || (templateId ? undefined : "Untitled Document"),
          icon: newIcon,
          isWiki: newIsWiki,
          isPrivate: newIsPrivate,
          templateId,
          projectId: projectId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create document");

      showToast("Document created successfully");
      setShowCreateModal(false);
      setShowTemplateModal(false);
      setNewTitle("");

      // Open new document in editor
      if (data.doc?.id) {
        if (projectId) {
          router.push(`/projects/${projectId}/documents/${data.doc.id}`);
        } else {
          router.push(`/workspaces/${workspaceId}/docs/${data.doc.id}`);
        }
      }
    } catch (err: any) {
      showToast(err.message || "Could not create document");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async (docId: string, archive: boolean) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/docs/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: archive }),
      });
      if (!res.ok) throw new Error("Failed to update archive status");

      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, is_archived: archive } : d))
      );
      showToast(archive ? "Document archived" : "Document restored");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDeleteDoc = async (docId: string, permanent: boolean = false) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/docs/${docId}${permanent ? "?permanent=true" : ""}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete document");

      if (permanent) {
        setDocs((prev) => prev.filter((d) => d.id !== docId));
        showToast("Document permanently deleted");
      } else {
        setDocs((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, deleted_at: new Date().toISOString() } : d
          )
        );
        showToast("Document moved to Trash");
      }
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleRestoreFromTrash = async (docId: string) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/docs/${docId}?action=restore`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to restore document");

      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, deleted_at: null } : d))
      );
      showToast("Document restored from Trash");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDuplicate = async (docId: string) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/docs/${docId}?action=duplicate`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to duplicate");

      showToast("Document duplicated");
      if (data.newDocId) {
        router.push(
          projectId
            ? `/projects/${projectId}/documents/${data.newDocId}`
            : `/workspaces/${workspaceId}/docs/${data.newDocId}`
        );
      }
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleSaveRename = async () => {
    if (!renameDoc || !renameTitle.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/docs/${renameDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename");

      setDocs((prev) =>
        prev.map((d) =>
          d.id === renameDoc.id ? { ...d, title: renameTitle.trim() } : d
        )
      );
      setRenameDoc(null);
      showToast("Document renamed");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // Bulk actions
  const handleBulkArchive = async (archive: boolean) => {
    for (const id of Array.from(selectedIds)) {
      await handleArchiveToggle(id, archive);
    }
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    for (const id of Array.from(selectedIds)) {
      await handleDeleteDoc(id, activeTab === "trash");
    }
    setSelectedIds(new Set());
  };

  const handleBulkRestore = async () => {
    for (const id of Array.from(selectedIds)) {
      await handleRestoreFromTrash(id);
    }
    setSelectedIds(new Set());
  };

  // File import handler
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const title = file.name.replace(/\.[^/.]+$/, "");
      const res = await fetch(`/api/workspaces/${workspaceId}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: `Imported from ${file.name}`,
          projectId: projectId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create imported document");

      // Save imported markdown into root page
      if (data.page?.id) {
        await fetch(
          `/api/workspaces/${workspaceId}/docs/${data.doc.id}/pages/${data.page.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content_markdown: text }),
          }
        );
      }

      showToast(`Imported "${title}" successfully!`);
      setShowImportModal(false);
      if (data.doc?.id) {
        router.push(
          projectId
            ? `/projects/${projectId}/documents/${data.doc.id}`
            : `/workspaces/${workspaceId}/docs/${data.doc.id}`
        );
      }
    } catch (err: any) {
      showToast(err.message || "Failed to import file");
    }
  };

  return (
    <div className="docs-hub-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="doc-toast-banner" role="status">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <header className="docs-hub-header">
        <div className="docs-hub-header-left">
          <div className="docs-hub-breadcrumbs">
            <span>{workspaceName || "Workspace"}</span>
            {projectName && (
              <>
                <span className="crumb-sep">/</span>
                <span>{projectName}</span>
              </>
            )}
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Docs</span>
          </div>
          <div className="docs-hub-title-row">
            <h1>Documents & Knowledge Base</h1>
            <span className="docs-hub-counter">{docs.filter((d) => !d.deleted_at).length}</span>
          </div>
          <p className="docs-hub-subtitle">
            Centralized ClickUp-style documentation, specs, SOPs, and living project knowledge.
          </p>
        </div>

        <div className="docs-hub-header-actions">
          <button
            type="button"
            className="docs-btn-secondary"
            onClick={() => setShowTemplateModal(true)}
          >
            <Sparkles size={15} />
            <span>Templates</span>
          </button>

          <button
            type="button"
            className="docs-btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            <Upload size={15} />
            <span>Import</span>
          </button>

          <button
            type="button"
            className="docs-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>New Document</span>
          </button>
        </div>
      </header>

      {/* Navigation Filter Tabs */}
      <nav className="docs-hub-nav-tabs" aria-label="Document filters">
        <button
          className={activeTab === "all" ? "active" : ""}
          onClick={() => setActiveTab("all")}
        >
          All Documents
        </button>
        <button
          className={activeTab === "mine" ? "active" : ""}
          onClick={() => setActiveTab("mine")}
        >
          My Documents
        </button>
        <button
          className={activeTab === "favorites" ? "active" : ""}
          onClick={() => setActiveTab("favorites")}
        >
          Favorites
        </button>
        <button
          className={activeTab === "wikis" ? "active" : ""}
          onClick={() => setActiveTab("wikis")}
        >
          Wikis
        </button>
        <button
          className={activeTab === "archived" ? "active" : ""}
          onClick={() => setActiveTab("archived")}
        >
          Archived
        </button>
        <button
          className={activeTab === "trash" ? "active" : ""}
          onClick={() => setActiveTab("trash")}
        >
          Trash
        </button>
      </nav>

      {/* Filter and Control Bar */}
      <div className="docs-hub-controls-bar">
        <div className="docs-hub-search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search documents by title, tags, or content…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="docs-hub-controls-right">
          {allTags.length > 0 && (
            <div className="docs-hub-tag-filter">
              <Tag size={14} />
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                aria-label="Filter by tag"
              >
                <option value="all">All Tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="docs-hub-sort-picker">
            <SortAsc size={14} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort documents"
            >
              <option value="updated">Recently updated</option>
              <option value="title">Title (A-Z)</option>
              <option value="created">Recently created</option>
            </select>
          </div>

          <div className="docs-hub-view-mode-toggle">
            <button
              type="button"
              className={viewMode === "list" ? "active" : ""}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="docs-hub-bulk-bar">
          <span className="bulk-count">{selectedIds.size} selected</span>
          <div className="bulk-actions">
            {activeTab === "trash" ? (
              <>
                <button
                  type="button"
                  className="bulk-btn"
                  onClick={handleBulkRestore}
                >
                  <RefreshCw size={14} /> Restore
                </button>
                <button
                  type="button"
                  className="bulk-btn delete"
                  onClick={handleBulkDelete}
                >
                  <Trash2 size={14} /> Permanently Delete
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="bulk-btn"
                  onClick={() => handleBulkArchive(activeTab !== "archived")}
                >
                  <Archive size={14} />{" "}
                  {activeTab === "archived" ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  className="bulk-btn delete"
                  onClick={handleBulkDelete}
                >
                  <Trash2 size={14} /> Move to Trash
                </button>
              </>
            )}
            <button
              type="button"
              className="bulk-btn-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Documents Listing */}
      {filteredDocs.length === 0 ? (
        <div className="docs-hub-empty-state">
          <BookOpen size={36} className="empty-icon" />
          <h3>
            {searchQuery
              ? "No documents matched your search"
              : activeTab === "favorites"
              ? "No favorite documents yet"
              : activeTab === "wikis"
              ? "No wiki documents yet"
              : activeTab === "archived"
              ? "Archive is empty"
              : activeTab === "trash"
              ? "Trash is empty"
              : "No documents yet in this workspace"}
          </h3>
          <p>
            {searchQuery
              ? "Try searching for a different keyword or tag."
              : "Create a new document, choose from pre-built templates, or import Markdown to get started."}
          </p>
          {activeTab !== "trash" && activeTab !== "archived" && (
            <div className="empty-actions">
              <button
                type="button"
                className="docs-btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} /> New Document
              </button>
              <button
                type="button"
                className="docs-btn-secondary"
                onClick={() => setShowTemplateModal(true)}
              >
                <Sparkles size={15} /> Explore Templates
              </button>
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="docs-hub-list-table-wrap">
          <table className="docs-hub-table">
            <thead>
              <tr>
                <th className="th-check">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === filteredDocs.length &&
                      filteredDocs.length > 0
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="th-title">Title</th>
                <th className="th-location">Location</th>
                <th className="th-author">Author</th>
                <th className="th-updated">Updated</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                const href = getDocHref(doc);
                return (
                  <tr
                    key={doc.id}
                    className={`docs-hub-row ${isSelected ? "selected" : ""}`}
                  >
                    <td className="td-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectId(doc.id)}
                        aria-label={`Select ${doc.title}`}
                      />
                    </td>
                    <td className="td-title">
                      <div className="doc-row-title-container">
                        <span className="doc-row-icon">{doc.icon || "📄"}</span>
                        <div className="doc-row-text">
                          <Link href={href} className="doc-title-link">
                            {doc.title}
                          </Link>
                          {doc.description && (
                            <span className="doc-row-desc">{doc.description}</span>
                          )}
                          <div className="doc-row-badges">
                            {doc.is_wiki && (
                              <span className="badge badge-wiki">Wiki</span>
                            )}
                            {doc.is_protected && (
                              <span className="badge badge-protected">
                                Protected
                              </span>
                            )}
                            {doc.is_published && (
                              <span className="badge badge-published">Public</span>
                            )}
                            {doc.is_private && (
                              <span className="badge badge-private">Private</span>
                            )}
                            {doc.pages_count && doc.pages_count > 1 && (
                              <span className="badge badge-pages">
                                {doc.pages_count} pages
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="td-location">
                      <span className="doc-location-tag">
                        {doc.project_name
                          ? `${doc.project_name}`
                          : doc.workspace_name || "Workspace"}
                      </span>
                    </td>
                    <td className="td-author">
                      <div className="doc-author-chip">
                        <span className="author-avatar-mini">
                          {doc.creator_name?.charAt(0).toUpperCase() || "U"}
                        </span>
                        <span className="author-name-text">
                          {doc.creator_name || "Teammate"}
                        </span>
                      </div>
                    </td>
                    <td className="td-updated">
                      <span className="doc-date-text">
                        {new Date(doc.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="td-actions">
                      <div className="doc-row-hover-actions">
                        <FavoriteButton
                          entityType="document"
                          entityId={doc.id}
                          projectId={doc.project_id || projectId || ""}
                          title={doc.title}
                          subtitle={`${projectName || "Workspace"} · Document`}
                          initialFavorited={
                            doc.is_favorited || favoriteDocIds.includes(doc.id)
                          }
                          compact
                          label=""
                        />

                        {activeTab === "trash" ? (
                          <>
                            <button
                              type="button"
                              className="action-icon-btn"
                              title="Restore document"
                              onClick={() => handleRestoreFromTrash(doc.id)}
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              type="button"
                              className="action-icon-btn danger"
                              title="Delete permanently"
                              onClick={() => handleDeleteDoc(doc.id, true)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="action-icon-btn"
                              title="Share document"
                              onClick={() => setShareDoc(doc)}
                            >
                              <Share2 size={14} />
                            </button>

                            <button
                              type="button"
                              className="action-icon-btn"
                              title="Duplicate"
                              onClick={() => handleDuplicate(doc.id)}
                            >
                              <Copy size={14} />
                            </button>

                            <button
                              type="button"
                              className="action-icon-btn"
                              title={doc.is_archived ? "Unarchive" : "Archive"}
                              onClick={() =>
                                handleArchiveToggle(doc.id, !doc.is_archived)
                              }
                            >
                              <Archive size={14} />
                            </button>

                            <button
                              type="button"
                              className="action-icon-btn danger"
                              title="Move to trash"
                              onClick={() => handleDeleteDoc(doc.id, false)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="docs-hub-grid">
          {filteredDocs.map((doc) => {
            const href = getDocHref(doc);
            const isSelected = selectedIds.has(doc.id);
            return (
              <article
                key={doc.id}
                className={`docs-grid-card ${isSelected ? "selected" : ""}`}
              >
                <div className="card-top-bar">
                  <div className="card-checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectId(doc.id)}
                    />
                  </div>
                  <div className="card-top-badges">
                    {doc.is_wiki && <span className="badge badge-wiki">Wiki</span>}
                    {doc.is_protected && (
                      <span className="badge badge-protected">Protected</span>
                    )}
                    {doc.is_published && (
                      <span className="badge badge-published">Public</span>
                    )}
                  </div>
                  <div className="card-fav-wrap">
                    <FavoriteButton
                      entityType="document"
                      entityId={doc.id}
                      projectId={doc.project_id || projectId || ""}
                      title={doc.title}
                      subtitle={`${projectName || "Workspace"} · Document`}
                      initialFavorited={
                        doc.is_favorited || favoriteDocIds.includes(doc.id)
                      }
                      compact
                      label=""
                    />
                  </div>
                </div>

                <Link href={href} className="card-main-link">
                  <div className="card-icon-area">{doc.icon || "📄"}</div>
                  <h4 className="card-title">{doc.title}</h4>
                  <p className="card-description">
                    {doc.description || "No description provided."}
                  </p>
                </Link>

                <div className="card-footer">
                  <div className="card-author">
                    <span className="card-avatar">
                      {doc.creator_name?.charAt(0).toUpperCase() || "U"}
                    </span>
                    <span className="card-author-name">
                      {doc.creator_name || "Teammate"}
                    </span>
                  </div>
                  <span className="card-updated-date">
                    {new Date(doc.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* CREATE DOCUMENT MODAL */}
      {showCreateModal && (
        <div
          className="doc-modal-backdrop"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="doc-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h3>Create New Document</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <label className="modal-label">
                Document Title
                <input
                  type="text"
                  placeholder="e.g. Architecture Overview, Sprint Retrospective"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="modal-label">
                Icon / Emoji
                <div className="emoji-preset-row">
                  {["📄", "📘", "💡", "🚀", "⚙️", "📝", "🎯", "🧪", "📌", "✨"].map(
                    (emo) => (
                      <button
                        key={emo}
                        type="button"
                        className={`emoji-btn ${newIcon === emo ? "selected" : ""}`}
                        onClick={() => setNewIcon(emo)}
                      >
                        {emo}
                      </button>
                    )
                  )}
                </div>
              </label>

              <div className="modal-toggle-options">
                <label className="modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={newIsWiki}
                    onChange={(e) => setNewIsWiki(e.target.checked)}
                  />
                  <div>
                    <strong>Wiki Knowledge Mode</strong>
                    <p>Mark as verified knowledge base article with structured hierarchy.</p>
                  </div>
                </label>

                <label className="modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={newIsPrivate}
                    onChange={(e) => setNewIsPrivate(e.target.checked)}
                  />
                  <div>
                    <strong>Private Document</strong>
                    <p>Only you and explicitly invited team members can view.</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="docs-btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="docs-btn-primary"
                onClick={() => handleCreateDoc()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating…" : "Create & Open"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATES GALLERY MODAL */}
      {showTemplateModal && (
        <div
          className="doc-modal-backdrop"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="doc-modal-dialog template-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div>
                <h3>Document Templates</h3>
                <p>Start with pre-formatted ClickUp-style documentation structures.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTemplateModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="template-grid">
              {DOC_TEMPLATES.map((tmpl) => (
                <div key={tmpl.id} className="template-card">
                  <span className="template-icon">{tmpl.icon}</span>
                  <div className="template-card-body">
                    <span className="template-cat">{tmpl.category}</span>
                    <h4>{tmpl.title}</h4>
                    <p>{tmpl.description}</p>
                    <button
                      type="button"
                      className="docs-btn-primary template-use-btn"
                      onClick={() => handleCreateDoc(tmpl.id)}
                      disabled={isSubmitting}
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div
          className="doc-modal-backdrop"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="doc-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <h3>Import Document</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowImportModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="import-helper">
                Upload Markdown (.md) or HTML (.html) files to convert them
                automatically into native editor blocks and subpages.
              </p>
              <div
                className="import-dropzone"
                onClick={() => importFileRef.current?.click()}
              >
                <Upload size={28} />
                <strong>Click to choose a file</strong>
                <span>Supports .md, .markdown, .html, .txt</span>
                <input
                  type="file"
                  ref={importFileRef}
                  accept=".md,.markdown,.html,.txt"
                  style={{ display: "none" }}
                  onChange={handleFileImport}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHARE & PERMISSIONS MODAL */}
      {shareDoc && (
        <div
          className="doc-modal-backdrop"
          onClick={() => setShareDoc(null)}
        >
          <div
            className="doc-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <h3>Share &quot;{shareDoc.title}&quot;</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShareDoc(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body share-body">
              <div className="share-public-box">
                <div className="share-public-info">
                  <Globe size={18} />
                  <div>
                    <strong>Public Link Sharing</strong>
                    <p>Anyone with the link can view this document.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`docs-btn-secondary ${shareDoc.is_published ? "active" : ""}`}
                  onClick={async () => {
                    const nextPub = !shareDoc.is_published;
                    const res = await fetch(
                      `/api/workspaces/${workspaceId}/docs/${shareDoc.id}/publish`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ publish: nextPub }),
                      }
                    );
                    const data = await res.json();
                    if (res.ok) {
                      setShareDoc({
                        ...shareDoc,
                        is_published: nextPub,
                        public_slug: data.public_slug,
                      });
                      setDocs((prev) =>
                        prev.map((d) =>
                          d.id === shareDoc.id
                            ? {
                                ...d,
                                is_published: nextPub,
                                public_slug: data.public_slug,
                              }
                            : d
                        )
                      );
                      showToast(nextPub ? "Published publicly" : "Unpublished");
                    }
                  }}
                >
                  {shareDoc.is_published ? "Unpublish" : "Publish"}
                </button>
              </div>

              {shareDoc.is_published && shareDoc.public_slug && (
                <div className="share-link-input-row">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/docs/public/${shareDoc.public_slug}`}
                  />
                  <button
                    type="button"
                    className="docs-btn-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/docs/public/${shareDoc.public_slug}`
                      );
                      showToast("Public link copied to clipboard!");
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="docs-btn-secondary"
                onClick={() => setShareDoc(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
