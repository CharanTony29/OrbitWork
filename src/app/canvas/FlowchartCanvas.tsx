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
} from "lucide-react";

export type FlowNode = {
  id: string;
  type: "start" | "process" | "decision" | "end";
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
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

const DEFAULT_TEMPLATES: Record<string, { nodes: FlowNode[]; edges: FlowEdge[] }> = {
  process: {
    nodes: [
      { id: "1", type: "start", text: "Start Process", x: 80, y: 140, w: 120, h: 48 },
      { id: "2", type: "process", text: "Review Specs", x: 260, y: 140, w: 130, h: 48 },
      { id: "3", type: "decision", text: "Approved?", x: 450, y: 124, w: 120, h: 80 },
      { id: "4", type: "process", text: "Implementation", x: 630, y: 140, w: 130, h: 48 },
      { id: "5", type: "process", text: "Revise Requirements", x: 445, y: 260, w: 130, h: 48 },
      { id: "6", type: "end", text: "Complete", x: 820, y: 140, w: 120, h: 48 },
    ],
    edges: [
      { id: "e1", from: "1", to: "2" },
      { id: "e2", from: "2", to: "3" },
      { id: "e3", from: "3", to: "4", label: "Yes" },
      { id: "e4", from: "3", to: "5", label: "No" },
      { id: "e5", from: "5", to: "2" },
      { id: "e6", from: "4", to: "6" },
    ],
  },
  triage: {
    nodes: [
      { id: "1", type: "start", text: "New Task / Bug", x: 80, y: 140, w: 130, h: 48 },
      { id: "2", type: "process", text: "Initial Assessment", x: 270, y: 140, w: 130, h: 48 },
      { id: "3", type: "decision", text: "Blocking?", x: 460, y: 124, w: 120, h: 80 },
      { id: "4", type: "process", text: "Urgent Hotfix", x: 640, y: 80, w: 130, h: 48 },
      { id: "5", type: "process", text: "Standard Sprint Backlog", x: 640, y: 200, w: 150, h: 48 },
      { id: "6", type: "end", text: "Resolved", x: 840, y: 140, w: 110, h: 48 },
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
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"visual" | "mermaid">("visual");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Dragging logic
  const handlePointerDownNode = (e: React.PointerEvent, id: string) => {
    if (readOnly) return;
    e.stopPropagation();

    if (connectFromId) {
      if (connectFromId !== id) {
        // Create new edge
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
    const node = nodes.find((n) => n.id === id);
    if (!node || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    draggingNodeRef.current = {
      id,
      offsetX: mouseX - node.x,
      offsetY: mouseY - node.y,
    };
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!draggingNodeRef.current || readOnly || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { id, offsetX, offsetY } = draggingNodeRef.current;
    const newX = Math.max(20, mouseX - offsetX);
    const newY = Math.max(20, mouseY - offsetY);

    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x: Math.round(newX), y: Math.round(newY) } : n))
    );
  };

  const handlePointerUpCanvas = () => {
    draggingNodeRef.current = null;
  };

  const addNode = (type: FlowNode["type"]) => {
    const id = String(Date.now());
    const newNode: FlowNode = {
      id,
      type,
      text: type === "start" ? "Start" : type === "decision" ? "Check?" : "New Step",
      x: 200 + Math.floor(Math.random() * 80),
      y: 120 + Math.floor(Math.random() * 80),
      w: type === "decision" ? 120 : 130,
      h: type === "decision" ? 80 : 48,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) => prev.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setSelectedNodeId(null);
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

  return (
    <div className="canvas-suite-wrap">
      {/* Top Header */}
      <div className="canvas-header-bar">
        <input
          type="text"
          className="canvas-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Flowchart title…"
          disabled={readOnly}
        />

        <div className="canvas-header-actions">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`mode-toggle-btn${viewMode === "visual" ? " is-active" : ""}`}
              onClick={() => setViewMode("visual")}
              title="Visual Diagram"
            >
              <LayoutGrid size={13} />
              <span>Visual</span>
            </button>
            <button
              type="button"
              className={`mode-toggle-btn${viewMode === "mermaid" ? " is-active" : ""}`}
              onClick={() => setViewMode("mermaid")}
              title="Mermaid Syntax"
            >
              <FileCode size={13} />
              <span>Mermaid</span>
            </button>
          </div>

          {onSave && !readOnly && (
            <button
              type="button"
              className={`canvas-save-btn${saveSuccess ? " is-success" : ""}`}
              onClick={handleSave}
              disabled={isSaving}
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

      {/* Floating Toolbar for Nodes */}
      {!readOnly && viewMode === "visual" && (
        <div className="canvas-floating-toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("start")}
              title="Add Start / End Pill"
            >
              <Play size={13} />
              <span className="tool-label">Start/End</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("process")}
              title="Add Process Step"
            >
              <Square size={13} />
              <span className="tool-label">Process</span>
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => addNode("decision")}
              title="Add Decision Diamond"
            >
              <GitBranch size={13} />
              <span className="tool-label">Decision</span>
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
                  alert("Select a node first, then click Connect Arrow.");
                }
              }}
              title={
                connectFromId
                  ? "Click target node to connect"
                  : "Connect Arrow (Select source node first)"
              }
            >
              <GitCommit size={14} />
              <span className="tool-label">
                {connectFromId ? "Click target node…" : "Connect Arrow"}
              </span>
            </button>

            {selectedNodeId && (
              <button
                type="button"
                className="tool-btn text-danger"
                onClick={deleteSelectedNode}
                title="Delete Selected Node"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="toolbar-divider" />

          {/* Preset Templates */}
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
      <div className="canvas-viewport">
        {viewMode === "mermaid" ? (
          <div className="mermaid-code-view">
            <div className="mermaid-code-header">
              <span>Mermaid Chart Definition</span>
              <button
                type="button"
                className="canvas-action-btn"
                onClick={() => navigator.clipboard.writeText(toMermaidCode())}
              >
                Copy Markdown
              </button>
            </div>
            <pre className="mermaid-code-block">{toMermaidCode()}</pre>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="flowchart-svg-canvas"
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
            onClick={() => {
              setSelectedNodeId(null);
              setConnectFromId(null);
            }}
          >
            {/* Grid Pattern */}
            <defs>
              <pattern id="flow-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="1" fill="rgba(0,0,0,0.08)" />
              </pattern>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
            </defs>

            <rect width="100%" height="100%" fill="url(#flow-grid)" />

            {/* Connecting Edges */}
            {edges.map((edge) => {
              const fromPt = getNodeCenter(edge.from);
              const toPt = getNodeCenter(edge.to);
              const midX = (fromPt.x + toPt.x) / 2;
              const midY = (fromPt.y + toPt.y) / 2;

              return (
                <g key={edge.id} className="flow-edge-group">
                  <line
                    x1={fromPt.x}
                    y1={fromPt.y}
                    x2={toPt.x}
                    y2={toPt.y}
                    stroke="#64748b"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.label && (
                    <text
                      x={midX}
                      y={midY - 8}
                      textAnchor="middle"
                      fill="#475569"
                      fontSize="10"
                      fontWeight="700"
                      className="flow-edge-label"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const isConnecting = node.id === connectFromId;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className={`flow-node-group${isSelected ? " is-selected" : ""}${
                    isConnecting ? " is-connecting" : ""
                  }`}
                  onPointerDown={(e) => handlePointerDownNode(e, node.id)}
                  style={{ cursor: "grab" }}
                >
                  {node.type === "start" || node.type === "end" ? (
                    <rect
                      width={node.w}
                      height={node.h}
                      rx={node.h / 2}
                      className={`flow-node-shape node-${node.type}`}
                    />
                  ) : node.type === "decision" ? (
                    <polygon
                      points={`${node.w / 2},0 ${node.w},${node.h / 2} ${node.w / 2},${node.h} 0,${
                        node.h / 2
                      }`}
                      className="flow-node-shape node-decision"
                    />
                  ) : (
                    <rect
                      width={node.w}
                      height={node.h}
                      rx="8"
                      className="flow-node-shape node-process"
                    />
                  )}

                  {/* Text or editable input */}
                  <foreignObject x={8} y={8} width={node.w - 16} height={node.h - 16}>
                    <div className="flow-node-text-wrap">
                      <input
                        type="text"
                        className="flow-node-input"
                        value={node.text}
                        disabled={readOnly}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes((prev) =>
                            prev.map((n) => (n.id === node.id ? { ...n, text: val } : n))
                          );
                        }}
                      />
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
