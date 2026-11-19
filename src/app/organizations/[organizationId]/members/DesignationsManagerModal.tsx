"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Briefcase, X, Plus, Shield, Layers, Trash2 } from "lucide-react";
import { createOrganizationDesignation, deleteOrganizationDesignation } from "@/app/actions";
import { DEFAULT_DESIGNATIONS, type OrganizationDesignation } from "@/lib/designations";

export default function DesignationsManagerModal({
  organizationId,
  organizationName,
  customDesignations = [],
  canManage = false,
}: {
  organizationId: string;
  organizationName: string;
  customDesignations: OrganizationDesignation[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Combine default system designations and custom org designations
  const allDesignations = [
    ...DEFAULT_DESIGNATIONS.map((d) => ({ ...d, isDefault: true })),
    ...customDesignations.map((d) => ({ ...d, isDefault: false })),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button button-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "7px 12px",
          fontSize: "12px",
          fontWeight: 600,
          borderRadius: "7px",
          cursor: "pointer",
        }}
        title="Manage Zoho-style designations & role hierarchy"
      >
        <Briefcase size={14} style={{ color: "var(--green, #167c58)" }} />
        <span>Manage Designations &amp; Roles</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="proj-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="designations-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{ zIndex: 9999 }}
        >
          <div className="proj-modal" style={{ maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="proj-modal-head" style={{ borderBottom: "1px solid var(--line, #e2e8f0)", paddingBottom: "12px" }}>
              <div>
                <h2 id="designations-modal-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, margin: 0 }}>
                  <Briefcase size={18} style={{ color: "var(--green, #167c58)" }} />
                  Designations &amp; Organizational Roles
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "var(--muted, #64748b)" }}>
                  Define organization hierarchy (C-Suite, HR, Engineering, Testing, Support) for {organizationName}.
                </p>
              </div>
              <button
                type="button"
                className="proj-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "grid", gap: "16px" }}>
              {/* Header with Add Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink, #1f2d26)" }}>
                    Active Organization Roles ({allDesignations.length})
                  </span>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                    Teammates can be assigned multiple designations (e.g. Developer + Tester, HR + Manager).
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="button button-primary"
                    style={{ fontSize: "11.5px", padding: "5px 11px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Plus size={13} />
                    <span>{showAddForm ? "Cancel" : "Add Custom Role"}</span>
                  </button>
                )}
              </div>

              {/* Add Custom Designation Form */}
              {showAddForm && canManage && (
                <form
                  action={async (formData) => {
                    setIsPending(true);
                    try {
                      await createOrganizationDesignation(formData);
                      setShowAddForm(false);
                    } finally {
                      setIsPending(false);
                    }
                  }}
                  style={{
                    padding: "14px",
                    background: "var(--soft, #f8fafc)",
                    borderRadius: "8px",
                    border: "1px solid var(--line, #e2e8f0)",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                      Role / Designation Name
                      <input
                        type="text"
                        name="name"
                        placeholder="e.g. Staff Architect, Tech Lead, HR Executive"
                        required
                        style={{ padding: "6px 8px", fontSize: "12px", borderRadius: 6, border: "1px solid var(--border-color, #cbd5e1)" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                      Category / Department
                      <select
                        name="category"
                        defaultValue="Custom"
                        style={{ padding: "6px 8px", fontSize: "12px", borderRadius: 6, border: "1px solid var(--border-color, #cbd5e1)" }}
                      >
                        <option value="Executive">Executive / C-Suite (CEO, COO, CTO)</option>
                        <option value="Management">Management (Director, Manager, Lead)</option>
                        <option value="HR">HR / People Operations</option>
                        <option value="Engineering">Engineering / Development</option>
                        <option value="Testing/QA">Testing / QA Quality Assurance</option>
                        <option value="Support">Customer Support / Helpdesk</option>
                        <option value="Operations">Operations / Administration</option>
                        <option value="Custom">Custom Role</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                      Hierarchy Tier (Zoho-Style)
                      <select
                        name="hierarchyLevel"
                        defaultValue="6"
                        style={{ padding: "6px 8px", fontSize: "12px", borderRadius: 6, border: "1px solid var(--border-color, #cbd5e1)" }}
                      >
                        <option value="1">Tier 1: C-Suite (CEO, COO, President)</option>
                        <option value="2">Tier 2: VP / Executive Director</option>
                        <option value="3">Tier 3: Manager / HR Manager / Admin</option>
                        <option value="4">Tier 4: Team Lead / Tech Lead / QA Lead</option>
                        <option value="5">Tier 5: Senior (Dev, Tester, Analyst)</option>
                        <option value="6">Tier 6: Core (Developer, Tester, Support)</option>
                        <option value="7">Tier 7: Associate / Junior</option>
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                      Badge Color
                      <input
                        type="color"
                        name="color"
                        defaultValue="#10b981"
                        style={{ height: 32, width: "100%", padding: 2, borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer" }}
                      />
                    </label>
                  </div>

                  <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                    Description &amp; Key Responsibilities
                    <input
                      type="text"
                      name="description"
                      placeholder="Brief summary of skills, expectations, and scope"
                      style={{ padding: "6px 8px", fontSize: "12px", borderRadius: 6, border: "1px solid var(--border-color, #cbd5e1)" }}
                    />
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="button button-secondary"
                      style={{ fontSize: "11.5px", padding: "5px 12px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="button button-primary"
                      style={{ fontSize: "11.5px", padding: "5px 14px" }}
                    >
                      {isPending ? "Saving…" : "Save Role"}
                    </button>
                  </div>
                </form>
              )}

              {/* Designations List Table */}
              <div style={{ border: "1px solid var(--line, #e2e8f0)", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead style={{ background: "var(--soft, #f8fafc)", borderBottom: "1px solid var(--line, #e2e8f0)" }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "var(--muted)" }}>Role &amp; Badge</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "var(--muted)" }}>Category</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "var(--muted)" }}>Tier</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "var(--muted)" }}>Description</th>
                      {canManage && <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 700, color: "var(--muted)" }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {allDesignations.map((item, idx) => (
                      <tr
                        key={item.id || item.name}
                        style={{
                          borderBottom: idx === allDesignations.length - 1 ? "none" : "1px solid var(--line, #f1f5f9)",
                          background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                        }}
                      >
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: `${item.color}15`,
                              color: item.color,
                              border: `1px solid ${item.color}40`,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: item.color }} />
                            {item.name}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--ink)" }}>{item.category}</td>
                        <td style={{ padding: "8px 12px", color: "var(--muted)", fontSize: "11px" }}>
                          Tier {item.hierarchy_level}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--muted)", fontSize: "11px", maxWidth: 220 }}>
                          {item.description}
                        </td>
                        {canManage && (
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>
                            {!item.isDefault && item.id ? (
                              <form action={deleteOrganizationDesignation} style={{ display: "inline" }}>
                                <input type="hidden" name="organizationId" value={organizationId} />
                                <input type="hidden" name="designationId" value={item.id} />
                                <button
                                  type="submit"
                                  title="Delete custom role"
                                  style={{
                                    border: 0,
                                    background: "transparent",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </form>
                            ) : (
                              <span style={{ fontSize: "10px", color: "var(--muted)" }}>System</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line, #e2e8f0)", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="button button-secondary"
                style={{ fontSize: "12px", padding: "6px 14px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
