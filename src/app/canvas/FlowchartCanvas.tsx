"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  Download,
  Save,
  Check,
  Loader2,
  GitCommit,
  GitBranch,
  Play,
  Square,
  FileCode,
  LayoutGrid,
  Database,
  FileText,
  StickyNote,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  ArrowRight,
  Move,
} from "lucide-react";

export type FlowNodeType =
  | "start"
  | "end"
  | "process"
  | "decision"
  | "data"
  | "document"
  | "database"
  | "note";

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type FlowchartData = {
  version: 1;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  blue: { fill: "#eff6ff", stroke: "#3b82f6", text: "#1e3a8a" },
  green: { fill: "#ecfdf5", stroke: "#10b981", text: "#064e3b" },
  amber: { fill: "#fffbeb", stroke: "#f59e0b", text: "#78350f" },
  purple: { fill: "#faf5ff", stroke: "#a855f7", text: "#581c87" },
  rose: { fill: "#fff1f2", stroke: "#f43f5e", text: "#881337" },
  slate: { fill: "#f8fafc", stroke: "#64748b", text: "#0f172a" },
};

const DEFAULT_TEMPLATES: Record<string, { nodes: FlowNode[]; edges: FlowEdge[] }> = {
  process: {
    nodes: [
      { id: "1", type: "start", text: "Start Process", x: 80, y: 140, w: 130, h: 48, color: "green" },
      { id: "2", type: "process", text: "Review Specs", x: 270, y: 140, w: 140, h: 52, color: "blue" },
      { id: "3", type: "decision", text: "Approved?", x: 470, y: 120, w: 130, h: 90, color: "amber" },
      { id: "4", type: "process", text: "Implementation", x: 670, y: 140, w: 140, h: 52, color: "blue" },
      { id: "5", type: "document", text: "Tech Specs Doc", x: 270, y: 260, w: 140, h: 60, color: "purple" },
      { id: "6", type: "database", text: "Orbit Database", x: 670, y: 260, w: 140, h: 60, color: "slate" },
      { id: "7", type: "end", text: "Completed", x: 880, y: 140, w: 120, h: 48, color: "green" },
    ],
    edges: [
      { id: "e1", from: "1", to: "2" },
      { id: "e2", from: "2", to: "3" },
      { id: "e3", from: "3", to: "4", label: "Yes" },
      { id: "e4", from: "3", to: "5", label: "No / Revise" },
      { id: "e5", from: "4", to: "6" },
      { id: "e6", from: "4", to: "7" },
    ],
  },
  triage: {
    nodes: [
      { id: "1", type: "start", text: "Task / Bug Filed", x: 80, y: 140, w: 140, h: 48, color: "blue" },
      { id: "2", type: "process", text: "Triage Assessment", x: 280, y: 140, w: 150, h: 52, color: "blue" },
      { id: "3", type: "decision", text: "P0 Blocker?", x: 490, y: 120, w: 130, h: 90, color: "rose" },
      { id: "4", type: "process", text: "Hotfix Sprint", x: 680, y: 80, w: 140, h: 52, color: "rose" },
      { id: "5", type: "process", text: "Sprint Backlog", x: 680, y: 220, w: 140, h: 52, color: "slate" },
      { id: "6", type: "end", text: "Resolved", x: 890, y: 140, w: 120, h: 48, color: "green" },
    ],
    edges: [
      { id: "e1", from: "1", to: "2" },
      { id: "e2", from: "2", to: "3" },
      { id: "e3", from: "3", to: "4", label: "Yes" },
      { id: "e4", from: "3", to: "5", label: "No" },
      { id: "e5", from: "4", to: "6" },
      { id: "e6", from: "5", to: "6" },
    ],
  },
};

