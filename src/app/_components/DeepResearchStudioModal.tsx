"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Globe,
  Search,
  Sparkles,
  X,
  ExternalLink,
  Copy,
  FileText,
  Loader2,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { showAppToast } from "@/lib/app-feedback";
import type { DeepResearchReport, ResearchSource } from "@/app/api/ai/deep-research/route";

export default function DeepResearchStudioModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<"quick" | "deep">("deep");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<DeepResearchReport | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Listen for open event
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      setIsOpen(true);
      if (e.detail?.query) {
        setQuery(e.detail.query);
      }
      if (e.detail?.projectId) {
        setSelectedProjectId(e.detail.projectId);
      }
    };

    window.addEventListener("orbitwork:open-deep-research" as any, handleOpen);
    return () =>
      window.removeEventListener("orbitwork:open-deep-research" as any, handleOpen);
  }, []);

  // Fetch projects list
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : { projects: [] }))
      .then((data) => setProjects(data.projects || []))
      .catch(() => {});
  }, [isOpen]);

  const handleRunResearch = async (overrideQuery?: string) => {
    const targetQuery = (overrideQuery || query).trim();
    if (!targetQuery) {
      showAppToast("Please enter a research topic.", "warning", {
        title: "Query required",
      });
      return;
    }

    if (overrideQuery) {
      setQuery(overrideQuery);
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: targetQuery,
          depth,
          projectId: selectedProjectId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research query failed");

      setReport(data.report);
      showAppToast("Research report and web citations synthesized!", "success", {
        title: "Research Complete",
      });
    } catch (err: any) {
      showAppToast(err.message || "Failed to conduct deep research", "error", {
        title: "Research Failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDocs = async () => {
    if (!report || !selectedProjectId) {
      showAppToast("Please select a target project to save this research report.", "warning", {
        title: "Select project",
      });
      return;
    }

    setIsSavingDoc(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Research: ${report.query.slice(0, 80)}`,
          description: report.summary.slice(0, 180),
          body_markdown: report.markdownReport,
          icon: "🔍",
        }),
      });

      if (!res.ok) throw new Error("Failed to save research report to documents");

      showAppToast("Research report saved to Project Documents!", "success", {
        title: "Saved to Docs",
      });
    } catch (err: any) {
      showAppToast(err.message || "Failed to save document", "error", {
        title: "Save failed",
      });
    } finally {
      setIsSavingDoc(false);
    }
  };

  if (!isOpen) return null;

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
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "950px",
          height: "760px",
          maxWidth: "96vw",
          maxHeight: "92vh",
          background: "var(--surface, #ffffff)",
          borderRadius: "12px",
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
                background: "#dbeafe",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Globe size={16} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--ink, #1e293b)" }}>
                Deep Research & Web Grounding
              </h2>
              <small style={{ color: "var(--muted, #64748b)", fontSize: "11px" }}>
                Multi-source intelligence, web-verified citations, and technical synthesis
              </small>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {report && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(report.markdownReport);
                    showAppToast("Report markdown copied to clipboard.", "success", {
                      title: "Copied!",
                    });
                  }}
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
                >
                  <Copy size={12} /> Copy Markdown
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
                    <FileText size={12} /> {isSavingDoc ? "Saving…" : "Save to Docs"}
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
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Query Bar */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            background: "var(--surface, #ffffff)",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted, #64748b)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) handleRunResearch();
              }}
              placeholder="Ask anything or research complex topics (e.g. Postgres RLS multi-tenancy best practices 2026, GDPR compliance for SaaS attachments)..."
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                borderRadius: "8px",
                border: "1px solid var(--line, #e2e8f0)",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--line, #e2e8f0)",
              fontSize: "12px",
              background: "var(--surface, #ffffff)",
              maxWidth: "180px",
            }}
          >
            <option value="">No Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => handleRunResearch()}
            disabled={isLoading || !query.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              borderRadius: "8px",
              background: "var(--brand, #2563eb)",
              color: "#ffffff",
              border: 0,
              fontSize: "12px",
              fontWeight: 600,
              cursor: isLoading || !query.trim() ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {isLoading ? "Synthesizing…" : "Research"}
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <Loader2 size={36} className="spin" style={{ color: "#2563eb", margin: "0 auto 16px" }} />
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--ink, #1e293b)" }}>
                Conducting Deep Research…
              </h3>
              <p style={{ fontSize: "12px", color: "var(--muted, #64748b)", margin: 0 }}>
                Querying multi-source web intelligence, extracting credible citations, and generating analytical report.
              </p>
            </div>
          ) : !report ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted, #64748b)" }}>
              <Globe size={48} style={{ opacity: 0.3, margin: "0 auto 16px" }} />
              <h3 style={{ margin: "0 0 6px", color: "var(--ink, #1e293b)", fontSize: "16px" }}>
                AI Research Engine
              </h3>
              <p style={{ fontSize: "13px", maxWidth: "460px", margin: "0 auto", lineHeight: 1.5 }}>
                Enter any engineering, market, architectural, or regulatory question to receive a structured report backed by verifiable sources and clear takeaways.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Web Sources Strip */}
              {report.sources && report.sources.length > 0 && (
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Verified Sources ({report.sources.length})
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                    {report.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--line, #e2e8f0)",
                          background: "var(--app-bg, #f8fafc)",
                          textDecoration: "none",
                          color: "inherit",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          transition: "border-color 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#2563eb", background: "#dbeafe", padding: "1px 6px", borderRadius: "4px" }}>
                            [{idx + 1}] {s.domain}
                          </span>
                          <ExternalLink size={11} style={{ color: "var(--muted, #64748b)" }} />
                        </div>
                        <strong style={{ fontSize: "12px", color: "var(--ink, #1e293b)", lineHeight: 1.3 }}>
                          {s.title}
                        </strong>
                        {s.snippet && (
                          <small style={{ fontSize: "11px", color: "var(--muted, #64748b)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            "{s.snippet}"
                          </small>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <ShieldCheck size={16} style={{ color: "#2563eb" }} />
                  <strong style={{ fontSize: "13px", color: "#1e3a8a" }}>
                    Executive Summary
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {report.summary}
                </p>
              </div>

              {/* Structured Deep Dive Sections */}
              {report.sections && report.sections.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {report.sections.map((sec, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "16px",
                        borderRadius: "8px",
                        border: "1px solid var(--line, #e2e8f0)",
                        background: "var(--surface, #ffffff)",
                      }}
                    >
                      <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--ink, #1e293b)", fontWeight: 700 }}>
                        {sec.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--ink, #1e293b)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {sec.content}
                      </p>
                      {sec.keyTakeaway && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            background: "var(--app-bg, #f8fafc)",
                            borderLeft: "3px solid #2563eb",
                            fontSize: "12px",
                            color: "var(--ink, #1e293b)",
                            fontWeight: 500,
                          }}
                        >
                          <strong>Takeaway:</strong> {sec.keyTakeaway}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations && report.recommendations.length > 0 && (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#14532d", display: "block", marginBottom: "8px" }}>
                    Actionable Recommendations
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#166534", lineHeight: 1.6 }}>
                    {report.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-up Questions */}
              {report.followUps && report.followUps.length > 0 && (
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                    Follow-Up Inquiries
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {report.followUps.map((fu, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleRunResearch(fu)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 12px",
                          borderRadius: "16px",
                          border: "1px solid var(--line, #e2e8f0)",
                          background: "var(--surface, #ffffff)",
                          fontSize: "12px",
                          color: "var(--ink, #1e293b)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>{fu}</span>
                        <ArrowRight size={12} style={{ color: "#2563eb" }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
