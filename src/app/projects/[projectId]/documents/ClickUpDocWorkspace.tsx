"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  Check,
  Smile,
  Image as ImageIcon,
  Settings,
  Download,
  Printer,
  Sparkles,
  Columns,
  ListFilter,
  CheckSquare,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Minus,
  Layout,
  Eye,
  Edit3,
  Columns2,
  Loader2,
  X,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  Palette,
  Type,
  Trash2,
  Maximize2,
  Paperclip,
} from "lucide-react";
import ProjectAttachmentsClient, { ProjectAttachmentItem } from "../attachments/ProjectAttachmentsClient";
import FavoriteButton from "@/app/FavoriteButton";
import WhiteboardCanvas from "@/app/canvas/WhiteboardCanvas";
import FlowchartCanvas from "@/app/canvas/FlowchartCanvas";
import {
  quickCreateProjectDocument,
  quickSaveProjectDocument,
  saveCanvasData,
} from "@/app/actions";
import { markdownToSafeHtml } from "@/lib/markdown";

export type DocItem = {
  id: string;
  title: string;
  body_markdown: string;
  updated_at: string;
  created_by?: string;
};

export type DocMeta = {
  icon?: string;
  cover?: string;
  isWiki?: boolean;
  parentId?: string | null;
};

const COVER_PRESETS = [
  "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  "linear-gradient(135deg, #065f46 0%, #064e3b 100%)",
  "linear-gradient(135deg, #1e40af 0%, #172554 100%)",
  "linear-gradient(135deg, #581c87 0%, #3b0764 100%)",
  "linear-gradient(135deg, #831843 0%, #500724 100%)",
  "linear-gradient(135deg, #9a3412 0%, #431407 100%)",
];

const EMOJI_PRESETS = ["📄", "📘", "💡", "🚀", "⚙️", "📝", "🎯", "🧪", "📌", "🔬", "📚", "✨"];

const COLOR_PALETTE = [
  { label: "Default", color: "var(--ink, #1e293b)" },
  { label: "Dark / Slate", color: "#64748b" },
  { label: "White", color: "#ffffff" },
  { label: "Emerald Green", color: "#10b981" },
  { label: "Sky Blue", color: "#0284c7" },
  { label: "Purple", color: "#a855f7" },
  { label: "Red", color: "#ef4444" },
  { label: "Amber / Yellow", color: "#f59e0b" },
];

export default function ClickUpDocWorkspace({
  projectId,
  projectName,
  documents,
  currentDocId,
  currentUserName = "Charan Dukka",
  taskAttachments = [],
  favoriteDocIds = [],
}: {
  projectId: string;
  projectName: string;
  documents: DocItem[];
  currentDocId?: string;
  currentUserName?: string;
  taskAttachments?: ProjectAttachmentItem[];
  favoriteDocIds?: string[];
}) {
  const router = useRouter();
  const [sidebarTab, setSidebarTab] = useState<"pages" | "files">("pages");

  // Parse doc metadata from markdown comment <!-- doc-meta: {...} -->
  const parseMeta = (body: string): { meta: DocMeta; cleanBody: string } => {
    const match = body.match(/^<!--\s*doc-meta:\s*(\{[\s\S]*?\})\s*-->\s*/i);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        const cleanBody = body.slice(match[0].length);
        return { meta, cleanBody };
      } catch {
        // invalid json
      }
    }
    return { meta: {}, cleanBody: body };
  };

  const serializeMeta = (meta: DocMeta, content: string): string => {
    const json = JSON.stringify(meta);
    return `<!-- doc-meta: ${json} -->\n${content}`;
  };

  // State
  const [docList, setDocList] = useState<DocItem[]>(documents);
  const activeDocId = currentDocId || docList[0]?.id || "";
  const activeDoc = docList.find((d) => d.id === activeDocId) || docList[0];

  const parsedInitial = activeDoc ? parseMeta(activeDoc.body_markdown) : { meta: {}, cleanBody: "" };
  const [title, setTitle] = useState(activeDoc?.title || "Untitled Document");
  const [content, setContent] = useState(parsedInitial.cleanBody);
  const [meta, setMeta] = useState<DocMeta>(parsedInitial.meta);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");

  const canvasInfo = (() => {
    if (!activeDoc?.body_markdown) return null;
    try {
      const obj = JSON.parse(activeDoc.body_markdown);
      if (obj && (obj.canvasType === "whiteboard" || obj.canvasType === "flowchart")) {
        return {
          type: obj.canvasType as "whiteboard" | "flowchart",
          content: obj.content,
        };
      }
    } catch {
      // not canvas JSON
    }
    return null;
  })();

  const getDocIcon = (body: string, defaultIcon?: string) => {
    try {
      const obj = JSON.parse(body);
      if (obj?.canvasType === "whiteboard") return "🎨";
      if (obj?.canvasType === "flowchart") return "🔀";
    } catch {}
    return defaultIcon || "📄";
  };
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavigatingRef = useRef(false);

  // When activeDoc changes, update editor state
  useEffect(() => {
    if (!activeDoc || isNavigatingRef.current) return;
    const { meta: m, cleanBody } = parseMeta(activeDoc.body_markdown);
    setTitle(activeDoc.title);
    setContent(cleanBody);
    setMeta(m);
    setSaveStatus("saved");
    if (editorRef.current) {
      editorRef.current.innerHTML = cleanBody.includes("<") ? cleanBody : markdownToSafeHtml(cleanBody);
    }
  }, [activeDocId]);

  useEffect(() => {
    if (editorRef.current && parsedInitial.cleanBody) {
      editorRef.current.innerHTML = parsedInitial.cleanBody.includes("<")
        ? parsedInitial.cleanBody
        : markdownToSafeHtml(parsedInitial.cleanBody);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Build tree of parent -> subpages
  const docParentMap = new Map<string, string | null>();
  for (const doc of docList) {
    const { meta: m } = parseMeta(doc.body_markdown);
    docParentMap.set(doc.id, m.parentId || null);
  }

  // Filter root documents and subpages
  const rootDocs = docList.filter((d) => !docParentMap.get(d.id));
  const getSubpages = (id: string) => docList.filter((d) => docParentMap.get(d.id) === id);

  // Autosave
  const performSave = useCallback(
    async (nextTitle: string, nextContent: string, nextMeta: DocMeta) => {
      if (!activeDocId) return;
      setSaveStatus("saving");
      const fullBody = serializeMeta(nextMeta, nextContent);

      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("documentId", activeDocId);
      fd.set("title", nextTitle.trim() || "Untitled Document");
      fd.set("body", fullBody);

      const res = await quickSaveProjectDocument(fd);
      if (res?.ok) {
        setSaveStatus("saved");
        setDocList((prev) =>
          prev.map((d) =>
            d.id === activeDocId
              ? {
                  ...d,
                  title: nextTitle.trim() || "Untitled Document",
                  body_markdown: fullBody,
                  updated_at: new Date().toISOString(),
                }
              : d
          )
        );
      } else {
        setSaveStatus("unsaved");
      }
    },
    [activeDocId, projectId]
  );

  const triggerAutosave = (nextTitle: string, nextContent: string, nextMeta: DocMeta) => {
    setSaveStatus("unsaved");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performSave(nextTitle, nextContent, nextMeta);
    }, 1200);
  };

  // Client-side image compression & insertion
  const compressAndInsertImage = async (file: File) => {
    try {
      showToast("Pasting image…");
      const bitmap = await createImageBitmap(file);
      const maxDim = 1200;
      let { width, height } = bitmap;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(bitmap, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      insertRichHTML(`<img src="${dataUrl}" alt="${file.name || "Pasted image"}" class="doc-embedded-img" style="max-width:100%; border-radius:8px; margin:12px 0;" /><p><br/></p>`);
      showToast("Image pasted successfully!");
    } catch (err) {
      console.error("Image paste error", err);
      showToast("Could not paste image.");
    }
  };

  const execRichCmd = (cmd: string, val: string = "") => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      triggerAutosave(title, html, meta);
    }
  };

  const insertRichHTML = (htmlToInsert: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand("insertHTML", false, htmlToInsert);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      triggerAutosave(title, html, meta);
    }
    setSlashMenuOpen(false);
    setBlockMenuOpen(false);
  };

  // Paste handler — supports copied images (Ctrl+C → Ctrl+V) from browser, files, screenshots
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const clipData = e.clipboardData;
    if (!clipData) return;

    // Check for image files in clipboard items
    const items = clipData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          compressAndInsertImage(file);
          return;
        }
      }
    }

    // Check clipboard files array
    const files = clipData.files;
    if (files && files.length > 0 && files[0].type.startsWith("image/")) {
      e.preventDefault();
      compressAndInsertImage(files[0]);
      return;
    }
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer?.files;
    if (files && files[0] && files[0].type.startsWith("image/")) {
      e.preventDefault();
      compressAndInsertImage(files[0]);
    }
  };

  // Font styling helpers
  const setFontSize = (sizePx: string) => {
    if (editorRef.current) editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      const span = document.createElement("span");
      span.style.fontSize = sizePx;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        setContent(html);
        triggerAutosave(title, html, meta);
      }
    }
  };

  const setFontColor = (colorHex: string) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand("foreColor", false, colorHex);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      triggerAutosave(title, html, meta);
    }
    setShowColorPicker(false);
  };

  // Table manipulation helpers
  const getSelectedTable = (): HTMLTableElement | null => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let el: Node | null = sel.anchorNode;
      while (el && el !== editorRef.current) {
        if (el.nodeName === "TABLE") return el as HTMLTableElement;
        el = el.parentNode;
      }
    }
    return editorRef.current?.querySelector("table.doc-table") as HTMLTableElement | null;
  };

  const addTableRow = () => {
    const table = getSelectedTable();
    if (!table) {
      showToast("Place your cursor inside a table first.");
      return;
    }
    const colCount = table.rows[0]?.cells.length || 3;
    const tbody = table.querySelector("tbody") || table;
    const newRow = document.createElement("tr");
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement("td");
      td.textContent = `Cell`;
      newRow.appendChild(td);
    }
    tbody.appendChild(newRow);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      triggerAutosave(title, html, meta);
    }
    showToast("Row added to table");
  };

  const addTableColumn = () => {
    const table = getSelectedTable();
    if (!table) {
      showToast("Place your cursor inside a table first.");
      return;
    }
    const thead = table.querySelector("thead");
    if (thead && thead.rows[0]) {
      const th = document.createElement("th");
      th.textContent = `Column ${thead.rows[0].cells.length + 1}`;
      thead.rows[0].appendChild(th);
    }
    const tbody = table.querySelector("tbody") || table;
    for (let i = 0; i < tbody.rows.length; i++) {
      const td = document.createElement("td");
      td.textContent = `Cell`;
      tbody.rows[i].appendChild(td);
    }
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      triggerAutosave(title, html, meta);
    }
    showToast("Column added to table");
  };

  const removeTableRow = () => {
    const table = getSelectedTable();
    if (!table) return;
    const tbody = table.querySelector("tbody") || table;
    if (tbody.rows.length > 1) {
      tbody.deleteRow(tbody.rows.length - 1);
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        setContent(html);
        triggerAutosave(title, html, meta);
      }
      showToast("Row removed");
    }
  };

  const removeTableColumn = () => {
    const table = getSelectedTable();
    if (!table) return;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (row.cells.length > 1) {
        row.deleteCell(row.cells.length - 1);
      }
    }
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      triggerAutosave(title, html, meta);
    }
    showToast("Column removed");
  };

  // Image selection and resize helpers
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      setSelectedImg(img);
      editorRef.current?.querySelectorAll("img.is-selected").forEach((el) => el.classList.remove("is-selected"));
      img.classList.add("is-selected");
    } else {
      if (selectedImg && !target.closest(".doc-img-resizer-bar")) {
        editorRef.current?.querySelectorAll("img.is-selected").forEach((el) => el.classList.remove("is-selected"));
        setSelectedImg(null);
      }
    }
  };

  const resizeSelectedImg = (widthVal: string) => {
    if (selectedImg) {
      selectedImg.style.width = widthVal;
      selectedImg.style.maxWidth = "100%";
      selectedImg.style.height = "auto";
      selectedImg.style.display = "block";
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        setContent(html);
        triggerAutosave(title, html, meta);
      }
      showToast(`Image set to ${widthVal}`);
    }
  };

  const deleteSelectedImg = () => {
    if (selectedImg) {
      selectedImg.remove();
      setSelectedImg(null);
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        setContent(html);
        triggerAutosave(title, html, meta);
      }
      showToast("Image removed");
    }
  };

  // Keyboard navigation shortcuts: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), and numbering continuation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        execRichCmd("bold");
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        execRichCmd("italic");
        return;
      }
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        execRichCmd("underline");
        return;
      }
    }

    // Auto-continue numbering: after "1. " and Enter, automatically insert "2. "
    if (e.key === "Enter" && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const anchor = sel.anchorNode;
        const text = anchor?.textContent || "";
        const offset = sel.anchorOffset;
        const before = text.slice(0, offset);

        const match = before.match(/^(\s*)(\d+)\.\s*(.*)$/);
        if (match) {
          e.preventDefault();
          const indent = match[1];
          const num = parseInt(match[2], 10);
          const lineContent = match[3];

          if (!lineContent.trim()) {
            // Empty number item -> clear number and end list
            document.execCommand("insertParagraph", false);
          } else {
            // Next number
            document.execCommand("insertParagraph", false);
            document.execCommand("insertText", false, `${num + 1}. `);
          }
          if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            setContent(html);
            triggerAutosave(title, html, meta);
          }
          return;
        }
      }
    }

    // Convert typing "1. " into native ordered list
    if (e.key === " " && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const anchor = sel.anchorNode;
        const text = anchor?.textContent || "";
        const offset = sel.anchorOffset;
        const before = text.slice(0, offset);
        if (before === "1.") {
          e.preventDefault();
          document.execCommand("delete", false);
          document.execCommand("delete", false);
          document.execCommand("insertOrderedList", false);
          if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            setContent(html);
            triggerAutosave(title, html, meta);
          }
          return;
        }
      }
    }

    if (e.key === "Escape") {
      setSlashMenuOpen(false);
      setBlockMenuOpen(false);
      setShowColorPicker(false);
      setShowTableMenu(false);
    }
  };

  // Add new document
  const handleAddPage = async (parentId?: string) => {
    const initialMeta: DocMeta = parentId ? { parentId, icon: "📄" } : { icon: "📄" };
    const defaultBody = serializeMeta(initialMeta, "<p>Write your notes here…</p>");

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("title", parentId ? "New Subpage" : "New Document");
    fd.set("body", defaultBody);

    const res = await quickCreateProjectDocument(fd);
    if (res?.ok && res.document) {
      const newDoc: DocItem = {
        id: res.document.id,
        title: res.document.title,
        body_markdown: defaultBody,
        updated_at: new Date().toISOString(),
      };
      setDocList((prev) => [newDoc, ...prev]);
      router.push(`/projects/${projectId}/documents/${res.document.id}`);
    }
  };

  // Slash command options matching ClickUp
  const slashCommands = [
    {
      id: "toggle",
      label: "Toggle list",
      category: "Suggestions",
      icon: <ListFilter size={14} />,
      action: () =>
        insertRichHTML(
          `<details class="doc-toggle-block" open><summary class="doc-toggle-summary">Toggle Question or Header</summary><div class="doc-toggle-body"><p>Answer or content goes here.</p><ul><li>Point 1</li><li>Point 2</li></ul></div></details><p><br/></p>`
        ),
    },
    {
      id: "checklist",
      label: "Checklist",
      category: "Suggestions",
      icon: <CheckSquare size={14} />,
      action: () =>
        insertRichHTML(
          `<ul class="doc-checklist" style="list-style:none;padding-left:0;"><li><input type="checkbox" /> Task item</li><li><input type="checkbox" /> Another item</li></ul><p><br/></p>`
        ),
    },
    {
      id: "banner",
      label: "Banners / Callout",
      category: "Suggestions",
      icon: <Sparkles size={14} />,
      action: () =>
        insertRichHTML(
          `<div class="doc-callout-banner callout-note"><strong>💡 Note:</strong> Key takeaway or important context for the team.</div><p><br/></p>`
        ),
    },
    {
      id: "table",
      label: "ClickUp List (Table)",
      category: "Suggestions",
      icon: <Columns size={14} />,
      action: () =>
        insertRichHTML(
          `<table class="doc-table"><thead><tr><th>Column 1</th><th>Column 2</th><th>Status</th></tr></thead><tbody><tr><td>Item 1</td><td>Details</td><td>Active</td></tr><tr><td>Item 2</td><td>Details</td><td>Pending</td></tr></tbody></table><p><br/></p>`
        ),
    },
    {
      id: "image",
      label: "Add Image",
      category: "Suggestions",
      icon: <ImageIcon size={14} />,
      action: () => {
        fileInputRef.current?.click();
      },
    },
    {
      id: "whiteboard",
      label: "Create Whiteboard",
      category: "Suggestions",
      icon: <Layout size={14} />,
      action: () =>
        insertRichHTML(
          `<p><a href="/projects/${projectId}?view=whiteboard" class="doc-link-pill">🎨 Open Project Whiteboard</a></p><p><br/></p>`
        ),
    },
    {
      id: "h1",
      label: "Heading 1",
      category: "Text",
      icon: <Heading1 size={14} />,
      action: () => execRichCmd("formatBlock", "<h1>"),
    },
    {
      id: "h2",
      label: "Heading 2",
      category: "Text",
      icon: <Heading2 size={14} />,
      action: () => execRichCmd("formatBlock", "<h2>"),
    },
    {
      id: "h3",
      label: "Heading 3",
      category: "Text",
      icon: <Heading3 size={14} />,
      action: () => execRichCmd("formatBlock", "<h3>"),
    },
    {
      id: "bullet",
      label: "Bullet list",
      category: "Text",
      icon: <List size={14} />,
      action: () => execRichCmd("insertUnorderedList"),
    },
    {
      id: "number",
      label: "Numbered list",
      category: "Text",
      icon: <ListOrdered size={14} />,
      action: () => execRichCmd("insertOrderedList"),
    },
    {
      id: "code",
      label: "Code block",
      category: "Text",
      icon: <Code size={14} />,
      action: () =>
        insertRichHTML(
          `<pre class="doc-code-block"><code>// Your code here\nconsole.log("Hello world");</code></pre><p><br/></p>`
        ),
    },
    {
      id: "divider",
      label: "Divider",
      category: "Text",
      icon: <Minus size={14} />,
      action: () => insertRichHTML("<hr /><p><br/></p>"),
    },
  ];

  const filteredCommands = slashCommands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
      cmd.category.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const subpagesOfCurrent = activeDoc ? getSubpages(activeDoc.id) : [];

  const treeMatches = (doc: DocItem, query: string): boolean =>
    doc.title.toLowerCase().includes(query.toLowerCase()) ||
    getSubpages(doc.id).some((child) => treeMatches(child, query));

  function renderTreeNode(doc: DocItem, depth = 0): React.ReactNode {
    const children = getSubpages(doc.id);
    const collapsed = collapsedParents[doc.id] ?? false;
    const { meta: nodeMeta } = parseMeta(doc.body_markdown);
    const selected = doc.id === activeDocId;
    return (
      <div key={doc.id} className="doc-tree-node">
        <div className={`doc-tree-row${selected ? " is-active" : ""}`} style={{ paddingLeft: 8 + depth * 14 }}>
          {children.length > 0 ? <button type="button" className="doc-tree-expand" aria-label={`${collapsed ? "Expand" : "Collapse"} ${doc.title}`} onClick={() => setCollapsedParents((prev) => ({ ...prev, [doc.id]: !collapsed }))}>{collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button> : <span className="doc-tree-spacer" />}
          <Link href={`/projects/${projectId}/documents/${doc.id}`} className="doc-tree-link">
            <span className="doc-tree-icon">{getDocIcon(doc.body_markdown, nodeMeta.icon)}</span><span className="doc-tree-label">{doc.title}</span>
          </Link>
          <button type="button" className="doc-tree-add-sub" onClick={() => handleAddPage(doc.id)} title={`Add subpage under ${doc.title}`}><Plus size={11} /></button>
        </div>
        {!collapsed && children.filter((child) => !searchQuery || treeMatches(child, searchQuery)).map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="clickup-doc-layout">
      {/* Toast Notification */}
      {toastMessage && <div className="doc-toast">{toastMessage}</div>}

      {/* Left Sidebar - Pages Tree Navigation (matching Image 1) */}
      <aside className="doc-sidebar-tree">
        <div className="doc-sidebar-top">
          <div className="doc-breadcrumb">
            <span className="doc-kb-tag">Knowledge Base</span>
            <span className="doc-crumb-sep">/</span>
            <span className="doc-crumb-active">{projectName}</span>
          </div>

          <div className="doc-sidebar-search">
            <Search size={13} className="search-icon" />
            <input
              type="text"
              placeholder="Search pages…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "inline-flex", padding: 2, background: "var(--nav-hover, #f1f5f9)", borderRadius: 6, width: "100%" }}>
            <button
              type="button"
              onClick={() => setSidebarTab("pages")}
              style={{
                flex: 1,
                padding: "4px 6px",
                border: 0,
                borderRadius: 5,
                fontSize: 11,
                fontWeight: sidebarTab === "pages" ? 700 : 500,
                background: sidebarTab === "pages" ? "var(--paper, #fff)" : "transparent",
                color: sidebarTab === "pages" ? "#167c58" : "var(--muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                boxShadow: sidebarTab === "pages" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <FileText size={11} />
              <span>Pages ({documents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("files")}
              style={{
                flex: 1,
                padding: "4px 6px",
                border: 0,
                borderRadius: 5,
                fontSize: 11,
                fontWeight: sidebarTab === "files" ? 700 : 500,
                background: sidebarTab === "files" ? "var(--paper, #fff)" : "transparent",
                color: sidebarTab === "files" ? "#167c58" : "var(--muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                boxShadow: sidebarTab === "files" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <Paperclip size={11} />
              <span>Files ({taskAttachments.length})</span>
            </button>
          </div>
        </div>

        <nav className="doc-tree-nav">
          {rootDocs
            .filter((doc) => !searchQuery || treeMatches(doc, searchQuery))
            .map((root) => renderTreeNode(root))}
        </nav>

        <div className="doc-sidebar-footer">
          <button
            type="button"
            className="doc-sidebar-add-btn"
            onClick={() => handleAddPage()}
          >
            <Plus size={13} />
            <span>Add page</span>
          </button>
        </div>
      </aside>

      {/* Main Document Content Area (matching Image 1 & 3) */}
      {sidebarTab === "files" ? (
        <main className="doc-content-workspace" style={{ overflow: "auto" }}>
          <ProjectAttachmentsClient
            projectId={projectId}
            projectName={projectName}
            attachments={taskAttachments}
          />
        </main>
      ) : canvasInfo ? (
        <main className="doc-content-workspace" style={{ overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{canvasInfo.type === "whiteboard" ? "🎨" : "🔀"}</span>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{activeDoc?.title}</h2>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  Interactive {canvasInfo.type === "whiteboard" ? "Whiteboard" : "Flowchart"} Canvas
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href={`/projects/${projectId}?view=${canvasInfo.type === "whiteboard" ? "whiteboard" : "flowchart"}`}
                className="doc-quick-btn"
                style={{ border: "1px solid var(--line)", padding: "5px 10px", borderRadius: 6, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <ExternalLink size={12} /> Open in Project Tab
              </Link>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {canvasInfo.type === "whiteboard" ? (
              <WhiteboardCanvas
                key={activeDoc?.id}
                initialData={canvasInfo.content}
                title={activeDoc?.title}
                onSave={async ({ title: newTitle, data }) => {
                  if (!activeDoc) return;
                  const fd = new FormData();
                  fd.set("projectId", projectId);
                  fd.set("title", newTitle);
                  fd.set("type", "whiteboard");
                  fd.set("data", data);
                  fd.set("documentId", activeDoc.id);
                  await saveCanvasData(fd);
                  setTitle(newTitle);
                  setDocList((prev) =>
                    prev.map((d) =>
                      d.id === activeDoc.id
                        ? { ...d, title: newTitle, body_markdown: JSON.stringify({ canvasType: "whiteboard", content: data }) }
                        : d
                    )
                  );
                  showToast("Whiteboard saved successfully");
                }}
              />
            ) : (
              <FlowchartCanvas
                key={activeDoc?.id}
                initialData={canvasInfo.content}
                title={activeDoc?.title}
                onSave={async ({ title: newTitle, data }) => {
                  if (!activeDoc) return;
                  const fd = new FormData();
                  fd.set("projectId", projectId);
                  fd.set("title", newTitle);
                  fd.set("type", "flowchart");
                  fd.set("data", data);
                  fd.set("documentId", activeDoc.id);
                  await saveCanvasData(fd);
                  setTitle(newTitle);
                  setDocList((prev) =>
                    prev.map((d) =>
                      d.id === activeDoc.id
                        ? { ...d, title: newTitle, body_markdown: JSON.stringify({ canvasType: "flowchart", content: data }) }
                        : d
                    )
                  );
                  showToast("Flowchart saved successfully");
                }}
              />
            )}
          </div>
        </main>
      ) : (
        <main className="doc-content-workspace">
        {/* Cover Banner (if set) */}
        {meta.cover && (
          <div className="doc-cover-banner" style={{ background: meta.cover }}>
            <button
              type="button"
              className="doc-cover-remove"
              onClick={() => {
                const nextMeta = { ...meta, cover: undefined };
                setMeta(nextMeta);
                triggerAutosave(title, content, nextMeta);
              }}
            >
              <X size={13} /> Remove Cover
            </button>
          </div>
        )}

        <div className="doc-content-inner">
          {/* Top Quick Actions Bar (Image 1 & 3) */}
          <div className="doc-top-quickbar">
            <div className="quickbar-left">
              <button
                type="button"
                className="doc-quick-btn"
                onClick={() =>
                  insertRichHTML(`<p><a href="/projects/${projectId}" class="doc-link-pill">🔗 Link to Project Tasks</a></p><p><br/></p>`)
                }
              >
                <ExternalLink size={12} />
                <span>Link Task or Doc</span>
              </button>

              <button
                type="button"
                className={`doc-quick-btn${meta.isWiki ? " is-wiki" : ""}`}
                onClick={() => {
                  const nextMeta = { ...meta, isWiki: !meta.isWiki };
                  setMeta(nextMeta);
                  triggerAutosave(title, content, nextMeta);
                }}
              >
                <Check size={12} />
                <span>{meta.isWiki ? "Wiki Verified" : "Mark Wiki"}</span>
              </button>

              {activeDoc && (
                <FavoriteButton
                  key={activeDoc.id}
                  entityType="document"
                  entityId={activeDoc.id}
                  projectId={projectId}
                  title={title || activeDoc.title}
                  subtitle={`${projectName} · Document`}
                  initialFavorited={favoriteDocIds.includes(activeDoc.id)}
                  label="Favorite"
                  compact
                />
              )}

              <button
                type="button"
                className="doc-quick-btn"
                onClick={() => setShowEmojiPicker((v) => !v)}
              >
                <Smile size={12} />
                <span>{meta.icon ? `Icon ${meta.icon}` : "Add icon"}</span>
              </button>

              {!meta.cover && (
                <button
                  type="button"
                  className="doc-quick-btn"
                  onClick={() => {
                    const preset = COVER_PRESETS[Math.floor(Math.random() * COVER_PRESETS.length)];
                    const nextMeta = { ...meta, cover: preset };
                    setMeta(nextMeta);
                    triggerAutosave(title, content, nextMeta);
                  }}
                >
                  <ImageIcon size={12} />
                  <span>Add cover</span>
                </button>
              )}

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="doc-emoji-popover">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-choice-btn"
                      onClick={() => {
                        const nextMeta = { ...meta, icon: emoji };
                        setMeta(nextMeta);
                        triggerAutosave(title, content, nextMeta);
                        setShowEmojiPicker(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="quickbar-right">
              {/* Save state pill */}
              <span className={`doc-save-pill ${saveStatus}`}>
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Saving…
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <Check size={11} /> Saved
                  </>
                ) : (
                  "Unsaved"
                )}
              </span>

              {/* View mode toggle */}
              <div className="doc-view-mode-tabs">
                <button
                  type="button"
                  className={`doc-mode-tab${viewMode === "edit" ? " is-active" : ""}`}
                  onClick={() => setViewMode("edit")}
                  title="Editor"
                >
                  <Edit3 size={12} />
                </button>
                <button
                  type="button"
                  className={`doc-mode-tab${viewMode === "split" ? " is-active" : ""}`}
                  onClick={() => setViewMode("split")}
                  title="Split View"
                >
                  <Columns2 size={12} />
                </button>
                <button
                  type="button"
                  className={`doc-mode-tab${viewMode === "preview" ? " is-active" : ""}`}
                  onClick={() => setViewMode("preview")}
                  title="Reading View"
                >
                  <Eye size={12} />
                </button>
              </div>

              {activeDocId && (
                <>
                  <a
                    className="doc-quick-btn"
                    href={`/api/projects/${projectId}/documents/${activeDocId}.html`}
                    target="_blank"
                    rel="noreferrer"
                    title="Export HTML"
                  >
                    <Download size={12} />
                  </a>
                  <button
                    type="button"
                    className="doc-quick-btn"
                    onClick={() => window.print()}
                    title="Print Document"
                  >
                    <Printer size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Document Header (Image 1 & 3) */}
          <div className="doc-page-header">
            <div className="doc-icon-display">{meta.icon || "📄"}</div>

            <input
              type="text"
              className="doc-main-title-input"
              value={title}
              onChange={(e) => {
                const val = e.target.value;
                setTitle(val);
                triggerAutosave(val, content, meta);
              }}
              placeholder="Untitled Document"
            />

            <div className="doc-meta-row">
              <div className="doc-author-avatar">
                {currentUserName.charAt(0).toUpperCase()}
              </div>
              <span className="doc-author-name">{currentUserName}</span>
              <span className="doc-meta-bullet">·</span>
              <span className="doc-updated-text">
                Last updated{" "}
                {activeDoc
                  ? new Date(activeDoc.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "Just now"}
              </span>
            </div>
          </div>

          {/* Subpages Cards Table (Image 1) */}
          {subpagesOfCurrent.length > 0 && (
            <div className="doc-subpages-table-wrap">
              <div className="subpages-header">
                <span>Subpages</span>
                <span className="subpages-col-head">Owner</span>
                <span className="subpages-col-head">Contributors</span>
              </div>
              <div className="subpages-rows">
                {subpagesOfCurrent.map((sub) => {
                  const { meta: sMeta } = parseMeta(sub.body_markdown);
                  return (
                    <Link
                      key={sub.id}
                      href={`/projects/${projectId}/documents/${sub.id}`}
                      className="subpage-table-row"
                    >
                      <div className="subpage-row-left">
                        <span className="subpage-icon">{getDocIcon(sub.body_markdown, sMeta.icon)}</span>
                        <span className="subpage-title">{sub.title}</span>
                      </div>
                      <div className="subpage-row-owner">
                        <span className="owner-mini-avatar">
                          {currentUserName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="subpage-row-contributors">
                        <span className="contrib-icon">👥</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Direct Block Formatting Toolbar (Always Visible) */}
          <div className="doc-block-toolbar">
            <div className="doc-block-toolbar-left">
              {/* + Insert Block Dropdown Menu */}
              <div className="doc-toolbar-dropdown-wrap">
                <button
                  type="button"
                  className="doc-add-block-btn"
                  onClick={() => setBlockMenuOpen((v) => !v)}
                  title="Insert any block"
                >
                  <Plus size={13} />
                  <span>Insert Block</span>
                  <ChevronDown size={11} className={`dropdown-arrow${blockMenuOpen ? " is-open" : ""}`} />
                </button>

                {blockMenuOpen && (
                  <div className="doc-toolbar-popover-menu">
                    <div className="doc-popover-title">SUGGESTIONS</div>
                    {slashCommands
                      .filter((c) => c.category === "Suggestions")
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="doc-popover-item"
                          onClick={() => {
                            c.action();
                            setBlockMenuOpen(false);
                          }}
                        >
                          <span className="popover-icon">{c.icon}</span>
                          <span className="popover-label">{c.label}</span>
                        </button>
                      ))}

                    <div className="doc-popover-title">TEXT & HEADINGS</div>
                    {slashCommands
                      .filter((c) => c.category === "Text")
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="doc-popover-item"
                          onClick={() => {
                            c.action();
                            setBlockMenuOpen(false);
                          }}
                        >
                          <span className="popover-icon">{c.icon}</span>
                          <span className="popover-label">{c.label}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="doc-toolbar-sep" />

              {/* Word-style Rich Text Formatting Buttons */}
              <div className="doc-word-fmt-group" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <button
                  type="button"
                  className="doc-toolbar-btn doc-fmt-btn"
                  title="Bold (Ctrl+B)"
                  onClick={() => execRichCmd("bold")}
                >
                  <Bold size={12} />
                  <span style={{ fontWeight: 800 }}>B</span>
                </button>
                <button
                  type="button"
                  className="doc-toolbar-btn doc-fmt-btn"
                  title="Italic (Ctrl+I)"
                  onClick={() => execRichCmd("italic")}
                >
                  <Italic size={12} />
                  <span style={{ fontStyle: "italic" }}>I</span>
                </button>
                <button
                  type="button"
                  className="doc-toolbar-btn doc-fmt-btn"
                  title="Underline (Ctrl+U)"
                  onClick={() => execRichCmd("underline")}
                >
                  <Underline size={12} />
                  <span style={{ textDecoration: "underline" }}>U</span>
                </button>
                <button
                  type="button"
                  className="doc-toolbar-btn doc-fmt-btn"
                  title="Strikethrough"
                  onClick={() => execRichCmd("strikeThrough")}
                >
                  <Strikethrough size={12} />
                  <span style={{ textDecoration: "line-through" }}>S</span>
                </button>

                {/* Font Size Selector */}
                <div className="doc-toolbar-btn doc-fmt-btn" style={{ padding: "0 4px", gap: "2px" }} title="Font Size">
                  <Type size={12} />
                  <select
                    className="doc-font-size-select"
                    defaultValue="14px"
                    onChange={(e) => setFontSize(e.target.value)}
                    aria-label="Font size"
                  >
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="22px">22px</option>
                    <option value="28px">28px</option>
                  </select>
                </div>

                {/* Font Color Picker */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="doc-toolbar-btn doc-fmt-btn"
                    title="Font Color"
                    onClick={() => setShowColorPicker((v) => !v)}
                  >
                    <Palette size={12} />
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>Color</span>
                  </button>

                  {showColorPicker && (
                    <div className="doc-color-picker-popover">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          className="color-swatch-btn"
                          style={{ background: c.color }}
                          title={c.label}
                          onClick={() => setFontColor(c.color)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="doc-toolbar-btn doc-fmt-btn"
                  title="Inline Code"
                  onClick={() => insertRichHTML("<code>code</code>")}
                >
                  <Code size={12} />
                </button>
                <button
                  type="button"
                  className="doc-toolbar-btn doc-fmt-btn"
                  title="Quote Block"
                  onClick={() => insertRichHTML("<blockquote>Quote text</blockquote><p><br/></p>")}
                >
                  <Quote size={12} />
                </button>
              </div>

              <div className="doc-toolbar-sep" />

              {/* Direct 1-Click Action Buttons */}
              <button
                type="button"
                className="doc-toolbar-btn highlight-btn"
                title="Insert Collapsible Toggle List"
                onClick={() =>
                  insertRichHTML(
                    `<details class="doc-toggle-block" open><summary class="doc-toggle-summary">Toggle Question or Header</summary><div class="doc-toggle-body"><p>Answer or content goes here.</p><ul><li>Point 1</li><li>Point 2</li></ul></div></details><p><br/></p>`
                  )
                }
              >
                <ListFilter size={12} />
                <span>Toggle List</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Heading 1"
                onClick={() => execRichCmd("formatBlock", "<h1>")}
              >
                <Heading1 size={12} />
                <span>H1</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Heading 2"
                onClick={() => execRichCmd("formatBlock", "<h2>")}
              >
                <Heading2 size={12} />
                <span>H2</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Checklist"
                onClick={() =>
                  insertRichHTML(
                    `<ul class="doc-checklist" style="list-style:none;padding-left:0;"><li><input type="checkbox" /> Task item</li><li><input type="checkbox" /> Another item</li></ul><p><br/></p>`
                  )
                }
              >
                <CheckSquare size={12} />
                <span>Checklist</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Bullet List"
                onClick={() => execRichCmd("insertUnorderedList")}
              >
                <List size={12} />
                <span>Bullets</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Numbered List"
                onClick={() => execRichCmd("insertOrderedList")}
              >
                <ListOrdered size={12} />
                <span>Numbered</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Callout Banner"
                onClick={() =>
                  insertRichHTML(
                    `<div class="doc-callout-banner callout-note"><strong>💡 Note:</strong> Key takeaway or important context for the team.</div><p><br/></p>`
                  )
                }
              >
                <Sparkles size={12} />
                <span>Callout</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Upload or paste image"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={12} />
                <span>Add Image</span>
              </button>

              {/* Table Management with Add Row / Column Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="doc-toolbar-btn"
                  title="Table Options"
                  onClick={() => setShowTableMenu((v) => !v)}
                >
                  <Columns size={12} />
                  <span>Table ▾</span>
                </button>

                {showTableMenu && (
                  <div className="doc-table-menu">
                    <button
                      type="button"
                      className="doc-table-menu-item"
                      onClick={() => {
                        insertRichHTML(
                          `<table class="doc-table"><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td><td>Cell 3</td></tr><tr><td>Cell 4</td><td>Cell 5</td><td>Cell 6</td></tr></tbody></table><p><br/></p>`
                        );
                        setShowTableMenu(false);
                      }}
                    >
                      <Plus size={12} />
                      <span>Insert New Table</span>
                    </button>
                    <button
                      type="button"
                      className="doc-table-menu-item"
                      onClick={() => {
                        addTableRow();
                        setShowTableMenu(false);
                      }}
                    >
                      <Plus size={12} />
                      <span>+ Add Row</span>
                    </button>
                    <button
                      type="button"
                      className="doc-table-menu-item"
                      onClick={() => {
                        addTableColumn();
                        setShowTableMenu(false);
                      }}
                    >
                      <Plus size={12} />
                      <span>+ Add Column</span>
                    </button>
                    <button
                      type="button"
                      className="doc-table-menu-item"
                      onClick={() => {
                        removeTableRow();
                        setShowTableMenu(false);
                      }}
                    >
                      <Minus size={12} />
                      <span>- Delete Row</span>
                    </button>
                    <button
                      type="button"
                      className="doc-table-menu-item"
                      onClick={() => {
                        removeTableColumn();
                        setShowTableMenu(false);
                      }}
                    >
                      <Minus size={12} />
                      <span>- Delete Column</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Attach Project Whiteboard"
                onClick={() =>
                  insertRichHTML(
                    `<p><a href="/projects/${projectId}?view=whiteboard" class="doc-link-pill">🎨 Open Project Whiteboard</a></p><p><br/></p>`
                  )
                }
              >
                <Layout size={12} />
                <span>Whiteboard</span>
              </button>
            </div>

            <div className="doc-block-toolbar-right">
              <span className="doc-toolbar-hint">
                Type <kbd>/</kbd> for commands
              </span>
            </div>

            {/* Hidden File Picker for Image Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  compressAndInsertImage(file);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {/* Main Editor & Render Area */}
          <div className={`doc-editor-grid ${viewMode}`}>
            {/* Writing / Editing view */}
            {(viewMode === "edit" || viewMode === "split") && (
              <div className="doc-textarea-container">
                {/* Floating Image Resizer Bar (Appears when an image is selected) */}
                {selectedImg && (
                  <div className="doc-img-resizer-bar">
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", marginRight: "4px" }}>
                      Resize Image:
                    </span>
                    <button type="button" onClick={() => resizeSelectedImg("25%")}>25%</button>
                    <button type="button" onClick={() => resizeSelectedImg("50%")}>50%</button>
                    <button type="button" onClick={() => resizeSelectedImg("75%")}>75%</button>
                    <button type="button" onClick={() => resizeSelectedImg("100%")}>100%</button>
                    <button type="button" onClick={deleteSelectedImg} style={{ color: "#ef4444" }}>
                      <Trash2 size={11} /> Remove
                    </button>
                    <button type="button" onClick={() => setSelectedImg(null)} style={{ marginLeft: "4px" }}>
                      Done ✓
                    </button>
                  </div>
                )}

                <div
                  ref={editorRef}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="doc-clickup-wysiwyg"
                  onClick={handleEditorClick}
                  onInput={(e) => {
                    const html = e.currentTarget.innerHTML;
                    setContent(html);
                    triggerAutosave(title, html, meta);
                  }}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onKeyDown={handleKeyDown}
                  data-placeholder="Write notes, insert images, tables, checklists or type '/' for commands..."
                />

                {/* Floating Slash Commands Menu (matching Image 2) */}
                {slashMenuOpen && (
                  <div className="doc-slash-menu">
                    <div className="slash-menu-header">
                      <span>SUGGESTIONS</span>
                      <button
                        type="button"
                        className="slash-close-btn"
                        onClick={() => setSlashMenuOpen(false)}
                      >
                        ×
                      </button>
                    </div>

                    <div className="slash-menu-list">
                      {filteredCommands.map((cmd) => (
                        <button
                          key={cmd.id}
                          type="button"
                          className="slash-menu-item"
                          onClick={() => {
                            cmd.action();
                            setSlashMenuOpen(false);
                          }}
                        >
                          <span className="slash-item-icon">{cmd.icon}</span>
                          <span className="slash-item-label">{cmd.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reading / Preview View (with Toggle lists like Image 3) */}
            {(viewMode === "preview" || viewMode === "split") && (
              <div
                className="doc-rendered-preview"
                dangerouslySetInnerHTML={{
                  __html: markdownToSafeHtml(content) || "<p className='text-muted'>Empty document.</p>",
                }}
              />
            )}
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
