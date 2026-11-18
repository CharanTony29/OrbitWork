"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Presentation,
  StickyNote,
} from "lucide-react";

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSizePt?: number;
}

interface TextParagraph {
  runs: TextRun[];
  align?: "left" | "center" | "right" | "justify";
  bullet?: boolean;
  level?: number;
}

interface SlideElement {
  kind: "text" | "image" | "table";
  leftPct?: number;
  topPct?: number;
  widthPct?: number;
  heightPct?: number;
  bgColor?: string;
  paragraphs?: TextParagraph[];
  imageUrl?: string;
  tableRows?: string[][];
}

interface ParsedSlide {
  index: number;
  bgColor?: string;
  elements: SlideElement[];
  notes?: string;
}

function getElementsByLocalName(root: Document | Element, localName: string): Element[] {
  const result: Element[] = [];
  const all = root.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName === localName) {
      result.push(el);
    }
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

function extractColor(el: Element | null): string | undefined {
  if (!el) return undefined;
  const srgb = getFirstByLocalName(el, "srgbClr");
  if (srgb) {
    const val = srgb.getAttribute("val");
    if (val && /^[0-9A-Fa-f]{6}$/.test(val)) return `#${val}`;
  }
  return undefined;
}

function extractXfrm(
  el: Element,
  slideWidth: number,
  slideHeight: number
): { leftPct?: number; topPct?: number; widthPct?: number; heightPct?: number } {
  const xfrm = getFirstByLocalName(el, "xfrm");
  if (!xfrm) return {};
  const off = getFirstByLocalName(xfrm, "off");
  const ext = getFirstByLocalName(xfrm, "ext");
  if (!off || !ext) return {};

  const x = parseInt(off.getAttribute("x") || "", 10);
  const y = parseInt(off.getAttribute("y") || "", 10);
  const cx = parseInt(ext.getAttribute("cx") || "", 10);
  const cy = parseInt(ext.getAttribute("cy") || "", 10);

  if (isNaN(x) || isNaN(y) || isNaN(cx) || isNaN(cy) || cx <= 0 || cy <= 0) {
    return {};
  }

  return {
    leftPct: Math.max(0, Math.min(100, (x / slideWidth) * 100)),
    topPct: Math.max(0, Math.min(100, (y / slideHeight) * 100)),
    widthPct: Math.max(1, Math.min(100, (cx / slideWidth) * 100)),
    heightPct: Math.max(1, Math.min(100, (cy / slideHeight) * 100)),
  };
}

