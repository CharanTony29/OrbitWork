"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import ProjectViewTabsClient from "./ProjectViewTabsClient";
import TaskFilterToolbar from "./TaskFilterToolbar";
import TaskTable from "./TaskTable";
import TaskBoard from "./TaskBoard";
import TaskCalendar from "./TaskCalendar";
import TaskGantt from "./TaskGantt";
import TaskWorkload from "./TaskWorkload";
import ProjectWhiteboardView from "./ProjectWhiteboardView";
import ProjectFlowchartView from "./ProjectFlowchartView";
import ProjectChannelView from "./ProjectChannelView";
import ProjectGoalsView, { type ProjectGoalRecord } from "./ProjectGoalsView";
import ProjectAIAgentsHub from "@/app/ai/ProjectAIAgentsHub";
import ProjectBrainView from "./brain/ProjectBrainView";
import ProjectLiveTracker from "./ProjectLiveTracker";
import { ProjectTabKey } from "@/lib/project-preferences";

interface ProjectViewsManagerProps {
  projectId: string;
  projectName: string;
  projectDescription?: string | null;
  projectStatus?: string;
  projectIcon?: string;
  startDate?: string;
  dueDate?: string;
  poNumber?: string;
  clientName?: string;
  budgetAmount?: string;
  billingNotes?: string;
  workspaceName?: string;
  initialView: ProjectTabKey;
  userTabOrder: ProjectTabKey[];
  userColumnOrder?: string[];
  userColumnWidths?: Record<string, number>;
  userFrozenColumns?: string[];
  tasks: any[];
  taskCount: number;
  statuses: any[];
  members: any[];
  projectMembers: any[];
  availableMembers: any[];
  peopleList: Array<[string, string]>;
  profileAvatarList: Array<[string, string | null]>;
  customFields: any[];
  customValues: any;
  projectDocs: any[];
  attachmentsObj: Record<string, any[]>;
  commentCountsObj: Record<string, number>;
  runningTimerObj: Record<string, any>;
  billableMinutesObj: Record<string, number>;
  createdByObj: Record<string, string>;
  calendarEvents: any[];
  taskDependencies: any[];
  projectGoals: ProjectGoalRecord[];
  goalsSchemaMissing?: boolean;
  canEdit: boolean;
  canManage: boolean;
  filters: {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    page?: string;
    month?: string;
    sort?: string;
    group?: string;
  };
  currentPage: number;
  actionsRight?: React.ReactNode;
}

