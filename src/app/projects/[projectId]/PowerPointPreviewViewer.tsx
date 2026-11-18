"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Presentation,
  StickyNote,
  Maximize2,
  Minimize2,
} from "lucide-react";

const EMU_PER_PX = 9525; // 914400 EMU / 96 DPI
const PT_TO_PX = 96 / 72;

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSizePt?: number;
  fontFamily?: string;
}

interface TextParagraph {
  runs: TextRun[];
  align?: "left" | "center" | "right" | "justify";
  bullet?: boolean;
  bulletChar?: string;
  level?: number;
  spaceBeforePx?: number;
  spaceAfterPx?: number;
  lineHeight?: number;
}

interface TableCellData {
  text: string;
  paragraphs: TextParagraph[];
  fillColor?: string;
  colSpan?: number;
  rowSpan?: number;
  hMerge?: boolean;
  vMerge?: boolean;
}

interface SlideElement {
  kind: "text" | "image" | "table" | "line";
  leftPx?: number;
  topPx?: number;
  widthPx?: number;
  heightPx?: number;
  rotationDeg?: number;
  bgColor?: string;
  borderColor?: string;
  borderWidthPx?: number;
  borderRadius?: string;
  vAlign?: "flex-start" | "center" | "flex-end";
  padTopPx?: number;
  padRightPx?: number;
  padBottomPx?: number;
  padLeftPx?: number;
  wrapText?: boolean;
  paragraphs?: TextParagraph[];
  imageUrl?: string;
  tableRows?: TableCellData[][];
  tableColWidthsPx?: number[];
}

interface ParsedSlide {
  index: number;
  bgColor?: string;
  elements: SlideElement[];
  notes?: string;
}

interface GroupTransform {
  x: number;
  y: number;
  cx: number;
  cy: number;
  chX: number;
  chY: number;
  chCx: number;
  chCy: number;
}

type ThemeColorMap = Record<string, string>;

const DEFAULT_THEME_COLORS: ThemeColorMap = {
  dk1: "#000000",
  lt1: "#FFFFFF",
  dk2: "#1F2937",
  lt2: "#F3F4F6",
  tx1: "#000000",
  bg1: "#FFFFFF",
  tx2: "#1F2937",
  bg2: "#F3F4F6",
  accent1: "#2563EB",
  accent2: "#EA580C",
  accent3: "#64748B",
  accent4: "#CA8A04",
  accent5: "#0891B2",
  accent6: "#16A34A",
  hlink: "#2563EB",
  folHlink: "#7C3AED",
};

function getElementsByLocalName(root: Document | Element, localName: string): Element[] {
  const result: Element[] = [];
  const all = root.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) result.push(all[i]);
  }
  return result;
}

function getFirstByLocalName(root: Document | Element, localName: string): Element | null {
  const all = root.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) return all[i];
  }
  return null;
}

function getDirectChildrenByLocalName(parent: Element, localName: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].localName === localName) {
      out.push(parent.children[i]);
    }
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function applyColorModifiers(baseHex: string, colorNode: Element): string {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return baseHex;
  let [r, g, b] = rgb;

  const tintEl = getFirstByLocalName(colorNode, "tint");
  if (tintEl) {
    const val = parseInt(tintEl.getAttribute("val") || "", 10);
    if (!isNaN(val)) {
      const f = val / 100000;
      r = Math.round(r * f + 255 * (1 - f));
      g = Math.round(g * f + 255 * (1 - f));
      b = Math.round(b * f + 255 * (1 - f));
    }
  }

  const shadeEl = getFirstByLocalName(colorNode, "shade");
  if (shadeEl) {
    const val = parseInt(shadeEl.getAttribute("val") || "", 10);
    if (!isNaN(val)) {
      const f = val / 100000;
      r = Math.round(r * f);
      g = Math.round(g * f);
      b = Math.round(b * f);
    }
  }

  const lumModEl = getFirstByLocalName(colorNode, "lumMod");
  const lumOffEl = getFirstByLocalName(colorNode, "lumOff");
  if (lumModEl || lumOffEl) {
    const mod = lumModEl ? parseInt(lumModEl.getAttribute("val") || "100000", 10) / 100000 : 1;
    const off = lumOffEl ? parseInt(lumOffEl.getAttribute("val") || "0", 10) / 100000 : 0;
    r = Math.max(0, Math.min(255, Math.round(r * mod + 255 * off)));
    g = Math.max(0, Math.min(255, Math.round(g * mod + 255 * off)));
    b = Math.max(0, Math.min(255, Math.round(b * mod + 255 * off)));
  }

  const alphaEl = getFirstByLocalName(colorNode, "alpha");
  if (alphaEl) {
    const val = parseInt(alphaEl.getAttribute("val") || "", 10);
    if (!isNaN(val) && val < 100000) {
      const a = Math.max(0, Math.min(1, val / 100000));
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    }
  }

  return `rgb(${r}, ${g}, ${b})`;
}

function extractColor(el: Element | null, theme: ThemeColorMap): string | undefined {
  if (!el) return undefined;
  const srgb = getFirstByLocalName(el, "srgbClr");
  if (srgb) {
    const val = srgb.getAttribute("val");
    if (val && /^[0-9A-Fa-f]{6}$/.test(val)) {
      return applyColorModifiers(`#${val}`, srgb);
    }
  }
  const scheme = getFirstByLocalName(el, "schemeClr");
  if (scheme) {
    const val = scheme.getAttribute("val") || "";
    const mapped = theme[val];
    if (mapped) {
      return applyColorModifiers(mapped, scheme);
    }
  }
  const sysClr = getFirstByLocalName(el, "sysClr");
  if (sysClr) {
    const last = sysClr.getAttribute("lastClr");
    if (last && /^[0-9A-Fa-f]{6}$/.test(last)) {
      return applyColorModifiers(`#${last}`, sysClr);
    }
  }
  return undefined;
}

