"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Mail,
  Zap,
  Check,
  CheckSquare,
  Square,
  Search,
  RotateCcw,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { addMultipleWorkspaceMembersDirect } from "@/app/actions";
import MultiEmailInviteForm from "@/app/MultiEmailInviteForm";

export type AvailableOrgMember = {
  user_id: string;
  name: string;
  email?: string | null;
  orgRole: string; // "owner" | "co_owner" | "admin" | "manager" | "member" | "viewer"
  primaryDesignation?: string | null;
  designations?: string[];
};

type WorkspaceRole = "admin" | "manager" | "member" | "viewer";

function getInheritedRole(orgRole: string, isOrgAdmin: boolean): WorkspaceRole {
  switch ((orgRole || "").toLowerCase()) {
    case "owner":
    case "co_owner":
    case "admin":
      return isOrgAdmin ? "admin" : "manager";
    case "manager":
      return "manager";
    case "viewer":
      return "viewer";
    case "member":
    default:
      return "member";
  }
}

function getOrgRoleBadgeStyle(orgRole: string) {
  switch ((orgRole || "").toLowerCase()) {
    case "owner":
    case "co_owner":
      return { bg: "#7e22ce18", text: "#7e22ce", border: "#7e22ce44" };
    case "admin":
      return { bg: "#8b5cf618", text: "#8b5cf6", border: "#8b5cf644" };
    case "manager":
      return { bg: "#2563eb18", text: "#2563eb", border: "#2563eb44" };
    case "viewer":
      return { bg: "#64748b18", text: "#64748b", border: "#64748b44" };
    case "member":
    default:
      return { bg: "#05966918", text: "#059669", border: "#05966944" };
  }
}

