"use client";

import React, { useState } from "react";
import DateInput from "@/app/DateInput";
import { createLeaveRequest } from "@/app/actions";

export default function LeaveRequestFormClient({
  organizationId,
  today,
  managerName,
  teammates,
}: {
  organizationId: string;
  today: string;
  managerName: string | null;
  teammates: Array<{ id: string; label: string }>;
}) {
  const [outOfOffice, setOutOfOffice] = useState(false);

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
          <label style={{ display: "grid", gap: "5px", fontSize: "10.5px", color: "var(--muted)" }}>
            Delegate Urgent &amp; High priority tasks to (optional)
            <select name="delegateUserId" defaultValue="">
              <option value="">Do not delegate tasks</option>
              {teammates.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
            <small style={{ fontSize: "10px", lineHeight: 1.4, color: "var(--muted)" }}>
              Only your open <strong>Urgent</strong> and <strong>High</strong> priority tasks will be assigned to this teammate; Normal and Low priority tasks stay with you. Manager, delegate, and you will be emailed &amp; notified in Inbox.
            </small>
          </label>
        )}
      </div>

      <button className="button button-primary">Request leave</button>
    </form>
  );
}
