"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Share2,
  History,
  Activity,
  MessageSquare,
  Lock,
  Clock,
  Shield,
  Globe,
  BookOpen,
  Copy,
  ChevronUp,
  Link2,
  MoveUp,
  MoveDown,
  MoreVertical,
  CheckCircle2,
  GripVertical,
  ListTree,
  Calendar,
  AlertTriangle,
  Lightbulb,
  Info,
  CornerDownRight,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  DocItem,
  DocPageItem,
  PageListingNode,
  DocBlock,
  DocComment,
  DocVersion,
  DocActivity,
  DocMember,
} from "@/lib/docs/types";
import { blocksToMarkdown, markdownToBlocks } from "@/lib/docs/blocks";
import FavoriteButton from "@/app/FavoriteButton";

interface ClickUpDocWorkspaceProps {
  workspaceId: string;
  projectId?: string;
  projectName?: string;
  workspaceName?: string;
  doc: DocItem;
  initialPages: PageListingNode[];
  initialActivePage: DocPageItem;
  currentUserId: string;
  currentUserName: string;
  favoriteDocIds?: string[];
  tasksInProject?: Array<{ id: string; title: string; status?: string; priority?: string }>;
}

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #065f46 0%, #064e3b 100%)",
  "linear-gradient(135deg, #1e40af 0%, #172554 100%)",
  "linear-gradient(135deg, #581c87 0%, #3b0764 100%)",
  "linear-gradient(135deg, #831843 0%, #500724 100%)",
  "linear-gradient(135deg, #9a3412 0%, #431407 100%)",
  "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
];

const EMOJI_LIST = ["📄", "📘", "💡", "🚀", "⚙️", "📝", "🎯", "🧪", "📌", "🔬", "📚", "✨", "🏛️", "🔌", "🎨", "🚨"];

