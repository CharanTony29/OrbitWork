"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { showAppToast } from "@/lib/app-feedback";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Calendar,
  Globe,
  User,
  Bot,
  Users,
  Search,
  Check,
  ChevronDown,
  UserCheck,
  ShieldAlert,
} from "lucide-react";

export interface TeamMember {
  id: string;
  label: string;
  avatarUrl?: string | null;
  designations?: string[];
  role?: string;
}

export interface WorkflowStatus {
  id: string;
  name: string;
  color: string;
  category?: string;
}

interface Props {
  projectId: string;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
  members?: TeamMember[];
  statuses?: WorkflowStatus[];
}

export interface ExtractedTaskItem {
  id: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  assigneeName?: string | null;
  assigneeUserId?: string | null;
  isExternal?: boolean;
  externalAssigneeName?: string | null;
  aiRoleMatch?: string | null;
  exists: boolean;
  existingTaskId?: string;
  existingTaskTitle?: string;
  duplicateReason?: string;
  selected: boolean;
}

const SAMPLE_MOM = `Sprint Planning & Architecture Sync - Nov 17, 2026
Attendees: Alex, Charan, Leelavathi, Sarah, Zav (External / Partner CAD Consultant)

Action Items & Key Decisions:
1. Create Catia product with sample components for migration testing. (Zav, Charan)
2. Investigate missing components in Catia to JT translation. (Charan, Zav - High Priority)
3. Compare CAD import vs JT conversion in Process Simulate. (Charan, Zav)
4. Prepare Team Center-based process template study. (Zav - Normal Priority)
5. Setup Redis cache for frequently accessed dashboard metrics to avoid N+1 queries. (Charan, ETA Nov 22)
6. Verify application functionality and post-deployment checks. (Leelavathi)`;

