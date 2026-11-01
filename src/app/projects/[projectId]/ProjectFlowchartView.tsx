"use client";

import { useState } from "react";
import FlowchartCanvas from "@/app/canvas/FlowchartCanvas";
import { createAndAttachCanvas, saveCanvasData } from "@/app/actions";
import { Plus, GitBranch } from "lucide-react";

type DocItem = {
  id: string;
  title: string;
  body_markdown: string;
  updated_at: string;
};

export default function ProjectFlowchartView({
  projectId,
  documents,
}: {
  projectId: string;
  documents: DocItem[];
}) {
  const flowchartDocs = documents.filter((d) => {
    try {
      const parsed = JSON.parse(d.body_markdown);
      return parsed.canvasType === "flowchart";
    } catch {
      return d.title.toLowerCase().includes("flowchart");
    }
  });

  const [activeDoc, setActiveDoc] = useState<DocItem | null>(flowchartDocs[0] ?? null);
  const [docList, setDocList] = useState(flowchartDocs);

  const getCanvasData = (body: string) => {
    try {
      const parsed = JSON.parse(body);
      return parsed.content ?? "";
    } catch {
      return "";
    }
  };

  const handleSave = async ({ title, data }: { title: string; data: string }) => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("title", title);
    fd.set("type", "flowchart");
    fd.set("data", data);

    if (activeDoc) {
      fd.set("documentId", activeDoc.id);
      await saveCanvasData(fd);
    } else {
      const res = await createAndAttachCanvas(fd);
      if (res?.ok && res.documentId) {
        const newDoc: DocItem = {
          id: res.documentId,
          title,
          body_markdown: JSON.stringify({ canvasType: "flowchart", content: data }),
          updated_at: new Date().toISOString(),
        };
        setActiveDoc(newDoc);
        setDocList((prev) => [newDoc, ...prev]);
      }
    }
  };

  const handleNew = () => {
    setActiveDoc(null);
  };

  return (
    <div className="project-canvas-view-container">
      {/* Sidebar with flowcharts */}
      <aside className="canvas-view-sidebar">
        <div className="canvas-sidebar-header">
          <h3>Flowcharts</h3>
          <button type="button" className="canvas-new-btn" onClick={handleNew} title="New Flowchart">
            <Plus size={14} />
            <span>New</span>
          </button>
        </div>

        <div className="canvas-doc-list">
          {docList.length === 0 ? (
            <p className="canvas-sidebar-empty">No flowcharts yet. Click New to build one!</p>
          ) : (
            docList.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`canvas-doc-item${activeDoc?.id === doc.id ? " is-active" : ""}`}
                onClick={() => setActiveDoc(doc)}
              >
                <GitBranch size={13} className="doc-item-icon" />
                <span className="doc-item-title">{doc.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="canvas-view-main">
        <FlowchartCanvas
          key={activeDoc?.id ?? "new"}
          initialData={activeDoc ? getCanvasData(activeDoc.body_markdown) : undefined}
          title={activeDoc?.title ?? "Project Flowchart"}
          onSave={handleSave}
        />
      </main>
    </div>
  );
}
