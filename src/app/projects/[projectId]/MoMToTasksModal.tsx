"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Plus,
  Trash2,
  Calendar,
  Check,
} from "lucide-react";

interface Props {
  projectId: string;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ExtractedTaskItem {
  id: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  assigneeName?: string | null;
  exists: boolean;
  existingTaskId?: string;
  existingTaskTitle?: string;
  duplicateReason?: string;
  selected: boolean;
}

const SAMPLE_MOM = `Sprint Planning & Architecture Sync - Nov 17, 2026
Attendees: Alex, Charan, Leelavathi, Sarah

Action Items & Key Decisions:
1. Setup Redis cache for frequently accessed dashboard metrics to avoid N+1 queries. (Charan, ETA Nov 22)
2. Verify application functionality and post-deployment checks. (Leelavathi)
3. Implement dark theme flowchart contrast fixes for Visio diagram canvas. (High Priority)
4. Build Minutes of Meeting (MoM) to Tasks automated AI conversion with duplicate detection. (Urgent)
5. Add PPT presentation templates and custom corporate deck styles.
6. Conduct security audit for database connection pooling and SSL encryption.`;

export default function MoMToTasksModal({
  projectId,
  projectName = "Project",
  isOpen,
  onClose,
}: Props) {
  const router = useRouter();
  const [momText, setMomText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTaskItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExtract = async () => {
    if (!momText.trim()) return;
    setIsExtracting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/ai/mom-to-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, momText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze meeting minutes");
      }

      const tasks: ExtractedTaskItem[] = (data.tasks || []).map((t: any, idx: number) => ({
        ...t,
        id: `extracted_${idx}_${Date.now()}`,
        // New tasks checked by default; duplicates unchecked by default!
        selected: !t.exists,
      }));

      setExtractedTasks(tasks);
      if (tasks.length === 0) {
        setErrorMessage("No distinct action items were identified in the text. Try adding more detailed notes.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while processing.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCreateTasks = async () => {
    const selectedTasks = extractedTasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      alert("Please select at least one task to create.");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tasks/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          tasks: selectedTasks.map((t) => ({
            title: t.title,
            description: t.description,
            priority: t.priority,
            dueDate: t.dueDate,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create tasks");
      }

      setSuccessMessage(`Successfully created ${data.createdCount} tasks from meeting minutes!`);
      setTimeout(() => {
        router.refresh();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to insert tasks.");
      setIsCreating(false);
    }
  };

  const selectedCount = extractedTasks.filter((t) => t.selected).length;
  const duplicateCount = extractedTasks.filter((t) => t.exists).length;
  const newCount = extractedTasks.filter((t) => !t.exists).length;

  return (
    <div
      className="canvas-modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 99999,
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="canvas-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          background: "var(--surface, #ffffff)",
          color: "var(--ink, #17231f)",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 24px 50px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(22, 124, 88, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--green, #167c58)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Convert Minutes of Meeting (MoM) to Tasks
              </h2>
              <p style={{ fontSize: 12, color: "var(--muted, #64748b)", margin: "2px 0 0" }}>
                AI extracts action items, assigns priorities, and flags duplicates against existing tasks in {projectName}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--muted, #64748b)",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {errorMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                color: "#dc2626",
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertTriangle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(22, 163, 74, 0.1)",
                border: "1px solid rgba(22, 163, 74, 0.3)",
                color: "#16a34a",
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle2 size={15} />
              <span>{successMessage}</span>
            </div>
          )}

          {extractedTasks.length === 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                  Paste Meeting Notes / Transcript
                </label>
                <button
                  type="button"
                  onClick={() => setMomText(SAMPLE_MOM)}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--green, #167c58)",
                    fontSize: 12,
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  Load Sample Notes
                </button>
              </div>

              <textarea
                value={momText}
                onChange={(e) => setMomText(e.target.value)}
                placeholder="Paste your meeting notes, minutes, or transcript here…&#10;&#10;e.g.&#10;1. John to configure OAuth login by Friday&#10;2. Fix flowchart dark theme contrast&#10;3. Set up Redis caching for slow endpoints"
                rows={11}
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid var(--line, #cbd5e1)",
                  background: "var(--surface-subtle, #f8fafc)",
                  color: "var(--ink)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                }}
              />

              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!momText.trim() || isExtracting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 22px",
                    borderRadius: 8,
                    border: 0,
                    background: "var(--green, #167c58)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: momText.trim() && !isExtracting ? "pointer" : "not-allowed",
                    opacity: momText.trim() && !isExtracting ? 1 : 0.6,
                  }}
                >
                  {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>{isExtracting ? "Analyzing Minutes & Checking Duplicates…" : "Extract Action Items with AI"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Summary Stats Pill Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--surface-subtle, #f8fafc)",
                  border: "1px solid var(--line, #e2e8f0)",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                    Extracted Action Items ({extractedTasks.length})
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(22, 163, 74, 0.15)",
                      color: "#16a34a",
                    }}
                  >
                    ✨ {newCount} New
                  </span>
                  {duplicateCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(217, 119, 6, 0.15)",
                        color: "#d97706",
                      }}
                    >
                      ⚠️ {duplicateCount} Duplicate{duplicateCount > 1 ? "s" : ""} Checked
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExtractedTasks([])}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--muted)",
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  ← Edit Notes Text
                </button>
              </div>

              {/* Items List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {extractedTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: task.exists
                        ? "1px solid rgba(217, 119, 6, 0.4)"
                        : "1px solid var(--line, #e2e8f0)",
                      background: task.exists
                        ? "rgba(217, 119, 6, 0.04)"
                        : "var(--surface-subtle, #f8fafc)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={task.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setExtractedTasks((prev) =>
                          prev.map((t) => (t.id === task.id ? { ...t, selected: checked } : t))
                        );
                      }}
                      style={{ marginTop: 4, cursor: "pointer", width: 16, height: 16 }}
                      title={task.exists ? "Duplicate task - unchecked by default" : "Select task to create"}
                    />

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        {task.exists ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "rgba(217, 119, 6, 0.15)",
                              color: "#b45309",
                              border: "1px solid rgba(217, 119, 6, 0.3)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <AlertTriangle size={11} />
                            Duplicate: {task.existingTaskTitle ? `Matches "${task.existingTaskTitle}"` : "Already Exists"}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "rgba(22, 163, 74, 0.15)",
                              color: "#166534",
                              border: "1px solid rgba(22, 163, 74, 0.3)",
                            }}
                          >
                            ✨ New Action Item
                          </span>
                        )}

                        <select
                          value={task.priority}
                          onChange={(e) => {
                            const val = e.target.value as ExtractedTaskItem["priority"];
                            setExtractedTasks((prev) =>
                              prev.map((t) => (t.id === task.id ? { ...t, priority: val } : t))
                            );
                          }}
                          style={{
                            fontSize: 11,
                            fontWeight: 650,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                            background: "var(--surface)",
                            color: "var(--ink)",
                          }}
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>

                        {task.assigneeName && (
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            👤 {task.assigneeName}
                          </span>
                        )}

                        {task.dueDate && (
                          <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <Calendar size={11} /> {task.dueDate}
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExtractedTasks((prev) =>
                            prev.map((t) => (t.id === task.id ? { ...t, title: val } : t))
                          );
                        }}
                        style={{
                          width: "100%",
                          fontSize: 13,
                          fontWeight: 650,
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--line, #cbd5e1)",
                          background: "var(--surface, #ffffff)",
                          color: "var(--ink)",
                          marginBottom: 4,
                        }}
                      />

                      {task.description && (
                        <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {extractedTasks.length > 0 && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--line, #e2e8f0)",
              background: "var(--surface-subtle, #f8fafc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {selectedCount} of {extractedTasks.length} task{extractedTasks.length > 1 ? "s" : ""} selected for creation
            </span>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--line, #cbd5e1)",
                  background: "transparent",
                  color: "var(--ink)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTasks}
                disabled={selectedCount === 0 || isCreating}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: 0,
                  background: "var(--green, #167c58)",
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: selectedCount > 0 && !isCreating ? "pointer" : "not-allowed",
                  opacity: selectedCount > 0 && !isCreating ? 1 : 0.6,
                }}
              >
                {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>{isCreating ? "Creating Tasks…" : `Create ${selectedCount} Tasks`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
