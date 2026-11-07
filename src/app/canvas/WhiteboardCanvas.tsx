"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Pen,
  Eraser,
  Square,
  Circle as CircleIcon,
  ArrowRight,
  StickyNote,
  Undo2,
  Trash2,
  Download,
  Save,
  Check,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Image as ImageIcon,
  X,
  Hand,
  MousePointer,
  Move,
  Type,
} from "lucide-react";

export type WhiteboardImage = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
};

export type WhiteboardStroke = {
  id?: string;
  type: "pen" | "rect" | "circle" | "arrow" | "text" | "eraser";
  points?: Array<{ x: number; y: number }>;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color: string;
  size: number;
};

function hitTestStroke(pt: { x: number; y: number }, s: WhiteboardStroke): boolean {
  if (s.type === "rect" && s.x != null && s.y != null && s.w != null && s.h != null) {
    const minX = Math.min(s.x, s.x + s.w) - 8;
    const maxX = Math.max(s.x, s.x + s.w) + 8;
    const minY = Math.min(s.y, s.y + s.h) - 8;
    const maxY = Math.max(s.y, s.y + s.h) + 8;
    return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
  }
  if (s.type === "circle" && s.x != null && s.y != null && s.w != null && s.h != null) {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const rx = Math.max(8, Math.abs(s.w) / 2 + 8);
    const ry = Math.max(8, Math.abs(s.h) / 2 + 8);
    const d = Math.pow((pt.x - cx) / rx, 2) + Math.pow((pt.y - cy) / ry, 2);
    return d <= 1.25;
  }
  if (s.type === "arrow" && s.points && s.points.length === 2) {
    const [p1, p2] = s.points;
    const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (lineLen === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y) < 18;
    const u = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / (lineLen * lineLen);
    if (u < 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y) < 18;
    if (u > 1) return Math.hypot(pt.x - p2.x, pt.y - p2.y) < 18;
    const projX = p1.x + u * (p2.x - p1.x);
    const projY = p1.y + u * (p2.y - p1.y);
    return Math.hypot(pt.x - projX, pt.y - projY) < 18;
  }
  if (s.type === "text" && s.x != null && s.y != null) {
    const textWidth = ((s.text?.length || 10) * (s.size || 18) * 0.65) + 16;
    const textHeight = (s.size || 18) * 1.5;
    return pt.x >= s.x - 8 && pt.x <= s.x + textWidth && pt.y >= s.y - textHeight && pt.y <= s.y + 12;
  }
  if (s.type === "pen" && s.points && s.points.length > 0) {
    return s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 16);
  }
  return false;
}