export default function ProjectViewsManager(props: ProjectViewsManagerProps) {
  const {
    projectId,
    projectName,
    projectDescription,
    projectStatus,
    projectIcon,
    startDate,
    dueDate,
    poNumber,
    clientName,
    budgetAmount,
    billingNotes,
    workspaceName,
    initialView,
    userTabOrder,
    userColumnOrder,
    userColumnWidths,
    userFrozenColumns,
    tasks,
    taskCount,
    statuses,
    members,
    projectMembers,
    availableMembers,
    peopleList,
    profileAvatarList,
    customFields,
    customValues,
    projectDocs,
    attachmentsObj,
    commentCountsObj,
    runningTimerObj,
    billableMinutesObj,
    createdByObj,
    calendarEvents,
    taskDependencies,
    projectGoals,
    goalsSchemaMissing,
    canEdit,
    canManage,
    filters,
    currentPage,
    actionsRight,
  } = props;

  // Local active view state for 0ms instantaneous tab switching
  const [activeView, setActiveView] = useState<ProjectTabKey>(initialView);

  // Sync state if initialView changes (e.g. browser back/forward or server redirect)
  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  // Reconstruct Maps from serialized arrays for high-performance lookups
  const people = useMemo(() => new Map<string, string>(peopleList), [peopleList]);
  const profileAvatars = useMemo(() => new Map<string, string | null>(profileAvatarList), [profileAvatarList]);
  const attachmentsMap = useMemo(() => new Map(Object.entries(attachmentsObj)), [attachmentsObj]);
  const commentCounts = useMemo(() => new Map(Object.entries(commentCountsObj).map(([k, v]) => [k, Number(v)])), [commentCountsObj]);
  const runningTimerMap = useMemo(() => new Map(Object.entries(runningTimerObj)), [runningTimerObj]);
  const billableMinutesMap = useMemo(() => new Map(Object.entries(billableMinutesObj).map(([k, v]) => [k, Number(v)])), [billableMinutesObj]);
  const createdBy = useMemo(() => new Map(Object.entries(createdByObj)), [createdByObj]);

  // Handle instant view switch without full-page server roundtrip or progress bar
  const handleSelectView = useCallback(
    (nextView: ProjectTabKey) => {
      if (nextView === activeView) return;
      setActiveView(nextView);

      // Shallow URL update so browser history & refresh work smoothly
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("view", nextView);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [activeView]
  );

  // Sync with browser history and external navigation events (e.g. sidebar sublinks)
  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const v = (sp.get("view") as ProjectTabKey) || initialView;
      setActiveView(v);
    };
    const handleExternalSwitch = (e: any) => {
      if (e?.detail?.view) {
        handleSelectView(e.detail.view);
      }
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("orbitwork:switch-project-tab", handleExternalSwitch);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("orbitwork:switch-project-tab", handleExternalSwitch);
    };
  }, [initialView, handleSelectView]);

  // Pagination helper URL
  const getPageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("view", activeView);
    params.set("page", String(p));
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.assignee) params.set("assignee", filters.assignee);
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.month) params.set("month", filters.month);
    if (filters.group) params.set("group", filters.group);
    return `/projects/${projectId}?${params.toString()}`;
  };

  return (
    <>
      <nav className="view-tabs" aria-label="Task views">
        <ProjectViewTabsClient
          projectId={projectId}
          activeView={activeView}
          initialTabOrder={userTabOrder}
          preservedFilters={filters}
          onViewSelect={handleSelectView}
        />
        {actionsRight}
      </nav>

      {activeView !== "channel" &&
        activeView !== "goals" &&
        activeView !== "agents" &&
        activeView !== "brain" &&
        activeView !== "live" && (
          <TaskFilterToolbar
            projectId={projectId}
            projectName={projectName}
            statuses={statuses}
            members={members}
            customFields={customFields}
            currentFilters={{
              ...filters,
              view: activeView,
            }}
          />
        )}

      <div
        className="project-active-view-content"
        style={{
          width: "100%",
          flex: "1 1 0px",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflowY: "auto",
          overflowX: "auto",
        }}
      >
        {activeView === "live" ? (
          <ProjectLiveTracker
            projectId={projectId}
            projectName={projectName}
            workspaceName={workspaceName}
            initialTasks={tasks}
            statuses={statuses}
            people={people}
            canEdit={canEdit}
          />
        ) : activeView === "list" ? (
          <TaskTable
            projectId={projectId}
            canEdit={canEdit}
            initialColumnOrder={userColumnOrder}
            initialColumnWidths={userColumnWidths}
            initialFrozenColumns={userFrozenColumns}
            tasks={tasks.map((task) => ({
              ...task,
              billable_minutes: billableMinutesMap.get(task.id) ?? 0,
            }))}
            statuses={statuses}
            members={members}
            createdBy={createdBy}
            customFields={customFields}
            customValues={customValues}
            attachmentsMap={attachmentsMap}
            projectDocuments={projectDocs}
            commentCounts={commentCounts}
            runningTimerMap={runningTimerMap}
            initialGroupBy={filters.group || "status"}
          />
        ) : activeView === "board" ? (
          <TaskBoard
            projectId={projectId}
            canEdit={canEdit}
            tasks={tasks}
            statuses={statuses}
            people={people}
            profileAvatars={profileAvatars}
          />
        ) : activeView === "calendar" ? (
          <TaskCalendar
            projectId={projectId}
            tasks={tasks.map((task) => ({
              ...task,
              status_category: statuses.find((s: any) => s.id === task.status_id)?.category,
            }))}
            statuses={statuses}
            events={calendarEvents}
            month={filters.month}
          />
        ) : activeView === "gantt" ? (
          <TaskGantt
            projectId={projectId}
            tasks={tasks.map((task) => ({
              id: task.id,
              generated_key: task.generated_key,
              title: task.title,
              start_date: task.start_date,
              due_date: task.due_date,
              progress: task.progress,
              created_at: task.created_at,
              parent_task_id: task.parent_task_id,
              status_id: task.status_id,
              status_category: statuses.find((s: any) => s.id === task.status_id)?.category,
              assigneeIds: task.assigneeIds,
            }))}
            events={calendarEvents}
            people={people}
            profileAvatars={profileAvatars}
            month={filters.month}
            dependencies={taskDependencies}
          />
        ) : activeView === "whiteboard" ? (
          <ProjectWhiteboardView projectId={projectId} documents={projectDocs} />
        ) : activeView === "flowchart" ? (
          <ProjectFlowchartView projectId={projectId} documents={projectDocs} />
        ) : activeView === "channel" ? (
          <ProjectChannelView projectId={projectId} projectName={projectName} />
        ) : activeView === "goals" ? (
          <ProjectGoalsView
            projectId={projectId}
            projectName={projectName}
            canEdit={canEdit}
            members={members}
            initialGoals={projectGoals}
            schemaMissing={Boolean(goalsSchemaMissing)}
          />
        ) : activeView === "agents" ? (
          <ProjectAIAgentsHub projectId={projectId} projectName={projectName} />
        ) : activeView === "brain" ? (
          <ProjectBrainView projectId={projectId} projectName={projectName} canEdit={canEdit} />
        ) : (
          <TaskWorkload
            projectId={projectId}
            tasks={tasks.map(({ id, generated_key, title, estimate_minutes, primary_assignee_id, secondary_assignee_id, due_date }) => ({
              id,
              generated_key,
              title,
              estimate_minutes,
              primary_assignee_id,
              secondary_assignee_id,
              due_date,
            }))}
            people={people}
            profileAvatars={profileAvatars}
            events={calendarEvents}
            members={members}
            startDate={startDate}
            dueDate={dueDate}
          />
        )}
      </div>

      {activeView !== "channel" &&
        activeView !== "goals" &&
        activeView !== "agents" &&
        activeView !== "brain" &&
        activeView !== "live" &&
        taskCount > 100 && (
          <div className="task-pagination">
            {currentPage > 1 && <Link href={getPageHref(currentPage - 1)}>Previous</Link>}
            <span>
              Page {currentPage} of {Math.ceil(taskCount / 100)}
            </span>
            {currentPage * 100 < taskCount && <Link href={getPageHref(currentPage + 1)}>Next</Link>}
          </div>
        )}
    </>
  );
}