function extractThemeColors(themeDoc: Document): ThemeColorMap {
  const map: ThemeColorMap = { ...DEFAULT_THEME_COLORS };
  const clrScheme = getFirstByLocalName(themeDoc, "clrScheme");
  if (!clrScheme) return map;

  for (let i = 0; i < clrScheme.children.length; i++) {
    const child = clrScheme.children[i];
    const name = child.localName;
    const srgb = getFirstByLocalName(child, "srgbClr");
    const sysClr = getFirstByLocalName(child, "sysClr");
    const val = srgb?.getAttribute("val") || sysClr?.getAttribute("lastClr");
    if (val && /^[0-9A-Fa-f]{6}$/.test(val)) {
      map[name] = `#${val}`;
    }
  }

  // Standard OOXML aliases
  if (map.dk1) map.tx1 = map.dk1;
  if (map.lt1) map.bg1 = map.lt1;
  if (map.dk2) map.tx2 = map.dk2;
  if (map.lt2) map.bg2 = map.lt2;

  return map;
}

function applyGroupTransforms(
  x: number,
  y: number,
  cx: number,
  cy: number,
  groups: GroupTransform[]
): { x: number; y: number; cx: number; cy: number } {
  let wx = x;
  let wy = y;
  let wcx = cx;
  let wcy = cy;

  // Apply from innermost group outward
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g.chCx > 0 && g.chCy > 0) {
      const sx = g.cx / g.chCx;
      const sy = g.cy / g.chCy;
      wx = g.x + (wx - g.chX) * sx;
      wy = g.y + (wy - g.chY) * sy;
      wcx = wcx * sx;
      wcy = wcy * sy;
    } else {
      wx += g.x;
      wy += g.y;
    }
  }

  return { x: wx, y: wy, cx: wcx, cy: wcy };
}

function extractXfrmPx(
  el: Element,
  groups: GroupTransform[]
): {
  leftPx?: number;
  topPx?: number;
  widthPx?: number;
  heightPx?: number;
  rotationDeg?: number;
} {
  // Prefer direct spPr/xfrm or graphicFrame/xfrm rather than nested group xfrm
  const spPr = getDirectChildrenByLocalName(el, "spPr")[0];
  const xfrm =
    (spPr ? getDirectChildrenByLocalName(spPr, "xfrm")[0] : null) ||
    getDirectChildrenByLocalName(el, "xfrm")[0] ||
    getFirstByLocalName(el, "xfrm");
  if (!xfrm) return {};

  const off = getDirectChildrenByLocalName(xfrm, "off")[0] || getFirstByLocalName(xfrm, "off");
  const ext = getDirectChildrenByLocalName(xfrm, "ext")[0] || getFirstByLocalName(xfrm, "ext");
  if (!off || !ext) return {};

  const rawX = parseInt(off.getAttribute("x") || "", 10);
  const rawY = parseInt(off.getAttribute("y") || "", 10);
  const rawCx = parseInt(ext.getAttribute("cx") || "", 10);
  const rawCy = parseInt(ext.getAttribute("cy") || "", 10);

  if (isNaN(rawX) || isNaN(rawY) || isNaN(rawCx) || isNaN(rawCy)) {
    return {};
  }

  const transformed = applyGroupTransforms(rawX, rawY, rawCx, rawCy, groups);
  const rotAttr = parseInt(xfrm.getAttribute("rot") || "0", 10);
  const rotationDeg = !isNaN(rotAttr) && rotAttr !== 0 ? rotAttr / 60000 : undefined;

  return {
    leftPx: transformed.x / EMU_PER_PX,
    topPx: transformed.y / EMU_PER_PX,
    widthPx: Math.max(0, transformed.cx / EMU_PER_PX),
    heightPx: Math.max(0, transformed.cy / EMU_PER_PX),
    rotationDeg,
  };
}

function parseSpacingPx(spacingEl: Element | undefined): number | undefined {
  if (!spacingEl) return undefined;
  const spcPts = getFirstByLocalName(spacingEl, "spcPts");
  if (spcPts) {
    const val = parseInt(spcPts.getAttribute("val") || "", 10);
    if (!isNaN(val)) return (val / 100) * PT_TO_PX;
  }
  return undefined;
}

function parseRunStyle(
  rPr: Element | undefined,
  theme: ThemeColorMap
): {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSizePt?: number;
  color?: string;
  fontFamily?: string;
} {
  if (!rPr) return {};
  const bAttr = rPr.getAttribute("b");
  const iAttr = rPr.getAttribute("i");
  const uAttr = rPr.getAttribute("u");
  const bold = bAttr !== null ? bAttr === "1" || bAttr === "true" : undefined;
  const italic = iAttr !== null ? iAttr === "1" || iAttr === "true" : undefined;
  const underline = uAttr !== null ? uAttr !== "none" && uAttr !== "0" : undefined;
  const sz = parseInt(rPr.getAttribute("sz") || "", 10);
  const fontSizePt = !isNaN(sz) && sz > 0 ? sz / 100 : undefined;
  const solidFill = getDirectChildrenByLocalName(rPr, "solidFill")[0];
  const color = extractColor(solidFill || null, theme);
  const latin = getDirectChildrenByLocalName(rPr, "latin")[0];
  const typeface = latin?.getAttribute("typeface");
  const fontFamily =
    typeface && !typeface.startsWith("+") ? typeface : undefined;

  return { bold, italic, underline, fontSizePt, color, fontFamily };
}

