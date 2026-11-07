"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Eye,
  Search,
  Paperclip,
  ExternalLink,
  Layers3,
  Filter,
} from "lucide-react";
import AttachmentPreviewModal from "@/app/projects/[projectId]/AttachmentPreviewModal";

export type OrgAttachmentItem = {
  id: string;
  project_id: string;
  project_name: string;
  task_id: string;
  task_title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes?: number;
  created_at: string;
};

export type OrgDocumentItem = {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  updated_at: string;
};

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getFileIcon(mime: string, name: string) {
  if (mime.startsWith("image/")) {
    return <ImageIcon size={16} color="#0891b2" />;
  }
  if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    return <FileText size={16} color="#dc2626" />;
  }
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    name.endsWith(".csv") ||
    name.endsWith(".xlsx")
  ) {
    return <FileSpreadsheet size={16} color="#16a34a" />;
  }
  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    name.endsWith(".json") ||
    name.endsWith(".txt")
  ) {
    return <FileCode size={16} color="#7c3aed" />;
  }
  return <File size={16} color="#64748b" />;
}

export default function OrganizationDocsClient({
  organizationName,
  projects,
  attachments,
  documents,
}: {
  organizationName: string;
  projects: Array<{ id: string; name: string }>;
  attachments: OrgAttachmentItem[];
  documents: OrgDocumentItem[];
}) {
  const [activeTab, setActiveTab] = useState<"attachments" | "docs">("attachments");
  const [query, setQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "images" | "docs" | "sheets">("all");
  const [previewItem, setPreviewItem] = useState<OrgAttachmentItem | null>(null);

  const filteredAttachments = useMemo(() => {
    return attachments.filter((att) => {
      if (selectedProjectId !== "all" && att.project_id !== selectedProjectId) {
        return false;
      }

      const q = query.trim().toLowerCase();
      if (q) {
        const matchesName = att.file_name.toLowerCase().includes(q);
        const matchesTask = att.task_title.toLowerCase().includes(q);
        const matchesProject = att.project_name.toLowerCase().includes(q);
        if (!matchesName && !matchesTask && !matchesProject) return false;
      }

      if (typeFilter === "images") {
        return att.mime_type.startsWith("image/");
      }
      if (typeFilter === "docs") {
        return (
          att.mime_type === "application/pdf" ||
          att.file_name.toLowerCase().endsWith(".pdf") ||
          att.mime_type.includes("word") ||
          att.file_name.endsWith(".docx") ||
          att.file_name.endsWith(".txt")
        );
      }
      if (typeFilter === "sheets") {
        return (
          att.mime_type.includes("sheet") ||
          att.mime_type.includes("excel") ||
          att.mime_type.includes("csv") ||
          att.file_name.endsWith(".csv") ||
          att.file_name.endsWith(".xlsx")
        );
      }

      return true;
    });
  }, [attachments, selectedProjectId, query, typeFilter]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedProjectId !== "all" && doc.project_id !== selectedProjectId) {
        return false;
      }
      const q = query.trim().toLowerCase();
      if (q) {
        const matchesTitle = doc.title.toLowerCase().includes(q);
        const matchesProject = doc.project_name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject) return false;
      }
      return true;
    });
  }, [documents, selectedProjectId, query]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        flex: 1,
        overflow: "hidden",
        padding: "10px 16px 12px",
        boxSizing: "border-box",
      }}
    >
      {/* Page Heading */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          flexShrink: 0,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={18} color="#167c58" />
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
              Docs &amp; Attachments
            </h1>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
            Central repository of all project documents and task attachments in {organizationName}
          </p>
        </div>

        {/* Tab switcher: Attachments vs Project Documents */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: 3,
            borderRadius: 8,
            background: "var(--nav-hover, #f1f5f9)",
            border: "1px solid var(--line, #e2e8f0)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("attachments")}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: 0,
              fontSize: 12,
              fontWeight: activeTab === "attachments" ? 700 : 500,
              background: activeTab === "attachments" ? "var(--paper, #fff)" : "transparent",
              color: activeTab === "attachments" ? "#167c58" : "var(--muted)",
              boxShadow: activeTab === "attachments" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Paperclip size={13} />
            <span>Task Attachments ({attachments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("docs")}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: 0,
              fontSize: 12,
              fontWeight: activeTab === "docs" ? 700 : 500,
              background: activeTab === "docs" ? "var(--paper, #fff)" : "transparent",
              color: activeTab === "docs" ? "#167c58" : "var(--muted)",
              boxShadow: activeTab === "docs" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileText size={13} />
            <span>Project Documents ({documents.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "6px 10px",
          background: "var(--paper, #fff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: 8,
          marginBottom: 10,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div
          className="attachments-search-wrap"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: 6,
            padding: "4px 10px",
            background: "var(--surface, #f8fafc)",
            flex: "1 1 240px",
            maxWidth: 340,
          }}
        >
          <Search size={14} color="var(--muted)" />
          <input
            type="text"
            className="attachments-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeTab === "attachments"
                ? "Search by file, task, or project…"
                : "Search by document or project…"
            }
            style={{
              border: 0,
              background: "transparent",
              outline: "none",
              boxShadow: "none",
              fontSize: 12,
              width: "100%",
              color: "var(--ink)",
              padding: 0,
            }}
          />
        </div>

        {/* Project Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              height: 30,
              borderRadius: 6,
              border: "1px solid var(--line, #cbd5e1)",
              background: "var(--paper, #fff)",
              fontSize: 11.5,
              padding: "0 10px",
              color: "var(--ink)",
              outline: "none",
            }}
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Type filters for attachments */}
          {activeTab === "attachments" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {(
                [
                  { id: "all", label: "All" },
                  { id: "images", label: "Images" },
                  { id: "docs", label: "Docs" },
                  { id: "sheets", label: "Sheets" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  style={{
                    border: "1px solid",
                    borderColor: typeFilter === t.id ? "#167c58" : "var(--line, #cbd5e1)",
                    background: typeFilter === t.id ? "#edf6f0" : "transparent",
                    color: typeFilter === t.id ? "#167c58" : "var(--muted)",
                    fontWeight: typeFilter === t.id ? 700 : 500,
                    borderRadius: 20,
                    padding: "2px 8px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === "attachments" ? (
        filteredAttachments.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--paper, #fff)",
              border: "1px dashed var(--line, #cbd5e1)",
              borderRadius: 10,
              color: "var(--muted)",
            }}
          >
            <Paperclip size={32} strokeWidth={1.5} style={{ marginBottom: 10, opacity: 0.5 }} />
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              No attachments found
            </p>
            <small style={{ fontSize: 11 }}>
              {query || selectedProjectId !== "all" || typeFilter !== "all"
                ? "Try adjusting your search query or filters."
                : "Task files uploaded in any project will appear here."}
            </small>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              overflowY: "auto",
              overflowX: "auto",
              background: "var(--paper, #fff)",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse", fontSize: 12 }}>
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "var(--surface, #f8fafc)",
                  boxShadow: "0 1px 0 var(--line, #e2e8f0)",
                }}
              >
                <tr
                  style={{
                    textAlign: "left",
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--muted)",
                  }}
                >
                  <th style={{ padding: "9px 14px", background: "inherit" }}>File Name</th>
                  <th style={{ padding: "9px 14px", background: "inherit" }}>Project</th>
                  <th style={{ padding: "9px 14px", background: "inherit" }}>Task</th>
                  <th style={{ padding: "9px 14px", width: 100, background: "inherit" }}>Size</th>
                  <th style={{ padding: "9px 14px", width: 120, background: "inherit" }}>Uploaded</th>
                  <th style={{ padding: "9px 14px", width: 120, textAlign: "right", background: "inherit" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttachments.map((att) => (
                  <tr
                    key={att.id}
                    style={{
                      borderBottom: "1px solid var(--line, #e2e8f0)",
                      transition: "background .12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--nav-hover, #f8fafc)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* File Name */}
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {getFileIcon(att.mime_type, att.file_name)}
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--ink)",
                            maxWidth: 280,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={att.file_name}
                        >
                          {att.file_name}
                        </span>
                      </div>
                    </td>

                    {/* Project Name */}
                    <td style={{ padding: "11px 16px" }}>
                      <Link
                        href={`/projects/${att.project_id}`}
                        style={{
                          color: "var(--muted)",
                          textDecoration: "none",
                          fontWeight: 500,
                          fontSize: 11.5,
                        }}
                      >
                        {att.project_name}
                      </Link>
                    </td>

                    {/* Task Name (Clickable link, NOT task ID!) */}
                    <td style={{ padding: "11px 16px" }}>
                      <Link
                        href={`/projects/${att.project_id}/tasks/${att.task_id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          color: "#167c58",
                          fontWeight: 600,
                          textDecoration: "none",
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={`Go to task: ${att.task_title}`}
                      >
                        <span>{att.task_title}</span>
                        <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                      </Link>
                    </td>

                    {/* Size */}
                    <td style={{ padding: "11px 16px", color: "var(--muted)" }}>
                      {formatBytes(att.file_size_bytes)}
                    </td>

                    {/* Upload Date */}
                    <td style={{ padding: "11px 16px", color: "var(--muted)" }}>
                      {formatDate(att.created_at)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "11px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setPreviewItem(att)}
                          className="button button-secondary"
                          style={{
                            padding: "3px 8px",
                            fontSize: 11,
                            height: 26,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Quick preview"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>

                        <a
                          href={`/api/attachments/${att.id}?download=true`}
                          download={att.file_name}
                          className="button button-secondary"
                          style={{
                            padding: "3px 8px",
                            fontSize: 11,
                            height: 26,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            textDecoration: "none",
                          }}
                          title="Download file"
                        >
                          <Download size={12} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Project Documents Tab */
        filteredDocuments.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--paper, #fff)",
              border: "1px dashed var(--line, #cbd5e1)",
              borderRadius: 10,
              color: "var(--muted)",
            }}
          >
            <FileText size={32} strokeWidth={1.5} style={{ marginBottom: 10, opacity: 0.5 }} />
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              No project documents found
            </p>
            <small style={{ fontSize: 11 }}>
              {query || selectedProjectId !== "all"
                ? "Try adjusting your search query or project filter."
                : "Documents created in project wikis will appear here."}
            </small>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              overflowY: "auto",
              overflowX: "auto",
              background: "var(--paper, #fff)",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 12 }}>
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "var(--surface, #f8fafc)",
                  boxShadow: "0 1px 0 var(--line, #e2e8f0)",
                }}
              >
                <tr
                  style={{
                    textAlign: "left",
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--muted)",
                  }}
                >
                  <th style={{ padding: "9px 14px", background: "inherit" }}>Document Title</th>
                  <th style={{ padding: "9px 14px", background: "inherit" }}>Project</th>
                  <th style={{ padding: "9px 14px", width: 140, background: "inherit" }}>Last Updated</th>
                  <th style={{ padding: "9px 14px", width: 100, textAlign: "right", background: "inherit" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: "1px solid var(--line, #e2e8f0)",
                      transition: "background .12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--nav-hover, #f8fafc)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "11px 16px" }}>
                      <Link
                        href={`/projects/${doc.project_id}/documents/${doc.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          color: "var(--ink)",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <FileText size={15} color="#167c58" />
                        <span>{doc.title}</span>
                      </Link>
                    </td>

                    <td style={{ padding: "11px 16px" }}>
                      <Link
                        href={`/projects/${doc.project_id}`}
                        style={{
                          color: "var(--muted)",
                          textDecoration: "none",
                          fontSize: 11.5,
                        }}
                      >
                        {doc.project_name}
                      </Link>
                    </td>

                    <td style={{ padding: "11px 16px", color: "var(--muted)" }}>
                      {formatDate(doc.updated_at)}
                    </td>

                    <td style={{ padding: "11px 16px", textAlign: "right" }}>
                      <Link
                        href={`/projects/${doc.project_id}/documents/${doc.id}`}
                        className="button button-secondary"
                        style={{
                          padding: "3px 10px",
                          fontSize: 11,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          textDecoration: "none",
                        }}
                      >
                        <span>Open</span>
                        <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Preview Lightbox Modal */}
      {previewItem && (
        <AttachmentPreviewModal
          attachment={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
