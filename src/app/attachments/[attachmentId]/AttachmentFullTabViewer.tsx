"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ExcelPreviewViewer from "@/app/projects/[projectId]/ExcelPreviewViewer";
import WordPreviewViewer from "@/app/projects/[projectId]/WordPreviewViewer";
import PowerPointPreviewViewer from "@/app/projects/[projectId]/PowerPointPreviewViewer";
import {
  Download,
  FileText,
  FileCode,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Loader2,
  Copy,
  Check,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";

type ViewerAttachment = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes?: number;
};

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentFullTabViewer({
  attachment,
}: {
  attachment: ViewerAttachment;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renderHtml, setRenderHtml] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (viewerRootRef.current?.requestFullscreen) {
      await viewerRootRef.current.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const fileUrl = `/api/attachments/${attachment.id}`;
  const lowerName = attachment.file_name.toLowerCase();
  const lowerMime = (attachment.mime_type || "").toLowerCase();

  const isImage =
    lowerMime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].some((ext) => lowerName.endsWith(ext));
  const isPdf = lowerMime === "application/pdf" || lowerName.endsWith(".pdf");
  const isExcel =
    lowerMime.includes("spreadsheetml") ||
    lowerMime.includes("ms-excel") ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls");
  const isWord =
    lowerMime.includes("wordprocessingml") || lowerName.endsWith(".docx");
  const isPowerPoint =
    lowerMime.includes("presentationml") ||
    lowerMime.includes("powerpoint") ||
    lowerName.endsWith(".pptx");
  const isBinaryOffice =
    isExcel ||
    isWord ||
    isPowerPoint ||
    lowerMime.includes("openxmlformats") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".ppt");
  const isTextOrCode =
    !isBinaryOffice &&
    !isImage &&
    !isPdf &&
    (lowerMime.startsWith("text/") ||
      lowerMime.includes("json") ||
      lowerMime.includes("javascript") ||
      (lowerMime.includes("xml") && !lowerMime.includes("openxmlformats")) ||
      lowerMime.includes("yaml") ||
      [
        ".txt",
        ".md",
        ".csv",
        ".json",
        ".html",
        ".htm",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".css",
        ".xml",
        ".log",
        ".yaml",
        ".yml",
        ".sql",
        ".py",
        ".sh",
      ].some((ext) => lowerName.endsWith(ext)));

  const isHtml =
    lowerMime === "text/html" || lowerName.endsWith(".html") || lowerName.endsWith(".htm");

  useEffect(() => {
    if (!isTextOrCode) return;
    let active = true;
    setTextLoading(true);
    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load file");
        return res.text();
      })
      .then((txt) => {
        if (active) {
          setTextContent(txt);
          setTextLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setTextContent("Failed to load text preview.");
          setTextLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [fileUrl, isTextOrCode]);

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const sizeLabel = formatBytes(attachment.file_size_bytes);

  return (
    <div
      ref={viewerRootRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        display: "flex",
        flexDirection: "column",
        background: "var(--paper, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Top Viewer Toolbar */}
      <header
        style={{
          height: 54,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          borderBottom: "1px solid var(--line, #e2e8f0)",
          background: "var(--surface, #f8fafc)",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {isImage ? (
            <ImageIcon size={18} color="#0891b2" style={{ flexShrink: 0 }} />
          ) : isPdf ? (
            <FileText size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          ) : isExcel ? (
            <FileSpreadsheet size={18} color="#16a34a" style={{ flexShrink: 0 }} />
          ) : isWord ? (
            <FileText size={18} color="#2563eb" style={{ flexShrink: 0 }} />
          ) : isPowerPoint ? (
            <Presentation size={18} color="#ea580c" style={{ flexShrink: 0 }} />
          ) : isTextOrCode ? (
            <FileCode size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
          ) : (
            <FileText size={18} color="#475569" style={{ flexShrink: 0 }} />
          )}

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--ink, #0f172a)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "60vw",
              }}
              title={attachment.file_name}
            >
              {attachment.file_name}
            </div>
            {sizeLabel && (
              <div style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
                {sizeLabel}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {isHtml && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setRenderHtml((v) => !v)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Eye size={13} />
              <span>{renderHtml ? "View Source" : "Render HTML"}</span>
            </button>
          )}

          {isTextOrCode && textContent && !renderHtml && (
            <button
              type="button"
              className="button button-secondary"
              onClick={handleCopyText}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {copied ? <Check size={13} color="#167c58" /> : <Copy size={13} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}

          <button
            type="button"
            className="button button-secondary"
            onClick={toggleFullscreen}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              height: 30,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
            title={isFullscreen ? "Exit Full Screen (Esc)" : "Full Screen"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? "Exit Full Screen" : "Full Screen"}</span>
          </button>

          <a
            href={`${fileUrl}?download=1`}
            download={attachment.file_name}
            className="button button-primary"
            style={{
              padding: "4px 12px",
              fontSize: 11.5,
              height: 30,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
            }}
          >
            <Download size={13} />
            <span>Download</span>
          </a>
        </div>
      </header>

      {/* Full-Tab Viewer Body */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          background: isImage ? "#0f172a" : "var(--paper, #fff)",
        }}
      >
        {isPowerPoint ? (
          <PowerPointPreviewViewer url={fileUrl} height="100%" fullScreen />
        ) : isWord ? (
          <WordPreviewViewer url={fileUrl} height="100%" />
        ) : isExcel ? (
          <ExcelPreviewViewer url={fileUrl} height="100%" />
        ) : isPdf ? (
          <iframe
            src={fileUrl}
            title={attachment.file_name}
            style={{ width: "100%", height: "100%", border: 0, flex: 1 }}
          />
        ) : isImage ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <img
              src={fileUrl}
              alt={attachment.file_name}
              style={{
                maxWidth: "100%",
                maxHeight: "calc(100vh - 102px)",
                objectFit: "contain",
                borderRadius: 6,
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        ) : isTextOrCode ? (
          textLoading ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                color: "var(--muted)",
              }}
            >
              <Loader2 size={24} className="animate-spin text-green" />
              <span style={{ fontSize: 12 }}>Loading file content…</span>
            </div>
          ) : renderHtml ? (
            <iframe
              srcDoc={textContent ?? ""}
              sandbox="allow-same-origin"
              style={{ width: "100%", height: "100%", border: 0, flex: 1, background: "#fff" }}
              title="HTML Preview"
            />
          ) : (
            <pre
              style={{
                flex: 1,
                margin: 0,
                padding: "20px 24px",
                fontSize: 12.5,
                fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
                background: "var(--nav-hover, #f8fafc)",
                color: "var(--ink, #1e293b)",
                overflow: "auto",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              <code>{textContent}</code>
            </pre>
          )
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              textAlign: "center",
              color: "var(--muted)",
              gap: 10,
            }}
          >
            <FileText size={48} strokeWidth={1.2} style={{ opacity: 0.6 }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              {attachment.file_name}
            </h2>
            <p style={{ margin: 0, fontSize: 13 }}>
              In-browser preview is not supported for this file type.
            </p>
            <a
              href={`${fileUrl}?download=1`}
              download={attachment.file_name}
              className="button button-primary"
              style={{ marginTop: 8, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} />
              <span>Download {attachment.file_name}</span>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
