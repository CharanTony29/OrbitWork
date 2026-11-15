"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, RefreshCw, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { markdownToSafeHtml } from "@/lib/markdown";

export default function AIDashboardBriefing() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastGeneratedTime, setLastGeneratedTime] = useState<string | null>(null);

  const todayKey = `orbitwork_ai_briefing_${new Date().toISOString().split("T")[0]}`;

  useEffect(() => {
    // Check localStorage cache for today's briefing
    const cached = localStorage.getItem(todayKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setBriefing(parsed.briefing);
        setLastGeneratedTime(parsed.time);
      } catch {
        // ignore
      }
    }
  }, [todayKey]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/agent/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate briefing");

      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setBriefing(data.briefing);
      setLastGeneratedTime(timeStr);

      // Cache in localStorage for today
      localStorage.setItem(
        todayKey,
        JSON.stringify({
          briefing: data.briefing,
          time: timeStr,
        })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate briefing");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-briefing-card">
      <div className="ai-briefing-header">
        <div className="ai-briefing-title-group">
          <div className="ai-briefing-badge-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="ai-briefing-title">
              <span>AI Daily Standup & Briefing</span>
              <span className="ai-briefing-pill">Live Workspace Data</span>
            </div>
            <div className="ai-briefing-sub">
              {lastGeneratedTime
                ? `Generated today at ${lastGeneratedTime}`
                : "AI analysis of your active priorities, deadlines, and risks"}
            </div>
          </div>
        </div>

        <div className="ai-briefing-header-actions">
          {briefing && (
            <button
              type="button"
              className="ai-briefing-btn-refresh"
              onClick={handleGenerate}
              disabled={isLoading}
              title="Refresh Briefing"
            >
              <RefreshCw size={13} className={isLoading ? "spin" : ""} />
              <span>Refresh</span>
            </button>
          )}

          {briefing && (
            <button
              type="button"
              className="ai-briefing-toggle-btn"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? "Expand briefing" : "Collapse briefing"}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>
      </div>

      {!briefing && !isLoading && (
        <div className="ai-briefing-empty">
          <p>Get a 30-second synthesized breakdown of what you should focus on today based on your real tasks.</p>
          <button
            type="button"
            className="ai-briefing-generate-btn"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            <Sparkles size={14} />
            <span>Generate Today's Standup Briefing</span>
          </button>
        </div>
      )}

      {isLoading && (
        <div className="ai-briefing-loading">
          <Loader2 size={20} className="spin text-emerald-600" />
          <div>
            <strong>Analyzing your tasks & deadlines…</strong>
            <p>Synthesizing top priorities and risks across your projects</p>
          </div>
        </div>
      )}

      {error && (
        <div className="ai-briefing-error" role="alert">
          {error}
        </div>
      )}

      {briefing && !isCollapsed && (
        <div
          className="ai-briefing-body doc-markdown-body"
          dangerouslySetInnerHTML={{
            __html: markdownToSafeHtml(briefing),
          }}
        />
      )}
    </div>
  );
}
