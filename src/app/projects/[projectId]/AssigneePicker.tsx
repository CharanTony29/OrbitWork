"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { User, UserPlus, Check, X } from "lucide-react";
import { setTaskAssignees } from "@/app/actions";

type Member = { id: string; label: string };

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
  const [pending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAssignees(initialAssignees);
  }, [initialAssignees]);

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
                }}
              >
                {m.label.charAt(0).toUpperCase()}
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
            width: 220,
            maxHeight: 260,
            overflowY: "auto",
            backgroundColor: "var(--surface, #ffffff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 8,
            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
            padding: "6px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 8px 6px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--muted, #8a968f)",
            }}
          >
            <span>Assign Members</span>
            {pending && <span style={{ color: "var(--green, #167c58)" }}>Saving…</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
            {members.map((member) => {
              const isAssigned = assignees.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    border: 0,
                    borderRadius: 6,
                    background: isAssigned ? "rgba(22, 124, 88, 0.1)" : "transparent",
                    color: "var(--ink, #1f2d26)",
                    cursor: "pointer",
                    fontSize: 12,
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                      }}
                    >
                      {member.label.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ fontWeight: isAssigned ? 600 : 400 }}>{member.label}</span>
                  </div>
                  {isAssigned && <Check size={13} style={{ color: "var(--green, #167c58)" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
