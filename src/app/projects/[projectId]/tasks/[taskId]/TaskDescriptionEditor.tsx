"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Code,
  Eye,
  Edit3,
  ImagePlus,
  Italic,
  List,
  Loader2,
} from "lucide-react";
import { markdownToSafeHtml } from "@/lib/markdown";

type Props = {
  projectId: string;
  taskId: string;
  initialValue: string;
  canEdit: boolean;
};

export default function TaskDescriptionEditor({
  projectId,
  taskId,
  initialValue,
  canEdit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const hasImagesInitially = /!\[[^\]]*\]\([^)]+\)/.test(initialValue);
  const [mode, setMode] = useState<"edit" | "preview">(
    !canEdit || hasImagesInitially ? "preview" : "edit"
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insertText(before: string, after = "") {
    const node = textareaRef.current;
    if (!node) {
      setValue((prev) => `${prev}${before}${after}`);
      return;
    }
    const start = node.selectionStart ?? value.length;
    const end = node.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "text";
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      node.focus();
      const cursorStart = start + before.length;
      node.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  }

  function insertImageMarkdown(url: string, alt: string) {
    const cleanAlt = alt.replace(/[\[\]\r\n]/g, "").trim() || "image";
    const snippet = `\n![${cleanAlt}](${url})\n`;
    const node = textareaRef.current;
    if (!node) {
      setValue((prev) => (prev ? `${prev}${snippet}` : snippet.trimStart()));
      return;
    }
    const start = node.selectionStart ?? value.length;
    const end = node.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      node.focus();
      const pos = start + snippet.length;
      node.setSelectionRange(pos, pos);
    });
  }

  async function uploadImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (PNG, JPG, GIF, WebP, or SVG).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError("Image must be 15 MB or smaller.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("file", file);
      fd.set("responseMode", "json");

      const res = await fetch("/api/tasks/attachments", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        setUploadError(
          data?.error || "Could not upload image. Check workspace storage settings."
        );
        return;
      }

      insertImageMarkdown(data.url, data.fileName || file.name);
      if (mode === "preview") {
        // Keep preview visible so user sees the uploaded image right away
      }
    } catch {
      setUploadError("Network error while uploading image.");
    } finally {
      setUploading(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="detail-field">
        <span>Description</span>
        {value.trim() ? (
          <div
            className="task-description-preview"
            dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(value) }}
          />
        ) : (
          <div className="task-description-preview is-empty">
            No description provided.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="detail-field">
      <div className="task-desc-header">
        <span>Description</span>
        <div className="task-desc-actions">
          <div className="task-desc-tabs" role="tablist" aria-label="Description view">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "edit"}
              className={`task-desc-tab${mode === "edit" ? " is-active" : ""}`}
              onClick={() => setMode("edit")}
            >
              <Edit3 size={12} />
              <span>Write</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "preview"}
              className={`task-desc-tab${mode === "preview" ? " is-active" : ""}`}
              onClick={() => setMode("preview")}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      <input type="hidden" name="description" value={value} />

      <div className="task-desc-toolbar" aria-label="Description formatting">
        <button
          type="button"
          className="task-desc-tool"
          title="Bold"
          onClick={() => {
            if (mode !== "edit") setMode("edit");
            insertText("**", "**");
          }}
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          className="task-desc-tool"
          title="Italic"
          onClick={() => {
            if (mode !== "edit") setMode("edit");
            insertText("*", "*");
          }}
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          className="task-desc-tool"
          title="Inline code"
          onClick={() => {
            if (mode !== "edit") setMode("edit");
            insertText("`", "`");
          }}
        >
          <Code size={13} />
        </button>
        <button
          type="button"
          className="task-desc-tool"
          title="Bullet list"
          onClick={() => {
            if (mode !== "edit") setMode("edit");
            insertText("- ", "");
          }}
        >
          <List size={13} />
        </button>
        <span className="task-desc-tool-sep" />
        <button
          type="button"
          className="task-desc-tool task-desc-image-btn"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          title="Upload and insert image into description"
        >
          {uploading ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />}
          <span>{uploading ? "Uploading…" : "Add image"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void uploadImageFile(file);
            }
            e.currentTarget.value = "";
          }}
        />
      </div>

      {uploadError && (
        <p className="error" role="alert" style={{ margin: "4px 0" }}>
          {uploadError}
        </p>
      )}

      {mode === "edit" ? (
        <div
          className={`task-desc-dropzone${isDragOver ? " is-drag-over" : ""}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setIsDragOver(true);
            }
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            setIsDragOver(false);
            const file = Array.from(e.dataTransfer.files).find((f) =>
              f.type.startsWith("image/")
            );
            if (file) {
              e.preventDefault();
              void uploadImageFile(file);
            }
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={10000}
            placeholder="Add context, notes, acceptance criteria, or paste/drop an image…"
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items ?? []);
              const imageItem = items.find((item) => item.type.startsWith("image/"));
              const file = imageItem?.getAsFile();
              if (file) {
                e.preventDefault();
                void uploadImageFile(file);
              }
            }}
          />
          <small className="task-desc-hint">
            Tip: Click <strong>Add image</strong>, paste a screenshot, or drag &amp; drop an image file. Then click Save changes.
          </small>
          {hasImages(value) && (
            <div className="task-desc-live-preview-box">
              <span className="task-desc-live-label">Image &amp; Markdown Preview</span>
              <div
                className="task-description-preview"
                dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(value) }}
              />
            </div>
          )}
        </div>
      ) : value.trim() ? (
        <div
          className="task-description-preview"
          dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(value) }}
        />
      ) : (
        <div className="task-description-preview is-empty">
          Nothing here yet. Switch to Write to add description text or images.
        </div>
      )}
    </div>
  );
}

function hasImages(text: string) {
  return /!\[[^\]]*\]\([^)]+\)/.test(text);
}
