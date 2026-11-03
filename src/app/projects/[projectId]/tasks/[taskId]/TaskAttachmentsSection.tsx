"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  Paperclip,
  Download,
  Trash2,
  ExternalLink,
  Palette,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  File as FileGeneric,
} from "lucide-react";
import { removeTaskAttachment, createAndAttachCanvas } from "@/app/actions";

export type AttachmentItem = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_provider: string;
  external_file_id: string;
  external_url: string | null;
  uploaded_by: string;
  uploader_name?: string;
  created_at: string;
};

const attachmentMessages: Record<string, string> = {
  uploaded: "File uploaded successfully and synced to Google Drive.",
  too_large: "File exceeds the 15 MB limit. Please select a smaller file.",
  save_failed: "The Drive upload succeeded, but the app could not save its reference.",
  forbidden: "You have view-only access (Viewer). Only workspace Members, Managers, and Admins can upload attachments.",
};

const driveErrorMessages: Record<string, string> = {
  not_connected: "Google Drive is not connected for this organization. Ask an owner or admin to connect it.",
  configuration: "Google Drive setup is incomplete. Ask an administrator to check the configuration.",
  reconnect: "Google Drive authorization expired. Please reconnect in Organization settings.",
  permissions: "Google Drive denied this upload. Check account permissions and available storage.",
  api_disabled: "Google Drive API is disabled for this project.",
  quota: "Google Drive storage quota was exceeded.",
  request_failed: "The Google Drive upload failed. Please try again.",
};

