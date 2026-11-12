import { notFound, redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import BackButton from "@/app/BackButton";
import Link from "next/link";
import { ArrowLeft, GitBranch, MessageSquareText, Save, Eye, ExternalLink } from "lucide-react";
import { addManualTimeEntry, createTaskDependency, removeTaskDependency, startTaskTimer, stopTaskTimer, updateTask } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { saveTaskCustomField } from "@/app/actions";
import { formatEstimate, formatEstimateDetailed, formatMinutes, formatRemaining } from "@/lib/work";
import TaskDetailCanvas from "./TaskDetailCanvas";
import TaskAttachmentsSection from "./TaskAttachmentsSection";
import TaskDetailProgress from "./TaskDetailProgress";
import TaskHeaderTimer from "./TaskHeaderTimer";
import TaskDescriptionEditor from "./TaskDescriptionEditor";
import TaskPropertiesPanel from "./TaskPropertiesPanel";
import SubtaskCreateForm from "./SubtaskCreateForm";
import SubtaskStatusPicker from "./SubtaskStatusPicker";
import TaskChecklistsSection from "./TaskChecklistsSection";
import AssigneePicker from "../../AssigneePicker";
import MultiValueFieldInput from "@/app/MultiValueFieldInput";
import TaskCommentForm from "./TaskCommentForm";
import FavoriteButton from "@/app/FavoriteButton";
import DateInput from "@/app/DateInput";

const attachmentMessages: Record<string, string> = {
  uploaded: "File uploaded to workspace Google Drive storage.",
  too_large: "Files must be between 1 byte and 15 MB.",
  save_failed: "The Drive upload succeeded, but the app could not save its file reference.",
};
const driveErrorMessages: Record<string, string> = {
  not_connected: "Google Drive storage is not connected for this workspace. A Workspace Manager or Owner can connect it in Workspace Settings.",
  configuration: "Google Drive setup is incomplete. Ask an administrator to check the app’s Drive configuration.",
  reconnect: "The Google Drive connection has expired. Ask a workspace manager or owner to reconnect it.",
  permissions: "Google Drive denied this upload. Check the connected account’s access and available storage.",
  api_disabled: "The Google Drive API is disabled for the connected Google Cloud project. Ask an administrator to enable it.",
  quota: "Google Drive storage or request quota was exceeded. Check the connected account’s storage and try again later.",
  request_failed: "The Google Drive request failed. Ask an administrator to check the server logs for the Drive error.",
};

export default async function TaskDetailPage({ params, searchParams }: {
  params: Promise<{ projectId: string; taskId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; attachment?: string; attachment_error?: string; driveError?: string; tab?: string }>;
}) {
  const { projectId, taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase.from("projects").select("id, name, workspace_id, workspaces(name, organization_id)").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const { data: task } = await supabase.from("tasks").select("id, project_id, parent_task_id, generated_key, title, task_type, tags, description, status_id, priority, start_date, due_date, estimate_minutes, progress, created_by, primary_assignee_id, secondary_assignee_id, created_at, updated_at").eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (!task) notFound();
  const { data: statuses } = await supabase.from("project_statuses").select("id, name, color, category").eq("project_id", projectId).order("position");
  const { data: comments } = await supabase.from("task_comments").select("id, author_id, body, created_at").eq("task_id", taskId).order("created_at");
  const { data: customFields } = await supabase.from("custom_field_definitions").select("id, name, field_type, options, required, position").eq("project_id", projectId).order("position");
  const { data: customFieldValues } = await supabase.from("task_custom_field_values").select("field_id, value").eq("project_id", projectId).eq("task_id", taskId);
  const { data: subtasks } = await supabase.from("tasks").select("id, generated_key, title, status_id, due_date, primary_assignee_id, secondary_assignee_id").eq("project_id", projectId).eq("parent_task_id", taskId).order("created_at");
  const subtaskIds = (subtasks ?? []).map((s) => s.id);
  const { data: subtaskAssigneesRaw } = subtaskIds.length ? await supabase.from("task_assignees").select("task_id, user_id").in("task_id", subtaskIds) : { data: [] };
  const { data: currentTaskAssigneesRaw } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId);
  const { data: projectTasks } = await supabase.from("tasks").select("id, generated_key, title").eq("project_id", projectId).order("created_at", { ascending: false });
  const { data: dependencies } = await supabase.from("task_dependencies").select("linked_task_id, relation").eq("project_id", projectId).eq("task_id", taskId);
  const linkedIds = [...new Set((dependencies ?? []).map((dependency) => dependency.linked_task_id))];
  const { data: linkedTasks } = linkedIds.length ? await supabase.from("tasks").select("id, generated_key, title").in("id", linkedIds) : { data: [] };
  const linkedTaskMap = new Map((linkedTasks ?? []).map((linked) => [linked.id, linked]));
  const { data: checklists } = await supabase.from("task_checklists").select("id, title").eq("project_id", projectId).eq("task_id", taskId).order("position");
  const checklistIds = (checklists ?? []).map((checklist) => checklist.id);
  const { data: checklistItems } = checklistIds.length ? await supabase.from("checklist_items").select("id, checklist_id, title, is_complete, position").in("checklist_id", checklistIds).order("position") : { data: [] };
  const { data: timeEntries } = await supabase.from("time_entries").select("id, user_id, started_at, ended_at, duration_minutes, description, billable").eq("project_id", projectId).eq("task_id", taskId).order("started_at", { ascending: false }).limit(100);
  const { data: attachments } = await supabase.from("task_attachments").select("id, file_name, mime_type, file_size_bytes, storage_provider, external_file_id, external_url, uploaded_by, created_at").eq("project_id", projectId).eq("task_id", taskId).order("created_at", { ascending: false });
  const activityTaskIds = [taskId, ...subtaskIds];
  const { data: activityEventsRaw } = await supabase.from("project_activity_events").select("id, task_id, actor_id, event_type, details, created_at").eq("project_id", projectId).in("task_id", activityTaskIds).order("created_at", { ascending: false }).limit(100);
  const loggedSubtaskIds = new Set(
    (activityEventsRaw ?? [])
      .filter((event) => event.task_id === taskId && event.event_type === "subtask_added")
      .map((event) => {
        const d = event.details && typeof event.details === "object" ? (event.details as Record<string, unknown>) : null;
        return typeof d?.subtask_id === "string" ? d.subtask_id : null;
      })
      .filter((id): id is string => Boolean(id))
  );
  const activityEvents = (activityEventsRaw ?? []).filter(
    (event) =>
      event.task_id === taskId ||
      (event.event_type === "task_created" && !loggedSubtaskIds.has(event.task_id))
  );
  const { data: anyRunningTimer } = await supabase.from("time_entries").select("id, user_id, started_at, billable").eq("task_id", taskId).is("ended_at", null).maybeSingle();
  let isTaskFavorited = false;
  const { data: taskFav, error: taskFavError } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .maybeSingle();
  if (!taskFavError && taskFav) {
    isTaskFavorited = true;
  }
  const { data: canEditData } = await supabase.rpc("can_edit_project_tasks", { target_project: projectId });
  const canEdit = Boolean(canEditData);
  const taskStatus = (statuses ?? []).find((s) => s.id === task.status_id);

  // Find canvas attachments (whiteboard / flowchart)
  const canvasAtts = (attachments ?? []).filter((a) => a.mime_type.includes("whiteboard") || a.mime_type.includes("flowchart") || a.file_name.toLowerCase().includes("whiteboard") || a.file_name.toLowerCase().includes("flowchart"));
  const canvasDocIds = canvasAtts.map((a) => a.external_file_id).filter(Boolean);
  const { data: canvasDocs } = canvasDocIds.length ? await supabase.from("project_documents").select("id, title, body_markdown").in("id", canvasDocIds) : { data: [] };
  const canvasDocMap = new Map((canvasDocs ?? []).map((d) => [d.id, d]));

  const wbAtt = canvasAtts.find((a) => a.mime_type.includes("whiteboard") || a.file_name.toLowerCase().includes("whiteboard"));
  const wbDoc = wbAtt ? canvasDocMap.get(wbAtt.external_file_id) : undefined;
  let wbData = "";
  if (wbDoc?.body_markdown) {
    try { wbData = JSON.parse(wbDoc.body_markdown).content ?? ""; } catch { wbData = wbDoc.body_markdown; }
  }

  const fcAtt = canvasAtts.find((a) => a.mime_type.includes("flowchart") || a.file_name.toLowerCase().includes("flowchart"));
  const fcDoc = fcAtt ? canvasDocMap.get(fcAtt.external_file_id) : undefined;
  let fcData = "";
  if (fcDoc?.body_markdown) {
    try { fcData = JSON.parse(fcDoc.body_markdown).content ?? ""; } catch { fcData = fcDoc.body_markdown; }
  }
  const workspace = Array.isArray(project.workspaces) ? project.workspaces[0] : project.workspaces;
  const orgId = workspace?.organization_id;
  const { data: orgMembers } = orgId ? await supabase.from("organization_members").select("user_id").eq("organization_id", orgId).eq("status", "active") : { data: [] };
  const peopleIds = [...new Set([...(comments ?? []).map((comment) => comment.author_id), ...(timeEntries ?? []).map((entry) => entry.user_id), ...(attachments ?? []).map((item) => item.uploaded_by), ...(activityEvents ?? []).map((event) => event.actor_id).filter((id): id is string => Boolean(id)), ...(orgMembers ?? []).map((member) => member.user_id), task.created_by, anyRunningTimer?.user_id, ...[task.primary_assignee_id, task.secondary_assignee_id].filter((id): id is string => Boolean(id)), ...(subtasks ?? []).flatMap((s) => [s.primary_assignee_id, s.secondary_assignee_id].filter((id): id is string => Boolean(id))), ...(subtaskAssigneesRaw ?? []).map((row) => row.user_id).filter((id): id is string => Boolean(id))].filter((id): id is string => Boolean(id)))];
  const { data: authors } = peopleIds.length ? await supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", peopleIds) : { data: [] };
  const profileById = new Map((authors ?? []).map((profile) => [profile.id, profile]));
  const profileLabel = (id: string) => { const profile = profileById.get(id); return profile?.display_name?.trim() || profile?.email || "Team member"; };
  const subtaskAssigneesMap = new Map<string, string[]>();
  for (const s of subtasks ?? []) {
    const ids = new Set<string>();
    if (s.primary_assignee_id) ids.add(s.primary_assignee_id);
    if (s.secondary_assignee_id) ids.add(s.secondary_assignee_id);
    for (const row of subtaskAssigneesRaw ?? []) {
      if (row.task_id === s.id && row.user_id) ids.add(row.user_id);
    }
    subtaskAssigneesMap.set(s.id, [...ids]);
  }
  const members = (orgMembers ?? []).map((member) => ({ id: member.user_id, label: profileLabel(member.user_id) }));
  const taskInitialAssignees = [
    ...new Set([
      ...(task.primary_assignee_id ? [task.primary_assignee_id] : []),
      ...(task.secondary_assignee_id ? [task.secondary_assignee_id] : []),
      ...(currentTaskAssigneesRaw ?? []).map((row) => row.user_id).filter(Boolean),
    ]),
  ];
  const customValueMap = new Map((customFieldValues ?? []).map((item) => [item.field_id, item.value]));

  const runningTimer = anyRunningTimer ? {
    id: anyRunningTimer.id,
    started_at: anyRunningTimer.started_at,
    billable: anyRunningTimer.billable ?? true,
    user_id: anyRunningTimer.user_id,
    user_name: profileLabel(anyRunningTimer.user_id),
    is_current_user: anyRunningTimer.user_id === user.id,
  } : null;
  const billableMinutes = (timeEntries ?? [])
    .filter((e) => e.billable && e.duration_minutes)
    .reduce((acc, e) => acc + (e.duration_minutes || 0), 0);
  const remainingInfo = formatRemaining(task.estimate_minutes, billableMinutes);
  const { error, saved, attachment, attachment_error, driveError, tab: queryTab } = await searchParams;
  const tab = ["details", "whiteboard", "flowchart"].includes(queryTab ?? "") ? queryTab! : "details";

  return <main className="app-shell">
    <AppTopBar email={user.email ?? ""} />
    <div className="task-detail-page">
      <div className="task-detail-nav"><BackButton fallbackHref={`/projects/${projectId}`} label={project.name}/><span className="task-key">{task.generated_key}</span></div>
      <div className="task-detail-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p className="eyebrow">TASK DETAILS</p>
            {!canEdit && (
              <span className="role-pill" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontSize: '11px', padding: '1px 7px' }}>
                View-only
              </span>
            )}
          </div>
          <div className="task-detail-title-row">
            <h1>{task.title}</h1>
            <span className="task-type-badge">{(task.task_type ?? "task").replaceAll("_", " ")}</span>
            {(task.tags ?? []).map((tag: string) => <span className="task-tag-badge" key={tag}>{tag}</span>)}
            <FavoriteButton
              entityType="task"
              entityId={taskId}
              projectId={projectId}
              title={task.title}
              subtitle={`${project.name} · Task`}
              initialFavorited={isTaskFavorited}
              label="Favorite"
              compact
            />
          </div>
          <p className="muted">{workspace?.name ?? "Workspace"} <span className="crumb-dot">·</span> {project.name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <TaskHeaderTimer
            projectId={projectId}
            taskId={taskId}
            taskTitle={task.title}
            runningEntry={runningTimer}
            canEdit={canEdit}
          />
          <TaskDetailProgress
            projectId={projectId}
            taskId={taskId}
            initialProgress={task.progress ?? 0}
            canEdit={canEdit}
            checklistTotal={(checklistItems ?? []).length}
            checklistCompleted={(checklistItems ?? []).filter((i) => i.is_complete).length}
          />
        </div>
      </div>
      
      <nav className="task-detail-tabs" aria-label="Task tabs">
        <Link className={`task-tab-link${tab === "details" ? " is-active" : ""}`} href={`/projects/${projectId}/tasks/${taskId}`}>
          Task Details
        </Link>
        <Link className={`task-tab-link${tab === "whiteboard" ? " is-active" : ""}`} href={`/projects/${projectId}/tasks/${taskId}?tab=whiteboard`}>
          🎨 Whiteboard {wbAtt && <span className="tab-attached-dot" title="Whiteboard attached" />}
        </Link>
        <Link className={`task-tab-link${tab === "flowchart" ? " is-active" : ""}`} href={`/projects/${projectId}/tasks/${taskId}?tab=flowchart`}>
          🔀 Flowchart {fcAtt && <span className="tab-attached-dot" title="Flowchart attached" />}
        </Link>
      </nav>

      {tab === "whiteboard" ? (
        <TaskDetailCanvas
          projectId={projectId}
          taskId={taskId}
          taskTitle={task.title}
          type="whiteboard"
          existingDocId={wbDoc?.id}
          initialData={wbData}
          readOnly={!canEdit}
        />
      ) : tab === "flowchart" ? (
        <TaskDetailCanvas
          projectId={projectId}
          taskId={taskId}
          taskTitle={task.title}
          type="flowchart"
          existingDocId={fcDoc?.id}
          initialData={fcData}
          readOnly={!canEdit}
        />
      ) : (
        <>
          {!canEdit && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '13px' }}>
              <Eye size={16} style={{ color: '#64748b', flexShrink: 0 }} />
              <span>You have view-only access to this project. Editing fields, time tracking, checklists, and uploads are disabled.</span>
            </div>
          )}
          {saved && <p className="notice" role="status">Task changes saved.</p>}
          {error && <p className="error" role="alert">Could not save those changes. Check that the due date is not before the start date.</p>}

          <div className="task-detail-two-col">
            {/* Left Column (Wide): Task execution, subtasks, checklists, attachments, comments */}
            <div className="task-detail-left-col">
              <form action={updateTask} className="task-detail-main">
                <input type="hidden" name="projectId" value={projectId}/>
                <input type="hidden" name="taskId" value={taskId}/>

                <label className="detail-field">
                  Task name
                  <input
                    name="title"
                    defaultValue={task.title}
                    maxLength={240}
                    required
                    readOnly={!canEdit}
                    disabled={!canEdit}
                    style={!canEdit ? { background: '#f8fafc', cursor: 'default' } : undefined}
                  />
                </label>
                <TaskDescriptionEditor
                  projectId={projectId}
                  taskId={taskId}
                  initialValue={task.description}
                  canEdit={canEdit}
                />
                <div className="detail-save-row">
                  <span>Last updated {new Date(task.updated_at).toLocaleString()}</span>
                  {canEdit && <button className="button button-primary"><Save size={15}/> Save changes</button>}
                </div>
              </form>

              {/* Subtasks (Child Tasks) */}
              {(() => {
                const totalSubtasks = subtasks?.length ?? 0;
                const completedSubtasks = (subtasks ?? []).filter((subtask) => {
                  const statusObj = statuses?.find((status) => status.id === subtask.status_id);
                  if (!statusObj) return false;
                  const category = (statusObj.category ?? "").toLowerCase();
                  const name = statusObj.name.toLowerCase();
                  return (
                    category === "completed" ||
                    category === "done" ||
                    name.includes("complete") ||
                    name.includes("done") ||
                    name.includes("closed")
                  );
                }).length;
                const subtaskPercent =
                  totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

                return (
                  <section className="task-subtasks">
                    <div className="relationship-heading">
                      <div>
                        <p className="eyebrow">CHILD TASKS</p>
                        <h2>Subtasks <span className="count-pill">{totalSubtasks}</span></h2>
                      </div>
                    </div>
                    {totalSubtasks > 0 && (
                      <div className="relationship-progress-wrap" aria-label="Subtask completion progress">
                        <div className="relationship-progress-meta">
                          <span>Subtasks progress</span>
                          <strong>
                            {completedSubtasks} / {totalSubtasks} ({subtaskPercent}%)
                          </strong>
                        </div>
                        <div className="relationship-progress-track">
                          <div
                            className={`relationship-progress-fill${subtaskPercent === 100 ? " is-complete" : ""}`}
                            style={{ width: `${subtaskPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="subtask-list">
                      {subtasks?.map((subtask) => {
                        const subtaskAssignees = subtaskAssigneesMap.get(subtask.id) ?? [];
                        const assigneeNames = subtaskAssignees.map((uid) => profileLabel(uid));
                        return (
                          <div className="subtask-row-wrap" key={subtask.id}>
                            <Link className="subtask-row" href={`/projects/${projectId}/tasks/${subtask.id}`}>
                              <strong className="subtask-title">{subtask.title}</strong>
                              {!canEdit && assigneeNames.length > 0 && (
                                <span className="subtask-assignees-pill" title={assigneeNames.join(", ")}>
                                  {assigneeNames.length === 1
                                    ? assigneeNames[0]
                                    : `${assigneeNames[0]} +${assigneeNames.length - 1}`}
                                </span>
                              )}
                            </Link>
                            <div className="subtask-row-controls">
                              <SubtaskStatusPicker
                                projectId={projectId}
                                subtaskId={subtask.id}
                                currentStatusId={subtask.status_id}
                                statuses={statuses ?? []}
                                canEdit={canEdit}
                              />
                              {canEdit && (
                                <div className="subtask-row-assignee">
                                  <AssigneePicker
                                    projectId={projectId}
                                    taskId={subtask.id}
                                    members={members}
                                    initialAssignees={subtaskAssignees}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {(!subtasks || subtasks.length === 0) && (
                        <div className="relationship-empty-state">
                          <p>No subtasks yet</p>
                          <small>Break down this task into smaller manageable steps.</small>
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <SubtaskCreateForm
                        projectId={projectId}
                        parentTaskId={taskId}
                        members={members}
                      />
                    )}
                  </section>
                );
              })()}

              {/* Task Checklists */}
              <TaskChecklistsSection
                projectId={projectId}
                taskId={taskId}
                canEdit={canEdit}
                checklists={checklists ?? []}
                items={checklistItems ?? []}
              />

              {/* Attachments Section */}
              <TaskAttachmentsSection
                projectId={projectId}
                taskId={taskId}
                taskTitle={task.title}
                attachments={(attachments ?? []).map((item) => ({
                  ...item,
                  uploader_name: profileLabel(item.uploaded_by),
                }))}
                attachmentStatus={attachment}
                attachmentError={attachment_error}
                driveError={driveError}
                canEdit={canEdit}
              />

              {/* Comments Section */}
              <section className="task-comments-section">
                <div className="comments-heading"><div className="comments-icon"><MessageSquareText size={17}/></div><div><h2>Comments</h2><p>{comments?.length ?? 0} messages on this task</p></div></div>
                <div className="comments-feed">{comments?.length ? comments.map((comment) => { const authorProfile = profileById.get(comment.author_id); return <article className="comment-card" key={comment.id}><div className="comment-avatar">{authorProfile?.avatar_url ? <img src={authorProfile.avatar_url} alt={profileLabel(comment.author_id)} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : profileLabel(comment.author_id)[0].toUpperCase()}</div><div className="comment-content"><div className="comment-author"><strong>{profileLabel(comment.author_id)}</strong><time>{new Date(comment.created_at).toLocaleString()}</time></div><p>{comment.body}</p></div></article>; }) : <div className="no-comments">No comments yet. Add a note or question for your team.</div>}</div>
                {canEdit ? (
                  <TaskCommentForm projectId={projectId} taskId={taskId} members={members} />
                ) : (
                  <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '12px' }}>
                    Comments are read-only for Viewers.
                  </div>
                )}
              </section>

              {/* Activity Section */}
              <section className="task-activity-section"><div className="relationship-heading"><div><p className="eyebrow">HISTORY</p><h2>Activity</h2></div></div>{activityEvents?.length ? <ol className="activity-list">{activityEvents.map((event) => { const details = event.details && typeof event.details === "object" ? event.details as Record<string, unknown> : {}; const actor = event.actor_id ? profileLabel(event.actor_id) : "System"; const isSubtaskAdd = event.event_type === "subtask_added" || (event.task_id !== taskId && event.event_type === "task_created"); const label = isSubtaskAdd ? "added subtask" : event.event_type.replaceAll("_", " "); const titleSuffix = (isSubtaskAdd || event.event_type === "task_created") && typeof details.title === "string" && details.title.trim() ? ` · ${details.title.trim()}` : ""; const change = typeof details.from === "string" || typeof details.to === "string" ? ` · ${String(details.from ?? "—")} → ${String(details.to ?? "—")}` : titleSuffix; return <li key={event.id}><span className="activity-dot"/><div><p><strong>{actor}</strong> {label}{change}</p><time>{new Date(event.created_at).toLocaleString()}</time></div></li>; })}</ol> : <p className="muted small">Task changes and comments will appear here.</p>}</section>
            </div>

            {/* Right Column (Sidebar): Properties, Time tracking, Dependencies, Custom fields */}
            <div className="task-detail-right-col">
              <TaskPropertiesPanel
                projectId={projectId}
                taskId={taskId}
                canEdit={canEdit}
                isSubtask={Boolean(task.parent_task_id)}
                members={members}
                initialAssignees={taskInitialAssignees}
                statuses={(statuses ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color }))}
                initialStatusId={task.status_id}
                initialPriority={task.priority as "low" | "normal" | "high" | "urgent"}
                initialStartDate={task.start_date}
                initialDueDate={task.due_date}
                initialEstimateFormatted={task.estimate_minutes ? formatEstimate(task.estimate_minutes) : ""}
                billableFormatted={formatMinutes(billableMinutes)}
                remainingLabel={remainingInfo.label}
                remainingStatus={remainingInfo.status}
                createdByLabel={profileLabel(task.created_by)}
                createdAtFormatted={new Date(task.created_at).toLocaleDateString()}
              />

              {/* Time Tracking Section */}
              <section className="task-time-section">
                <div className="relationship-heading">
                  <div>
                    <p className="eyebrow">TIME TRACKING</p>
                    <h2>Time &amp; Budget</h2>
                  </div>
                </div>

                <div className="task-time-metrics">
                  <div className="time-metric-card">
                    <span className="metric-label">Estimated Budget</span>
                    <span className="metric-val">{formatEstimateDetailed(task.estimate_minutes)}</span>
                  </div>
                  <div className="time-metric-card">
                    <span className="metric-label">Billable Worked</span>
                    <span className="metric-val">{formatMinutes(billableMinutes)}</span>
                  </div>
                  <div className={`time-metric-card is-${remainingInfo.status}`}>
                    <span className="metric-label">Remaining / Added</span>
                    <span className="metric-val">
                      {remainingInfo.status === "exhausting" && "⚠️ "}
                      {remainingInfo.status === "exceeded" && "🚨 "}
                      {remainingInfo.label}
                    </span>
                  </div>
                </div>

                {remainingInfo.status === "exhausting" && (
                  <div className="hours-alert-banner is-warning">
                    ⚠️ <strong>Hours Exhausting Alert:</strong> Less than 1 hour ({remainingInfo.label}) remains on this task. An automated email alert has been dispatched to the creator and assignees.
                  </div>
                )}
                {remainingInfo.status === "exceeded" && (
                  <div className="hours-alert-banner is-danger">
                    🚨 <strong>Budget Exceeded Alert:</strong> Actual billable hours worked have exceeded the estimate by {formatMinutes(Math.abs(remainingInfo.diff || 0))}. An automated email alert has been dispatched to the creator and assignees.
                  </div>
                )}

                {canEdit && (
                  <div className="timer-controls">
                    <form action={addManualTimeEntry} className="manual-time-form">
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="taskId" value={taskId} />
                      <label>Minutes<input name="minutes" type="number" min="1" max="100000" required placeholder="30" /></label>
                      <label>Description<input name="description" maxLength={2000} placeholder="What did you work on?" /></label>
                      <label className="billable-option"><input name="billable" type="checkbox" value="true" defaultChecked /> Billable</label>
                      <button className="mini-save">Add time</button>
                    </form>
                  </div>
                )}
                <div className="time-entry-list">
                  {timeEntries?.map((entry) => (
                    <div className="time-entry-row" key={entry.id}>
                      <div className="time-entry-row-top">
                        <strong>{profileLabel(entry.user_id)}</strong>
                        <span className="time-entry-row-dur">{entry.duration_minutes ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m` : "Running"}</span>
                      </div>
                      <div className="time-entry-row-sub">
                        <span>
                          {new Date(entry.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {new Date(entry.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className={`time-entry-row-type ${entry.billable ? "is-billable" : ""}`}>{entry.billable ? "Billable" : "Non-billable"}</span>
                      </div>
                      {entry.description && <p>{entry.description}</p>}
                    </div>
                  ))}
                  {!timeEntries?.length && <p className="muted small">No time recorded on this task yet.</p>}
                </div>
              </section>

              {/* Dependencies Section */}
              <section className="task-dependencies">
                <div className="relationship-heading">
                  <div>
                    <p className="eyebrow">RELATED WORK</p>
                    <h2>Dependencies <span className="count-pill">{dependencies?.length ?? 0}</span></h2>
                  </div>
                  <div className="relationship-header-icon"><GitBranch size={17}/></div>
                </div>
                <div className="dependency-list">
                  {dependencies?.map((dependency) => {
                    const linked = linkedTaskMap.get(dependency.linked_task_id);
                    return (
                      <div className="dependency-row" key={`${dependency.linked_task_id}-${dependency.relation}`}>
                        <span className={`dependency-badge rel-${dependency.relation}`}>
                          {dependency.relation.replace("_", " ")}
                        </span>
                        {linked ? (
                          <Link href={`/projects/${projectId}/tasks/${linked.id}`} className="dependency-task-link">
                            <span className="dependency-task-key">{linked.generated_key}</span>
                            <span className="dependency-task-title">{linked.title}</span>
                          </Link>
                        ) : (
                          <span className="dependency-task-title muted">Unknown task</span>
                        )}
                        {canEdit && (
                          <form action={removeTaskDependency} className="dependency-remove-form">
                            <input type="hidden" name="projectId" value={projectId}/>
                            <input type="hidden" name="taskId" value={taskId}/>
                            <input type="hidden" name="linkedTaskId" value={dependency.linked_task_id}/>
                            <input type="hidden" name="relation" value={dependency.relation}/>
                            <button className="dependency-remove-btn" aria-label="Remove dependency" title="Remove dependency">×</button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                  {(!dependencies || dependencies.length === 0) && (
                    <div className="relationship-empty-state">
                      <GitBranch size={22} className="empty-state-icon" />
                      <p>No dependencies linked yet</p>
                      <small>Link tasks that block this task, are blocked by it, or are related.</small>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <form action={createTaskDependency} className="dependency-form">
                    <input type="hidden" name="projectId" value={projectId}/>
                    <input type="hidden" name="taskId" value={taskId}/>
                    <div className="dependency-form-fields">
                      <select name="linkedTaskId" required defaultValue="" className="dependency-task-select">
                        <option value="" disabled>Choose a task to link…</option>
                        {projectTasks?.filter((item) => item.id !== taskId && !(dependencies ?? []).some((dependency) => dependency.linked_task_id === item.id)).map((item) => (
                          <option key={item.id} value={item.id}>{item.generated_key} · {item.title}</option>
                        ))}
                      </select>
                      <select name="relation" defaultValue="related" className="dependency-type-select">
                        <option value="blocks">Blocks</option>
                        <option value="blocked_by">Blocked by</option>
                        <option value="related">Related</option>
                        <option value="duplicate">Duplicate of</option>
                      </select>
                    </div>
                    <button className="dependency-submit-btn">+ Link task</button>
                  </form>
                )}
              </section>

              {/* Custom Fields Section */}
              {!!customFields?.length && <section className="task-custom-fields"><div className="custom-fields-heading"><div><p className="eyebrow">CUSTOM FIELDS</p><h2>Project details</h2></div></div><div className="custom-field-grid">{customFields.map((field) => {
                const options = Array.isArray(field.options) ? field.options.map(String) : [];
                const storedValue = customValueMap.get(field.id);
                const value = storedValue == null ? "" : Array.isArray(storedValue) ? storedValue.join(", ") : String(storedValue);
                const isUrlField = field.field_type === "url" || field.field_type === "link";
                const parsedLinks = (() => {
                  if (!value) return [];
                  const tokens = value.split(/[\s,;]+/).filter(Boolean);
                  const links: { label: string; href: string }[] = [];
                  for (const token of tokens) {
                    const clean = token.trim();
                    if (/^https?:\/\//i.test(clean)) {
                      try {
                        const url = new URL(clean);
                        const domain = url.hostname.replace(/^www\./, "");
                        const path = url.pathname !== "/" ? url.pathname : "";
                        links.push({ label: domain + (path.length > 20 ? path.slice(0, 20) + "…" : path), href: clean });
                      } catch {
                        links.push({ label: clean, href: clean });
                      }
                    } else if (/^www\./i.test(clean) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(clean)) {
                      links.push({ label: clean, href: `https://${clean}` });
                    }
                  }
                  return links;
                })();

                if (field.field_type === "formula") return <div className="custom-field-item" key={field.id}><span>{field.name}</span><p className="muted small">Formula fields are read-only until formula configuration is available.</p></div>;
                if (!canEdit) {
                  const progressNum = field.field_type === "progress" ? Number(value) : NaN;
                  const clampedProgress = Number.isFinite(progressNum)
                    ? Math.max(0, Math.min(100, Math.round(progressNum)))
                    : null;
                  return (
                    <div className="custom-field-item" key={field.id}>
                      <label>{field.name}</label>
                      {clampedProgress !== null ? (
                        <div className="cf-progress-preview">
                          <div className="cf-progress-track">
                            <div className="cf-progress-fill" style={{ width: `${clampedProgress}%` }} />
                          </div>
                          <span>{clampedProgress}%</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: 'var(--ink, #334155)', padding: '6px 0', minHeight: '28px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          {parsedLinks.length > 0 ? (
                            parsedLinks.map((link, idx) => (
                              <a
                                key={idx}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--green, #167c58)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(22, 124, 88, 0.08)", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 11 }}
                              >
                                <span>{link.label}</span>
                                <ExternalLink size={10} />
                              </a>
                            ))
                          ) : (
                            value || "—"
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <form action={saveTaskCustomField} className="custom-field-item" key={field.id}>
                    <input type="hidden" name="projectId" value={projectId}/>
                    <input type="hidden" name="taskId" value={taskId}/>
                    <input type="hidden" name="fieldId" value={field.id}/>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <label htmlFor={`field-${field.id}`}>{field.name}{field.required && <span className="required-mark">*</span>}</label>
                      {parsedLinks.length > 0 && (
                        <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                          {parsedLinks.map((link, idx) => (
                            <a
                              key={idx}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 10.5, color: "var(--green, #167c58)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 2, background: "rgba(22, 124, 88, 0.06)", padding: "1px 6px", borderRadius: 4 }}
                              title={`Open ${link.href}`}
                            >
                              <span>{link.label}</span>
                              <ExternalLink size={9} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    {field.field_type === "long_text" ? (
                      <textarea id={`field-${field.id}`} name="value" defaultValue={value} required={field.required} maxLength={10000} placeholder="Enter text…"/>
                    ) : field.field_type === "dropdown" ? (
                      <div>
                        <select id={`field-${field.id}`} name="value" defaultValue={value} required={field.required}>
                          <option value="">Choose…</option>
                          {options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                    ) : field.field_type === "multi_select" ? (
                      <MultiValueFieldInput
                        key={`${field.id}-${value}`}
                        id={`field-${field.id}`}
                        name="value"
                        defaultValue={value}
                        placeholder={options.length > 0 ? `Option (e.g. ${options[0]})` : "Option value"}
                        addLabel="Add option value"
                        required={field.required}
                        suggestions={options}
                      />
                    ) : field.field_type === "checkbox" ? (
                      <select id={`field-${field.id}`} name="value" defaultValue={value || "false"}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    ) : field.field_type === "user" ? (
                      <select id={`field-${field.id}`} name="value" defaultValue={value}>
                        <option value="">Unassigned</option>
                        {members.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
                      </select>
                    ) : field.field_type === "date" ? (
                      <DateInput id={`field-${field.id}`} name="value" defaultValue={value} required={field.required}/>
                    ) : field.field_type === "progress" ? (
                      (() => {
                        const progressNum = value === "" ? NaN : Number(value);
                        const clamped = Number.isFinite(progressNum)
                          ? Math.max(0, Math.min(100, Math.round(progressNum)))
                          : 0;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div className="cf-progress-preview">
                              <div className="cf-progress-track">
                                <div className="cf-progress-fill" style={{ width: `${clamped}%` }} />
                              </div>
                              <span>{clamped}%</span>
                            </div>
                            <input
                              id={`field-${field.id}`}
                              name="value"
                              type="number"
                              min={0}
                              max={100}
                              step="1"
                              defaultValue={value}
                              required={field.required}
                              placeholder="0 - 100"
                            />
                          </div>
                        );
                      })()
                    ) : isUrlField || field.field_type === "email" || field.field_type === "text" ? (
                      <MultiValueFieldInput
                        key={`${field.id}-${value}`}
                        id={`field-${field.id}`}
                        name="value"
                        defaultValue={value}
                        inputType={field.field_type === "email" ? "email" : "text"}
                        placeholder={
                          isUrlField
                            ? "https://example.com"
                            : field.field_type === "email"
                              ? "name@company.com"
                              : "Enter value"
                        }
                        addLabel={
                          isUrlField
                            ? "Add URL"
                            : field.field_type === "email"
                              ? "Add email"
                              : "Add value"
                        }
                        maxItemLength={field.field_type === "text" || isUrlField ? 2000 : 240}
                        required={field.required}
                      />
                    ) : (
                      <input
                        id={`field-${field.id}`}
                        name="value"
                        type={field.field_type === "datetime" ? "datetime-local" : ["number", "currency", "rating", "duration"].includes(field.field_type) ? "number" : "text"}
                        defaultValue={value}
                        required={field.required}
                        step={field.field_type === "rating" ? "1" : field.field_type === "currency" ? "0.01" : undefined}
                        placeholder="Enter value"
                      />
                    )}
                    <button className="mini-save">Save field</button>
                  </form>
                );
              })}</div></section>}
            </div>
          </div>
        </>
      )}
    </div>
  </main>;
}
