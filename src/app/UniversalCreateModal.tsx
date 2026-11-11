"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Minimize2,
  Calendar,
  User,
  Flag,
  Tag,
  Paperclip,
  Bell,
  ChevronDown,
  Plus,
  Loader2,
  Layers,
  FileText,
  Clock,
  Check,
  Sparkles,
} from "lucide-react";
import { createCustomFieldFromComposer, createTask, quickCreateProjectDocument } from "@/app/actions";
import DateInput from "@/app/DateInput";

type StatusItem = { id: string; name: string; color: string; category?: string };
type MemberItem = { id: string; label: string };
const TASK_TYPES = [
  ["task", "Task"],
  ["improvement", "Improvement"],
  ["enhancement", "Enhancement"],
  ["bug", "Bug"],
  ["defect", "Defect"],
  ["error", "Error"],
  ["issue", "Issue"],
  ["milestone", "Milestone"],
  ["epic", "Epic"],
  ["story", "Story"],
  ["subtask", "Subtask"],
  ["support_request", "Support request"],
  ["research", "Research"],
] as const;
type TaskType = (typeof TASK_TYPES)[number][0];

function formatTime12h(timeStr: string) {
  if (!timeStr) return "9:00 AM";
  const parts = timeStr.split(":");
  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export default function UniversalCreateModal({
  isOpen,
  onClose,
  initialTab = "task",
  projectId,
  projectName = "OrbitWork Application",
  statuses = [],
  members = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "task" | "doc" | "reminder" | "whiteboard" | "dashboard";
  projectId?: string;
  projectName?: string;
  statuses?: StatusItem[];
  members?: MemberItem[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"task" | "doc" | "reminder" | "whiteboard" | "dashboard">(initialTab);

  // Task form state
  const [taskName, setTaskName] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [selectedStatusId, setSelectedStatusId] = useState(statuses[0]?.id || "");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [taskType, setTaskType] = useState<TaskType>("task");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showTaskTypeMenu, setShowTaskTypeMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showFieldCreator, setShowFieldCreator] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [fieldCreatorPending, setFieldCreatorPending] = useState(false);
  const [fieldCreatorMessage, setFieldCreatorMessage] = useState("");

  // Reminder form state (Screenshot 2)
  const [reminderName, setReminderName] = useState("");
  const [reminderDesc, setReminderDesc] = useState("");
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().slice(0, 10));
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderNotifyOption, setReminderNotifyOption] = useState("At time of event");
  const [sendEmailReminder, setSendEmailReminder] = useState(true);

  // Dropdown menus
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showNotifyMenu, setShowNotifyMenu] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 80);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStatusObj = statuses.find((s) => s.id === selectedStatusId) || statuses[0];

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || submitting || !projectId) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("title", taskName.trim());
      const fullTaskDesc = [taskDesc.trim(), dueTime ? `Due time: ${formatTime12h(dueTime)}` : ""].filter(Boolean).join("\n\n");
      if (fullTaskDesc) fd.set("description", fullTaskDesc);
      fd.set("statusId", selectedStatusId || statuses[0]?.id || "");
      fd.set("priority", priority);
      fd.set("taskType", taskType);
      if (dueDate) fd.set("dueDate", dueDate);
      for (const tag of tags) fd.append("tags", tag);
      for (const uid of selectedAssignees) {
        fd.append("assigneeIds", uid);
      }

      await createTask(fd);
      onClose();
      router.refresh();
    } catch (err) {
      console.error("Failed to create task", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderName.trim() || submitting || !projectId) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("projectId", projectId);
      const formattedTime = formatTime12h(reminderTime);
      fd.set("title", `⏰ Reminder: ${reminderName.trim()} (${formattedTime})`);
      const desc = `${reminderDesc ? reminderDesc + "\n\n" : ""}Schedule: ${reminderDate} at ${formattedTime} (${reminderTime}) · Notice: ${reminderNotifyOption}${sendEmailReminder ? " · Email reminder enabled" : ""}`;
      fd.set("description", desc);
      fd.set("statusId", statuses[0]?.id || "");
      fd.set("priority", "high");
      fd.set("dueDate", reminderDate);
      if (members[0]?.id) {
        fd.append("assigneeIds", members[0].id);
      }

      await createTask(fd);
      onClose();
      router.refresh();
    } catch (err) {
      console.error("Failed to create reminder", err);
    } finally {
      setSubmitting(false);
    }
  };

  const addTag = () => {
    const nextTag = tagInput.trim().replace(/[,;]+$/, "").slice(0, 40);
    if (!nextTag) return;
    setTags((current) => current.some((tag) => tag.toLowerCase() === nextTag.toLowerCase()) ? current : [...current, nextTag].slice(0, 20));
    setTagInput("");
  };

  const handleCreateField = async () => {
    if (!projectId || !newFieldName.trim() || fieldCreatorPending) return;
    setFieldCreatorPending(true);
    setFieldCreatorMessage("");
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("name", newFieldName.trim());
    formData.set("fieldType", newFieldType);
    formData.set("options", newFieldOptions);
    if (newFieldRequired) formData.set("required", "on");
    try {
      const result = await createCustomFieldFromComposer(formData);
      setFieldCreatorMessage(result.message);
      if (result.ok) {
        setNewFieldName("");
        setNewFieldOptions("");
        setNewFieldRequired(false);
        setShowFieldCreator(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Could not create custom field", error);
      setFieldCreatorMessage("Could not create that field. Try again.");
    } finally {
      setFieldCreatorPending(false);
    }
  };

  return (
    <div
      className="universal-create-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="universal-create-modal"
        style={{
          width: 620,
          maxWidth: "100%",
          maxHeight: "92vh",
          backgroundColor: "var(--surface)",
          color: "var(--ink)",
          borderRadius: 14,
          border: "1px solid var(--line)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Tabs (Matches Screenshots 2 & 3) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px 0",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", gap: 24, fontSize: 13, fontWeight: 600 }}>
            {(["task", "doc", "reminder", "whiteboard", "dashboard"] as const).map((tab) => {
              const label = tab.charAt(0).toUpperCase() + tab.slice(1);
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "0 0 10px",
                    border: 0,
                    background: "transparent",
                    color: isActive ? "var(--ink)" : "var(--muted)",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    borderBottom: isActive ? "2px solid var(--green)" : "2px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--muted)",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {/* TAB 1: TASK (Screenshot 3) */}
          {activeTab === "task" && (
            <form onSubmit={handleTaskSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Location Selector Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--surface-raised)",
                    fontSize: 11.5,
                    color: "var(--ink)",
                    fontWeight: 600,
                  }}
                >
                  <Layers size={13} color="var(--green)" />
                  <span>{projectName}</span>
                  <ChevronDown size={11} color="var(--muted)" />
                </span>

                <div className="composer-popover-anchor">
                  <button
                    type="button"
                    className="composer-pill-button"
                    aria-haspopup="menu"
                    aria-expanded={showTaskTypeMenu}
                    onClick={() => setShowTaskTypeMenu((open) => !open)}
                  >
                    <span className="composer-pill-dot" />
                    <span>{TASK_TYPES.find(([value]) => value === taskType)?.[1] ?? "Task"}</span>
                    <ChevronDown size={11} />
                  </button>
                  {showTaskTypeMenu && (
                    <div className="composer-popover composer-task-type-menu" role="menu" aria-label="Task type">
                      {TASK_TYPES.map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={taskType === value}
                          className={taskType === value ? "is-selected" : ""}
                          onClick={() => {
                            setTaskType(value);
                            setShowTaskTypeMenu(false);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Title Input */}
              <input
                ref={titleInputRef}
                className="composer-minimal-input"
                type="text"
                placeholder="Task Name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                required
                maxLength={240}
                style={{
                  width: "100%",
                  fontSize: 19,
                  fontWeight: 700,
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  padding: "6px 0",
                }}
              />

              {/* Task Description Input */}
              <textarea
                className="composer-minimal-input"
                placeholder="Add description, or write with AI..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
              />

              {/* Quick Attribute Pills (TO DO, Assignee, Due date, Priority, Tags) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
                {/* Status Pill */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 11px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: currentStatusObj?.color ? `${currentStatusObj.color}22` : "var(--surface-subtle)",
                      color: currentStatusObj?.color || "var(--ink)",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span>{currentStatusObj?.name?.toUpperCase() || "TO DO"}</span>
                    <ChevronDown size={11} />
                  </button>
                  {showStatusMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        zIndex: 100,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 4,
                        minWidth: 150,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      }}
                    >
                      {statuses.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedStatusId(st.id);
                            setShowStatusMenu(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "6px 10px",
                            border: 0,
                            borderRadius: 5,
                            background: "transparent",
                            color: "var(--ink)",
                            fontSize: 11.5,
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
                          <span>{st.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assignee Pill */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setShowAssigneeMenu((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 11px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: selectedAssignees.length ? "var(--green)" : "var(--muted)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <User size={12} />
                    <span>{selectedAssignees.length ? `${selectedAssignees.length} assigned` : "Assignee"}</span>
                  </button>
                  {showAssigneeMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        zIndex: 100,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 6,
                        minWidth: 180,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      }}
                    >
                      {members.map((m) => {
                        const isAssigned = selectedAssignees.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedAssignees((prev) =>
                                isAssigned ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                              );
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              padding: "6px 8px",
                              border: 0,
                              borderRadius: 5,
                              background: isAssigned ? "rgba(22, 163, 74, 0.15)" : "transparent",
                              color: isAssigned ? "var(--green)" : "var(--ink)",
                              fontSize: 11.5,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <span>{m.label}</span>
                            {isAssigned && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Due Date & Time Pill */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 11px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: dueDate ? "var(--green)" : "var(--muted)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Calendar size={12} />
                    <span>
                      {dueDate
                        ? `${dueDate}${dueTime ? ` (${formatTime12h(dueTime)})` : ""}`
                        : "Due date"}
                    </span>
                  </button>
                  {showDatePicker && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        zIndex: 100,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 10,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        minWidth: 200,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Due Date & Time</div>
                      <DateInput
                        value={dueDate}
                        ariaLabel="Due date"
                        onChange={(value) => setDueDate(value)}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={12} color="var(--muted)" />
                        <input
                          type="time"
                          value={dueTime}
                          onChange={(e) => setDueTime(e.target.value)}
                          style={{
                            background: "var(--surface-subtle)",
                            color: "var(--ink)",
                            border: "1px solid var(--line)",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            flex: 1,
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        style={{
                          alignSelf: "flex-end",
                          background: "var(--green)",
                          color: "#fff",
                          border: 0,
                          borderRadius: 4,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Set
                      </button>
                    </div>
                  )}
                </div>

                {/* Priority Pill */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setShowPriorityMenu((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 11px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: priority === "urgent" ? "#ef4444" : priority === "high" ? "#f59e0b" : "var(--muted)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Flag size={12} />
                    <span>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                  </button>
                  {showPriorityMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        zIndex: 100,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 4,
                        minWidth: 120,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      }}
                    >
                      {(["low", "normal", "high", "urgent"] as const).map((pr) => (
                        <button
                          key={pr}
                          type="button"
                          onClick={() => {
                            setPriority(pr);
                            setShowPriorityMenu(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "6px 10px",
                            border: 0,
                            borderRadius: 5,
                            background: "transparent",
                            color: "var(--ink)",
                            fontSize: 11.5,
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <Flag size={11} color={pr === "urgent" ? "#ef4444" : pr === "high" ? "#f59e0b" : "var(--muted)"} />
                          <span>{pr.charAt(0).toUpperCase() + pr.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="composer-popover-anchor">
                  <button
                    type="button"
                    className="composer-pill-button"
                    aria-haspopup="dialog"
                    aria-expanded={showTagMenu}
                    onClick={() => setShowTagMenu((open) => !open)}
                  >
                    <Tag size={12} />
                    <span>Tags{tags.length ? ` · ${tags.length}` : ""}</span>
                    <ChevronDown size={11} />
                  </button>
                  {showTagMenu && (
                    <div className="composer-popover composer-tag-menu" role="dialog" aria-label="Add task tags">
                      <div className="composer-tag-list">
                        {tags.map((tag) => (
                          <span className="composer-tag-chip" key={tag}>
                            {tag}
                            <button type="button" aria-label={`Remove ${tag} tag`} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>×</button>
                          </span>
                        ))}
                      </div>
                      <div className="composer-tag-entry">
                        <input
                          value={tagInput}
                          maxLength={40}
                          placeholder="Type a tag and press Enter"
                          aria-label="New task tag"
                          onChange={(event) => setTagInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === ",") {
                              event.preventDefault();
                              addTag();
                            }
                          }}
                        />
                        <button type="button" className="composer-action-button" onClick={addTag} disabled={!tagInput.trim()}>Add</button>
                      </div>
                      <p className="composer-popover-hint">Up to 20 tags, 40 characters each.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fields Section (Screenshot 3) */}
              <div className="composer-field-section">
                <div className="composer-section-label">
                  FIELDS
                </div>
                <button
                  type="button"
                  className="composer-pill-button"
                  onClick={() => {
                    setShowFieldCreator((open) => !open);
                    setFieldCreatorMessage("");
                  }}
                  disabled={!projectId}
                  title={!projectId ? "Open a project to create project fields" : "Create a project field"}
                >
                  <Plus size={13} />
                  <span>Create new field</span>
                </button>
                {fieldCreatorMessage && <p className="composer-field-message" role="status">{fieldCreatorMessage}</p>}
                {showFieldCreator && projectId && (
                  <div className="composer-field-creator">
                    <input
                      value={newFieldName}
                      onChange={(event) => setNewFieldName(event.target.value)}
                      placeholder="Field name"
                      maxLength={80}
                      aria-label="Custom field name"
                    />
                    <select value={newFieldType} onChange={(event) => setNewFieldType(event.target.value)} aria-label="Custom field type">
                      <option value="text">Short text</option>
                      <option value="long_text">Long text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="multi_select">Multi-select</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    {["dropdown", "multi_select"].includes(newFieldType) && (
                      <input
                        value={newFieldOptions}
                        onChange={(event) => setNewFieldOptions(event.target.value)}
                        placeholder="Options, comma separated"
                        maxLength={1000}
                        aria-label="Field options"
                      />
                    )}
                    <label className="composer-required-toggle">
                      <input type="checkbox" checked={newFieldRequired} onChange={(event) => setNewFieldRequired(event.target.checked)} />
                      Required
                    </label>
                    <div className="composer-field-actions">
                      <button type="button" className="composer-action-button secondary" onClick={() => setShowFieldCreator(false)}>Cancel</button>
                      <button type="button" className="composer-action-button" onClick={handleCreateField} disabled={!newFieldName.trim() || fieldCreatorPending}>
                        {fieldCreatorPending ? "Creating…" : "Add field"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Bar (Screenshot 3) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <button
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--surface-raised)",
                    color: "var(--ink)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Sparkles size={13} />
                  <span>Templates</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    style={{ background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer" }}
                    title="Attach file"
                  >
                    <Paperclip size={15} />
                  </button>

                  <button
                    type="button"
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer", fontSize: 11.5 }}
                    title="Watchers / Reminders"
                  >
                    <Bell size={15} />
                    <span>1</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!taskName.trim() || submitting}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: 0,
                      backgroundColor: "var(--green)",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: taskName.trim() ? "pointer" : "not-allowed",
                      opacity: taskName.trim() ? 1 : 0.6,
                    }}
                  >
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <span>Create Task</span>}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REMINDER (Screenshot 2) */}
          {activeTab === "reminder" && (
            <form onSubmit={handleReminderSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Reminder Name Input (Screenshot 2) */}
              <input
                ref={titleInputRef}
                className="composer-minimal-input"
                type="text"
                placeholder="Reminder name or type '/' for commands"
                value={reminderName}
                onChange={(e) => setReminderName(e.target.value)}
                required
                style={{
                  width: "100%",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  padding: "6px 0",
                }}
              />

              {/* Reminder Description */}
              <textarea
                className="composer-minimal-input"
                placeholder="Add description"
                value={reminderDesc}
                onChange={(e) => setReminderDesc(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
              />

              {/* Pills: [ Today ], [ 9:00 AM ], [ For me ], [ Notify me ] (Screenshot 2) */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
                {/* Date Picker Pill */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDatePicker((v) => !v);
                      setShowTimePicker(false);
                      setShowNotifyMenu(false);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: "var(--ink)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Calendar size={13} color="var(--green)" />
                    <span>{reminderDate === new Date().toISOString().slice(0, 10) ? "Today" : reminderDate}</span>
                  </button>
                  {showDatePicker && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 200,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: 12,
                        minWidth: 220,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Select Date</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setReminderDate(new Date().toISOString().slice(0, 10));
                            setShowDatePicker(false);
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                            background: "var(--surface-subtle)",
                            color: "var(--ink)",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const tom = new Date(Date.now() + 86400000);
                            setReminderDate(tom.toISOString().slice(0, 10));
                            setShowDatePicker(false);
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                            background: "var(--surface-subtle)",
                            color: "var(--ink)",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Tomorrow
                        </button>
                      </div>
                      <DateInput
                        value={reminderDate}
                        ariaLabel="Reminder date"
                        onChange={(value) => {
                          setReminderDate(value);
                        }}
                      />
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                          <Clock size={12} color="var(--green)" />
                          <span>Reminder Time:</span>
                        </span>
                        <input
                          type="time"
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          style={{
                            background: "var(--surface-subtle)",
                            color: "var(--ink)",
                            border: "1px solid var(--line)",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        style={{
                          marginTop: 6,
                          width: "100%",
                          padding: "5px 0",
                          background: "var(--green)",
                          color: "#fff",
                          border: 0,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Set Date &amp; Time
                      </button>
                    </div>
                  )}
                </div>

                {/* Time Picker Pill */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTimePicker((v) => !v);
                      setShowDatePicker(false);
                      setShowNotifyMenu(false);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: "var(--ink)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    title="Set reminder time"
                  >
                    <Clock size={13} color="var(--green)" />
                    <span>{formatTime12h(reminderTime)}</span>
                    <ChevronDown size={11} color="var(--muted)" />
                  </button>
                  {showTimePicker && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 200,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: 12,
                        minWidth: 240,
                        boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Select Time</div>
                      {/* Presets Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {[
                          { label: "9:00 AM (Morning)", val: "09:00" },
                          { label: "12:00 PM (Noon)", val: "12:00" },
                          { label: "2:00 PM (Afternoon)", val: "14:00" },
                          { label: "5:00 PM (Evening)", val: "17:00" },
                          { label: "8:00 PM (Night)", val: "20:00" },
                          { label: "10:00 PM (Late)", val: "22:00" },
                        ].map((t) => (
                          <button
                            key={t.val}
                            type="button"
                            onClick={() => {
                              setReminderTime(t.val);
                              setShowTimePicker(false);
                            }}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: `1px solid ${reminderTime === t.val ? "var(--green)" : "var(--line)"}`,
                              background: reminderTime === t.val ? "color-mix(in srgb, var(--green) 20%, transparent)" : "var(--surface-subtle)",
                              color: reminderTime === t.val ? "var(--green)" : "var(--ink)",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom Exact Time Input */}
                      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Or pick custom time:</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                            style={{
                              background: "var(--surface-subtle)",
                              color: "var(--ink)",
                              border: "1px solid var(--line)",
                              padding: "5px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              flex: 1,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowTimePicker(false)}
                            style={{
                              padding: "6px 12px",
                              background: "var(--green)",
                              color: "#fff",
                              border: 0,
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* For Me Pill */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--surface-raised)",
                    color: "var(--ink)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <User size={13} color="var(--green)" />
                  <span>For me</span>
                </span>

                {/* Notify Me Pill */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifyMenu((v) => !v);
                      setShowDatePicker(false);
                      setShowTimePicker(false);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      color: "var(--ink)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Bell size={13} color="var(--green)" />
                    <span>{reminderNotifyOption}</span>
                    <ChevronDown size={11} color="var(--muted)" />
                  </button>
                  {showNotifyMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 200,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 4,
                        minWidth: 180,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      }}
                    >
                      {["At time of event", "5 min before", "10 min before", "30 min before", "1 hour before", "1 day before"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setReminderNotifyOption(opt);
                            setShowNotifyMenu(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            padding: "6px 10px",
                            border: 0,
                            borderRadius: 5,
                            background: "transparent",
                            color: "var(--ink)",
                            fontSize: 11.5,
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Email Reminder Checkbox */}
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  id="sendEmailReminder"
                  checked={sendEmailReminder}
                  onChange={(e) => setSendEmailReminder(e.target.checked)}
                  style={{ accentColor: "var(--green)" }}
                />
                <label htmlFor="sendEmailReminder" style={{ cursor: "pointer" }}>
                  Send email reminder notification at scheduled time
                </label>
              </div>

              {/* Footer Bar (Screenshot 2) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 20,
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <button
                  type="button"
                  style={{ background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer" }}
                  title="Attach file"
                >
                  <Paperclip size={15} />
                </button>

                <button
                  type="submit"
                  disabled={!reminderName.trim() || submitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: 0,
                    backgroundColor: "var(--green)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: reminderName.trim() ? "pointer" : "not-allowed",
                    opacity: reminderName.trim() ? 1 : 0.6,
                  }}
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <span>Create Reminder</span>}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: DOC */}
          {activeTab === "doc" && (
            <div style={{ padding: "10px 0", textAlign: "center", color: "var(--ink)" }}>
              <FileText size={32} color="var(--green)" style={{ margin: "0 auto 10px" }} />
              <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>Create a Document</h4>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
                Start a blank document or draft with full rich-text tools.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (projectId) router.push(`/projects/${projectId}/documents`);
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: 0,
                  backgroundColor: "var(--green)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Open Documents
              </button>
            </div>
          )}

          {/* TAB 4: WHITEBOARD */}
          {activeTab === "whiteboard" && (
            <div style={{ padding: "10px 0", textAlign: "center", color: "var(--ink)" }}>
              <Layers size={32} color="var(--green)" style={{ margin: "0 auto 10px" }} />
              <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>Open Whiteboard</h4>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
                Brainstorm, draw diagrams, and connect workflow ideas.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (projectId) router.push(`/projects/${projectId}?view=whiteboard`);
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: 0,
                  backgroundColor: "var(--green)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Launch Whiteboard
              </button>
            </div>
          )}

          {/* TAB 5: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div style={{ padding: "10px 0", textAlign: "center", color: "var(--ink)" }}>
              <Layers size={32} color="var(--green)" style={{ margin: "0 auto 10px" }} />
              <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>All Dashboards &amp; Workspaces</h4>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
                Navigate back to overview and your organization workspaces.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/dashboard");
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: 0,
                  backgroundColor: "var(--green)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
