"use client";

import { useEffect, useState, useTransition } from "react";
import { updateTaskStatus } from "@/app/actions";

export type SubtaskStatusOption = {
  id: string;
  name: string;
  color: string;
  category?: string;
};

/**
 * Inline status selector pill for subtasks on the parent task detail page.
 */
export default function SubtaskStatusPicker({
  projectId,
  subtaskId,
  currentStatusId,
  statuses,
  canEdit,
}: {
  projectId: string;
  subtaskId: string;
  currentStatusId: string;
  statuses: SubtaskStatusOption[];
  canEdit: boolean;
}) {
  const [selectedId, setSelectedId] = useState(currentStatusId);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedId(currentStatusId);
  }, [currentStatusId]);

  const activeStatus = statuses.find((s) => s.id === selectedId) ?? statuses[0];
  const color = activeStatus?.color || "#526057";

  if (!canEdit || statuses.length === 0) {
    return (
      <span
        className="subtask-status-pill"
        style={{
          borderColor: color,
          color,
        }}
      >
        {activeStatus?.name ?? "New"}
      </span>
    );
  }

  const handleChange = (nextStatusId: string) => {
    if (!nextStatusId || nextStatusId === selectedId) return;
    setSelectedId(nextStatusId);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", subtaskId);
    fd.set("statusId", nextStatusId);
    startTransition(async () => {
      await updateTaskStatus(fd);
    });
  };

  return (
    <select
      className="subtask-status-select"
      value={selectedId}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Change subtask status"
      style={{
        borderColor: color,
        color,
      }}
    >
      {statuses.map((status) => (
        <option key={status.id} value={status.id}>
          {status.name}
        </option>
      ))}
    </select>
  );
}
