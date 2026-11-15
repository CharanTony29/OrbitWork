"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, ChevronDown, CheckCheck, Briefcase, Scissors, ListOrdered, FileText, AlertCircle } from "lucide-react";
import type { PolishMode } from "@/lib/ai/utilities/polish";

interface AIPolishButtonProps {
  getText: () => string;
  onPolished: (newText: string, mode: PolishMode) => void;
  contextTitle?: string;
  target?: "task" | "document" | "comment" | "general";
  className?: string;
  buttonLabel?: string;
  compact?: boolean;
  disabled?: boolean;
}

const MODES: { id: PolishMode; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: "grammar",
    label: "Fix Grammar & Spelling",
    desc: "Correct typos and grammar while keeping original tone",
    icon: <CheckCheck size={14} className="ai-menu-icon" />,
  },
  {
    id: "professional",
    label: "Professional Tone",
    desc: "Clear, constructive tone for team collaboration",
    icon: <Briefcase size={14} className="ai-menu-icon" />,
  },
  {
    id: "concise",
    label: "Make Concise",
    desc: "Remove filler and summarize key points",
    icon: <Scissors size={14} className="ai-menu-icon" />,
  },
  {
    id: "bullet_points",
    label: "Format as Bullet Points",
    desc: "Convert text into organized action items",
    icon: <ListOrdered size={14} className="ai-menu-icon" />,
  },
  {
    id: "expand",
    label: "Expand & Structure",
    desc: "Add structure, sections, and acceptance criteria",
    icon: <FileText size={14} className="ai-menu-icon" />,
  },
];

export default function AIPolishButton({
  getText,
  onPolished,
  contextTitle,
  target = "task",
  className = "",
  buttonLabel = "Polish with AI",
  compact = false,
  disabled = false,
}: AIPolishButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<PolishMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setErrorMessage(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const handleApplyPolish = async (mode: PolishMode) => {
    const rawText = getText();
    if (!rawText || !rawText.trim()) {
      setErrorMessage("Please enter some text first to polish.");
      return;
    }

    setIsLoading(true);
    setActiveMode(mode);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/ai/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          text: rawText,
          mode,
          contextTitle,
          target,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to polish text");
      }

      if (data.polishedText) {
        onPolished(data.polishedText, mode);
        setIsOpen(false);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === "TimeoutError"
          ? "Request timed out. Please try again."
          : err instanceof Error
            ? err.message
            : "An error occurred while polishing.";
      setErrorMessage(msg);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
      setActiveMode(null);
    }
  };

  return (
    <div className={`ai-polish-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`task-desc-tool ai-polish-trigger ${isLoading ? "is-loading" : ""} ${isOpen ? "is-open" : ""}`}
        title="Polish text with AI"
        disabled={disabled || isLoading}
        onClick={() => {
          setErrorMessage(null);
          setIsOpen((prev) => !prev);
        }}
      >
        {isLoading ? (
          <Loader2 size={13} className="spin text-emerald-600" />
        ) : (
          <Sparkles size={13} className="ai-sparkle-icon" />
        )}
        {!compact && (
          <span className="ai-polish-label">
            {isLoading ? "Polishing…" : buttonLabel}
          </span>
        )}
        <ChevronDown size={11} className={`ai-chevron ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="ai-polish-popover" role="dialog" aria-label="AI Polish Options">
          <div className="ai-polish-header">
            <div className="ai-polish-header-title">
              <Sparkles size={13} className="ai-sparkle-icon" />
              <span>AI Writing Assistant</span>
            </div>
            <span className="ai-polish-badge">Gemini 3.5</span>
          </div>

          {errorMessage && (
            <div className="ai-polish-error" role="alert">
              <AlertCircle size={14} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="ai-polish-menu">
            {MODES.map((mode) => {
              const isSelected = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  className={`ai-polish-option ${isSelected ? "is-active" : ""}`}
                  disabled={isLoading}
                  onClick={() => handleApplyPolish(mode.id)}
                >
                  <div className="ai-option-icon-wrap">
                    {isSelected ? <Loader2 size={14} className="spin" /> : mode.icon}
                  </div>
                  <div className="ai-option-content">
                    <div className="ai-option-title">{mode.label}</div>
                    <div className="ai-option-desc">{mode.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="ai-polish-footer">
            Select text to polish just that selection, or polish the entire content.
          </div>
        </div>
      )}
    </div>
  );
}
