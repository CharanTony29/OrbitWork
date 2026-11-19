"use client";

import React, { useState } from "react";
import DateInput from "@/app/DateInput";
import { createLeaveRequest } from "@/app/actions";
import { canDelegateRoleAligned } from "@/lib/designations";

export default function LeaveRequestFormClient({
  organizationId,
  today,
  managerName,
  teammates,
  userDesignations = [],
}: {
  organizationId: string;
  today: string;
  managerName: string | null;
  teammates: Array<{ id: string; label: string; designations?: string[]; role?: string }>;
  userDesignations?: string[];
}) {
  const [outOfOffice, setOutOfOffice] = useState(false);
  const [selectedDelegateId, setSelectedDelegateId] = useState("");

  const selectedDelegate = teammates.find((t) => t.id === selectedDelegateId);
  const delegationRoleCheck =
    selectedDelegate && userDesignations.length > 0
      ? canDelegateRoleAligned(userDesignations, selectedDelegate.designations || [])
      : null;

  return (
    <form action={createLeaveRequest} className="people-calendar-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      {managerName && (
        <div
          style={{
            fontSize: "11px",
            padding: "7px 10px",
            borderRadius: "7px",
            background: "rgba(22, 124, 88, 0.08)",
            border: "1px solid rgba(22, 124, 88, 0.22)",
            color: "var(--ink)",
          }}
        >
          Immediate approver &amp; email recipient: <strong>{managerName}</strong>
        </div>
      )}

      <label>
        Leave type
        <select name="leaveType" defaultValue="vacation">
          <option value="vacation">Vacation</option>
          <option value="sick">Sick</option>
          <option value="personal">Personal</option>
          <option value="other">Other</option>
        </select>
      </label>

      <div className="form-two-col">
        <label>
          From
          <DateInput name="startDate" min={today} required />
        </label>
        <label>
          Through
          <DateInput name="endDate" min={today} required />
        </label>
      </div>

      <label>
        Note
        <textarea name="note" maxLength={2000} placeholder="Optional context" />
      </label>

      <div
        style={{
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid var(--line, #dfe5e0)",
          background: "var(--soft, #f8fafc)",
          display: "grid",
          gap: "8px",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11.5px",
            fontWeight: 600,
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="outOfOffice"
            checked={outOfOffice}
            onChange={(e) => setOutOfOffice(e.target.checked)}
            style={{ width: "15px", height: "15px", minHeight: "unset" }}
          />
          <span>Set Out of Office &amp; optionally delegate important work</span>
        </label>

        {outOfOffice && (
          <label style={{ display: "grid", gap: "6px", fontSize: "10.5px", color: "var(--muted)" }}>
            Delegate Urgent &amp; High priority tasks to (optional)
            <select
              name="delegateUserId"
              value={selectedDelegateId}
              onChange={(e) => setSelectedDelegateId(e.target.value)}
              style={{ fontSize: "12px", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-color, #cbd5e1)" }}
            >
              <option value="">Do not delegate tasks</option>
              {teammates.map((member) => {
                const desigStr = member.designations?.length ? ` (${member.designations.join(", ")})` : "";
                return (
                  <option key={member.id} value={member.id}>
                    {member.label}{desigStr}
                  </option>
                );
              })}
            </select>

            {delegationRoleCheck && (
              <div
                style={{
                  padding: "6px 9px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  lineHeight: 1.4,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: delegationRoleCheck.isAllowed ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.12)",
                  color: delegationRoleCheck.isAllowed ? "#065f46" : "#92400e",
                  border: `1px solid ${delegationRoleCheck.isAllowed ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.35)"}`,
                }}
              >
                <span>{delegationRoleCheck.isAllowed ? "✓" : "⚠️"}</span>
                <span>
                  <strong>{delegationRoleCheck.isAllowed ? "Role aligned" : "Role advisory"}:</strong> {delegationRoleCheck.reason}
                </span>
              </div>
            )}

            <small style={{ fontSize: "10px", lineHeight: 1.4, color: "var(--muted)" }}>
              Only your open <strong>Urgent</strong> and <strong>High</strong> priority tasks will be assigned to this teammate; Normal and Low priority tasks stay with you. Teammate must hold compatible designations (e.g. Developer to Developer).
            </small>
          </label>
        )}
      </div>

      <button className="button button-primary">Request leave</button>
    </form>
  );
}
