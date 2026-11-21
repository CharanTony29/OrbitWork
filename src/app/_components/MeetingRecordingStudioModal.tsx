"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Video,
  FileText,
  CheckSquare,
  Sparkles,
  Upload,
  X,
  Loader2,
  Check,
  Copy,
  AlertTriangle,
  Calendar,
  User,
  ArrowRight,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { showAppToast } from "@/lib/app-feedback";
import type { TranscribedMoMOutput, ExtractedMeetingTask } from "@/app/api/ai/meeting-transcribe/route";

interface MeetingRecordingStudioModalProps {
  projectId?: string;
  workspaceId?: string;
  open?: boolean;
  onClose?: () => void;
}

export default function MeetingRecordingStudioModal({
  projectId: initialProjectId,
  workspaceId: initialWorkspaceId,
  open: externalOpen,
  onClose: externalOnClose,
}: MeetingRecordingStudioModalProps) {
  const [isOpen, setIsOpen] = useState(externalOpen ?? false);
  const [activeTab, setActiveTab] = useState<"upload" | "mom" | "tasks" | "transcript">("upload");

  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId || "");

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>("");

  // Output states
  const [transcript, setTranscript] = useState<string>("");
  const [mom, setMom] = useState<TranscribedMoMOutput | null>(null);
  const [tasks, setTasks] = useState<ExtractedMeetingTask[]>([]);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external open state
  useEffect(() => {
    if (externalOpen !== undefined) setIsOpen(externalOpen);
  }, [externalOpen]);

  // Global event listener to open meeting studio from anywhere
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string; workspaceId?: string }>).detail;
      if (detail?.projectId) setProjectId(detail.projectId);
      setIsOpen(true);
    };
    window.addEventListener("orbitwork:open-meeting-studio", handleOpen);
    return () => window.removeEventListener("orbitwork:open-meeting-studio", handleOpen);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (externalOnClose) externalOnClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!meetingTitle) {
        const cleanName = selected.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setMeetingTitle(cleanName);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      if (!meetingTitle) {
        const cleanName = dropped.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setMeetingTitle(cleanName);
      }
    }
  };

  const handleProcessRecording = async () => {
    if (!file && !transcriptText.trim()) {
      showAppToast(
        "Please upload an audio/video recording or paste meeting notes.",
        "warning",
        { title: "Input required" }
      );
      return;
    }

    setIsProcessing(true);
    setProcessStep(file ? "Uploading recording & extracting audio…" : "Analyzing meeting text…");

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (transcriptText.trim()) formData.append("transcriptText", transcriptText.trim());
      if (projectId) formData.append("projectId", projectId);
      formData.append("meetingTitle", meetingTitle.trim() || "Meeting");

      setProcessStep("Transcribing audio and generating separate MoM + Tasks…");

      const res = await fetch("/api/ai/meeting-transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process meeting recording");
      }

      setTranscript(data.transcript || "");
      setMom(data.mom || null);
      const extractedTasks = (data.tasks || []) as ExtractedMeetingTask[];
      setTasks(extractedTasks);

      // By default select all non-duplicate tasks
      const initialSelected = new Set<number>();
      extractedTasks.forEach((t, i) => {
        if (!t.exists) initialSelected.add(i);
      });
      setSelectedTaskIndices(initialSelected);

      setActiveTab("mom");
      showAppToast(
        `Extracted MoM summary and ${extractedTasks.length} action items.`,
        "success",
        { title: "Meeting processed!" }
      );
    } catch (err: any) {
      showAppToast(
        err.message || "An unexpected error occurred while transcribing.",
        "error",
        { title: "Processing failed" }
      );
    } finally {
      setIsProcessing(false);
      setProcessStep("");
    }
  };

  const handleSaveMoMToDocs = async () => {
    if (!mom || !projectId) {
      showAppToast(
        "Please select a target project to save the MoM document.",
        "warning",
        { title: "Select project" }
      );
      return;
    }

    setIsSavingDoc(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `MoM: ${mom.title} (${mom.date || new Date().toISOString().slice(0, 10)})`,
          description: mom.summary.slice(0, 200),
          icon: "📝",
        }),
      });

      if (!res.ok) throw new Error("Failed to save document");

      showAppToast(
        "Minutes of Meeting document created in Project Docs.",
        "success",
        { title: "Saved to Documents" }
      );
    } catch (err: any) {
      showAppToast(
        err.message || "Could not save document",
        "error",
        { title: "Save failed" }
      );
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleCreateSelectedTasks = async () => {
    if (selectedTaskIndices.size === 0 || !projectId) {
      showAppToast(
        "Please select at least one task and ensure a project is selected.",
        "warning",
        { title: "Selection required" }
      );
      return;
    }

    setIsCreatingTasks(true);
    try {
      const tasksToCreate = Array.from(selectedTaskIndices).map((idx) => {
        const t = tasks[idx];
        return {
          title: t.title,
          description: t.description,
          priority: t.priority,
          dueDate: t.dueDate,
        };
      });

      const res = await fetch("/api/tasks/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          tasks: tasksToCreate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create tasks");

      showAppToast(
        `Successfully created ${data.createdCount} tasks in the project.`,
        "success",
        { title: "Tasks Created!" }
      );
      handleClose();
    } catch (err: any) {
      showAppToast(
        err.message || "Failed to create tasks",
        "error",
        { title: "Creation failed" }
      );
    } finally {
      setIsCreatingTasks(false);
    }
  };

  const toggleTaskSelection = (idx: number) => {
    setSelectedTaskIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2100,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: "min(100%, 820px)",
          maxHeight: "88vh",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: "14px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            background: "var(--app-bg, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
              }}
            >
              <Video size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--ink, #1e293b)" }}>
                Meeting Studio: Audio to MoM &amp; Tasks
              </h2>
              <small style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                Upload Zoom/Teams recording or paste transcript
              </small>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              border: 0,
              background: "transparent",
              color: "var(--muted, #64748b)",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Studio Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            background: "var(--surface, #ffffff)",
          }}
        >
          <button
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "7px",
              border: "1px solid " + (activeTab === "upload" ? "var(--green, #10b981)" : "transparent"),
              background: activeTab === "upload" ? "rgba(16, 185, 129, 0.1)" : "transparent",
              color: activeTab === "upload" ? "var(--green, #059669)" : "var(--muted, #64748b)",
              fontSize: "12px",
              fontWeight: activeTab === "upload" ? 700 : 500,
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("upload")}
          >
            <Upload size={14} /> Upload &amp; Transcribe
          </button>

          <button
            type="button"
            disabled={!mom}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "7px",
              border: "1px solid " + (activeTab === "mom" ? "#0284c7" : "transparent"),
              background: activeTab === "mom" ? "rgba(2, 132, 199, 0.1)" : "transparent",
              color: activeTab === "mom" ? "#0284c7" : "var(--muted, #64748b)",
              fontSize: "12px",
              fontWeight: activeTab === "mom" ? 700 : 500,
              cursor: mom ? "pointer" : "not-allowed",
              opacity: mom ? 1 : 0.5,
            }}
            onClick={() => setActiveTab("mom")}
          >
            <FileText size={14} /> Minutes of Meeting (MoM)
          </button>

          <button
            type="button"
            disabled={tasks.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "7px",
              border: "1px solid " + (activeTab === "tasks" ? "#7e22ce" : "transparent"),
              background: activeTab === "tasks" ? "rgba(126, 34, 206, 0.1)" : "transparent",
              color: activeTab === "tasks" ? "#7e22ce" : "var(--muted, #64748b)",
              fontSize: "12px",
              fontWeight: activeTab === "tasks" ? 700 : 500,
              cursor: tasks.length ? "pointer" : "not-allowed",
              opacity: tasks.length ? 1 : 0.5,
            }}
            onClick={() => setActiveTab("tasks")}
          >
            <CheckSquare size={14} /> Action Items &amp; Tasks ({tasks.length})
          </button>

          {transcript && (
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: "1px solid " + (activeTab === "transcript" ? "var(--line)" : "transparent"),
                background: activeTab === "transcript" ? "var(--app-bg)" : "transparent",
                color: "var(--muted, #64748b)",
                fontSize: "12px",
                fontWeight: activeTab === "transcript" ? 700 : 500,
                cursor: "pointer",
              }}
              onClick={() => setActiveTab("transcript")}
            >
              Transcript
            </button>
          )}
        </div>

        {/* Tab 1: Upload & Transcribe Content */}
        {activeTab === "upload" && (
          <div style={{ padding: "20px", display: "grid", gap: "16px", overflowY: "auto" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                Meeting Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Sprint Planning or Customer Feedback Sync"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #e2e8f0)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>

            {/* Drag & drop upload area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--line, #cbd5e1)",
                borderRadius: "10px",
                padding: "24px 16px",
                textAlign: "center",
                background: "var(--app-bg, #f8fafc)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*,.mp4,.m4a,.mp3,.wav,.webm,.mov"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <Video size={28} style={{ color: "var(--green, #10b981)", margin: "0 auto 8px" }} />
              <strong style={{ display: "block", fontSize: "13px", color: "var(--ink, #1e293b)" }}>
                {file ? file.name : "Click or drop Zoom / Teams recording here"}
              </strong>
              <small style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>
                Supports MP4, WebM, MOV video or MP3, M4A, WAV audio files
              </small>
            </div>

            {/* Text area fallback */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                Or paste meeting transcript / notes / captions:
              </label>
              <textarea
                rows={5}
                placeholder="Paste verbatim transcript, VTT captions, or raw notes from your Zoom/Teams meeting…"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #e2e8f0)",
                  fontSize: "12px",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleProcessRecording}
                disabled={isProcessing || (!file && !transcriptText.trim())}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: 0,
                  background: "linear-gradient(135deg, var(--green, #10b981) 0%, #059669 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isProcessing || (!file && !transcriptText.trim()) ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                  opacity: isProcessing || (!file && !transcriptText.trim()) ? 0.6 : 1,
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>{processStep || "Processing..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Transcribe &amp; Generate MoM + Tasks</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Minutes of Meeting (MoM) */}
        {activeTab === "mom" && mom && (
          <div style={{ padding: "20px", display: "grid", gap: "16px", overflowY: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: "10px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)" }}>{mom.title}</h3>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                  Date: {mom.date} {mom.attendees?.length ? `• Attendees: ${mom.attendees.join(", ")}` : ""}
                </small>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(mom.markdown);
                    showAppToast("MoM markdown copied to clipboard.", "success", { title: "Copied!" });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Copy size={12} /> Copy Markdown
                </button>

                {projectId && (
                  <button
                    type="button"
                    onClick={handleSaveMoMToDocs}
                    disabled={isSavingDoc}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: 0,
                      background: "var(--green, #10b981)",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isSavingDoc ? <Loader2 size={12} className="spin" /> : <FileText size={12} />}
                    Save to Project Documents
                  </button>
                )}
              </div>
            </div>

            {/* Executive Summary */}
            <div style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--app-bg)" }}>
              <strong style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>
                Executive Summary
              </strong>
              <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.6, color: "var(--ink)" }}>
                {mom.summary}
              </p>
            </div>

            {/* Key Decisions */}
            {mom.keyDecisions?.length > 0 && (
              <div>
                <strong style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>
                  Key Decisions Made:
                </strong>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--ink)" }}>
                  {mom.keyDecisions.map((dec, i) => (
                    <li key={i} style={{ marginBottom: "4px" }}>
                      {dec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Discussion Topics */}
            {mom.discussionTopics?.length > 0 && (
              <div style={{ display: "grid", gap: "8px" }}>
                <strong style={{ fontSize: "12px" }}>Discussion Topics &amp; Notes:</strong>
                {mom.discussionTopics.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "7px",
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
                      {item.topic}
                    </span>
                    <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.5 }}>
                      {item.notes}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Action Items & Tasks */}
        {activeTab === "tasks" && (
          <div style={{ padding: "20px", display: "grid", gap: "14px", overflowY: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: "10px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <strong style={{ fontSize: "13px" }}>Extracted Tasks from Call</strong>
                <small style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                  Select the tasks you want to create in Orbitwork.
                </small>
              </div>

              {projectId && (
                <button
                  type="button"
                  onClick={handleCreateSelectedTasks}
                  disabled={isCreatingTasks || selectedTaskIndices.size === 0}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "7px",
                    border: 0,
                    background: "var(--green, #10b981)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: selectedTaskIndices.size === 0 ? "not-allowed" : "pointer",
                    opacity: selectedTaskIndices.size === 0 ? 0.6 : 1,
                  }}
                >
                  {isCreatingTasks ? (
                    <Loader2 size={13} className="spin" />
                  ) : (
                    <CheckSquare size={13} />
                  )}
                  Create {selectedTaskIndices.size} Selected Task
                  {selectedTaskIndices.size === 1 ? "" : "s"} in Project
                </button>
              )}
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              {tasks.map((task, idx) => {
                const isSelected = selectedTaskIndices.has(idx);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid " + (isSelected ? "var(--green, #10b981)" : "var(--line)"),
                      background: isSelected ? "rgba(16, 185, 129, 0.04)" : "var(--surface)",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleTaskSelection(idx)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTaskSelection(idx)}
                      style={{ marginTop: "3px", cursor: "pointer" }}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "12.5px", color: "var(--ink)" }}>{task.title}</strong>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                            background:
                              task.priority === "urgent"
                                ? "#fee2e2"
                                : task.priority === "high"
                                ? "#ffedd5"
                                : "#e0f2fe",
                            color:
                              task.priority === "urgent"
                                ? "#b91c1c"
                                : task.priority === "high"
                                ? "#c2410c"
                                : "#0369a1",
                          }}
                        >
                          {task.priority}
                        </span>

                        {task.exists && (
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              color: "#d97706",
                              background: "#fef3c7",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <AlertTriangle size={9} /> Possible Duplicate
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "var(--muted)" }}>
                          {task.description}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginTop: "6px",
                          fontSize: "11px",
                          color: "var(--muted)",
                        }}
                      >
                        {task.assigneeName && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <User size={11} /> Assignee: {task.assigneeName}
                          </span>
                        )}
                        {task.dueDate && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Calendar size={11} /> Due: {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Transcript View */}
        {activeTab === "transcript" && (
          <div style={{ padding: "20px", overflowY: "auto" }}>
            <strong style={{ display: "block", fontSize: "12px", marginBottom: "8px" }}>
              Full Meeting Transcript / Spoken Dialogue:
            </strong>
            <pre
              style={{
                margin: 0,
                padding: "14px",
                borderRadius: "8px",
                background: "var(--app-bg)",
                border: "1px solid var(--line)",
                fontFamily: "monospace",
                fontSize: "11.5px",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                color: "var(--ink)",
              }}
            >
              {transcript}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
