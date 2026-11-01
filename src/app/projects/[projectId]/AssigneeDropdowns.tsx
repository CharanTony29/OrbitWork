"use client";

import { useState, useTransition } from "react";
import { updateTaskAssignees } from "@/app/actions";

type Member = { id: string; label: string };

export default function AssigneeDropdowns({
  projectId,
  taskId,
  members,
  initialPrimary,
  initialSecondary,
  compact = false,
}: {
  projectId: string;
  taskId: string;
  members: Member[];
  initialPrimary: string | null;
  initialSecondary: string | null;
  compact?: boolean;
}) {
  const [primary, setPrimary] = useState(initialPrimary ?? "");
  const [secondary, setSecondary] = useState(initialSecondary ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function save(nextPrimary: string, nextSecondary: string, previousPrimary: string, previousSecondary: string) {
    setPrimary(nextPrimary);
    setSecondary(nextSecondary);
    setMessage("Saving…");
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("taskId", taskId);
    formData.set("primaryAssigneeId", nextPrimary);
    formData.set("secondaryAssigneeId", nextSecondary);
    startTransition(async () => {
      const result = await updateTaskAssignees(formData);
      if (result.ok) setMessage("Saved");
      else {
        setPrimary(previousPrimary);
        setSecondary(previousSecondary);
        setMessage("Could not save");
      }
    });
  }

  return <div className={`assignee-dropdowns${compact ? " compact" : ""}`}>
    <label>Primary<select value={primary} disabled={pending} onChange={(event) => {
      const value = event.currentTarget.value;
      save(value, value && value === secondary ? "" : secondary, primary, secondary);
    }}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}</select></label>
    <label>Secondary<select value={secondary} disabled={pending} onChange={(event) => {
      const value = event.currentTarget.value;
      save(value && value === primary ? "" : primary, value, primary, secondary);
    }}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}</select></label>
    <span className="assignee-save-state" role="status" aria-live="polite">{pending ? "Saving…" : message}</span>
  </div>;
}
