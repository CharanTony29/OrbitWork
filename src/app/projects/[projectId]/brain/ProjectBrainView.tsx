"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Brain,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  GitBranch,
  History,
  Layers,
  MessageSquare,
  Network,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
} from "lucide-react";
import type {
  ActionableRecommendation,
  ChangeImpactResult,
  ChangeSimulationInput,
  HealthCategoryKey,
  ProjectBrainFullPayload,
  ProjectDecision,
} from "@/lib/brain/types";
import "./brain.css";

interface ProjectBrainViewProps {
  projectId: string;
  projectName: string;
  canEdit: boolean;
}

export type BrainSubTab =
  | "overview"
  | "why"
  | "preventive"
  | "dependencies"
  | "impact"
  | "workload"
  | "memory"
  | "timeline"
  | "graph"
  | "chat"
  | "generator";

export default function ProjectBrainView({
  projectId,
  projectName,
  canEdit,
}: ProjectBrainViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<BrainSubTab>("overview");
  const [data, setData] = useState<ProjectBrainFullPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic sub-nav horizontal scroll movers (< / >)
  const subnavRef = useRef<HTMLDivElement | null>(null);
  const [canScrollSubnavLeft, setCanScrollSubnavLeft] = useState(false);
  const [canScrollSubnavRight, setCanScrollSubnavRight] = useState(false);

  const updateSubnavScrollState = useCallback(() => {
    const el = subnavRef.current;
    if (!el) return;
    setCanScrollSubnavLeft(el.scrollLeft > 4);
    setCanScrollSubnavRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollSubnavBy = useCallback((delta: number) => {
    const el = subnavRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = subnavRef.current;
    if (!el) return;
    updateSubnavScrollState();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSubnavScrollState) : null;
    ro?.observe(el);
    window.addEventListener("resize", updateSubnavScrollState);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateSubnavScrollState);
    };
  }, [loading, data, updateSubnavScrollState]);

  useEffect(() => {
    const el = subnavRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLElement>(".brain-nav-tab.active");
    activeEl?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeTab]);

  // Selected Category for expansion
  const [expandedCategory, setExpandedCategory] = useState<HealthCategoryKey | null>(null);

  // Recommendation Review Modal
  const [reviewRec, setReviewRec] = useState<ActionableRecommendation | null>(null);
  const [applyingRec, setApplyingRec] = useState(false);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);
  const [preventiveCategoryFilter, setPreventiveCategoryFilter] = useState<string>("all");

  // Selection & Batch Operations for Recommendations
  const [selectedRecIds, setSelectedRecIds] = useState<Set<string>>(new Set());
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);
  const [batchTargetRecs, setBatchTargetRecs] = useState<ActionableRecommendation[]>([]);
  const [applyingBatch, setApplyingBatch] = useState(false);

  // Record Decision Modal
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionImpact, setDecisionImpact] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Timeline Filter
  const [timelineFilter, setTimelineFilter] = useState<"all" | "30d" | "7d">("all");

  // Change Impact Simulation State
  const [simType, setSimType] = useState<ChangeSimulationInput["changeType"]>("project_deadline");
  const [simDate, setSimDate] = useState("");
  const [simTaskId, setSimTaskId] = useState("");
  const [simAssigneeName, setSimAssigneeName] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<ChangeImpactResult | null>(null);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  // AI Task Generation State
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<
    Array<{
      title: string;
      description: string;
      priority: "low" | "normal" | "high" | "urgent";
      subtasks: string[];
      checklists: string[];
    }>
  >([]);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskCreateSuccess, setTaskCreateSuccess] = useState<string | null>(null);

  // Interactive Smart Graph Pan & Zoom State
  const [graphZoom, setGraphZoom] = useState(1);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [isGraphDragging, setIsGraphDragging] = useState(false);
  const graphDragStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const graphHasMovedRef = React.useRef(false);

  const handleGraphMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsGraphDragging(true);
    graphHasMovedRef.current = false;
    graphDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: graphPan.x,
      panY: graphPan.y,
    };
  };

  const handleGraphMouseMove = (e: React.MouseEvent) => {
    if (!isGraphDragging) return;
    const dx = e.clientX - graphDragStartRef.current.x;
    const dy = e.clientY - graphDragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      graphHasMovedRef.current = true;
    }
    setGraphPan({
      x: graphDragStartRef.current.panX + dx,
      y: graphDragStartRef.current.panY + dy,
    });
  };

  const handleGraphMouseUp = () => {
    setIsGraphDragging(false);
  };

  const handleGraphWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setGraphZoom((prev) => Math.max(0.3, Math.min(2.5, Number((prev * zoomFactor).toFixed(2)))));
  };

  const handleGraphTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsGraphDragging(true);
      graphHasMovedRef.current = false;
      graphDragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: graphPan.x,
        panY: graphPan.y,
      };
    }
  };

  const handleGraphTouchMove = (e: React.TouchEvent) => {
    if (!isGraphDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - graphDragStartRef.current.x;
    const dy = e.touches[0].clientY - graphDragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      graphHasMovedRef.current = true;
    }
    setGraphPan({
      x: graphDragStartRef.current.panX + dx,
      y: graphDragStartRef.current.panY + dy,
    });
  };

  const handleGraphTouchEnd = () => {
    setIsGraphDragging(false);
  };

  const zoomInGraph = () => setGraphZoom((prev) => Math.min(2.5, Number((prev + 0.15).toFixed(2))));
  const zoomOutGraph = () => setGraphZoom((prev) => Math.max(0.3, Number((prev - 0.15).toFixed(2))));
  const resetGraphView = () => {
    setGraphZoom(1);
    setGraphPan({ x: 0, y: 0 });
  };

  // Initial Fetch
  const fetchBrainData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/projects/${projectId}/brain${forceRefresh ? "?refresh=true" : ""}`
      );
      if (!res.ok) {
        throw new Error(`Failed to load Project Brain (status: ${res.status})`);
      }
      const json: ProjectBrainFullPayload = await res.json();
      setData(json);

      // Pre-set simulation initial values
      if (json.projectDueDate) {
        setSimDate(String(json.projectDueDate).split("T")[0]);
      }
      if (json.dependencies.blockedTasks.length > 0) {
        setSimTaskId(json.dependencies.blockedTasks[0].task.taskId);
      }
    } catch (err: unknown) {
      console.error("[Project Brain Load Error]:", err);
      setError(err instanceof Error ? err.message : "Failed to load Project Brain intelligence.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBrainData();
  }, [projectId]);

  // Apply Actionable Recommendation
  const handleApplyRecommendation = async (rec: ActionableRecommendation) => {
    try {
      setApplyingRec(true);
      const res = await fetch(`/api/projects/${projectId}/brain/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: rec.id,
          actionType: rec.actionType,
          actionPayload: rec.actionPayload,
          title: rec.title,
          reason: rec.whyRecommended,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to apply recommendation");
      }

      const resData = await res.json();
      setApplySuccessMsg(resData.changeSummary || "Changes applied successfully!");
      setReviewRec(null);

      // Re-fetch project brain data so health scores recalculate immediately
      fetchBrainData(true);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to apply recommendation");
    } finally {
      setApplyingRec(false);
    }
  };

  // Toggle single recommendation selection
  const toggleSelectRec = (id: string) => {
    setSelectedRecIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all / deselect all
  const toggleSelectAllRecs = () => {
    if (!data?.recommendations) return;
    if (selectedRecIds.size === data.recommendations.length) {
      setSelectedRecIds(new Set());
    } else {
      setSelectedRecIds(new Set(data.recommendations.map((r) => r.id)));
    }
  };

  // Open Batch Review Modal
  const handleOpenBatch = (recs: ActionableRecommendation[]) => {
    if (!recs.length) return;
    setBatchTargetRecs(recs);
    setBatchReviewOpen(true);
  };

  // Apply Batch Recommendations
  const handleApplyBatch = async (recs: ActionableRecommendation[]) => {
    if (!recs.length) return;
    try {
      setApplyingBatch(true);
      const res = await fetch(`/api/projects/${projectId}/brain/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: recs.map((r) => ({
            recommendationId: r.id,
            actionType: r.actionType,
            actionPayload: r.actionPayload,
            title: r.title,
            reason: r.whyRecommended,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to apply batch recommendations");
      }

      setApplySuccessMsg(
        `Successfully fixed ${recs.length} project recommendation${recs.length > 1 ? "s" : ""} at once!`
      );
      setBatchReviewOpen(false);
      setBatchTargetRecs([]);
      setSelectedRecIds(new Set());

      // Re-fetch project brain data so health scores recalculate immediately
      fetchBrainData(true);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to apply batch recommendations");
    } finally {
      setApplyingBatch(false);
    }
  };

  // Submit New Decision
  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionTitle.trim()) return;

    try {
      setSubmittingDecision(true);
      const res = await fetch(`/api/projects/${projectId}/brain/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: decisionTitle.trim(),
          reason: decisionReason.trim(),
          impact: decisionImpact.trim(),
          status: "accepted",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to record decision");
      }

      setDecisionModalOpen(false);
      setDecisionTitle("");
      setDecisionReason("");
      setDecisionImpact("");
      fetchBrainData(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Run Change Impact Simulation
  const handleRunSimulation = async () => {
    try {
      setSimLoading(true);
      const res = await fetch(`/api/projects/${projectId}/brain/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeType: simType,
          newDate: simDate || undefined,
          taskId: simTaskId || undefined,
          newAssigneeName: simAssigneeName || undefined,
        }),
      });

      if (!res.ok) throw new Error("Simulation calculation failed");
      const result: ChangeImpactResult = await res.json();
      setSimResult(result);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Simulation error");
    } finally {
      setSimLoading(false);
    }
  };

  // Send AI Chat Message
  const handleSendChatMessage = async (presetPrompt?: string) => {
    const textToSend = presetPrompt || chatInput;
    if (!textToSend.trim() || chatStreaming) return;

    const newMessages = [
      ...chatMessages,
      { role: "user" as const, content: textToSend.trim() },
    ];
    setChatMessages(newMessages);
    if (!presetPrompt) setChatInput("");
    setChatStreaming(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/brain/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error("AI Chat failed to stream response");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;
          setChatMessages([
            ...newMessages,
            { role: "assistant" as const, content: assistantText },
          ]);
        }
      }
    } catch (err: unknown) {
      console.error("[Project Brain Chat Error]:", err);
      setChatMessages([
        ...newMessages,
        {
          role: "assistant" as const,
          content:
            "⚠️ AI analysis temporarily unavailable. Deterministic metrics remain active. Please check back shortly.",
        },
      ]);
    } finally {
      setChatStreaming(false);
    }
  };

  // Generate Tasks from Goal (Preview)
  const handleGenerateTasksPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    try {
      setGeneratingTasks(true);
      setTaskCreateSuccess(null);
      const res = await fetch(`/api/projects/${projectId}/brain/generate-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalTitle: goalTitle.trim(),
          goalDescription: goalDesc.trim(),
          createTasks: false,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate task breakdown");
      const json = await res.json();
      setProposedTasks(json.proposedTasks || []);
      // Select all by default
      setSelectedTaskIndices(new Set((json.proposedTasks || []).map((_: unknown, i: number) => i)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error generating tasks");
    } finally {
      setGeneratingTasks(false);
    }
  };

  // Commit Approved Tasks to Database
  const handleCommitTasks = async () => {
    const toCreate = proposedTasks.filter((_, i) => selectedTaskIndices.has(i));
    if (toCreate.length === 0) {
      alert("Please select at least one task to create.");
      return;
    }

    try {
      setCreatingTasks(true);
      const res = await fetch(`/api/projects/${projectId}/brain/generate-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalTitle: goalTitle.trim(),
          createTasks: true,
          selectedTasks: toCreate,
        }),
      });

      if (!res.ok) throw new Error("Failed to create tasks in database");
      const json = await res.json();
      setTaskCreateSuccess(`Created ${json.createdCount} tasks successfully!`);
      setProposedTasks([]);
      setGoalTitle("");
      setGoalDesc("");
      fetchBrainData(true);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating tasks");
    } finally {
      setCreatingTasks(false);
    }
  };

  if (loading) {
    return (
      <div className="brain-container" style={{ textAlign: "center", padding: "60px 20px" }}>
        <Brain size={36} className="spin" style={{ color: "var(--green)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Analyzing Project Brain...</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: "6px 0 0" }}>
          Evaluating dependencies, workload, schedule variance, and critical path risks.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="brain-container" style={{ padding: "40px 20px" }}>
        <div className="brain-card" style={{ borderColor: "#dc2626", maxWidth: "600px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#dc2626" }}>
            <AlertCircle size={24} />
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Project Brain Offline</h3>
          </div>
          <p style={{ fontSize: "13px", color: "var(--ink)", margin: 0 }}>{error}</p>
          <button className="brain-refresh-btn" onClick={() => fetchBrainData(true)} style={{ width: "fit-content" }}>
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const { health, dependencies, workload, risks, recommendations, decisions, timeline, todayBrief, smartGraph } =
    data;

  // Filtered timeline
  const now = Date.now();
  const filteredTimeline = timeline.filter((e) => {
    if (timelineFilter === "all") return true;
    const itemTime = new Date(e.timestamp).getTime();
    if (timelineFilter === "7d") return now - itemTime <= 7 * 86400000;
    if (timelineFilter === "30d") return now - itemTime <= 30 * 86400000;
    return true;
  });

  return (
    <div className="brain-container">
      {/* 1. Top Header */}
      <div className="brain-header">
        <div className="brain-title-wrap">
          <div className="brain-icon-badge">🧠</div>
          <div className="brain-title-area">
            <h1>
              {projectName} Project Brain
              <span className="ai-badge">Intelligent Layer</span>
            </h1>
            <p>Predictive reasoning, dependency intelligence, and change impact analytics.</p>
          </div>
        </div>

        <div className="brain-header-actions">
          <span className="brain-last-updated">
            Updated {new Date(health.calculatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            className="brain-refresh-btn"
            onClick={() => fetchBrainData(true)}
            disabled={refreshing}
            title="Recalculate project health, dependencies, and risks"
          >
            <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            {refreshing ? "Recalculating..." : "Recalculate"}
          </button>
        </div>
      </div>

      {/* 2. Sub-Nav Tabs with Dynamic < / > Scroll Movers */}
      <div className="brain-subnav-wrap">
        {canScrollSubnavLeft && (
          <button
            type="button"
            className="brain-subnav-mover brain-subnav-mover-left"
            onClick={() => scrollSubnavBy(-240)}
            aria-label="Scroll tabs left"
            title="Scroll tabs left"
          >
            <ChevronLeft size={15} />
          </button>
        )}
        <div
          ref={subnavRef}
          className="brain-subnav"
          onScroll={updateSubnavScrollState}
        >
        <button
          className={`brain-nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <Layers size={13} /> Overview
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "why" ? "active" : ""}`}
          onClick={() => setActiveTab("why")}
        >
          <AlertCircle size={13} /> Why At Risk?
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "preventive" ? "active" : ""}`}
          onClick={() => setActiveTab("preventive")}
        >
          <Zap
            size={13}
            style={{ color: recommendations.length > 0 ? "var(--green)" : "var(--muted)" }}
          />{" "}
          Recommendations ({recommendations.length})
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "dependencies" ? "active" : ""}`}
          onClick={() => setActiveTab("dependencies")}
        >
          <GitBranch size={13} /> Dependencies ({dependencies.blockingTaskCount})
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "impact" ? "active" : ""}`}
          onClick={() => setActiveTab("impact")}
        >
          <Zap size={13} /> Change Simulator
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "workload" ? "active" : ""}`}
          onClick={() => setActiveTab("workload")}
        >
          <Users size={13} /> Workload ({workload.overloadedCount} Overloaded)
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "memory" ? "active" : ""}`}
          onClick={() => setActiveTab("memory")}
        >
          <Cpu size={13} /> Decisions ({decisions.length})
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "timeline" ? "active" : ""}`}
          onClick={() => setActiveTab("timeline")}
        >
          <History size={13} /> Timeline
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => setActiveTab("graph")}
        >
          <Network size={13} /> Project Graph
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <MessageSquare size={13} /> AI Project Chat
        </button>
        <button
          className={`brain-nav-tab ${activeTab === "generator" ? "active" : ""}`}
          onClick={() => setActiveTab("generator")}
        >
          <Sparkles size={13} /> Task Generator
        </button>
        </div>
        {canScrollSubnavRight && (
          <button
            type="button"
            className="brain-subnav-mover brain-subnav-mover-right"
            onClick={() => scrollSubnavBy(240)}
            aria-label="Scroll tabs right"
            title="More tabs"
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {applySuccessMsg && (
        <div
          style={{
            background: "rgba(22, 163, 74, 0.1)",
            border: "1px solid rgba(22, 163, 74, 0.3)",
            color: "#16a34a",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>✓ {applySuccessMsg}</span>
          <button
            onClick={() => setApplySuccessMsg(null)}
            style={{ background: "transparent", border: "none", color: "#16a34a", cursor: "pointer", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* 3. SUBTAB: OVERVIEW / DASHBOARD */}
      {activeTab === "overview" && (
        <>
          {/* Today's Brief */}
          <div className="today-brief-card">
            <div className="today-brief-header">
              <h3>
                <Sparkles size={16} style={{ color: "var(--green)" }} />
                Today&apos;s Project Brief
              </h3>
              <span className="today-brief-date">{todayBrief.todayDateFormatted}</span>
            </div>

            <div className="today-brief-items">
              {todayBrief.priorityItems.map((item) => (
                <div key={item.id} className="today-brief-item">
                  <div
                    className={`today-brief-item-dot ${
                      item.severity === "critical"
                        ? "dot-critical"
                        : item.severity === "high"
                        ? "dot-high"
                        : "dot-normal"
                    }`}
                  />
                  <div className="today-brief-item-content">
                    <p className="today-brief-item-title">{item.title}</p>
                    <p className="today-brief-item-detail">{item.detail}</p>
                    {item.taskId && (
                      <Link
                        href={`/projects/${projectId}/tasks/${item.taskId}`}
                        style={{ fontSize: "11px", color: "var(--green)", fontWeight: 600, display: "inline-block", marginTop: "4px" }}
                      >
                        {item.actionLabel || "View Task"} →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="today-brief-footer">
              <span>
                <strong>Project Health:</strong> {todayBrief.projectHealthScore}% ({todayBrief.projectHealthLabel})
              </span>
              <span>
                <strong>Expected Completion:</strong> {todayBrief.expectedCompletion} (
                <em>{todayBrief.completionVariance}</em>)
              </span>
            </div>
          </div>

          {/* Project Health Score & Category Breakdown */}
          <div className="health-overview-card">
            <div className="health-score-row">
              <div className="health-score-main">
                <div
                  className={`health-number-circle ${
                    health.overallStatus === "healthy"
                      ? "health-circle-healthy"
                      : health.overallStatus === "needs_attention"
                      ? "health-circle-attention"
                      : health.overallStatus === "at_risk"
                      ? "health-circle-at_risk"
                      : "health-circle-critical"
                  }`}
                >
                  {health.overallScore}%
                </div>
                <div className="health-label-area">
                  <h2>
                    Project Health: {health.statusLabel}
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background:
                          health.overallStatus === "healthy"
                            ? "rgba(22, 163, 74, 0.15)"
                            : health.overallStatus === "needs_attention"
                            ? "rgba(234, 179, 8, 0.15)"
                            : "rgba(220, 38, 38, 0.15)",
                        color:
                          health.overallStatus === "healthy"
                            ? "#16a34a"
                            : health.overallStatus === "needs_attention"
                            ? "#ca8a04"
                            : "#dc2626",
                      }}
                    >
                      {health.overallStatus.toUpperCase().replace("_", " ")}
                    </span>
                  </h2>
                  <p>{health.headlineExplanation}</p>
                </div>
              </div>

              {health.overallStatus !== "healthy" && (
                <button className="why-at-risk-btn" onClick={() => setActiveTab("why")}>
                  <AlertTriangle size={14} /> Why is my project at risk?
                </button>
              )}
            </div>

            {/* Expandable Category Pills */}
            <div className="health-categories-grid">
              {Object.values(health.categories).map((cat) => (
                <div
                  key={cat.key}
                  className="health-category-pill"
                  onClick={() =>
                    setExpandedCategory(expandedCategory === cat.key ? null : cat.key)
                  }
                  title="Click to view detailed score breakdown"
                >
                  <div className="health-category-header">
                    <span className="health-cat-name">{cat.label}</span>
                    <span className="health-cat-status-icon">
                      {cat.status === "good" ? "🟢" : cat.status === "warning" ? "🟠" : "🔴"}
                    </span>
                  </div>
                  <div
                    className={`health-cat-score ${
                      cat.status === "good"
                        ? "score-good"
                        : cat.status === "warning"
                        ? "score-warning"
                        : "score-danger"
                    }`}
                  >
                    {cat.score}%
                  </div>
                  <div className="health-cat-metric">{cat.metricLabel}</div>
                </div>
              ))}
            </div>

            {expandedCategory && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "var(--surface-subtle)",
                  border: "1px dashed var(--line)",
                  fontSize: "12px",
                }}
              >
                <strong>{health.categories[expandedCategory].label} Breakdown:</strong>{" "}
                {health.categories[expandedCategory].details}
              </div>
            )}
          </div>

          {/* AI Status Summary */}
          <div className="ai-summary-card">
            <div className="ai-summary-header">
              <div className="ai-summary-title">
                <Brain size={16} style={{ color: "var(--green)" }} />
                AI Project Status Summary
                <span className="ai-badge">Live Context</span>
              </div>
              <div className="transparency-pills">
                <span className="pill-fact">FACT</span>
                <span className="pill-analysis">ANALYSIS</span>
                <span className="pill-recommendation">RECOMMENDATION</span>
              </div>
            </div>

            <div className="ai-summary-content">
              {data.aiSummary.text.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          {/* Dual Column: Critical Risks & Recommended Actions */}
          <div className="brain-two-col">
            {/* Critical Risks */}
            <div className="brain-card">
              <div className="brain-card-header">
                <h3 className="brain-card-title">
                  <ShieldAlert size={16} style={{ color: "#dc2626" }} />
                  Predictive Risks ({risks.length})
                </h3>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Algorithmic Trajectory</span>
              </div>

              {risks.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                  ✓ No critical risks currently detected in this project.
                </p>
              ) : (
                risks.slice(0, 4).map((r) => {
                  const matchingRec =
                    recommendations.find(
                      (rec) =>
                        rec.riskId === r.id ||
                        (r.affectedPeople.length > 0 &&
                          rec.actionPayload &&
                          String(rec.actionPayload.oldAssigneeName || "").toLowerCase() ===
                            r.affectedPeople[0]?.toLowerCase())
                    ) || recommendations.find((rec) => rec.category === "workload");

                  return (
                    <div
                      key={r.id}
                      className={`risk-item-card ${
                        r.severity === "critical"
                          ? "risk-critical"
                          : r.severity === "high"
                          ? "risk-high"
                          : r.severity === "medium"
                          ? "risk-medium"
                          : "risk-low"
                      }`}
                    >
                      <div className="risk-item-header">
                        <p className="risk-title">{r.title}</p>
                        <span
                          className={`risk-probability-badge ${
                            r.severity === "critical"
                              ? "prob-critical"
                              : r.severity === "high"
                              ? "prob-high"
                              : "prob-medium"
                          }`}
                        >
                          {r.probabilityScore ? `${r.probabilityScore}% probability` : r.probabilityLevel}
                        </span>
                      </div>
                      <p className="risk-reason">{r.reason}</p>

                      {/* Preventive Mitigation Box */}
                      <div className="risk-preventive-box">
                        <div className="risk-preventive-header">
                          <span className="risk-preventive-badge">
                            <Zap size={11} /> Preventive Mitigation
                          </span>
                          {matchingRec?.riskReductionLabel && (
                            <span className="risk-reduction-tag">{matchingRec.riskReductionLabel}</span>
                          )}
                          {matchingRec?.healthImpactLabel && (
                            <span className="health-gain-tag">{matchingRec.healthImpactLabel}</span>
                          )}
                        </div>
                        <p className="risk-preventive-text">
                          {r.mitigationStrategy || matchingRec?.title || r.recommendedAction}
                        </p>
                        <div className="risk-preventive-footer">
                          {matchingRec && canEdit && (
                            <button
                              className="risk-mitigate-btn"
                              onClick={() => setReviewRec(matchingRec)}
                              title="Review simulated impact and apply preventive measure"
                            >
                              ⚡ Mitigate Risk
                            </button>
                          )}
                          <button
                            className="risk-view-measures-btn"
                            onClick={() => setActiveTab("preventive")}
                          >
                            View Mitigation Options →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Recommended Actions */}
            <div className="brain-card">
              <div className="brain-card-header">
                <h3 className="brain-card-title">
                  <Zap size={16} style={{ color: "var(--green)" }} />
                  Recommended Actions ({recommendations.length})
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  {canEdit && recommendations.length > 0 && (
                    <button
                      className="rec-fix-all-btn"
                      onClick={() => handleOpenBatch(recommendations)}
                      title="Apply all recommendations at once with single confirmation"
                    >
                      ⚡ Fix All ({recommendations.length})
                    </button>
                  )}
                  <button
                    className="rec-view-all-tab-btn"
                    onClick={() => setActiveTab("preventive")}
                    title="View all recommendations with multi-select in separate tab"
                  >
                    Manage All →
                  </button>
                </div>
              </div>

              {recommendations.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                  ✓ All deliverables aligned. No corrective actions required.
                </p>
              ) : (
                <>
                  {recommendations.slice(0, 2).map((rec) => (
                    <div key={rec.id} className="rec-item-card">
                      <div className="rec-title-row">
                        <p className="rec-title">{rec.title}</p>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                          {rec.riskReductionLabel && (
                            <span className="risk-reduction-tag">{rec.riskReductionLabel}</span>
                          )}
                          {rec.healthImpactLabel && (
                            <span className="health-gain-tag">{rec.healthImpactLabel}</span>
                          )}
                        </div>
                      </div>
                      <div className="rec-explanation-grid">
                        <div className="rec-expl-item">
                          <strong>Why:</strong> {rec.whyRecommended}
                        </div>
                        <div className="rec-expl-item">
                          <strong>Expected Benefit:</strong> {rec.expectedBenefit}
                        </div>
                        <div className="rec-expl-item">
                          <strong>Possible Risk:</strong> {rec.possibleRisk}
                        </div>
                      </div>
                      <div className="rec-action-buttons">
                        <button className="rec-review-btn" onClick={() => setReviewRec(rec)}>
                          Review changes
                        </button>
                        {canEdit && (
                          <button
                            className="rec-apply-btn"
                            onClick={() => handleApplyRecommendation(rec)}
                            disabled={applyingRec}
                          >
                            Apply change
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {recommendations.length > 2 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--surface-subtle)",
                        border: "1px dashed var(--line)",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        marginTop: "2px",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>
                        + {recommendations.length - 2} more recommendations available in separate tab.
                      </span>
                      <button
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--green)",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: "12px",
                          padding: 0,
                        }}
                        onClick={() => setActiveTab("preventive")}
                      >
                        Open Recommendations Tab ({recommendations.length}) →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* 4. SUBTAB: WHY AT RISK */}
      {activeTab === "why" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <AlertTriangle size={18} style={{ color: "#dc2626" }} />
              Why is this project at risk? (Causal Chain Analysis)
            </h3>
          </div>

          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            Traced directly from real task dependencies, overdue milestones, and team workload.
          </p>

          <div className="why-chain-wrapper">
            {data.whyAtRisk.chain.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="why-chain-step">
                  <div className="why-step-index">{idx + 1}</div>
                  <div className="why-step-content">
                    <div className="why-step-stage">{step.stage}</div>
                    <div className="why-step-desc">{step.description}</div>
                    <div className="why-step-evidence">Evidence: {step.evidence}</div>
                  </div>
                </div>
                {idx < data.whyAtRisk.chain.length - 1 && (
                  <div className="why-chain-arrow">
                    <ArrowDown size={18} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px",
              marginTop: "16px",
              padding: "16px",
              borderRadius: "8px",
              background: "var(--surface-subtle)",
              border: "1px solid var(--line)",
            }}
          >
            <div>
              <strong style={{ fontSize: "12px", color: "var(--ink)", display: "block" }}>Root Cause:</strong>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>{data.whyAtRisk.rootCause}</span>
            </div>
            <div>
              <strong style={{ fontSize: "12px", color: "var(--ink)", display: "block" }}>Direct Impact:</strong>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>{data.whyAtRisk.directImpact}</span>
            </div>
            <div>
              <strong style={{ fontSize: "12px", color: "var(--ink)", display: "block" }}>Expected Schedule Delay:</strong>
              <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 700 }}>
                {data.whyAtRisk.expectedScheduleImpact}
              </span>
            </div>
            <div>
              <strong style={{ fontSize: "12px", color: "var(--ink)", display: "block" }}>Affected People:</strong>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {data.whyAtRisk.affectedPeople.length ? data.whyAtRisk.affectedPeople.join(", ") : "None identified"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUBTAB: PREVENTIVE MEASURES & RECOMMENDATIONS */}
      {activeTab === "preventive" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="brain-card">
            <div className="brain-card-header">
              <h3 className="brain-card-title">
                <ShieldAlert size={18} style={{ color: "var(--green)" }} />
                Recommendations & Preventive Actions Control Center
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {canEdit && recommendations.length > 0 && (
                  <button
                    className="batch-fix-all-btn"
                    onClick={() => handleOpenBatch(recommendations)}
                    title="Apply all recommendations in a single batch operation"
                  >
                    ⚡ Fix All at Once ({recommendations.length})
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              Actionable recommendations to eliminate execution bottlenecks, level contributor workloads, and safeguard project deliverables before delays compound.
            </p>

            {/* Impact Metrics Banner */}
            <div className="preventive-summary-banner">
              <div className="preventive-stat-card">
                <span className="preventive-stat-label">Active Project Risks</span>
                <span
                  className="preventive-stat-value"
                  style={{ color: risks.length > 0 ? "#dc2626" : "var(--green)" }}
                >
                  {risks.length} {risks.length === 1 ? "Risk" : "Risks"}
                </span>
                <span className="preventive-stat-subtext">
                  {risks.some((r) => r.severity === "critical")
                    ? "Critical severity detected"
                    : risks.some((r) => r.severity === "high")
                    ? "High probability bottleneck"
                    : "Moderate risk trajectory"}
                </span>
              </div>

              <div className="preventive-stat-card">
                <span className="preventive-stat-label">Available Mitigations</span>
                <span className="preventive-stat-value" style={{ color: "var(--green)" }}>
                  {recommendations.length} Actionable
                </span>
                <span className="preventive-stat-subtext">Calculated safe operations</span>
              </div>

              <div className="preventive-stat-card">
                <span className="preventive-stat-label">Projected Health Score</span>
                <span className="preventive-stat-value" style={{ color: "var(--green)" }}>
                  {health.overallScore}% ➔{" "}
                  {Math.min(100, health.overallScore + Math.min(20, recommendations.length * 5))}%
                </span>
                <span className="preventive-stat-subtext">
                  Estimated +{Math.min(20, recommendations.length * 5)} pts post-mitigation
                </span>
              </div>

              <div className="preventive-stat-card">
                <span className="preventive-stat-label">Risk Trajectory</span>
                <span className="preventive-stat-value" style={{ color: "#16a34a" }}>
                  <TrendingDown size={18} /> High ➔ Low
                </span>
                <span className="preventive-stat-subtext">Eliminates single points of failure</span>
              </div>
            </div>

            {/* Filter Chips */}
            <div className="preventive-filter-bar">
              <button
                className={`preventive-filter-chip ${preventiveCategoryFilter === "all" ? "active" : ""}`}
                onClick={() => setPreventiveCategoryFilter("all")}
              >
                All Measures ({recommendations.length})
              </button>
              <button
                className={`preventive-filter-chip ${preventiveCategoryFilter === "workload" ? "active" : ""}`}
                onClick={() => setPreventiveCategoryFilter("workload")}
              >
                Workload Rebalancing ({recommendations.filter((r) => r.category === "workload").length})
              </button>
              <button
                className={`preventive-filter-chip ${preventiveCategoryFilter === "schedule" ? "active" : ""}`}
                onClick={() => setPreventiveCategoryFilter("schedule")}
              >
                Schedule Staggering ({recommendations.filter((r) => r.category === "schedule").length})
              </button>
              <button
                className={`preventive-filter-chip ${preventiveCategoryFilter === "blocker" ? "active" : ""}`}
                onClick={() => setPreventiveCategoryFilter("blocker")}
              >
                Blocker Clearance ({recommendations.filter((r) => r.category === "blocker").length})
              </button>
            </div>

            {/* Batch Selection Toolbar */}
            {recommendations.length > 0 && (
              <div className="batch-action-toolbar">
                <div className="select-all-group">
                  <label className="select-all-label">
                    <input
                      type="checkbox"
                      checked={
                        recommendations.filter(
                          (r) => preventiveCategoryFilter === "all" || r.category === preventiveCategoryFilter
                        ).length > 0 &&
                        recommendations
                          .filter((r) => preventiveCategoryFilter === "all" || r.category === preventiveCategoryFilter)
                          .every((r) => selectedRecIds.has(r.id))
                      }
                      onChange={toggleSelectAllRecs}
                      className="rec-item-checkbox"
                    />
                    <span>
                      {recommendations
                        .filter((r) => preventiveCategoryFilter === "all" || r.category === preventiveCategoryFilter)
                        .every((r) => selectedRecIds.has(r.id))
                        ? "Deselect All"
                        : `Select All (${
                            recommendations.filter(
                              (r) => preventiveCategoryFilter === "all" || r.category === preventiveCategoryFilter
                            ).length
                          })`}
                    </span>
                  </label>
                  {selectedRecIds.size > 0 && (
                    <span className="selection-count-pill">
                      {selectedRecIds.size} of {recommendations.length} selected
                    </span>
                  )}
                </div>

                <div className="batch-buttons-group">
                  {canEdit && (
                    <>
                      <button
                        className="batch-fix-selected-btn"
                        disabled={selectedRecIds.size === 0}
                        onClick={() =>
                          handleOpenBatch(
                            recommendations.filter((r) => selectedRecIds.has(r.id))
                          )
                        }
                      >
                        ⚡ Fix Selected ({selectedRecIds.size})
                      </button>
                      <button
                        className="batch-fix-all-btn"
                        onClick={() => handleOpenBatch(recommendations)}
                      >
                        ⚡ Fix All at Once ({recommendations.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* List of Preventive Measures */}
            {recommendations.length === 0 ? (
              <div
                style={{
                  background: "rgba(22, 163, 74, 0.08)",
                  border: "1px solid rgba(22, 163, 74, 0.25)",
                  padding: "24px",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <CheckCircle2 size={32} style={{ color: "var(--green)", margin: "0 auto 10px" }} />
                <h4 style={{ margin: "0 0 6px", fontSize: "15px", color: "var(--ink)" }}>
                  Maximum Project Health Achieved
                </h4>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)" }}>
                  All deliverables, task dependencies, and contributor workloads are in equilibrium. No corrective or preventive measures are currently required.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {recommendations
                  .filter((rec) => preventiveCategoryFilter === "all" || rec.category === preventiveCategoryFilter)
                  .map((rec) => (
                    <div key={rec.id} className="preventive-measure-card">
                      <div className="rec-card-with-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedRecIds.has(rec.id)}
                          onChange={() => toggleSelectRec(rec.id)}
                          className="rec-item-checkbox"
                          style={{ marginTop: "3px" }}
                          title="Select for batch fix"
                        />
                        <div className="rec-card-body">
                          <div className="preventive-measure-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span
                                className={`preventive-category-badge ${
                                  rec.category === "workload"
                                    ? "cat-workload"
                                    : rec.category === "blocker"
                                    ? "cat-blocker"
                                    : rec.category === "schedule"
                                    ? "cat-schedule"
                                    : "cat-dependency"
                                }`}
                              >
                                {rec.category || "Preventive"}
                              </span>
                              <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "var(--ink)" }}>
                                {rec.title}
                              </h4>
                            </div>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {rec.riskReductionLabel && (
                                <span className="risk-reduction-tag">{rec.riskReductionLabel}</span>
                              )}
                              {rec.healthImpactLabel && (
                                <span className="health-gain-tag">{rec.healthImpactLabel}</span>
                              )}
                            </div>
                          </div>

                          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--ink)", lineHeight: 1.5 }}>
                            {rec.description}
                          </p>

                          {/* Simulation & Comparison Meter */}
                          <div className="preventive-comparison-meter">
                            <span style={{ fontWeight: 600, color: "var(--muted)" }}>Simulated Trajectory:</span>
                            <span className="comparison-before">
                              Current Risk: High ({rec.riskReductionScore ? "75%" : "Elevated"})
                            </span>
                            <ArrowRight size={13} style={{ color: "var(--muted)" }} />
                            <span className="comparison-after">
                              Mitigated Risk: Low (
                              {rec.riskReductionScore ? `${Math.max(15, 75 - rec.riskReductionScore)}%` : "Resolved"})
                            </span>
                            <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--green)", fontWeight: 700 }}>
                              {rec.healthImpactLabel || "+6% Project Health"}
                            </span>
                          </div>

                          <div className="rec-explanation-grid">
                            <div className="rec-expl-item">
                              <strong>Why Recommended:</strong> {rec.whyRecommended}
                            </div>
                            <div className="rec-expl-item">
                              <strong>Expected Benefit:</strong> {rec.expectedBenefit}
                            </div>
                            <div className="rec-expl-item">
                              <strong>Scope Affected:</strong> {rec.affectsDescription}
                            </div>
                            <div className="rec-expl-item">
                              <strong>Possible Risk:</strong> {rec.possibleRisk}
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                            <button className="rec-review-btn" onClick={() => setReviewRec(rec)}>
                              Simulate & Review
                            </button>
                            {canEdit && (
                              <button
                                className="risk-mitigate-btn"
                                onClick={() => handleApplyRecommendation(rec)}
                                disabled={applyingRec}
                              >
                                ⚡ Apply Change
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. SUBTAB: DEPENDENCIES */}
      {activeTab === "dependencies" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <GitBranch size={16} style={{ color: "var(--green)" }} />
              Task Dependency & Blocker Intelligence
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {dependencies.blockingTaskCount} blockers affecting {dependencies.blockedTaskCount} tasks
            </span>
          </div>

          {dependencies.hasCircularDependencies && (
            <div
              style={{
                background: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                color: "#dc2626",
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              <strong>⚠️ Circular Dependency Deadlock:</strong> Tasks are mutually blocking each other:{" "}
              {dependencies.circularChains[0]?.join(" ➔ ")}
            </div>
          )}

          {dependencies.blockingTasks.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "10px 0" }}>
              ✓ No tasks are currently blocking progress. The dependency graph is clear.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
              {dependencies.blockingTasks.map((bt) => (
                <div
                  key={bt.task.taskId}
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>[BLOCKER]</span>
                      <Link
                        href={`/projects/${projectId}/tasks/${bt.task.taskId}`}
                        style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)", textDecoration: "none" }}
                      >
                        {bt.task.title}
                      </Link>
                      {bt.task.isOverdue && (
                        <span style={{ fontSize: "10px", background: "#dc2626", color: "#fff", padding: "1px 6px", borderRadius: "4px" }}>
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Assignees: {bt.task.assignees.join(", ")}
                    </span>
                  </div>

                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "6px 0 10px" }}>
                    Currently blocking <strong>{bt.blocksCount}</strong> downstream tasks:
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "16px" }}>
                    {bt.blockedTasks.map((down) => (
                      <div
                        key={down.taskId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          color: "var(--ink)",
                        }}
                      >
                        <ArrowRight size={12} style={{ color: "var(--muted)" }} />
                        <Link
                          href={`/projects/${projectId}/tasks/${down.taskId}`}
                          style={{ color: "var(--ink)", textDecoration: "underline" }}
                        >
                          {down.title}
                        </Link>
                        <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                          (Status: {down.statusName} | Due: {down.dueDate || "None"})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. SUBTAB: CHANGE IMPACT SIMULATOR */}
      {activeTab === "impact" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Zap size={16} style={{ color: "var(--green)" }} />
              Change Impact Simulator (What-If Analysis)
            </h3>
          </div>

          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            Simulate a proposed schedule change, reassignment, or deadline modification to observe its ripple effects
            across all project tasks before making changes.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              padding: "16px",
              background: "var(--surface-subtle)",
              borderRadius: "8px",
              border: "1px solid var(--line)",
            }}
          >
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                CHANGE SCENARIO
              </label>
              <select
                value={simType}
                onChange={(e) => setSimType(e.target.value as ChangeSimulationInput["changeType"])}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  fontSize: "13px",
                }}
              >
                <option value="project_deadline">Project Deadline Moved</option>
                <option value="task_due_date">Task Due Date Rescheduled</option>
                <option value="task_reassign">Task Reassigned to Teammate</option>
              </select>
            </div>

            {simType === "project_deadline" && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  SIMULATED NEW DEADLINE
                </label>
                <input
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "13px",
                  }}
                />
              </div>
            )}

            {simType === "task_due_date" && (
              <>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    SELECT TASK
                  </label>
                  <select
                    value={simTaskId}
                    onChange={(e) => setSimTaskId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="">Select a task...</option>
                    {data.dependencies.blockedTasks.map((bt) => (
                      <option key={bt.task.taskId} value={bt.task.taskId}>
                        {bt.task.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    NEW TARGET DATE
                  </label>
                  <input
                    type="date"
                    value={simDate}
                    onChange={(e) => setSimDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </>
            )}

            {simType === "task_reassign" && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  TARGET REASSIGNEE
                </label>
                <select
                  value={simAssigneeName}
                  onChange={(e) => setSimAssigneeName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "13px",
                  }}
                >
                  <option value="">Select teammate...</option>
                  {workload.members.map((m) => (
                    <option key={m.userId} value={m.name}>
                      {m.name} ({m.workloadPercentage}% load)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                className="rec-apply-btn"
                onClick={handleRunSimulation}
                disabled={simLoading}
                style={{ width: "100%", padding: "9px 16px", height: "36px" }}
              >
                {simLoading ? "Calculating Impact..." : "Simulate Impact"}
              </button>
            </div>
          </div>

          {/* Simulation Results Display */}
          {simResult && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px 20px",
                background: "var(--surface-subtle)",
                border: "1px solid var(--green)",
                borderRadius: "8px",
              }}
            >
              <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                Simulation Results: {simResult.changeDescription}
              </h4>
              <p style={{ fontSize: "13px", color: "var(--ink)", margin: "0 0 12px" }}>{simResult.summary}</p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ background: "var(--surface)", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>AFFECTED TASKS</span>
                  <strong style={{ fontSize: "16px", color: "var(--ink)" }}>{simResult.affectedTaskCount}</strong>
                </div>
                <div style={{ background: "var(--surface)", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>DEPENDENCIES</span>
                  <strong style={{ fontSize: "16px", color: "var(--ink)" }}>{simResult.affectedDependencyCount}</strong>
                </div>
                <div style={{ background: "var(--surface)", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>PEOPLE AFFECTED</span>
                  <strong style={{ fontSize: "16px", color: "var(--ink)" }}>{simResult.affectedPeopleCount}</strong>
                </div>
              </div>

              <div style={{ fontSize: "12px", color: "var(--ink)", marginBottom: "8px" }}>
                <strong>Potential Result:</strong> {simResult.potentialResult}
              </div>

              {simResult.recommendedActions.length > 0 && (
                <div style={{ fontSize: "12px", color: "var(--green)" }}>
                  <strong>Brain Recommended Actions:</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                    {simResult.recommendedActions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. SUBTAB: WORKLOAD */}
      {activeTab === "workload" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Users size={16} style={{ color: "var(--green)" }} />
              Team Workload & Capacity Intelligence
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {workload.overloadedCount} overloaded | {workload.unassignedTaskCount} unassigned tasks
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {workload.members.map((m) => (
              <div key={m.userId} className="workload-member-row">
                <div className="workload-member-info">
                  <span className="workload-member-name">
                    {m.name} ({m.activeTaskCount} active tasks, {m.overdueTaskCount} overdue)
                  </span>
                  <span
                    className={`workload-member-badge ${
                      m.status === "overloaded"
                        ? "badge-overloaded"
                        : m.status === "balanced"
                        ? "badge-balanced"
                        : "badge-underutilized"
                    }`}
                  >
                    {m.status.toUpperCase()} ({m.workloadPercentage}%)
                  </span>
                </div>

                <div className="workload-bar-track">
                  <div
                    className={`workload-bar-fill ${
                      m.status === "overloaded"
                        ? "bar-fill-overloaded"
                        : m.status === "balanced"
                        ? "bar-fill-balanced"
                        : "bar-fill-underutilized"
                    }`}
                    style={{ width: `${m.workloadPercentage}%` }}
                  />
                </div>

                {m.taskTitles.length > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Assigned: {m.taskTitles.join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>

          {workload.recommendations.length > 0 && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                background: "var(--surface-subtle)",
                borderRadius: "8px",
                borderLeft: "3px solid var(--green)",
                fontSize: "12px",
              }}
            >
              <strong>Rebalancing Guidance:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: "16px" }}>
                {workload.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 8. SUBTAB: PROJECT MEMORY & DECISIONS */}
      {activeTab === "memory" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Cpu size={16} style={{ color: "var(--green)" }} />
              Project Memory & Architectural Decisions
            </h3>
            {canEdit && (
              <button className="rec-apply-btn" onClick={() => setDecisionModalOpen(true)}>
                <Plus size={13} /> Record Decision
              </button>
            )}
          </div>

          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            Orbitwork remembers why key technical and project decisions were made, linking them to tasks and documents.
          </p>

          {decisions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--muted)" }}>
              <Cpu size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
              <p style={{ fontSize: "13px", margin: 0 }}>No decisions recorded yet in this project.</p>
              <p style={{ fontSize: "12px", margin: "4px 0 0" }}>
                Record architectural, vendor, or scope decisions so the team and AI can query why choices were made.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              {decisions.map((dec) => (
                <div
                  key={dec.id}
                  style={{
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Decision: {dec.title}</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {dec.decisionDate} • Decided by {dec.decidedByName}
                    </span>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--ink)" }}>
                    <strong>Reason:</strong> {dec.reason}
                  </div>
                  {dec.impact && (
                    <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--muted)" }}>
                      <strong>Impact:</strong> {dec.impact}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. SUBTAB: TIMELINE / TIME MACHINE */}
      {activeTab === "timeline" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <History size={16} style={{ color: "var(--green)" }} />
              Project Time Machine (Change History Audit)
            </h3>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className={`brain-refresh-btn ${timelineFilter === "all" ? "active" : ""}`}
                onClick={() => setTimelineFilter("all")}
              >
                All
              </button>
              <button
                className={`brain-refresh-btn ${timelineFilter === "30d" ? "active" : ""}`}
                onClick={() => setTimelineFilter("30d")}
              >
                Last 30 Days
              </button>
              <button
                className={`brain-refresh-btn ${timelineFilter === "7d" ? "active" : ""}`}
                onClick={() => setTimelineFilter("7d")}
              >
                Last 7 Days
              </button>
            </div>
          </div>

          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            Chronological audit log tracking real deadline movements, status changes, task creations, and assignments.
          </p>

          <div className="timeline-event-list">
            {filteredTimeline.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>No events recorded for this timeframe.</p>
            ) : (
              filteredTimeline.map((e) => (
                <div key={e.id} className="timeline-event-card">
                  <div className="timeline-event-dot" />
                  <div className="timeline-event-content">
                    <span className="timeline-event-date">
                      {e.date} • {e.actorName}
                    </span>
                    <h5 className="timeline-event-title">{e.title}</h5>
                    <p className="timeline-event-desc">{e.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 10. SUBTAB: SMART PROJECT GRAPH */}
      {activeTab === "graph" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Network size={16} style={{ color: "var(--green)" }} />
              Smart Project Graph (Visual Relationship Network)
            </h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {smartGraph.nodes.length} nodes | {smartGraph.edges.length} relationships
            </span>
          </div>

          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            Visualizes relationships between Project, Goals, Milestones, Tasks, and Blockers. Click any task or goal node
            to open it directly.
          </p>

          <div
            className={`graph-viewport ${isGraphDragging ? "is-dragging" : ""}`}
            onMouseDown={handleGraphMouseDown}
            onMouseMove={handleGraphMouseMove}
            onMouseUp={handleGraphMouseUp}
            onMouseLeave={handleGraphMouseUp}
            onWheel={handleGraphWheel}
            onTouchStart={handleGraphTouchStart}
            onTouchMove={handleGraphTouchMove}
            onTouchEnd={handleGraphTouchEnd}
          >
            {/* Floating Zoom & Pan Controls */}
            <div className="graph-controls-toolbar">
              <button
                type="button"
                className="graph-ctrl-btn"
                onClick={zoomInGraph}
                title="Zoom In (+)"
              >
                <ZoomIn size={14} />
              </button>
              <span className="graph-zoom-badge">
                {Math.round(graphZoom * 100)}%
              </span>
              <button
                type="button"
                className="graph-ctrl-btn"
                onClick={zoomOutGraph}
                title="Zoom Out (-)"
              >
                <ZoomOut size={14} />
              </button>
              <button
                type="button"
                className="graph-ctrl-btn"
                onClick={resetGraphView}
                title="Reset View (100% Fit)"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Hint Badge */}
            <div className="graph-hint-badge">
              <Move size={12} /> Drag to move · Scroll wheel to zoom
            </div>

            <svg className="graph-svg">
              <defs>
                <pattern id="graph-grid-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.2" fill="var(--line, #cbd5e1)" opacity="0.6" />
                </pattern>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="var(--muted)" />
                </marker>
              </defs>

              {/* Background Grid Pattern */}
              <rect width="100%" height="100%" fill="url(#graph-grid-dots)" />

              {/* Pannable and Zoomable Scene */}
              <g transform={`translate(${graphPan.x}, ${graphPan.y}) scale(${graphZoom})`}>
                {/* Render edges */}
                {smartGraph.edges.map((edge) => {
                  const sIdx = smartGraph.nodes.findIndex((n) => n.id === edge.source);
                  const tIdx = smartGraph.nodes.findIndex((n) => n.id === edge.target);
                  if (sIdx < 0 || tIdx < 0) return null;

                  const sx = 100 + (sIdx % 5) * 220;
                  const sy = 60 + Math.floor(sIdx / 5) * 110;
                  const tx = 100 + (tIdx % 5) * 220;
                  const ty = 60 + Math.floor(tIdx / 5) * 110;

                  return (
                    <line
                      key={edge.id}
                      x1={sx + 75}
                      y1={sy + 23}
                      x2={tx + 75}
                      y2={ty + 23}
                      stroke={edge.relation === "blocks" ? "#dc2626" : "var(--line, #cbd5e1)"}
                      strokeWidth={edge.relation === "blocks" ? 2 : 1.2}
                      strokeDasharray={edge.relation === "blocks" ? "4,4" : undefined}
                      markerEnd="url(#arrowhead)"
                    />
                  );
                })}

                {/* Render nodes */}
                {smartGraph.nodes.map((node, idx) => {
                  const nx = 100 + (idx % 5) * 220;
                  const ny = 60 + Math.floor(idx / 5) * 110;

                  const isTask = node.type === "task";
                  const isGoal = node.type === "goal";
                  const isProject = node.type === "project";

                  return (
                    <g
                      key={node.id}
                      className="graph-node"
                      transform={`translate(${nx}, ${ny})`}
                      onClick={() => {
                        if (!graphHasMovedRef.current && node.linkUrl) {
                          router.push(node.linkUrl);
                        }
                      }}
                    >
                      <rect
                        width="150"
                        height="46"
                        rx="8"
                        fill={
                          isProject
                            ? "rgba(22, 124, 88, 0.15)"
                            : isGoal
                            ? "rgba(139, 92, 246, 0.12)"
                            : node.isOverdue
                            ? "rgba(220, 38, 38, 0.12)"
                            : "var(--surface-subtle)"
                        }
                        stroke={
                          isProject
                            ? "var(--green)"
                            : isGoal
                            ? "#8b5cf6"
                            : node.isOverdue
                            ? "#dc2626"
                            : "var(--line)"
                        }
                        strokeWidth="1.5"
                      />
                      <text
                        x="10"
                        y="18"
                        fontSize="9"
                        fontWeight="700"
                        fill="var(--muted)"
                        textAnchor="start"
                      >
                        {node.type.toUpperCase()}
                      </text>
                      <text
                        x="10"
                        y="33"
                        fontSize="11"
                        fontWeight="600"
                        fill="var(--ink)"
                        textAnchor="start"
                      >
                        {node.label.length > 18 ? `${node.label.slice(0, 16)}...` : node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* 11. SUBTAB: AI PROJECT CHAT */}
      {activeTab === "chat" && (
        <div className="brain-chat-container">
          <div className="brain-chat-messages">
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", margin: "auto", maxWidth: "420px" }}>
                <Brain size={32} style={{ color: "var(--green)", margin: "0 auto 8px" }} />
                <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700 }}>
                  Ask {projectName} Project Brain
                </h4>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                  Ask questions about deadlines, blockers, overloaded teammates, weekly updates, or project decisions.
                  Grounded strictly in your project database.
                </p>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`brain-chat-bubble ${msg.role === "user" ? "user" : "assistant"}`}
              >
                {msg.content}
              </div>
            ))}

            {chatStreaming && (
              <div className="brain-chat-bubble assistant" style={{ fontStyle: "italic", opacity: 0.8 }}>
                Thinking and reasoning from project facts...
              </div>
            )}
          </div>

          <div className="brain-chat-starters">
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("Why is this project delayed?")}
            >
              Why is this project delayed?
            </button>
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("What is blocking the project?")}
            >
              What is blocking the project?
            </button>
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("Who is overloaded?")}
            >
              Who is overloaded?
            </button>
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("What should I work on today?")}
            >
              What should I work on today?
            </button>
            <button
              className="brain-starter-chip"
              onClick={() => handleSendChatMessage("Prepare my weekly project update.")}
            >
              Prepare my weekly update
            </button>
          </div>

          <form
            className="brain-chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage();
            }}
          >
            <input
              className="brain-chat-input"
              placeholder={`Ask anything about ${projectName}...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatStreaming}
            />
            <button type="submit" className="brain-chat-send-btn" disabled={chatStreaming || !chatInput.trim()}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* 12. SUBTAB: AI TASK GENERATOR */}
      {activeTab === "generator" && (
        <div className="brain-card">
          <div className="brain-card-header">
            <h3 className="brain-card-title">
              <Sparkles size={16} style={{ color: "var(--green)" }} />
              AI Task & Work Breakdown Structure Generator
            </h3>
          </div>

          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            Enter a high-level goal or milestone. Project Brain will propose required tasks, subtasks, checklists,
            dependencies, and risk factors. You review and confirm before anything is inserted into the project.
          </p>

          <form onSubmit={handleGenerateTasksPreview} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <textarea
              placeholder="e.g. Launch company mobile app release or Implement Stripe billing"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              rows={2}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "vertical",
              }}
              required
            />
            <textarea
              placeholder="Optional scope details, test scenarios, or numbered task breakdown..."
              value={goalDesc}
              onChange={(e) => setGoalDesc(e.target.value)}
              rows={4}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: "13px",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
            <button
              type="submit"
              className="rec-apply-btn"
              disabled={generatingTasks || !goalTitle.trim()}
              style={{ width: "fit-content" }}
            >
              {generatingTasks ? "Analyzing & Generating WBS..." : "Generate Work Breakdown"}
            </button>
          </form>

          {taskCreateSuccess && (
            <div
              style={{
                background: "rgba(22, 163, 74, 0.1)",
                color: "#16a34a",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              ✓ {taskCreateSuccess}
            </div>
          )}

          {proposedTasks.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                  Proposed Tasks ({proposedTasks.length}) — Review & Confirm
                </h4>
                <button
                  className="rec-apply-btn"
                  onClick={handleCommitTasks}
                  disabled={creatingTasks}
                >
                  {creatingTasks ? "Creating Tasks..." : `Create ${selectedTaskIndices.size} Selected Tasks`}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {proposedTasks.map((t, idx) => {
                  const isChecked = selectedTaskIndices.has(idx);
                  return (
                    <div
                      key={idx}
                      style={{
                        background: "var(--surface-subtle)",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = new Set(selectedTaskIndices);
                          if (e.target.checked) next.add(idx);
                          else next.delete(idx);
                          setSelectedTaskIndices(next);
                        }}
                        style={{ marginTop: "4px" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{t.title}</strong>
                          <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.06)", textTransform: "uppercase" }}>
                            {t.priority}
                          </span>
                        </div>
                        {t.description && (
                          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0" }}>{t.description}</p>
                        )}
                        {t.subtasks.length > 0 && (
                          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                            <strong>Subtasks:</strong> {t.subtasks.join(", ")}
                          </div>
                        )}
                        {t.checklists.length > 0 && (
                          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                            <strong>Checklist:</strong> {t.checklists.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Review Changes Modal */}
      {reviewRec && (
        <div className="brain-modal-overlay" onClick={() => setReviewRec(null)}>
          <div className="brain-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="brain-modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldAlert size={18} style={{ color: "var(--green)" }} />
                Review & Confirm Preventive Measure
              </h3>
              <button className="brain-modal-close-btn" onClick={() => setReviewRec(null)}>
                ×
              </button>
            </div>

            <div>
              <h4 style={{ margin: "0 0 6px", fontSize: "15px", color: "var(--ink)" }}>{reviewRec.title}</h4>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>{reviewRec.description}</p>
            </div>

            {/* Impact Simulation Comparison Box */}
            <div
              className="preventive-comparison-meter"
              style={{
                background: "rgba(22, 163, 74, 0.06)",
                border: "1px solid rgba(22, 163, 74, 0.2)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--muted)" }}>Pre-execution Simulation:</span>
              <span className="comparison-before">
                Current Health: {health.overallScore}%
              </span>
              <ArrowRight size={13} style={{ color: "var(--muted)" }} />
              <span className="comparison-after">
                Projected Health:{" "}
                {Math.min(
                  100,
                  health.overallScore +
                    (reviewRec.riskReductionScore ? Math.round(reviewRec.riskReductionScore / 8) : 6)
                )}
                %
              </span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--green)", fontWeight: 700 }}>
                {reviewRec.riskReductionLabel || "↓ Risk Reduced"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: "8px",
                background: "var(--surface-subtle)",
                padding: "12px 14px",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            >
              <div>
                <strong>Why Recommended:</strong> {reviewRec.whyRecommended}
              </div>
              <div>
                <strong>Scope Affected:</strong> {reviewRec.affectsDescription}
              </div>
              <div>
                <strong>Expected Benefit:</strong> {reviewRec.expectedBenefit}
              </div>
              <div>
                <strong>Possible Risk:</strong> {reviewRec.possibleRisk}
              </div>
              <div>
                <strong>Action Payload:</strong>{" "}
                <code
                  style={{
                    fontSize: "11px",
                    background: "var(--surface)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--line)",
                  }}
                >
                  {JSON.stringify(reviewRec.actionPayload)}
                </code>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button className="rec-review-btn" onClick={() => setReviewRec(null)}>
                Cancel
              </button>
              {canEdit && (
                <button
                  className="rec-apply-btn"
                  onClick={() => handleApplyRecommendation(reviewRec)}
                  disabled={applyingRec}
                >
                  {applyingRec ? "Applying..." : "Confirm & Apply Preventive Measure"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Batch Recommendation Fix Modal */}
      {batchReviewOpen && (
        <div className="brain-modal-overlay" onClick={() => setBatchReviewOpen(false)}>
          <div className="brain-modal-box" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="brain-modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={18} style={{ color: "var(--green)" }} />
                Batch Fix: Apply {batchTargetRecs.length} Action{batchTargetRecs.length > 1 ? "s" : ""} at Once
              </h3>
              <button className="brain-modal-close-btn" onClick={() => setBatchReviewOpen(false)}>
                ×
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
              The following {batchTargetRecs.length} recommended actions will be executed in a single batch to rebalance workloads, resolve schedule congestion, and eliminate delivery risks.
            </p>

            {/* Cumulative Impact Preview */}
            <div
              className="preventive-comparison-meter"
              style={{
                background: "rgba(22, 163, 74, 0.08)",
                border: "1px solid rgba(22, 163, 74, 0.25)",
                padding: "10px 14px",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>Cumulative Projected Health:</span>
              <span className="comparison-before">Current: {health.overallScore}%</span>
              <ArrowRight size={13} style={{ color: "var(--muted)" }} />
              <span className="comparison-after">
                Projected: {Math.min(100, health.overallScore + Math.min(22, batchTargetRecs.length * 5))}%
              </span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--green)", fontWeight: 700 }}>
                Eliminates {batchTargetRecs.length} Risk Trajectories
              </span>
            </div>

            {/* List of items to be applied */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "280px",
                overflowY: "auto",
                padding: "8px",
                background: "var(--surface-subtle)",
                borderRadius: "8px",
                border: "1px solid var(--line)",
              }}
            >
              {batchTargetRecs.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "8px 10px",
                    background: "var(--surface)",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <span style={{ fontWeight: 700, color: "var(--muted)" }}>{idx + 1}.</span>
                    <div>
                      <strong style={{ color: "var(--ink)", display: "block" }}>{item.title}</strong>
                      <span style={{ color: "var(--muted)", fontSize: "11.5px" }}>{item.affectsDescription}</span>
                    </div>
                  </div>
                  {item.riskReductionLabel && (
                    <span className="risk-reduction-tag" style={{ flexShrink: 0 }}>
                      {item.riskReductionLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button className="rec-review-btn" onClick={() => setBatchReviewOpen(false)}>
                Cancel
              </button>
              {canEdit && (
                <button
                  className="batch-fix-all-btn"
                  onClick={() => handleApplyBatch(batchTargetRecs)}
                  disabled={applyingBatch}
                >
                  {applyingBatch
                    ? "Applying All Fixes..."
                    : `Confirm & Fix All (${batchTargetRecs.length}) Now`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Decision Modal */}
      {decisionModalOpen && (
        <div className="brain-modal-overlay" onClick={() => setDecisionModalOpen(false)}>
          <div className="brain-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="brain-modal-header">
              <h3>Record Project Decision</h3>
              <button className="brain-modal-close-btn" onClick={() => setDecisionModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleRecordDecision} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  DECISION TITLE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Choose PostgreSQL over MongoDB for user microservice"
                  value={decisionTitle}
                  onChange={(e) => setDecisionTitle(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  REASON & JUSTIFICATION
                </label>
                <textarea
                  placeholder="Explain why this decision was made and what alternatives were evaluated..."
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  EXPECTED IMPACT
                </label>
                <input
                  type="text"
                  placeholder="Impact on schedule, architecture, or resource assignments..."
                  value={decisionImpact}
                  onChange={(e) => setDecisionImpact(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="rec-review-btn"
                  onClick={() => setDecisionModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rec-apply-btn"
                  disabled={submittingDecision || !decisionTitle.trim()}
                >
                  {submittingDecision ? "Saving..." : "Save Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
