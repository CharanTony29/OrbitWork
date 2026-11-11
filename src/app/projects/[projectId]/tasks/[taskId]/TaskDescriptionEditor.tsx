"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Code,
  ImagePlus,
  Italic,
  List,
  Loader2,
  Trash2,
} from "lucide-react";
import { markdownToSafeHtml } from "@/lib/markdown";

type Props = {
  projectId: string;
  taskId: string;
  initialValue: string;
  canEdit: boolean;
};

type SelectedOverlay = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u00a0/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") return "\n";

  if (tag === "img") {
    const rawSrc = el.getAttribute("src") ?? "";
    if (!rawSrc) return "";
    const rawAlt = (el.getAttribute("alt") ?? "Pasted image")
      .replace(/\|w=\d+/gi, "")
      .replace(/[\[\]]/g, "")
      .trim();
    const alt = rawAlt || "Pasted image";
    const dataWidth = Number.parseInt(el.getAttribute("data-width") ?? "", 10);
    const styleWidth = Number.parseInt(el.style.width || "", 10);
    const resolvedWidth = Number.isFinite(styleWidth)
      ? styleWidth
      : Number.isFinite(dataWidth)
        ? dataWidth
        : null;
    const widthSuffix =
      resolvedWidth && resolvedWidth >= 48
        ? `|w=${Math.min(1200, Math.round(resolvedWidth))}`
        : "";
    return `![${alt}${widthSuffix}](${rawSrc})`;
  }

  const inner = Array.from(el.childNodes).map(serializeInline).join("");

  if (tag === "strong" || tag === "b") return inner ? `**${inner}**` : "";
  if (tag === "em" || tag === "i") return inner ? `*${inner}*` : "";
  if (tag === "del" || tag === "s") return inner ? `~~${inner}~~` : "";
  if (tag === "code") return inner ? `\`${inner}\`` : "";
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    return href ? `[${inner || href}](${href})` : inner;
  }

  return inner;
}

function htmlToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const txt = (child.textContent ?? "").replace(/\u00a0/g, " ").trim();
      if (txt) blocks.push(txt);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "h1") {
      blocks.push(`# ${Array.from(el.childNodes).map(serializeInline).join("").trim()}`);
    } else if (tag === "h2") {
      blocks.push(`## ${Array.from(el.childNodes).map(serializeInline).join("").trim()}`);
    } else if (tag === "h3") {
      blocks.push(`### ${Array.from(el.childNodes).map(serializeInline).join("").trim()}`);
    } else if (tag === "blockquote") {
      const quoteText = Array.from(el.childNodes)
        .map(serializeInline)
        .join("")
        .trim();
      if (quoteText) {
        blocks.push(
          quoteText
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
        );
      }
    } else if (tag === "ul" || tag === "ol") {
      const items = Array.from(el.children)
        .filter((li) => li.tagName.toLowerCase() === "li")
        .map((li, idx) => {
          const text = Array.from(li.childNodes).map(serializeInline).join("").trim();
          return tag === "ol" ? `${idx + 1}. ${text}` : `- ${text}`;
        })
        .filter(Boolean);
      if (items.length) blocks.push(items.join("\n"));
    } else if (tag === "pre") {
      const codeText = (el.textContent ?? "").replace(/\u00a0/g, " ").trimEnd();
      blocks.push(`\`\`\`\n${codeText}\n\`\`\``);
    } else if (tag === "hr") {
      blocks.push("---");
    } else {
      const line = Array.from(el.childNodes).map(serializeInline).join("").replace(/\n+$/g, "");
      if (line.trim()) {
        blocks.push(line);
      }
    }
  }

  return blocks.join("\n\n").trim();
}

