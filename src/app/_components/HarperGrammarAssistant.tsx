"use client";

import { useState } from "react";
import { Sparkles, Check, AlertCircle, Loader2, X, ChevronRight } from "lucide-react";

export interface HarperGrammarIssue {
  id: string;
  message: string;
  start: number;
  end: number;
  matchedText: string;
  suggestions: string[];
}

interface HarperGrammarAssistantProps {
  text?: string;
  getText?: () => string;
  onApplyFix: (fixedText: string) => void;
  className?: string;
  label?: string;
}

export default function HarperGrammarAssistant({
  text = "",
  getText,
  onApplyFix,
  className = "",
  label = "Check Grammar & Spelling",
}: HarperGrammarAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<HarperGrammarIssue[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getSourceText = () => (getText ? getText() : text);

  const runProofreading = async () => {
    const current = getSourceText();
    if (!current.trim() || current.trim().length < 4) {
      setIssues([]);
      setIsOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/grammar/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: current }),
      });

      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues ?? []);
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Proofreading error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = (issue: HarperGrammarIssue, suggestion: string) => {
    const current = getSourceText();
    const before = current.slice(0, issue.start);
    const after = current.slice(issue.end);
    const newText = before + suggestion + after;
    onApplyFix(newText);

    // Remove this issue from current list and adjust offsets of subsequent issues
    if (issues) {
      const diff = suggestion.length - (issue.end - issue.start);
      const remaining = issues
        .filter((i) => i.id !== issue.id)
        .map((i) => {
          if (i.start > issue.start) {
            return {
              ...i,
              start: i.start + diff,
              end: i.end + diff,
            };
          }
          return i;
        });
      setIssues(remaining);
    }
  };

  const hasText = Boolean(getSourceText().trim());

  return (
    <div style={{ position: "relative", display: "inline-block" }} className={className}>
      <button
        type="button"
        onClick={runProofreading}
        disabled={loading || !hasText}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "4px 10px",
          borderRadius: "6px",
          border: "1px solid var(--line, #e2e8f0)",
          background: "var(--surface, #ffffff)",
          color: "var(--ink, #1e293b)",
          fontSize: "11px",
          fontWeight: 600,
          cursor: loading || !hasText ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
        title="Check grammar and spelling automatically"
      >
        {loading ? (
          <Loader2 size={12} className="spin" />
        ) : (
          <Sparkles size={12} style={{ color: "var(--green, #10b981)" }} />
        )}
        <span>{label}</span>
        {issues !== null && issues.length > 0 && (
          <span
            style={{
              padding: "1px 5px",
              borderRadius: "10px",
              background: "#fef3c7",
              color: "#b45309",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            {issues.length}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && issues !== null && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "6px",
            width: "320px",
            maxHeight: "360px",
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: "10px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
            zIndex: 1050,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "var(--app-bg, #f8fafc)",
              borderBottom: "1px solid var(--line, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={13} style={{ color: "var(--green, #10b981)" }} />
              <strong style={{ fontSize: "11px", color: "var(--ink, #1e293b)" }}>
                Writing Assistant
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: 0,
                background: "transparent",
                color: "var(--muted, #64748b)",
                cursor: "pointer",
                padding: "2px",
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Issues List */}
          <div style={{ overflowY: "auto", padding: "10px", display: "grid", gap: "8px" }}>
            {issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 8px", color: "var(--muted, #64748b)" }}>
                <Check size={20} style={{ color: "var(--green, #10b981)", margin: "0 auto 6px" }} />
                <p style={{ fontSize: "12px", fontWeight: 600, margin: 0, color: "var(--ink, #1e293b)" }}>
                  No issues found!
                </p>
                <small style={{ fontSize: "10px" }}>Your text looks clear, correct, and well-written.</small>
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "7px",
                    border: "1px solid #fed7aa",
                    background: "#fffaf0",
                    display: "grid",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertCircle size={12} style={{ color: "#ea580c", flex: "none" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#9a3412" }}>
                      {issue.message}
                    </span>
                  </div>

                  {issue.matchedText && (
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Original:{" "}
                      <span
                        style={{
                          textDecoration: "line-through",
                          color: "#dc2626",
                          background: "rgba(220, 38, 38, 0.08)",
                          padding: "1px 4px",
                          borderRadius: "3px",
                        }}
                      >
                        {issue.matchedText}
                      </span>
                    </div>
                  )}

                  {issue.suggestions.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                      {issue.suggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplySuggestion(issue, sug)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            border: "1px solid var(--green, #10b981)",
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "var(--green, #059669)",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <span>{sug}</span>
                          <ChevronRight size={10} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
