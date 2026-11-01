"use client";

import { useState } from "react";
import WhiteboardCanvas from "@/app/canvas/WhiteboardCanvas";
import FlowchartCanvas from "@/app/canvas/FlowchartCanvas";
import { createAndAttachCanvas, saveCanvasData } from "@/app/actions";

export default function TaskDetailCanvas({
  projectId,
  taskId,
  taskTitle,
  type,
  existingDocId,
  initialData,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  type: "whiteboard" | "flowchart";
  existingDocId?: string;
  initialData?: string;
}) {
  const [docId, setDocId] = useState<string | undefined>(existingDocId);

  const handleSave = async ({ title, data }: { title: string; data: string }) => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("title", title);
    fd.set("type", type);
    fd.set("data", data);

    if (docId) {
      fd.set("documentId", docId);
      await saveCanvasData(fd);
    } else {
      const res = await createAndAttachCanvas(fd);
      if (res?.ok && res.documentId) {
        setDocId(res.documentId);
      }
    }
  };

  return (
    <div className="task-detail-canvas-container">
      {type === "whiteboard" ? (
        <WhiteboardCanvas
          key={docId ?? "new_wb"}
          initialData={initialData}
          title={taskTitle ? `Whiteboard · ${taskTitle}` : "Task Whiteboard"}
          onSave={handleSave}
        />
      ) : (
        <FlowchartCanvas
          key={docId ?? "new_fc"}
          initialData={initialData}
          title={taskTitle ? `Flowchart · ${taskTitle}` : "Task Flowchart"}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
