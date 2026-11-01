"use client";

import { useState } from "react";
import WhiteboardCanvas from "@/app/canvas/WhiteboardCanvas";
import { createAndAttachCanvas, saveCanvasData } from "@/app/actions";
import { Plus, Layout } from "lucide-react";

type DocItem = {
  id: string;
  title: string;
  body_markdown: string;
  updated_at: string;
};

export default function ProjectWhiteboardView({
  projectId,
  documents,
}: {
  projectId: string;
  documents: DocItem[];
}) {
  // Filter for whiteboard docs or all
  const whiteboardDocs = documents.filter((d) => {
    try {
      const parsed = JSON.parse(d.body_markdown);
      return parsed.canvasType === "whiteboard";
    } catch {
      return d.title.toLowerCase().includes("whiteboard");
    }
  });

  const [activeDoc, setActiveDoc] = useState<DocItem | null>(whiteboardDocs[0] ?? null);
  const [docList, setDocList] = useState(whiteboardDocs);

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
    fd.set("type", "whiteboard");
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
          body_markdown: JSON.stringify({ canvasType: "whiteboard", content: data }),
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
      {/* Sidebar with boards */}
      <aside className="canvas-view-sidebar">
        <div className="canvas-sidebar-header">
          <h3>Whiteboards</h3>
          <button type="button" className="canvas-new-btn" onClick={handleNew} title="New Whiteboard">
            <Plus size={14} />
            <span>New</span>
          </button>
        </div>

        <div className="canvas-doc-list">
          {docList.length === 0 ? (
            <p className="canvas-sidebar-empty">No saved whiteboards yet. Click New to sketch!</p>
          ) : (
            docList.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`canvas-doc-item${activeDoc?.id === doc.id ? " is-active" : ""}`}
                onClick={() => setActiveDoc(doc)}
              >
                <Layout size={13} className="doc-item-icon" />
                <span className="doc-item-title">{doc.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="canvas-view-main">
        <WhiteboardCanvas
          key={activeDoc?.id ?? "new"}
          initialData={activeDoc ? getCanvasData(activeDoc.body_markdown) : undefined}
          title={activeDoc?.title ?? "Project Whiteboard"}
          onSave={handleSave}
        />
      </main>
    </div>
  );
}