function parseParagraphs(
  container: Element,
  theme: ThemeColorMap,
  defaultColor?: string
): TextParagraph[] {
  // Read shape-level default text styles from lstStyle if present
  const lstStyle = getDirectChildrenByLocalName(container, "lstStyle")[0];
  const levelDefaults = new Map<number, ReturnType<typeof parseRunStyle>>();
  if (lstStyle) {
    for (let lvl = 1; lvl <= 9; lvl++) {
      const lvlPPr = getDirectChildrenByLocalName(lstStyle, `lvl${lvl}pPr`)[0];
      if (lvlPPr) {
        const defRPr = getDirectChildrenByLocalName(lvlPPr, "defRPr")[0];
        if (defRPr) {
          levelDefaults.set(lvl - 1, parseRunStyle(defRPr, theme));
        }
      }
    }
  }

  const pNodes = getDirectChildrenByLocalName(container, "p");
  const targetPNodes = pNodes.length > 0 ? pNodes : getElementsByLocalName(container, "p");
  const paragraphs: TextParagraph[] = [];

  for (const p of targetPNodes) {
    const pPr = getDirectChildrenByLocalName(p, "pPr")[0];
    let align: TextParagraph["align"] = "left";
    let bullet = false;
    let bulletChar: string | undefined;
    let level = 0;
    let spaceBeforePx: number | undefined;
    let spaceAfterPx: number | undefined;
    let lineHeight: number | undefined;
    let pDefStyle: ReturnType<typeof parseRunStyle> = {};

    if (pPr) {
      const algn = pPr.getAttribute("algn");
      if (algn === "ctr") align = "center";
      else if (algn === "r") align = "right";
      else if (algn === "just") align = "justify";

      const lvl = parseInt(pPr.getAttribute("lvl") || "0", 10);
      if (!isNaN(lvl)) level = lvl;

      const buNone = getFirstByLocalName(pPr, "buNone");
      const buChar = getFirstByLocalName(pPr, "buChar");
      const buAutoNum = getFirstByLocalName(pPr, "buAutoNum");
      if (!buNone && (buChar || buAutoNum)) {
        bullet = true;
        bulletChar = buChar?.getAttribute("char") || "•";
      }

      spaceBeforePx = parseSpacingPx(getDirectChildrenByLocalName(pPr, "spcBef")[0]);
      spaceAfterPx = parseSpacingPx(getDirectChildrenByLocalName(pPr, "spcAft")[0]);

      const lnSpc = getDirectChildrenByLocalName(pPr, "lnSpc")[0];
      if (lnSpc) {
        const spcPct = getFirstByLocalName(lnSpc, "spcPct");
        if (spcPct) {
          const pctVal = parseInt(spcPct.getAttribute("val") || "", 10);
          if (!isNaN(pctVal) && pctVal > 50000 && pctVal < 300000) {
            lineHeight = (pctVal / 100000) * 1.15;
          }
        }
      }

      const defRPr = getDirectChildrenByLocalName(pPr, "defRPr")[0];
      pDefStyle = parseRunStyle(defRPr, theme);
    }

    const lvlStyle = levelDefaults.get(level) || {};
    const endParaRPr = getDirectChildrenByLocalName(p, "endParaRPr")[0];
    const endStyle = parseRunStyle(endParaRPr, theme);

    const runs: TextRun[] = [];
    for (let i = 0; i < p.children.length; i++) {
      const child = p.children[i];
      if (child.localName === "r" || child.localName === "fld") {
        const t = getFirstByLocalName(child, "t");
        if (!t || t.textContent === null || t.textContent === "") continue;
        const rPr = getDirectChildrenByLocalName(child, "rPr")[0];
        const runStyle = parseRunStyle(rPr, theme);

        runs.push({
          text: t.textContent,
          bold: runStyle.bold ?? pDefStyle.bold ?? lvlStyle.bold ?? false,
          italic: runStyle.italic ?? pDefStyle.italic ?? lvlStyle.italic ?? false,
          underline: runStyle.underline ?? pDefStyle.underline ?? lvlStyle.underline ?? false,
          color:
            runStyle.color ??
            pDefStyle.color ??
            lvlStyle.color ??
            endStyle.color ??
            defaultColor,
          fontSizePt:
            runStyle.fontSizePt ??
            pDefStyle.fontSizePt ??
            lvlStyle.fontSizePt ??
            endStyle.fontSizePt,
          fontFamily:
            runStyle.fontFamily ?? pDefStyle.fontFamily ?? lvlStyle.fontFamily,
        });
      } else if (child.localName === "br") {
        runs.push({ text: "\n" });
      }
    }

    if (runs.length > 0) {
      paragraphs.push({
        runs,
        align,
        bullet,
        bulletChar,
        level,
        spaceBeforePx,
        spaceAfterPx,
        lineHeight,
      });
    }
  }

  return paragraphs;
}

