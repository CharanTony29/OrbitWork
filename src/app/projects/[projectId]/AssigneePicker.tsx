"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { User, UserPlus, Check, X, Sparkles, Loader2, Bot } from "lucide-react";
import { setTaskAssignees } from "@/app/actions";
import { memberMatchesRole } from "@/lib/designations";

export type Member = {
  id: string;
  label: string;
  avatarUrl?: string | null;
  designations?: string[];
  role?: string;
};

const AVATAR_COLORS = [
  "#167c58", // Green
  "#2563eb", // Blue
  "#d97706", // Amber
  "#dc2626", // Red
  "#9333ea", // Purple
  "#0891b2", // Cyan
  "#4f46e5", // Indigo
  "#e11d48", // Rose
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function AssigneePicker({
  projectId,
  taskId,
  members,
  initialAssignees,
}: {
  projectId: string;
  taskId: string;
  members: Member[];
  initialAssignees: string[]; // ordered list of user IDs
}) {
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);
  const [isOpen, setIsOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isAiAssigning, setIsAiAssigning] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAssignees(initialAssignees);
  }, [initialAssignees]);

  async function handleAIAssignSingle() {
    setIsAiAssigning(true);
    setAiNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/ai-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (res.ok && data.assignments?.[0]) {
        const assignedId = data.assignments[0].assignedUserId;
        commit([assignedId]);
        setAiNotice(`Assigned to ${data.assignments[0].assignedUserName} (${data.assignments[0].requiredRole})`);
      }
    } catch (err) {
      console.warn("AI Single Assign error:", err);
    } finally {
      setIsAiAssigning(false);
    }
  }

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function commit(next: string[]) {
    const validIds = next.filter((id) => Boolean(id && id.trim()));
    setAssignees(validIds);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      validIds.forEach((id) => fd.append("assigneeIds", id));
      await setTaskAssignees(fd);
    });
  }

  function toggleMember(memberId: string) {
    if (assignees.includes(memberId)) {
      commit(assignees.filter((id) => id !== memberId));
    } else {
      commit([...assignees, memberId]);
    }
  }

  const assignedMembers = assignees
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean) as Member[];

  return (
    <div className="compact-assignee-cell" ref={popoverRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Trigger: Round Avatar(s) or subtle User icon matching ClickUp */}
      <button
        type="button"
        className="compact-assignee-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title={
          assignedMembers.length
            ? `Assigned: ${assignedMembers.map((m) => m.label).join(", ")}`
            : "Click to assign member"
        }
        style={{
          border: 0,
          background: "transparent",
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          height: 24,
        }}
      >
        {assignedMembers.length > 0 ? (
          <div style={{ display: "inline-flex", alignItems: "center" }}>
            {assignedMembers.slice(0, 3).map((m, idx) => (
              <span
                key={m.id}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  backgroundColor: getAvatarColor(m.id),
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: idx > 0 ? -6 : 0,
                  border: "1.5px solid var(--paper, #ffffff)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  zIndex: 3 - idx,
                  overflow: "hidden",
                  flexShrink: 0,
                }}
                title={m.label}
              >
                {m.avatarUrl ? (
                  <img
                    src={m.avatarUrl}
                    alt={m.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  m.label.charAt(0).toUpperCase()
                )}
              </span>
            ))}
            {assignedMembers.length > 3 && (
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: "#64748b",
                  color: "#ffffff",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: -4,
                }}
              >
                +{assignedMembers.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted, #8a968f)",
              transition: "color 0.15s ease",
            }}
          >
            <UserPlus size={14} style={{ opacity: 0.6 }} />
          </span>
        )}
      </button>

      {/* Floating Popover on Click (Does NOT affect row height!) */}
      {isOpen && (
        <div
          className="compact-assignee-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 100,
            width: 250,
            maxHeight: 310,
            overflowY: "auto",
            backgroundColor: "var(--surface, #ffffff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 8,
            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
            padding: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "2px 4px 6px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--muted, #8a968f)",
            }}
          >
            <span>Assign Members</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {pending && <span style={{ color: "var(--green, #167c58)" }}>Saving…</span>}
              <button
                type="button"
                onClick={handleAIAssignSingle}
                disabled={isAiAssigning}
                title="AI Auto-Assign — Analyzes task and assigns to lowest-workload member"
                style={{
                  border: 0,
                  background: "rgba(124, 58, 237, 0.1)",
                  color: "#7c3aed",
                  borderRadius: 4,
                  padding: "2px 5px",
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {isAiAssigning ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Sparkles size={10} />
                )}
                <span>AI Auto</span>
              </button>
            </div>
          </div>

          {aiNotice && (
            <div
              style={{
                fontSize: 10,
                color: "#059669",
                background: "rgba(16, 185, 129, 0.08)",
                padding: "3px 6px",
                borderRadius: 4,
                marginTop: 4,
              }}
            >
              ✓ {aiNotice}
            </div>
          )}

          {/* Quick Role Filters */}
          <div style={{ display: "flex", gap: 3, marginTop: 5, paddingBottom: 4 }}>
            {[
              { id: "all", label: "All" },
              { id: "developer", label: "Dev" },
              { id: "tester", label: "QA" },
              { id: "support", label: "Support" },
            ].map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRoleFilter(rf.id)}
                style={{
                  border: 0,
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 9.5,
                  fontWeight: roleFilter === rf.id ? 700 : 500,
                  backgroundColor: roleFilter === rf.id ? "var(--ink, #1f2d26)" : "var(--soft, #f1f5f9)",
                  color: roleFilter === rf.id ? "#ffffff" : "var(--muted, #64748b)",
                  cursor: "pointer",
                }}
              >
                {rf.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
            {members
              .filter((m) => {
                if (roleFilter === "all") return true;
                return memberMatchesRole(m.designations || [], roleFilter);
              })
              .map((member) => {
                const isAssigned = assignees.includes(member.id);
                const firstDesig = member.designations?.[0] || member.role || "";
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "5px 6px",
                      border: 0,
                      borderRadius: 6,
                      background: isAssigned ? "rgba(22, 124, 88, 0.1)" : "transparent",
                      color: "var(--ink, #1f2d26)",
                      cursor: "pointer",
                      fontSize: 11.5,
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          backgroundColor: getAvatarColor(member.id),
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.label}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          member.label.charAt(0).toUpperCase()
                        )}
                      </span>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: isAssigned ? 600 : 400, display: "block" }}>
                          {member.label}
                        </span>
                        {firstDesig && (
                          <span style={{ fontSize: 9.5, color: "var(--muted)", display: "block" }}>
                            {firstDesig}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAssigned && <Check size={13} style={{ color: "var(--green, #167c58)", flexShrink: 0 }} />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
