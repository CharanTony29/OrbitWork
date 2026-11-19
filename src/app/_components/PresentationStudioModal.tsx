"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Presentation,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Layers,
  BarChart3,
  Calendar,
} from "lucide-react";
import { showAppToast } from "@/lib/app-feedback";
import { PRESENTATION_TEMPLATES } from "@/lib/presentation/templates";
import type {
  GeneratedPresentationDeck,
  GeneratedSlide,
} from "@/app/api/ai/presentation/generate/route";

export default function PresentationStudioModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("pitch_sage");
  const [slideCount, setSlideCount] = useState(6);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [deck, setDeck] = useState<GeneratedPresentationDeck | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  const generateDeckFor = useCallback(
    async (
      targetTopic: string,
      targetProjectId?: string,
      targetTemplateId?: string,
      targetSlideCount?: number
    ) => {
      const pId = targetProjectId !== undefined ? targetProjectId : selectedProjectId;
      const top = targetTopic !== undefined ? targetTopic : topic;
      const tmpl = targetTemplateId || selectedTemplateId;
      const cnt = targetSlideCount || slideCount;

      if (!top.trim() && !pId) {
        showAppToast("Please enter a topic or select a project.", "warning", {
          title: "Input required",
        });
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/ai/presentation/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: top.trim(),
            projectId: pId || undefined,
            templateId: tmpl,
            slideCount: cnt,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate presentation");

        setDeck(data.deck);
        setCurrentSlideIndex(0);
        showAppToast(`Generated ${data.deck.slides.length} slides successfully!`, "success", {
          title: "Presentation Ready",
        });
      } catch (err: any) {
        showAppToast(err.message || "Error generating presentation", "error", {
          title: "Generation Failed",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProjectId, topic, selectedTemplateId, slideCount]
  );

  // Listen for open event
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      setIsOpen(true);
      const projId = e.detail?.projectId || "";
      const t = e.detail?.topic || "";
      if (projId) {
        setSelectedProjectId(projId);
      }
      if (t) {
        setTopic(t);
      }
      if (projId || t) {
        generateDeckFor(t, projId);
      }
    };

    window.addEventListener("orbitwork:open-presentation-studio" as any, handleOpen);
    return () =>
      window.removeEventListener("orbitwork:open-presentation-studio" as any, handleOpen);
  }, [generateDeckFor]);

  // Fetch projects list
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : { projects: [] }))
      .then((data) => {
        const list = data.projects || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => {});
  }, [isOpen, selectedProjectId]);

  // Keyboard navigation for presentation mode
  useEffect(() => {
    if (!isOpen || !deck) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Space") {
        setCurrentSlideIndex((prev) => Math.min(deck.slides.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, deck, isFullscreen]);

  const handleGenerateDeck = () => {
    generateDeckFor(topic, selectedProjectId, selectedTemplateId, slideCount);
  };

  const handleDownloadPptx = async () => {
    const targetProjId = deck?.projectId || selectedProjectId;
    if (!targetProjId) {
      showAppToast("Please select a project to export the PowerPoint (.pptx) deck.", "warning", {
        title: "Select project",
      });
      return;
    }

    setIsExportingPptx(true);
    try {
      const exportUrl = `/api/projects/${targetProjId}/presentation.pptx?templateId=${selectedTemplateId}&period=all`;
      const link = document.createElement("a");
      link.href = exportUrl;
      const projectName = projects.find((p) => p.id === targetProjId)?.name || "Project";
      link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${selectedTemplateId}.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAppToast("PowerPoint deck (.pptx) downloaded successfully!", "success", {
        title: "Export Complete",
      });
    } catch (err: any) {
      showAppToast(err.message || "Failed to download PPTX", "error", {
        title: "Export Failed",
      });
    } finally {
      setTimeout(() => setIsExportingPptx(false), 1200);
    }
  };

  const handleSaveToDocs = async () => {
    const targetProjId = deck?.projectId || selectedProjectId;
    if (!deck || !targetProjId) {
      showAppToast("Please select a target project to save the deck.", "warning", {
        title: "Select project",
      });
      return;
    }

    setIsSavingDoc(true);
    try {
      const markdownContent = deck.slides
        .map(
          (s, idx) => `
## Slide ${idx + 1}: ${s.title}
*${s.category}*

${s.bullets?.length ? s.bullets.map((b) => `- ${b}`).join("\n") : ""}
${s.metrics?.length ? "\n### Key Metrics\n" + s.metrics.map((m) => `- **${m.label}**: ${m.value} (${m.change || "target"})`).join("\n") : ""}
${
  s.statusGraph
    ? `\n### Status Distribution (${s.statusGraph.completionRate}% Done, ${s.statusGraph.totalTasks} Total Scope)\n` +
      s.statusGraph.items.map((it) => `- **${it.label}**: ${it.count} tasks (${it.percent}%)`).join("\n")
    : ""
}
${
  s.teamWorkload
    ? `\n### Team Workload\n` +
      s.teamWorkload.map((w) => `- **${w.name}** (${w.role || "Member"}): ${w.completed}/${w.total} Done (${w.rate}) - [${w.status}]`).join("\n")
    : ""
}
${
  s.criticalTasks
    ? `\n### Critical Deliverables\n` +
      s.criticalTasks.map((t) => `- **[${t.key}]** ${t.title} -> Assigned to: ${t.assignee} | Priority: ${t.priority} | Due: ${t.dueDate || "N/A"} | Status: ${t.status}`).join("\n")
    : ""
}
${s.cards?.length ? "\n### Strategic Pillars\n" + s.cards.map((c) => `- **${c.title}**: ${c.description}`).join("\n") : ""}

> ${s.takeaway || ""}
`
        )
        .join("\n---\n");

      const res = await fetch(`/api/projects/${targetProjId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Presentation: ${deck.title}`,
          description: deck.subtitle || "AI Generated Slide Deck",
          body_markdown: markdownContent,
          icon: "📊",
        }),
      });

      if (!res.ok) throw new Error("Failed to save presentation document");

      showAppToast("Presentation saved to Project Documents!", "success", {
        title: "Saved to Docs",
      });
    } catch (err: any) {
      showAppToast(err.message || "Failed to save presentation", "error", {
        title: "Save failed",
      });
    } finally {
      setIsSavingDoc(false);
    }
  };

  if (!isOpen) return null;

  const currentTemplate =
    PRESENTATION_TEMPLATES.find((t) => t.id === selectedTemplateId) || PRESENTATION_TEMPLATES[0];

  const currentSlide: GeneratedSlide | undefined = deck?.slides[currentSlideIndex];

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isFullscreen ? 0 : "24px",
      }}
    >
      <div
        style={{
          width: isFullscreen ? "100vw" : "1180px",
          height: isFullscreen ? "100vh" : "820px",
          maxWidth: "100vw",
          maxHeight: "100vh",
          background: "var(--surface, #ffffff)",
          borderRadius: isFullscreen ? 0 : "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            background: "var(--app-bg, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "6px",
                background: "#f3e8ff",
                color: "#7e22ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Presentation size={17} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--ink, #1e293b)",
                }}
              >
                AI Presentation Studio
              </h2>
              <small style={{ color: "var(--muted, #64748b)", fontSize: "11px" }}>
                Generate presentation slides with live graphs, assignee workloads & PPTX export
              </small>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Download PPTX button */}
            <button
              type="button"
              onClick={handleDownloadPptx}
              disabled={isExportingPptx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "6px",
                background: "#059669",
                color: "#ffffff",
                border: 0,
                fontSize: "11px",
                fontWeight: 600,
                cursor: isExportingPptx ? "not-allowed" : "pointer",
                transition: "background 0.15s ease",
              }}
              title="Download presentation as full 16:9 widescreen PowerPoint deck (.pptx) with vector charts"
            >
              {isExportingPptx ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
              <span>{isExportingPptx ? "Exporting…" : "Download PPTX"}</span>
            </button>

            {deck && (
              <>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--line, #e2e8f0)",
                    background: "var(--surface, #ffffff)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Toggle Fullscreen Present Mode (Arrow keys navigate)"
                >
                  <Maximize2 size={13} /> {isFullscreen ? "Exit Fullscreen" : "Present"}
                </button>

                {(deck.projectId || selectedProjectId) && (
                  <button
                    type="button"
                    onClick={handleSaveToDocs}
                    disabled={isSavingDoc}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--line, #e2e8f0)",
                      background: "var(--surface, #ffffff)",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: isSavingDoc ? "not-allowed" : "pointer",
                    }}
                  >
                    <FileText size={13} /> {isSavingDoc ? "Saving…" : "Save to Docs"}
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: 0,
                background: "transparent",
                color: "var(--muted, #64748b)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "6px",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Studio Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Configuration / Thumbnails Panel */}
          <div
            style={{
              width: "320px",
              borderRight: "1px solid var(--line, #e2e8f0)",
              display: "flex",
              flexDirection: "column",
              background: "var(--app-bg, #f8fafc)",
              overflowY: "auto",
              padding: "16px",
              gap: "14px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--ink, #1e293b)",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Project Grounding & Live Data
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  if (e.target.value) {
                    generateDeckFor(topic, e.target.value);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line, #e2e8f0)",
                  fontSize: "12px",
                  background: "var(--surface, #ffffff)",
                  fontWeight: 500,
                }}
              >
                <option value="">No Project (Synthesized Deck)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--ink, #1e293b)",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Topic / Presentation Goal
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Executive Status Review, Milestone Velocity, Resource Capacity..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line, #e2e8f0)",
                  fontSize: "12px",
                  resize: "none",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "8px" }}>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--ink, #1e293b)",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Template Style (32+)
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px",
                    borderRadius: "6px",
                    border: "1px solid var(--line, #e2e8f0)",
                    fontSize: "11px",
                    background: "var(--surface, #ffffff)",
                  }}
                >
                  {PRESENTATION_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--ink, #1e293b)",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Slides
                </label>
                <select
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "7px",
                    borderRadius: "6px",
                    border: "1px solid var(--line, #e2e8f0)",
                    fontSize: "11px",
                    background: "var(--surface, #ffffff)",
                  }}
                >
                  <option value={4}>4 Slides</option>
                  <option value={6}>6 Slides (Standard)</option>
                  <option value={8}>8 Slides (Detailed)</option>
                  <option value={10}>10 Slides (Full)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateDeck}
              disabled={isLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "10px",
                borderRadius: "6px",
                background: "var(--brand, #3b82f6)",
                color: "#ffffff",
                border: 0,
                fontSize: "12px",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                marginTop: "4px",
              }}
            >
              {isLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {isLoading ? "Designing Slides…" : "Generate Presentation"}
            </button>

            {/* Slide Navigation Thumbnails */}
            {deck && (
              <div
                style={{
                  marginTop: "12px",
                  borderTop: "1px solid var(--line, #e2e8f0)",
                  paddingTop: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--muted, #64748b)",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  SLIDES ({deck.slides.length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {deck.slides.map((s, idx) => {
                    const isCurrent = idx === currentSlideIndex;
                    return (
                      <div
                        key={s.id || idx}
                        onClick={() => setCurrentSlideIndex(idx)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: isCurrent
                            ? "2px solid var(--brand, #3b82f6)"
                            : "1px solid var(--line, #e2e8f0)",
                          background: isCurrent ? "var(--surface, #ffffff)" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "var(--muted, #64748b)",
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--ink, #1e293b)",
                              maxWidth: "170px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.title}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "9px",
                            color: "var(--muted, #64748b)",
                            background: "var(--line, #e2e8f0)",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          }}
                        >
                          {s.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Slide Canvas */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "#0f172a",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              position: "relative",
              overflow: "auto",
            }}
          >
            {!deck ? (
              <div style={{ textAlign: "center", color: "#94a3b8", maxWidth: "440px" }}>
                <Presentation size={48} style={{ opacity: 0.3, margin: "0 auto 16px" }} />
                <h3 style={{ margin: "0 0 6px", color: "#f8fafc", fontSize: "16px" }}>
                  Design Presentations with Live Data
                </h3>
                <p style={{ fontSize: "13px", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Select your project or enter a topic to automatically generate an executive slide
                  deck with real status graphs, assignee workload bars, and deliverables tables.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateDeck}
                  disabled={isLoading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background: "var(--brand, #3b82f6)",
                    color: "#ffffff",
                    border: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Sparkles size={14} /> Generate Slides Now
                </button>
              </div>
            ) : currentSlide ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: "920px",
                  aspectRatio: "16 / 9",
                  background: `#${currentTemplate.bg}`,
                  color: `#${currentTemplate.textPrimary}`,
                  borderRadius: "12px",
                  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "36px",
                  position: "relative",
                  fontFamily: currentTemplate.fontTitle,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                {/* Slide Top Category Badge & Info */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      padding: "4px 10px",
                      borderRadius: "16px",
                      background: `#${currentTemplate.cardBg}`,
                      color: `#${currentTemplate.accent}`,
                      border: `1px solid #${currentTemplate.cardBorder}`,
                    }}
                  >
                    {currentSlide.category}
                  </span>
                  <span style={{ fontSize: "11px", opacity: 0.7 }}>
                    Slide {currentSlideIndex + 1} of {deck.slides.length}
                  </span>
                </div>

                {/* Slide Title & Core Dynamic Content */}
                <div style={{ margin: "16px 0", flex: 1, display: "flex", flexDirection: "column" }}>
                  <h1
                    style={{
                      fontSize: currentSlide.layout === "title" ? "32px" : "24px",
                      fontWeight: 800,
                      margin: "0 0 8px",
                      color: `#${currentTemplate.textPrimary}`,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    {currentSlide.title}
                  </h1>

                  {/* 1. STATUS GRAPH LAYOUT */}
                  {currentSlide.layout === "status_graph" && currentSlide.statusGraph && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
                      {/* Completion rate bar & stats */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: `#${currentTemplate.cardBg}`,
                          border: `1px solid #${currentTemplate.cardBorder}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "50%",
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#10b981",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "13px",
                              fontWeight: 800,
                            }}
                          >
                            {currentSlide.statusGraph.completionRate}%
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                color: `#${currentTemplate.textPrimary}`,
                              }}
                            >
                              Overall Delivery Completion
                            </div>
                            <div style={{ fontSize: "11px", opacity: 0.75 }}>
                              {currentSlide.statusGraph.totalTasks} Total Deliverables In Scope
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                          <span style={{ color: "#10b981", fontWeight: 700 }}>● Active Velocity</span>
                          <span style={{ opacity: 0.7 }}>● Realtime Grounding</span>
                        </div>
                      </div>

                      {/* Multi-color segmented horizontal status bar */}
                      <div
                        style={{
                          height: "12px",
                          width: "100%",
                          borderRadius: "6px",
                          overflow: "hidden",
                          display: "flex",
                          background: "rgba(0,0,0,0.15)",
                        }}
                      >
                        {currentSlide.statusGraph.items.map((item, idx) => {
                          if (item.percent <= 0 && item.count <= 0) return null;
                          const widthPercent = Math.max(item.percent, 3);
                          return (
                            <div
                              key={idx}
                              style={{
                                width: `${widthPercent}%`,
                                background: item.color || "#3b82f6",
                                height: "100%",
                                transition: "width 0.3s ease",
                              }}
                              title={`${item.label}: ${item.count} tasks (${item.percent}%)`}
                            />
                          );
                        })}
                      </div>

                      {/* Status metrics cards grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${Math.min(
                            currentSlide.statusGraph.items.length,
                            4
                          )}, 1fr)`,
                          gap: "8px",
                        }}
                      >
                        {currentSlide.statusGraph.items.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "10px",
                              borderRadius: "8px",
                              background: `#${currentTemplate.cardBg}`,
                              border: `1px solid #${currentTemplate.cardBorder}`,
                              borderTop: `3px solid ${item.color || "#3b82f6"}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  background: item.color || "#3b82f6",
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  opacity: 0.85,
                                  textOverflow: "ellipsis",
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.label}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "18px",
                                fontWeight: 800,
                                color: `#${currentTemplate.textPrimary}`,
                              }}
                            >
                              {item.count}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: item.color || `#${currentTemplate.accent}`,
                                fontWeight: 700,
                              }}
                            >
                              {item.percent}% of scope
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. TEAM WORKLOAD LAYOUT */}
                  {currentSlide.layout === "team_workload" && currentSlide.teamWorkload && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          currentSlide.teamWorkload.length <= 3
                            ? "repeat(3, 1fr)"
                            : "repeat(2, 1fr)",
                        gap: "10px",
                        marginTop: "12px",
                      }}
                    >
                      {currentSlide.teamWorkload.slice(0, 6).map((member, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "12px",
                            borderRadius: "8px",
                            background: `#${currentTemplate.cardBg}`,
                            border: `1px solid #${currentTemplate.cardBorder}`,
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  width: "26px",
                                  height: "26px",
                                  borderRadius: "50%",
                                  background: `#${currentTemplate.accent}`,
                                  color: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                }}
                              >
                                {member.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong
                                  style={{
                                    fontSize: "12px",
                                    display: "block",
                                    color: `#${currentTemplate.textPrimary}`,
                                  }}
                                >
                                  {member.name}
                                </strong>
                                <span style={{ fontSize: "10px", opacity: 0.7 }}>
                                  {member.role || "Team Member"}
                                </span>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background:
                                  member.status === "ACTION NEEDED"
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : "rgba(16, 185, 129, 0.15)",
                                color:
                                  member.status === "ACTION NEEDED" ? "#ef4444" : "#10b981",
                              }}
                            >
                              {member.status}
                            </span>
                          </div>

                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "10px",
                                marginBottom: "4px",
                              }}
                            >
                              <span style={{ opacity: 0.8 }}>Delivery Rate</span>
                              <strong style={{ color: `#${currentTemplate.accent}` }}>
                                {member.rate}
                              </strong>
                            </div>
                            <div
                              style={{
                                height: "6px",
                                width: "100%",
                                borderRadius: "3px",
                                background: "rgba(0,0,0,0.1)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: member.rate,
                                  background: `#${currentTemplate.accent}`,
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "10px",
                              opacity: 0.75,
                              paddingTop: "4px",
                              borderTop: `1px solid #${currentTemplate.cardBorder}`,
                            }}
                          >
                            <span>
                              Assigned: <strong>{member.total}</strong>
                            </span>
                            <span>
                              Done:{" "}
                              <strong style={{ color: "#10b981" }}>{member.completed}</strong>
                            </span>
                            <span>
                              In Flight:{" "}
                              <strong style={{ color: "#3b82f6" }}>{member.inProgress}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. CRITICAL TASKS LAYOUT */}
                  {currentSlide.layout === "critical_tasks" && currentSlide.criticalTasks && (
                    <div
                      style={{
                        marginTop: "10px",
                        overflow: "hidden",
                        borderRadius: "8px",
                        border: `1px solid #${currentTemplate.cardBorder}`,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "11px",
                          textAlign: "left",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: `#${currentTemplate.cardBg}`,
                              borderBottom: `1px solid #${currentTemplate.cardBorder}`,
                            }}
                          >
                            <th style={{ padding: "8px 10px", fontWeight: 700, opacity: 0.8 }}>
                              KEY
                            </th>
                            <th style={{ padding: "8px 10px", fontWeight: 700, opacity: 0.8 }}>
                              DELIVERABLE
                            </th>
                            <th style={{ padding: "8px 10px", fontWeight: 700, opacity: 0.8 }}>
                              ASSIGNEE
                            </th>
                            <th style={{ padding: "8px 10px", fontWeight: 700, opacity: 0.8 }}>
                              PRIORITY
                            </th>
                            <th style={{ padding: "8px 10px", fontWeight: 700, opacity: 0.8 }}>
                              DUE DATE
                            </th>
                            <th style={{ padding: "8px 10px", fontWeight: 700, opacity: 0.8 }}>
                              STATUS
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentSlide.criticalTasks.slice(0, 5).map((task, idx) => (
                            <tr
                              key={idx}
                              style={{
                                background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)",
                                borderBottom: `1px solid #${currentTemplate.cardBorder}`,
                              }}
                            >
                              <td
                                style={{
                                  padding: "7px 10px",
                                  fontFamily: "monospace",
                                  fontWeight: 700,
                                  color: `#${currentTemplate.accent}`,
                                }}
                              >
                                {task.key}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  fontWeight: 600,
                                  color: `#${currentTemplate.textPrimary}`,
                                  maxWidth: "240px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {task.title}
                              </td>
                              <td style={{ padding: "7px 10px", opacity: 0.9 }}>
                                {task.assignee}
                              </td>
                              <td style={{ padding: "7px 10px" }}>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 800,
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background:
                                      task.priority === "URGENT"
                                        ? "rgba(239, 68, 68, 0.2)"
                                        : task.priority === "HIGH"
                                        ? "rgba(245, 158, 11, 0.2)"
                                        : "rgba(59, 130, 246, 0.2)",
                                    color:
                                      task.priority === "URGENT"
                                        ? "#ef4444"
                                        : task.priority === "HIGH"
                                        ? "#f59e0b"
                                        : "#3b82f6",
                                  }}
                                >
                                  {task.priority}
                                </span>
                              </td>
                              <td style={{ padding: "7px 10px", opacity: 0.8 }}>
                                {task.dueDate || "Ongoing"}
                              </td>
                              <td style={{ padding: "7px 10px" }}>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background:
                                      task.status === "OVERDUE"
                                        ? "#ef4444"
                                        : `#${currentTemplate.cardBg}`,
                                    color:
                                      task.status === "OVERDUE"
                                        ? "#ffffff"
                                        : `#${currentTemplate.textPrimary}`,
                                    border: `1px solid #${currentTemplate.cardBorder}`,
                                  }}
                                >
                                  {task.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 4. KPI SCORECARD METRICS */}
                  {currentSlide.layout === "kpi" &&
                    currentSlide.metrics &&
                    currentSlide.metrics.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: "10px",
                          marginTop: "16px",
                        }}
                      >
                        {currentSlide.metrics.map((m, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "16px 12px",
                              borderRadius: "8px",
                              background: `#${currentTemplate.cardBg}`,
                              border: `1px solid #${currentTemplate.cardBorder}`,
                            }}
                          >
                            <div
                              style={{
                                fontSize: "26px",
                                fontWeight: 800,
                                color: `#${currentTemplate.accent}`,
                              }}
                            >
                              {m.value}
                            </div>
                            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
                              {m.label}
                            </div>
                            {m.change && (
                              <small
                                style={{
                                  fontSize: "10px",
                                  color: "#10b981",
                                  fontWeight: 700,
                                  display: "block",
                                  marginTop: "4px",
                                }}
                              >
                                {m.change}
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  {/* 5. STRATEGIC CARDS / PILLARS */}
                  {currentSlide.cards && currentSlide.cards.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "10px",
                        marginTop: "14px",
                      }}
                    >
                      {currentSlide.cards.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "14px",
                            borderRadius: "8px",
                            background: `#${currentTemplate.cardBg}`,
                            border: `1px solid #${currentTemplate.cardBorder}`,
                          }}
                        >
                          {c.tag && (
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: `#${currentTemplate.accent}`,
                                color: "#ffffff",
                                marginBottom: "6px",
                                display: "inline-block",
                              }}
                            >
                              {c.tag}
                            </span>
                          )}
                          <strong
                            style={{
                              fontSize: "13px",
                              color: `#${currentTemplate.accent}`,
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            {c.title}
                          </strong>
                          <p style={{ margin: 0, fontSize: "11px", opacity: 0.85, lineHeight: 1.4 }}>
                            {c.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bullet points for title or narrative slides */}
                  {currentSlide.bullets &&
                    currentSlide.bullets.length > 0 &&
                    currentSlide.layout !== "status_graph" &&
                    currentSlide.layout !== "critical_tasks" && (
                      <ul
                        style={{
                          margin: "12px 0 0",
                          paddingLeft: "20px",
                          fontSize: "13px",
                          lineHeight: 1.6,
                          opacity: 0.9,
                        }}
                      >
                        {currentSlide.bullets.map((b, i) => (
                          <li key={i} style={{ marginBottom: "6px" }}>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>

                {/* Footer Takeaway */}
                <div
                  style={{
                    borderTop: `1px solid #${currentTemplate.cardBorder}`,
                    paddingTop: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    opacity: 0.85,
                  }}
                >
                  <span>{currentSlide.takeaway ? `💡 ${currentSlide.takeaway}` : deck.title}</span>
                  <small style={{ opacity: 0.6 }}>Orbitwork Executive Slide Studio</small>
                </div>
              </div>
            ) : null}

            {/* Bottom Slider Nav */}
            {deck && (
              <div
                style={{
                  position: "absolute",
                  bottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background: "rgba(15, 23, 42, 0.8)",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <button
                  type="button"
                  disabled={currentSlideIndex === 0}
                  onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: currentSlideIndex === 0 ? "#475569" : "#f8fafc",
                    cursor: currentSlideIndex === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <ChevronLeft size={18} />
                </button>

                <span style={{ fontSize: "12px", color: "#f8fafc", fontWeight: 600 }}>
                  {currentSlideIndex + 1} / {deck.slides.length}
                </span>

                <button
                  type="button"
                  disabled={currentSlideIndex === deck.slides.length - 1}
                  onClick={() =>
                    setCurrentSlideIndex((prev) => Math.min(deck.slides.length - 1, prev + 1))
                  }
                  style={{
                    background: "transparent",
                    border: 0,
                    color: currentSlideIndex === deck.slides.length - 1 ? "#475569" : "#f8fafc",
                    cursor: currentSlideIndex === deck.slides.length - 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
