"use client";

import { useState, useMemo } from "react";
import { Search, X, RotateCcw, Filter, UsersRound, Building2 } from "lucide-react";
import AutoOrgMemberRoleSelect from "./AutoOrgMemberRoleSelect";
import AutoOrgMemberManagerSelect from "./AutoOrgMemberManagerSelect";
import MemberDesignationsEditor from "./MemberDesignationsEditor";
import { normalizeMemberDesignations, type OrganizationDesignation } from "@/lib/designations";

export interface MemberRowData {
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  manager_id?: string | null;
  designations?: string[] | null;
  primary_designation?: string | null;
}

export interface ProfileData {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string | null;
  designation?: string | null;
  designations?: string[] | null;
  department?: string | null;
  contact_information?: string | null;
}

export default function OrganizationMembersTable({
  organizationId,
  memberships,
  profiles,
  workspaceRoleByUser,
  customDesignations,
  activeCandidates,
  isOwner,
  canManageOrg,
  hierarchySupported,
  isManagerOrHigher,
}: {
  organizationId: string;
  memberships: MemberRowData[];
  profiles: ProfileData[];
  workspaceRoleByUser: Record<string, Array<{ name: string; role: string }>>;
  customDesignations: OrganizationDesignation[];
  activeCandidates: Array<{ user_id: string; label: string; role: string }>;
  isOwner: boolean;
  canManageOrg: boolean;
  hierarchySupported: boolean;
  isManagerOrHigher: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");

  const profileById = useMemo(() => {
    return new Map<string, ProfileData>(profiles.map((p) => [p.id, p]));
  }, [profiles]);

  const getMemberLabel = (uid: string) => {
    const p = profileById.get(uid);
    return p?.display_name?.trim() || p?.email || "Team member";
  };

  // Collect all available designations for the filter dropdown
  const allAvailableDesignationNames = useMemo(() => {
    const set = new Set<string>();
    customDesignations.forEach((d) => set.add(d.name));
    memberships.forEach((m) => {
      const p = profileById.get(m.user_id);
      const list = normalizeMemberDesignations(m.designations, p?.designation);
      list.forEach((name) => set.add(name));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customDesignations, memberships, profileById]);

  // Collect distinct managers for filter dropdown
  const distinctManagers = useMemo(() => {
    const mgrMap = new Map<string, string>();
    memberships.forEach((m) => {
      if (m.manager_id) {
        mgrMap.set(m.manager_id, getMemberLabel(m.manager_id));
      }
    });
    return Array.from(mgrMap.entries()).map(([id, label]) => ({ id, label }));
  }, [memberships, profileById]);

  // Filtered memberships
  const filteredMemberships = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return memberships.filter((m) => {
      const profile = profileById.get(m.user_id);
      const name = (profile?.display_name || "").toLowerCase();
      const email = (profile?.email || "").toLowerCase();
      const dept = (profile?.department || "").toLowerCase();
      const contact = (profile?.contact_information || "").toLowerCase();
      const currentRole = (m.role || "").toLowerCase();
      const memberRoles = normalizeMemberDesignations(m.designations, profile?.designation);
      const memberRolesStr = memberRoles.join(" ").toLowerCase();
      const wsRoles = workspaceRoleByUser[m.user_id] ?? [];
      const wsNames = wsRoles.map((r) => r.name.toLowerCase()).join(" ");

      // Search query filter
      if (q) {
        const matchesQuery =
          name.includes(q) ||
          email.includes(q) ||
          dept.includes(q) ||
          contact.includes(q) ||
          currentRole.includes(q) ||
          memberRolesStr.includes(q) ||
          wsNames.includes(q);
        if (!matchesQuery) return false;
      }

      // Role filter
      if (roleFilter && m.role !== roleFilter) {
        return false;
      }

      // Designation filter
      if (designationFilter && !memberRoles.includes(designationFilter)) {
        return false;
      }

      // Manager filter
      if (managerFilter) {
        if (managerFilter === "none") {
          if (m.manager_id) return false;
        } else if (m.manager_id !== managerFilter) {
          return false;
        }
      }

      // Workspace filter
      if (workspaceFilter) {
        if (workspaceFilter === "has_access" && wsRoles.length === 0) return false;
        if (workspaceFilter === "no_access" && wsRoles.length > 0) return false;
      }

      return true;
    });
  }, [
    memberships,
    searchQuery,
    roleFilter,
    designationFilter,
    managerFilter,
    workspaceFilter,
    profileById,
    workspaceRoleByUser,
  ]);

  const hasActiveFilters = Boolean(
    searchQuery || roleFilter || designationFilter || managerFilter || workspaceFilter
  );

  const handleResetFilters = () => {
    setSearchQuery("");
    setRoleFilter("");
    setDesignationFilter("");
    setManagerFilter("");
    setWorkspaceFilter("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Search and Filters Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 14px",
          background: "var(--soft, #f8fafc)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: "10px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: "1 1 auto" }}>
          {/* Search Input */}
          <div style={{ position: "relative", minWidth: 220, flex: "1 1 240px", maxWidth: 340 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted, #64748b)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Filter members by name, email, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 28px 6px 30px",
                fontSize: "12px",
                borderRadius: "7px",
                border: "1px solid var(--border-color, #cbd5e1)",
                background: "var(--paper, #fff)",
                color: "inherit",
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted, #64748b)",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by organization role"
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "7px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--paper, #fff)",
              color: "inherit",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">All Roles ({memberships.length})</option>
            <option value="owner">Owner</option>
            <option value="co_owner">Co-Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>

          {/* Designation Filter */}
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            aria-label="Filter by designation"
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "7px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--paper, #fff)",
              color: "inherit",
              cursor: "pointer",
              outline: "none",
              maxWidth: 180,
            }}
          >
            <option value="">All Designations</option>
            {allAvailableDesignationNames.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Manager / Reporting Line Filter */}
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            aria-label="Filter by reporting line"
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "7px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--paper, #fff)",
              color: "inherit",
              cursor: "pointer",
              outline: "none",
              maxWidth: 180,
            }}
          >
            <option value="">All Reporting Lines</option>
            <option value="none">Top level (No manager)</option>
            {distinctManagers.map((mgr) => (
              <option key={mgr.id} value={mgr.id}>
                Reports to: {mgr.label}
              </option>
            ))}
          </select>

          {/* Workspace Access Filter */}
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            aria-label="Filter by workspace access"
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "7px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--paper, #fff)",
              color: "inherit",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">All Workspace Access</option>
            <option value="has_access">Has Workspace Access</option>
            <option value="no_access">No Workspace Access</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="button button-secondary"
              style={{
                padding: "5px 10px",
                fontSize: "11px",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                borderRadius: "7px",
              }}
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Showing Count Indicator */}
        <div style={{ fontSize: "11.5px", color: "var(--muted, #64748b)", whiteSpace: "nowrap" }}>
          Showing <strong>{filteredMemberships.length}</strong> of <strong>{memberships.length}</strong> members
        </div>
      </div>

      {/* Members Table */}
      <div className="organization-members-table-wrap">
        <table className="organization-members-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Organization role</th>
              <th>Designations (Multi-Role)</th>
              <th>Reports to (Manager)</th>
              <th>Workspace access and role</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filteredMemberships.map((membership) => {
              const profile = profileById.get(membership.user_id);
              const name = getMemberLabel(membership.user_id);
              const memberDesignations = normalizeMemberDesignations(
                membership.designations,
                profile?.designation
              );
              const primaryDesignation =
                membership.primary_designation || profile?.designation || memberDesignations[0] || null;
              const workspaceRoles = workspaceRoleByUser[membership.user_id] ?? [];
              const profileDetails = [profile?.department, profile?.contact_information]
                .filter(Boolean)
                .join(" · ");
              const currentManagerName = membership.manager_id
                ? getMemberLabel(membership.manager_id)
                : "Top level (No manager)";
              const canEditThisMemberRole = Boolean(
                isOwner
                  ? membership.role !== "owner"
                  : canManageOrg && membership.role !== "owner" && membership.role !== "co_owner"
              );

              return (
                <tr key={membership.user_id}>
                  <td>
                    <div className="organization-member-person">
                      <span className="organization-member-avatar">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={name}
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          name[0]?.toUpperCase() ?? "U"
                        )}
                      </span>
                      <span>
                        <strong>{name}</strong>
                        {profile?.email && profile.display_name?.trim() && <small>{profile.email}</small>}
                        {profileDetails && <small>{profileDetails}</small>}
                      </span>
                    </div>
                  </td>
                  <td>
                    {canEditThisMemberRole ? (
                      <AutoOrgMemberRoleSelect
                        organizationId={organizationId}
                        userId={membership.user_id}
                        initialRole={membership.role}
                        isOwner={isOwner}
                      />
                    ) : (
                      <span className={`organization-role-badge role-${membership.role}`}>
                        {membership.role === "co_owner" ? "Co-Owner" : membership.role}
                      </span>
                    )}
                  </td>
                  <td>
                    <MemberDesignationsEditor
                      organizationId={organizationId}
                      userId={membership.user_id}
                      memberName={name}
                      currentDesignations={memberDesignations}
                      primaryDesignation={primaryDesignation}
                      allAvailableDesignations={customDesignations}
                      canManage={isManagerOrHigher}
                    />
                  </td>
                  <td>
                    {isOwner && hierarchySupported ? (
                      <AutoOrgMemberManagerSelect
                        organizationId={organizationId}
                        userId={membership.user_id}
                        initialManagerId={membership.manager_id ?? null}
                        candidates={activeCandidates.filter((c) => c.user_id !== membership.user_id)}
                        memberName={name}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: "12px",
                          color: membership.manager_id ? "var(--ink)" : "var(--muted)",
                        }}
                      >
                        {currentManagerName}
                      </span>
                    )}
                  </td>
                  <td>
                    {workspaceRoles.length ? (
                      <div className="organization-workspace-roles">
                        {workspaceRoles.map((item) => (
                          <span key={`${item.name}-${item.role}`}>
                            <strong>{item.name}</strong>
                            <small>{item.role}</small>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="organization-member-muted">No workspace access</span>
                    )}
                  </td>
                  <td>
                    <span className={`organization-member-status status-${membership.status}`}>
                      {membership.status}
                    </span>
                  </td>
                  <td>{new Date(membership.joined_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredMemberships.length === 0 && (
          <div
            style={{
              padding: "36px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <p className="organization-members-empty" style={{ margin: 0, padding: 0 }}>
              {hasActiveFilters
                ? "No members match the selected filter criteria."
                : "No members found in this organization."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="button button-secondary"
                style={{ fontSize: "11.5px", padding: "5px 12px" }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
