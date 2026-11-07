"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Download,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Copy,
  Check,
  Eye,
  ExternalLink,
} from "lucide-react";

type PreviewAttachment = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes?: number;
};

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PdfPreviewViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setUseFallback(false);

    async function initPdf() {
      try {
        if (!(window as any).pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.getElementById("pdfjs-script");
            if (existingScript) {
              existingScript.addEventListener("load", () => resolve());
              existingScript.addEventListener("error", reject);
              if ((window as any).pdfjsLib) resolve();
              return;
            }
            const script = document.createElement("script");
            script.id = "pdfjs-script";
            script.src =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const pdfjsLib = (window as any).pdfjsLib;
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
              maxWidth: "100%",
              boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              borderRadius: 4,
              background: "#fff",
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function AttachmentPreviewModal({
  attachment,
  onClose,
}: {
  attachment: PreviewAttachment;
  onClose: () => void;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renderHtml, setRenderHtml] = useState(false);

  const previewUrl = `/api/attachments/${attachment.id}`;
  const isImage = attachment.mime_type.startsWith("image/");
  const isPdf = attachment.mime_type === "application/pdf" || attachment.file_name.toLowerCase().endsWith(".pdf");
  const isTextOrCode =
    attachment.mime_type.startsWith("text/") ||
    attachment.mime_type.includes("json") ||
    attachment.mime_type.includes("javascript") ||
    attachment.mime_type.includes("xml") ||
    attachment.mime_type.includes("yaml") ||
    attachment.file_name.endsWith(".txt") ||
    attachment.file_name.endsWith(".md") ||
    attachment.file_name.endsWith(".csv") ||
    attachment.file_name.endsWith(".json") ||
    attachment.file_name.endsWith(".html") ||
    attachment.file_name.endsWith(".ts") ||
    attachment.file_name.endsWith(".js") ||
    attachment.file_name.endsWith(".css");

  const isHtml = attachment.mime_type === "text/html" || attachment.file_name.toLowerCase().endsWith(".html");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isTextOrCode && !isPdf && !isImage) {
      setTextLoading(true);
      fetch(previewUrl)
        .then((res) => res.text())
        .then((txt) => {
          setTextContent(txt);
          setTextLoading(false);
        })
        .catch(() => {
          setTextContent("Failed to load text preview.");
          setTextLoading(false);
        });
    }
  }, [attachment.id, isTextOrCode, isPdf, isImage, previewUrl]);

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isPdf ? "960px" : isImage ? "880px" : "800px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper, #fff)",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid var(--line, #e2e8f0)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            background: "var(--surface, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {isImage ? (
              <ImageIcon size={18} color="#0891b2" style={{ flexShrink: 0 }} />
            ) : isPdf ? (
              <FileText size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            ) : isTextOrCode ? (
              <FileCode size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
            ) : (
              <FileText size={18} color="#475569" style={{ flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink, #1e293b)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 450,
                }}
                title={attachment.file_name}
              >
                {attachment.file_name}
              </h3>
              <span style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
                {formatBytes(attachment.file_size_bytes)} · {attachment.mime_type}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isHtml && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setRenderHtml(!renderHtml)}
                style={{ padding: "4px 10px", fontSize: 11, height: 30, display: "inline-flex", alignItems: "center", gap: 5 }}
                title="Toggle HTML render / source code"
              >
                <Eye size={12} />
                <span>{renderHtml ? "View Source" : "Render HTML"}</span>
              </button>
            )}

            {isTextOrCode && textContent && !renderHtml && (
              <button
                type="button"
                className="button button-secondary"
                onClick={handleCopyText}
                style={{ padding: "4px 10px", fontSize: 11, height: 30, display: "inline-flex", alignItems: "center", gap: 5 }}
                title="Copy contents"
              >
                {copied ? <Check size={12} color="#167c58" /> : <Copy size={12} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            )}

            <a
              href={`${previewUrl}?download=true`}
              download={attachment.file_name}
              className="button button-secondary"
              style={{
                padding: "4px 12px",
                fontSize: 11,
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                textDecoration: "none",
              }}
            >
              <Download size={13} />
              <span>Download</span>
            </a>

            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              style={{ padding: "5px", height: 30, width: 30, display: "grid", placeItems: "center" }}
              title="Close (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--paper, #fff)",
            minHeight: 300,
          }}
        >
          {isImage ? (
            <div style={{ padding: 24, textAlign: "center", width: "100%" }}>
              <img
                src={previewUrl}
                alt={attachment.file_name}
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  borderRadius: 6,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                }}
              />
            </div>
          ) : isPdf ? (
            <PdfPreviewViewer url={previewUrl} />
          ) : isTextOrCode ? (
            textLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--muted)" }}>
                <Loader2 size={24} className="animate-spin text-green" />
                <span style={{ fontSize: 12 }}>Loading file text…</span>
              </div>
            ) : renderHtml ? (
              <iframe
                srcDoc={textContent ?? ""}
                sandbox="allow-same-origin"
                style={{ width: "100%", height: "70vh", border: 0 }}
                title="HTML Preview"
              />
            ) : (
              <pre
                style={{
                  width: "100%",
                  height: "70vh",
                  margin: 0,
                  padding: "16px 20px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  background: "var(--nav-hover, #f8fafc)",
                  color: "var(--ink, #1e293b)",
                  overflow: "auto",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {textContent}
              </pre>
            )
          ) : (
            <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--muted)" }}>
              <FileText size={48} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.6 }} />
              <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                No direct in-browser preview available for this file type
              </p>
              <p style={{ margin: "0 0 16px", fontSize: 11 }}>
                You can download the file to inspect it on your computer.
              </p>
              <a
                href={`${previewUrl}?download=true`}
                download={attachment.file_name}
                className="button button-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <Download size={13} />
                <span>Download {attachment.file_name}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
