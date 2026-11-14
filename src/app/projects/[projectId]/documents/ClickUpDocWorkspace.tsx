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
  Heading4,
  Code,
  Minus,
  Layout,
  Eye,
  Edit3,
  Columns2,
  Columns3,
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
  Video,
  Music,
  FileUp,
  AtSign,
  PenTool,
  Trello,
  Maximize,
  Minimize,
  UploadCloud,
  AlignLeft,
  AlignCenter,
  AlignRight,
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
import { markdownToPdf } from "@/lib/pdf";
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

const COVER_CATEGORIES = {
  Gradients: [
    { name: "Emerald Deep", value: "linear-gradient(135deg, #065f46 0%, #064e3b 100%)" },
    { name: "Ocean Midnight", value: "linear-gradient(135deg, #1e40af 0%, #172554 100%)" },
    { name: "Cosmic Purple", value: "linear-gradient(135deg, #581c87 0%, #3b0764 100%)" },
    { name: "Ruby Sunset", value: "linear-gradient(135deg, #831843 0%, #500724 100%)" },
    { name: "Amber Flame", value: "linear-gradient(135deg, #9a3412 0%, #431407 100%)" },
    { name: "Titanium Dark", value: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" },
    { name: "Aurora Teal", value: "linear-gradient(135deg, #0f766e 0%, #1e1b4b 100%)" },
    { name: "Golden Dune", value: "linear-gradient(135deg, #b45309 0%, #78350f 100%)" },
  ],
  Nature: [
    { name: "Alpine Peak", value: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80')" },
    { name: "Deep Pines", value: "url('https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80')" },
    { name: "Ocean Crest", value: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80')" },
    { name: "Night Sky", value: "url('https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80')" },
  ],
  Technology: [
    { name: "Cyber Circuit", value: "url('https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80')" },
    { name: "Data Grid", value: "url('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80')" },
    { name: "Modern Glass", value: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80')" },
  ],
  Minimal: [
    { name: "Clean Titanium", value: "linear-gradient(135deg, #334155 0%, #1e293b 100%)" },
    { name: "Matte Charcoal", value: "linear-gradient(135deg, #18181b 0%, #09090b 100%)" },
    { name: "Frost Slate", value: "linear-gradient(135deg, #475569 0%, #334155 100%)" },
  ],
};

const EMOJI_CATEGORIES = {
  Common: ["📄", "📝", "💡", "🚀", "🎯", "⚙️", "📌", "🔬", "🧪", "📚", "✨", "🏛️", "🔌", "🎨", "🚨", "📊", "📈", "💬"],
  Office: ["💻", "🖥️", "📱", "⌨️", "📦", "📬", "🗂️", "🗃️", "📋", "📍", "📎", "📏", "📐", "✂️", "🔒", "🔑", "🛠️", "📅"],
  Signals: ["✅", "❌", "⚠️", "ℹ️", "❓", "❗", "🛑", "🟢", "🟡", "🔴", "🟣", "🔵", "⚪", "⚫", "🔶", "🔷", "💎", "🔔"],
  Nature: ["🌱", "🌲", "🌳", "🌴", "🍀", "🍁", "🍂", "🍃", "🍄", "🌸", "☀️", "🌤️", "⛅", "☁️", "🌧️", "⚡", "❄️", "🌊"],
};

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
  const [coverPosition, setCoverPosition] = useState<"top" | "center" | "bottom">("center");
  const [blocks, setBlocks] = useState<DocBlock[]>(initialActivePage.content_json || []);

  // UI state
  const [editorWidth, setEditorWidth] = useState<"standard" | "wide" | "full">("standard");
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawers & Modals
  const [showOutline, setShowOutline] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCoverGallery, setShowCoverGallery] = useState(false);
  const [selectedCoverCategory, setSelectedCoverCategory] = useState<keyof typeof COVER_CATEGORIES>("Gradients");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");

  // Slash menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashTargetBlockId, setSlashTargetBlockId] = useState<string | null>(null);

  // Floating formatting toolbar
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedTextRange, setSelectedTextRange] = useState<string | null>(null);

  // Block hover handle
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [blockMenuOpenId, setBlockMenuOpenId] = useState<string | null>(null);

  // Reference pickers
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskPickerBlockId, setTaskPickerBlockId] = useState<string | null>(null);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [pagePickerBlockId, setPagePickerBlockId] = useState<string | null>(null);

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

  // Convert comment to task modal
  const [convertTaskModal, setConvertTaskModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    commentId?: string;
  }>({ open: false, title: "", description: "" });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

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

  // Keyboard shortcut Ctrl+S / Cmd+S & Find
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

  // Page switcher
  const switchPage = async (pageId: string) => {
    if (pageId === activePageId) return;

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
    } catch {
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
  // BLOCK OPERATIONS
  // ---------------------------------------------------------------------------
  const updateBlockData = (blockId: string, newData: Record<string, any>) => {
    const nextBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b
    );
    setBlocks(nextBlocks);
    triggerAutosave(pageTitle, pageIcon, pageCover, nextBlocks);
  };

  const insertBlockAfter = (targetId: string | null, type: DocBlock["type"], data: any = {}) => {
    const idx = targetId ? blocks.findIndex((b) => b.id === targetId) : -1;
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
    setFocusedBlockId(newBlock.id);
    triggerAutosave(pageTitle, pageIcon, pageCover, nextBlocks);
    return newBlock.id;
  };

  const removeBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      const empty: DocBlock[] = [{ id: "b1", type: "paragraph", data: { text: "" } }];
      setBlocks(empty);
      setFocusedBlockId("b1");
      triggerAutosave(pageTitle, pageIcon, pageCover, empty);
      return;
    }
    const idx = blocks.findIndex((b) => b.id === blockId);
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    const focusTarget = nextBlocks[Math.max(0, idx - 1)]?.id || null;
    setFocusedBlockId(focusTarget);
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

  // ---------------------------------------------------------------------------
  // CLIPBOARD PASTE & DESKTOP DRAG/DROP FOR IMAGES
  // ---------------------------------------------------------------------------
  const uploadImageFile = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/docs/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        return data.url;
      }
    } catch {}
    // Fallback: FileReader Base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleEditorPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        showToast("Uploading pasted image…");
        const url = await uploadImageFile(file);
        if (url) {
          insertBlockAfter(focusedBlockId, "image", {
            url,
            caption: file.name || "Pasted image",
            width: "100%",
            align: "center",
            altText: file.name || "Pasted image",
          });
          showToast("Image pasted & uploaded!");
        }
        return;
      }
    }
  };

  const handleEditorDrop = async (e: React.DragEvent) => {
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        showToast("Uploading dropped image…");
        const url = await uploadImageFile(file);
        if (url) {
          insertBlockAfter(focusedBlockId, "image", {
            url,
            caption: file.name || "Dropped image",
            width: "100%",
            align: "center",
          });
          showToast("Image inserted!");
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // SLASH COMMANDS REGISTRY
  // ---------------------------------------------------------------------------
  const SLASH_GROUPS = useMemo(
    () => [
      {
        category: "SUGGESTIONS",
        items: [
          { type: "paragraph", label: "Text", desc: "Start writing plain text", icon: <Type size={15} /> },
          { type: "heading_1", label: "Heading 1", desc: "Big section heading", icon: <Heading1 size={15} /> },
          { type: "checklist", label: "Checklist", desc: "Interactive to-do list", icon: <CheckSquare size={15} /> },
          { type: "bullet_list", label: "Bullet List", desc: "Standard bulleted list", icon: <List size={15} /> },
          { type: "table", label: "Table", desc: "Spreadsheet-style data grid", icon: <Columns size={15} /> },
        ],
      },
      {
        category: "TEXT",
        items: [
          { type: "paragraph", label: "Normal text", desc: "Standard body paragraph", icon: <Type size={15} /> },
          { type: "heading_1", label: "Heading 1", desc: "Top-level page section", icon: <Heading1 size={15} /> },
          { type: "heading_2", label: "Heading 2", desc: "Medium subsection heading", icon: <Heading2 size={15} /> },
          { type: "heading_3", label: "Heading 3", desc: "Small subsection heading", icon: <Heading3 size={15} /> },
          { type: "heading_4", label: "Heading 4", desc: "Minor subheader", icon: <Heading4 size={15} /> },
          { type: "checklist", label: "Checklist", desc: "Tasks with interactive checkboxes", icon: <CheckSquare size={15} /> },
          { type: "bullet_list", label: "Bulleted list", desc: "Bulleted outline format", icon: <List size={15} /> },
          { type: "numbered_list", label: "Numbered list", desc: "Sequential ordered list", icon: <ListOrdered size={15} /> },
          { type: "toggle", label: "Toggle list", desc: "Collapsible accordion container", icon: <ChevronRight size={15} /> },
          { type: "quote", label: "Block quote", desc: "Indented quotation block", icon: <Quote size={15} /> },
          { type: "pull_quote", label: "Pull quote", desc: "Large emphasized editorial quote", icon: <Quote size={15} /> },
          { type: "code", label: "Code block", desc: "Syntax highlighted code snippet", icon: <Code size={15} /> },
        ],
      },
      {
        category: "INLINE & REFERENCES",
        items: [
          { type: "person_reference", label: "Mention a Person", desc: "@teammate inside the document", icon: <AtSign size={15} /> },
          { type: "page_reference", label: "Mention a Page", desc: "Link to another document page", icon: <FileText size={15} /> },
          { type: "task_reference", label: "Mention a Task", desc: "Link to a project task item", icon: <CheckCircle2 size={15} /> },
          { type: "whiteboard_reference", label: "Mention a Whiteboard", desc: "Link to project whiteboard canvas", icon: <PenTool size={15} /> },
        ],
      },
      {
        category: "VIEWS & EMBEDS",
        items: [
          { type: "clickup_list_table", label: "ClickUp List (Table)", desc: "Embed live project tasks in a table", icon: <ListFilter size={15} /> },
          { type: "clickup_list_board", label: "ClickUp List (Board)", desc: "Embed live project Kanban board", icon: <Trello size={15} /> },
        ],
      },
      {
        category: "BASIC CONTENT & MEDIA",
        items: [
          { type: "divider", label: "Divider", desc: "Horizontal separation line", icon: <Minus size={15} /> },
          { type: "banner", label: "Banner / Callout", desc: "Emphasized colored alert banner", icon: <Lightbulb size={15} /> },
          { type: "columns", label: "2 Columns", desc: "Side-by-side 2-column layout", icon: <Columns2 size={15} /> },
          { type: "columns_3", label: "3 Columns", desc: "Side-by-side 3-column layout", icon: <Columns3 size={15} /> },
          { type: "table", label: "Table", desc: "Interactive customizable data table", icon: <Columns size={15} /> },
          { type: "image", label: "Image", desc: "Upload, paste or embed image", icon: <ImageIcon size={15} /> },
          { type: "video", label: "Video", desc: "Embed YouTube, Vimeo or MP4", icon: <Video size={15} /> },
          { type: "audio", label: "Audio", desc: "Embed audio stream or player", icon: <Music size={15} /> },
          { type: "file", label: "File Attachment", desc: "Upload downloadable file block", icon: <FileUp size={15} /> },
          { type: "embed", label: "Web Bookmark / Embed", desc: "Interactive iframe or web page", icon: <Globe size={15} /> },
        ],
      },
    ],
    []
  );

  const filteredGroups = useMemo(() => {
    if (!slashQuery.trim()) return SLASH_GROUPS;
    const q = slashQuery.toLowerCase().trim();
    return SLASH_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (item) => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [SLASH_GROUPS, slashQuery]);

  const executeSlashCommand = (type: any) => {
    if (!slashTargetBlockId) return;

    if (type === "task_reference") {
      setTaskPickerBlockId(slashTargetBlockId);
      setShowTaskPicker(true);
      setSlashMenuOpen(false);
      return;
    }
    if (type === "page_reference") {
      setPagePickerBlockId(slashTargetBlockId);
      setShowPagePicker(true);
      setSlashMenuOpen(false);
      return;
    }

    let defaultData: any = { text: "" };
    if (type === "checklist") defaultData = { text: "", checked: false };
    if (type === "callout" || type === "banner")
      defaultData = { text: "Callout note or key instruction…", bannerType: "info", bannerTitle: "Important Note", icon: "💡" };
    if (type === "pull_quote") defaultData = { text: "A great design is not just what it looks like and feels like. Design is how it works.", author: currentUserName };
    if (type === "code") defaultData = { text: "", language: "typescript" };
    if (type === "columns") defaultData = { colLeft: "Left column note…", colRight: "Right column note…" };
    if (type === "columns_3") defaultData = { col1: "First column", col2: "Second column", col3: "Third column" };
    if (type === "person_reference") defaultData = { userId: currentUserId, userName: currentUserName, userAvatar: currentUserName.charAt(0) };
    if (type === "whiteboard_reference") defaultData = { whiteboardTitle: `${projectName || "Project"} Whiteboard`, whiteboardId: projectId || "" };
    if (type === "clickup_list_table") defaultData = { viewType: "table" };
    if (type === "clickup_list_board") defaultData = { viewType: "board" };
    if (type === "table")
      defaultData = {
        rows: [
          ["Header 1", "Header 2", "Header 3"],
          ["Cell 1", "Cell 2", "Cell 3"],
          ["Cell 4", "Cell 5", "Cell 6"],
        ],
      };
    if (type === "toggle") defaultData = { text: "Toggle details", content: "Hidden expandable information…" };
    if (type === "image") defaultData = { url: "", caption: "", width: "100%", align: "center" };
    if (type === "video") defaultData = { url: "", caption: "Project Demo Video" };
    if (type === "audio") defaultData = { url: "", caption: "Meeting Recording" };
    if (type === "file") defaultData = { url: "", fileName: "Attachment.pdf" };
    if (type === "embed") defaultData = { url: "https://orbitwork.org", caption: "Interactive Embed" };

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
      .filter((b) => ["heading_1", "heading_2", "heading_3", "heading_4"].includes(b.type))
      .map((b) => ({
        id: b.id,
        level: b.type === "heading_1" ? 1 : b.type === "heading_2" ? 2 : b.type === "heading_3" ? 3 : 4,
        text: b.data.text || "Untitled Section",
      }));
  }, [blocks]);

  // Load comments, versions, activities
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

  // Comment handlers
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

  // ---------------------------------------------------------------------------
  // EXPORT HANDLERS (SEPARATING DOWNLOAD PDF FROM PRINT)
  // ---------------------------------------------------------------------------
  const handleExportMarkdown = () => {
    const md = `# ${pageTitle}\n\n${blocksToMarkdown(blocks)}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Markdown downloaded");
  };

  const handleExportHtml = () => {
    const content = blocksToMarkdown(blocks);
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${pageTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #1e293b; }
    h1 { font-size: 28px; margin-bottom: 24px; }
    h2 { font-size: 22px; margin-top: 28px; }
    blockquote { border-left: 4px solid #167c58; margin: 16px 0; padding-left: 16px; color: #475569; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
    th { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>${pageTitle}</h1>
  <div>${content.replace(/\n/g, "<br>")}</div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("HTML downloaded");
  };

  const handleExportPdf = () => {
    try {
      const md = blocksToMarkdown(blocks);
      const pdfBytes = markdownToPdf(md, pageTitle);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pageTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF downloaded to your computer");
    } catch (err: any) {
      showToast("PDF generation failed: " + err?.message);
    }
  };

  const handlePrint = () => {
    // Close modal first so modal does not get printed
    setShowShareModal(false);
    setTimeout(() => {
      window.print();
    }, 120);
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

      {/* TOP BAR / NAVIGATION */}
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
          {/* Autosave Status */}
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

          {/* Width Switcher */}
          <div className="content-width-switcher-wrap" title="Adjust page layout width">
            <button
              type="button"
              className={`width-opt-btn ${editorWidth === "standard" ? "active" : ""}`}
              onClick={() => setEditorWidth("standard")}
              title="Standard width (760px)"
            >
              Standard
            </button>
            <button
              type="button"
              className={`width-opt-btn ${editorWidth === "wide" ? "active" : ""}`}
              onClick={() => setEditorWidth("wide")}
              title="Wide layout (1080px)"
            >
              Wide
            </button>
            <button
              type="button"
              className={`width-opt-btn ${editorWidth === "full" ? "active" : ""}`}
              onClick={() => setEditorWidth("full")}
              title="Full width (100%)"
            >
              Full
            </button>
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
          {/* Find */}
          <button
            type="button"
            className={`topbar-action-btn ${findOpen ? "active" : ""}`}
            onClick={() => setFindOpen(!findOpen)}
            title="Find in page (Ctrl+F)"
          >
            <Search size={15} />
          </button>

          {/* Outline */}
          <button
            type="button"
            className={`topbar-action-btn ${showOutline ? "active" : ""}`}
            onClick={() => setShowOutline(!showOutline)}
            title="Table of Contents"
          >
            <ListTree size={15} />
          </button>

          {/* Comments */}
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

          {/* Favorite */}
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

          {/* Export Menu */}
          <div className="export-menu-wrap">
            <button
              type="button"
              className="topbar-action-btn"
              title="Print Document"
              onClick={handlePrint}
            >
              <Printer size={15} />
            </button>
          </div>

          {/* Share */}
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

      {/* FIND IN PAGE BAR */}
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
          {findQuery && <span className="find-count">{findMatches} matches</span>}
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

      {/* WORKSPACE MAIN BODY */}
      <div className="clickup-workspace-body">
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
          onPaste={handleEditorPaste}
          onDrop={handleEditorDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className={`clickup-editor-inner width-${editorWidth}`}>
            {/* Banner Cover */}
            {pageCover && (
              <div
                className={`doc-cover-banner pos-${coverPosition}`}
                style={{
                  background: pageCover.startsWith("url") || pageCover.startsWith("linear-gradient") ? pageCover : `url('${pageCover}')`,
                  backgroundSize: "cover",
                }}
              >
                <div className="doc-cover-controls-floating">
                  <div className="reposition-bar">
                    <button
                      type="button"
                      className={`reposition-btn ${coverPosition === "top" ? "active" : ""}`}
                      onClick={() => setCoverPosition("top")}
                      title="Reposition top"
                    >
                      Top
                    </button>
                    <button
                      type="button"
                      className={`reposition-btn ${coverPosition === "center" ? "active" : ""}`}
                      onClick={() => setCoverPosition("center")}
                      title="Reposition center"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      className={`reposition-btn ${coverPosition === "bottom" ? "active" : ""}`}
                      onClick={() => setCoverPosition("bottom")}
                      title="Reposition bottom"
                    >
                      Bottom
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCoverGallery(true)}
                    title="Change cover"
                  >
                    <ImageIcon size={13} /> Change cover
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPageCover(null);
                      triggerAutosave(pageTitle, pageIcon, null, blocks);
                    }}
                    title="Remove cover"
                  >
                    <X size={13} /> Remove
                  </button>
                </div>
              </div>
            )}

            {/* Page Header Area */}
            <div className="page-header-block">
              <div className="page-header-actions-row">
                <button
                  type="button"
                  className="page-icon-btn"
                  onClick={() => setShowEmojiPicker(true)}
                  title="Change icon"
                >
                  {pageIcon}
                </button>

                <button
                  type="button"
                  className="add-cover-btn"
                  onClick={() => setShowCoverGallery(true)}
                >
                  <ImageIcon size={13} /> {pageCover ? "Change cover" : "Add cover"}
                </button>
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

              {/* Wiki banner */}
              {doc.is_wiki && (
                <div className="wiki-page-badge-banner">
                  <BookOpen size={16} />
                  <div>
                    <strong>Verified Knowledge Base Article</strong>
                    <p>Maintained by workspace engineering & product teams.</p>
                  </div>
                </div>
              )}
            </div>

            {/* BLOCK STREAM */}
            <div className="doc-blocks-container">
              {blocks.map((block) => (
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
                      title="Block options"
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
                      isFocused={focusedBlockId === block.id}
                      isOnlyBlock={blocks.length === 1}
                      projectId={projectId}
                      tasksInProject={tasksInProject}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onBlur={() => setFocusedBlockId(null)}
                      onChange={(newData) => updateBlockData(block.id, newData)}
                      onEnterPress={() => insertBlockAfter(block.id, "paragraph")}
                      onBackspaceOnEmpty={() => removeBlock(block.id)}
                      onOpenSlashMenu={() => {
                        setSlashTargetBlockId(block.id);
                        setSlashQuery("");
                        setSlashMenuOpen(true);
                      }}
                      onSwitchPage={switchPage}
                      uploadImageFile={uploadImageFile}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Add Block Area */}
            <div
              className="editor-bottom-add"
              onClick={() => {
                const lastId = blocks[blocks.length - 1]?.id || null;
                insertBlockAfter(lastId, "paragraph");
              }}
            >
              <Plus size={14} />
              <span>Click to add a block or type &apos;/&apos; for commands</span>
            </div>
          </div>
        </main>

        {/* SLASH COMMANDS DROPDOWN PALETTE */}
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
                  if (e.key === "Enter" && filteredGroups[0]?.items[0]) {
                    executeSlashCommand(filteredGroups[0].items[0].type);
                  }
                }}
              />
            </div>
            <div className="slash-options-list">
              {filteredGroups.map((group) => (
                <div key={group.category} className="slash-group-section">
                  <div className="slash-category-label">{group.category}</div>
                  {group.items.map((cmd) => (
                    <button
                      key={cmd.label + cmd.type}
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

        {/* RIGHT DRAWER: COMMENTS */}
        {showComments && (
          <aside className="doc-right-drawer comments-drawer">
            <div className="drawer-header">
              <div className="drawer-title">
                <MessageSquare size={16} />
                <span>Comments</span>
              </div>
              <button
                type="button"
                className="drawer-close"
                onClick={() => setShowComments(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="drawer-body">
              {/* New Comment Box */}
              <div className="new-comment-box">
                {selectedQuote && (
                  <div className="comment-quote-preview">
                    <span>&ldquo;{selectedQuote}&rdquo;</span>
                    <button type="button" onClick={() => setSelectedQuote(null)}>
                      <X size={12} />
                    </button>
                  </div>
                )}
                <textarea
                  rows={3}
                  placeholder="Leave a comment or mention @teammate…"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                />
                <div className="new-comment-actions">
                  <button
                    type="button"
                    className="docs-btn-primary"
                    onClick={handleAddComment}
                    disabled={!newCommentText.trim()}
                  >
                    Comment
                  </button>
                </div>
              </div>

              {/* Comments Feed */}
              <div className="comments-feed-list">
                {comments.length === 0 ? (
                  <p className="drawer-empty-msg">No comments on this page yet.</p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className={`comment-thread-card ${c.is_resolved ? "resolved" : ""}`}
                    >
                      <div className="thread-author-row">
                        <div className="author-info">
                          <span className="author-avatar">
                            {c.author_name?.charAt(0) || "U"}
                          </span>
                          <strong>{c.author_name}</strong>
                          <span className="comment-timestamp">
                            {new Date(c.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="thread-actions">
                          <button
                            type="button"
                            className="resolve-btn"
                            onClick={() => handleToggleResolve(c.id, c.is_resolved)}
                            title={c.is_resolved ? "Reopen comment" : "Resolve comment"}
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      </div>

                      {c.selected_text && (
                        <div className="thread-quoted-text">&ldquo;{c.selected_text}&rdquo;</div>
                      )}

                      <div className="thread-content">{c.content}</div>

                      <div className="thread-bottom-bar">
                        <button
                          type="button"
                          className="reply-link"
                          onClick={() =>
                            setReplyingCommentId(replyingCommentId === c.id ? null : c.id)
                          }
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          className="reply-link"
                          onClick={() =>
                            setConvertTaskModal({
                              open: true,
                              title: `Task from Comment: ${c.content.slice(0, 40)}`,
                              description: c.content,
                              commentId: c.id,
                            })
                          }
                        >
                          Create Task
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
                <p className="drawer-empty-msg">No prior version snapshots recorded yet.</p>
              ) : (
                <div className="versions-timeline">
                  {versions.map((ver) => (
                    <div key={ver.id} className="version-item-card">
                      <div className="version-meta">
                        <strong>Version {ver.version_number}</strong>
                        <span>
                          {new Date(ver.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="version-author">
                        Saved by {ver.changer_name || "Team member"}
                      </div>
                      <button
                        type="button"
                        className="restore-version-btn"
                        onClick={async () => {
                          if (confirm(`Restore Version ${ver.version_number}?`)) {
                            setBlocks(ver.content_json);
                            setPageTitle(ver.title);
                            triggerAutosave(ver.title, pageIcon, pageCover, ver.content_json);
                            showToast(`Restored version ${ver.version_number}`);
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

      {/* COVER GALLERY MODAL */}
      {showCoverGallery && (
        <div className="doc-modal-backdrop" onClick={() => setShowCoverGallery(false)}>
          <div className="doc-modal-dialog cover-gallery-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h3>Choose Cover Image</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCoverGallery(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {/* Category tabs */}
              <div className="cover-tabs-nav">
                {(Object.keys(COVER_CATEGORIES) as Array<keyof typeof COVER_CATEGORIES>).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cover-tab-btn ${selectedCoverCategory === cat ? "active" : ""}`}
                    onClick={() => setSelectedCoverCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Gallery Grid */}
              <div className="cover-gallery-grid">
                {COVER_CATEGORIES[selectedCoverCategory].map((item) => (
                  <div
                    key={item.name}
                    className={`cover-gallery-card ${pageCover === item.value ? "selected" : ""}`}
                    style={{
                      background: item.value.startsWith("url") || item.value.startsWith("linear-gradient") ? item.value : `url('${item.value}')`,
                      backgroundSize: "cover",
                    }}
                    onClick={() => {
                      setPageCover(item.value);
                      triggerAutosave(pageTitle, pageIcon, item.value, blocks);
                      setShowCoverGallery(false);
                      showToast(`Cover set to ${item.name}`);
                    }}
                    title={item.name}
                  />
                ))}
              </div>

              {/* Custom Upload Box */}
              <div style={{ marginTop: "16px" }}>
                <input
                  type="file"
                  ref={coverFileInputRef}
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      showToast("Uploading cover image…");
                      const url = await uploadImageFile(file);
                      if (url) {
                        setPageCover(url);
                        triggerAutosave(pageTitle, pageIcon, url, blocks);
                        setShowCoverGallery(false);
                        showToast("Cover image uploaded!");
                      }
                    }
                  }}
                />
                <div
                  className="cover-upload-zone"
                  onClick={() => coverFileInputRef.current?.click()}
                >
                  <UploadCloud size={24} />
                  <span>Upload custom image file (PNG, JPG, WebP)</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {pageCover && (
                <button
                  type="button"
                  className="docs-btn-secondary danger"
                  onClick={() => {
                    setPageCover(null);
                    triggerAutosave(pageTitle, pageIcon, null, blocks);
                    setShowCoverGallery(false);
                    showToast("Cover removed");
                  }}
                >
                  Remove Cover
                </button>
              )}
              <button
                type="button"
                className="docs-btn-secondary"
                onClick={() => setShowCoverGallery(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT ICON PICKER MODAL */}
      {showEmojiPicker && (
        <div className="doc-modal-backdrop" onClick={() => setShowEmojiPicker(false)}>
          <div className="doc-modal-dialog emoji-picker-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h3>Choose Icon</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEmojiPicker(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="emoji-search-box">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search icons…"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="emoji-scroll-grid">
                {Object.values(EMOJI_CATEGORIES)
                  .flat()
                  .filter((emo) => !emojiSearch.trim() || emo.includes(emojiSearch))
                  .map((emo, idx) => (
                    <button
                      key={idx + emo}
                      type="button"
                      className="emoji-item-btn"
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
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="docs-btn-secondary"
                onClick={() => setShowEmojiPicker(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE / EXPORT MODAL */}
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

              {/* Export Options (SEPARATING DOWNLOAD PDF FROM PRINT) */}
              <div className="modal-export-section">
                <strong>Export Options</strong>
                <div className="export-btns-row">
                  <button type="button" className="docs-btn-secondary" onClick={handleExportMarkdown}>
                    <Download size={14} /> Markdown (.md)
                  </button>
                  <button type="button" className="docs-btn-secondary" onClick={handleExportHtml}>
                    <Download size={14} /> HTML (.html)
                  </button>
                  <button type="button" className="docs-btn-secondary" onClick={handleExportPdf}>
                    <Download size={14} /> Download PDF (.pdf)
                  </button>
                  <button type="button" className="docs-btn-secondary" onClick={handlePrint}>
                    <Printer size={14} /> Print Document
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

      {/* EMBED PAGE PICKER MODAL */}
      {showPagePicker && (
        <div className="doc-modal-backdrop" onClick={() => setShowPagePicker(false)}>
          <div className="doc-modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h3>Mention a Page</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowPagePicker(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="task-picker-list">
                {pageTree.map((p) => (
                  <div
                    key={p.id}
                    className="task-picker-item"
                    onClick={() => {
                      if (pagePickerBlockId) {
                        updateBlockData(pagePickerBlockId, {
                          pageId: p.id,
                          pageTitle: p.title,
                        });
                      }
                      setShowPagePicker(false);
                    }}
                  >
                    <span>{p.icon || "📄"}</span>
                    <strong>{p.title}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT COMMENT TO TASK MODAL */}
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
  isFocused,
  isOnlyBlock,
  projectId,
  tasksInProject,
  onFocus,
  onBlur,
  onChange,
  onEnterPress,
  onBackspaceOnEmpty,
  onOpenSlashMenu,
  onSwitchPage,
  uploadImageFile,
}: {
  block: DocBlock;
  isFocused: boolean;
  isOnlyBlock: boolean;
  projectId?: string;
  tasksInProject: Array<{ id: string; title: string; status?: string; priority?: string }>;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (newData: any) => void;
  onEnterPress: () => void;
  onBackspaceOnEmpty: () => void;
  onOpenSlashMenu: () => void;
  onSwitchPage: (pageId: string) => void;
  uploadImageFile: (file: File) => Promise<string | null>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          placeholder={isFocused ? "Heading 1" : ""}
          value={block.data.text || ""}
          onFocus={onFocus}
          onBlur={onBlur}
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
          placeholder={isFocused ? "Heading 2" : ""}
          value={block.data.text || ""}
          onFocus={onFocus}
          onBlur={onBlur}
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
          placeholder={isFocused ? "Heading 3" : ""}
          value={block.data.text || ""}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={handleKeyDown}
        />
      );

    case "heading_4":
      return (
        <input
          id={block.id}
          type="text"
          className="block-input h4"
          placeholder={isFocused ? "Heading 4" : ""}
          value={block.data.text || ""}
          onFocus={onFocus}
          onBlur={onBlur}
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
            placeholder={isFocused ? "To-do item…" : ""}
            value={block.data.text || ""}
            onFocus={onFocus}
            onBlur={onBlur}
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
            placeholder={isFocused ? "List item…" : ""}
            value={block.data.text || ""}
            onFocus={onFocus}
            onBlur={onBlur}
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
            placeholder={isFocused ? "Numbered list item…" : ""}
            value={block.data.text || ""}
            onFocus={onFocus}
            onBlur={onBlur}
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
            placeholder={isFocused ? "Empty quote…" : ""}
            rows={1}
            value={block.data.text || ""}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={(e) => {
              onChange({ text: e.target.value });
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
          />
        </blockquote>
      );

    case "pull_quote":
      return (
        <div className="block-pull-quote">
          <textarea
            className="pull-quote-text"
            placeholder="Large quote text…"
            rows={2}
            value={block.data.text || ""}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <input
            type="text"
            className="pull-quote-author"
            placeholder="— Citation / Author"
            value={block.data.author || ""}
            onChange={(e) => onChange({ author: e.target.value })}
          />
        </div>
      );

    case "callout":
    case "banner": {
      const bannerType = block.data.bannerType || block.data.calloutType || "info";
      return (
        <div className={`block-banner ${bannerType}`}>
          <span
            className="banner-icon-badge"
            onClick={() => {
              const types = ["info", "warning", "success", "danger", "neutral"];
              const curIdx = types.indexOf(bannerType);
              const nextType = types[(curIdx + 1) % types.length];
              const icons = { info: "💡", warning: "⚠️", success: "✅", danger: "🚨", neutral: "📌" };
              onChange({ bannerType: nextType, calloutType: nextType, icon: (icons as any)[nextType] });
            }}
            title="Click to cycle banner tone"
          >
            {block.data.icon || (bannerType === "warning" ? "⚠️" : bannerType === "success" ? "✅" : bannerType === "danger" ? "🚨" : "💡")}
          </span>
          <div className="banner-content-col">
            <input
              type="text"
              className="banner-title-input"
              placeholder="Banner Title…"
              value={block.data.bannerTitle || ""}
              onChange={(e) => onChange({ bannerTitle: e.target.value })}
            />
            <textarea
              className="banner-body-input"
              placeholder="Write callout description…"
              rows={2}
              value={block.data.text || ""}
              onChange={(e) => onChange({ text: e.target.value })}
            />
            <div className="banner-type-picker-strip">
              {(["info", "warning", "success", "danger", "neutral"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="banner-type-chip"
                  onClick={() => onChange({ bannerType: t, calloutType: t })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "divider":
      return <hr className="block-divider-line" />;

    case "columns":
      return (
        <div className="doc-columns-container cols-2">
          <div className="doc-col-box">
            <textarea
              className="block-textarea"
              placeholder="Column 1 text…"
              rows={2}
              value={block.data.colLeft || ""}
              onChange={(e) => onChange({ colLeft: e.target.value })}
            />
          </div>
          <div className="doc-col-box">
            <textarea
              className="block-textarea"
              placeholder="Column 2 text…"
              rows={2}
              value={block.data.colRight || ""}
              onChange={(e) => onChange({ colRight: e.target.value })}
            />
          </div>
        </div>
      );

    case "columns_3":
      return (
        <div className="doc-columns-container cols-3">
          <div className="doc-col-box">
            <textarea
              className="block-textarea"
              placeholder="Col 1…"
              rows={2}
              value={block.data.col1 || ""}
              onChange={(e) => onChange({ col1: e.target.value })}
            />
          </div>
          <div className="doc-col-box">
            <textarea
              className="block-textarea"
              placeholder="Col 2…"
              rows={2}
              value={block.data.col2 || ""}
              onChange={(e) => onChange({ col2: e.target.value })}
            />
          </div>
          <div className="doc-col-box">
            <textarea
              className="block-textarea"
              placeholder="Col 3…"
              rows={2}
              value={block.data.col3 || ""}
              onChange={(e) => onChange({ col3: e.target.value })}
            />
          </div>
        </div>
      );

    case "code":
      return (
        <div className="block-code-container">
          <div className="code-header">
            <span className="code-lang-tag">{block.data.language || "typescript"}</span>
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

    case "image": {
      const hasUrl = Boolean(block.data.url);
      const align = block.data.align || "center";
      const width = block.data.width || "100%";

      return (
        <div
          className="block-image-container"
          style={{
            textAlign: align === "center" ? "center" : align === "right" ? "right" : "left",
          }}
        >
          {hasUrl ? (
            <div style={{ display: "inline-block", maxWidth: "100%", width }}>
              {/* Image Toolbar on Hover */}
              <div className="image-block-toolbar">
                <button
                  type="button"
                  onClick={() => onChange({ align: "left" })}
                  title="Align left"
                >
                  <AlignLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ align: "center" })}
                  title="Align center"
                >
                  <AlignCenter size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ align: "right" })}
                  title="Align right"
                >
                  <AlignRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ width: "25%" })}
                  title="25% width"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ width: "50%" })}
                  title="50% width"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ width: "75%" })}
                  title="75% width"
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ width: "100%" })}
                  title="100% width"
                >
                  100%
                </button>
                <a
                  href={block.data.url}
                  download={block.data.caption || "downloaded-image"}
                  title="Download image"
                >
                  <Download size={12} />
                </a>
                <button
                  type="button"
                  onClick={() => onChange({ url: "" })}
                  title="Replace image"
                >
                  <Edit3 size={12} />
                </button>
              </div>

              {/* Real Image Element */}
              <img
                src={block.data.url}
                alt={block.data.altText || block.data.caption || "Document image"}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  display: "block",
                }}
              />

              {/* Caption */}
              <input
                type="text"
                className="image-caption-input"
                placeholder="Write a caption…"
                value={block.data.caption || ""}
                onChange={(e) => onChange({ caption: e.target.value })}
              />
            </div>
          ) : (
            <div className="image-empty-card">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const uploadedUrl = await uploadImageFile(file);
                    if (uploadedUrl) {
                      onChange({
                        url: uploadedUrl,
                        caption: file.name,
                        width: "100%",
                        align: "center",
                      });
                    }
                  }
                }}
              />
              <ImageIcon size={28} />
              <span>Upload or embed an image</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const inputUrl = prompt("Enter Image URL:");
                    if (inputUrl) {
                      onChange({ url: inputUrl, width: "100%", align: "center" });
                    }
                  }}
                >
                  Embed via URL
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    case "video":
      return (
        <div className="block-media-card">
          {block.data.url ? (
            <div className="media-preview-container">
              {block.data.url.includes("youtube.com") || block.data.url.includes("youtu.be") ? (
                <iframe
                  src={block.data.url.replace("watch?v=", "embed/")}
                  title="Video"
                  width="100%"
                  height="360"
                  allowFullScreen
                />
              ) : (
                <video src={block.data.url} controls width="100%" />
              )}
            </div>
          ) : (
            <div className="media-url-input-box">
              <Video size={20} />
              <input
                type="text"
                placeholder="Enter YouTube, Vimeo, or MP4 URL…"
                value={block.data.url || ""}
                onChange={(e) => onChange({ url: e.target.value })}
              />
            </div>
          )}
        </div>
      );

    case "table": {
      const rows = block.data.rows || [
        ["Header 1", "Header 2", "Header 3"],
        ["Cell 1", "Cell 2", "Cell 3"],
      ];

      const addRow = () => {
        const colCount = rows[0]?.length || 2;
        const newRow = Array(colCount).fill("Cell");
        onChange({ rows: [...rows, newRow] });
      };

      const addCol = () => {
        const nextRows = rows.map((r: string[], i: number) => [
          ...r,
          i === 0 ? `Header ${r.length + 1}` : "Cell",
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
                        className="table-cell-input"
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

    case "clickup_list_table":
      return (
        <div className="block-clickup-tasks-view">
          <div className="clickup-view-header">
            <strong>
              <ListFilter size={15} />
              Connected Project Tasks (Table)
            </strong>
            <span className="task-count-chip">{tasksInProject.length} tasks</span>
          </div>
          <table className="doc-inline-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {tasksInProject.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#94a3b8" }}>
                    No tasks in this project yet.
                  </td>
                </tr>
              ) : (
                tasksInProject.slice(0, 8).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link
                        href={`/projects/${projectId}/tasks/${t.id}`}
                        style={{ color: "inherit", textDecoration: "none", fontWeight: 500 }}
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td>
                      <span className="task-status-pill">{t.status || "To Do"}</span>
                    </td>
                    <td>
                      <span className="task-priority-tag">{t.priority || "Normal"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );

    case "clickup_list_board": {
      const todoTasks = tasksInProject.filter((t) => (t.status || "").toLowerCase().includes("to do") || (t.status || "").toLowerCase().includes("open") || !t.status);
      const inProgTasks = tasksInProject.filter((t) => (t.status || "").toLowerCase().includes("progress") || (t.status || "").toLowerCase().includes("review"));
      const doneTasks = tasksInProject.filter((t) => (t.status || "").toLowerCase().includes("done") || (t.status || "").toLowerCase().includes("complete"));

      return (
        <div className="block-clickup-tasks-view">
          <div className="clickup-view-header">
            <strong>
              <Trello size={15} />
              Connected Project Board
            </strong>
          </div>
          <div className="clickup-view-board-grid">
            <div className="board-column-box">
              <div className="board-col-head">
                <span>To Do</span>
                <span>{todoTasks.length}</span>
              </div>
              {todoTasks.slice(0, 4).map((t) => (
                <div key={t.id} className="board-card-item">
                  <strong>{t.title}</strong>
                  {t.priority && <span>{t.priority}</span>}
                </div>
              ))}
            </div>

            <div className="board-column-box">
              <div className="board-col-head">
                <span>In Progress</span>
                <span>{inProgTasks.length}</span>
              </div>
              {inProgTasks.slice(0, 4).map((t) => (
                <div key={t.id} className="board-card-item">
                  <strong>{t.title}</strong>
                  {t.priority && <span>{t.priority}</span>}
                </div>
              ))}
            </div>

            <div className="board-column-box">
              <div className="board-col-head">
                <span>Done</span>
                <span>{doneTasks.length}</span>
              </div>
              {doneTasks.slice(0, 4).map((t) => (
                <div key={t.id} className="board-card-item">
                  <strong>{t.title}</strong>
                  {t.priority && <span>{t.priority}</span>}
                </div>
              ))}
            </div>
          </div>
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
          {projectId && block.data.taskId && (
            <Link href={`/projects/${projectId}/tasks/${block.data.taskId}`} target="_blank">
              <ExternalLink size={13} className="task-link-out" />
            </Link>
          )}
        </div>
      );

    case "page_reference":
      return (
        <button
          type="button"
          className="doc-mention-pill"
          onClick={() => block.data.pageId && onSwitchPage(block.data.pageId)}
        >
          <FileText size={13} />
          <span>{block.data.pageTitle || "Referenced Page"}</span>
        </button>
      );

    case "person_reference":
      return (
        <span className="doc-mention-pill">
          <AtSign size={13} />
          <span>{block.data.userName || "Teammate"}</span>
        </span>
      );

    case "whiteboard_reference":
      return (
        <Link
          href={`/projects/${projectId}?view=whiteboard`}
          className="doc-mention-pill"
        >
          <PenTool size={13} />
          <span>{block.data.whiteboardTitle || "Whiteboard Canvas"}</span>
        </Link>
      );

    case "toggle":
      return (
        <details className="block-toggle-accordion" open={Boolean(block.data.open)}>
          <summary>
            <input
              type="text"
              className="block-input"
              value={block.data.text || ""}
              placeholder="Toggle Title…"
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </summary>
          <div className="toggle-hidden-content">
            <textarea
              className="block-textarea"
              placeholder="Collapsible content…"
              rows={2}
              value={block.data.content || ""}
              onChange={(e) => onChange({ content: e.target.value })}
            />
          </div>
        </details>
      );

    default:
      return (
        <textarea
          className="block-textarea paragraph"
          placeholder={isFocused || (isOnlyBlock && !block.data.text) ? "Write text or type '/' for commands…" : ""}
          rows={1}
          value={block.data.text || ""}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => {
            onChange({ text: e.target.value });
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={handleKeyDown}
        />
      );
  }
}