export default function FlowchartCanvas({
  initialData,
  title: initialTitle = "Untitled Flowchart",
  onSave,
  readOnly = false,
}: {
  initialData?: string | FlowchartData;
  title?: string;
  onSave?: (payload: { title: string; data: string }) => Promise<void>;
  readOnly?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [nodes, setNodes] = useState<FlowNode[]>(DEFAULT_TEMPLATES.process.nodes);
  const [edges, setEdges] = useState<FlowEdge[]>(DEFAULT_TEMPLATES.process.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"visual" | "mermaid">("visual");

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; origPanX: number; origPanY: number }>({ clientX: 0, clientY: 0, origPanX: 0, origPanY: 0 });
  const spacePressedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        spacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spacePressedRef.current = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Parse initial data
  useEffect(() => {
    if (!initialData) return;
    try {
      const parsed = typeof initialData === "string" ? JSON.parse(initialData) : initialData;
      if (parsed.nodes && parsed.edges) {
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
      }
    } catch {
      // not JSON
    }
  }, [initialData]);

  // Screen to virtual canvas coordinates
  const screenToCanvas = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  // Node Dragging logic
  const handlePointerDownNode = (e: React.PointerEvent, id: string) => {
    if (readOnly) return;
    e.stopPropagation();

    if (connectFromId) {
      if (connectFromId !== id) {
        setEdges((prev) => [
          ...prev,
          {
            id: `e_${Date.now()}`,
            from: connectFromId,
            to: id,
          },
        ]);
      }
      setConnectFromId(null);
      return;
    }

    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const pt = screenToCanvas(e.clientX, e.clientY);
    draggingNodeRef.current = {
      id,
      offsetX: pt.x - node.x,
      offsetY: pt.y - node.y,
    };
  };

  const handlePointerDownCanvas = (e: React.PointerEvent) => {
    if (e.button === 1 || spacePressedRef.current || (!selectedNodeId && !connectFromId)) {
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
    }
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectFromId(null);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.origPanX + dx,
        y: panStartRef.current.origPanY + dy,
      });
      return;
    }

    if (!draggingNodeRef.current || readOnly) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    const { id, offsetX, offsetY } = draggingNodeRef.current;
    const newX = Math.round(pt.x - offsetX);
    const newY = Math.round(pt.y - offsetY);

    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x: newX, y: newY } : n))
    );
  };

  const handlePointerUpCanvas = () => {
    draggingNodeRef.current = null;
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.min(2.5, Math.max(0.2, Math.round(zoom * factor * 100) / 100));

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPan((prev) => ({
        x: mouseX - (mouseX - prev.x) * (nextZoom / zoom),
        y: mouseY - (mouseY - prev.y) * (nextZoom / zoom),
      }));
      setZoom(nextZoom);
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const addNode = (type: FlowNodeType) => {
    const id = String(Date.now());
    const pt = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
    const newNode: FlowNode = {
      id,
      type,
      text:
        type === "start"
          ? "Start"
          : type === "end"
          ? "End"
          : type === "decision"
          ? "Decision?"
          : type === "database"
          ? "Database"
          : type === "document"
          ? "Document"
          : type === "data"
          ? "Input / Output"
          : type === "note"
          ? "Note..."
          : "Process Step",
      x: Math.round(pt.x - 70 + (Math.random() * 40 - 20)),
      y: Math.round(pt.y - 30 + (Math.random() * 40 - 20)),
      w: type === "decision" ? 130 : type === "document" || type === "database" ? 140 : 130,
      h: type === "decision" ? 84 : type === "document" || type === "database" ? 56 : 48,
      color: type === "start" || type === "end" ? "green" : type === "decision" ? "amber" : "blue",
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
  };

  const setNodeColor = (colorName: string) => {
    if (!selectedNodeId) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === selectedNodeId ? { ...n, color: colorName } : n))
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) => prev.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const deleteSelectedEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    setSelectedEdgeId(null);
  };

  const handleSave = async () => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    try {
      const payload: FlowchartData = {
        version: 1,
        nodes,
        edges,
      };
      await onSave({
        title: title.trim() || "Untitled Flowchart",
        data: JSON.stringify(payload),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Save error", err);
      alert("Failed to save flowchart. Verify project access permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  // Node center helpers for SVG lines
  const getNodeCenter = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return { x: 0, y: 0 };
    return {
      x: node.x + node.w / 2,
      y: node.y + node.h / 2,
    };
  };

  // Convert to Mermaid string
  const toMermaidCode = () => {
    let out = "graph TD\n";
    for (const n of nodes) {
      const cleanText = n.text.replace(/["\n]/g, " ");
      if (n.type === "start" || n.type === "end") {
        out += `  ${n.id}(["${cleanText}"])\n`;
      } else if (n.type === "decision") {
        out += `  ${n.id}{"${cleanText}"}\n`;
      } else if (n.type === "database") {
        out += `  ${n.id}[("${cleanText}")]\n`;
      } else if (n.type === "document") {
        out += `  ${n.id}>"${cleanText}"]\n`;
      } else {
        out += `  ${n.id}["${cleanText}"]\n`;
      }
    }
    for (const e of edges) {
      if (e.label) {
        out += `  ${e.from} -->|${e.label}| ${e.to}\n`;
      } else {
        out += `  ${e.from} --> ${e.to}\n`;
      }
    }
    return out;
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="canvas-suite-wrap" style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top Header */}
      <div className="canvas-header-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface, #fff)" }}>
        <input
          type="text"
          className="canvas-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Flowchart title…"
          disabled={readOnly}
          style={{ fontSize: 15, fontWeight: 700, border: 0, outline: "none", background: "transparent", color: "var(--ink)" }}
        />

        <div className="canvas-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Zoom Controls */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "var(--soft, #f1f5f2)", padding: "2px 4px", borderRadius: 6, border: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.2, Math.round((z - 0.1) * 100) / 100))}
              title="Zoom out"
              style={{ border: 0, background: "transparent", padding: "3px 6px", cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center" }}
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              title="Reset View"
              style={{ border: 0, background: "transparent", padding: "3px 6px", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 100) / 100))}
              title="Zoom in"
              style={{ border: 0, background: "transparent", padding: "3px 6px", cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center" }}
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <div className="view-mode-toggle">
            <button
              type="button"
              className={`mode-toggle-btn${viewMode === "visual" ? " is-active" : ""}`}
              onClick={() => setViewMode("visual")}
              title="Visual Visio Diagram"
            >
              <LayoutGrid size={13} />
              <span>Diagram</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn${viewMode === "mermaid" ? " is-active" : ""}`}
              onClick={() => setViewMode("mermaid")}
              title="Mermaid Syntax Code"
            >
              <FileCode size={13} />
              <span>Code</span>
            </button>
          </div>

          {onSave && !readOnly && (
            <button
              type="button"
              className={`button button-primary canvas-save-btn${saveSuccess ? " is-success" : ""}`}
              onClick={handleSave}
              disabled={isSaving}
              style={{ minHeight: 32, padding: "0 14px", fontSize: 12, backgroundColor: saveSuccess ? "#16a34a" : undefined }}
            >
              {isSaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : saveSuccess ? (
                <Check size={13} />
              ) : (
                <Save size={13} />
              )}
              <span>{saveSuccess ? "Saved!" : isSaving ? "Saving…" : "Save"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Toolbar — Visio Shapes Palette */}
      {!readOnly && viewMode === "visual" && (
        <div className="canvas-floating-toolbar" style={{ zIndex: 100 }}>
          <div className="toolbar-group">
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("start")}
              title="Start / Terminator (Pill)"
            >
              <Play size={13} />
              <span className="tool-label">Start/End</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("process")}
              title="Process Step (Rectangle)"
            >
              <Square size={13} />
              <span className="tool-label">Process</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("decision")}
              title="Decision Point (Diamond)"
            >
              <GitBranch size={13} />
              <span className="tool-label">Decision</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("data")}
              title="Data / I-O (Parallelogram)"
            >
              <ArrowRight size={13} />
              <span className="tool-label">Data</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("document")}
              title="Document / Report (Wavy base)"
            >
              <FileText size={13} />
              <span className="tool-label">Document</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("database")}
              title="Database (Cylinder)"
            >
              <Database size={13} />
              <span className="tool-label">Database</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("note")}
              title="Annotation / Note"
            >
              <StickyNote size={13} />
              <span className="tool-label">Note</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Connect & Delete */}
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn${connectFromId ? " is-active" : ""}`}
              onClick={() => {
                if (selectedNodeId) {
                  setConnectFromId(connectFromId ? null : selectedNodeId);
                } else {
                  alert("Please click a shape first, then click Connect Arrow.");
                }
              }}
              title={
                connectFromId
                  ? "Now click target node to create arrow"
                  : "Connect Arrow (Select a node first)"
              }
            >
              <GitCommit size={14} />
              <span className="tool-label">
                {connectFromId ? "Click target node…" : "Connect Arrow"}
              </span>
            </button>

            {selectedNode && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 4 }}>
                {Object.keys(NODE_COLORS).map((cKey) => (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => setNodeColor(cKey)}
                    title={`Color ${cKey}`}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      backgroundColor: NODE_COLORS[cKey].stroke,
                      border: selectedNode.color === cKey ? "2px solid #000" : "1px solid rgba(0,0,0,0.2)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            )}

            {selectedNodeId && (
              <button
                type="button"
                className="tool-btn text-danger"
                onClick={deleteSelectedNode}
                title="Delete Selected Shape"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="toolbar-divider" />

          {/* Templates */}
          <div className="toolbar-group">
            <button
              type="button"
              className="template-pill-btn"
              onClick={() => {
                setNodes(DEFAULT_TEMPLATES.process.nodes);
                setEdges(DEFAULT_TEMPLATES.process.edges);
              }}
            >
              Process Template
            </button>
            <button
              type="button"
              className="template-pill-btn"
              onClick={() => {
                setNodes(DEFAULT_TEMPLATES.triage.nodes);
                setEdges(DEFAULT_TEMPLATES.triage.edges);
              }}
            >
              Triage Template
            </button>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <div
        className="canvas-viewport"
        ref={containerRef}
        onWheel={handleWheel}
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "var(--surface, #ffffff)",
          backgroundImage: "radial-gradient(circle, rgba(100, 116, 139, 0.2) 1.2px, transparent 1.2px)",
          backgroundSize: `${Math.max(12, 24 * zoom)}px ${Math.max(12, 24 * zoom)}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          cursor: isPanning ? "grabbing" : "default",
        }}
      >
        {viewMode === "mermaid" ? (
          <div className="mermaid-code-view" style={{ padding: 24, height: "100%", overflowY: "auto" }}>
            <div className="mermaid-code-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>Mermaid Diagram Definition</span>
              <button
                type="button"
                className="canvas-action-btn button button-secondary"
                onClick={() => navigator.clipboard.writeText(toMermaidCode())}
              >
                Copy Markdown
              </button>
            </div>
            <pre className="mermaid-code-block" style={{ padding: 16, borderRadius: 8, background: "#1e293b", color: "#38bdf8", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>{toMermaidCode()}</pre>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="flowchart-svg-canvas"
            style={{ width: "100%", height: "100%", display: "block" }}
            onPointerDown={handlePointerDownCanvas}
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
          >
            <defs>
              <marker
                id="visio-arrow"
                markerWidth="12"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 12 4, 0 8" fill="#475569" />
              </marker>
            </defs>

            {/* Virtual World Group scaled & translated */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Connecting Edges */}
              {edges.map((edge) => {
                const fromPt = getNodeCenter(edge.from);
                const toPt = getNodeCenter(edge.to);
                const midX = (fromPt.x + toPt.x) / 2;
                const midY = (fromPt.y + toPt.y) / 2;
                const isEdgeSelected = edge.id === selectedEdgeId;

                return (
                  <g
                    key={edge.id}
                    className="flow-edge-group"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <line
                      x1={fromPt.x}
                      y1={fromPt.y}
                      x2={toPt.x}
                      y2={toPt.y}
                      stroke={isEdgeSelected ? "var(--green, #167c58)" : "#64748b"}
                      strokeWidth={isEdgeSelected ? "3" : "2"}
                      markerEnd="url(#visio-arrow)"
                    />
                    {edge.label && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-edge.label.length * 4 - 6}
                          y={-14}
                          width={edge.label.length * 8 + 12}
                          height={18}
                          rx={4}
                          fill="#ffffff"
                          stroke="#cbd5e1"
                          strokeWidth="1"
                        />
                        <text
                          x={0}
                          y={-1}
                          textAnchor="middle"
                          fill="#334155"
                          fontSize="10"
                          fontWeight="700"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}

                    {isEdgeSelected && !readOnly && (
                      <g transform={`translate(${midX + 20}, ${midY - 14})`}>
                        <circle
                          r="9"
                          fill="#ef4444"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSelectedEdge(edge.id);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <title>Delete arrow connection</title>
                        </circle>
                        <text
                          textAnchor="middle"
                          dy="3.5"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="700"
                          pointerEvents="none"
                        >
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Visio Shapes */}
              {nodes.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const isConnecting = node.id === connectFromId;
                const colors = NODE_COLORS[node.color || "blue"] || NODE_COLORS.blue;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`flow-node-group${isSelected ? " is-selected" : ""}${isConnecting ? " is-connecting" : ""}`}
                    onPointerDown={(e) => handlePointerDownNode(e, node.id)}
                    style={{ cursor: isConnecting ? "pointer" : "grab" }}
                  >
                    {/* Render Shapes according to Visio types */}
                    {node.type === "start" || node.type === "end" ? (
                      <rect
                        width={node.w}
                        height={node.h}
                        rx={node.h / 2}
                        ry={node.h / 2}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.06))"
                      />
                    ) : node.type === "decision" ? (
                      <polygon
                        points={`${node.w / 2},0 ${node.w},${node.h / 2} ${node.w / 2},${node.h} 0,${node.h / 2}`}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.06))"
                      />
                    ) : node.type === "data" ? (
                      <polygon
                        points={`14,0 ${node.w},0 ${node.w - 14},${node.h} 0,${node.h}`}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.06))"
                      />
                    ) : node.type === "document" ? (
                      <path
                        d={`M 0 0 L ${node.w} 0 L ${node.w} ${node.h - 8} Q ${node.w * 0.75} ${node.h + 5} ${node.w * 0.5} ${node.h - 5} T 0 ${node.h - 3} Z`}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.06))"
                      />
                    ) : node.type === "database" ? (
                      <g>
                        <path
                          d={`M 0 10 L 0 ${node.h - 8} A ${node.w / 2} 8 0 0 0 ${node.w} ${node.h - 8} L ${node.w} 10 Z`}
                          fill={colors.fill}
                          stroke={colors.stroke}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                        <ellipse
                          cx={node.w / 2}
                          cy={10}
                          rx={node.w / 2}
                          ry={8}
                          fill={colors.fill}
                          stroke={colors.stroke}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                      </g>
                    ) : node.type === "note" ? (
                      <polygon
                        points={`0,0 ${node.w - 12},0 ${node.w},12 ${node.w},${node.h} 0,${node.h}`}
                        fill="#fef08a"
                        stroke="#ca8a04"
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.08))"
                      />
                    ) : (
                      <rect
                        width={node.w}
                        height={node.h}
                        rx="6"
                        ry="6"
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.06))"
                      />
                    )}

                    {/* Visio 4 Connector Ports when hovered or selected */}
                    {isSelected && !readOnly && (
                      <g>
                        {/* Top Port */}
                        <circle cx={node.w / 2} cy={0} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
                        {/* Right Port */}
                        <circle cx={node.w} cy={node.h / 2} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
                        {/* Bottom Port */}
                        <circle cx={node.w / 2} cy={node.h} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
                        {/* Left Port */}
                        <circle cx={0} cy={node.h / 2} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
                      </g>
                    )}

                    {/* Direct Editable Text Input (stops pointer propagation so typing works effortlessly) */}
                    <foreignObject
                      x={node.type === "decision" ? 18 : 8}
                      y={node.type === "database" ? 12 : 6}
                      width={node.w - (node.type === "decision" ? 36 : 16)}
                      height={node.h - (node.type === "database" ? 18 : 12)}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <input
                          type="text"
                          value={node.text}
                          disabled={readOnly}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes((prev) =>
                              prev.map((n) => (n.id === node.id ? { ...n, text: val } : n))
                            );
                          }}
                          placeholder="Type step…"
                          style={{
                            width: "100%",
                            border: 0,
                            outline: "none",
                            background: "transparent",
                            fontFamily: "inherit",
                            fontSize: "11px",
                            fontWeight: 700,
                            textAlign: "center",
                            color: colors.text,
                            cursor: "text",
                          }}
                        />
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
