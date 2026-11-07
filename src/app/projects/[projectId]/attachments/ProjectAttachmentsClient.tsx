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
  ArrowLeft,
} from "lucide-react";
import AttachmentPreviewModal from "../AttachmentPreviewModal";

export type ProjectAttachmentItem = {
  id: string;
  task_id: string;
  task_title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes?: number;
  created_at: string;
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

export default function ProjectAttachmentsClient({
  projectId,
  projectName,
  attachments,
}: {
  projectId: string;
  projectName: string;
  attachments: ProjectAttachmentItem[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "images" | "docs" | "sheets">("all");
  const [previewItem, setPreviewItem] = useState<ProjectAttachmentItem | null>(null);

  const filtered = useMemo(() => {
    return attachments.filter((att) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const matchesName = att.file_name.toLowerCase().includes(q);
        const matchesTask = att.task_title.toLowerCase().includes(q);
        if (!matchesName && !matchesTask) return false;
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
  }, [attachments, query, typeFilter]);

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
      {/* Top Header Bar — Compact, No Wasted Above Spacing */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/projects/${projectId}`}
            className="button button-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              fontSize: 11.5,
              fontWeight: 600,
              height: 28,
              textDecoration: "none",
            }}
            title={`Back to ${projectName}`}
          >
            <ArrowLeft size={13} />
            <span>{projectName}</span>
          </Link>

          <span style={{ color: "var(--line, #cbd5e1)", fontSize: 13 }}>/</span>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Paperclip size={16} color="#167c58" />
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
              Project Attachments
            </h1>
          </div>

          <span
            style={{
              padding: "2px 8px",
              borderRadius: 12,
              background: "var(--nav-hover, #f1f5f9)",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink)",
              border: "1px solid var(--line, #e2e8f0)",
            }}
          >
            {filtered.length} {filtered.length === 1 ? "file" : "files"}
          </span>
        </div>

        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Excludes whiteboard &amp; flowchart canvases
        </span>
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
            gap: 7,
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: 6,
            padding: "3px 9px",
            background: "var(--surface, #f8fafc)",
            flex: "1 1 220px",
            maxWidth: 340,
          }}
        >
          <Search size={13} color="var(--muted)" />
          <input
            type="text"
            className="attachments-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file or task name…"
            style={{
              border: 0,
              background: "transparent",
              outline: "none",
              boxShadow: "none",
              fontSize: 11.5,
              width: "100%",
              color: "var(--ink)",
              padding: 0,
            }}
          />
        </div>

        {/* Type pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {(
            [
              { id: "all", label: "All Files" },
              { id: "images", label: "Images" },
              { id: "docs", label: "Documents" },
              { id: "sheets", label: "Spreadsheets" },
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
                padding: "2px 9px",
                fontSize: 11,
                cursor: "pointer",
                transition: "all .12s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attachments List — Vertically Scrollable with Sticky Header */}
      {filtered.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "36px 20px",
            textAlign: "center",
            background: "var(--paper, #fff)",
            border: "1px dashed var(--line, #cbd5e1)",
            borderRadius: 8,
            color: "var(--muted)",
          }}
        >
          <Paperclip size={28} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            No attachments found
          </p>
          <small style={{ fontSize: 11 }}>
            {query || typeFilter !== "all"
              ? "Try adjusting your search query or filters."
              : "Files attached to tasks in this project will appear here."}
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
                <th style={{ padding: "9px 14px", background: "inherit" }}>Task</th>
                <th style={{ padding: "9px 14px", width: 110, background: "inherit" }}>Size</th>
                <th style={{ padding: "9px 14px", width: 130, background: "inherit" }}>Uploaded</th>
                <th style={{ padding: "9px 14px", width: 120, textAlign: "right", background: "inherit" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((att) => (
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
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      {getFileIcon(att.mime_type, att.file_name)}
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--ink)",
                          maxWidth: 380,
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

                  {/* Task Name (Clickable link, NOT task ID!) */}
                  <td style={{ padding: "10px 14px" }}>
                    <Link
                      href={`/projects/${projectId}/tasks/${att.task_id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: "#167c58",
                        fontWeight: 600,
                        textDecoration: "none",
                        maxWidth: 280,
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
                  <td style={{ padding: "10px 14px", color: "var(--muted)" }}>
                    {formatBytes(att.file_size_bytes)}
                  </td>

                  {/* Upload Date */}
                  <td style={{ padding: "10px 14px", color: "var(--muted)" }}>
                    {formatDate(att.created_at)}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <button
                        type="button"
                        onClick={() => setPreviewItem(att)}
                        className="button button-secondary"
                        style={{
                          padding: "3px 8px",
                          fontSize: 11,
                          height: 25,
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
                          padding: "3px 7px",
                          fontSize: 11,
                          height: 25,
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
      )}

      {/* Lightbox / Preview Modal */}
      {previewItem && (
        <AttachmentPreviewModal
          attachment={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
