"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Presentation,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Copy,
  Download,
  FileText,
  Loader2,
  Layers,
  BarChart3,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { showAppToast } from "@/lib/app-feedback";
import { PRESENTATION_TEMPLATES } from "@/lib/presentation/templates";
import type { GeneratedPresentationDeck, GeneratedSlide } from "@/app/api/ai/presentation/generate/route";

export default function PresentationStudioModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("pitch_sage");
  const [slideCount, setSlideCount] = useState(6);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [deck, setDeck] = useState<GeneratedPresentationDeck | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Listen for open event
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      setIsOpen(true);
      if (e.detail?.projectId) {
        setSelectedProjectId(e.detail.projectId);
      }
      if (e.detail?.topic) {
        setTopic(e.detail.topic);
      }
    };

    window.addEventListener("orbitwork:open-presentation-studio" as any, handleOpen);
    return () =>
      window.removeEventListener("orbitwork:open-presentation-studio" as any, handleOpen);
  }, []);

  // Fetch projects list
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : { projects: [] }))
      .then((data) => setProjects(data.projects || []))
      .catch(() => {});
  }, [isOpen]);

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

  const handleGenerateDeck = async () => {
    if (!topic.trim() && !selectedProjectId) {
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
          topic: topic.trim(),
          projectId: selectedProjectId || undefined,
          templateId: selectedTemplateId,
          slideCount,
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
  };

  const handleSaveToDocs = async () => {
    if (!deck || !selectedProjectId) {
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
${s.cards?.length ? "\n### Pillars\n" + s.cards.map((c) => `- **${c.title}**: ${c.description}`).join("\n") : ""}

> ${s.takeaway || ""}
`
        )
        .join("\n---\n");

      const res = await fetch(`/api/projects/${selectedProjectId}/documents`, {
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
          width: isFullscreen ? "100vw" : "1100px",
          height: isFullscreen ? "100vh" : "780px",
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
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "#f3e8ff",
                color: "#7e22ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Presentation size={16} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--ink, #1e293b)" }}>
                AI Presentation Studio
              </h2>
              <small style={{ color: "var(--muted, #64748b)", fontSize: "11px" }}>
                Generate executive slide decks, pitch proposals & roadmaps in seconds
              </small>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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

                {selectedProjectId && (
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
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink, #1e293b)", display: "block", marginBottom: "4px" }}>
                Topic / Presentation Goal
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Q4 Executive Product Strategy & Roadmap, Client Pitch for AI Automation..."
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

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink, #1e293b)", display: "block", marginBottom: "4px" }}>
                Project Grounding (Optional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line, #e2e8f0)",
                  fontSize: "12px",
                  background: "var(--surface, #ffffff)",
                }}
              >
                <option value="">No Project (General Deck)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink, #1e293b)", display: "block", marginBottom: "4px" }}>
                  Template Style
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
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink, #1e293b)", display: "block", marginBottom: "4px" }}>
                  Slide Count
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
                  <option value={4}>4 Slides (Brief)</option>
                  <option value={6}>6 Slides (Standard)</option>
                  <option value={8}>8 Slides (Detailed)</option>
                  <option value={10}>10 Slides (Executive)</option>
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
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--line, #e2e8f0)", paddingTop: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #64748b)", display: "block", marginBottom: "8px" }}>
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
                          border: isCurrent ? "2px solid var(--brand, #3b82f6)" : "1px solid var(--line, #e2e8f0)",
                          background: isCurrent ? "var(--surface, #ffffff)" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #64748b)" }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink, #1e293b)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.title}
                          </span>
                        </div>
                        <span style={{ fontSize: "9px", color: "var(--muted, #64748b)", background: "var(--line, #e2e8f0)", padding: "1px 5px", borderRadius: "4px" }}>
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
            }}
          >
            {!deck ? (
              <div style={{ textAlign: "center", color: "#94a3b8", maxWidth: "420px" }}>
                <Presentation size={48} style={{ opacity: 0.3, margin: "0 auto 16px" }} />
                <h3 style={{ margin: "0 0 6px", color: "#f8fafc", fontSize: "16px" }}>
                  Design Presentations with AI
                </h3>
                <p style={{ fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
                  Enter a topic or select a project to automatically generate a complete slide deck with metrics, structured pillars, and executive summaries.
                </p>
              </div>
            ) : currentSlide ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: "880px",
                  aspectRatio: "16 / 9",
                  background: `#${currentTemplate.bg}`,
                  color: `#${currentTemplate.textPrimary}`,
                  borderRadius: "12px",
                  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "40px",
                  position: "relative",
                  fontFamily: currentTemplate.fontTitle,
                }}
              >
                {/* Slide Top Category Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "11px",
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

                {/* Slide Title & Core Content */}
                <div style={{ margin: "20px 0" }}>
                  <h1
                    style={{
                      fontSize: currentSlide.layout === "title" ? "36px" : "28px",
                      fontWeight: 800,
                      margin: "0 0 10px",
                      color: `#${currentTemplate.textPrimary}`,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    {currentSlide.title}
                  </h1>

                  {/* Bullet points */}
                  {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                    <ul style={{ margin: "14px 0 0", paddingLeft: "20px", fontSize: "14px", lineHeight: 1.6, opacity: 0.9 }}>
                      {currentSlide.bullets.map((b, i) => (
                        <li key={i} style={{ marginBottom: "6px" }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Metrics Cards */}
                  {currentSlide.metrics && currentSlide.metrics.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginTop: "20px" }}>
                      {currentSlide.metrics.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "16px",
                            borderRadius: "8px",
                            background: `#${currentTemplate.cardBg}`,
                            border: `1px solid #${currentTemplate.cardBorder}`,
                          }}
                        >
                          <div style={{ fontSize: "28px", fontWeight: 800, color: `#${currentTemplate.accent}` }}>
                            {m.value}
                          </div>
                          <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "2px" }}>{m.label}</div>
                          {m.change && (
                            <small style={{ fontSize: "10px", color: "#10b981", fontWeight: 700 }}>
                              {m.change}
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Strategic Cards */}
                  {currentSlide.cards && currentSlide.cards.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginTop: "16px" }}>
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
                          <strong style={{ fontSize: "13px", color: `#${currentTemplate.accent}`, display: "block", marginBottom: "4px" }}>
                            {c.title}
                          </strong>
                          <p style={{ margin: 0, fontSize: "12px", opacity: 0.85, lineHeight: 1.4 }}>
                            {c.description}
                          </p>
                        </div>
                      ))}
                    </div>
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
                    fontSize: "12px",
                    opacity: 0.85,
                  }}
                >
                  <span>{currentSlide.takeaway ? `💡 ${currentSlide.takeaway}` : deck.title}</span>
                  <small style={{ opacity: 0.6 }}>Orbitwork Presentation Studio</small>
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
                  onClick={() => setCurrentSlideIndex((prev) => Math.min(deck.slides.length - 1, prev + 1))}
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
