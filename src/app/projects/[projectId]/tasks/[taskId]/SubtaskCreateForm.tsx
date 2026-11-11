"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, UserPlus, X } from "lucide-react";
import { createTaskSubtask } from "@/app/actions";

type Member = {
  id: string;
  label: string;
};

type Props = {
  projectId: string;
  parentTaskId: string;
  members: Member[];
};

export default function SubtaskCreateForm({
  projectId,
  parentTaskId,
  members,
}: Props) {
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [pickerOpen]);

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isPending) return;

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("parentTaskId", parentTaskId);
    fd.set("title", trimmed);
    for (const id of selectedIds) {
      fd.append("assigneeIds", id);
    }

    startTransition(async () => {
      await createTaskSubtask(fd);
      setTitle("");
      setSelectedIds([]);
      setPickerOpen(false);
    });
  }

  const selectedMembers = selectedIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => Boolean(m));

  return (
    <form onSubmit={handleSubmit} className="subtask-creator-form">
      <div className="subtask-creator-row">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a subtask…"
          maxLength={240}
          required
          disabled={isPending}
          className="relationship-input"
        />

        <div className="subtask-assignee-wrap" ref={pickerRef}>
          <button
            type="button"
            className={`subtask-assignee-trigger${selectedIds.length > 0 ? " has-selection" : ""}`}
            onClick={() => setPickerOpen((v) => !v)}
            disabled={isPending}
            title="Assign users to this subtask"
          >
            <UserPlus size={13} />
            <span>
              {selectedMembers.length === 0
                ? "Assign users"
                : selectedMembers.length === 1
                ? selectedMembers[0].label.split(" ")[0]
                : `${selectedMembers.length} assignees`}
            </span>
            <ChevronDown size={12} />
          </button>

          {pickerOpen && (
            <div className="subtask-assignee-popover" role="listbox" aria-multiselectable="true">
              <div className="subtask-assignee-popover-head">
                <span>Assign subtask to</span>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    className="subtask-assignee-clear"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="subtask-assignee-options">
                {members.length === 0 ? (
                  <p className="muted small" style={{ padding: "8px 10px", margin: 0 }}>
                    No organization members found.
                  </p>
                ) : (
                  members.map((member) => {
                    const checked = selectedIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        role="option"
                        aria-selected={checked}
                        className={`subtask-assignee-option${checked ? " is-selected" : ""}`}
                        onClick={() => toggleMember(member.id)}
                      >
                        <span className="subtask-assignee-check">
                          {checked && <Check size={11} />}
                        </span>
                        <span className="subtask-assignee-name">{member.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <button className="mini-save" type="submit" disabled={isPending}>
          {isPending ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Loader2 size={12} className="spin" />
              Adding…
            </span>
          ) : (
            "+ Add subtask"
          )}
        </button>
      </div>

      {selectedMembers.length > 0 && (
        <div className="subtask-selected-chips">
          {selectedMembers.map((member) => (
            <span className="subtask-selected-chip" key={member.id}>
              <span>{member.label}</span>
              <button
                type="button"
                aria-label={`Remove ${member.label}`}
                onClick={() => toggleMember(member.id)}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
