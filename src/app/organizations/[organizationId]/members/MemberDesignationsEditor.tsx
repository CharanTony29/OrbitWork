"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Edit2, Check, X, Shield, Plus, Tag } from "lucide-react";
import { updateMemberDesignations } from "@/app/actions";
import { DEFAULT_DESIGNATIONS, type OrganizationDesignation } from "@/lib/designations";

export default function MemberDesignationsEditor({
  organizationId,
  userId,
  memberName,
  currentDesignations,
  primaryDesignation,
  allAvailableDesignations = [],
  canManage = false,
}: {
  organizationId: string;
  userId: string;
  memberName: string;
  currentDesignations: string[];
  primaryDesignation?: string | null;
  allAvailableDesignations: OrganizationDesignation[];
  canManage: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentDesignations);
  const [primary, setPrimary] = useState<string>(primaryDesignation || currentDesignations[0] || "");
  const [customInput, setCustomInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(currentDesignations);
    setPrimary(primaryDesignation || currentDesignations[0] || "");
  }, [currentDesignations, primaryDesignation]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Combine default system designations with custom organization designations
  const designationNames = Array.from(
    new Set([
      ...allAvailableDesignations.map((d) => d.name),
      ...DEFAULT_DESIGNATIONS.map((d) => d.name),
      ...selected,
    ])
  );

  const designationMetaMap = new Map<string, { color?: string; category?: string }>();
  for (const d of [...DEFAULT_DESIGNATIONS, ...allAvailableDesignations]) {
    designationMetaMap.set(d.name.toLowerCase(), { color: d.color, category: d.category });
  }

  function getBadgeColor(name: string): string {
    const meta = designationMetaMap.get(name.toLowerCase());
    if (meta?.color) return meta.color;
    const lower = name.toLowerCase();
    if (lower.includes("dev") || lower.includes("engineer")) return "#059669";
    if (lower.includes("test") || lower.includes("qa")) return "#d97706";
    if (lower.includes("support")) return "#ea580c";
    if (lower.includes("hr") || lower.includes("people")) return "#db2777";
    if (lower.includes("ceo") || lower.includes("coo") || lower.includes("director")) return "#7e22ce";
    if (lower.includes("manager") || lower.includes("lead")) return "#2563eb";
    return "#475569";
  }

  function toggleRole(roleName: string) {
    if (selected.includes(roleName)) {
      const next = selected.filter((r) => r !== roleName);
      setSelected(next);
      if (primary === roleName) {
        setPrimary(next[0] || "");
      }
    } else {
      const next = [...selected, roleName];
      setSelected(next);
      if (!primary) {
        setPrimary(roleName);
      }
    }
  }

  function addCustomTag() {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed)) {
      setSelected([...selected, trimmed]);
      if (!primary) setPrimary(trimmed);
      setCustomInput("");
    }
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("organizationId", organizationId);
      fd.set("userId", userId);
      if (primary) fd.set("primaryDesignation", primary);
      selected.forEach((d) => fd.append("designations", d));
      await updateMemberDesignations(fd);
      setIsOpen(false);
    });
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      {/* Display Designation Badges */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
        {selected.length > 0 ? (
          selected.map((item) => {
            const color = getBadgeColor(item);
            const isPrimary = item === primary;
            return (
              <span
                key={item}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 7px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: isPrimary ? 700 : 500,
                  backgroundColor: `${color}18`,
                  color: color,
                  border: `1px solid ${color}44`,
                  lineHeight: 1.3,
                }}
                title={isPrimary ? `${item} (Primary Designation)` : item}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: color,
                  }}
                />
                {item}
                {isPrimary && (
                  <span
                    style={{
                      fontSize: "9px",
                      opacity: 0.8,
                      fontWeight: 800,
                    }}
                  >
                    ★
                  </span>
                )}
              </span>
            );
          })
        ) : (
          <span style={{ fontSize: "11.5px", color: "var(--muted, #94a3b8)", fontStyle: "italic" }}>
            No designation
          </span>
        )}

        {canManage && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={`Edit designations for ${memberName}`}
            style={{
              border: "1px dashed var(--line, #cbd5e1)",
              background: "transparent",
              color: "var(--muted, #64748b)",
              borderRadius: "6px",
              padding: "2px 5px",
              fontSize: "10.5px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              marginLeft: "2px",
            }}
            title="Assign or modify roles/designations (multi-role supported)"
          >
            <Edit2 size={10} />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Popover / Multi-Role Selector */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            width: 320,
            maxHeight: 380,
            overflowY: "auto",
            backgroundColor: "var(--surface, #ffffff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 8,
            boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
            padding: "12px",
            display: "grid",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line, #f1f5f9)", paddingBottom: "6px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink, #1f2d26)" }}>
              Assign Roles to {memberName}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)" }}
            >
              <X size={14} />
            </button>
          </div>

          <p style={{ margin: 0, fontSize: "10.5px", color: "var(--muted)" }}>
            Select one or more roles. Teammates can hold multiple designations (e.g. Developer + Project Manager).
          </p>

          {/* Quick Custom Tag Input */}
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="Add custom role..."
              style={{
                flex: 1,
                fontSize: "11px",
                padding: "4px 8px",
                borderRadius: 5,
                border: "1px solid var(--border-color, #cbd5e1)",
              }}
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="button button-secondary"
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              Add
            </button>
          </div>

          {/* List of Available Roles */}
          <div style={{ display: "grid", gap: "4px", maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
            {designationNames.map((role) => {
              const isChecked = selected.includes(role);
              const color = getBadgeColor(role);
              return (
                <label
                  key={role}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 6px",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: "11.5px",
                    background: isChecked ? `${color}10` : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRole(role)}
                      style={{ width: 14, height: 14 }}
                    />
                    <span style={{ color: color, fontWeight: isChecked ? 600 : 400 }}>{role}</span>
                  </div>
                  {isChecked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setPrimary(role);
                      }}
                      style={{
                        border: 0,
                        background: primary === role ? color : "transparent",
                        color: primary === role ? "#fff" : "var(--muted)",
                        fontSize: "9px",
                        padding: "1px 5px",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                      title="Set as primary designation"
                    >
                      {primary === role ? "Primary ★" : "Make Primary"}
                    </button>
                  )}
                </label>
              );
            })}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, borderTop: "1px solid var(--line, #f1f5f9)", paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="button button-secondary"
              style={{ fontSize: "11px", padding: "4px 10px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="button button-primary"
              style={{ fontSize: "11px", padding: "4px 12px" }}
            >
              {isPending ? "Saving…" : "Save Roles"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