export default function TaskDescriptionEditor({
  projectId,
  taskId,
  initialValue,
  canEdit,
}: Props) {
  const [serialized, setSerialized] = useState(initialValue);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedOverlay, setSelectedOverlay] = useState<SelectedOverlay | null>(null);
  const [selectedWidthPx, setSelectedWidthPx] = useState<number>(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const updateOverlayForImg = useCallback((img: HTMLImageElement | null) => {
    const wrap = wrapRef.current;
    if (!img || !wrap || !wrap.contains(img)) {
      selectedImgRef.current = null;
      setSelectedOverlay(null);
      setSelectedWidthPx(0);
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    selectedImgRef.current = img;
    setSelectedWidthPx(Math.round(imgRect.width));
    setSelectedOverlay({
      top: imgRect.top - wrapRect.top,
      left: imgRect.left - wrapRect.left,
      width: imgRect.width,
      height: imgRect.height,
    });
  }, []);

  const syncFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const md = htmlToMarkdown(editor);
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = md;
    }
    setSerialized(md);
    if (selectedImgRef.current) {
      updateOverlayForImg(selectedImgRef.current);
    }
  }, [updateOverlayForImg]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !canEdit) return;
    editor.innerHTML = initialValue.trim() ? markdownToSafeHtml(initialValue) : "";
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = initialValue;
    }
    setSerialized(initialValue);
    selectedImgRef.current = null;
    setSelectedOverlay(null);
  }, [initialValue, taskId, canEdit]);

  // Ensure hidden input ALWAYS carries serialized DOM markdown at submit time
  useEffect(() => {
    const form = hiddenInputRef.current?.form;
    if (!form) return;
    const handleBeforeSubmit = () => syncFromEditor();
    form.addEventListener("submit", handleBeforeSubmit, true);
    return () => form.removeEventListener("submit", handleBeforeSubmit, true);
  }, [syncFromEditor]);

  // Reposition resize frame on window resize or click outside
  useEffect(() => {
    if (!canEdit) return;
    const handleDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && wrapRef.current?.contains(target)) {
        return;
      }
      selectedImgRef.current = null;
      setSelectedOverlay(null);
    };
    const handleResize = () => {
      if (selectedImgRef.current) {
        updateOverlayForImg(selectedImgRef.current);
      }
    };
    document.addEventListener("mousedown", handleDocMouseDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [canEdit, updateOverlayForImg]);

  const saveSelection = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  const insertImageNode = (url: string, altText: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection();

    const defaultWidth = Math.min(
      520,
      Math.max(240, Math.round((editor.clientWidth || 620) * 0.72))
    );
    const img = document.createElement("img");
    img.src = url;
    img.alt = altText || "Pasted image";
    img.className = "doc-embedded-img";
    img.setAttribute("data-width", String(defaultWidth));
    img.style.width = `${defaultWidth}px`;
    img.style.maxWidth = "100%";
    img.style.height = "auto";

    const p = document.createElement("p");
    p.appendChild(img);

    const trailingP = document.createElement("p");
    trailingP.innerHTML = "<br>";

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(trailingP);
      range.insertNode(p);
      range.setStart(trailingP, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(p);
      editor.appendChild(trailingP);
    }

    syncFromEditor();
    requestAnimationFrame(() => updateOverlayForImg(img));
  };

  const uploadAndInsertImages = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        formData.append("taskId", taskId);
        formData.append("responseMode", "json");
        const res = await fetch("/api/tasks/attachments", {
          method: "POST",
          headers: { Accept: "application/json" },
          body: formData,
        });
        const rawText = await res.text();
        let data: { ok?: boolean; error?: string; url?: string; attachment?: { url?: string } } | null = null;
        if (rawText) {
          try {
            data = JSON.parse(rawText);
          } catch {
            // Non-JSON error body returned by server or proxy
          }
        }
        const uploadedUrl = data?.url ?? data?.attachment?.url;
        if (!res.ok || !uploadedUrl) {
          throw new Error(
            data?.error ?? (res.ok ? "Could not upload image" : `Could not upload image (HTTP ${res.status})`)
          );
        }
        const safeAlt = (file.name || "pasted-image.png").replace(/[\[\]]/g, "");
        insertImageNode(uploadedUrl, safeAlt);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Image upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const runExec = (command: "bold" | "italic" | "insertUnorderedList") => {
    if (!canEdit) return;
    restoreSelection();
    document.execCommand(command, false);
    syncFromEditor();
  };

  const wrapSelectionCode = () => {
    if (!canEdit) return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const selectedText = range.toString() || "code";
    const code = document.createElement("code");
    code.textContent = selectedText;
    range.deleteContents();
    range.insertNode(code);
    range.setStartAfter(code);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    syncFromEditor();
  };

  const applyWidthPx = (px: number) => {
    const img = selectedImgRef.current;
    if (!img) return;
    const editorWidth = editorRef.current?.clientWidth || 720;
    const clamped = Math.max(64, Math.min(editorWidth - 16, Math.round(px)));
    img.style.width = `${clamped}px`;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.setAttribute("data-width", String(clamped));
    syncFromEditor();
    requestAnimationFrame(() => updateOverlayForImg(img));
  };

  const applyPercentWidth = (pct: number) => {
    const editorWidth = editorRef.current?.clientWidth || 680;
    applyWidthPx((editorWidth - 24) * pct);
  };

  const removeSelectedImage = () => {
    const img = selectedImgRef.current;
    if (!img) return;
    const parent = img.parentElement;
    img.remove();
    if (parent && parent.tagName.toLowerCase() === "p" && parent.childNodes.length === 0) {
      parent.remove();
    }
    selectedImgRef.current = null;
    setSelectedOverlay(null);
    syncFromEditor();
  };

  const startResizeDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const img = selectedImgRef.current;
    if (!img) return;

    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width || 240;
    const maxWidth = Math.max(120, (editorRef.current?.clientWidth || 720) - 18);

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(
        64,
        Math.min(maxWidth, Math.round(startWidth + (moveEvent.clientX - startX)))
      );
      img.style.width = `${nextWidth}px`;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.setAttribute("data-width", String(nextWidth));
      updateOverlayForImg(img);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      syncFromEditor();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    const files: File[] = [];
    if (e.clipboardData.files?.length) {
      for (const f of Array.from(e.clipboardData.files)) {
        if (f.type.startsWith("image/")) files.push(f);
      }
    } else if (e.clipboardData.items?.length) {
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void uploadAndInsertImages(files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) {
      e.preventDefault();
      void uploadAndInsertImages(files);
    }
  };

  return (
    <div className="detail-field task-desc-editor-wrap" data-project-id={projectId}>
      <div className="task-desc-header">
        <label htmlFor={`task-desc-editor-${taskId}`}>Description</label>
      </div>

      <input
        ref={hiddenInputRef}
        type="hidden"
        name="description"
        defaultValue={serialized}
      />

      {canEdit ? (
        <>
          <div className="task-desc-toolbar" role="toolbar" aria-label="Description formatting">
            <button
              type="button"
              className="task-desc-tool"
              title="Bold"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runExec("bold")}
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              className="task-desc-tool"
              title="Italic"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runExec("italic")}
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              className="task-desc-tool"
              title="Inline code"
              onMouseDown={(e) => e.preventDefault()}
              onClick={wrapSelectionCode}
            >
              <Code size={14} />
            </button>
            <button
              type="button"
              className="task-desc-tool"
              title="Bullet list"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runExec("insertUnorderedList")}
            >
              <List size={14} />
            </button>
            <span className="task-desc-sep" />
            <button
              type="button"
              className="task-desc-tool task-desc-tool-upload"
              title="Insert image into description"
              disabled={uploading}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <ImagePlus size={14} />
              )}
              <span>{uploading ? "Uploading…" : "Add image"}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length > 0) void uploadAndInsertImages(files);
              }}
            />
          </div>

          <div className="task-desc-wysiwyg-wrap" ref={wrapRef}>
            <div
              id={`task-desc-editor-${taskId}`}
              ref={editorRef}
              className="task-desc-wysiwyg doc-markdown-body"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Task description"
              data-placeholder="Describe scope, acceptance criteria, or paste / drop screenshots directly here…"
              onInput={() => syncFromEditor()}
              onBlur={() => {
                saveSelection();
                syncFromEditor();
              }}
              onKeyUp={() => saveSelection()}
              onMouseUp={() => saveSelection()}
              onClick={(e) => {
                const target = e.target as HTMLElement | null;
                if (target && target.tagName.toLowerCase() === "img") {
                  updateOverlayForImg(target as HTMLImageElement);
                } else {
                  selectedImgRef.current = null;
                  setSelectedOverlay(null);
                }
              }}
              onPaste={handlePaste}
              onDrop={handleDrop}
            />

            {selectedOverlay && (
              <div
                className="img-resize-frame"
                style={{
                  top: `${selectedOverlay.top}px`,
                  left: `${selectedOverlay.left}px`,
                  width: `${selectedOverlay.width}px`,
                  height: `${selectedOverlay.height}px`,
                }}
              >
                <div className="img-resize-toolbar" onMouseDown={(e) => e.preventDefault()}>
                  <button type="button" onClick={() => applyPercentWidth(0.25)}>25%</button>
                  <button type="button" onClick={() => applyPercentWidth(0.5)}>50%</button>
                  <button type="button" onClick={() => applyPercentWidth(0.75)}>75%</button>
                  <button type="button" onClick={() => applyPercentWidth(1)}>100%</button>
                  <span className="img-resize-px">{selectedWidthPx}px</span>
                  <button
                    type="button"
                    className="is-danger"
                    title="Remove image"
                    aria-label="Remove image"
                    onClick={removeSelectedImage}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <button
                  type="button"
                  className="img-resize-handle"
                  aria-label="Drag corner to resize image"
                  title="Drag to resize image"
                  onPointerDown={startResizeDrag}
                />
              </div>
            )}
          </div>

          <div className="task-desc-hint">
            Tip: Click <strong>Add image</strong>, paste a screenshot, or drag &amp; drop an image directly into the editor. Click any image to resize or drag its bottom-right corner, then click <strong>Save changes</strong>.
          </div>

          {uploadError && (
            <p className="task-desc-error" role="alert">
              {uploadError}
            </p>
          )}
        </>
      ) : (
        <div
          className="task-description-preview doc-markdown-body"
          dangerouslySetInnerHTML={{
            __html: initialValue.trim()
              ? markdownToSafeHtml(initialValue)
              : '<p class="muted small">No description provided yet.</p>',
          }}
        />
      )}
    </div>
  );
}
