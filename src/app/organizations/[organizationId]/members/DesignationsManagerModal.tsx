"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Briefcase, X, Plus, Shield, Layers, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  createOrganizationDesignationDirect,
  deleteOrganizationDesignationDirect,
} from "@/app/actions";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Local state for custom designations list so updates reflect immediately without closing or reloading
  const [customItems, setCustomItems] = useState<OrganizationDesignation[]>(customDesignations);

  // Controlled form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Custom");
  const [hierarchyLevel, setHierarchyLevel] = useState(6);
  const [color, setColor] = useState("#10b981");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setCustomItems(customDesignations);
  }, [customDesignations]);

  // Combine default system designations and custom org designations
  const allDesignations = [
    ...DEFAULT_DESIGNATIONS.map((d) => ({ ...d, isDefault: true })),
    ...customItems.map((d) => ({ ...d, isDefault: false })),
  ];

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsPending(true);
    setStatusMsg(null);

    try {
      const res = await createOrganizationDesignationDirect({
        organizationId,
        name: trimmedName,
        category,
        hierarchyLevel,
        description: description.trim(),
        color,
      });

      if (res.success && res.designation) {
        const newD: OrganizationDesignation = {
          id: res.designation.id,
          organization_id: res.designation.organization_id,
          name: res.designation.name,
          category: res.designation.category || "Custom",
          hierarchy_level: Number(res.designation.hierarchy_level) || 5,
          description: res.designation.description || "",
          color: res.designation.color || "#3b82f6",
        };

        setCustomItems((prev) => {
          const filtered = prev.filter(
            (d) => d.id !== newD.id && d.name.toLowerCase() !== newD.name.toLowerCase()
          );
          return [...filtered, newD].sort(
            (a, b) => a.hierarchy_level - b.hierarchy_level || a.name.localeCompare(b.name)
          );
        });

        // Clear content and keep default values (window stays open!)
        setName("");
        setDescription("");
        setCategory("Custom");
        setHierarchyLevel(6);
        setColor("#10b981");

        setStatusMsg({ type: "success", text: `Designation "${newD.name}" saved successfully!` });
        setTimeout(() => setStatusMsg(null), 4000);

        // Background server sync without page reload
        router.refresh();
      } else {
        setStatusMsg({ type: "error", text: res.error || "Failed to save designation" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "An unexpected error occurred" });
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteRole = async (designationId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete designation "${roleName}"?`)) return;

    setStatusMsg(null);
    try {
      const res = await deleteOrganizationDesignationDirect({
        organizationId,
        designationId,
      });

      if (res.success) {
        setCustomItems((prev) => prev.filter((d) => d.id !== designationId));
        setStatusMsg({ type: "success", text: `Designation "${roleName}" removed successfully.` });
        setTimeout(() => setStatusMsg(null), 3000);
        router.refresh();
      } else {
        setStatusMsg({ type: "error", text: res.error || "Failed to delete designation" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Failed to delete designation" });
    }
  };

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
          <div className="proj-modal" style={{ maxWidth: 720, height: "85vh", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div className="proj-modal-head" style={{ borderBottom: "1px solid var(--line, #e2e8f0)", padding: "14px 20px", flexShrink: 0 }}>
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

            <div className="proj-modal-body" style={{ padding: "16px 20px", overflowY: "auto", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Feedback status alert */}
              {statusMsg && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    backgroundColor: statusMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
                    color: statusMsg.type === "success" ? "#047857" : "#b91c1c",
                    border: `1px solid ${statusMsg.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                  }}
                >
                  {statusMsg.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              {/* Header with Add Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
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
                    <span>{showAddForm ? "Hide Form" : "Add Custom Role"}</span>
                  </button>
                )}
              </div>

              {/* Add Custom Designation Form */}
              {showAddForm && canManage && (
                <form
                  onSubmit={handleSaveRole}
                  style={{
                    padding: "14px",
                    background: "var(--soft, #f8fafc)",
                    borderRadius: "8px",
                    border: "1px solid var(--line, #e2e8f0)",
                    display: "grid",
                    gap: "10px",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                      Role / Designation Name
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Staff Architect, Tech Lead, HR Executive"
                        required
                        disabled={isPending}
                        style={{ padding: "6px 8px", fontSize: "12px", borderRadius: 6, border: "1px solid var(--border-color, #cbd5e1)" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                      Category / Department
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={isPending}
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
                        value={hierarchyLevel}
                        onChange={(e) => setHierarchyLevel(Number(e.target.value))}
                        disabled={isPending}
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
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        disabled={isPending}
                        style={{ height: 32, width: "100%", padding: 2, borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer" }}
                      />
                    </label>
                  </div>

                  <label style={{ display: "grid", gap: 4, fontSize: "11px", fontWeight: 600 }}>
                    Description &amp; Key Responsibilities
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief summary of skills, expectations, and scope"
                      disabled={isPending}
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
                      disabled={isPending || !name.trim()}
                      className="button button-primary"
                      style={{ fontSize: "11.5px", padding: "5px 14px", display: "inline-flex", alignItems: "center", gap: 5 }}
                    >
                      {isPending && <Loader2 size={12} className="animate-spin" />}
                      <span>{isPending ? "Saving…" : "Save Role"}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Designations List Table with dedicated scrollable container */}
              <div style={{ border: "1px solid var(--line, #e2e8f0)", borderRadius: 8, overflowY: "auto", overflowX: "auto", flex: "1 1 auto", minHeight: 260, maxHeight: "55vh", background: "var(--paper, #fff)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--soft, #f8fafc)", borderBottom: "1px solid var(--line, #e2e8f0)" }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "9px 12px", fontWeight: 700, color: "var(--muted)", background: "var(--soft, #f8fafc)" }}>Role &amp; Badge</th>
                      <th style={{ textAlign: "left", padding: "9px 12px", fontWeight: 700, color: "var(--muted)", background: "var(--soft, #f8fafc)" }}>Category</th>
                      <th style={{ textAlign: "left", padding: "9px 12px", fontWeight: 700, color: "var(--muted)", background: "var(--soft, #f8fafc)" }}>Tier</th>
                      <th style={{ textAlign: "left", padding: "9px 12px", fontWeight: 700, color: "var(--muted)", background: "var(--soft, #f8fafc)" }}>Description</th>
                      {canManage && <th style={{ textAlign: "right", padding: "9px 12px", fontWeight: 700, color: "var(--muted)", background: "var(--soft, #f8fafc)" }}>Actions</th>}
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
                              <button
                                type="button"
                                onClick={() => handleDeleteRole(item.id!, item.name)}
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

            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line, #e2e8f0)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
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
