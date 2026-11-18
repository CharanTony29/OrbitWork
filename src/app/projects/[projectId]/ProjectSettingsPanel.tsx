"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Settings, X, GitBranch, Users, Columns, Archive, RotateCcw, Pencil, Receipt, Trash2, AlertTriangle } from "lucide-react";
import {
  addProjectMember,
  createCustomField,
  createProjectStatus,
  deleteProject,
  deleteProjectStatus,
  removeProjectMember,
  updateProjectMemberRole,
  updateProjectStatus,
  toggleProjectActiveStatus,
  updateProjectDetails,
  updateProjectBilling,
} from "@/app/actions";
import MultiValueFieldInput from "@/app/MultiValueFieldInput";

type Status = { id: string; name: string; color: string; category: string };
type Member = { id: string; label: string };
type ProjectMember = { user_id: string; role: string };
type CustomField = { id: string; name: string; field_type: string; required?: boolean };

type Panel = "details" | "statuses" | "members" | "fields" | "status" | "billing" | null;

export default function ProjectSettingsPanel({
  projectId,
  statuses,
  members,
  projectMembers,
  customFields,
  people,
  availableMembers,
  currentStatus = "active",
  projectName = "",
  projectDescription = "",
  projectIcon = "📁",
  startDate = "",
  dueDate = "",
  poNumber = "",
  clientName = "",
  budgetAmount = "",
  billingNotes = "",
  canManage = false,
}: {
  projectId: string;
  statuses: Status[];
  members: Member[];
  projectMembers: ProjectMember[];
  customFields: CustomField[];
  people: Map<string, string>;
  availableMembers: Member[];
  currentStatus?: string;
  projectName?: string;
  projectDescription?: string;
  projectIcon?: string;
  startDate?: string;
  dueDate?: string;
  poNumber?: string;
  clientName?: string;
  budgetAmount?: string;
  billingNotes?: string;
  canManage?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const menuItems: { panel: Panel; label: string; icon: React.ReactNode }[] = [
    { panel: "details", label: "Project name & timeline", icon: <Pencil size={14} /> },
    { panel: "statuses", label: "Workflow statuses", icon: <GitBranch size={14} /> },
    { panel: "members", label: "Project members", icon: <Users size={14} /> },
    { panel: "fields", label: "Custom fields", icon: <Columns size={14} /> },
    { panel: "status", label: "Project status & archive", icon: <Archive size={14} /> },
    ...(canManage
      ? [{ panel: "billing" as Panel, label: "PO & Billing details", icon: <Receipt size={14} /> }]
      : []),
  ];

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  function openPanel(panel: Panel) {
    setActivePanel(panel);
    setMenuOpen(false);
  }

  function closePanel() {
    setActivePanel(null);
  }

  return (
    <>
      {/* Settings gear button */}
      <div className="proj-settings-wrap">
        <button
          ref={btnRef}
          className="proj-settings-btn"
          aria-label="Project settings"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Settings size={15} />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div ref={menuRef} className="proj-settings-menu" role="menu">
            <p className="proj-settings-menu-title">Project settings</p>
            {menuItems.map(({ panel, label, icon }) => (
              <button
                key={panel}
                className="proj-settings-menu-item"
                role="menuitem"
                onClick={() => openPanel(panel)}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal overlay portaled to body so background view tabs never overlay it */}
      {activePanel && typeof document !== "undefined" && createPortal(
        <div className="proj-modal-overlay" onClick={closePanel}>
          <div
            className="proj-modal"
            role="dialog"
            aria-modal="true"
            aria-label={menuItems.find((i) => i.panel === activePanel)?.label}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="proj-modal-head">
              <h2>{menuItems.find((i) => i.panel === activePanel)?.label}</h2>
              <button className="proj-modal-close" aria-label="Close" onClick={closePanel}>
                <X size={16} />
              </button>
            </div>

            <div className="proj-modal-body">
              {activePanel === "details" && (
                <ProjectDetailsPanel
                  projectId={projectId}
                  initialName={projectName}
                  initialDescription={projectDescription}
                  initialIcon={projectIcon}
                  initialStartDate={startDate}
                  initialDueDate={dueDate}
                />
              )}
              {activePanel === "statuses" && (
                <StatusesPanel projectId={projectId} statuses={statuses} />
              )}
              {activePanel === "members" && (
                <MembersPanel
                  projectId={projectId}
                  projectMembers={projectMembers}
                  availableMembers={availableMembers}
                  people={people}
                />
              )}
              {activePanel === "fields" && (
                <FieldsPanel projectId={projectId} customFields={customFields} />
              )}
              {activePanel === "status" && (
                <StatusPanel
                  projectId={projectId}
                  projectName={projectName}
                  currentStatus={currentStatus}
                  canManage={canManage}
                />
              )}
              {activePanel === "billing" && canManage && (
                <ProjectBillingPanel
                  projectId={projectId}
                  initialPoNumber={poNumber}
                  initialClientName={clientName}
                  initialBudgetAmount={budgetAmount}
                  initialBillingNotes={billingNotes}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ── Project Status & Archive ────────────────────────── */
function StatusPanel({
  projectId,
  projectName,
  currentStatus,
  canManage,
}: {
  projectId: string;
  projectName: string;
  currentStatus: string;
  canManage: boolean;
}) {
  const isInactive = currentStatus === "archived" || currentStatus === "on_hold";
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const canConfirmDelete =
    Boolean(projectName.trim()) &&
    confirmDeleteName.trim().toLowerCase() === projectName.trim().toLowerCase();

  return (
    <div className="admin-panel-section" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--soft, #f8fafc)", border: "1px solid var(--line, #e2e8f0)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
          Current Project State
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`project-state state-${currentStatus}`} style={{ fontSize: 13, padding: "3px 10px" }}>
            {currentStatus === "archived" ? "Inactive (Archived)" : currentStatus.replace("_", " ").toUpperCase()}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {isInactive
              ? "This project is currently inactive and hidden from active views."
              : "This project is active and available to team members."}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Change Project State</h4>
        <form action={toggleProjectActiveStatus} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="hidden" name="projectId" value={projectId} />
          {isInactive ? (
            <>
              <input type="hidden" name="status" value="active" />
              <button
                type="submit"
                className="button button-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <RotateCcw size={14} />
                <span>Reactivate Project</span>
              </button>
            </>
          ) : (
            <>
              <input type="hidden" name="status" value="archived" />
              <button
                type="submit"
                className="button button-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  borderColor: "#f59e0b",
                  color: "#b45309",
                }}
              >
                <Archive size={14} />
                <span>Make Project Inactive (Archive)</span>
              </button>
            </>
          )}
        </form>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
          When made inactive, tasks, documents, and time entries are safely preserved, and the project can be reactivated at any time from workspace settings.
        </p>
      </div>

      {canManage && (
        <div
          style={{
            marginTop: 4,
            padding: 14,
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "rgba(239, 68, 68, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#dc2626", fontWeight: 700, fontSize: 13 }}>
            <AlertTriangle size={15} />
            <span>Danger Zone — Permanently Delete Project</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            Permanently delete <strong>{projectName || "this project"}</strong> and all its tasks, comments,
            documents, and time logs. This cannot be undone.
          </p>
          <form action={deleteProject} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="projectId" value={projectId} />
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 600 }}>
              <span>Type <strong>{projectName}</strong> to confirm deletion:</span>
              <input
                type="text"
                name="confirmName"
                value={confirmDeleteName}
                onChange={(e) => setConfirmDeleteName(e.target.value)}
                placeholder={projectName}
                required
                style={{
                  height: 36,
                  padding: "0 10px",
                  borderRadius: 7,
                  border: "1px solid #fca5a5",
                  background: "var(--paper, #fff)",
                  color: "var(--ink)",
                  fontSize: 12.5,
                }}
              />
            </label>
            <div>
              <button
                type="submit"
                disabled={!canConfirmDelete}
                className="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  background: canConfirmDelete ? "#dc2626" : "#f1f5f9",
                  color: canConfirmDelete ? "#fff" : "#94a3b8",
                  border: "1px solid " + (canConfirmDelete ? "#b91c1c" : "#e2e8f0"),
                  cursor: canConfirmDelete ? "pointer" : "not-allowed",
                }}
              >
                <Trash2 size={14} />
                <span>Delete Project Permanently</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


/* ── Workflow Statuses ─────────────────────────────── */
function StatusesPanel({ projectId, statuses }: { projectId: string; statuses: Status[] }) {
  return (
    <div className="admin-panel-section">
      <form action={createProjectStatus} className="admin-create-form">
        <input type="hidden" name="projectId" value={projectId} />
        <input name="name" placeholder="New status name" maxLength={40} required />
        <input type="color" name="color" defaultValue="#87938b" aria-label="Status color" />
        <select name="category" defaultValue="not_started">
          <option value="not_started">Not started</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="mini-save">Add status</button>
      </form>
      <div className="admin-rows-list">
        {statuses.map((status) => (
          <div className="admin-row" key={status.id}>
            <form action={updateProjectStatus} className="status-settings-form">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="statusId" value={status.id} />
              <input name="name" defaultValue={status.name} maxLength={40} required aria-label={`Status name ${status.name}`} />
              <input type="color" name="color" defaultValue={status.color} aria-label={`Color for ${status.name}`} />
              <select name="category" defaultValue={status.category} aria-label={`Category for ${status.name}`}>
                <option value="not_started">Not started</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="mini-save">Save</button>
            </form>
            <form action={deleteProjectStatus}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="statusId" value={status.id} />
              <button className="mini-remove" aria-label={`Delete ${status.name}`}>×</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Project Members ───────────────────────────────── */
function MembersPanel({
  projectId,
  projectMembers,
  availableMembers,
  people,
}: {
  projectId: string;
  projectMembers: ProjectMember[];
  availableMembers: Member[];
  people: Map<string, string>;
}) {
  return (
    <div className="admin-panel-section">
      <form action={addProjectMember} className="admin-create-form">
        <input type="hidden" name="projectId" value={projectId} />
        <select name="userId" required disabled={!availableMembers.length}>
          <option value="">{availableMembers.length ? "Choose a teammate" : "All organization members are added"}</option>
          {availableMembers.map((member) => (
            <option key={member.id} value={member.id}>{member.label}</option>
          ))}
        </select>
        <select name="role" defaultValue="member">
          <option value="manager">Manager</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
        <button className="mini-save" disabled={!availableMembers.length}>Add member</button>
      </form>
      <div className="admin-rows-list">
        {projectMembers.length ? (
          projectMembers.map((member) => (
            <div className="member-row" key={member.user_id}>
              <span className="assignee-avatar">{(people.get(member.user_id) ?? "T")[0].toUpperCase()}</span>
              <strong>{people.get(member.user_id) ?? "Team member"}</strong>
              <form action={updateProjectMemberRole} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="userId" value={member.user_id} />
                <select name="role" defaultValue={member.role} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button type="submit" className="mini-save" style={{ fontSize: 11, padding: '2px 6px' }}>Update</button>
              </form>
              <form action={removeProjectMember}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="userId" value={member.user_id} />
                <button className="mini-remove" aria-label={`Remove ${people.get(member.user_id) ?? "member"}`}>×</button>
              </form>
            </div>
          ))
        ) : (
          <p className="muted small">No explicit project members yet. Workspace managers can still manage this project.</p>
        )}
      </div>
    </div>
  );
}

/* ── Custom Fields ─────────────────────────────────── */
function FieldsPanel({ projectId, customFields }: { projectId: string; customFields: CustomField[] }) {
  const [fieldType, setFieldType] = useState("text");

  return (
    <div className="admin-panel-section">
      <form action={createCustomField} className="admin-field-form">
        <input type="hidden" name="projectId" value={projectId} />
        <input name="name" placeholder="Field name" maxLength={80} required />
        <select name="fieldType" value={fieldType} onChange={(e) => setFieldType(e.target.value)}>
          <option value="text">Short text</option>
          <option value="long_text">Long text</option>
          <option value="number">Number</option>
          <option value="currency">Currency</option>
          <option value="date">Date</option>
          <option value="datetime">Date and time</option>
          <option value="dropdown">Dropdown</option>
          <option value="multi_select">Multi-select</option>
          <option value="checkbox">Checkbox</option>
          <option value="email">Email</option>
          <option value="url">URL</option>
          <option value="rating">Rating</option>
          <option value="progress">Progress</option>
          <option value="duration">Duration</option>
        </select>
        {["dropdown", "multi_select"].includes(fieldType) && (
          <div className="admin-field-options">
            <MultiValueFieldInput
              name="options"
              placeholder="Option name"
              addLabel="Add option"
              required
            />
          </div>
        )}
        <label className="required-field-option">
          <input type="checkbox" name="required" /> Required
        </label>
        <button className="mini-save">Add custom field</button>
      </form>
      <div className="admin-rows-list">
        {customFields.map((field) => (
          <div className="field-row" key={field.id}>
            <strong>{field.name}{field.required ? " *" : ""}</strong>
            <span>{field.field_type.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Project Details & Icon ────────────────────────── */
const EMOJI_OPTIONS = ["📁", "🚀", "⚡", "🎯", "📊", "🛠️", "💻", "💡", "🔥", "🌟", "📦", "🎨", "🌐", "🔒", "🤖", "📈", "🧪", "📑"];

function ProjectDetailsPanel({
  projectId,
  initialName,
  initialDescription,
  initialIcon = "📁",
  initialStartDate = "",
  initialDueDate = "",
}: {
  projectId: string;
  initialName: string;
  initialDescription: string;
  initialIcon?: string;
  initialStartDate?: string;
  initialDueDate?: string;
}) {
  const [selectedIcon, setSelectedIcon] = useState(initialIcon || "📁");

  return (
    <div className="proj-panel-content">
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
        Managers and owners can rename the project, configure timeline start &amp; target due dates, update description, and customize the project icon.
      </p>

      <form action={updateProjectDetails} className="admin-create-form" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="icon" value={selectedIcon} />

        {/* Icon Picker */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>
            Project Icon &amp; Badge
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedIcon(emoji)}
                style={{
                  width: 34,
                  height: 34,
                  fontSize: 18,
                  borderRadius: 8,
                  border: selectedIcon === emoji ? "2px solid var(--green, #167c58)" : "1px solid var(--line)",
                  background: selectedIcon === emoji ? "rgba(22, 124, 88, 0.12)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Or custom emoji:</span>
            <input
              type="text"
              value={selectedIcon}
              onChange={(e) => setSelectedIcon(e.target.value.slice(0, 4))}
              style={{
                width: 60,
                textAlign: "center",
                fontSize: 16,
                padding: "3px 6px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>

        {/* Project Name */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
            Project Name *
          </label>
          <input
            type="text"
            name="name"
            defaultValue={initialName}
            required
            minLength={2}
            maxLength={120}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13,
              fontWeight: 600,
            }}
          />
        </div>

        {/* Start Date & Due Date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              defaultValue={initialStartDate}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
              Target Due Date
            </label>
            <input
              type="date"
              name="dueDate"
              defaultValue={initialDueDate}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Project Description */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
            Project Description
          </label>
          <textarea
            name="description"
            defaultValue={initialDescription}
            rows={3}
            maxLength={2000}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        <button
          type="submit"
          className="mini-save"
          style={{
            alignSelf: "flex-start",
            padding: "8px 20px",
            background: "var(--green, #167c58)",
            color: "#ffffff",
            fontWeight: 700,
            borderRadius: 8,
            border: 0,
            cursor: "pointer",
          }}
        >
          Save Project Changes
        </button>
      </form>
    </div>
  );
}

/* ── Project PO & Billing Details Panel ───────────────────────── */
function ProjectBillingPanel({
  projectId,
  initialPoNumber,
  initialClientName,
  initialBudgetAmount,
  initialBillingNotes,
}: {
  projectId: string;
  initialPoNumber: string;
  initialClientName: string;
  initialBudgetAmount: string;
  initialBillingNotes: string;
}) {
  return (
    <div className="proj-panel-content" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        Configure Purchase Order (PO) references, client information, budget allocations, and contractual billing notes. Strictly restricted to Workspace Managers and Owners.
      </p>

      <form action={updateProjectBilling} className="admin-create-form" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="projectId" value={projectId} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
              Purchase Order (PO) Number
            </label>
            <input
              type="text"
              name="poNumber"
              defaultValue={initialPoNumber}
              placeholder="e.g. PO-2026-9482"
              maxLength={100}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 600,
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
              Client / Enterprise Name
            </label>
            <input
              type="text"
              name="clientName"
              defaultValue={initialClientName}
              placeholder="e.g. Siemens PLM / Ford Corp"
              maxLength={150}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 600,
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
            Project Budget ($ USD)
          </label>
          <input
            type="number"
            step="0.01"
            name="budgetAmount"
            defaultValue={initialBudgetAmount}
            placeholder="e.g. 50000.00"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13,
              fontWeight: 600,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
            Billing Notes &amp; Payment Terms
          </label>
          <textarea
            name="billingNotes"
            defaultValue={initialBillingNotes}
            placeholder="e.g. Net-30 payment terms upon completion of milestone deliverables..."
            rows={3}
            maxLength={2000}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        <button
          type="submit"
          className="mini-save"
          style={{
            alignSelf: "flex-start",
            padding: "8px 20px",
            background: "var(--green, #167c58)",
            color: "#ffffff",
            fontWeight: 700,
            borderRadius: 8,
            border: 0,
            cursor: "pointer",
          }}
        >
          Save Billing Details
        </button>
      </form>
    </div>
  );
}