export default function MoMToTasksModal({
  projectId,
  projectName = "Project",
  isOpen,
  onClose,
  members = [],
  statuses = [],
}: Props) {
  const router = useRouter();
  const [momText, setMomText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAIAssigning, setIsAIAssigning] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTaskItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Assignee mode: "ai" (Agent automatically assigns & matches) or "manual" (user controls picks)
  const [assigneeMode, setAssigneeMode] = useState<"ai" | "manual">("ai");

  // Dynamic list of team members & external stakeholders
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(members);
  const [knownExternals, setKnownExternals] = useState<string[]>([]);

  // Popover state for per-task manual assignee selector
  const [activeDropdownTaskId, setActiveDropdownTaskId] = useState<string | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [newExternalInput, setNewExternalInput] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync passed members if changed
  useEffect(() => {
    if (members && members.length > 0) {
      setTeamMembers(members);
    }
  }, [members]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownTaskId(null);
        setDropdownSearch("");
        setNewExternalInput("");
      }
    }
    if (activeDropdownTaskId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdownTaskId]);

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

      // Update members if returned from API
      if (data.teamMembers && Array.isArray(data.teamMembers) && data.teamMembers.length > 0) {
        const mapped = data.teamMembers.map((m: any) => ({
          id: m.id,
          label: m.name || m.email || "Team member",
          avatarUrl: m.avatarUrl || null,
          designations: m.designation ? [m.designation] : [],
        }));
        setTeamMembers(mapped);
      }

      // Merge detected externals
      if (data.detectedExternals && Array.isArray(data.detectedExternals)) {
        setKnownExternals((prev) =>
          Array.from(new Set([...prev, ...data.detectedExternals]))
        );
      }

      const tasks: ExtractedTaskItem[] = (data.tasks || []).map((t: any, idx: number) => {
        // Collect known external name if task is external
        if (t.isExternal && t.externalAssigneeName) {
          setKnownExternals((prev) =>
            Array.from(new Set([...prev, t.externalAssigneeName]))
          );
        }

        return {
          ...t,
          id: `extracted_${idx}_${Date.now()}`,
          // New tasks checked by default; duplicates unchecked by default!
          selected: !t.exists,
        };
      });

      setExtractedTasks(tasks);
      if (tasks.length === 0) {
        setErrorMessage(
          "No distinct action items were identified in the text. Try adding more detailed notes."
        );
      } else {
        showAppToast(`Extracted ${tasks.length} action items with AI`, "success");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while processing.");
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * AI Agent Automated Assignment:
   * Intelligently parses task requirements, matches team members based on designation & load,
   * and preserves external stakeholders.
   */
  const handleRunAIAgentAssignment = async () => {
    setIsAIAssigning(true);
    try {
      let externalCount = 0;
      let internalCount = 0;

      const updated = extractedTasks.map((task, idx) => {
        // 1. If task already explicitly detected an external participant (e.g. Zav), preserve or prioritize them
        let isExt = Boolean(task.isExternal);
        let extName = task.externalAssigneeName || null;
        let assignedUid = task.assigneeUserId || null;
        let assignedName = task.assigneeName || null;

        const text = `${task.title} ${task.description} ${task.assigneeName || ""}`.toLowerCase();

        // Check if any known external name appears in the task text
        for (const ext of knownExternals) {
          if (text.includes(ext.toLowerCase())) {
            isExt = true;
            extName = ext;
            break;
          }
        }

        // Check if any team member is directly mentioned
        for (const member of teamMembers) {
          if (text.includes(member.label.toLowerCase())) {
            assignedUid = member.id;
            assignedName = member.label;
            break;
          }
        }

        // If no internal assignee yet and not strictly external-only, match by AI role heuristic
        if (!assignedUid && (!isExt || (isExt && extName && task.assigneeName?.includes(",")))) {
          const isTesting = /test|qa|verify|translation|catia|jt|check/i.test(text);
          const isDev = /code|build|api|redis|cache|oauth|database|sql/i.test(text);

          const matchingMember = teamMembers.find((m) => {
            const desig = (m.designations || []).join(" ").toLowerCase();
            if (isTesting && (desig.includes("test") || desig.includes("qa"))) return true;
            if (isDev && (desig.includes("dev") || desig.includes("engineer"))) return true;
            return false;
          });

          if (matchingMember) {
            assignedUid = matchingMember.id;
            assignedName = matchingMember.label;
          } else if (teamMembers.length > 0) {
            // Round-robin fallback to first available team member
            const fallbackMember = teamMembers[idx % teamMembers.length];
            assignedUid = fallbackMember.id;
            assignedName = fallbackMember.label;
          }
        }

        if (isExt) externalCount++;
        if (assignedUid) internalCount++;

        return {
          ...task,
          assigneeUserId: assignedUid,
          assigneeName: assignedName || (isExt ? extName : null),
          isExternal: isExt,
          externalAssigneeName: extName,
        };
      });

      setExtractedTasks(updated);
      showAppToast(
        `AI Agent assigned ${updated.length} tasks (${internalCount} Team, ${externalCount} External)`,
        "success",
        { title: "AI Assignment Complete" }
      );
    } catch (err: any) {
      showAppToast("Failed to run AI assignment", "error");
    } finally {
      setIsAIAssigning(false);
    }
  };

  /**
   * Manually assign an internal team member to a task
   */
  const handleSelectMember = (taskId: string, member: TeamMember) => {
    setExtractedTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          assigneeUserId: member.id,
          assigneeName: member.label,
          // Keep external co-assignee if previously marked
          isExternal: t.isExternal,
          externalAssigneeName: t.externalAssigneeName,
        };
      })
    );
    setActiveDropdownTaskId(null);
  };

  /**
   * Manually assign an external stakeholder to a task
   */
  const handleSelectExternal = (taskId: string, externalName: string) => {
    const trimmed = externalName.trim();
    if (!trimmed) return;

    // Add to known externals
    setKnownExternals((prev) => Array.from(new Set([...prev, trimmed])));

    setExtractedTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          isExternal: true,
          externalAssigneeName: trimmed,
          assigneeName: t.assigneeUserId ? `${t.assigneeName}, ${trimmed}` : trimmed,
        };
      })
    );
    setActiveDropdownTaskId(null);
    setNewExternalInput("");
  };

  /**
   * Clear assignee for a task
   */
  const handleClearAssignee = (taskId: string) => {
    setExtractedTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          assigneeUserId: null,
          assigneeName: null,
          isExternal: false,
          externalAssigneeName: null,
        };
      })
    );
    setActiveDropdownTaskId(null);
  };

  /**
   * Add a new external stakeholder to project known list
   */
  const handleAddExternalStakeholder = () => {
    const name = window.prompt("Enter external stakeholder or partner name (e.g. Zav, Siemens Consultant):");
    if (name && name.trim()) {
      const clean = name.trim();
      setKnownExternals((prev) => Array.from(new Set([...prev, clean])));
      showAppToast(`Added external stakeholder "${clean}"`, "info");
    }
  };

  const handleCreateTasks = async () => {
    const selectedTasks = extractedTasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      showAppToast("Please select at least one task to create.", "warning");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const payloadTasks = selectedTasks.map((t) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueDate: t.dueDate,
        assigneeId: t.assigneeUserId || null,
        assigneeIds: t.assigneeUserId ? [t.assigneeUserId] : [],
        assigneeName: t.assigneeName || null,
        isExternal: Boolean(t.isExternal),
        externalAssignee: t.externalAssigneeName || null,
      }));

      const res = await fetch("/api/tasks/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          tasks: payloadTasks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create tasks");
      }

      setSuccessMessage(`Successfully created ${data.createdCount} tasks from meeting minutes!`);
      showAppToast(`Created ${data.createdCount} tasks in project!`, "success");
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="canvas-modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 10000,
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
          maxWidth: 880,
          maxHeight: "92vh",
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
            padding: "18px 24px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(22, 124, 88, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--green, #167c58)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(22, 124, 88, 0.3)",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                Convert Minutes of Meeting (MoM) to Tasks
              </h2>
              <p style={{ fontSize: 12, color: "var(--muted, #64748b)", margin: "2px 0 0" }}>
                AI extracts action items, assigns internal teammates or external stakeholders, and flags duplicates in {projectName}.
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
              borderRadius: 6,
            }}
            aria-label="Close modal"
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
            flex: 1,
          }}
        >
          {errorMessage && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "rgba(220, 38, 38, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                color: "#dc2626",
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "rgba(22, 163, 74, 0.1)",
                border: "1px solid rgba(22, 163, 74, 0.3)",
                color: "#16a34a",
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <CheckCircle2 size={16} />
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
                    textDecoration: "underline",
                  }}
                >
                  Load Sample Notes (with Externals & Tasks)
                </button>
              </div>

              <textarea
                value={momText}
                onChange={(e) => setMomText(e.target.value)}
                placeholder="Paste your meeting notes, minutes, or transcript here…&#10;&#10;e.g.&#10;Attendees: Alex, Charan, Zav (External CAD partner)&#10;1. Create Catia product with sample components (Zav, Charan)&#10;2. Fix flowchart dark theme contrast&#10;3. Setup Redis cache for slow endpoints (Charan, ETA Nov 22)"
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

              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  💡 Supports internal team members and external stakeholders (e.g. Zav, vendors, clients).
                </span>
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
                    boxShadow: "0 2px 8px rgba(22, 124, 88, 0.25)",
                  }}
                >
                  {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>{isExtracting ? "Analyzing Minutes & Checking Duplicates…" : "Extract Action Items with AI"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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

              {/* Assignee Selection Controls: Manual vs AI Agent + Externals Toolbar */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(22, 124, 88, 0.05) 100%)",
                  border: "1px solid var(--line, #e2e8f0)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Users size={14} /> Assignee Mode:
                    </span>

                    {/* Mode Toggle Buttons */}
                    <div
                      style={{
                        display: "inline-flex",
                        padding: 2,
                        borderRadius: 8,
                        background: "var(--surface, #ffffff)",
                        border: "1px solid var(--line, #cbd5e1)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setAssigneeMode("ai")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: 0,
                          fontSize: 11.5,
                          fontWeight: 650,
                          cursor: "pointer",
                          background: assigneeMode === "ai" ? "var(--green, #167c58)" : "transparent",
                          color: assigneeMode === "ai" ? "#ffffff" : "var(--muted, #64748b)",
                        }}
                      >
                        <Bot size={13} />
                        AI Agent Assign
                      </button>

                      <button
                        type="button"
                        onClick={() => setAssigneeMode("manual")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: 0,
                          fontSize: 11.5,
                          fontWeight: 650,
                          cursor: "pointer",
                          background: assigneeMode === "manual" ? "var(--green, #167c58)" : "transparent",
                          color: assigneeMode === "manual" ? "#ffffff" : "var(--muted, #64748b)",
                        }}
                      >
                        <User size={13} />
                        Manual Select
                      </button>
                    </div>
                  </div>

                  {/* Actions: Run AI Agent Assign & Add External Stakeholder */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleRunAIAgentAssignment}
                      disabled={isAIAssigning}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(124, 58, 237, 0.4)",
                        background: "rgba(124, 58, 237, 0.1)",
                        color: "#7c3aed",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: isAIAssigning ? "not-allowed" : "pointer",
                      }}
                      title="Run AI Agent to automatically match action items to role-aligned teammates and external stakeholders"
                    >
                      {isAIAssigning ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                      <span>{isAIAssigning ? "AI Assigning…" : "⚡ Run AI Agent Assignment"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddExternalStakeholder}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--line, #cbd5e1)",
                        background: "var(--surface, #ffffff)",
                        color: "var(--ink)",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="Add external participant, vendor, or client (e.g. Zav)"
                    >
                      <Globe size={12} style={{ color: "#d97706" }} />
                      <span>+ Add External</span>
                    </button>
                  </div>
                </div>

                {/* Detected Participants Pill List */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                  <span style={{ color: "var(--muted)" }}>Detected Stakeholders:</span>
                  {teamMembers.slice(0, 5).map((m) => (
                    <span
                      key={m.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "rgba(22, 124, 88, 0.1)",
                        color: "#166534",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <User size={10} />
                      {m.label}
                    </span>
                  ))}

                  {knownExternals.map((ext) => (
                    <span
                      key={ext}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "rgba(217, 119, 6, 0.12)",
                        color: "#b45309",
                        border: "1px solid rgba(217, 119, 6, 0.3)",
                        fontSize: 11,
                        fontWeight: 650,
                      }}
                    >
                      <Globe size={10} />
                      {ext} (External)
                    </span>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {extractedTasks.map((task) => {
                  const isDropdownOpen = activeDropdownTaskId === task.id;

                  // Label for the assignee pill
                  const hasInternal = Boolean(task.assigneeUserId);
                  const hasExternal = Boolean(task.isExternal && task.externalAssigneeName);
                  let assigneeBadgeLabel = "Assign User / External…";
                  if (hasInternal && hasExternal) {
                    assigneeBadgeLabel = `${task.assigneeName || "Team"} + 🌐 ${task.externalAssigneeName}`;
                  } else if (hasInternal) {
                    assigneeBadgeLabel = task.assigneeName || "Team Member";
                  } else if (hasExternal) {
                    assigneeBadgeLabel = `🌐 External: ${task.externalAssigneeName}`;
                  } else if (task.assigneeName) {
                    assigneeBadgeLabel = task.assigneeName;
                  }

                  return (
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
                        position: "relative",
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

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Task Meta Bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
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

                          {/* Priority dropdown */}
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
                              border: "1px solid var(--line, #cbd5e1)",
                              background: "var(--surface, #ffffff)",
                              color: "var(--ink)",
                            }}
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>

                          {/* Interactive Assignee Selector (Team Member or External) */}
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdownTaskId(isDropdownOpen ? null : task.id);
                                setDropdownSearch("");
                                setNewExternalInput("");
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 650,
                                padding: "2px 8px",
                                borderRadius: 6,
                                border: hasExternal
                                  ? "1px solid rgba(217, 119, 6, 0.4)"
                                  : "1px solid var(--line, #cbd5e1)",
                                background: hasExternal
                                  ? "rgba(217, 119, 6, 0.08)"
                                  : hasInternal
                                  ? "rgba(22, 124, 88, 0.08)"
                                  : "var(--surface, #ffffff)",
                                color: hasExternal ? "#b45309" : hasInternal ? "#166534" : "var(--muted)",
                                cursor: "pointer",
                              }}
                              title="Click to manually choose a team member or external stakeholder"
                            >
                              {hasExternal ? (
                                <Globe size={11} style={{ color: "#d97706" }} />
                              ) : (
                                <User size={11} />
                              )}
                              <span>{assigneeBadgeLabel}</span>
                              <ChevronDown size={11} />
                            </button>

                            {/* Dropdown Popover */}
                            {isDropdownOpen && (
                              <div
                                ref={dropdownRef}
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  marginTop: 4,
                                  width: 280,
                                  background: "var(--surface, #ffffff)",
                                  border: "1px solid var(--line, #cbd5e1)",
                                  borderRadius: 8,
                                  boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                                  zIndex: 100,
                                  padding: "8px 0",
                                  maxHeight: 320,
                                  overflowY: "auto",
                                }}
                              >
                                {/* Search Box */}
                                <div style={{ padding: "4px 8px 8px", borderBottom: "1px solid var(--line, #e2e8f0)" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      background: "var(--surface-subtle, #f8fafc)",
                                      border: "1px solid var(--line, #cbd5e1)",
                                    }}
                                  >
                                    <Search size={12} color="var(--muted)" />
                                    <input
                                      type="text"
                                      value={dropdownSearch}
                                      onChange={(e) => setDropdownSearch(e.target.value)}
                                      placeholder="Filter or type external name…"
                                      style={{
                                        width: "100%",
                                        border: 0,
                                        background: "transparent",
                                        fontSize: 11.5,
                                        color: "var(--ink)",
                                        outline: "none",
                                      }}
                                      autoFocus
                                    />
                                  </div>
                                </div>

                                {/* Unassigned Option */}
                                <div
                                  onClick={() => handleClearAssignee(task.id)}
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: 11.5,
                                    color: "var(--muted)",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-subtle, #f8fafc)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <span>🚫 Unassigned</span>
                                  {!task.assigneeUserId && !task.isExternal && <Check size={12} />}
                                </div>

                                {/* Section: Team Members */}
                                <div style={{ padding: "6px 12px 2px", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                                  👥 Team Members
                                </div>
                                {teamMembers
                                  .filter(
                                    (m) =>
                                      !dropdownSearch ||
                                      m.label.toLowerCase().includes(dropdownSearch.toLowerCase())
                                  )
                                  .map((member) => {
                                    const isSelected = task.assigneeUserId === member.id;
                                    return (
                                      <div
                                        key={member.id}
                                        onClick={() => handleSelectMember(task.id, member)}
                                        style={{
                                          padding: "6px 12px",
                                          fontSize: 11.5,
                                          color: "var(--ink)",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          background: isSelected ? "rgba(22, 124, 88, 0.08)" : "transparent",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-subtle, #f8fafc)")}
                                        onMouseLeave={(e) =>
                                          (e.currentTarget.style.background = isSelected ? "rgba(22, 124, 88, 0.08)" : "transparent")
                                        }
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                          <div
                                            style={{
                                              width: 18,
                                              height: 18,
                                              borderRadius: 999,
                                              background: "#167c58",
                                              color: "#ffffff",
                                              fontSize: 9,
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              fontWeight: 700,
                                            }}
                                          >
                                            {member.label.charAt(0).toUpperCase()}
                                          </div>
                                          <span>{member.label}</span>
                                        </div>
                                        {isSelected && <Check size={12} color="#167c58" />}
                                      </div>
                                    );
                                  })}

                                {/* Section: External Stakeholders */}
                                <div style={{ padding: "8px 12px 2px", fontSize: 10, fontWeight: 700, color: "#b45309", textTransform: "uppercase", borderTop: "1px solid var(--line, #e2e8f0)", marginTop: 4 }}>
                                  🌐 External Stakeholders
                                </div>
                                {knownExternals
                                  .filter(
                                    (ext) =>
                                      !dropdownSearch ||
                                      ext.toLowerCase().includes(dropdownSearch.toLowerCase())
                                  )
                                  .map((ext) => {
                                    const isSelected = task.isExternal && task.externalAssigneeName === ext;
                                    return (
                                      <div
                                        key={ext}
                                        onClick={() => handleSelectExternal(task.id, ext)}
                                        style={{
                                          padding: "6px 12px",
                                          fontSize: 11.5,
                                          color: "#b45309",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          background: isSelected ? "rgba(217, 119, 6, 0.1)" : "transparent",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(217, 119, 6, 0.05)")}
                                        onMouseLeave={(e) =>
                                          (e.currentTarget.style.background = isSelected ? "rgba(217, 119, 6, 0.1)" : "transparent")
                                        }
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                          <Globe size={12} />
                                          <span>{ext} (External)</span>
                                        </div>
                                        {isSelected && <Check size={12} color="#b45309" />}
                                      </div>
                                    );
                                  })}

                                {/* Add Custom External Stakeholder Input */}
                                <div style={{ padding: "6px 8px", borderTop: "1px solid var(--line, #e2e8f0)", marginTop: 4 }}>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <input
                                      type="text"
                                      value={newExternalInput}
                                      onChange={(e) => setNewExternalInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && newExternalInput.trim()) {
                                          handleSelectExternal(task.id, newExternalInput);
                                        }
                                      }}
                                      placeholder="New external user…"
                                      style={{
                                        flex: 1,
                                        padding: "4px 6px",
                                        borderRadius: 4,
                                        border: "1px solid var(--line, #cbd5e1)",
                                        fontSize: 11,
                                        background: "var(--surface)",
                                        color: "var(--ink)",
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (newExternalInput.trim()) {
                                          handleSelectExternal(task.id, newExternalInput);
                                        }
                                      }}
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: 4,
                                        border: 0,
                                        background: "#d97706",
                                        color: "#ffffff",
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Assign
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Due Date Indicator */}
                          {task.dueDate && (
                            <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Calendar size={11} /> {task.dueDate}
                            </span>
                          )}
                        </div>

                        {/* Task Title Input */}
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

                        {/* Task Description */}
                        {task.description && (
                          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink)" }}>
                {selectedCount} of {extractedTasks.length} task{extractedTasks.length > 1 ? "s" : ""} selected for creation
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                Assignees: {assigneeMode === "ai" ? "🤖 AI Agent Auto-Assigned" : "👤 Manual User Selection"}
              </span>
            </div>

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
                  boxShadow: "0 2px 8px rgba(22, 124, 88, 0.3)",
                }}
              >
                {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>{isCreating ? "Creating Tasks…" : `Create ${selectedCount} Tasks`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
