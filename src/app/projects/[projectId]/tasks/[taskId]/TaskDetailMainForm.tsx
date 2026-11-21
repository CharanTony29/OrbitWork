"use client";

import React, { useState, useTransition } from "react";
import { Save, Check, Loader2 } from "lucide-react";
import { saveTaskDetailsDirect } from "@/app/actions";
import TaskDescriptionEditor from "./TaskDescriptionEditor";

interface TaskDetailMainFormProps {
  projectId: string;
  taskId: string;
  initialTitle: string;
  initialDescription: string;
  initialUpdatedAt: string;
  canEdit: boolean;
}

export default function TaskDetailMainForm({
  projectId,
  taskId,
  initialTitle,
  initialDescription,
  initialUpdatedAt,
  canEdit,
}: TaskDetailMainFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    try {
      return new Date(initialUpdatedAt).toLocaleString();
    } catch {
      return initialUpdatedAt;
    }
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit || isPending) return;

    setSaveStatus("saving");
    setErrorMessage(null);

    const fd = new FormData(e.currentTarget);
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("title", title.trim());

    startTransition(async () => {
      try {
        const res = await saveTaskDetailsDirect(fd);
        if (res.ok) {
          setSaveStatus("saved");
          setLastUpdated("Just now");
          setTimeout(() => {
            setSaveStatus("idle");
          }, 2500);
        } else {
          setSaveStatus("error");
          setErrorMessage(res.error || "Failed to save changes.");
        }
      } catch (err: any) {
        setSaveStatus("error");
        setErrorMessage(err?.message || "An unexpected error occurred while saving.");
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="task-detail-main" style={{ minWidth: 0, width: "100%" }}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />

      <label className="detail-field" style={{ minWidth: 0, width: "100%" }}>
        Task name
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={240}
          required
          readOnly={!canEdit}
          disabled={!canEdit}
          style={{
            minWidth: 0,
            width: "100%",
            boxSizing: "border-box",
            ...(!canEdit ? { background: "#f8fafc", cursor: "default" } : {}),
          }}
        />
      </label>

      <TaskDescriptionEditor
        projectId={projectId}
        taskId={taskId}
        initialValue={initialDescription}
        canEdit={canEdit}
        taskTitle={title}
      />

      {errorMessage && (
        <p className="error" role="alert" style={{ margin: "8px 0 0" }}>
          {errorMessage}
        </p>
      )}

      <div className="detail-save-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          Last updated {lastUpdated}
        </span>
        {canEdit && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            {saveStatus === "saved" && (
              <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Check size={14} /> Saved
              </span>
            )}
            <button
              type="submit"
              className="button button-primary"
              disabled={isPending || saveStatus === "saving" || !title.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {isPending || saveStatus === "saving" ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Save changes</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
