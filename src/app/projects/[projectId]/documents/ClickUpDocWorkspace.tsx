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
} from "lucide-react";
import {
  quickCreateProjectDocument,
  quickSaveProjectDocument,
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

export default function ClickUpDocWorkspace({
  projectId,
  projectName,
  documents,
  currentDocId,
  currentUserName = "Charan Dukka",
}: {
  projectId: string;
  projectName: string;
  documents: DocItem[];
  currentDocId?: string;
  currentUserName?: string;
}) {
  const router = useRouter();

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
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  }, [activeDocId]);

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
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

      insertSnippet(`\n![${file.name || "Pasted image"}](${dataUrl})\n`);
      showToast("Image pasted successfully!");
    } catch (err) {
      console.error("Image paste error", err);
      showToast("Could not paste image.");
    }
  };

  const insertSnippet = (snippet: string, isFromSlash = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    let currentVal = textarea.value;

    // Strip preceding '/' if invoked from slash menu or preceded by '/'
    if (isFromSlash || (start > 0 && currentVal[start - 1] === "/")) {
      if (start > 0 && currentVal[start - 1] === "/") {
        currentVal = currentVal.slice(0, start - 1) + currentVal.slice(start);
        start = start - 1;
        end = Math.max(start, end - 1);
      }
    } else if (slashMenuOpen && cursorIndex >= 0 && currentVal[cursorIndex] === "/") {
      currentVal = currentVal.slice(0, cursorIndex) + currentVal.slice(cursorIndex + 1);
      if (start > cursorIndex) start = start - 1;
      if (end > cursorIndex) end = Math.max(start, end - 1);
    }

    const nextVal = currentVal.slice(0, start) + snippet + currentVal.slice(end);
    setContent(nextVal);
    triggerAutosave(title, nextVal, meta);
    setSlashMenuOpen(false);
    setBlockMenuOpen(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + snippet.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 50);
  };

  // Paste handler — supports copied images (Ctrl+C → Ctrl+V) from browser, files, screenshots
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

    // Check clipboard files array (drag-drop, some browsers put images here)
    const files = clipData.files;
    if (files && files.length > 0 && files[0].type.startsWith("image/")) {
      e.preventDefault();
      compressAndInsertImage(files[0]);
      return;
    }

    // Check for HTML content that contains an <img> tag (copy image from webpage)
    const html = clipData.getData("text/html");
    if (html) {
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        const imgSrc = imgMatch[1];
        // If it's a data URL, insert directly
        if (imgSrc.startsWith("data:image/")) {
          e.preventDefault();
          insertSnippet(`\n![Pasted image](${imgSrc})\n`);
          return;
        }
        // If it's an http(s) URL, insert as markdown image
        if (imgSrc.startsWith("http://") || imgSrc.startsWith("https://")) {
          e.preventDefault();
          insertSnippet(`\n![Pasted image](${imgSrc})\n`);
          return;
        }
      }
    }
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = e.dataTransfer?.files;
    if (files && files[0] && files[0].type.startsWith("image/")) {
      e.preventDefault();
      compressAndInsertImage(files[0]);
    }
  };

  // Keyboard navigation & slash commands + auto-continue lists
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;

    // Auto-continue bullet and numbered lists on Enter
    if (e.key === "Enter" && !e.shiftKey && !slashMenuOpen) {
      const cursorPos = textarea.selectionStart;
      const val = textarea.value;

      // Find the current line
      const lineStart = val.lastIndexOf("\n", cursorPos - 1) + 1;
      const currentLine = val.slice(lineStart, cursorPos);

      // Check for numbered list: "  3. some text" → next line "  4. "
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (numberedMatch) {
        const indent = numberedMatch[1];
        const num = parseInt(numberedMatch[2], 10);
        const lineContent = numberedMatch[3];

        // If current line content is empty, remove the list prefix and stop continuing
        if (!lineContent.trim()) {
          e.preventDefault();
          const nextVal = val.slice(0, lineStart) + "\n" + val.slice(cursorPos);
          setContent(nextVal);
          triggerAutosave(title, nextVal, meta);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart + 1, lineStart + 1);
          }, 10);
          return;
        }

        e.preventDefault();
        const nextNum = num + 1;
        const insertion = `\n${indent}${nextNum}. `;
        const nextVal = val.slice(0, cursorPos) + insertion + val.slice(textarea.selectionEnd);
        setContent(nextVal);
        triggerAutosave(title, nextVal, meta);
        setTimeout(() => {
          const newPos = cursorPos + insertion.length;
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
        }, 10);
        return;
      }

      // Check for checklist: "- [ ] some text" → next line "- [ ] "
      const checklistMatch = currentLine.match(/^(\s*)[-*+]\s\[[ xX]\]\s(.*)$/);
      if (checklistMatch) {
        const indent = checklistMatch[1];
        const lineContent = checklistMatch[2];

        if (!lineContent.trim()) {
          e.preventDefault();
          const nextVal = val.slice(0, lineStart) + "\n" + val.slice(cursorPos);
          setContent(nextVal);
          triggerAutosave(title, nextVal, meta);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart + 1, lineStart + 1);
          }, 10);
          return;
        }

        e.preventDefault();
        const insertion = `\n${indent}- [ ] `;
        const nextVal = val.slice(0, cursorPos) + insertion + val.slice(textarea.selectionEnd);
        setContent(nextVal);
        triggerAutosave(title, nextVal, meta);
        setTimeout(() => {
          const newPos = cursorPos + insertion.length;
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
        }, 10);
        return;
      }

      // Check for bullet list: "  - some text" → next line "  - "
      const bulletMatch = currentLine.match(/^(\s*)[-*+]\s(.*)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1];
        const lineContent = bulletMatch[2];
        const bulletChar = currentLine.trim()[0]; // -, *, or +

        if (!lineContent.trim()) {
          e.preventDefault();
          const nextVal = val.slice(0, lineStart) + "\n" + val.slice(cursorPos);
          setContent(nextVal);
          triggerAutosave(title, nextVal, meta);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart + 1, lineStart + 1);
          }, 10);
          return;
        }

        e.preventDefault();
        const insertion = `\n${indent}${bulletChar} `;
        const nextVal = val.slice(0, cursorPos) + insertion + val.slice(textarea.selectionEnd);
        setContent(nextVal);
        triggerAutosave(title, nextVal, meta);
        setTimeout(() => {
          const newPos = cursorPos + insertion.length;
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
        }, 10);
        return;
      }
    }

    // Slash command trigger
    if (e.key === "/" && !slashMenuOpen) {
      setSlashMenuOpen(true);
      setSlashQuery("");
      setCursorIndex(textarea.selectionStart);
    } else if (slashMenuOpen) {
      if (e.key === "Escape") {
        setSlashMenuOpen(false);
      }
    }
  };

  // Add new document
  const handleAddPage = async (parentId?: string) => {
    const initialMeta: DocMeta = parentId ? { parentId, icon: "📄" } : { icon: "📄" };
    const defaultBody = serializeMeta(initialMeta, "# Untitled Page\n\nWrite your notes here…\n");

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

  // Slash command options matching ClickUp (Image 2)
  const slashCommands = [
    {
      id: "toggle",
      label: "Toggle list",
      category: "Suggestions",
      icon: <ListFilter size={14} />,
      action: (fromSlash = false) =>
        insertSnippet(
          "\n:::toggle Toggle Question or Header\nAnswer or content goes here.\n\n- Point 1\n- Point 2\n:::\n",
          fromSlash
        ),
    },
    {
      id: "checklist",
      label: "Checklist",
      category: "Suggestions",
      icon: <CheckSquare size={14} />,
      action: (fromSlash = false) => insertSnippet("\n- [ ] Task item\n- [ ] Another item\n", fromSlash),
    },
    {
      id: "banner",
      label: "Banners / Callout",
      category: "Suggestions",
      icon: <Sparkles size={14} />,
      action: (fromSlash = false) => insertSnippet("\n> [!NOTE] Key takeaway or important context for the team.\n", fromSlash),
    },
    {
      id: "table",
      label: "ClickUp List (Table)",
      category: "Suggestions",
      icon: <Columns size={14} />,
      action: (fromSlash = false) =>
        insertSnippet("\n| Column 1 | Column 2 | Status |\n|---|---|---|\n| Item 1 | Details | Active |\n", fromSlash),
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
      action: (fromSlash = false) =>
        insertSnippet(
          `\n[🎨 Open Project Whiteboard](/projects/${projectId}?view=whiteboard)\n`,
          fromSlash
        ),
    },
    {
      id: "h1",
      label: "Heading 1",
      category: "Text",
      icon: <Heading1 size={14} />,
      action: (fromSlash = false) => insertSnippet("\n# ", fromSlash),
    },
    {
      id: "h2",
      label: "Heading 2",
      category: "Text",
      icon: <Heading2 size={14} />,
      action: (fromSlash = false) => insertSnippet("\n## ", fromSlash),
    },
    {
      id: "h3",
      label: "Heading 3",
      category: "Text",
      icon: <Heading3 size={14} />,
      action: (fromSlash = false) => insertSnippet("\n### ", fromSlash),
    },
    {
      id: "bullet",
      label: "Bullet list",
      category: "Text",
      icon: <List size={14} />,
      action: (fromSlash = false) => insertSnippet("\n- ", fromSlash),
    },
    {
      id: "number",
      label: "Numbered list",
      category: "Text",
      icon: <ListOrdered size={14} />,
      action: (fromSlash = false) => insertSnippet("\n1. ", fromSlash),
    },
    {
      id: "code",
      label: "Code block",
      category: "Text",
      icon: <Code size={14} />,
      action: (fromSlash = false) => insertSnippet("\n```typescript\n// Your code here\n```\n", fromSlash),
    },
    {
      id: "divider",
      label: "Divider",
      category: "Text",
      icon: <Minus size={14} />,
      action: (fromSlash = false) => insertSnippet("\n---\n", fromSlash),
    },
  ];

  const filteredCommands = slashCommands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
      cmd.category.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const subpagesOfCurrent = activeDoc ? getSubpages(activeDoc.id) : [];

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

        <div className="doc-pages-header">
          <span>Pages</span>
        </div>

        <nav className="doc-tree-nav">
          {rootDocs
            .filter((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((root) => {
              const subpages = getSubpages(root.id);
              const isCollapsed = collapsedParents[root.id] ?? false;
              const { meta: rMeta } = parseMeta(root.body_markdown);
              const isSelected = root.id === activeDocId;

              return (
                <div key={root.id} className="doc-tree-node">
                  <div className={`doc-tree-row${isSelected ? " is-active" : ""}`}>
                    {subpages.length > 0 ? (
                      <button
                        type="button"
                        className="doc-tree-expand"
                        onClick={() =>
                          setCollapsedParents((prev) => ({
                            ...prev,
                            [root.id]: !isCollapsed,
                          }))
                        }
                      >
                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                    ) : (
                      <span className="doc-tree-spacer" />
                    )}

                    <Link
                      href={`/projects/${projectId}/documents/${root.id}`}
                      className="doc-tree-link"
                    >
                      <span className="doc-tree-icon">{rMeta.icon || "📄"}</span>
                      <span className="doc-tree-label">{root.title}</span>
                    </Link>

                    <button
                      type="button"
                      className="doc-tree-add-sub"
                      onClick={() => handleAddPage(root.id)}
                      title="Add subpage"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  {/* Nested Subpages */}
                  {!isCollapsed && subpages.length > 0 && (
                    <div className="doc-tree-children">
                      {subpages.map((sub) => {
                        const { meta: sMeta } = parseMeta(sub.body_markdown);
                        const isSubSelected = sub.id === activeDocId;
                        return (
                          <div
                            key={sub.id}
                            className={`doc-tree-row doc-subpage-row${
                              isSubSelected ? " is-active" : ""
                            }`}
                          >
                            <span className="doc-tree-spacer" />
                            <Link
                              href={`/projects/${projectId}/documents/${sub.id}`}
                              className="doc-tree-link"
                            >
                              <span className="doc-tree-icon">{sMeta.icon || "📄"}</span>
                              <span className="doc-tree-label">{sub.title}</span>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
                  insertSnippet(`\n[🔗 Link to Task or Doc](/projects/${projectId})\n`)
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
                        <span className="subpage-icon">{sMeta.icon || "📄"}</span>
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
                            c.action(false);
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
                            c.action(false);
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

              {/* Direct 1-Click Action Buttons */}
              <button
                type="button"
                className="doc-toolbar-btn highlight-btn"
                title="Insert Collapsible Toggle List"
                onClick={() =>
                  insertSnippet(
                    `\n:::toggle Toggle Question or Header\nAnswer or content goes here.\n\n- Point 1\n- Point 2\n:::\n`,
                    false
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
                onClick={() => insertSnippet("\n# ", false)}
              >
                <Heading1 size={12} />
                <span>H1</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Heading 2"
                onClick={() => insertSnippet("\n## ", false)}
              >
                <Heading2 size={12} />
                <span>H2</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Checklist"
                onClick={() => insertSnippet("\n- [ ] Task item\n- [ ] Another item\n", false)}
              >
                <CheckSquare size={12} />
                <span>Checklist</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Bullet List"
                onClick={() => insertSnippet("\n- ", false)}
              >
                <List size={12} />
                <span>Bullets</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Numbered List"
                onClick={() => insertSnippet("\n1. ", false)}
              >
                <ListOrdered size={12} />
                <span>Numbered</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Callout Banner"
                onClick={() =>
                  insertSnippet("\n> [!NOTE] Key takeaway or important context for the team.\n", false)
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

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Data Table"
                onClick={() =>
                  insertSnippet(
                    "\n| Column 1 | Column 2 | Status |\n|---|---|---|\n| Item 1 | Details | Active |\n",
                    false
                  )
                }
              >
                <Columns size={12} />
                <span>Table</span>
              </button>

              <button
                type="button"
                className="doc-toolbar-btn"
                title="Attach Project Whiteboard"
                onClick={() =>
                  insertSnippet(
                    `\n[🎨 Open Project Whiteboard](/projects/${projectId}?view=whiteboard)\n`,
                    false
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
                <textarea
                  ref={textareaRef}
                  className="doc-clickup-textarea"
                  value={content}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContent(val);
                    triggerAutosave(title, val, meta);
                  }}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onKeyDown={handleKeyDown}
                  placeholder="Write, press 'space' for AI, '/' for commands"
                  rows={26}
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
                            cmd.action(true);
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
    </div>
  );
}
