"use client";

import { useState, useRef } from "react";
import { Plus, Minus, Pencil, Send, Mail, UserPlus, Check } from "lucide-react";
import { inviteOrganizationMember } from "@/app/actions";

export type MultiEmailInviteFormProps = {
  organizationId: string;
  workspaces?: { id: string; name: string }[];
  defaultWorkspaceId?: string;
  hideWorkspaceSelect?: boolean;
  className?: string;
};

// Basic RFC-compliant email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MultiEmailInviteForm({
  organizationId,
  workspaces = [],
  defaultWorkspaceId = "",
  hideWorkspaceSelect = false,
  className = "",
}: MultiEmailInviteFormProps) {
  const [emailInput, setEmailInput] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<"member" | "manager" | "viewer" | "admin">("member");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(defaultWorkspaceId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = (raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return;

    if (!EMAIL_REGEX.test(trimmed)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (emailList.includes(trimmed)) {
      setErrorMessage("This email has already been added.");
      return;
    }

    setEmailList((prev) => [...prev, trimmed]);
    setEmailInput("");
    setErrorMessage(null);
  };

  const handleAddClick = () => {
    addEmail(emailInput);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail(emailInput);
    }
  };

  const handleRemove = (index: number) => {
    setEmailList((prev) => prev.filter((_, i) => i !== index));
    setErrorMessage(null);
  };

  const handleEdit = (index: number) => {
    const emailToEdit = emailList[index];
    handleRemove(index);
    setEmailInput(emailToEdit);
    inputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    let finalList = [...emailList];
    const pending = emailInput.trim().toLowerCase();

    // If there is a valid email left in the input, auto-include it
    if (pending && EMAIL_REGEX.test(pending) && !finalList.includes(pending)) {
      finalList.push(pending);
    }

    if (finalList.length === 0) {
      e.preventDefault();
      setErrorMessage("Please enter at least one email address to invite.");
      inputRef.current?.focus();
      return;
    }
  };

  // Prepare joined emails for the action
  const finalEmailString = (() => {
    const list = [...emailList];
    const pending = emailInput.trim().toLowerCase();
    if (pending && EMAIL_REGEX.test(pending) && !list.includes(pending)) {
      list.push(pending);
    }
    return list.join(", ");
  })();

  return (
    <form
      action={inviteOrganizationMember}
      onSubmit={handleFormSubmit}
      className={`multi-email-invite-card ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
        paddingTop: 10,
        marginTop: 8,
        borderTop: "1px solid var(--line, #eef1ee)",
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="workspaceId" value={selectedWorkspaceId} />
      <input type="hidden" name="email" value={finalEmailString} />

      {/* Row 1: Workspace selector (if organization card) */}
      {!hideWorkspaceSelect && (
        <div style={{ width: "100%" }}>
          <select
            name="workspaceSelectHelper"
            value={selectedWorkspaceId}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            aria-label="Invite to workspace"
            title="Choose a workspace, or leave as Organization only"
            style={{
              width: "100%",
              height: 36,
              minHeight: 36,
              borderRadius: 8,
              border: "1px solid var(--line, #dfe5e0)",
              background: "var(--paper, #fff)",
              color: "var(--ink, #46544b)",
              fontSize: 11.5,
              padding: "0 10px",
              boxSizing: "border-box",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              textAlignLast: "center",
            }}
          >
            <option value="">Organization only</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Row 2: Email input with "+" button to add */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <input
            ref={inputRef}
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Invite email address…"
            title="Type an email address and click + or press Enter to add"
            style={{
              width: "100%",
              height: 36,
              minHeight: 36,
              padding: "0 10px",
              borderRadius: 8,
              border: errorMessage ? "1.5px solid #ef4444" : "1px solid var(--line, #dfe5e0)",
              background: "var(--paper, #fff)",
              color: "var(--ink, #46544b)",
              fontSize: 12,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleAddClick}
          aria-label="Add email"
          title="Add email to list"
          style={{
            height: 36,
            minHeight: 36,
            width: 36,
            minWidth: 36,
            borderRadius: 8,
            border: "1px solid var(--green, #167c58)",
            background: "var(--soft, #f1f8f5)",
            color: "var(--green, #167c58)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Error message */}
      {errorMessage && (
        <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 500, margin: "-2px 0 2px" }}>
          {errorMessage}
        </span>
      )}

      {/* Row 3: Added emails list with Edit and Minus icons */}
      {emailList.length > 0 && (
        <div
          className="invite-email-chips"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            margin: "2px 0",
            maxHeight: 120,
            overflowY: "auto",
            padding: "4px 2px",
          }}
        >
          {emailList.map((email, idx) => (
            <div
              key={idx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 8px",
                borderRadius: 14,
                background: "var(--soft, #f1f5f9)",
                border: "1px solid var(--line, #cbd5e1)",
                fontSize: 11.5,
                color: "var(--ink, #1e293b)",
              }}
            >
              <Mail size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
              <span
                style={{
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                }}
              >
                {email}
              </span>

              {/* Edit button (pen icon) */}
              <button
                type="button"
                onClick={() => handleEdit(idx)}
                aria-label={`Edit ${email}`}
                title="Edit email"
                style={{
                  border: 0,
                  background: "transparent",
                  padding: "2px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--muted, #64748b)",
                  borderRadius: 4,
                }}
              >
                <Pencil size={11} />
              </button>

              {/* Remove button (minus icon) */}
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label={`Remove ${email}`}
                title="Remove email"
                style={{
                  border: 0,
                  background: "transparent",
                  padding: "2px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#ef4444",
                  borderRadius: 4,
                }}
              >
                <Minus size={12} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Row 4: Role dropdown & Send Invite button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
        <select
          name="role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as any)}
          aria-label="Invitation role"
          style={{
            flex: "1 1 auto",
            height: 36,
            minHeight: 36,
            borderRadius: 8,
            border: "1px solid var(--line, #dfe5e0)",
            background: "var(--paper, #fff)",
            color: "var(--ink, #46544b)",
            fontSize: 11.5,
            padding: "0 10px",
            boxSizing: "border-box",
            cursor: "pointer",
          }}
        >
          <option value="member">Member</option>
          <option value="manager">Manager</option>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>

        <button
          type="submit"
          className="button button-secondary"
          style={{
            height: 36,
            minHeight: 36,
            padding: "0 14px",
            fontSize: 11.5,
            fontWeight: 600,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            whiteSpace: "nowrap",
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          <Send size={12} />
          <span>
            {emailList.length > 1
              ? `Invite (${emailList.length})`
              : "Invite"}
          </span>
        </button>
      </div>
    </form>
  );
}
