"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { setTaskAssignees } from "@/app/actions";

type Member = { id: string; label: string };

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
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAssignees(initialAssignees);
  }, [initialAssignees]);

  function commit(next: string[]) {
    const validIds = next.filter((id) => Boolean(id && id.trim()));
    setAssignees(next);
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      validIds.forEach((id) => fd.append("assigneeIds", id));
      const result = await setTaskAssignees(fd);
      if (result.ok) {
        setStatus("saved");
        saveTimer.current = setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
      }
    });
  }

  function addSlot() {
    // Just add an empty slot locally for user selection without prematurely committing empty string
    setAssignees((prev) => [...prev, ""]);
  }

  function changeSlot(index: number, value: string) {
    if (!value) {
      removeSlot(index);
      return;
    }
    const next = assignees.map((id, i) => (i === index ? value : id));
    commit(next.filter(Boolean));
  }

  function removeSlot(index: number) {
    const next = assignees.filter((_, i) => i !== index);
    commit(next.filter(Boolean));
  }

  const usedIds = new Set(assignees.filter(Boolean));

  return (
    <div className={`assignee-picker-multi${pending ? " is-saving" : ""}`}>
      {assignees.map((assigneeId, index) => (
        <div className="assignee-slot" key={index}>
          <span className="assignee-slot-num">{index + 1}</span>
          <select
            value={assigneeId}
            disabled={pending}
            aria-label={`Assignee ${index + 1}`}
            onChange={(e) => changeSlot(index, e.currentTarget.value)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option
                key={member.id}
                value={member.id}
                disabled={usedIds.has(member.id) && member.id !== assigneeId}
              >
                {member.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="assignee-slot-remove"
            aria-label="Remove assignee"
            disabled={pending}
            onClick={() => removeSlot(index)}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="assignee-add-btn"
        disabled={pending || assignees.length >= members.length}
        onClick={addSlot}
      >
        + Add assignee
      </button>
      {status !== "idle" && (
        <span className="assignee-save-state" role="status" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Could not save"}
        </span>
      )}
    </div>
  );
}
