"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import TaskDetailCanvas from "./TaskDetailCanvas";

interface TaskDetailTabsViewProps {
  projectId: string;
  taskId: string;
  taskTitle: string;
  canEdit: boolean;
  wbAtt: boolean;
  fcAtt: boolean;
  wbDocId?: string;
  wbData: string;
  fcDocId?: string;
  fcData: string;
  initialTab?: string;
  children: React.ReactNode;
}

export default function TaskDetailTabsView({
  projectId,
  taskId,
  taskTitle,
  canEdit,
  wbAtt,
  fcAtt,
  wbDocId,
  wbData,
  fcDocId,
  fcData,
  initialTab = "details",
  children,
}: TaskDetailTabsViewProps) {
  const [tab, setTab] = useState<"details" | "whiteboard" | "flowchart">(
    ["details", "whiteboard", "flowchart"].includes(initialTab)
      ? (initialTab as "details" | "whiteboard" | "flowchart")
      : "details"
  );
  const pathname = usePathname();

  // Listen to popstate (back/forward button)
  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("tab");
      if (t === "whiteboard" || t === "flowchart") {
        setTab(t);
      } else {
        setTab("details");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleSelectTab = (nextTab: "details" | "whiteboard" | "flowchart") => {
    setTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (nextTab === "details") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", nextTab);
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <>
      <nav className="task-detail-tabs" aria-label="Task tabs">
        <button
          type="button"
          className={`task-tab-link${tab === "details" ? " is-active" : ""}`}
          onClick={() => handleSelectTab("details")}
        >
          Task Details
        </button>
        <button
          type="button"
          className={`task-tab-link${tab === "whiteboard" ? " is-active" : ""}`}
          onClick={() => handleSelectTab("whiteboard")}
        >
          🎨 Whiteboard {wbAtt && <span className="tab-attached-dot" title="Whiteboard attached" />}
        </button>
        <button
          type="button"
          className={`task-tab-link${tab === "flowchart" ? " is-active" : ""}`}
          onClick={() => handleSelectTab("flowchart")}
        >
          🔀 Flowchart {fcAtt && <span className="tab-attached-dot" title="Flowchart attached" />}
        </button>
      </nav>

      {tab === "whiteboard" ? (
        <TaskDetailCanvas
          projectId={projectId}
          taskId={taskId}
          taskTitle={taskTitle}
          type="whiteboard"
          existingDocId={wbDocId}
          initialData={wbData}
          readOnly={!canEdit}
        />
      ) : tab === "flowchart" ? (
        <TaskDetailCanvas
          projectId={projectId}
          taskId={taskId}
          taskTitle={taskTitle}
          type="flowchart"
          existingDocId={fcDocId}
          initialData={fcData}
          readOnly={!canEdit}
        />
      ) : (
        children
      )}
    </>
  );
}