function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileMeta(fileName: string, mimeType: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isCanvas =
    mimeType.includes("whiteboard") ||
    mimeType.includes("flowchart") ||
    fileName.toLowerCase().includes("whiteboard") ||
    fileName.toLowerCase().includes("flowchart");

  if (isCanvas) {
    if (mimeType.includes("whiteboard") || fileName.toLowerCase().includes("whiteboard")) {
      return { kind: "whiteboard", label: "Whiteboard", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" };
    }
    return { kind: "flowchart", label: "Flowchart", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" };
  }

  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "svg", "webp", "gif"].includes(ext)) {
    return { kind: "image", label: ext.toUpperCase() || "IMAGE", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
  }

  if (mimeType === "application/pdf" || ext === "pdf") {
    return { kind: "pdf", label: "PDF", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
  }

  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    ["csv", "xlsx", "xls"].includes(ext)
  ) {
    return { kind: "sheet", label: ext.toUpperCase() || "SHEET", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" };
  }

  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ["doc", "docx", "txt", "md"].includes(ext)
  ) {
    return { kind: "doc", label: ext.toUpperCase() || "DOC", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" };
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return { kind: "archive", label: ext.toUpperCase() || "ZIP", color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
  }

  return { kind: "file", label: ext.toUpperCase() || "FILE", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
}

export default function TaskAttachmentsSection({
  projectId,
  taskId,
  taskTitle,
  attachments,
  attachmentStatus,
  driveError,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  attachments: AttachmentItem[];
  attachmentStatus?: string;
  driveError?: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState<"all" | "files" | "canvas">("all");
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isCreatingCanvas, startCreateCanvasTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (fileInputRef.current) {
        // Transfer to file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFormSubmit = () => {
    setUploading(true);
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    if (!confirm("Are you sure you want to remove this attachment from the task?")) return;
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("attachmentId", attachmentId);
      await removeTaskAttachment(fd);
    });
  };

  const handleCreateCanvas = (type: "whiteboard" | "flowchart") => {
    startCreateCanvasTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("type", type);
      fd.set("title", `${taskTitle} - ${type === "whiteboard" ? "Whiteboard" : "Flowchart"}`);
      await createAndAttachCanvas(fd);
    });
  };

  const filteredAttachments = attachments.filter((item) => {
    const isCanvas =
      item.mime_type.includes("whiteboard") ||
      item.mime_type.includes("flowchart") ||
      item.file_name.toLowerCase().includes("whiteboard") ||
      item.file_name.toLowerCase().includes("flowchart");
    if (filter === "files") return !isCanvas;
    if (filter === "canvas") return isCanvas;
    return true;
  });

  return (
    <section className="task-attachments-section modern-attachments">
      {/* Section Header */}
      <div className="attachments-header">
        <div className="attachments-header-title">
          <p className="eyebrow">FILES &amp; ASSETS</p>
          <h2>
            Attachments &amp; Canvas <span className="count-pill">{attachments.length}</span>
          </h2>
          <p className="attachments-subtitle">
            Upload files, specs, and designs or collaborate on interactive canvases.
          </p>
        </div>

        {/* Quick Canvas Actions */}
        <div className="attachments-header-actions">
          <button
            type="button"
            className="quick-canvas-btn wb-btn"
            onClick={() => handleCreateCanvas("whiteboard")}
            disabled={isCreatingCanvas}
            title="Create and attach an interactive Whiteboard"
          >
            <Palette size={13} />
            <span>+ Whiteboard</span>
          </button>
          <button
            type="button"
            className="quick-canvas-btn fc-btn"
            onClick={() => handleCreateCanvas("flowchart")}
            disabled={isCreatingCanvas}
            title="Create and attach an interactive Flowchart"
          >
            <GitFork size={13} />
            <span>+ Flowchart</span>
          </button>
        </div>
      </div>

      {/* Status Notice Banners */}
      {attachmentStatus && (
        <div
          className={`attachment-alert-banner ${attachmentStatus === "uploaded" ? "is-success" : "is-error"}`}
          role="status"
        >
          {attachmentStatus === "uploaded" ? (
            <CheckCircle2 size={16} className="alert-icon text-success" />
          ) : (
            <AlertCircle size={16} className="alert-icon text-error" />
          )}
          <span>
            {attachmentStatus === "drive_failed"
              ? driveErrorMessages[driveError ?? ""] ?? driveErrorMessages.request_failed
              : attachmentMessages[attachmentStatus] ?? "Attachment action did not complete."}
          </span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <form
        ref={formRef}
        action="/api/tasks/attachments"
        method="post"
        encType="multipart/form-data"
        onSubmit={handleFormSubmit}
        className={`modern-dropzone${isDragging ? " is-dragging" : ""}${selectedFile ? " has-file" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={taskId} />
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          className="hidden-file-input"
          onChange={handleFileChange}
        />

        {!selectedFile ? (
          <div
            className="dropzone-idle-content"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <div className="dropzone-icon-circle">
              <UploadCloud size={24} />
            </div>
            <div className="dropzone-text-block">
              <p className="dropzone-primary-text">
                <strong>Click to browse</strong> or drag &amp; drop your files here
              </p>
              <p className="dropzone-secondary-text">
                Supports Images, PDF, Docs, Sheets, ZIP (Max 15 MB) · Stored securely in Google Drive
              </p>
            </div>
          </div>
        ) : (
          <div className="dropzone-selected-content">
            <div className="selected-file-card">
              <div className="selected-file-icon">
                <FileGeneric size={20} />
              </div>
              <div className="selected-file-info">
                <span className="selected-file-name">{selectedFile.name}</span>
                <span className="selected-file-size">{formatFileSize(selectedFile.size)}</span>
              </div>
              <button
                type="button"
                className="selected-file-remove"
                onClick={handleClearSelection}
                title="Remove selection"
              >
                ×
              </button>
            </div>

            <div className="selected-file-actions">
              <button
                type="button"
                className="btn-cancel-selection"
                onClick={handleClearSelection}
                disabled={uploading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-upload-submit" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Uploading to Drive…
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} /> Upload Attachment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Filter Tabs if multiple items */}
      {attachments.length > 2 && (
        <div className="attachments-filter-tabs">
          <button
            type="button"
            className={`filter-tab${filter === "all" ? " is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Assets ({attachments.length})
          </button>
          <button
            type="button"
            className={`filter-tab${filter === "files" ? " is-active" : ""}`}
            onClick={() => setFilter("files")}
          >
            Files (
            {
              attachments.filter(
                (a) =>
                  !a.mime_type.includes("whiteboard") &&
                  !a.mime_type.includes("flowchart") &&
                  !a.file_name.toLowerCase().includes("whiteboard") &&
                  !a.file_name.toLowerCase().includes("flowchart")
              ).length
            }
            )
          </button>
          <button
            type="button"
            className={`filter-tab${filter === "canvas" ? " is-active" : ""}`}
            onClick={() => setFilter("canvas")}
          >
            Canvases (
            {
              attachments.filter(
                (a) =>
                  a.mime_type.includes("whiteboard") ||
                  a.mime_type.includes("flowchart") ||
                  a.file_name.toLowerCase().includes("whiteboard") ||
                  a.file_name.toLowerCase().includes("flowchart")
              ).length
            }
            )
          </button>
        </div>
      )}

      {/* Attachments List */}
      <div className="attachments-grid">
        {filteredAttachments.map((item) => {
          const meta = getFileMeta(item.file_name, item.mime_type);
          const isCanvas = meta.kind === "whiteboard" || meta.kind === "flowchart";
          const targetHref =
            meta.kind === "whiteboard"
              ? `/projects/${projectId}/tasks/${taskId}?tab=whiteboard`
              : meta.kind === "flowchart"
              ? `/projects/${projectId}/tasks/${taskId}?tab=flowchart`
              : `/api/attachments/${item.id}`;

          return (
            <div className="modern-attachment-card" key={item.id}>
              {/* Type Badge & Icon */}
              <div
                className="attachment-badge-icon"
                style={{
                  background: meta.bg,
                  color: meta.color,
                  borderColor: meta.border,
                }}
              >
                {meta.kind === "whiteboard" ? (
                  <Palette size={18} />
                ) : meta.kind === "flowchart" ? (
                  <GitFork size={18} />
                ) : meta.kind === "image" ? (
                  <ImageIcon size={18} />
                ) : meta.kind === "pdf" ? (
                  <FileText size={18} />
                ) : meta.kind === "sheet" ? (
                  <FileSpreadsheet size={18} />
                ) : meta.kind === "doc" ? (
                  <FileText size={18} />
                ) : (
                  <FileGeneric size={18} />
                )}
              </div>

              {/* File Info */}
              <div className="attachment-card-info">
                <a
                  href={targetHref}
                  className="attachment-card-title"
                  title={item.file_name}
                  target={isCanvas ? undefined : "_blank"}
                  rel="noopener noreferrer"
                >
                  {item.file_name}
                </a>
                <div className="attachment-card-meta">
                  <span
                    className="attachment-type-pill"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.label}
                  </span>
                  <span className="meta-dot">·</span>
                  <span className="attachment-size">
                    {isCanvas ? "Interactive Canvas" : formatFileSize(item.file_size_bytes)}
                  </span>
                  <span className="meta-dot">·</span>
                  <span className="attachment-author">{item.uploader_name || "Team member"}</span>
                  <span className="meta-dot">·</span>
                  <span className="attachment-date">
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="attachment-card-actions">
                {isCanvas ? (
                  <Link href={targetHref} className="btn-attachment-action btn-open-canvas">
                    <span>Open Canvas</span>
                    <ExternalLink size={12} />
                  </Link>
                ) : (
                  <a
                    href={targetHref}
                    className="btn-attachment-action btn-download"
                    download={item.file_name}
                    title="Download file"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  className="btn-attachment-remove"
                  onClick={() => handleDeleteAttachment(item.id)}
                  disabled={isDeleting}
                  title="Remove attachment"
                  aria-label="Remove attachment"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {attachments.length === 0 && (
          <div className="attachments-empty-state">
            <div className="empty-state-icon-wrap">
              <Paperclip size={26} className="empty-clip-icon" />
            </div>
            <h4>No attachments yet</h4>
            <p>
              Upload documents, images, mockups, or create interactive Whiteboard and Flowchart
              diagrams for this task.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
