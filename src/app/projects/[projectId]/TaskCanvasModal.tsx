"use client";

import { useState } from "react";
import { X } from "lucide-react";
import WhiteboardCanvas from "@/app/canvas/WhiteboardCanvas";
import FlowchartCanvas from "@/app/canvas/FlowchartCanvas";
import { createAndAttachCanvas, saveCanvasData } from "@/app/actions";

export default function TaskCanvasModal({
  projectId,
  taskId,
  taskTitle,
  initialType = "whiteboard",
  documentId,
  initialTitle,
  initialData,
  onClose,
  onSaved,
}: {
  projectId: string;
  taskId?: string;
  taskTitle?: string;
  initialType?: "whiteboard" | "flowchart";
  documentId?: string;
  initialTitle?: string;
  initialData?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [activeType, setActiveType] = useState<"whiteboard" | "flowchart">(initialType);
  const [docId, setDocId] = useState<string | undefined>(documentId);

  const handleSave = async ({ title, data }: { title: string; data: string }) => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("title", title);
    fd.set("type", activeType);
    fd.set("data", data);

    if (docId) {
      fd.set("documentId", docId);
      await saveCanvasData(fd);
    } else {
      if (taskId) fd.set("taskId", taskId);
      const res = await createAndAttachCanvas(fd);
      if (res?.ok && res.documentId) {
        setDocId(res.documentId);
      }
    }
    onSaved?.();
  };

  return (
    <div className="canvas-modal-backdrop" onClick={onClose}>
      <div
        className="canvas-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="canvas-modal-topbar">
          <div className="canvas-modal-tabs">
            <button
              type="button"
              className={`canvas-type-tab${activeType === "whiteboard" ? " is-active" : ""}`}
              onClick={() => setActiveType("whiteboard")}
            >
              🎨 Whiteboard
            </button>
            <button
              type="button"
              className={`canvas-type-tab${activeType === "flowchart" ? " is-active" : ""}`}
              onClick={() => setActiveType("flowchart")}
            >
              🔀 Flowchart
            </button>
          </div>

          {taskTitle && (
            <div className="canvas-modal-task-badge">
              <span>Attached to:</span>
              <strong>{taskTitle}</strong>
            </div>
          )}

          <button
            type="button"
            className="canvas-modal-close"
            onClick={onClose}
            aria-label="Close canvas"
          >
            <X size={16} />
          </button>
        </div>

        <div className="canvas-modal-body">
          {activeType === "whiteboard" ? (
            <WhiteboardCanvas
              initialData={initialData}
              title={initialTitle || (taskTitle ? `Whiteboard · ${taskTitle}` : "Whiteboard")}
              onSave={handleSave}
            />
          ) : (
            <FlowchartCanvas
              initialData={initialData}
              title={initialTitle || (taskTitle ? `Flowchart · ${taskTitle}` : "Flowchart")}
              onSave={handleSave}
            />
          )}
        </div>
      </div>
    </div>
  );
}
