"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Pen,
  Eraser,
  Square,
  Circle as CircleIcon,
  ArrowRight,
  StickyNote,
  Type,
  Undo2,
  Trash2,
  Download,
  Save,
  Check,
  Loader2,
} from "lucide-react";

export type WhiteboardData = {
  version: 1;
  strokes: Array<{
    type: "pen" | "rect" | "circle" | "arrow";
    points?: Array<{ x: number; y: number }>;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    color: string;
    size: number;
  }>;
  stickyNotes: Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
  }>;
};

const DEFAULT_COLORS = [
  "#1f2937", // Charcoal
  "#2563eb", // Blue
  "#16a34a", // Green
  "#dc2626", // Red
  "#d97706", // Amber
  "#9333ea", // Purple
  "#0891b2", // Cyan
  "#ffffff", // White
];

export default function WhiteboardCanvas({
  initialData,
  title: initialTitle = "Untitled Whiteboard",
  onSave,
  readOnly = false,
}: {
  initialData?: string | WhiteboardData;
  title?: string;
  onSave?: (payload: { title: string; data: string }) => Promise<void>;
  readOnly?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [tool, setTool] = useState<"pen" | "eraser" | "rect" | "circle" | "arrow" | "sticky">(
    "pen"
  );
  const [color, setColor] = useState("#2563eb");
  const [lineWidth, setLineWidth] = useState(3);
  const [strokes, setStrokes] = useState<WhiteboardData["strokes"]>([]);
  const [stickyNotes, setStickyNotes] = useState<WhiteboardData["stickyNotes"]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial data
  useEffect(() => {
    if (!initialData) return;
    try {
      const parsed = typeof initialData === "string" ? JSON.parse(initialData) : initialData;
      if (parsed.strokes) setStrokes(parsed.strokes);
      if (parsed.stickyNotes) setStickyNotes(parsed.stickyNotes);
    } catch {
      // not JSON or empty
    }
  }, [initialData]);

  // Adjust canvas size to parent container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    redraw();
  }, [strokes]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Draw grid background
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 24;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.beginPath();
    for (let x = 0; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();

    // Draw committed strokes
    for (const s of strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.type === "pen" && s.points && s.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      } else if (s.type === "rect" && s.x != null && s.y != null && s.w != null && s.h != null) {
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      } else if (s.type === "circle" && s.x != null && s.y != null && s.w != null && s.h != null) {
        ctx.beginPath();
        const rx = Math.abs(s.w) / 2;
        const ry = Math.abs(s.h) / 2;
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === "arrow" && s.points && s.points.length === 2) {
        const [from, to] = s.points;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
          to.x - headLen * Math.cos(angle - Math.PI / 6),
          to.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
          to.x - headLen * Math.cos(angle + Math.PI / 6),
          to.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  // Pointer event handlers
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const pt = getCoordinates(e);

    if (tool === "sticky") {
      setStickyNotes((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          x: pt.x - 60,
          y: pt.y - 40,
          text: "Note...",
          color: "#fef08a", // Default soft yellow
        },
      ]);
      setTool("pen");
      return;
    }

    setIsDrawing(true);
    setStartPoint(pt);
    if (tool === "pen") {
      setCurrentStroke([pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    const pt = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tool === "pen") {
      setCurrentStroke((prev) => [...prev, pt]);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (currentStroke.length > 0) {
        const last = currentStroke[currentStroke.length - 1];
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    } else if (startPoint && (tool === "rect" || tool === "circle" || tool === "arrow")) {
      redraw();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (tool === "rect") {
        ctx.strokeRect(startPoint.x, startPoint.y, pt.x - startPoint.x, pt.y - startPoint.y);
      } else if (tool === "circle") {
        ctx.beginPath();
        const rx = Math.abs(pt.x - startPoint.x) / 2;
        const ry = Math.abs(pt.y - startPoint.y) / 2;
        const cx = startPoint.x + (pt.x - startPoint.x) / 2;
        const cy = startPoint.y + (pt.y - startPoint.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "arrow") {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    setIsDrawing(false);
    const pt = getCoordinates(e);

    if (tool === "pen" && currentStroke.length > 1) {
      setStrokes((prev) => [
        ...prev,
        {
          type: "pen",
          points: [...currentStroke, pt],
          color,
          size: lineWidth,
        },
      ]);
    } else if (startPoint) {
      if (tool === "rect") {
        setStrokes((prev) => [
          ...prev,
          {
            type: "rect",
            x: startPoint.x,
            y: startPoint.y,
            w: pt.x - startPoint.x,
            h: pt.y - startPoint.y,
            color,
            size: lineWidth,
          },
        ]);
      } else if (tool === "circle") {
        setStrokes((prev) => [
          ...prev,
          {
            type: "circle",
            x: startPoint.x,
            y: startPoint.y,
            w: pt.x - startPoint.x,
            h: pt.y - startPoint.y,
            color,
            size: lineWidth,
          },
        ]);
      } else if (tool === "arrow") {
        setStrokes((prev) => [
          ...prev,
          {
            type: "arrow",
            points: [startPoint, pt],
            color,
            size: lineWidth,
          },
        ]);
      }
    }

    setCurrentStroke([]);
    setStartPoint(null);
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (confirm("Clear all drawings and sticky notes?")) {
      setStrokes([]);
      setStickyNotes([]);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${title.replace(/\s+/g, "_")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const handleSave = async () => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    try {
      const payload: WhiteboardData = {
        version: 1,
        strokes,
        stickyNotes,
      };
      await onSave({
        title: title.trim() || "Untitled Whiteboard",
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

  return (
    <div className="canvas-suite-wrap">
      {/* Top action header */}
      <div className="canvas-header-bar">
        <input
          type="text"
          className="canvas-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Whiteboard title…"
          disabled={readOnly}
        />

        <div className="canvas-header-actions">
          <button
            type="button"
            className="canvas-action-btn"
            onClick={handleDownload}
            title="Download PNG"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

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

      {/* Floating Toolbar */}
      {!readOnly && (
        <div className="canvas-floating-toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn${tool === "pen" ? " is-active" : ""}`}
              onClick={() => setTool("pen")}
              title="Freehand Pen"
            >
              <Pen size={15} />
            </button>
            <button
              type="button"
              className={`tool-btn${tool === "rect" ? " is-active" : ""}`}
              onClick={() => setTool("rect")}
              title="Rectangle"
            >
              <Square size={15} />
            </button>
            <button
              type="button"
              className={`tool-btn${tool === "circle" ? " is-active" : ""}`}
              onClick={() => setTool("circle")}
              title="Circle / Ellipse"
            >
              <CircleIcon size={15} />
            </button>
            <button
              type="button"
              className={`tool-btn${tool === "arrow" ? " is-active" : ""}`}
              onClick={() => setTool("arrow")}
              title="Arrow"
            >
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className={`tool-btn${tool === "sticky" ? " is-active" : ""}`}
              onClick={() => setTool("sticky")}
              title="Add Sticky Note"
            >
              <StickyNote size={15} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Color palette */}
          <div className="toolbar-group color-palette">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-dot${color === c ? " is-selected" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Line widths */}
          <div className="toolbar-group">
            {[2, 4, 8].map((w) => (
              <button
                key={w}
                type="button"
                className={`size-btn${lineWidth === w ? " is-active" : ""}`}
                onClick={() => setLineWidth(w)}
                title={`${w}px`}
              >
                <span style={{ width: w + 2, height: w + 2, borderRadius: "50%" }} />
              </button>
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Undo / Clear */}
          <div className="toolbar-group">
            <button
              type="button"
              className="tool-btn"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              title="Undo"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="tool-btn text-danger"
              onClick={handleClear}
              title="Clear Canvas"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Container */}
      <div className="canvas-viewport" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Sticky Notes Overlay */}
        {stickyNotes.map((note) => (
          <div
            key={note.id}
            className="canvas-sticky-note"
            style={{
              left: note.x,
              top: note.y,
              backgroundColor: note.color,
            }}
          >
            <textarea
              value={note.text}
              disabled={readOnly}
              onChange={(e) => {
                const val = e.target.value;
                setStickyNotes((prev) =>
                  prev.map((n) => (n.id === note.id ? { ...n, text: val } : n))
                );
              }}
              placeholder="Sticky note…"
            />
            {!readOnly && (
              <button
                type="button"
                className="sticky-remove-btn"
                onClick={() => setStickyNotes((prev) => prev.filter((n) => n.id !== note.id))}
                title="Remove Note"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