export default function WorkspaceInviteSection({
  workspaceId,
  organizationId,
  availableMembers = [],
  isOrgAdmin,
}: {
  workspaceId: string;
  organizationId: string;
  availableMembers: AvailableOrgMember[];
  isOrgAdmin: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"org" | "email">("org");
  const [membersList, setMembersList] = useState<AvailableOrgMember[]>(availableMembers);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberRoles, setMemberRoles] = useState<Record<string, WorkspaceRole>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkRole, setBulkRole] = useState<WorkspaceRole>("member");
  const [isPending, startTransition] = useTransition();
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync state if server props change
  useEffect(() => {
    setMembersList(availableMembers);
  }, [availableMembers]);

  // Initialize inherited roles for any members not in memberRoles
  useEffect(() => {
    setMemberRoles((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const m of membersList) {
        if (!next[m.user_id]) {
          next[m.user_id] = getInheritedRole(m.orgRole, isOrgAdmin);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [membersList, isOrgAdmin]);

  // Filter available members by search
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return membersList;
    return membersList.filter((m) => {
      const nameMatch = m.name?.toLowerCase().includes(q);
      const emailMatch = m.email?.toLowerCase().includes(q);
      const desigMatch = (m.primaryDesignation || m.designations?.join(" ") || "").toLowerCase().includes(q);
      const roleMatch = m.orgRole?.toLowerCase().includes(q);
      return nameMatch || emailMatch || desigMatch || roleMatch;
    });
  }, [membersList, searchQuery]);

  // Toggle user selection
  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Select all (filtered or all)
  const selectAll = () => {
    const ids = filteredMembers.map((m) => m.user_id);
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedUserIds([]);
  };

  // Quick Inherit All: Select all available members and reset their roles to org roles
  const quickInheritAll = () => {
    const newRoles: Record<string, WorkspaceRole> = { ...memberRoles };
    for (const m of membersList) {
      newRoles[m.user_id] = getInheritedRole(m.orgRole, isOrgAdmin);
    }
    setMemberRoles(newRoles);
    setSelectedUserIds(membersList.map((m) => m.user_id));
    setAlert(null);
  };

  // Change individual user's workspace role
  const handleRoleChange = (userId: string, role: WorkspaceRole) => {
    setMemberRoles((prev) => ({ ...prev, [userId]: role }));
    // Auto-select member when their role is adjusted
    if (!selectedUserIds.includes(userId)) {
      setSelectedUserIds((prev) => [...prev, userId]);
    }
  };

  // Reset a member's role back to org inherited role
  const resetToInherited = (m: AvailableOrgMember) => {
    const inherited = getInheritedRole(m.orgRole, isOrgAdmin);
    setMemberRoles((prev) => ({ ...prev, [m.user_id]: inherited }));
  };

  // Apply bulk role to currently selected members
  const applyBulkRole = () => {
    if (!selectedUserIds.length) return;
    setMemberRoles((prev) => {
      const next = { ...prev };
      for (const id of selectedUserIds) {
        next[id] = bulkRole;
      }
      return next;
    });
  };

  // Submit selected members to workspace
  const handleAddMembers = () => {
    if (!selectedUserIds.length) return;
    setAlert(null);

    startTransition(async () => {
      try {
        const payload = selectedUserIds.map((uid) => {
          const member = membersList.find((m) => m.user_id === uid);
          const role = memberRoles[uid] || getInheritedRole(member?.orgRole || "member", isOrgAdmin);
          return { userId: uid, role };
        });

        const res = await addMultipleWorkspaceMembersDirect({
          workspaceId,
          members: payload,
        });

        if (res.success) {
          const count = res.count ?? payload.length;
          setAlert({
            type: "success",
            message: `Successfully added ${count} member${count > 1 ? "s" : ""} to this workspace!`,
          });
          const addedSet = new Set(selectedUserIds);
          setMembersList((prev) => prev.filter((m) => !addedSet.has(m.user_id)));
          setSelectedUserIds([]);
          router.refresh();
        } else {
          setAlert({
            type: "error",
            message: res.error || "Failed to add workspace members.",
          });
        }
      } catch (err: any) {
        setAlert({
          type: "error",
          message: err?.message || "An unexpected error occurred while adding members.",
        });
      }
    });
  };

  const selectedCount = selectedUserIds.length;
  const isAllFilteredSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedUserIds.includes(m.user_id));

  // Role summary for selected members
  const selectedRoleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of selectedUserIds) {
      const r = memberRoles[id] || "member";
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [selectedUserIds, memberRoles]);

  return (
    <div
      className="workspace-invite-box"
      style={{
        marginTop: 24,
        padding: "20px 22px",
        borderRadius: 12,
        border: "1px solid var(--line, #e2e8f0)",
        background: "var(--paper, #fff)",
      }}
    >
      {/* Header with Title and Tabs */}
      <div
        className="workspace-invite-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h4
            style={{
              margin: "0 0 4px",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--ink, #1f2d26)",
            }}
          >
            <UserPlus size={16} color="var(--green, #167c58)" />
            <span>Add or Invite Workspace Members</span>
          </h4>
          <p className="muted small" style={{ margin: 0, fontSize: 12, color: "var(--muted, #64748b)" }}>
            Grant workspace access to organization members with custom roles, or inherit roles directly from the organization.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "inline-flex", background: "var(--soft, #f1f5f2)", padding: 3, borderRadius: 8, gap: 3 }}>
          <button
            type="button"
            onClick={() => setActiveTab("org")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 6,
              border: 0,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "org" ? "var(--paper, #fff)" : "transparent",
              color: activeTab === "org" ? "var(--green, #167c58)" : "var(--muted, #64748b)",
              boxShadow: activeTab === "org" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <UserPlus size={13} />
            <span>Organization Members ({membersList.length})</span>
          </button>
          {isOrgAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("email")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 6,
                border: 0,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "email" ? "var(--paper, #fff)" : "transparent",
                color: activeTab === "email" ? "var(--green, #167c58)" : "var(--muted, #64748b)",
                boxShadow: activeTab === "email" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Mail size={13} />
              <span>Invite via Email</span>
            </button>
          )}
        </div>
      </div>

      {/* Dismissible Alert Message */}
      {alert && (
        <div
          style={{
            marginBottom: 14,
            padding: "9px 14px",
            borderRadius: 8,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: alert.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: alert.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${alert.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {alert.type === "success" ? <Check size={14} color="#059669" /> : <AlertCircle size={14} color="#dc2626" />}
            <span>{alert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlert(null)}
            style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit", padding: 2 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* TAB 1: Organization Members Multi-Add & Direct Inheritance */}
      {activeTab === "org" && (
        <div>
          {membersList.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                borderRadius: 8,
                border: "1px dashed var(--line, #cbd5e1)",
                color: "var(--muted, #64748b)",
                fontSize: 13,
                background: "var(--soft, #f8faf8)",
              }}
            >
              <Check size={20} color="var(--green, #167c58)" style={{ margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontWeight: 600 }}>All organization members already have access to this workspace.</p>
              <p style={{ margin: "4px 0 0", fontSize: 11.5 }}>
                To invite new team members to the organization, use the &quot;Invite via Email&quot; tab.
              </p>
            </div>
          ) : (
            <>
              {/* Action Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--soft, #f8fafc)",
                  border: "1px solid var(--line, #e2e8f0)",
                }}
              >
                {/* Search Bar */}
                <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
                  <Search
                    size={14}
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted, #94a3b8)" }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members by name or role..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      height: 32,
                      paddingLeft: 30,
                      paddingRight: 10,
                      borderRadius: 6,
                      border: "1px solid var(--line, #cbd5e1)",
                      fontSize: 12,
                      background: "var(--paper, #fff)",
                      color: "var(--ink)",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Quick Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {/* Direct Inherit All Button */}
                  <button
                    type="button"
                    onClick={quickInheritAll}
                    className="button"
                    title="Select all members and automatically set workspace roles to match their organization roles"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: "5px 11px",
                      borderRadius: 6,
                      background: "#ecfdf5",
                      color: "#065f46",
                      border: "1px solid #10b981",
                      cursor: "pointer",
                    }}
                  >
                    <Zap size={13} color="#059669" />
                    <span>Quick Inherit All ({membersList.length})</span>
                  </button>

                  {/* Select All */}
                  <button
                    type="button"
                    onClick={isAllFilteredSelected ? deselectAll : selectAll}
                    style={{
                      border: "1px solid var(--line, #cbd5e1)",
                      background: "var(--paper, #fff)",
                      color: "var(--ink, #334155)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "5px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {isAllFilteredSelected ? <Square size={12} /> : <CheckSquare size={12} />}
                    <span>{isAllFilteredSelected ? "Deselect All" : "Select All"}</span>
                  </button>

                  {/* Bulk Role Setter */}
                  {selectedCount > 0 && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Set all to:</span>
                      <select
                        value={bulkRole}
                        onChange={(e) => setBulkRole(e.target.value as WorkspaceRole)}
                        style={{
                          height: 28,
                          fontSize: 11.5,
                          padding: "0 6px",
                          borderRadius: 5,
                          border: "1px solid var(--line, #cbd5e1)",
                          background: "var(--paper, #fff)",
                          color: "var(--ink)",
                          outline: "none",
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                        <option value="manager">Manager</option>
                        {isOrgAdmin && <option value="admin">Admin</option>}
                      </select>
                      <button
                        type="button"
                        onClick={applyBulkRole}
                        style={{
                          height: 28,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "0 8px",
                          borderRadius: 5,
                          border: "1px solid var(--line, #cbd5e1)",
                          background: "var(--paper, #fff)",
                          cursor: "pointer",
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Members Checklist Table */}
              <div
                style={{
                  border: "1px solid var(--line, #e2e8f0)",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "var(--paper, #fff)",
                }}
              >
                {/* Table Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px minmax(180px, 2fr) minmax(140px, 1fr) 28px minmax(170px, 1.2fr) 40px",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "var(--soft, #f8fafc)",
                    borderBottom: "1px solid var(--line, #e2e8f0)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--muted, #64748b)",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={isAllFilteredSelected ? deselectAll : selectAll}
                      style={{ cursor: "pointer" }}
                      aria-label="Select all members"
                    />
                  </div>
                  <div>Member</div>
                  <div>Org Role &amp; Designation</div>
                  <div style={{ textAlign: "center" }}></div>
                  <div>Workspace Role</div>
                  <div style={{ textAlign: "center" }} title="Reset to inherited org role">Reset</div>
                </div>

                {/* Table Body */}
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  {filteredMembers.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                      No organization members matching &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const isSelected = selectedUserIds.includes(member.user_id);
                      const currentWsRole =
                        memberRoles[member.user_id] || getInheritedRole(member.orgRole, isOrgAdmin);
                      const inheritedRole = getInheritedRole(member.orgRole, isOrgAdmin);
                      const isInherited = currentWsRole === inheritedRole;
                      const badge = getOrgRoleBadgeStyle(member.orgRole);

                      return (
                        <div
                          key={member.user_id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "36px minmax(180px, 2fr) minmax(140px, 1fr) 28px minmax(170px, 1.2fr) 40px",
                            alignItems: "center",
                            gap: 8,
                            padding: "9px 12px",
                            borderBottom: "1px solid var(--line, #f1f5f9)",
                            background: isSelected ? "var(--row-active, #f0fdf4)" : "transparent",
                            transition: "background 0.15s ease",
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUser(member.user_id)}
                              style={{ cursor: "pointer", width: 15, height: 15 }}
                            />
                          </div>

                          {/* Member Avatar & Details */}
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                            onClick={() => toggleUser(member.user_id)}
                          >
                            <span
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                background: "var(--soft, #e2e8f0)",
                                color: "var(--ink, #1e293b)",
                                fontSize: 11,
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {(member.name || "U")[0].toUpperCase()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: isSelected ? 700 : 600,
                                  color: "var(--ink, #0f172a)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {member.name}
                              </div>
                              {member.email && (
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    color: "var(--muted, #64748b)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {member.email}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Organization Role & Designation */}
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "2px 7px",
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 600,
                                textTransform: "capitalize",
                                background: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                              }}
                              title={`Organization role: ${member.orgRole}`}
                            >
                              Org: {member.orgRole}
                            </span>
                            {member.primaryDesignation && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "var(--muted, #64748b)",
                                  background: "var(--soft, #f1f5f9)",
                                  padding: "2px 6px",
                                  borderRadius: 8,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {member.primaryDesignation}
                              </span>
                            )}
                          </div>

                          {/* Transfer Arrow */}
                          <div style={{ textAlign: "center", color: "var(--muted, #94a3b8)" }}>
                            <ArrowRight size={13} />
                          </div>

                          {/* Workspace Role Dropdown */}
                          <div>
                            <select
                              value={currentWsRole}
                              onChange={(e) => handleRoleChange(member.user_id, e.target.value as WorkspaceRole)}
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                height: 30,
                                fontSize: 11.5,
                                padding: "0 8px",
                                borderRadius: 6,
                                border: isSelected ? "1px solid #10b981" : "1px solid var(--line, #cbd5e1)",
                                background: "var(--paper, #fff)",
                                color: "var(--ink)",
                                outline: "none",
                                cursor: "pointer",
                              }}
                            >
                              <option value="member">Member (Can edit &amp; upload)</option>
                              <option value="viewer">Viewer (Read-only)</option>
                              <option value="manager">Manager</option>
                              {isOrgAdmin && <option value="admin">Admin</option>}
                            </select>
                          </div>

                          {/* Reset to Inherited Button */}
                          <div style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => resetToInherited(member)}
                              disabled={isInherited}
                              title={
                                isInherited
                                  ? `Inherited directly from organization (${inheritedRole})`
                                  : `Reset back to inherited organization role (${inheritedRole})`
                              }
                              style={{
                                border: 0,
                                background: "transparent",
                                color: isInherited ? "var(--muted, #cbd5e1)" : "var(--green, #167c58)",
                                cursor: isInherited ? "default" : "pointer",
                                padding: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <RotateCcw size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Bottom Action / Submission Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid var(--line, #e2e8f0)",
                }}
              >
                {/* Summary of Selection */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                    {selectedCount > 0 ? (
                      <>
                        <span style={{ color: "var(--green, #167c58)" }}>{selectedCount}</span> of {membersList.length} members selected
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>No members selected yet</span>
                    )}
                  </span>

                  {selectedCount > 0 && (
                    <div style={{ display: "flex", gap: 5, fontSize: 10.5 }}>
                      {Object.entries(selectedRoleCounts).map(([role, cnt]) => (
                        <span
                          key={role}
                          style={{
                            padding: "1px 6px",
                            borderRadius: 6,
                            background: "var(--soft, #f1f5f9)",
                            color: "var(--muted, #475569)",
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          {cnt} {role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={deselectAll}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "var(--muted, #64748b)",
                        fontSize: 12,
                        cursor: "pointer",
                        padding: "6px 10px",
                      }}
                    >
                      Clear selection
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddMembers}
                    disabled={selectedCount === 0 || isPending}
                    className="button button-primary"
                    style={{
                      height: 38,
                      padding: "0 18px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      cursor: selectedCount === 0 || isPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Adding {selectedCount} Members…</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} />
                        <span>
                          {selectedCount > 0
                            ? `Add ${selectedCount} Member${selectedCount > 1 ? "s" : ""} to Workspace`
                            : "Select Members to Add"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Invite New Team Members via Email */}
      {activeTab === "email" && isOrgAdmin && (
        <div style={{ marginTop: 14 }}>
          <MultiEmailInviteForm
            organizationId={organizationId}
            defaultWorkspaceId={workspaceId}
            hideWorkspaceSelect={true}
          />
        </div>
      )}
    </div>
  );
}
