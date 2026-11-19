"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { showAppConfirm, showAppToast } from "@/lib/app-feedback";
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
  Link2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { removeTaskAttachment, createAndAttachCanvas } from "@/app/actions";
import ExcelPreviewViewer from "../../ExcelPreviewViewer";
import WordPreviewViewer from "../../WordPreviewViewer";
import PowerPointPreviewViewer from "../../PowerPointPreviewViewer";

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
  uploaded: "Attachment uploaded successfully.",
  too_large: "File exceeds the 25 MB limit. Please select a smaller file.",
  save_failed: "The upload succeeded, but the app could not save its reference.",
  forbidden: "You have view-only access (Viewer). Only workspace Members, Managers, and Admins can upload attachments.",
};

const driveErrorMessages: Record<string, string> = {
  not_connected: "Google Drive storage is not connected for this workspace. A Workspace Manager or Owner can connect it in Workspace Settings.",
  configuration: "Google Drive setup is incomplete. Ask an administrator to check the configuration.",
  reconnect: "Google Drive authorization expired. Please reconnect in Workspace Settings.",
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

function getFileMeta(fileName: string, mimeType: string, storageProvider?: string) {
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

  if (mimeType === "application/x-external-link" || ext === "link") {
    const lower = fileName.toLowerCase();
    if (lower.includes("sharepoint") || storageProvider === "sharepoint") {
      return { kind: "link", label: "SharePoint Link", color: "#0078d4", bg: "#eff6fc", border: "#c7e0f4" };
    }
    if (lower.includes("onedrive") || storageProvider === "onedrive") {
      return { kind: "link", label: "OneDrive Link", color: "#0284c7", bg: "#eff6fc", border: "#c7e0f4" };
    }
    if (storageProvider === "google_drive") {
      return { kind: "link", label: "Google Drive Link", color: "#167c58", bg: "#eaf7ee", border: "#cbead5" };
    }
    return { kind: "link", label: "Cloud Link", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" };
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
  attachmentError,
  driveError,
  canEdit = true,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  attachments: AttachmentItem[];
  attachmentStatus?: string;
  attachmentError?: string;
  driveError?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState<"all" | "files" | "canvas">("all");
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isCreatingCanvas, startCreateCanvasTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showHtmlRendered, setShowHtmlRendered] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [submittingLink, setSubmittingLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasUploadRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isExcelType = (fileName: string, mimeType: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const mime = (mimeType || "").toLowerCase();
    return (
      ["xlsx", "xls"].includes(ext) ||
      mime.includes("spreadsheetml") ||
      mime.includes("ms-excel")
    );
  };

  const isWordType = (fileName: string, mimeType: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const mime = (mimeType || "").toLowerCase();
    return ext === "docx" || mime.includes("wordprocessingml");
  };

  const isPowerPointType = (fileName: string, mimeType: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const mime = (mimeType || "").toLowerCase();
    return (
      ext === "pptx" ||
      mime.includes("presentationml") ||
      mime.includes("powerpoint")
    );
  };

  const isTextType = (fileName: string, mimeType: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const mime = (mimeType || "").toLowerCase();
    if (
      isExcelType(fileName, mimeType) ||
      isWordType(fileName, mimeType) ||
      isPowerPointType(fileName, mimeType) ||
      mime.includes("openxmlformats") ||
      ["doc", "ppt", "zip", "pdf"].includes(ext)
    ) {
      return false;
    }
    return (
      [
        "txt", "xml", "html", "htm", "json", "csv", "md", "log", "js", "ts",
        "tsx", "jsx", "css", "scss", "sql", "yaml", "yml", "ini", "env", "sh", "py"
      ].includes(ext) ||
      mime.startsWith("text/") ||
      (mime.includes("xml") && !mime.includes("openxmlformats")) ||
      mime.includes("json") ||
      mime.includes("javascript")
    );
  };

  useEffect(() => {
    if (!previewItem) {
      setTextContent(null);
      setShowHtmlRendered(false);
      setPreviewFullscreen(false);
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

  // Auto-sync any local attachments to the workspace's selected cloud drive (Google Drive / OneDrive)
  useEffect(() => {
    const hasLocal = attachments.some((a) => a.storage_provider === "built_in");
    if (hasLocal && canEdit) {
      fetch("/api/tasks/attachments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, projectId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok && data.syncedCount > 0) {
            router.refresh();
          }
        })
        .catch(() => undefined);
    }
  }, [taskId, projectId, attachments, canEdit, router]);

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
      if (file.size > 25 * 1024 * 1024) {
        showAppToast("File exceeds the 25 MB limit. Please select a smaller file.", "error");
        return;
      }
      setSelectedFile(file);
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        showAppToast("File exceeds the 25 MB limit. Please select a smaller file.", "error");
        e.target.value = "";
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadStatusText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFormSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile || uploading) return;

    const file = selectedFile;
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      showAppToast("File exceeds the 25 MB limit. Please select a smaller file.", "error");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatusText("Preparing upload...");

    const CHUNK_SIZE = 3 * 1024 * 1024; // 3 MB per slice (safely under Vercel 4.5 MB limit)

    try {
      if (file.size <= CHUNK_SIZE) {
        // Direct single-request upload for small files
        setUploadStatusText("Uploading attachment...");
        setUploadProgress(40);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("projectId", projectId);
        fd.append("taskId", taskId);
        fd.append("responseMode", "json");

        const res = await fetch("/api/tasks/attachments", {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const errText = await res.text();
          let errMsg = `Upload failed (HTTP ${res.status})`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) errMsg = parsed.error;
          } catch {}
          throw new Error(errMsg);
        }
        setUploadProgress(100);
        setUploadStatusText("Upload complete!");
      } else {
        // Resilient chunked upload for larger files (e.g. 5 MB - 25 MB)
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        setUploadStatusText(`Initializing upload (1 of ${totalChunks})...`);

        // 1. Init
        const initRes = await fetch("/api/tasks/attachments/chunk?action=init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            taskId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            totalChunks,
          }),
        });

        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}));
          throw new Error(err.error || `Initialization failed (HTTP ${initRes.status})`);
        }
        const { attachmentId } = await initRes.json();

        // 2. Upload chunks sequentially
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const chunkBlob = file.slice(start, end);

          const pct = Math.round((i / totalChunks) * 90);
          setUploadProgress(pct);
          setUploadStatusText(
            `Uploading chunk ${i + 1} of ${totalChunks} (${Math.round((end - start) / 1024)} KB)...`
          );

          const chunkFd = new FormData();
          chunkFd.append("attachmentId", attachmentId);
          chunkFd.append("chunkIndex", String(i));
          chunkFd.append("chunk", chunkBlob, file.name);

          const chunkRes = await fetch("/api/tasks/attachments/chunk?action=chunk", {
            method: "POST",
            body: chunkFd,
          });

          if (!chunkRes.ok) {
            const err = await chunkRes.json().catch(() => ({}));
            void fetch("/api/tasks/attachments/chunk?action=abort", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attachmentId }),
            }).catch(() => undefined);
            throw new Error(err.error || `Failed uploading chunk ${i + 1} (HTTP ${chunkRes.status})`);
          }
        }

        // 3. Complete and index for RAG
        setUploadProgress(95);
        setUploadStatusText("Finalizing & indexing document...");
        const completeRes = await fetch("/api/tasks/attachments/chunk?action=complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId, projectId, taskId }),
        });

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({}));
          throw new Error(err.error || `Finalizing upload failed (HTTP ${completeRes.status})`);
        }
        setUploadProgress(100);
        setUploadStatusText("Uploaded & indexed successfully!");
      }

      showAppToast(`"${file.name}" uploaded successfully!`, "success");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      console.error("Upload error:", err);
      showAppToast(err instanceof Error ? err.message : "Failed to upload file", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatusText("");
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const confirmed = await showAppConfirm({
      title: "Remove Attachment",
      message: "Are you sure you want to remove this attachment from the task?",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
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
        showAppToast(
          res?.error ? `Could not create ${type}: ${res.error}` : `Failed to create ${type}`,
          "error"
        );
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
              onClick={() => setShowLinkModal((prev) => !prev)}
              style={{ background: "var(--soft, #f1f5f9)", color: "var(--ink)", borderColor: "var(--line)" }}
              title="Attach a SharePoint, OneDrive, Google Drive, or web link"
            >
              <Link2 size={13} />
              <span>+ Link / SharePoint</span>
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

      {/* Attach Link / SharePoint Inline Panel */}
      {showLinkModal && canEdit && (
        <form
          action="/api/tasks/attachments"
          method="post"
          onSubmit={() => setSubmittingLink(true)}
          style={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="taskId" value={taskId} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink, #1e293b)", display: "flex", alignItems: "center", gap: 6 }}>
              <Link2 size={15} color="#167c58" />
              <span>Attach SharePoint, OneDrive, or Cloud Link</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLinkModal(false)}
              style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--muted, #64748b)" }}>
            Paste a document link from SharePoint, OneDrive, Google Drive, Dropbox, or any cloud service.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              name="linkTitle"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Document Title (e.g., Project Scope.docx)"
              style={{
                flex: "1 1 200px",
                height: 36,
                padding: "0 10px",
                borderRadius: 6,
                border: "1px solid var(--line, #cbd5e1)",
                fontSize: 12,
                outline: "none",
                background: "var(--paper, #fff)",
              }}
            />
            <input
              type="url"
              name="linkUrl"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://company.sharepoint.com/... or https://1drv.ms/..."
              required
              style={{
                flex: "2 1 300px",
                height: 36,
                padding: "0 10px",
                borderRadius: 6,
                border: "1px solid var(--line, #cbd5e1)",
                fontSize: 12,
                outline: "none",
                background: "var(--paper, #fff)",
              }}
            />
            <button
              type="submit"
              className="button button-primary"
              disabled={submittingLink || !linkUrl.trim()}
              style={{ height: 36, padding: "0 14px", fontSize: 12, minHeight: 36 }}
            >
              {submittingLink ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
              <span>Attach Link</span>
            </button>
          </div>
        </form>
      )}

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
              : attachmentError
              ? `${attachmentMessages[attachmentStatus] ?? "Attachment action did not complete."} (${attachmentError})`
              : attachmentMessages[attachmentStatus] ?? "Attachment action did not complete."}
          </span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      {canEdit && (
        <form
          ref={formRef}
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
                  Supports Images, PDF, Docs, Sheets, Presentations, ZIP (Max 25 MB) · Automatic chunked upload avoids size limits
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
                  disabled={uploading}
                >
                  ×
                </button>
              </div>

              {uploading && (
                <div style={{ marginTop: 10, width: "100%" }}>
                  <div style={{ height: 6, width: "100%", background: "var(--line, #e2e8f0)", borderRadius: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${uploadProgress}%`,
                        background: "#167c58",
                        transition: "width 0.25s ease-out",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--muted, #64748b)" }}>
                    <span>{uploadStatusText || `Uploading ${uploadProgress}%...`}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

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
                      <Loader2 size={13} className="animate-spin" /> {uploadProgress > 0 ? `${uploadProgress}%` : "Uploading…"}
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
          const meta = getFileMeta(item.file_name, item.mime_type, item.storage_provider);
          const isCanvas = meta.kind === "whiteboard" || meta.kind === "flowchart";
          const isExternalLink =
            Boolean(item.external_url) &&
            (meta.kind === "link" ||
              item.mime_type === "application/x-external-link" ||
              item.storage_provider === "external_link" ||
              !item.external_file_id ||
              item.external_file_id.startsWith("http"));
          const targetHref =
            meta.kind === "whiteboard"
              ? `/projects/${projectId}/tasks/${taskId}?tab=whiteboard`
              : meta.kind === "flowchart"
              ? `/projects/${projectId}/tasks/${taskId}?tab=flowchart`
              : `/attachments/${item.id}`;

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
                  if (isExternalLink && item.external_url) {
                    window.open(item.external_url, "_blank", "noopener,noreferrer");
                  } else if (!isCanvas) {
                    setPreviewItem(item);
                  }
                }}
                title={isCanvas ? undefined : isExternalLink ? "Click to open link" : "Click to preview"}
              >
                {meta.kind === "whiteboard" ? (
                  <Palette size={18} />
                ) : meta.kind === "flowchart" ? (
                  <GitFork size={18} />
                ) : meta.kind === "link" ? (
                  <Link2 size={18} />
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
                ) : isExternalLink && item.external_url ? (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attachment-card-title"
                    title={item.file_name}
                    style={{ textDecoration: "none" }}
                  >
                    {item.file_name}
                  </a>
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
                  {item.storage_provider && !isCanvas && (
                    <>
                      <span className="meta-dot">·</span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background:
                            item.storage_provider === "google_drive"
                              ? "#eaf7ee"
                              : item.storage_provider === "onedrive"
                              ? "#eff6fc"
                              : item.storage_provider === "sharepoint"
                              ? "#f0f9ff"
                              : "#f1f5f9",
                          color:
                            item.storage_provider === "google_drive"
                              ? "#167c58"
                              : item.storage_provider === "onedrive"
                              ? "#0284c7"
                              : item.storage_provider === "sharepoint"
                              ? "#0369a1"
                              : "#64748b",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        {item.storage_provider === "google_drive"
                          ? "📂 Google Drive"
                          : item.storage_provider === "onedrive"
                          ? "☁️ OneDrive"
                          : item.storage_provider === "sharepoint"
                          ? "🏢 SharePoint"
                          : "🏠 Local"}
                      </span>
                    </>
                  )}
                  <span className="meta-dot">·</span>
                  <span className="attachment-size">
                    {isCanvas ? "Interactive Canvas" : isExternalLink ? "External Link" : formatFileSize(item.file_size_bytes)}
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
                ) : isExternalLink && item.external_url ? (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-attachment-action btn-open-canvas"
                    title="Open external link in new tab"
                  >
                    <span>Open Link</span>
                    <ExternalLink size={12} />
                  </a>
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
      {previewItem && typeof document !== "undefined" && createPortal(
        <div
          className="attachment-preview-backdrop"
          style={previewFullscreen ? { padding: 0 } : undefined}
          onClick={() => setPreviewItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="attachment-preview-modal"
            style={
              previewFullscreen
                ? {
                    width: "100vw",
                    height: "100vh",
                    maxWidth: "100vw",
                    maxHeight: "100vh",
                    borderRadius: 0,
                    border: "none",
                  }
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="attachment-preview-header">
              <div className="attachment-preview-title">
                <FileText size={16} />
                <strong>{previewItem.file_name}</strong>
                <span>({formatFileSize(previewItem.file_size_bytes)})</span>
              </div>
              <div className="attachment-preview-actions">
                <button
                  type="button"
                  onClick={() => setPreviewFullscreen((v) => !v)}
                  className="button button-secondary"
                  style={{ padding: "4px 10px", fontSize: "11px", minHeight: "28px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  title={previewFullscreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {previewFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{previewFullscreen ? "Exit Full Screen" : "Full Screen"}</span>
                </button>
                <a
                  href={`/attachments/${previewItem.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button-secondary"
                  style={{ padding: "4px 10px", fontSize: "11px", minHeight: "28px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  title="Open preview in a new browser tab"
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

            <div
              className="attachment-preview-body"
              style={previewFullscreen ? { padding: 0, height: "calc(100vh - 54px)" } : undefined}
            >
              {previewItem.mime_type.startsWith("image/") || ["png", "jpg", "jpeg", "svg", "webp", "gif"].some((ext) => previewItem.file_name.toLowerCase().endsWith(ext)) ? (
                <div className="preview-image-wrap">
                  <img
                    src={`/api/attachments/${previewItem.id}`}
                    alt={previewItem.file_name}
                    className="preview-img"
                    style={previewFullscreen ? { maxHeight: "calc(100vh - 80px)" } : undefined}
                  />
                </div>
              ) : previewItem.mime_type === "application/pdf" || previewItem.file_name.toLowerCase().endsWith(".pdf") ? (
                <PdfPreviewViewer
                  url={`/api/attachments/${previewItem.id}`}
                  fileName={previewItem.file_name}
                />
              ) : isExcelType(previewItem.file_name, previewItem.mime_type) ? (
                <ExcelPreviewViewer
                  url={`/api/attachments/${previewItem.id}`}
                  height={previewFullscreen ? "100%" : "76vh"}
                />
              ) : isWordType(previewItem.file_name, previewItem.mime_type) ? (
                <WordPreviewViewer
                  url={`/api/attachments/${previewItem.id}`}
                  height={previewFullscreen ? "100%" : "76vh"}
                />
              ) : isPowerPointType(previewItem.file_name, previewItem.mime_type) ? (
                <PowerPointPreviewViewer
                  url={`/api/attachments/${previewItem.id}`}
                  height={previewFullscreen ? "100%" : "76vh"}
                  fullScreen={previewFullscreen}
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
        </div>,
        document.body
      )}
    </section>
  );
}
