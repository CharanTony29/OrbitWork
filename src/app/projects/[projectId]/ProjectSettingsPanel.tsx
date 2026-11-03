"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, X, GitBranch, Users, Columns } from "lucide-react";
import {
  addProjectMember,
  createCustomField,
  createProjectStatus,
  deleteProjectStatus,
  removeProjectMember,
  updateProjectMemberRole,
  updateProjectStatus,
} from "@/app/actions";

type Status = { id: string; name: string; color: string; category: string };
type Member = { id: string; label: string };
type ProjectMember = { user_id: string; role: string };
type CustomField = { id: string; name: string; field_type: string; required?: boolean };

type Panel = "statuses" | "members" | "fields" | null;

const MENU_ITEMS: { panel: Panel; label: string; icon: React.ReactNode }[] = [
  { panel: "statuses", label: "Workflow statuses", icon: <GitBranch size={14} /> },
  { panel: "members", label: "Project members", icon: <Users size={14} /> },
  { panel: "fields", label: "Custom fields", icon: <Columns size={14} /> },
];

export default function ProjectSettingsPanel({
  projectId,
  statuses,
  members,
  projectMembers,
  customFields,
  people,
  availableMembers,
}: {
  projectId: string;
  statuses: Status[];
  members: Member[];
  projectMembers: ProjectMember[];
  customFields: CustomField[];
  people: Map<string, string>;
  availableMembers: Member[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

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
            {MENU_ITEMS.map(({ panel, label, icon }) => (
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

      {/* Modal overlay */}
      {activePanel && (
        <div className="proj-modal-overlay" onClick={closePanel}>
          <div
            className="proj-modal"
            role="dialog"
            aria-modal="true"
            aria-label={MENU_ITEMS.find((i) => i.panel === activePanel)?.label}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="proj-modal-head">
              <h2>{MENU_ITEMS.find((i) => i.panel === activePanel)?.label}</h2>
              <button className="proj-modal-close" aria-label="Close" onClick={closePanel}>
                <X size={16} />
              </button>
            </div>

            <div className="proj-modal-body">
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
            </div>
          </div>
        </div>
      )}
    </>
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
  return (
    <div className="admin-panel-section">
      <form action={createCustomField} className="admin-field-form">
        <input type="hidden" name="projectId" value={projectId} />
        <input name="name" placeholder="Field name" maxLength={80} required />
        <select name="fieldType" defaultValue="text">
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
        <input name="options" placeholder="Options for dropdowns, comma separated" />
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