function resolveZipPath(baseDir: string, relativeTarget: string): string {
  if (relativeTarget.startsWith("/")) {
    return relativeTarget.slice(1);
  }
  const parts = baseDir.split("/").filter(Boolean);
  for (const seg of relativeTarget.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function guessImageMime(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

function extractBackgroundColor(doc: Document, theme: ThemeColorMap): string | undefined {
  const bg = getFirstByLocalName(doc, "bg");
  if (!bg) return undefined;
  const bgPr = getFirstByLocalName(bg, "bgPr");
  if (bgPr) {
    const solidFill = getDirectChildrenByLocalName(bgPr, "solidFill")[0];
    if (solidFill) return extractColor(solidFill, theme);
    const gradFill = getDirectChildrenByLocalName(bgPr, "gradFill")[0];
    if (gradFill) return extractColor(gradFill, theme);
  }
  const bgRef = getFirstByLocalName(bg, "bgRef");
  if (bgRef) return extractColor(bgRef, theme);
  return extractColor(bg, theme);
}

export default function PowerPointPreviewViewer({
  url,
  height = "76vh",
  fullScreen = false,
}: {
  url: string;
  height?: string;
  fullScreen?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<ParsedSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 960, h: 540 });
  const [scale, setScale] = useState<number>(1);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Sync native browser fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      const active = document.fullscreenElement === rootRef.current;
      setIsFullscreen(active);
      if (!active) setIsCssFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen || isCssFullscreen) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      setIsFullscreen(false);
      setIsCssFullscreen(false);
      return;
    }

    if (rootRef.current?.requestFullscreen) {
      try {
        await rootRef.current.requestFullscreen();
        setIsFullscreen(true);
        return;
      } catch {
        // Fall through to CSS full-viewport fallback
      }
    }
    setIsCssFullscreen(true);
  }, [isFullscreen, isCssFullscreen]);

  // Proportionally scale native PowerPoint canvas to fit available stage cleanly
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const recomputeScale = () => {
      const rect = stageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const padX = isFullscreen || isCssFullscreen ? 32 : 36;
      const padY = isFullscreen || isCssFullscreen ? 32 : 36;
      const availW = Math.max(120, rect.width - padX);
      const availH = Math.max(120, rect.height - padY);
      const nextScale = Math.min(availW / canvasSize.w, availH / canvasSize.h);
      setScale(Math.max(0.15, Math.min(3, nextScale)));
    };

    recomputeScale();
    const ro = new ResizeObserver(recomputeScale);
    ro.observe(stageEl);
    window.addEventListener("resize", recomputeScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputeScale);
    };
  }, [canvasSize.w, canvasSize.h, isFullscreen, isCssFullscreen, showNotes, loading]);

  useEffect(() => {
    let isMounted = true;
    const createdObjectUrls: string[] = [];
    setLoading(true);
    setError(null);
    setSlides([]);
    setCurrentIndex(0);

    async function loadPptx() {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch presentation (${res.status} ${res.statusText})`);
        }
        const buffer = await res.arrayBuffer();
        if (!isMounted) return;

        const zip = await JSZip.loadAsync(buffer);
        const parser = new DOMParser();

        // 0. Parse theme colors if available
        let themeColors: ThemeColorMap = { ...DEFAULT_THEME_COLORS };
        const themePath = Object.keys(zip.files).find((p) => /^ppt\/theme\/theme\d*\.xml$/i.test(p));
        if (themePath && zip.file(themePath)) {
          const themeDoc = parser.parseFromString(await zip.file(themePath)!.async("text"), "application/xml");
          themeColors = extractThemeColors(themeDoc);
        }

        // 1. Read presentation.xml for slide dimensions & slide order
        let slideWidth = 9144000; // Default 10 in (960px at 96 DPI)
        let slideHeight = 5143500; // Default 16:9
        let orderedSlidePaths: string[] = [];

        const presFile = zip.file("ppt/presentation.xml");
        const presRelsFile = zip.file("ppt/_rels/presentation.xml.rels");

        if (presFile) {
          const presXml = parser.parseFromString(await presFile.async("text"), "application/xml");
          const sldSz = getFirstByLocalName(presXml, "sldSz");
          if (sldSz) {
            const cx = parseInt(sldSz.getAttribute("cx") || "", 10);
            const cy = parseInt(sldSz.getAttribute("cy") || "", 10);
            if (!isNaN(cx) && !isNaN(cy) && cx > 0 && cy > 0) {
              slideWidth = cx;
              slideHeight = cy;
            }
          }

          if (presRelsFile) {
            const relsXml = parser.parseFromString(await presRelsFile.async("text"), "application/xml");
            const relMap = new Map<string, string>();
            for (const rel of getElementsByLocalName(relsXml, "Relationship")) {
              const id = rel.getAttribute("Id");
              const target = rel.getAttribute("Target");
              if (id && target) {
                relMap.set(id, resolveZipPath("ppt", target));
              }
            }

            const sldIds = getElementsByLocalName(presXml, "sldId");
            for (const sldId of sldIds) {
              const rId =
                sldId.getAttribute("r:id") ||
                sldId.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
              if (rId && relMap.has(rId)) {
                orderedSlidePaths.push(relMap.get(rId)!);
              }
            }
          }
        }

        if (orderedSlidePaths.length === 0) {
          orderedSlidePaths = Object.keys(zip.files)
            .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
            .sort((a, b) => {
              const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
              const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
              return numA - numB;
            });
        }

        if (orderedSlidePaths.length === 0) {
          throw new Error("No slides found inside this PowerPoint file.");
        }

        const nativeW = Math.round(slideWidth / EMU_PER_PX);
        const nativeH = Math.round(slideHeight / EMU_PER_PX);
        const parsedSlides: ParsedSlide[] = [];

        // Recursive walker for spTree, grpSp, and AlternateContent
        async function collectShapes(
          container: Element,
          groups: GroupTransform[],
          slideRels: Map<string, { target: string; type: string }>,
          elements: SlideElement[]
        ) {
          for (let c = 0; c < container.children.length; c++) {
            const node = container.children[c];
            const lname = node.localName;

            if (lname === "AlternateContent") {
              const fallback = getDirectChildrenByLocalName(node, "Fallback")[0];
              const choice = getDirectChildrenByLocalName(node, "Choice")[0];
              const branch = fallback || choice;
              if (branch) {
                await collectShapes(branch, groups, slideRels, elements);
              }
              continue;
            }

            if (lname === "grpSp") {
              const grpSpPr = getDirectChildrenByLocalName(node, "grpSpPr")[0];
              const xfrm = grpSpPr ? getDirectChildrenByLocalName(grpSpPr, "xfrm")[0] : null;
              let nextGroups = groups;
              if (xfrm) {
                const off = getDirectChildrenByLocalName(xfrm, "off")[0];
                const ext = getDirectChildrenByLocalName(xfrm, "ext")[0];
                const chOff = getDirectChildrenByLocalName(xfrm, "chOff")[0];
                const chExt = getDirectChildrenByLocalName(xfrm, "chExt")[0];
                const gx = parseInt(off?.getAttribute("x") || "0", 10) || 0;
                const gy = parseInt(off?.getAttribute("y") || "0", 10) || 0;
                const gcx = parseInt(ext?.getAttribute("cx") || "0", 10) || 0;
                const gcy = parseInt(ext?.getAttribute("cy") || "0", 10) || 0;
                const chX = parseInt(chOff?.getAttribute("x") || "0", 10) || 0;
                const chY = parseInt(chOff?.getAttribute("y") || "0", 10) || 0;
                const chCx = parseInt(chExt?.getAttribute("cx") || "0", 10) || 0;
                const chCy = parseInt(chExt?.getAttribute("cy") || "0", 10) || 0;
                nextGroups = [...groups, { x: gx, y: gy, cx: gcx, cy: gcy, chX, chY, chCx, chCy }];
              }
              await collectShapes(node, nextGroups, slideRels, elements);
              continue;
            }

            if (lname === "sp" || lname === "cxnSp") {
              const coords = extractXfrmPx(node, groups);
              const spPr = getDirectChildrenByLocalName(node, "spPr")[0];
              const noFill = spPr ? getDirectChildrenByLocalName(spPr, "noFill")[0] : null;
              const solidFill = !noFill && spPr ? getDirectChildrenByLocalName(spPr, "solidFill")[0] : null;
              const gradFill = !noFill && spPr ? getDirectChildrenByLocalName(spPr, "gradFill")[0] : null;
              let fillColor = extractColor(solidFill || gradFill || null, themeColors);

              // Style fallback (p:style > a:fillRef) when shape uses preset style fill
              if (!fillColor && !noFill) {
                const styleNode = getDirectChildrenByLocalName(node, "style")[0];
                const fillRef = styleNode ? getDirectChildrenByLocalName(styleNode, "fillRef")[0] : null;
                const idxAttr = parseInt(fillRef?.getAttribute("idx") || "0", 10);
                if (fillRef && idxAttr > 0) {
                  fillColor = extractColor(fillRef, themeColors);
                }
              }

              // Border / stroke (a:ln)
              const ln = spPr ? getDirectChildrenByLocalName(spPr, "ln")[0] : null;
              const lnNoFill = ln ? getDirectChildrenByLocalName(ln, "noFill")[0] : null;
              const lnSolid = !lnNoFill && ln ? getDirectChildrenByLocalName(ln, "solidFill")[0] : null;
              const borderColor = extractColor(lnSolid || null, themeColors);
              const lnW = ln ? parseInt(ln.getAttribute("w") || "12700", 10) : 0;
              const borderWidthPx =
                borderColor && !isNaN(lnW) && lnW > 0 ? Math.max(1, lnW / EMU_PER_PX) : undefined;

              // Preset geometry (rounded rect / ellipse)
              const prstGeom = spPr ? getDirectChildrenByLocalName(spPr, "prstGeom")[0] : null;
              const prst = prstGeom?.getAttribute("prst") || "";
              let borderRadius: string | undefined;
              if (prst === "ellipse") {
                borderRadius = "50%";
              } else if (prst === "roundRect" || prst === "snipRoundRect") {
                const avLst = getFirstByLocalName(prstGeom!, "avLst");
                const gd = avLst ? getFirstByLocalName(avLst, "gd") : null;
                const fmla = gd?.getAttribute("fmla") || "";
                const adjMatch = fmla.match(/val\s+(\d+)/);
                const adjRatio = adjMatch ? Math.min(0.5, parseInt(adjMatch[1], 10) / 100000) : 0.12;
                const minDim = Math.min(coords.widthPx ?? 0, coords.heightPx ?? 0);
                borderRadius = minDim > 0 ? `${Math.round(minDim * adjRatio)}px` : "6px";
              }

              // Connector / thin line shape
              if (lname === "cxnSp") {
                if (borderColor && coords.widthPx !== undefined && coords.heightPx !== undefined) {
                  elements.push({
                    kind: "line",
                    ...coords,
                    borderColor,
                    borderWidthPx: borderWidthPx || 1.5,
                  });
                }
                continue;
              }

              const txBody = getDirectChildrenByLocalName(node, "txBody")[0];
              const bodyPr = txBody ? getDirectChildrenByLocalName(txBody, "bodyPr")[0] : null;
              const anchor = bodyPr?.getAttribute("anchor");
              const vAlign: SlideElement["vAlign"] =
                anchor === "ctr" ? "center" : anchor === "b" ? "flex-end" : "flex-start";
              const wrapAttr = bodyPr?.getAttribute("wrap");
              const wrapText = wrapAttr !== "none";

              // Convert bodyPr margins (EMU -> px). Default PowerPoint inset is 91440 (9.6px) L/R and 45720 (4.8px) T/B,
              // but clamp gently for tight boxes so single-line KPI labels never clip.
              const parseIns = (attr: string, fallback: number) => {
                const raw = bodyPr?.getAttribute(attr);
                if (raw === null || raw === undefined) return fallback;
                const n = parseInt(raw, 10);
                return isNaN(n) ? fallback : Math.max(0, n / EMU_PER_PX);
              };
              const isTightBox = (coords.heightPx ?? 100) < 36;
              const padTopPx = parseIns("tIns", isTightBox ? 1 : 4);
              const padBottomPx = parseIns("bIns", isTightBox ? 1 : 4);
              const padLeftPx = parseIns("lIns", isTightBox ? 2 : 6);
              const padRightPx = parseIns("rIns", isTightBox ? 2 : 6);

              // Style-level default text color (p:style > a:fontRef)
              const styleNode = getDirectChildrenByLocalName(node, "style")[0];
              const fontRef = styleNode ? getDirectChildrenByLocalName(styleNode, "fontRef")[0] : null;
              const defaultTextColor = extractColor(fontRef || null, themeColors);

              const paragraphs = txBody
                ? parseParagraphs(txBody, themeColors, defaultTextColor)
                : [];

              if (
                paragraphs.length > 0 ||
                ((fillColor || borderColor) &&
                  (coords.widthPx ?? 0) > 0 &&
                  (coords.heightPx ?? 0) > 0)
              ) {
                elements.push({
                  kind: "text",
                  ...coords,
                  bgColor: fillColor,
                  borderColor,
                  borderWidthPx,
                  borderRadius,
                  vAlign,
                  padTopPx,
                  padRightPx,
                  padBottomPx,
                  padLeftPx,
                  wrapText,
                  paragraphs,
                });
              }
            } else if (lname === "pic") {
              const coords = extractXfrmPx(node, groups);
              const blip = getFirstByLocalName(node, "blip");
              const embedId =
                blip?.getAttribute("r:embed") ||
                blip?.getAttributeNS(
                  "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
                  "embed"
                );
              if (embedId && slideRels.has(embedId)) {
                const targetPath = slideRels.get(embedId)!.target;
                const mediaFile = zip.file(targetPath);
                if (mediaFile) {
                  const imgBytes = await mediaFile.async("uint8array");
                  const blob = new Blob([new Uint8Array(imgBytes)], {
                    type: guessImageMime(targetPath),
                  });
                  const objUrl = URL.createObjectURL(blob);
                  createdObjectUrls.push(objUrl);
                  elements.push({
                    kind: "image",
                    ...coords,
                    imageUrl: objUrl,
                  });
                }
              }
            } else if (lname === "graphicFrame") {
              const coords = extractXfrmPx(node, groups);
              const tbl = getFirstByLocalName(node, "tbl");
              if (tbl) {
                const tblGrid = getDirectChildrenByLocalName(tbl, "tblGrid")[0];
                const colWidthsPx: number[] = [];
                if (tblGrid) {
                  for (const gc of getDirectChildrenByLocalName(tblGrid, "gridCol")) {
                    const w = parseInt(gc.getAttribute("w") || "0", 10);
                    if (!isNaN(w) && w > 0) colWidthsPx.push(w / EMU_PER_PX);
                  }
                }

                const rows: TableCellData[][] = [];
                for (const tr of getDirectChildrenByLocalName(tbl, "tr")) {
                  const cells: TableCellData[] = [];
                  for (const tc of getDirectChildrenByLocalName(tr, "tc")) {
                    const hMerge = tc.getAttribute("hMerge") === "1" || tc.getAttribute("hMerge") === "true";
                    const vMerge = tc.getAttribute("vMerge") === "1" || tc.getAttribute("vMerge") === "true";
                    const gridSpan = parseInt(tc.getAttribute("gridSpan") || "1", 10);
                    const rowSpan = parseInt(tc.getAttribute("rowSpan") || "1", 10);
                    const tcPr = getDirectChildrenByLocalName(tc, "tcPr")[0];
                    const tcSolid = tcPr ? getDirectChildrenByLocalName(tcPr, "solidFill")[0] : null;
                    const fillColor = extractColor(tcSolid || null, themeColors);
                    const txBody = getDirectChildrenByLocalName(tc, "txBody")[0];
                    const paragraphs = txBody ? parseParagraphs(txBody, themeColors) : [];
                    const text = paragraphs
                      .map((p) => p.runs.map((r) => r.text).join(""))
                      .join("\n")
                      .trim();
                    cells.push({
                      text,
                      paragraphs,
                      fillColor,
                      colSpan: !isNaN(gridSpan) && gridSpan > 1 ? gridSpan : undefined,
                      rowSpan: !isNaN(rowSpan) && rowSpan > 1 ? rowSpan : undefined,
                      hMerge,
                      vMerge,
                    });
                  }
                  if (cells.length > 0) rows.push(cells);
                }

                if (rows.length > 0) {
                  elements.push({
                    kind: "table",
                    ...coords,
                    tableRows: rows,
                    tableColWidthsPx: colWidthsPx.length > 0 ? colWidthsPx : undefined,
                  });
                }
              }
            }
          }
        }

        for (let idx = 0; idx < orderedSlidePaths.length; idx++) {
          const slidePath = orderedSlidePaths[idx];
          const slideFile = zip.file(slidePath);
          if (!slideFile) continue;

          const slideXmlText = await slideFile.async("text");
          const slideDoc = parser.parseFromString(slideXmlText, "application/xml");

          // Parse slide relationships for images, notes, and slideLayout
          const slideFileName = slidePath.split("/").pop() || "";
          const slideDir = slidePath.slice(0, slidePath.lastIndexOf("/"));
          const relsPath = `${slideDir}/_rels/${slideFileName}.rels`;
          const relsFile = zip.file(relsPath);
          const slideRels = new Map<string, { target: string; type: string }>();

          if (relsFile) {
            const relsDoc = parser.parseFromString(await relsFile.async("text"), "application/xml");
            for (const rel of getElementsByLocalName(relsDoc, "Relationship")) {
              const id = rel.getAttribute("Id");
              const target = rel.getAttribute("Target");
              const type = rel.getAttribute("Type") || "";
              if (id && target) {
                slideRels.set(id, { target: resolveZipPath(slideDir, target), type });
              }
            }
          }

          // Slide background (with layout fallback if inherited)
          let bgColor = extractBackgroundColor(slideDoc, themeColors);
          if (!bgColor) {
            for (const rel of slideRels.values()) {
              if (rel.type.includes("slideLayout")) {
                const layoutFile = zip.file(rel.target);
                if (layoutFile) {
                  const layoutDoc = parser.parseFromString(
                    await layoutFile.async("text"),
                    "application/xml"
                  );
                  bgColor = extractBackgroundColor(layoutDoc, themeColors);
                }
                break;
              }
            }
          }

          const elements: SlideElement[] = [];
          const spTree = getFirstByLocalName(slideDoc, "spTree");
          if (spTree) {
            await collectShapes(spTree, [], slideRels, elements);
          }

          // Parse speaker notes if linked
          let notesText: string | undefined;
          for (const rel of slideRels.values()) {
            if (rel.type.includes("notesSlide")) {
              const notesFile = zip.file(rel.target);
              if (notesFile) {
                const notesDoc = parser.parseFromString(
                  await notesFile.async("text"),
                  "application/xml"
                );
                const tNodes = getElementsByLocalName(notesDoc, "t");
                const joined = tNodes
                  .map((n) => n.textContent || "")
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
                if (joined) notesText = joined;
              }
            }
          }

          parsedSlides.push({
            index: idx + 1,
            bgColor,
            elements,
            notes: notesText,
          });
        }

        if (!isMounted) return;
        setCanvasSize({ w: nativeW, h: nativeH });
        setSlides(parsedSlides);
        setCurrentIndex(0);
        setLoading(false);
      } catch (err: unknown) {
        console.error("Failed to parse PowerPoint file:", err);
        if (isMounted) {
          const msg = err instanceof Error ? err.message : undefined;
          setError(
            msg ||
              "Failed to parse PowerPoint (.pptx) file. Legacy .ppt binary files must be downloaded."
          );
          setLoading(false);
        }
      }
    }

    loadPptx();

    return () => {
      isMounted = false;
      createdObjectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [url]);

  // Keyboard navigation: Left/Right/Space/PageUp/PageDown + F for Fullscreen + Esc for CSS fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && (isFullscreen || isCssFullscreen))) {
        if (slides.length > 1) {
          e.preventDefault();
          setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (slides.length > 1) {
          e.preventDefault();
          setCurrentIndex((i) => Math.max(0, i - 1));
        }
      } else if (e.key === "Escape" && isCssFullscreen) {
        setIsCssFullscreen(false);
      } else if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length, isFullscreen, isCssFullscreen, toggleFullscreen]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
          gap: 12,
          color: "var(--muted)",
          height,
        }}
      >
        <Loader2 size={26} className="animate-spin text-green" />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Rendering PowerPoint slides…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          gap: 10,
          color: "#dc2626",
          textAlign: "center",
          height,
        }}
      >
        <AlertCircle size={28} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Could not render PowerPoint presentation
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)", maxWidth: 420 }}>{error}</span>
      </div>
    );
  }

  const activeSlide = slides[currentIndex];
  const hasPositionedElements = activeSlide?.elements.some(
    (el) => el.leftPx !== undefined && el.topPx !== undefined
  );
  const inFs = isFullscreen || isCssFullscreen;

  const containerStyle: React.CSSProperties = isCssFullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#020617",
      }
    : {
        width: "100%",
        height: isFullscreen ? "100vh" : height,
        display: "flex",
        flexDirection: "column",
        background: inFs ? "#020617" : "#0f172a",
      };

  const scaledW = Math.round(canvasSize.w * scale);
  const scaledH = Math.round(canvasSize.h * scale);

  return (
    <div ref={rootRef} style={containerStyle}>
      {/* Slide Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: inFs ? "#0f172a" : "var(--surface, #f8fafc)",
          borderBottom: inFs ? "1px solid #1e293b" : "1px solid var(--line, #e2e8f0)",
          flexShrink: 0,
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "3px 8px", minHeight: 28, fontSize: 11 }}
            disabled={currentIndex <= 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            title="Previous slide (Left Arrow)"
          >
            <ChevronLeft size={14} />
          </button>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: inFs ? "#f8fafc" : "var(--ink, #0f172a)",
              minWidth: 92,
              textAlign: "center",
            }}
          >
            Slide {currentIndex + 1} of {slides.length}
          </span>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "3px 8px", minHeight: 28, fontSize: 11 }}
            disabled={currentIndex >= slides.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))}
            title="Next slide (Right Arrow)"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            maxWidth: fullScreen || inFs ? "60%" : "45%",
          }}
        >
          {slides.map((s, idx) => (
            <button
              key={s.index}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              style={{
                padding: "3px 8px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: idx === currentIndex ? 700 : 500,
                border:
                  idx === currentIndex
                    ? "1px solid #ea580c"
                    : inFs
                    ? "1px solid #334155"
                    : "1px solid var(--line, #cbd5e1)",
                background:
                  idx === currentIndex
                    ? "#fff7ed"
                    : inFs
                    ? "#1e293b"
                    : "var(--paper, #fff)",
                color:
                  idx === currentIndex
                    ? "#c2410c"
                    : inFs
                    ? "#e2e8f0"
                    : "var(--ink, #334155)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {s.index}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {activeSlide?.notes && (
            <button
              type="button"
              className="button button-secondary"
              style={{
                padding: "3px 9px",
                minHeight: 28,
                fontSize: 11,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
              onClick={() => setShowNotes((v) => !v)}
              title="Toggle speaker notes"
            >
              <StickyNote size={13} />
              <span>{showNotes ? "Hide Notes" : "Speaker Notes"}</span>
            </button>
          )}

          <button
            type="button"
            className="button button-secondary"
            style={{
              padding: "3px 9px",
              minHeight: 28,
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
            onClick={toggleFullscreen}
            title={inFs ? "Exit Full Screen (Esc or F)" : "Full Screen (F)"}
          >
            {inFs ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{inFs ? "Exit Full Screen" : "Full Screen"}</span>
          </button>
        </div>
      </div>

      {/* Slide Stage (Proportionally scaled native PowerPoint canvas) */}
      <div
        ref={stageRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: inFs ? "16px" : "18px",
          background: inFs ? "#020617" : "#1e293b",
          gap: 14,
        }}
      >
        {activeSlide && (
          <div
            style={{
              width: `${scaledW}px`,
              height: `${scaledH}px`,
              position: "relative",
              flexShrink: 0,
              borderRadius: inFs ? 4 : 8,
              boxShadow: "0 14px 40px rgba(0, 0, 0, 0.5)",
              overflow: "hidden",
              background: activeSlide.bgColor || "#ffffff",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${canvasSize.w}px`,
                height: `${canvasSize.h}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                background: activeSlide.bgColor || "#ffffff",
                color: "#0f172a",
                fontFamily: "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif",
                padding: hasPositionedElements ? 0 : "36px 44px",
                display: hasPositionedElements ? "block" : "flex",
                flexDirection: "column",
                gap: 16,
                boxSizing: "border-box",
              }}
            >
              {activeSlide.elements.length === 0 ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#64748b",
                    gap: 10,
                  }}
                >
                  <Presentation size={48} strokeWidth={1.3} />
                  <span style={{ fontSize: 16 }}>
                    Slide {activeSlide.index} (Visual / Empty Slide)
                  </span>
                </div>
              ) : (
                activeSlide.elements.map((el, elIdx) => {
                  const isAbs =
                    hasPositionedElements &&
                    el.leftPx !== undefined &&
                    el.topPx !== undefined;

                  if (el.kind === "line") {
                    const lineW = Math.max(el.widthPx ?? 0, el.borderWidthPx ?? 1.5);
                    const lineH = Math.max(el.heightPx ?? 0, el.borderWidthPx ?? 1.5);
                    return (
                      <div
                        key={elIdx}
                        style={{
                          position: "absolute",
                          left: `${el.leftPx ?? 0}px`,
                          top: `${el.topPx ?? 0}px`,
                          width: `${lineW}px`,
                          height: `${lineH}px`,
                          background: el.borderColor || "#cbd5e1",
                          transform: el.rotationDeg ? `rotate(${el.rotationDeg}deg)` : undefined,
                          transformOrigin: "center",
                        }}
                      />
                    );
                  }

                  const boxStyle: React.CSSProperties = isAbs
                    ? {
                        position: "absolute",
                        left: `${el.leftPx}px`,
                        top: `${el.topPx}px`,
                        width: `${el.widthPx ?? canvasSize.w * 0.8}px`,
                        height: `${el.heightPx ?? 40}px`,
                        background: el.bgColor || "transparent",
                        border:
                          el.borderColor && el.borderWidthPx
                            ? `${el.borderWidthPx}px solid ${el.borderColor}`
                            : undefined,
                        borderRadius: el.borderRadius,
                        transform: el.rotationDeg ? `rotate(${el.rotationDeg}deg)` : undefined,
                        transformOrigin: "center",
                        overflow: el.kind === "image" ? "hidden" : "visible",
                        boxSizing: "border-box",
                      }
                    : {
                        background: el.bgColor || "transparent",
                        border:
                          el.borderColor && el.borderWidthPx
                            ? `${el.borderWidthPx}px solid ${el.borderColor}`
                            : undefined,
                        borderRadius: el.borderRadius || "6px",
                        padding: el.kind === "text" ? "8px 10px" : 0,
                        boxSizing: "border-box",
                      };

                  if (el.kind === "image" && el.imageUrl) {
                    return (
                      <div key={elIdx} style={boxStyle}>
                        <img
                          src={el.imageUrl}
                          alt={`Slide ${activeSlide.index} graphic ${elIdx + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                    );
                  }

                  if (el.kind === "table" && el.tableRows) {
                    return (
                      <div key={elIdx} style={{ ...boxStyle, overflow: "visible" }}>
                        <table
                          style={{
                            width: "100%",
                            height: "100%",
                            borderCollapse: "collapse",
                            tableLayout: el.tableColWidthsPx ? "fixed" : "auto",
                            background: "#ffffff",
                          }}
                        >
                          {el.tableColWidthsPx && (
                            <colgroup>
                              {el.tableColWidthsPx.map((w, ci) => (
                                <col key={ci} style={{ width: `${w}px` }} />
                              ))}
                            </colgroup>
                          )}
                          <tbody>
                            {el.tableRows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => {
                                  if (cell.hMerge || cell.vMerge) return null;
                                  return (
                                    <td
                                      key={cIdx}
                                      colSpan={cell.colSpan}
                                      rowSpan={cell.rowSpan}
                                      style={{
                                        border: "1px solid #cbd5e1",
                                        padding: "5px 8px",
                                        background:
                                          cell.fillColor ||
                                          (rIdx === 0 ? "#f1f5f9" : "#ffffff"),
                                        color: "#0f172a",
                                        verticalAlign: "middle",
                                        fontSize: "13px",
                                        lineHeight: 1.25,
                                        wordBreak: "break-word",
                                      }}
                                    >
                                      {cell.paragraphs.length > 0 ? (
                                        cell.paragraphs.map((p, pIdx) => (
                                          <div
                                            key={pIdx}
                                            style={{ textAlign: p.align || "left" }}
                                          >
                                            {p.runs.map((run, runIdx) => (
                                              <span
                                                key={runIdx}
                                                style={{
                                                  fontWeight: run.bold || rIdx === 0 ? 700 : 400,
                                                  fontStyle: run.italic ? "italic" : "normal",
                                                  color: run.color || undefined,
                                                  fontSize: run.fontSizePt
                                                    ? `${run.fontSizePt * PT_TO_PX}px`
                                                    : "13px",
                                                  fontFamily: run.fontFamily || undefined,
                                                  whiteSpace: "pre-wrap",
                                                }}
                                              >
                                                {run.text}
                                              </span>
                                            ))}
                                          </div>
                                        ))
                                      ) : (
                                        cell.text
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={elIdx}
                      style={{
                        ...boxStyle,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: el.vAlign || "flex-start",
                        padding: `${el.padTopPx ?? 2}px ${el.padRightPx ?? 4}px ${el.padBottomPx ?? 2}px ${el.padLeftPx ?? 4}px`,
                      }}
                    >
                      {(el.paragraphs || []).map((p, pIdx) => (
                        <div
                          key={pIdx}
                          style={{
                            textAlign: p.align || "left",
                            marginTop: p.spaceBeforePx ? `${p.spaceBeforePx}px` : 0,
                            marginBottom:
                              p.spaceAfterPx !== undefined
                                ? `${p.spaceAfterPx}px`
                                : pIdx < (el.paragraphs?.length || 0) - 1
                                ? "2px"
                                : 0,
                            paddingLeft: p.bullet
                              ? `${16 + (p.level || 0) * 18}px`
                              : `${(p.level || 0) * 18}px`,
                            position: "relative",
                            lineHeight: p.lineHeight || 1.18,
                            wordBreak: "break-word",
                            whiteSpace: el.wrapText === false ? "nowrap" : "normal",
                          }}
                        >
                          {p.bullet && (
                            <span
                              style={{
                                position: "absolute",
                                left: `${(p.level || 0) * 18 + 2}px`,
                                top: 0,
                                color: p.runs[0]?.color || "inherit",
                                fontSize: p.runs[0]?.fontSizePt
                                  ? `${p.runs[0].fontSizePt * PT_TO_PX}px`
                                  : "16px",
                              }}
                            >
                              {p.bulletChar || "•"}
                            </span>
                          )}
                          {p.runs.map((run, rIdx) => {
                            const fontPx = run.fontSizePt
                              ? run.fontSizePt * PT_TO_PX
                              : 16;
                            return (
                              <span
                                key={rIdx}
                                style={{
                                  fontWeight: run.bold ? 700 : 400,
                                  fontStyle: run.italic ? "italic" : "normal",
                                  textDecoration: run.underline ? "underline" : undefined,
                                  color: run.color || undefined,
                                  fontSize: `${fontPx}px`,
                                  fontFamily: run.fontFamily || undefined,
                                  whiteSpace: el.wrapText === false ? "pre" : "pre-wrap",
                                }}
                              >
                                {run.text}
                              </span>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {showNotes && activeSlide?.notes && (
          <div
            style={{
              width: "100%",
              maxWidth: `${Math.max(540, scaledW)}px`,
              background: "#fefce8",
              border: "1px solid #fde047",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#713f12",
              lineHeight: 1.5,
              flexShrink: 0,
            }}
          >
            <strong>Speaker Notes:</strong> {activeSlide.notes}
          </div>
        )}
      </div>
    </div>
  );
}