function parseParagraphs(container: Element): TextParagraph[] {
  const pNodes = getElementsByLocalName(container, "p");
  const paragraphs: TextParagraph[] = [];

  for (const p of pNodes) {
    const pPr = getDirectChildrenByLocalName(p, "pPr")[0];
    let align: TextParagraph["align"] = "left";
    let bullet = false;
    let level = 0;

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
      if (!buNone && (buChar || buAutoNum || level > 0)) {
        bullet = true;
      }
    }

    const runs: TextRun[] = [];
    for (let i = 0; i < p.children.length; i++) {
      const child = p.children[i];
      if (child.localName === "r" || child.localName === "fld") {
        const t = getFirstByLocalName(child, "t");
        if (!t || !t.textContent) continue;
        const rPr = getDirectChildrenByLocalName(child, "rPr")[0];
        let bold = false;
        let italic = false;
        let fontSizePt: number | undefined;
        let color: string | undefined;

        if (rPr) {
          bold = rPr.getAttribute("b") === "1" || rPr.getAttribute("b") === "true";
          italic = rPr.getAttribute("i") === "1" || rPr.getAttribute("i") === "true";
          const sz = parseInt(rPr.getAttribute("sz") || "", 10);
          if (!isNaN(sz) && sz > 0) fontSizePt = sz / 100;
          const solidFill = getDirectChildrenByLocalName(rPr, "solidFill")[0];
          color = extractColor(solidFill || null);
        }

        runs.push({
          text: t.textContent,
          bold,
          italic,
          color,
          fontSizePt,
        });
      } else if (child.localName === "br") {
        runs.push({ text: "\n" });
      }
    }

    const fullText = runs.map((r) => r.text).join("").trim();
    if (fullText.length > 0) {
      paragraphs.push({ runs, align, bullet, level });
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

export default function PowerPointPreviewViewer({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<ParsedSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [showNotes, setShowNotes] = useState(false);

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

        // 1. Read presentation.xml for slide dimensions & slide order
        let slideWidth = 9144000; // Default 10 inches (16:9 widescreen is 12192000 x 6858000)
        let slideHeight = 6858000;
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

        // Fallback slide discovery if presentation.xml didn't resolve paths
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

        const parsedSlides: ParsedSlide[] = [];

        for (let idx = 0; idx < orderedSlidePaths.length; idx++) {
          const slidePath = orderedSlidePaths[idx];
          const slideFile = zip.file(slidePath);
          if (!slideFile) continue;

          const slideXmlText = await slideFile.async("text");
          const slideDoc = parser.parseFromString(slideXmlText, "application/xml");

          // Parse slide relationships for images and notes
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

          // Slide background
          const bgEl = getFirstByLocalName(slideDoc, "bg");
          const bgColor = extractColor(bgEl);

          const elements: SlideElement[] = [];
          const spTree = getFirstByLocalName(slideDoc, "spTree");

          if (spTree) {
            for (let c = 0; c < spTree.children.length; c++) {
              const node = spTree.children[c];

              if (node.localName === "sp") {
                const coords = extractXfrm(node, slideWidth, slideHeight);
                const spPr = getDirectChildrenByLocalName(node, "spPr")[0];
                const solidFill = spPr ? getDirectChildrenByLocalName(spPr, "solidFill")[0] : null;
                const fillColor = extractColor(solidFill || null);
                const txBody = getDirectChildrenByLocalName(node, "txBody")[0];
                const paragraphs = txBody ? parseParagraphs(txBody) : [];

                if (paragraphs.length > 0 || (fillColor && coords.widthPct && coords.heightPct)) {
                  elements.push({
                    kind: "text",
                    ...coords,
                    bgColor: fillColor,
                    paragraphs,
                  });
                }
              } else if (node.localName === "pic") {
                const coords = extractXfrm(node, slideWidth, slideHeight);
                const blip = getFirstByLocalName(node, "blip");
                const embedId =
                  blip?.getAttribute("r:embed") ||
                  blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
                if (embedId && slideRels.has(embedId)) {
                  const targetPath = slideRels.get(embedId)!.target;
                  const mediaFile = zip.file(targetPath);
                  if (mediaFile) {
                    const imgBytes = await mediaFile.async("uint8array");
                    const blob = new Blob([new Uint8Array(imgBytes)], { type: guessImageMime(targetPath) });
                    const objUrl = URL.createObjectURL(blob);
                    createdObjectUrls.push(objUrl);
                    elements.push({
                      kind: "image",
                      ...coords,
                      imageUrl: objUrl,
                    });
                  }
                }
              } else if (node.localName === "graphicFrame") {
                const coords = extractXfrm(node, slideWidth, slideHeight);
                const tbl = getFirstByLocalName(node, "tbl");
                if (tbl) {
                  const rows: string[][] = [];
                  for (const tr of getDirectChildrenByLocalName(tbl, "tr")) {
                    const cells: string[] = [];
                    for (const tc of getDirectChildrenByLocalName(tr, "tc")) {
                      const tNodes = getElementsByLocalName(tc, "t");
                      cells.push(tNodes.map((n) => n.textContent || "").join(" ").trim());
                    }
                    if (cells.length > 0) rows.push(cells);
                  }
                  if (rows.length > 0) {
                    elements.push({
                      kind: "table",
                      ...coords,
                      tableRows: rows,
                    });
                  }
                }
              }
            }
          }

          // Parse speaker notes if linked
          let notesText: string | undefined;
          for (const rel of slideRels.values()) {
            if (rel.type.includes("notesSlide")) {
              const notesFile = zip.file(rel.target);
              if (notesFile) {
                const notesDoc = parser.parseFromString(await notesFile.async("text"), "application/xml");
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
        setAspectRatio(slideWidth / slideHeight);
        setSlides(parsedSlides);
        setCurrentIndex(0);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to parse PowerPoint file:", err);
        if (isMounted) {
          setError(err.message || "Failed to parse PowerPoint (.pptx) file. Legacy .ppt binary files must be downloaded.");
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

  // Arrow key navigation between slides
  useEffect(() => {
    if (slides.length <= 1) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setCurrentIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12, color: "var(--muted)" }}>
        <Loader2 size={26} className="animate-spin text-green" />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Rendering PowerPoint slides…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 10, color: "#dc2626", textAlign: "center" }}>
        <AlertCircle size={28} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Could not render PowerPoint presentation</span>
        <span style={{ fontSize: 12, color: "var(--muted)", maxWidth: 420 }}>{error}</span>
      </div>
    );
  }

  const activeSlide = slides[currentIndex];
  const hasPositionedElements = activeSlide?.elements.some(
    (el) => el.leftPct !== undefined && el.topPct !== undefined
  );

  return (
    <div style={{ width: "100%", height: "76vh", display: "flex", flexDirection: "column", background: "#0f172a" }}>
      {/* Slide Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "var(--surface, #f8fafc)",
          borderBottom: "1px solid var(--line, #e2e8f0)",
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
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink, #0f172a)", minWidth: 96, textAlign: "center" }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", maxWidth: "55%" }}>
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
                border: idx === currentIndex ? "1px solid #ea580c" : "1px solid var(--line, #cbd5e1)",
                background: idx === currentIndex ? "#fff7ed" : "var(--paper, #fff)",
                color: idx === currentIndex ? "#c2410c" : "var(--ink, #334155)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {s.index}
            </button>
          ))}
        </div>

        {activeSlide?.notes && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setShowNotes((v) => !v)}
            style={{ padding: "3px 10px", minHeight: 28, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <StickyNote size={12} />
            <span>{showNotes ? "Hide Notes" : "Speaker Notes"}</span>
          </button>
        )}
      </div>

      {/* Main Slide Canvas */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          background: "#1e293b",
          gap: 14,
        }}
      >
        {activeSlide && (
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "860px",
              aspectRatio: `${aspectRatio}`,
              background: activeSlide.bgColor || "#ffffff",
              borderRadius: 8,
              boxShadow: "0 14px 40px rgba(0, 0, 0, 0.45)",
              overflow: "hidden",
              color: "#0f172a",
              padding: hasPositionedElements ? 0 : "28px 34px",
              display: hasPositionedElements ? "block" : "flex",
              flexDirection: "column",
              gap: 14,
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
                  gap: 8,
                }}
              >
                <Presentation size={36} strokeWidth={1.3} />
                <span style={{ fontSize: 13 }}>Slide {activeSlide.index} (Visual / Empty Slide)</span>
              </div>
            ) : (
              activeSlide.elements.map((el, elIdx) => {
                const isAbs = hasPositionedElements && el.leftPct !== undefined && el.topPct !== undefined;
                const boxStyle: React.CSSProperties = isAbs
                  ? {
                      position: "absolute",
                      left: `${el.leftPct}%`,
                      top: `${el.topPct}%`,
                      width: `${el.widthPct ?? 80}%`,
                      height: `${el.heightPct ?? 20}%`,
                      background: el.bgColor || "transparent",
                      overflow: "hidden",
                      padding: el.kind === "text" ? "4px 6px" : 0,
                      boxSizing: "border-box",
                    }
                  : {
                      background: el.bgColor || "transparent",
                      padding: el.kind === "text" ? "6px 8px" : 0,
                      borderRadius: 6,
                    };

                if (el.kind === "image" && el.imageUrl) {
                  return (
                    <div key={elIdx} style={boxStyle}>
                      <img
                        src={el.imageUrl}
                        alt={`Slide ${activeSlide.index} graphic ${elIdx + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                      />
                    </div>
                  );
                }

                if (el.kind === "table" && el.tableRows) {
                  return (
                    <div key={elIdx} style={{ ...boxStyle, overflow: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 11,
                          background: "#ffffff",
                        }}
                      >
                        <tbody>
                          {el.tableRows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  style={{
                                    border: "1px solid #cbd5e1",
                                    padding: "4px 7px",
                                    fontWeight: rIdx === 0 ? 700 : 400,
                                    background: rIdx === 0 ? "#f1f5f9" : "#ffffff",
                                    color: "#0f172a",
                                  }}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                return (
                  <div key={elIdx} style={boxStyle}>
                    {(el.paragraphs || []).map((p, pIdx) => (
                      <div
                        key={pIdx}
                        style={{
                          textAlign: p.align || "left",
                          marginBottom: 4,
                          paddingLeft: p.bullet ? `${14 + (p.level || 0) * 12}px` : `${(p.level || 0) * 12}px`,
                          position: "relative",
                          lineHeight: 1.32,
                          wordBreak: "break-word",
                        }}
                      >
                        {p.bullet && (
                          <span
                            style={{
                              position: "absolute",
                              left: `${(p.level || 0) * 12 + 2}px`,
                              top: 0,
                              color: p.runs[0]?.color || "inherit",
                            }}
                          >
                            •
                          </span>
                        )}
                        {p.runs.map((run, rIdx) => {
                          const scaledSize = run.fontSizePt
                            ? Math.max(9, Math.min(36, Math.round(run.fontSizePt * 0.72)))
                            : 13;
                          return (
                            <span
                              key={rIdx}
                              style={{
                                fontWeight: run.bold ? 700 : 400,
                                fontStyle: run.italic ? "italic" : "normal",
                                color: run.color || undefined,
                                fontSize: `${scaledSize}px`,
                                whiteSpace: "pre-wrap",
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
        )}

        {showNotes && activeSlide?.notes && (
          <div
            style={{
              width: "100%",
              maxWidth: "860px",
              background: "#fefce8",
              border: "1px solid #fde047",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#713f12",
              lineHeight: 1.5,
            }}
          >
            <strong>Speaker Notes:</strong> {activeSlide.notes}
          </div>
        )}
      </div>
    </div>
  );
}