export default function ClickUpDocWorkspace({
  workspaceId,
  projectId,
  projectName,
  workspaceName,
  doc: initialDoc,
  initialPages,
  initialActivePage,
  currentUserId,
  currentUserName = "Teammate",
  favoriteDocIds = [],
  tasksInProject = [],
}: ClickUpDocWorkspaceProps) {
  const router = useRouter();

  // Document state
  const [doc, setDoc] = useState<DocItem>(initialDoc);
  const [pageTree, setPageTree] = useState<PageListingNode[]>(initialPages);
  const [activePageId, setActivePageId] = useState<string>(initialActivePage.id);
  const [activePage, setActivePage] = useState<DocPageItem>(initialActivePage);

  // Editor content state
  const [pageTitle, setPageTitle] = useState(initialActivePage.title);
  const [pageIcon, setPageIcon] = useState(initialActivePage.icon || "📄");
  const [pageCover, setPageCover] = useState<string | null>(initialActivePage.cover_url || null);
  const [blocks, setBlocks] = useState<DocBlock[]>(initialActivePage.content_json || []);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawers
  const [showOutline, setShowOutline] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Comments state
  const [comments, setComments] = useState<DocComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // History state
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [previewVersion, setPreviewVersion] = useState<DocVersion | null>(null);

  // Activities state
  const [activities, setActivities] = useState<DocActivity[]>([]);

  // Find in page (Ctrl+F)
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatches, setFindMatches] = useState<number>(0);
  const [findCurrentIndex, setFindCurrentIndex] = useState<number>(0);

  // Slash menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashTargetBlockId, setSlashTargetBlockId] = useState<string | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Floating formatting toolbar
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedTextRange, setSelectedTextRange] = useState<string | null>(null);

  // Block hover handle
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [blockMenuOpenId, setBlockMenuOpenId] = useState<string | null>(null);

  // Drag and drop blocks
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);

  // Task linking modal
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskPickerBlockId, setTaskPickerBlockId] = useState<string | null>(null);

  // Convert selection/comment to task modal
  const [convertTaskModal, setConvertTaskModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    commentId?: string;
  }>({ open: false, title: "", description: "" });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // AUTOSAVE LOGIC
  // ---------------------------------------------------------------------------
  const performSave = useCallback(
    async (
      targetTitle: string,
      targetIcon: string,
      targetCover: string | null,
      targetBlocks: DocBlock[]
    ) => {
      setSaveStatus("saving");
      try {
        const markdown = blocksToMarkdown(targetBlocks);
        const res = await fetch(
          `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: targetTitle.trim() || "Untitled Page",
              icon: targetIcon,
              cover_url: targetCover,
              content_json: targetBlocks,
              content_markdown: markdown,
            }),
          }
        );

        if (!res.ok) throw new Error("Save request failed");

        setSaveStatus("saved");

        // Update tree title if it changed
        setPageTree((prevTree) => {
          const updateNodes = (nodes: PageListingNode[]): PageListingNode[] =>
            nodes.map((n) => {
              if (n.id === activePageId) {
                return { ...n, title: targetTitle.trim() || "Untitled Page", icon: targetIcon };
              }
              if (n.children?.length) {
                return { ...n, children: updateNodes(n.children) };
              }
              return n;
            });
          return updateNodes(prevTree);
        });
      } catch (err) {
        console.error("Autosave error", err);
        setSaveStatus("error");
      }
    },
    [workspaceId, doc.id, activePageId]
  );

  const triggerAutosave = (
    nextTitle: string,
    nextIcon: string,
    nextCover: string | null,
    nextBlocks: DocBlock[]
  ) => {
    setSaveStatus("unsaved");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performSave(nextTitle, nextIcon, nextCover, nextBlocks);
    }, 1200);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        performSave(pageTitle, pageIcon, pageCover, blocks);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageTitle, pageIcon, pageCover, blocks, performSave]);

  // Handle active page switch
  const switchPage = async (pageId: string) => {
    if (pageId === activePageId) return;

    // Flush current pending save if unsaved
    if (saveStatus === "unsaved") {
      await performSave(pageTitle, pageIcon, pageCover, blocks);
    }

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${pageId}`);
      const data = await res.json();
      if (res.ok && data.page) {
        setActivePageId(pageId);
        setActivePage(data.page);
        setPageTitle(data.page.title);
        setPageIcon(data.page.icon || "📄");
        setPageCover(data.page.cover_url || null);
        setBlocks(data.page.content_json || []);
        setSaveStatus("saved");
      }
    } catch (err) {
      showToast("Could not load page");
    }
  };

  // ---------------------------------------------------------------------------
  // PAGE TREE ACTIONS
  // ---------------------------------------------------------------------------
  const reloadPageTree = async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}/page_listing`);
      const data = await res.json();
      if (res.ok && data.pages) {
        setPageTree(data.pages);
      }
    } catch {}
  };

  const handleCreatePage = async (parentPageId: string | null = null) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentPageId,
          title: "Untitled Page",
          icon: "📄",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create page");

      await reloadPageTree();
      if (data.page?.id) {
        await switchPage(data.page.id);
      }
      showToast("Page created");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (pageTree.length <= 1 && !pageTree[0]?.children?.length) {
      showToast("A document must have at least one page.");
      return;
    }

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${pageId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete page");

      await reloadPageTree();
      // If we deleted the active page, switch to first available
      if (pageId === activePageId) {
        const next = pageTree.find((p) => p.id !== pageId);
        if (next) switchPage(next.id);
      }
      showToast("Page moved to Trash");
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // BLOCK EDITOR OPERATIONS
  // ---------------------------------------------------------------------------
  const updateBlockData = (blockId: string, newData: Record<string, any>) => {
    const nextBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b
    );
    setBlocks(nextBlocks);
    triggerAutosave(pageTitle, pageIcon, pageCover, nextBlocks);
  };

  const insertBlockAfter = (targetId: string, type: DocBlock["type"], data: any = {}) => {
    const idx = blocks.findIndex((b) => b.id === targetId);
    const newBlock: DocBlock = {
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      data,
    };

    const nextBlocks = [...blocks];
    if (idx === -1) {
      nextBlocks.push(newBlock);
    } else {
      nextBlocks.splice(idx + 1, 0, newBlock);
    }

    setBlocks(nextBlocks);
    triggerAutosave(pageTitle, pageIcon, pageCover, nextBlocks);
    return newBlock.id;
  };

  const removeBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      // Keep at least one empty block
      const empty: DocBlock[] = [{ id: "b1", type: "paragraph", data: { text: "" } }];
      setBlocks(empty);
      triggerAutosave(pageTitle, pageIcon, pageCover, empty);
      return;
    }
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    triggerAutosave(pageTitle, pageIcon, pageCover, nextBlocks);
  };

  const duplicateBlock = (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    insertBlockAfter(blockId, block.type, { ...block.data });
    showToast("Block duplicated");
  };

  const moveBlock = (blockId: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === blocks.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(idx, 1);
    nextBlocks.splice(targetIdx, 0, moved);

    setBlocks(nextBlocks);
    triggerAutosave(pageTitle, pageIcon, pageCover, nextBlocks);
  };

  // Slash commands registry
  const SLASH_COMMANDS = useMemo(
    () => [
      { type: "paragraph", label: "Text", desc: "Start writing plain text", icon: <Type size={15} /> },
      { type: "heading_1", label: "Heading 1", desc: "Large section heading", icon: <Heading1 size={15} /> },
      { type: "heading_2", label: "Heading 2", desc: "Medium section heading", icon: <Heading2 size={15} /> },
      { type: "heading_3", label: "Heading 3", desc: "Small subsection heading", icon: <Heading3 size={15} /> },
      { type: "bullet_list", label: "Bullet List", desc: "Create a bulleted list", icon: <List size={15} /> },
      { type: "numbered_list", label: "Numbered List", desc: "Create a numbered list", icon: <ListOrdered size={15} /> },
      { type: "checklist", label: "Checklist", desc: "Track tasks with checkable boxes", icon: <CheckSquare size={15} /> },
      { type: "quote", label: "Quote", desc: "Capture a quote or important callout", icon: <Quote size={15} /> },
      { type: "callout", label: "Callout", desc: "Highlight notes in a colored banner", icon: <Lightbulb size={15} /> },
      { type: "table", label: "Table", desc: "Add a spreadsheet-like data table", icon: <Columns size={15} /> },
      { type: "code", label: "Code Block", desc: "Syntax highlighted code snippet", icon: <Code size={15} /> },
      { type: "divider", label: "Divider", desc: "Visual horizontal rule separation", icon: <Minus size={15} /> },
      { type: "toggle", label: "Toggle List", desc: "Collapsible accordion block", icon: <ChevronRight size={15} /> },
      { type: "columns", label: "2 Columns", desc: "Side-by-side 2-column layout", icon: <Columns2 size={15} /> },
      { type: "image", label: "Image", desc: "Upload or embed an image", icon: <ImageIcon size={15} /> },
      { type: "task_reference", label: "Task Link", desc: "Embed a live project task", icon: <CheckCircle2 size={15} /> },
    ],
    []
  );

  const filteredCommands = useMemo(() => {
    if (!slashQuery.trim()) return SLASH_COMMANDS;
    const q = slashQuery.toLowerCase().trim();
    return SLASH_COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
    );
  }, [SLASH_COMMANDS, slashQuery]);

  const executeSlashCommand = (type: any) => {
    if (!slashTargetBlockId) return;

    if (type === "task_reference") {
      setTaskPickerBlockId(slashTargetBlockId);
      setShowTaskPicker(true);
      setSlashMenuOpen(false);
      return;
    }

    let defaultData: any = { text: "" };
    if (type === "checklist") defaultData = { text: "", checked: false };
    if (type === "callout") defaultData = { text: "", calloutType: "info", icon: "💡" };
    if (type === "code") defaultData = { text: "", language: "typescript" };
    if (type === "table")
      defaultData = {
        rows: [
          ["Header 1", "Header 2", "Header 3"],
          ["Cell 1", "Cell 2", "Cell 3"],
          ["Cell 4", "Cell 5", "Cell 6"],
        ],
      };
    if (type === "toggle") defaultData = { text: "Toggle title", content: "Hidden details" };
    if (type === "columns") defaultData = { colLeft: "Column 1 text", colRight: "Column 2 text" };

    const nextBlocks = blocks.map((b) =>
      b.id === slashTargetBlockId ? { ...b, type, data: defaultData } : b
    );

    setBlocks(nextBlocks);
    triggerAutosave(pageTitle, pageIcon, pageCover, nextBlocks);
    setSlashMenuOpen(false);
  };

  // Headings outline calculation
  const outlineItems = useMemo(() => {
    return blocks
      .filter((b) => ["heading_1", "heading_2", "heading_3"].includes(b.type))
      .map((b) => ({
        id: b.id,
        level: b.type === "heading_1" ? 1 : b.type === "heading_2" ? 2 : 3,
        text: b.data.text || "Untitled Section",
      }));
  }, [blocks]);

  // Load comments, versions, activities when their drawer opens
  useEffect(() => {
    if (showComments) {
      fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/comments`)
        .then((r) => r.json())
        .then((d) => d.comments && setComments(d.comments))
        .catch(() => {});
    }
  }, [showComments, workspaceId, doc.id, activePageId]);

  useEffect(() => {
    if (showHistory) {
      fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/versions`)
        .then((r) => r.json())
        .then((d) => d.versions && setVersions(d.versions))
        .catch(() => {});
    }
  }, [showHistory, workspaceId, doc.id, activePageId]);

  useEffect(() => {
    if (showActivity) {
      fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}/activity`)
        .then((r) => r.json())
        .then((d) => d.activities && setActivities(d.activities))
        .catch(() => {});
    }
  }, [showActivity, workspaceId, doc.id]);

  // Comment submit
  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: newCommentText.trim(),
            selectedText: selectedQuote || undefined,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setNewCommentText("");
        setSelectedQuote(null);
        showToast("Comment submitted");
      }
    } catch {}
  };

  // Reply submit
  const handleAddReply = async (parentCommentId: string) => {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: replyText.trim(),
            parentCommentId,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentCommentId
              ? { ...c, replies: [...(c.replies || []), data.comment] }
              : c
          )
        );
        setReplyText("");
        setReplyingCommentId(null);
      }
    } catch {}
  };

  // Resolve comment
  const handleToggleResolve = async (commentId: string, currentResolved: boolean) => {
    try {
      await fetch(
        `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_resolved: !currentResolved }),
        }
      );
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_resolved: !currentResolved } : c))
      );
    } catch {}
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const md = `# ${pageTitle}\n\n${blocksToMarkdown(blocks)}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Markdown exported");
  };

  const handleExportHtml = () => {
    const content = blocksToMarkdown(blocks);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${pageTitle}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;}</style></head><body><h1>${pageTitle}</h1><div>${content}</div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("HTML exported");
  };

  // Text selection listener for floating toolbar
  const handleEditorMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setFloatingToolbarPos(null);
      setSelectedTextRange(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setFloatingToolbarPos(null);
      setSelectedTextRange(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setFloatingToolbarPos({
      top: rect.top - 46,
      left: Math.max(10, rect.left + rect.width / 2 - 120),
    });
    setSelectedTextRange(text);
  };

  return (
    <div className="clickup-workspace-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="doc-toast-banner" role="status">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SUBBAR / TOP BAR */}
      <header className="clickup-topbar">
        <div className="topbar-left-zone">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          <nav className="topbar-breadcrumb">
            <Link href={projectId ? `/projects/${projectId}/documents` : `/workspaces/${workspaceId}/docs`}>
              {projectName || workspaceName || "Docs"}
            </Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-doc-title">{doc.title}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-active-page">{pageTitle}</span>
          </nav>
        </div>

        <div className="topbar-center-zone">
          {/* Autosave Status Indicator */}
          <div className={`save-status-pill ${saveStatus}`}>
            {saveStatus === "saving" && <Loader2 size={12} className="spin" />}
            {saveStatus === "saved" && <Check size={12} />}
            {saveStatus === "unsaved" && <Clock size={12} />}
            {saveStatus === "error" && <AlertTriangle size={12} />}
            <span>
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                ? "Saved"
                : saveStatus === "unsaved"
                ? "Unsaved changes"
                : "Save failed - click to retry"}
            </span>
          </div>

          {doc.is_wiki && (
            <span className="topbar-badge badge-wiki">
              <BookOpen size={12} /> Wiki
            </span>
          )}

          {doc.is_protected && (
            <span className="topbar-badge badge-protected">
              <Shield size={12} /> Protected
            </span>
          )}
        </div>

        <div className="topbar-right-zone">
          {/* Find in page */}
          <button
            type="button"
            className={`topbar-action-btn ${findOpen ? "active" : ""}`}
            onClick={() => setFindOpen(!findOpen)}
            title="Find in page (Ctrl+F)"
          >
            <Search size={15} />
          </button>

          {/* Table of contents / outline */}
          <button
            type="button"
            className={`topbar-action-btn ${showOutline ? "active" : ""}`}
            onClick={() => setShowOutline(!showOutline)}
            title="Table of Contents"
          >
            <ListTree size={15} />
          </button>

          {/* Comments drawer */}
          <button
            type="button"
            className={`topbar-action-btn ${showComments ? "active" : ""}`}
            onClick={() => setShowComments(!showComments)}
            title="Comments & Discussion"
          >
            <MessageSquare size={15} />
            {comments.filter((c) => !c.is_resolved).length > 0 && (
              <span className="comment-badge">
                {comments.filter((c) => !c.is_resolved).length}
              </span>
            )}
          </button>

          {/* Version history */}
          <button
            type="button"
            className={`topbar-action-btn ${showHistory ? "active" : ""}`}
            onClick={() => setShowHistory(!showHistory)}
            title="Version History"
          >
            <History size={15} />
          </button>

          {/* Activity log */}
          <button
            type="button"
            className={`topbar-action-btn ${showActivity ? "active" : ""}`}
            onClick={() => setShowActivity(!showActivity)}
            title="Document Activity"
          >
            <Activity size={15} />
          </button>

          {/* Favorite button */}
          <FavoriteButton
            entityType="document"
            entityId={doc.id}
            projectId={doc.project_id || projectId || ""}
            title={doc.title}
            subtitle={`${projectName || "Workspace"} · Document`}
            initialFavorited={doc.is_favorited || favoriteDocIds.includes(doc.id)}
            compact
            label=""
          />

          {/* Export dropdown */}
          <div className="export-menu-wrap">
            <button
              type="button"
              className="topbar-action-btn"
              title="Print / Export"
              onClick={() => window.print()}
            >
              <Printer size={15} />
            </button>
          </div>

          {/* Share button */}
          <button
            type="button"
            className="docs-btn-primary share-btn"
            onClick={() => setShowShareModal(true)}
          >
            <Share2 size={14} />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* FIND IN PAGE BAR (Ctrl+F) */}
      {findOpen && (
        <div className="find-toolbar">
          <Search size={14} />
          <input
            type="text"
            placeholder="Find in page…"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            autoFocus
          />
          {findQuery && <span className="find-count">{findMatches} found</span>}
          <button
            type="button"
            className="find-close-btn"
            onClick={() => {
              setFindOpen(false);
              setFindQuery("");
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* MAIN BODY AREA: Sidebar + Editor + Right Drawers */}
      <div className="clickup-main-layout">
        {/* LEFT PAGE NAVIGATION SIDEBAR */}
        {!sidebarCollapsed && (
          <aside className="clickup-page-sidebar">
            <div className="sidebar-doc-card">
              <span className="doc-icon-display">{doc.icon || "📄"}</span>
              <div className="doc-card-info">
                <strong>{doc.title}</strong>
                <span>{pageTree.length} pages</span>
              </div>
            </div>

            <div className="sidebar-section-header">
              <span>PAGES</span>
              <button
                type="button"
                className="add-page-btn"
                onClick={() => handleCreatePage(null)}
                title="Add Page at root"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Tree Navigation */}
            <div className="sidebar-tree-list">
              {pageTree.map((node) => (
                <PageTreeNodeItem
                  key={node.id}
                  node={node}
                  activePageId={activePageId}
                  onSelectPage={switchPage}
                  onAddSubpage={(pId) => handleCreatePage(pId)}
                  onDeletePage={handleDeletePage}
                  collapsedParents={collapsedParents}
                  toggleCollapse={(id) =>
                    setCollapsedParents((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                />
              ))}
            </div>
          </aside>
        )}

        {/* CENTER EDITOR CANVAS */}
        <main
          className="clickup-editor-scroll"
          ref={editorAreaRef}
          onMouseUp={handleEditorMouseUp}
        >
          <div className="clickup-editor-inner">
            {/* Optional Banner Cover */}
            {pageCover && (
              <div className="doc-cover-banner" style={{ background: pageCover }}>
                <button
                  type="button"
                  className="doc-cover-remove"
                  onClick={() => {
                    setPageCover(null);
                    triggerAutosave(pageTitle, pageIcon, null, blocks);
                  }}
                >
                  <X size={12} /> Remove cover
                </button>
              </div>
            )}

            {/* Page Header Area */}
            <div className="page-header-block">
              <div className="page-header-actions-row">
                <button
                  type="button"
                  className="page-icon-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Change icon"
                >
                  {pageIcon}
                </button>

                {!pageCover && (
                  <button
                    type="button"
                    className="add-cover-btn"
                    onClick={() => {
                      const cover = COVER_GRADIENTS[0];
                      setPageCover(cover);
                      triggerAutosave(pageTitle, pageIcon, cover, blocks);
                    }}
                  >
                    <ImageIcon size={13} /> Add cover
                  </button>
                )}

                {showEmojiPicker && (
                  <div className="emoji-popover-box">
                    {EMOJI_LIST.map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() => {
                          setPageIcon(emo);
                          setShowEmojiPicker(false);
                          triggerAutosave(pageTitle, emo, pageCover, blocks);
                        }}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title input */}
              <input
                type="text"
                className="doc-title-editor-input"
                placeholder="Untitled Page"
                value={pageTitle}
                onChange={(e) => {
                  setPageTitle(e.target.value);
                  triggerAutosave(e.target.value, pageIcon, pageCover, blocks);
                }}
              />

              {/* Page Metadata Bar */}
              <div className="page-meta-bar">
                <span className="author-chip">
                  <span className="author-avatar-tiny">
                    {currentUserName.charAt(0).toUpperCase()}
                  </span>
                  {currentUserName}
                </span>
                <span className="meta-sep">•</span>
                <span className="meta-date">
                  Updated {new Date(activePage.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className="meta-sep">•</span>
                <span className="meta-words">{blocks.length} blocks</span>
              </div>

              {/* Wiki mode banner */}
              {doc.is_wiki && (
                <div className="wiki-page-badge-banner">
                  <BookOpen size={16} />
                  <div>
                    <strong>Verified Knowledge Base Article</strong>
                    <p>Maintained by the workspace engineering & product teams.</p>
                  </div>
                </div>
              )}
            </div>

            {/* BLOCK EDITOR CONTENT STREAM */}
            <div className="doc-blocks-container">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`doc-block-wrapper ${hoveredBlockId === block.id ? "hovered" : ""}`}
                  onMouseEnter={() => setHoveredBlockId(block.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                >
                  {/* Left Gutter: Drag Handle & Plus Button */}
                  <div className="block-gutter-controls">
                    <button
                      type="button"
                      className="gutter-btn"
                      title="Insert block below"
                      onClick={() => insertBlockAfter(block.id, "paragraph")}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      type="button"
                      className="gutter-btn drag-handle"
                      title="Drag to reorder / Block options"
                      onClick={() =>
                        setBlockMenuOpenId(blockMenuOpenId === block.id ? null : block.id)
                      }
                    >
                      <GripVertical size={13} />
                    </button>

                    {/* Block Action Menu */}
                    {blockMenuOpenId === block.id && (
                      <div className="block-context-menu">
                        <button
                          type="button"
                          onClick={() => {
                            duplicateBlock(block.id);
                            setBlockMenuOpenId(null);
                          }}
                        >
                          <Copy size={13} /> Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            moveBlock(block.id, "up");
                            setBlockMenuOpenId(null);
                          }}
                        >
                          <MoveUp size={13} /> Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            moveBlock(block.id, "down");
                            setBlockMenuOpenId(null);
                          }}
                        >
                          <MoveDown size={13} /> Move down
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            removeBlock(block.id);
                            setBlockMenuOpenId(null);
                          }}
                        >
                          <Trash2 size={13} /> Delete block
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Block Content Component */}
                  <div className="block-content-area">
                    <BlockRenderer
                      block={block}
                      findQuery={findQuery}
                      onChange={(newData) => updateBlockData(block.id, newData)}
                      onEnterPress={() => insertBlockAfter(block.id, "paragraph")}
                      onBackspaceOnEmpty={() => removeBlock(block.id)}
                      onOpenSlashMenu={() => {
                        setSlashTargetBlockId(block.id);
                        setSlashQuery("");
                        setSlashMenuOpen(true);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Add Block Area */}
            <div
              className="editor-bottom-add"
              onClick={() => {
                const lastId = blocks[blocks.length - 1]?.id || "init";
                insertBlockAfter(lastId, "paragraph");
              }}
            >
              <Plus size={14} />
              <span>Click to add a block or type &apos;/&apos; for commands</span>
            </div>
          </div>
        </main>

        {/* FLOATING TEXT FORMATTING TOOLBAR */}
        {floatingToolbarPos && selectedTextRange && (
          <div
            className="floating-format-toolbar"
            style={{ top: `${floatingToolbarPos.top}px`, left: `${floatingToolbarPos.left}px` }}
          >
            <button
              type="button"
              onClick={() => document.execCommand("bold")}
              title="Bold (Ctrl+B)"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              onClick={() => document.execCommand("italic")}
              title="Italic (Ctrl+I)"
            >
              <Italic size={13} />
            </button>
            <button
              type="button"
              onClick={() => document.execCommand("underline")}
              title="Underline (Ctrl+U)"
            >
              <Underline size={13} />
            </button>
            <button
              type="button"
              onClick={() => document.execCommand("strikeThrough")}
              title="Strikethrough"
            >
              <Strikethrough size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedQuote(selectedTextRange);
                setShowComments(true);
                setFloatingToolbarPos(null);
              }}
              title="Comment on selection"
            >
              <MessageSquare size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setConvertTaskModal({
                  open: true,
                  title: selectedTextRange.slice(0, 80),
                  description: selectedTextRange,
                });
                setFloatingToolbarPos(null);
              }}
              title="Create Task from selection"
            >
              <CheckCircle2 size={13} />
            </button>
          </div>
        )}

        {/* SLASH COMMANDS DROPDOWN POPUP */}
        {slashMenuOpen && (
          <div className="slash-menu-palette">
            <div className="slash-search-head">
              <Search size={14} />
              <input
                type="text"
                placeholder="Filter commands…"
                value={slashQuery}
                onChange={(e) => setSlashQuery(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSlashMenuOpen(false);
                  if (e.key === "Enter" && filteredCommands.length > 0) {
                    executeSlashCommand(filteredCommands[0].type);
                  }
                }}
              />
            </div>
            <div className="slash-options-list">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.type}
                  type="button"
                  className="slash-option-item"
                  onClick={() => executeSlashCommand(cmd.type)}
                >
                  <span className="cmd-icon">{cmd.icon}</span>
                  <div className="cmd-text">
                    <strong>{cmd.label}</strong>
                    <span>{cmd.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RIGHT DRAWER: TABLE OF CONTENTS / OUTLINE */}
        {showOutline && (
          <aside className="doc-right-drawer outline-drawer">
            <div className="drawer-header">
              <div className="drawer-title">
                <ListTree size={16} />
                <span>Outline</span>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setShowOutline(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="drawer-body">
              {outlineItems.length === 0 ? (
                <p className="drawer-empty-msg">
                  Add Heading 1, 2, or 3 blocks to generate an outline automatically.
                </p>
              ) : (
                <ul className="outline-list">
                  {outlineItems.map((item) => (
                    <li
                      key={item.id}
                      className={`outline-item level-${item.level}`}
                      onClick={() => {
                        const el = document.getElementById(item.id);
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      {item.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}

        {/* RIGHT DRAWER: COMMENTS & INLINE THREADS */}
        {showComments && (
          <aside className="doc-right-drawer comments-drawer">
            <div className="drawer-header">
              <div className="drawer-title">
                <MessageSquare size={16} />
                <span>Page Comments</span>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setShowComments(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="drawer-body comments-body">
              {selectedQuote && (
                <div className="quoted-selection-banner">
                  <Quote size={13} />
                  <span>&quot;{selectedQuote}&quot;</span>
                  <button
                    type="button"
                    onClick={() => setSelectedQuote(null)}
                    title="Remove quote"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* New Comment Input */}
              <div className="new-comment-box">
                <textarea
                  placeholder="Leave a comment or mention @teammate…"
                  rows={3}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                />
                <button
                  type="button"
                  className="docs-btn-primary comment-post-btn"
                  onClick={handleAddComment}
                >
                  Comment
                </button>
              </div>

              {/* Comments Thread List */}
              <div className="comments-thread-list">
                {comments.length === 0 ? (
                  <p className="drawer-empty-msg">No comments on this page yet.</p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className={`comment-card ${c.is_resolved ? "resolved" : ""}`}
                    >
                      {c.selected_text && (
                        <blockquote className="comment-quote">
                          &quot;{c.selected_text}&quot;
                        </blockquote>
                      )}

                      <div className="comment-header-row">
                        <div className="comment-author-info">
                          <span className="author-circle">
                            {c.author_name?.charAt(0).toUpperCase() || "U"}
                          </span>
                          <strong>{c.author_name}</strong>
                        </div>
                        <span className="comment-time">
                          {new Date(c.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="comment-content-text">{c.content}</p>

                      <div className="comment-footer-actions">
                        <button
                          type="button"
                          className="comment-action-link"
                          onClick={() => handleToggleResolve(c.id, c.is_resolved)}
                        >
                          <Check size={12} />
                          {c.is_resolved ? "Reopen" : "Resolve"}
                        </button>

                        <button
                          type="button"
                          className="comment-action-link"
                          onClick={() =>
                            setReplyingCommentId(replyingCommentId === c.id ? null : c.id)
                          }
                        >
                          Reply
                        </button>

                        <button
                          type="button"
                          className="comment-action-link"
                          onClick={() =>
                            setConvertTaskModal({
                              open: true,
                              title: c.content.slice(0, 80),
                              description: c.content,
                              commentId: c.id,
                            })
                          }
                        >
                          <CheckCircle2 size={12} /> Convert to Task
                        </button>
                      </div>

                      {/* Replies */}
                      {c.replies && c.replies.length > 0 && (
                        <div className="comment-replies-list">
                          {c.replies.map((rep) => (
                            <div key={rep.id} className="comment-reply-item">
                              <div className="reply-author-line">
                                <strong>{rep.author_name}</strong>
                                <span>
                                  {new Date(rep.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p>{rep.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply input */}
                      {replyingCommentId === c.id && (
                        <div className="reply-input-box">
                          <input
                            type="text"
                            placeholder="Write a reply…"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddReply(c.id);
                            }}
                          />
                          <button
                            type="button"
                            className="docs-btn-primary"
                            onClick={() => handleAddReply(c.id)}
                          >
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}

        {/* RIGHT DRAWER: VERSION HISTORY */}
        {showHistory && (
          <aside className="doc-right-drawer history-drawer">
            <div className="drawer-header">
              <div className="drawer-title">
                <History size={16} />
                <span>Version History</span>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setShowHistory(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="drawer-body">
              {versions.length === 0 ? (
                <p className="drawer-empty-msg">No historical revisions tracked yet.</p>
              ) : (
                <div className="versions-list">
                  {versions.map((ver) => (
                    <div key={ver.id} className="version-item-card">
                      <div className="ver-header">
                        <strong>Version {ver.version_number}</strong>
                        <span className="ver-date">
                          {new Date(ver.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <span className="ver-changer">Edited by {ver.changer_name}</span>
                      <p className="ver-summary">{ver.change_summary || "Auto-snapshot"}</p>
                      <button
                        type="button"
                        className="restore-btn"
                        onClick={async () => {
                          const res = await fetch(
                            `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/versions`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ versionId: ver.id }),
                            }
                          );
                          if (res.ok) {
                            showToast(`Restored Version ${ver.version_number}`);
                            switchPage(activePageId);
                          }
                        }}
                      >
                        Restore this version
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* RIGHT DRAWER: ACTIVITY LOG */}
        {showActivity && (
          <aside className="doc-right-drawer activity-drawer">
            <div className="drawer-header">
              <div className="drawer-title">
                <Activity size={16} />
                <span>Document Activity</span>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setShowActivity(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="drawer-body">
              <div className="activity-timeline">
                {activities.map((act) => (
                  <div key={act.id} className="activity-row">
                    <div className="act-bullet" />
                    <div className="act-content">
                      <p>
                        <strong>{act.actor_name}</strong> {act.action} the document
                      </p>
                      <span className="act-time">
                        {new Date(act.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="doc-modal-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="doc-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h3>Share &quot;{doc.title}&quot;</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowShareModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body share-body">
              {/* Public Publishing Section */}
              <div className="share-public-box">
                <div className="share-public-info">
                  <Globe size={18} />
                  <div>
                    <strong>Public Link Sharing</strong>
                    <p>Make this document accessible publicly on the web.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`docs-btn-secondary ${doc.is_published ? "active" : ""}`}
                  onClick={async () => {
                    const nextPub = !doc.is_published;
                    const res = await fetch(
                      `/api/workspaces/${workspaceId}/docs/${doc.id}/publish`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ publish: nextPub }),
                      }
                    );
                    const data = await res.json();
                    if (res.ok) {
                      setDoc({ ...doc, is_published: nextPub, public_slug: data.public_slug });
                      showToast(nextPub ? "Published publicly" : "Unpublished");
                    }
                  }}
                >
                  {doc.is_published ? "Unpublish" : "Publish"}
                </button>
              </div>

              {doc.is_published && doc.public_slug && (
                <div className="share-link-input-row">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/docs/public/${doc.public_slug}`}
                  />
                  <button
                    type="button"
                    className="docs-btn-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/docs/public/${doc.public_slug}`
                      );
                      showToast("Link copied to clipboard!");
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              )}

              {/* Protection & Wiki Toggles */}
              <div className="modal-toggle-options">
                <label className="modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={doc.is_protected}
                    onChange={async (e) => {
                      const prot = e.target.checked;
                      await fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ is_protected: prot }),
                      });
                      setDoc({ ...doc, is_protected: prot });
                      showToast(prot ? "Document protected" : "Protection removed");
                    }}
                  />
                  <div>
                    <strong>Protected Document</strong>
                    <p>Only editors and owners can make changes to this document.</p>
                  </div>
                </label>

                <label className="modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={doc.is_wiki}
                    onChange={async (e) => {
                      const wiki = e.target.checked;
                      await fetch(`/api/workspaces/${workspaceId}/docs/${doc.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ is_wiki: wiki }),
                      });
                      setDoc({ ...doc, is_wiki: wiki });
                      showToast(wiki ? "Wiki mode enabled" : "Wiki mode disabled");
                    }}
                  />
                  <div>
                    <strong>Wiki Knowledge Base</strong>
                    <p>Display as verified knowledge base article in docs hub.</p>
                  </div>
                </label>
              </div>

              {/* Export Links */}
              <div className="modal-export-section">
                <strong>Export Options</strong>
                <div className="export-btns-row">
                  <button type="button" className="docs-btn-secondary" onClick={handleExportMarkdown}>
                    <Download size={14} /> Markdown (.md)
                  </button>
                  <button type="button" className="docs-btn-secondary" onClick={handleExportHtml}>
                    <Download size={14} /> HTML (.html)
                  </button>
                  <button type="button" className="docs-btn-secondary" onClick={() => window.print()}>
                    <Printer size={14} /> PDF / Print
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="docs-btn-secondary"
                onClick={() => setShowShareModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMBED TASK PICKER MODAL */}
      {showTaskPicker && (
        <div className="doc-modal-backdrop" onClick={() => setShowTaskPicker(false)}>
          <div className="doc-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h3>Link a Task to Document</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTaskPicker(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="task-picker-list">
                {tasksInProject.length === 0 ? (
                  <p>No tasks found in this project.</p>
                ) : (
                  tasksInProject.map((t) => (
                    <div
                      key={t.id}
                      className="task-picker-item"
                      onClick={() => {
                        if (taskPickerBlockId) {
                          updateBlockData(taskPickerBlockId, {
                            taskId: t.id,
                            taskTitle: t.title,
                            taskStatus: t.status,
                            taskPriority: t.priority,
                          });
                        }
                        setShowTaskPicker(false);
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <div className="picker-task-details">
                        <strong>{t.title}</strong>
                        {t.status && <span className="task-status-pill">{t.status}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT COMMENT / SELECTION TO TASK MODAL */}
      {convertTaskModal.open && (
        <div
          className="doc-modal-backdrop"
          onClick={() => setConvertTaskModal({ open: false, title: "", description: "" })}
        >
          <div className="doc-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h3>Create Task from Documentation</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setConvertTaskModal({ open: false, title: "", description: "" })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <label className="modal-label">
                Task Title
                <input
                  type="text"
                  value={convertTaskModal.title}
                  onChange={(e) =>
                    setConvertTaskModal({ ...convertTaskModal, title: e.target.value })
                  }
                />
              </label>

              <label className="modal-label">
                Description / Context
                <textarea
                  rows={4}
                  value={convertTaskModal.description}
                  onChange={(e) =>
                    setConvertTaskModal({ ...convertTaskModal, description: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="docs-btn-secondary"
                onClick={() => setConvertTaskModal({ open: false, title: "", description: "" })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="docs-btn-primary"
                onClick={async () => {
                  try {
                    const endpoint = convertTaskModal.commentId
                      ? `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/comments/${convertTaskModal.commentId}/task`
                      : `/api/projects/${doc.project_id || projectId}/tasks`;

                    const res = await fetch(endpoint, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: convertTaskModal.title,
                        description: convertTaskModal.description,
                        projectId: doc.project_id || projectId,
                      }),
                    });
                    const d = await res.json();
                    if (res.ok) {
                      showToast("Task created and linked successfully!");
                      setConvertTaskModal({ open: false, title: "", description: "" });
                      // Reload comments if it was from a comment
                      if (convertTaskModal.commentId) {
                        fetch(
                          `/api/workspaces/${workspaceId}/docs/${doc.id}/pages/${activePageId}/comments`
                        )
                          .then((r) => r.json())
                          .then((cd) => cd.comments && setComments(cd.comments));
                      }
                    } else {
                      showToast(d.error || "Failed to create task");
                    }
                  } catch (err: any) {
                    showToast(err.message);
                  }
                }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAGE TREE RECURSIVE NODE ITEM
// ---------------------------------------------------------------------------
function PageTreeNodeItem({
  node,
  activePageId,
  onSelectPage,
  onAddSubpage,
  onDeletePage,
  collapsedParents,
  toggleCollapse,
}: {
  node: PageListingNode;
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddSubpage: (id: string) => void;
  onDeletePage: (id: string) => void;
  collapsedParents: Record<string, boolean>;
  toggleCollapse: (id: string) => void;
}) {
  const isCollapsed = Boolean(collapsedParents[node.id]);
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isActive = activePageId === node.id;

  return (
    <div className="page-tree-node-item">
      <div className={`page-tree-row ${isActive ? "active" : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-chevron-btn"
            onClick={() => toggleCollapse(node.id)}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <span className="tree-chevron-spacer" />
        )}

        <div className="tree-node-label" onClick={() => onSelectPage(node.id)}>
          <span className="tree-icon">{node.icon || "📄"}</span>
          <span className="tree-title">{node.title}</span>
        </div>

        <div className="tree-row-actions">
          <button
            type="button"
            className="tree-add-child-btn"
            title="Add subpage"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubpage(node.id);
            }}
          >
            <Plus size={12} />
          </button>

          <button
            type="button"
            className="tree-delete-btn"
            title="Delete page"
            onClick={(e) => {
              e.stopPropagation();
              onDeletePage(node.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="page-tree-children">
          {node.children!.map((child) => (
            <PageTreeNodeItem
              key={child.id}
              node={child}
              activePageId={activePageId}
              onSelectPage={onSelectPage}
              onAddSubpage={onAddSubpage}
              onDeletePage={onDeletePage}
              collapsedParents={collapsedParents}
              toggleCollapse={toggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOCK RENDERER & INTERACTIVE EDITORS
// ---------------------------------------------------------------------------
function BlockRenderer({
  block,
  findQuery,
  onChange,
  onEnterPress,
  onBackspaceOnEmpty,
  onOpenSlashMenu,
}: {
  block: DocBlock;
  findQuery: string;
  onChange: (newData: any) => void;
  onEnterPress: () => void;
  onBackspaceOnEmpty: () => void;
  onOpenSlashMenu: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnterPress();
    }
    if (e.key === "Backspace" && !(e.target as any).value) {
      onBackspaceOnEmpty();
    }
    if (e.key === "/") {
      if (!(e.target as any).value) {
        onOpenSlashMenu();
      }
    }
  };

  switch (block.type) {
    case "heading_1":
      return (
        <input
          id={block.id}
          type="text"
          className="block-input h1"
          placeholder="Heading 1"
          value={block.data.text || ""}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={handleKeyDown}
        />
      );

    case "heading_2":
      return (
        <input
          id={block.id}
          type="text"
          className="block-input h2"
          placeholder="Heading 2"
          value={block.data.text || ""}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={handleKeyDown}
        />
      );

    case "heading_3":
      return (
        <input
          id={block.id}
          type="text"
          className="block-input h3"
          placeholder="Heading 3"
          value={block.data.text || ""}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={handleKeyDown}
        />
      );

    case "checklist":
      return (
        <div className="block-checklist-item">
          <input
            type="checkbox"
            checked={Boolean(block.data.checked)}
            onChange={(e) => onChange({ checked: e.target.checked })}
          />
          <input
            type="text"
            className={`block-input checklist-text ${block.data.checked ? "checked" : ""}`}
            placeholder="To-do item…"
            value={block.data.text || ""}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={handleKeyDown}
          />
        </div>
      );

    case "bullet_list":
      return (
        <div className="block-list-item bullet">
          <span className="bullet-dot">•</span>
          <input
            type="text"
            className="block-input"
            placeholder="List item…"
            value={block.data.text || ""}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={handleKeyDown}
          />
        </div>
      );

    case "numbered_list":
      return (
        <div className="block-list-item numbered">
          <span className="number-label">1.</span>
          <input
            type="text"
            className="block-input"
            placeholder="Numbered list item…"
            value={block.data.text || ""}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={handleKeyDown}
          />
        </div>
      );

    case "quote":
      return (
        <blockquote className="block-quote">
          <textarea
            className="block-textarea"
            placeholder="Quote…"
            rows={2}
            value={block.data.text || ""}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={handleKeyDown}
          />
        </blockquote>
      );

    case "callout":
      return (
        <div className={`block-callout ${block.data.calloutType || "info"}`}>
          <span className="callout-icon">{block.data.icon || "💡"}</span>
          <input
            type="text"
            className="block-input callout-text"
            placeholder="Callout text…"
            value={block.data.text || ""}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={handleKeyDown}
          />
        </div>
      );

    case "divider":
      return <hr className="block-divider-line" />;

    case "code":
      return (
        <div className="block-code-container">
          <div className="code-header">
            <span className="code-lang-tag">{block.data.language || "code"}</span>
            <button
              type="button"
              className="code-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(block.data.text || "");
              }}
            >
              Copy
            </button>
          </div>
          <textarea
            className="code-editor-textarea"
            placeholder="Write or paste code here…"
            rows={5}
            value={block.data.text || ""}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>
      );

    case "table": {
      const rows = block.data.rows || [
        ["Col 1", "Col 2"],
        ["Cell", "Cell"],
      ];

      const addRow = () => {
        const colCount = rows[0]?.length || 2;
        const newRow = Array(colCount).fill("Cell");
        onChange({ rows: [...rows, newRow] });
      };

      const addCol = () => {
        const nextRows = rows.map((r: string[], i: number) => [
          ...r,
          i === 0 ? `Col ${r.length + 1}` : "Cell",
        ]);
        onChange({ rows: nextRows });
      };

      const updateCell = (rIdx: number, cIdx: number, val: string) => {
        const nextRows = rows.map((r: string[], ri: number) =>
          ri === rIdx ? r.map((c: string, ci: number) => (ci === cIdx ? val : c)) : r
        );
        onChange({ rows: nextRows });
      };

      return (
        <div className="block-table-wrapper">
          <div className="table-controls-bar">
            <button type="button" onClick={addRow}>
              + Add Row
            </button>
            <button type="button" onClick={addCol}>
              + Add Column
            </button>
          </div>
          <table className="doc-inline-table">
            <tbody>
              {rows.map((row: string[], rIdx: number) => (
                <tr key={rIdx}>
                  {row.map((cell: string, cIdx: number) => (
                    <td key={cIdx}>
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "task_reference":
      return (
        <div className="block-task-embed">
          <CheckCircle2 size={16} className="task-icon" />
          <div className="task-embed-info">
            <strong>{block.data.taskTitle || "Linked Task"}</strong>
            {block.data.taskStatus && (
              <span className="task-chip">{block.data.taskStatus}</span>
            )}
          </div>
          <ExternalLink size={13} className="task-link-out" />
        </div>
      );

    default:
      return (
        <textarea
          className="block-textarea paragraph"
          placeholder="Write text or type '/' for commands…"
          rows={1}
          value={block.data.text || ""}
          onChange={(e) => {
            onChange({ text: e.target.value });
            // Auto expand textarea height
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={handleKeyDown}
        />
      );
  }
}
