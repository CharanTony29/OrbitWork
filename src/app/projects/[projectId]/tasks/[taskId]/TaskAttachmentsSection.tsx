"use client";

import { useState, useRef, useTransition, useEffect } from "react";
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
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
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

function PdfPreviewViewer({ url, fileName }: { url: string; fileName: string }) {
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [useFallback, setUseFallback] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initPdf() {
      try {
        setLoading(true);

        if (!(window as any).pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Could not load PDF.js engine"));
            document.head.appendChild(script);
          });
        }

        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) throw new Error("PDF.js library not available");

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: any) {
        console.warn("PDF.js failed, switching to native embed fallback:", err);
        if (isMounted) {
          setUseFallback(true);
          setLoading(false);
        }
      }
    }

    initPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [url]);

  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || useFallback) return;

    let cancel = false;

    async function renderPage() {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const page = await pdfDocRef.current.getPage(currentPage);
        if (cancel || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Page render error:", err);
        }
      }
    }

    renderPage();

    return () => {
      cancel = true;
    };
  }, [currentPage, scale, useFallback]);

  if (useFallback) {
    return (
      <div style={{ width: "100%", height: "75vh", display: "flex", flexDirection: "column", background: "var(--paper, #fff)", borderRadius: 8, overflow: "hidden" }}>
        <embed
          src={url}
          type="application/pdf"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "75vh", display: "flex", flexDirection: "column", background: "var(--paper, #fff)", borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid var(--line, #e2e8f0)",
          background: "var(--nav-hover, #f8fafc)",
          fontSize: 12,
          flexShrink: 0,
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "3px 8px", fontSize: 11, minHeight: 26 }}
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Previous page"
          >
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontWeight: 600, color: "var(--ink, #1e293b)", minWidth: 80, textAlign: "center" }}>
            {loading ? "Loading…" : `Page ${currentPage} of ${numPages}`}
          </span>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "3px 8px", fontSize: 11, minHeight: 26 }}
            disabled={currentPage >= numPages || loading}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            title="Next page"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "3px 8px", fontSize: 11, minHeight: 26 }}
            disabled={scale <= 0.6 || loading}
            onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.2).toFixed(1))))}
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span style={{ fontSize: 11, color: "var(--muted, #64748b)", minWidth: 42, textAlign: "center" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "3px 8px", fontSize: 11, minHeight: 26 }}
            disabled={scale >= 3.0 || loading}
            onClick={() => setScale((s) => Math.min(3.0, Number((s + 0.2).toFixed(1))))}
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "3px 8px", fontSize: 11, minHeight: 26 }}
            onClick={() => setScale(1.2)}
            title="Reset zoom"
          >
            Fit
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "20px",
          background: "var(--surface, #64748b20)",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, margin: "auto", color: "var(--muted)" }}>
            <Loader2 size={24} className="animate-spin text-green" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Rendering PDF preview…</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              borderRadius: 4,
              background: "#ffffff",
              maxWidth: "100%",
            }}
          />
        )}
      </div>
    </div>
  );
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
  canEdit = true,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  attachments: AttachmentItem[];
  attachmentStatus?: string;
  driveError?: string;
  canEdit?: boolean;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState<"all" | "files" | "canvas">("all");
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isCreatingCanvas, startCreateCanvasTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showHtmlRendered, setShowHtmlRendered] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasUploadRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isTextType = (fileName: string, mimeType: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    return (
      [
        "txt", "xml", "html", "htm", "json", "csv", "md", "log", "js", "ts",
        "tsx", "jsx", "css", "scss", "sql", "yaml", "yml", "ini", "env", "sh", "py"
      ].includes(ext) ||
      mimeType.startsWith("text/") ||
      mimeType.includes("xml") ||
      mimeType.includes("json") ||
      mimeType.includes("javascript")
    );
  };

  useEffect(() => {
    if (!previewItem) {
      setTextContent(null);
      setShowHtmlRendered(false);
      return;
    }

    if (isTextType(previewItem.file_name, previewItem.mime_type)) {
      setLoadingText(true);
      fetch(`/api/attachments/${previewItem.id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load text");
          return res.text();
        })
        .then((txt) => {
          setTextContent(txt);
          setLoadingText(false);
        })
        .catch((err) => {
          console.error(err);
          setTextContent("Error loading preview content.");
          setLoadingText(false);
        });
    } else {
      setTextContent(null);
    }
  }, [previewItem]);

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
      fd.set(
        "data",
        type === "whiteboard"
          ? JSON.stringify({ version: 1, strokes: [], stickyNotes: [], images: [] })
          : JSON.stringify({ nodes: [], edges: [] })
      );
      const res = await createAndAttachCanvas(fd);
      if (res?.ok) {
        window.location.href = `/projects/${projectId}/tasks/${taskId}?tab=${type}`;
      } else {
        alert(res?.error ? `Could not create ${type}: ${res.error}` : `Failed to create ${type}`);
      }
    });
  };

  const handleUploadCanvasFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      startCreateCanvasTransition(async () => {
        const resultStr = typeof reader.result === "string" ? reader.result : "";
        let initialData = "";
        let type: "whiteboard" | "flowchart" = "whiteboard";

        if (file.type.startsWith("image/")) {
          type = "whiteboard";
          initialData = JSON.stringify({
            version: 1,
            strokes: [],
            stickyNotes: [],
            images: [{ id: "img-1", x: 60, y: 60, w: 400, h: 280, src: resultStr }],
          });
        } else if (file.name.endsWith(".json")) {
          try {
            const parsed = JSON.parse(resultStr);
            if (parsed.nodes) type = "flowchart";
            initialData = resultStr;
          } catch {
            initialData = JSON.stringify({ version: 1, strokes: [], stickyNotes: [], images: [] });
          }
        }

        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("taskId", taskId);
        fd.set("type", type);
        fd.set("title", `${taskTitle} - ${file.name.replace(/\.[^/.]+$/, "")}`);
        fd.set("data", initialData);
        const res = await createAndAttachCanvas(fd);
        if (res?.ok) {
          window.location.href = `/projects/${projectId}/tasks/${taskId}?tab=${type}`;
        }
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
        {canEdit && (
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
            <button
              type="button"
              className="quick-canvas-btn"
              onClick={() => canvasUploadRef.current?.click()}
              disabled={isCreatingCanvas}
              title="Upload image or JSON into a new canvas"
              style={{ background: "var(--soft, #f1f5f9)", color: "var(--ink)", borderColor: "var(--line)" }}
            >
              <UploadCloud size={13} />
              <span>Upload Canvas</span>
            </button>
            <input
              type="file"
              ref={canvasUploadRef}
              accept="image/*,.json"
              onChange={handleUploadCanvasFile}
              style={{ display: "none" }}
            />
          </div>
        )}
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
      {canEdit && (
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
      )}

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
                  cursor: isCanvas ? "default" : "pointer",
                }}
                onClick={() => {
                  if (!isCanvas) setPreviewItem(item);
                }}
                title={isCanvas ? undefined : "Click to preview"}
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
                {isCanvas ? (
                  <Link href={targetHref} className="attachment-card-title" title={item.file_name}>
                    {item.file_name}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="attachment-card-title-btn"
                    onClick={() => setPreviewItem(item)}
                    title="Click to preview file"
                  >
                    {item.file_name}
                  </button>
                )}
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
                  <>
                    <button
                      type="button"
                      className="btn-attachment-action btn-preview"
                      onClick={() => setPreviewItem(item)}
                      title="Preview attachment"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <a
                      href={`/api/attachments/${item.id}?download=1`}
                      className="btn-attachment-action btn-download"
                      download={item.file_name}
                      title="Download file"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </a>
                  </>
                )}
                {canEdit && (
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
                )}
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
              {canEdit
                ? "Upload documents, images, mockups, or create interactive Whiteboard and Flowchart diagrams for this task."
                : "No files or canvases attached to this task."}
            </p>
          </div>
        )}
      </div>

      {/* Attachment Preview Modal (Lightbox) */}
      {previewItem && (
        <div
          className="attachment-preview-backdrop"
          onClick={() => setPreviewItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="attachment-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="attachment-preview-header">
              <div className="attachment-preview-title">
                <FileText size={16} />
                <strong>{previewItem.file_name}</strong>
                <span>({formatFileSize(previewItem.file_size_bytes)})</span>
              </div>
              <div className="attachment-preview-actions">
                <a
                  href={`/api/attachments/${previewItem.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button-secondary"
                  style={{ padding: "4px 10px", fontSize: "11px", minHeight: "28px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  title="Open file in a new browser tab"
                >
                  <ExternalLink size={13} />
                  <span>Open in Tab</span>
                </a>
                <a
                  href={`/api/attachments/${previewItem.id}?download=1`}
                  className="button button-primary"
                  style={{ padding: "4px 10px", fontSize: "11px", minHeight: "28px" }}
                  download={previewItem.file_name}
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  className="btn-preview-close"
                  onClick={() => setPreviewItem(null)}
                  aria-label="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="attachment-preview-body">
              {previewItem.mime_type.startsWith("image/") || ["png", "jpg", "jpeg", "svg", "webp", "gif"].some((ext) => previewItem.file_name.toLowerCase().endsWith(ext)) ? (
                <div className="preview-image-wrap">
                  <img
                    src={`/api/attachments/${previewItem.id}`}
                    alt={previewItem.file_name}
                    className="preview-img"
                  />
                </div>
              ) : previewItem.mime_type === "application/pdf" || previewItem.file_name.toLowerCase().endsWith(".pdf") ? (
                <PdfPreviewViewer
                  url={`/api/attachments/${previewItem.id}`}
                  fileName={previewItem.file_name}
                />
              ) : isTextType(previewItem.file_name, previewItem.mime_type) ? (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--paper, #fff)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--line, #e2e8f0)", background: "var(--nav-hover, #f8fafc)", fontSize: 11 }}>
                    <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                      Text Preview ({textContent ? `${textContent.split("\n").length} lines` : "Loading..."})
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(previewItem.file_name.toLowerCase().endsWith(".html") || previewItem.file_name.toLowerCase().endsWith(".htm")) && (
                        <button
                          type="button"
                          onClick={() => setShowHtmlRendered(!showHtmlRendered)}
                          className="button button-secondary"
                          style={{ padding: "2px 8px", fontSize: 10.5 }}
                        >
                          {showHtmlRendered ? "View Code" : "Render HTML"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (textContent) {
                            navigator.clipboard.writeText(textContent);
                            setCopiedText(true);
                            setTimeout(() => setCopiedText(false), 2000);
                          }
                        }}
                        className="button button-secondary"
                        style={{ padding: "2px 8px", fontSize: 10.5 }}
                      >
                        {copiedText ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  {loadingText ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "var(--muted)", gap: 8 }}>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Loading text content…</span>
                    </div>
                  ) : showHtmlRendered && textContent ? (
                    <iframe
                      srcDoc={textContent}
                      sandbox="allow-same-origin"
                      style={{ width: "100%", height: "65vh", border: 0, background: "#fff" }}
                      title="HTML Preview"
                    />
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        padding: "16px",
                        fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
                        fontSize: 12,
                        lineHeight: 1.6,
                        overflow: "auto",
                        maxHeight: "65vh",
                        color: "var(--ink, #1e293b)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      <code>{textContent}</code>
                    </pre>
                  )}
                </div>
              ) : (
                <div className="preview-fallback">
                  <FileText size={48} className="preview-fallback-icon" />
                  <h3>{previewItem.file_name}</h3>
                  <p>In-browser preview is not supported for this file type.</p>
                  <a
                    href={`/api/attachments/${previewItem.id}?download=1`}
                    className="button button-primary"
                    download={previewItem.file_name}
                  >
                    <Download size={14} />
                    Download {previewItem.file_name}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