export type WhiteboardData = {
  version: 1;
  strokes: Array<WhiteboardStroke>;
  stickyNotes: Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
  }>;
  images?: Array<WhiteboardImage>;
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
  const [tool, setTool] = useState<"select" | "hand" | "pen" | "eraser" | "rect" | "circle" | "arrow" | "sticky" | "text">(
    "select"
  );
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const draggingShapeRef = useRef<{
    id: string;
    startPt: { x: number; y: number };
    origX?: number;
    origY?: number;
    origPoints?: Array<{ x: number; y: number }>;
  } | null>(null);
  const [color, setColor] = useState("#2563eb");
  const [lineWidth, setLineWidth] = useState(3);
  const [eraserSize, setEraserSize] = useState(24);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveringShape, setHoveringShape] = useState(false);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [stickyNotes, setStickyNotes] = useState<WhiteboardData["stickyNotes"]>([]);
  const [images, setImages] = useState<WhiteboardImage[]>([]);

  // Infinite canvas pan & zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Active dragging state for moving objects
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [resizingImageId, setResizingImageId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spacePressedRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; origX: number; origY: number; origW?: number; origH?: number }>({ clientX: 0, clientY: 0, origX: 0, origY: 0 });
  const panStartRef = useRef<{ clientX: number; clientY: number; origPanX: number; origPanY: number }>({ clientX: 0, clientY: 0, origPanX: 0, origPanY: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA";
      if (e.code === "Space" && !isInput) {
        spacePressedRef.current = true;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !isInput && selectedShapeId) {
        setStrokes((prev) => prev.filter((s) => s.id !== selectedShapeId));
        setSelectedShapeId(null);
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
      if (parsed.strokes) setStrokes(parsed.strokes);
      if (parsed.stickyNotes) setStickyNotes(parsed.stickyNotes);
      if (parsed.images) setImages(parsed.images);
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
  }, [strokes, zoom, pan]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // Convert mouse screen coordinates to canvas virtual coordinates
  const screenToCanvas = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    ctx.save();
    // Apply pan and zoom transform
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

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
      } else if (s.type === "text" && s.x != null && s.y != null && s.text) {
        // Text is rendered via the interactive HTML input overlay to avoid double overlapping
      } else if (s.type === "eraser" && s.points && s.points.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = s.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw dashed selection bounding box around selected shape
      if (selectedShapeId && s.id === selectedShapeId) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5;
        if (s.type === "rect" && s.x != null && s.y != null && s.w != null && s.h != null) {
          ctx.strokeRect(s.x - 3, s.y - 3, s.w + 6, s.h + 6);
        } else if (s.type === "circle" && s.x != null && s.y != null && s.w != null && s.h != null) {
          ctx.strokeRect(s.x - 3, s.y - 3, s.w + 6, s.h + 6);
        } else if (s.type === "arrow" && s.points && s.points.length === 2) {
          const minX = Math.min(s.points[0].x, s.points[1].x) - 6;
          const minY = Math.min(s.points[0].y, s.points[1].y) - 6;
          const maxX = Math.max(s.points[0].x, s.points[1].x) + 6;
          const maxY = Math.max(s.points[0].y, s.points[1].y) + 6;
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        } else if (s.type === "pen" && s.points && s.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of s.points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          }
          ctx.strokeRect(minX - 4, minY - 4, (maxX - minX) + 8, (maxY - minY) + 8);
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }, [strokes, zoom, pan, selectedShapeId]);

  useEffect(() => {
    redraw();
  }, [strokes, zoom, pan, redraw]);

  // Mouse Wheel: Zoom in/out centered at mouse pointer & 2-finger panning
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Centered Zoom
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const nextZoom = Math.min(3.0, Math.max(0.05, Math.round(zoom * zoomFactor * 100) / 100));

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
      // Natural 2-finger pan or scroll
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Clipboard paste support for images
  useEffect(() => {
    if (readOnly) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                const pt = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
                const newImg: WhiteboardImage = {
                  id: `img-${Date.now()}`,
                  x: pt.x - 180,
                  y: pt.y - 120,
                  w: 360,
                  h: 240,
                  src: reader.result,
                };
                setImages((prev) => [...prev, newImg]);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [readOnly, zoom, pan]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const pt = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
        const newImg: WhiteboardImage = {
          id: `img-${Date.now()}`,
          x: pt.x - 180,
          y: pt.y - 130,
          w: 360,
          h: 260,
          src: reader.result,
        };
        setImages((prev) => [...prev, newImg]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Main canvas pointer down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Middle click or hand tool or spacebar -> pan canvas
    if (e.button === 1 || tool === "hand" || spacePressedRef.current) {
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
      return;
    }

    if (readOnly) return;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
    const pt = screenToCanvas(e.clientX, e.clientY);

    // If clicking on an existing shape (rect, circle, arrow, pen) in select mode or any shape creation mode
    if (tool === "select" || (tool !== "pen" && tool !== "eraser")) {
      let hitStroke: WhiteboardStroke | null = null;
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].type !== "eraser" && hitTestStroke(pt, strokes[i])) {
          hitStroke = strokes[i];
          break;
        }
      }

      if (hitStroke) {
        const hitId = hitStroke.id || `stroke-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        if (!hitStroke.id) {
          hitStroke.id = hitId;
          setStrokes((prev) => prev.map((s) => (s === hitStroke ? { ...s, id: hitId } : s)));
        }
        setSelectedShapeId(hitId);
        draggingShapeRef.current = {
          id: hitId,
          startPt: pt,
          origX: hitStroke.x,
          origY: hitStroke.y,
          origPoints: hitStroke.points ? hitStroke.points.map((p) => ({ ...p })) : undefined,
        };
        setTool("select");
        return;
      }

      if (tool === "select") {
        // In select mode on canvas background, drag initiates pan
        setSelectedShapeId(null);
        setIsPanning(true);
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          origPanX: pan.x,
          origPanY: pan.y,
        };
        return;
      }
    }

    if (tool === "text") {
      const newTextId = `text-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newText: WhiteboardStroke = {
        id: newTextId,
        type: "text",
        x: pt.x,
        y: pt.y,
        text: "Text note",
        color,
        size: 18,
      };
      setStrokes((prev) => [...prev, newText]);
      setSelectedShapeId(newTextId);
      setTool("select");
      return;
    }

    if (tool === "sticky") {
      setStickyNotes((prev) => [
        ...prev,
        {
          id: `note-${Date.now()}`,
          x: pt.x - 70,
          y: pt.y - 45,
          text: "Note...",
          color: "#fef08a",
        },
      ]);
      setTool("select");
      return;
    }

    if (tool === "eraser") {
      // Paint-style partial eraser: erase live under cursor
      setIsDrawing(true);
      setCurrentStroke([pt]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.translate(pan.x, pan.y);
          ctx.scale(zoom, zoom);
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, eraserSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      return;
    }

    setIsDrawing(true);
    setStartPoint(pt);
    if (tool === "pen") {
      setCurrentStroke([pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = screenToCanvas(e.clientX, e.clientY);
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (draggingShapeRef.current) {
      const dx = pt.x - draggingShapeRef.current.startPt.x;
      const dy = pt.y - draggingShapeRef.current.startPt.y;
      const dragId = draggingShapeRef.current.id;
      const origX = draggingShapeRef.current.origX ?? 0;
      const origY = draggingShapeRef.current.origY ?? 0;
      const origPoints = draggingShapeRef.current.origPoints;

      setStrokes((prev) =>
        prev.map((s) => {
          if (s.id !== dragId) return s;
          if (s.type === "arrow" || s.type === "pen" || s.type === "eraser") {
            return {
              ...s,
              points: origPoints?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          }
          return {
            ...s,
            x: origX + dx,
            y: origY + dy,
          };
        })
      );
      return;
    }

    if (!isDrawing && !draggingShapeRef.current && !isPanning && tool !== "pen" && tool !== "eraser") {
      const isOver = strokes.some((s) => s.type !== "eraser" && hitTestStroke(pt, s));
      setHoveringShape(isOver);
    }

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.origPanX + dx,
        y: panStartRef.current.origPanY + dy,
      });
      return;
    }

    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tool === "eraser") {
      // Live paint-style eraser
      setCurrentStroke((prev) => [...prev, pt]);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = eraserSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (currentStroke.length > 0) {
        const last = currentStroke[currentStroke.length - 1];
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (tool === "pen") {
      setCurrentStroke((prev) => [...prev, pt]);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
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
      ctx.restore();
    } else if (startPoint && (tool === "rect" || tool === "circle" || tool === "arrow")) {
      redraw();
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
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
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    if (draggingShapeRef.current) {
      draggingShapeRef.current = null;
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing || readOnly) return;
    setIsDrawing(false);
    const pt = screenToCanvas(e.clientX, e.clientY);

    if (tool === "eraser") {
      setStrokes((prev) => [
        ...prev,
        {
          id: `eraser-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: "eraser",
          points: currentStroke.length > 1 ? [...currentStroke, pt] : [{ x: pt.x - 0.5, y: pt.y }, { x: pt.x + 0.5, y: pt.y }],
          color: "rgba(0,0,0,1)",
          size: eraserSize,
        },
      ]);
      setCurrentStroke([]);
    } else if (tool === "pen" && currentStroke.length > 1) {
      setStrokes((prev) => [
        ...prev,
        {
          id: `pen-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: "pen",
          points: [...currentStroke, pt],
          color,
          size: lineWidth,
        },
      ]);
      setCurrentStroke([]);
    } else if (startPoint) {
      if (tool === "rect") {
        const x = Math.min(startPoint.x, pt.x);
        const y = Math.min(startPoint.y, pt.y);
        const w = Math.max(10, Math.abs(pt.x - startPoint.x));
        const h = Math.max(10, Math.abs(pt.y - startPoint.y));
        const newId = `rect-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        setStrokes((prev) => [
          ...prev,
          {
            id: newId,
            type: "rect",
            x,
            y,
            w,
            h,
            color,
            size: lineWidth,
          },
        ]);
        setSelectedShapeId(newId);
        setTool("select");
      } else if (tool === "circle") {
        const x = Math.min(startPoint.x, pt.x);
        const y = Math.min(startPoint.y, pt.y);
        const w = Math.max(10, Math.abs(pt.x - startPoint.x));
        const h = Math.max(10, Math.abs(pt.y - startPoint.y));
        const newId = `circle-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        setStrokes((prev) => [
          ...prev,
          {
            id: newId,
            type: "circle",
            x,
            y,
            w,
            h,
            color,
            size: lineWidth,
          },
        ]);
        setSelectedShapeId(newId);
        setTool("select");
      } else if (tool === "arrow") {
        const newId = `arrow-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        setStrokes((prev) => [
          ...prev,
          {
            id: newId,
            type: "arrow",
            points: [startPoint, pt],
            color,
            size: lineWidth,
          },
        ]);
        setSelectedShapeId(newId);
        setTool("select");
      }
    }

    setCurrentStroke([]);
    setStartPoint(null);
  };

  // Dragging Sticky Note
  const startDragNote = (e: React.PointerEvent, id: string, origX: number, origY: number) => {
    if (readOnly) return;
    e.stopPropagation();
    setDraggingNoteId(id);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX,
      origY,
    };
  };

  // Dragging Image
  const startDragImage = (e: React.PointerEvent, id: string, origX: number, origY: number) => {
    if (readOnly) return;
    e.stopPropagation();
    setDraggingImageId(id);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX,
      origY,
    };
  };

  // Resizing Image
  const startResizeImage = (e: React.PointerEvent, id: string, origW: number, origH: number) => {
    if (readOnly) return;
    e.stopPropagation();
    setResizingImageId(id);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: 0,
      origY: 0,
      origW,
      origH,
    };
  };

  // Window-level mouse move & mouse up to smoothly drag sticky notes / images
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (draggingNoteId) {
        const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
        const dy = (e.clientY - dragStartRef.current.clientY) / zoom;
        setStickyNotes((prev) =>
          prev.map((n) =>
            n.id === draggingNoteId
              ? { ...n, x: Math.round(dragStartRef.current.origX + dx), y: Math.round(dragStartRef.current.origY + dy) }
              : n
          )
        );
      } else if (draggingImageId) {
        const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
        const dy = (e.clientY - dragStartRef.current.clientY) / zoom;
        setImages((prev) =>
          prev.map((img) =>
            img.id === draggingImageId
              ? { ...img, x: Math.round(dragStartRef.current.origX + dx), y: Math.round(dragStartRef.current.origY + dy) }
              : img
          )
        );
      } else if (resizingImageId) {
        const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
        const dy = (e.clientY - dragStartRef.current.clientY) / zoom;
        const newW = Math.max(80, Math.round((dragStartRef.current.origW || 200) + dx));
        const newH = Math.max(60, Math.round((dragStartRef.current.origH || 150) + dy));
        setImages((prev) =>
          prev.map((img) =>
            img.id === resizingImageId ? { ...img, w: newW, h: newH } : img
          )
        );
      }
    };

    const handleWindowPointerUp = () => {
      setDraggingNoteId(null);
      setDraggingImageId(null);
      setResizingImageId(null);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [draggingNoteId, draggingImageId, resizingImageId, zoom]);

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (confirm("Clear all drawings, sticky notes, and images?")) {
      setStrokes([]);
      setStickyNotes([]);
      setImages([]);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Paint text strokes temporarily so the exported PNG contains all text notes
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      strokes.filter((s) => s.type === "text" && s.text).forEach((s) => {
        ctx.fillStyle = s.color;
        ctx.font = `600 ${s.size || 18}px sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(s.text || "", s.x || 0, s.y || 0);
      });
      ctx.restore();
    }
    const a = document.createElement("a");
    a.download = `${title.replace(/\s+/g, "_")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    redraw();
  };

  const handleSave = async () => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    try {
      const payload: WhiteboardData = {
        version: 1,
        strokes,
        stickyNotes,
        images,
      };
      await onSave({
        title: title.trim() || "Untitled Whiteboard",
        data: JSON.stringify(payload),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error("Save error", err);
      alert("Failed to save whiteboard. Please verify project access permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="canvas-suite-wrap" style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top action header */}
      <div className="canvas-header-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface, #fff)" }}>
        <input
          type="text"
          className="canvas-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Whiteboard title…"
          disabled={readOnly}
          style={{ fontSize: 15, fontWeight: 700, border: 0, outline: "none", background: "transparent", color: "var(--ink)" }}
        />

        <div className="canvas-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Zoom Controls */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "var(--soft, #f1f5f2)", padding: "2px 4px", borderRadius: 6, border: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.05, Math.round((z - 0.1) * 100) / 100))}
              title="Zoom out (down to 5%)"
              style={{ border: 0, background: "transparent", padding: "3px 6px", cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center" }}
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset View to 100% and Center"
              style={{ border: 0, background: "transparent", padding: "3px 6px", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--ink)", minWidth: 42, textAlign: "center" }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.0, Math.round((z + 0.1) * 100) / 100))}
              title="Zoom in (up to 300%)"
              style={{ border: 0, background: "transparent", padding: "3px 6px", cursor: "pointer", color: "var(--ink)", display: "flex", alignItems: "center" }}
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset pan & zoom"
              style={{ border: 0, background: "transparent", padding: "3px 5px", cursor: "pointer", color: "var(--muted)" }}
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <button
            type="button"
            className="canvas-action-btn button button-secondary"
            onClick={handleDownload}
            title="Download PNG"
            style={{ minHeight: 32, padding: "0 10px", fontSize: 12 }}
          >
            <Download size={13} />
            <span>Export</span>
          </button>

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

      {/* Floating Toolbar */}
      {!readOnly && (
        <div className="canvas-floating-toolbar" style={{ zIndex: 100 }}>
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn${tool === "select" ? " is-active" : ""}`}
              onClick={() => setTool("select")}
              title="Select / Move Items"
            >
              <MousePointer size={15} />
            </button>
            <button
              type="button"
              className={`tool-btn${tool === "hand" ? " is-active" : ""}`}
              onClick={() => setTool("hand")}
              title="Pan Hand Tool"
            >
              <Hand size={15} />
            </button>
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
              className={`tool-btn${tool === "eraser" ? " is-active" : ""}`}
              onClick={() => setTool("eraser")}
              title="Eraser (click strokes to erase)"
            >
              <Eraser size={15} />
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
              title="Arrow Connector"
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
            <button
              type="button"
              className={`tool-btn${tool === "text" ? " is-active" : ""}`}
              onClick={() => setTool("text")}
              title="Add Text (click canvas to place text box)"
            >
              <Type size={15} />
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Insert Image (or Paste directly with Ctrl+V)"
            >
              <ImageIcon size={15} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageUpload}
            />
          </div>

          <div className="toolbar-divider" />

          {/* Color palette */}
          <div className="toolbar-group colors-group">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-btn${color === c ? " is-active" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Line widths / Eraser size */}
          {tool === "eraser" ? (
            <div className="toolbar-group">
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted, #64748b)", marginRight: 2 }}>
                Size:
              </span>
              {[12, 24, 36, 56].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`size-btn${eraserSize === s ? " is-active" : ""}`}
                  onClick={() => setEraserSize(s)}
                  title={`Eraser ${s}px`}
                >
                  <span
                    style={{
                      width: Math.min(20, Math.max(6, s / 3)),
                      height: Math.min(20, Math.max(6, s / 3)),
                      borderRadius: "50%",
                      border: "1.5px solid currentColor",
                      display: "inline-block",
                    }}
                  />
                </button>
              ))}
            </div>
          ) : (
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
          )}

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

      {/* Main Canvas Viewport with Infinite Dot-Grid Background */}
      <div
        className="canvas-viewport"
        ref={containerRef}
        onWheel={handleWheel}
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "var(--surface, #ffffff)",
          backgroundImage: "radial-gradient(circle, rgba(100, 116, 139, 0.22) 1.2px, transparent 1.2px)",
          backgroundSize: `${Math.max(12, 24 * zoom)}px ${Math.max(12, 24 * zoom)}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          cursor: isPanning || tool === "hand" ? "grab" : tool === "eraser" ? "crosshair" : tool === "select" ? (hoveringShape ? "move" : "default") : "crosshair",
        }}
      >
        {/* Paint-style Eraser Brush Circular Indicator */}
        {tool === "eraser" && mousePos && (
          <div
            style={{
              position: "absolute",
              left: mousePos.x - (eraserSize * zoom) / 2,
              top: mousePos.y - (eraserSize * zoom) / 2,
              width: eraserSize * zoom,
              height: eraserSize * zoom,
              borderRadius: "50%",
              border: "1.5px solid rgba(0, 0, 0, 0.75)",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              boxShadow: "0 0 2px rgba(255, 255, 255, 0.8)",
              pointerEvents: "none",
              zIndex: 150,
            }}
          />
        )}
        {/* Full-viewport canvas element */}
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          style={{ width: "100%", height: "100%", display: "block" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Uploaded / Pasted Images on Canvas — Moveable & Resizable */}
        {images.map((img) => {
          const screenX = img.x * zoom + pan.x;
          const screenY = img.y * zoom + pan.y;
          const screenW = img.w * zoom;
          const screenH = img.h * zoom;

          return (
            <div
              key={img.id}
              style={{
                position: "absolute",
                left: screenX,
                top: screenY,
                width: screenW,
                height: screenH,
                border: "1.5px dashed var(--green, #167c58)",
                borderRadius: 6,
                boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                background: "#fff",
                cursor: "move",
                userSelect: "none",
                zIndex: 20,
              }}
              onPointerDown={(e) => startDragImage(e, img.id, img.x, img.y)}
            >
              <img
                src={img.src}
                alt="Whiteboard graphic"
                style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
              />

              {!readOnly && (
                <>
                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImages((prev) => prev.filter((i) => i.id !== img.id));
                    }}
                    title="Remove image"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.65)",
                      color: "#fff",
                      border: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <X size={13} />
                  </button>

                  {/* Corner Resize Handle */}
                  <div
                    onPointerDown={(e) => startResizeImage(e, img.id, img.w, img.h)}
                    title="Drag to resize image"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 16,
                      height: 16,
                      background: "var(--green, #167c58)",
                      cursor: "nwse-resize",
                      borderTopLeftRadius: 4,
                    }}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Sticky Notes Overlay — Moveable */}
        {stickyNotes.map((note) => {
          const screenX = note.x * zoom + pan.x;
          const screenY = note.y * zoom + pan.y;

          return (
            <div
              key={note.id}
              className="canvas-sticky-note"
              style={{
                position: "absolute",
                left: screenX,
                top: screenY,
                transform: `scale(${Math.max(0.4, zoom)})`,
                transformOrigin: "top left",
                backgroundColor: note.color,
                zIndex: 25,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                borderRadius: 8,
              }}
            >
              {/* Note drag handle bar */}
              <div
                style={{
                  height: 18,
                  cursor: "grab",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 4px",
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                }}
                onPointerDown={(e) => startDragNote(e, note.id, note.x, note.y)}
                title="Drag sticky note"
              >
                <Move size={10} style={{ opacity: 0.5 }} />
                {!readOnly && (
                  <button
                    type="button"
                    className="sticky-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStickyNotes((prev) => prev.filter((n) => n.id !== note.id));
                    }}
                    title="Remove Note"
                    style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 13, color: "rgba(0,0,0,0.5)" }}
                  >
                    ×
                  </button>
                )}
              </div>

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
                style={{ flex: 1, border: 0, outline: "none", background: "transparent", resize: "none", fontSize: 12, padding: "4px 2px" }}
              />
            </div>
          );
        })}

        {/* Text Items Overlay — Moveable & Editable */}
        {strokes.filter((s) => s.type === "text").map((s) => {
          const screenX = (s.x ?? 0) * zoom + pan.x;
          const screenY = (s.y ?? 0) * zoom + pan.y - 14;
          const isSelected = selectedShapeId === s.id;

          const handleStartDrag = (e: React.PointerEvent) => {
            e.stopPropagation();
            setSelectedShapeId(s.id || null);
            const pt = screenToCanvas(e.clientX, e.clientY);
            draggingShapeRef.current = {
              id: s.id || "",
              startPt: pt,
              origX: s.x,
              origY: s.y,
            };
          };

          return (
            <div
              key={s.id}
              style={{
                position: "absolute",
                left: screenX,
                top: screenY,
                zIndex: 26,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
                border: isSelected ? "1.5px dashed #2563eb" : "1px dashed transparent",
                borderRadius: 4,
                padding: "1px 4px",
              }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).tagName !== "INPUT" || tool === "select") {
                  handleStartDrag(e);
                }
              }}
            >
              {!readOnly && (
                <span
                  onPointerDown={handleStartDrag}
                  title="Drag text"
                  style={{
                    cursor: "move",
                    fontSize: 12,
                    color: "var(--muted, #64748b)",
                    userSelect: "none",
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >
                  ⠿
                </span>
              )}
              <input
                type="text"
                value={s.text || ""}
                disabled={readOnly}
                onFocus={() => {
                  setSelectedShapeId(s.id || null);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setStrokes((prev) => prev.map((item) => (item.id === s.id ? { ...item, text: val } : item)));
                }}
                style={{
                  background: "transparent",
                  border: 0,
                  color: s.color,
                  fontSize: Math.max(12, (s.size || 18) * zoom),
                  fontWeight: 600,
                  fontFamily: "inherit",
                  padding: "2px 2px",
                  outline: "none",
                  cursor: tool === "select" ? "move" : "text",
                  minWidth: 60,
                }}
              />
              {isSelected && !readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStrokes((prev) => prev.filter((item) => item.id !== s.id));
                    setSelectedShapeId(null);
                  }}
                  title="Remove text"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#ef4444",
                    color: "#fff",
                    border: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: 12,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
