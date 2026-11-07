"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Layout, GitBranch, FileText, ChevronDown } from "lucide-react";
import TaskCanvasModal from "./TaskCanvasModal";
import { attachExistingDocToTask } from "@/app/actions";

export type TaskAttachmentItem = {
  id: string;
  file_name: string;
  mime_type: string;
  external_file_id: string;
  external_url: string | null;
};

export type AvailableProjectDoc = {
  id: string;
  title: string;
  body_markdown: string;
};

export default function TaskLinkedDocsCell({
  projectId,
  taskId,
  taskTitle,
  attachments = [],
  availableDocs = [],
  canEdit = true,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  attachments: TaskAttachmentItem[];
  availableDocs: AvailableProjectDoc[];
  canEdit?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stackedMenuOpen, setStackedMenuOpen] = useState(false);
  const [modalState, setModalState] = useState<{
    open: boolean;
    type: "whiteboard" | "flowchart";
    documentId?: string;
    title?: string;
    data?: string;
  }>({ open: false, type: "whiteboard" });

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setStackedMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openExistingCanvas = (att: TaskAttachmentItem) => {
    const isWb = att.mime_type.includes("whiteboard") || att.file_name.toLowerCase().includes("whiteboard");
    const isFc = att.mime_type.includes("flowchart") || att.file_name.toLowerCase().includes("flowchart");
    if (!isWb && !isFc) {
      window.open(`/api/attachments/${att.id}`, "_blank");
      return;
    }
    const doc = availableDocs.find((d) => d.id === att.external_file_id);

    let contentData = "";
    if (doc?.body_markdown) {
      try {
        const json = JSON.parse(doc.body_markdown);
        contentData = json.content ?? "";
      } catch {
        contentData = doc.body_markdown;
      }
    }

    setModalState({
      open: true,
      type: isFc ? "flowchart" : "whiteboard",
      documentId: att.external_file_id,
      title: att.file_name,
      data: contentData,
    });
  };

  const handleLinkDoc = async (docId: string) => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("documentId", docId);
    await attachExistingDocToTask(fd);
    setMenuOpen(false);
  };

  const renderPill = (att: TaskAttachmentItem) => {
    const isWb =
      att.mime_type.includes("whiteboard") || att.file_name.toLowerCase().includes("whiteboard");
    const isFc =
      att.mime_type.includes("flowchart") || att.file_name.toLowerCase().includes("flowchart");

    return (
      <button
        key={att.id}
        type="button"
        className="linked-doc-pill"
        onClick={() => openExistingCanvas(att)}
        title={`Open ${att.file_name}`}
      >
        {isWb ? (
          <Layout size={11} className="pill-type-icon text-wb" />
        ) : isFc ? (
          <GitBranch size={11} className="pill-type-icon text-fc" />
        ) : (
          <FileText size={11} className="pill-type-icon" />
        )}
        <span className="pill-name">{att.file_name}</span>
      </button>
    );
  };

  return (
    <div className="linked-docs-cell" ref={wrapRef} style={{ position: "relative", overflow: "visible" }}>
      {/* Existing Attached Badges */}
      <div className="linked-docs-pills">
        {attachments.length > 0 && renderPill(attachments[0])}

        {attachments.length > 1 && (
          <button
            type="button"
            className="stacked-docs-pill"
            onClick={(e) => {
              e.stopPropagation();
              setStackedMenuOpen(!stackedMenuOpen);
            }}
            title={`${attachments.length} attached items (click to view all)`}
          >
            +{attachments.length - 1}
          </button>
        )}

        {/* Plus Button to add or link */}
        {canEdit && (
          <div className="linked-plus-wrap">
            <button
              type="button"
              className="linked-add-btn"
              onClick={() => setMenuOpen((v) => !v)}
              title="Attach Whiteboard, Flowchart or Document"
            >
              <Plus size={12} />
            </button>

            {menuOpen && (
              <div className="linked-add-menu">
                <span className="linked-menu-title">Attach to task</span>
                <button
                  type="button"
                  className="linked-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setModalState({ open: true, type: "whiteboard" });
                  }}
                >
                  <Layout size={13} className="text-wb" />
                  <span>New Whiteboard</span>
                </button>
                <button
                  type="button"
                  className="linked-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setModalState({ open: true, type: "flowchart" });
                  }}
                >
                  <GitBranch size={13} className="text-fc" />
                  <span>New Flowchart</span>
                </button>

                {availableDocs.length > 0 && (
                  <>
                    <div className="linked-menu-sep" />
                    <span className="linked-menu-title">Existing Documents</span>
                    <div className="linked-menu-sublist">
                      {availableDocs.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          className="linked-menu-item"
                          onClick={() => handleLinkDoc(doc.id)}
                        >
                          <FileText size={12} />
                          <span>{doc.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Stacked Menu (outside overflow:hidden container so it is fully visible) */}
      {stackedMenuOpen && (
        <div
          className="stacked-docs-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            minWidth: 200,
            maxWidth: 280,
            background: "var(--surface, #fff)",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: 8,
            boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="stacked-docs-menu-header" style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            Attached Items ({attachments.length})
          </div>
          <div className="stacked-docs-menu-list" style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
            {attachments.map((att) => {
              const isWb =
                att.mime_type.includes("whiteboard") || att.file_name.toLowerCase().includes("whiteboard");
              const isFc =
                att.mime_type.includes("flowchart") || att.file_name.toLowerCase().includes("flowchart");
              return (
                <button
                  key={att.id}
                  type="button"
                  className="stacked-docs-item"
                  onClick={() => {
                    setStackedMenuOpen(false);
                    openExistingCanvas(att);
                  }}
                  title={`Open ${att.file_name}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 8px",
                    border: 0,
                    borderRadius: 5,
                    background: "transparent",
                    color: "var(--ink)",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  {isWb ? (
                    <Layout size={12} className="pill-type-icon text-wb" style={{ flexShrink: 0 }} />
                  ) : isFc ? (
                    <GitBranch size={12} className="pill-type-icon text-fc" style={{ flexShrink: 0 }} />
                  ) : (
                    <FileText size={12} className="pill-type-icon" style={{ flexShrink: 0 }} />
                  )}
                  <span className="stacked-docs-item-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {att.file_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Canvas Modal */}
      {modalState.open && (
        <TaskCanvasModal
          projectId={projectId}
          taskId={taskId}
          taskTitle={taskTitle}
          initialType={modalState.type}
          documentId={modalState.documentId}
          initialTitle={modalState.title}
          initialData={modalState.data}
          onClose={() => setModalState({ open: false, type: "whiteboard" })}
        />
      )}
    </div>
  );
}
