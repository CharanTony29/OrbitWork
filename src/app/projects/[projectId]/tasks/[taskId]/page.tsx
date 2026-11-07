import { notFound, redirect } from "next/navigation";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import BackButton from "@/app/BackButton";
import Link from "next/link";
import { ArrowLeft, CheckSquare, GitBranch, MessageSquareText, Save, Eye, ExternalLink } from "lucide-react";
import { addManualTimeEntry, createChecklistItem, createTaskChecklist, createTaskComment, createTaskDependency, createTaskSubtask, removeTaskDependency, signOut, startTaskTimer, stopTaskTimer, toggleChecklistItem, updateTask } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import AssigneeDropdowns from "../../AssigneeDropdowns";
import { saveTaskCustomField } from "@/app/actions";
import { formatEstimate, formatEstimateDetailed, formatMinutes, formatRemaining } from "@/lib/work";
import TaskDetailCanvas from "./TaskDetailCanvas";
import TaskAttachmentsSection from "./TaskAttachmentsSection";
import TaskDetailProgress from "./TaskDetailProgress";
import TaskHeaderTimer from "./TaskHeaderTimer";
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
  searchParams: Promise<{ error?: string; saved?: string; attachment?: string; driveError?: string; tab?: string }>;
}) {
  const { projectId, taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase.from("projects").select("id, name, workspace_id, workspaces(name, organization_id)").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const { data: task } = await supabase.from("tasks").select("id, project_id, generated_key, title, task_type, tags, description, status_id, priority, start_date, due_date, estimate_minutes, progress, created_by, primary_assignee_id, secondary_assignee_id, created_at, updated_at").eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (!task) notFound();
  const { data: statuses } = await supabase.from("project_statuses").select("id, name, color, category").eq("project_id", projectId).order("position");
  const { data: comments } = await supabase.from("task_comments").select("id, author_id, body, created_at").eq("task_id", taskId).order("created_at");
  const { data: customFields } = await supabase.from("custom_field_definitions").select("id, name, field_type, options, required, position").eq("project_id", projectId).order("position");
  const { data: customFieldValues } = await supabase.from("task_custom_field_values").select("field_id, value").eq("project_id", projectId).eq("task_id", taskId);
  const { data: subtasks } = await supabase.from("tasks").select("id, generated_key, title, status_id, due_date").eq("project_id", projectId).eq("parent_task_id", taskId).order("created_at");
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
  const { data: activityEvents } = await supabase.from("project_activity_events").select("id, actor_id, event_type, details, created_at").eq("project_id", projectId).eq("task_id", taskId).order("created_at", { ascending: false }).limit(100);
  const { data: anyRunningTimer } = await supabase.from("time_entries").select("id, user_id, started_at, billable").eq("task_id", taskId).is("ended_at", null).maybeSingle();
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
  const itemsByChecklist = new Map<string, NonNullable<typeof checklistItems>>();
  for (const item of checklistItems ?? []) itemsByChecklist.set(item.checklist_id, [...(itemsByChecklist.get(item.checklist_id) ?? []), item]);
  const workspace = Array.isArray(project.workspaces) ? project.workspaces[0] : project.workspaces;
  const orgId = workspace?.organization_id;
  const { data: orgMembers } = orgId ? await supabase.from("organization_members").select("user_id").eq("organization_id", orgId).eq("status", "active") : { data: [] };
  const peopleIds = [...new Set([...(comments ?? []).map((comment) => comment.author_id), ...(timeEntries ?? []).map((entry) => entry.user_id), ...(attachments ?? []).map((item) => item.uploaded_by), ...(activityEvents ?? []).map((event) => event.actor_id).filter((id): id is string => Boolean(id)), ...(orgMembers ?? []).map((member) => member.user_id), task.created_by, anyRunningTimer?.user_id, ...[task.primary_assignee_id, task.secondary_assignee_id].filter((id): id is string => Boolean(id))].filter((id): id is string => Boolean(id)))];
  const { data: authors } = peopleIds.length ? await supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", peopleIds) : { data: [] };
  const profileById = new Map((authors ?? []).map((profile) => [profile.id, profile]));
  const profileLabel = (id: string) => { const profile = profileById.get(id); return profile?.display_name?.trim() || profile?.email || "Team member"; };
  const members = (orgMembers ?? []).map((member) => ({ id: member.user_id, label: profileLabel(member.user_id) }));
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
  const { error, saved, attachment, driveError, tab: queryTab } = await searchParams;
  const tab = ["details", "whiteboard", "flowchart"].includes(queryTab ?? "") ? queryTab! : "details";

  return <main className="app-shell">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/></div></header>
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
                <input type="hidden" name="statusId" value={task.status_id}/>
                <input type="hidden" name="priority" value={task.priority}/>
                <input type="hidden" name="startDate" value={task.start_date ?? ""}/>
                <input type="hidden" name="dueDate" value={task.due_date ?? ""}/>
                <input type="hidden" name="estimateMinutes" value={task.estimate_minutes ? formatEstimate(task.estimate_minutes) : ""}/>

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
                <label className="detail-field">
                  Description
                  <textarea
                    name="description"
                    defaultValue={task.description}
                    maxLength={10000}
                    placeholder={canEdit ? "Add context, notes, or acceptance criteria…" : "No description provided."}
                    readOnly={!canEdit}
                    disabled={!canEdit}
                    style={!canEdit ? { background: '#f8fafc', cursor: 'default' } : undefined}
                  />
                </label>
                <div className="detail-save-row">
                  <span>Last updated {new Date(task.updated_at).toLocaleString()}</span>
                  {canEdit && <button className="button button-primary"><Save size={15}/> Save changes</button>}
                </div>
              </form>

              {/* Subtasks (Child Tasks) */}
              <section className="task-subtasks">
                <div className="relationship-heading">
                  <div>
                    <p className="eyebrow">CHILD TASKS</p>
                    <h2>Subtasks <span className="count-pill">{subtasks?.length ?? 0}</span></h2>
                  </div>
                </div>
                <div className="subtask-list">
                  {subtasks?.map((subtask) => {
                    const statusObj = statuses?.find((status) => status.id === subtask.status_id);
                    return (
                      <Link className="subtask-row" href={`/projects/${projectId}/tasks/${subtask.id}`} key={subtask.id}>
                        <span className="task-key">{subtask.generated_key}</span>
                        <strong className="subtask-title">{subtask.title}</strong>
                        <span
                          className="subtask-status-pill"
                          style={{
                            borderColor: statusObj?.color ?? "#cbd5cd",
                            color: statusObj?.color ?? "#526057",
                          }}
                        >
                          {statusObj?.name ?? "New"}
                        </span>
                      </Link>
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
                  <form action={createTaskSubtask} className="relationship-form">
                    <input type="hidden" name="projectId" value={projectId}/>
                    <input type="hidden" name="parentTaskId" value={taskId}/>
                    <input name="title" placeholder="Add a subtask…" maxLength={240} required className="relationship-input"/>
                    <button className="mini-save">+ Add subtask</button>
                  </form>
                )}
              </section>

              {/* Task Checklists */}
              <section className="task-checklists">
                <div className="relationship-heading"><div><p className="eyebrow">TASK CHECKLISTS</p><h2>Checklists</h2></div><CheckSquare size={17}/></div>
                {checklists?.map((checklist) => <div className="checklist-block" key={checklist.id}><h3>{checklist.title}</h3>{itemsByChecklist.get(checklist.id)?.map((item) => canEdit ? <form action={toggleChecklistItem} className="checklist-item" key={item.id}><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="taskId" value={taskId}/><input type="hidden" name="itemId" value={item.id}/><input type="hidden" name="complete" value={item.is_complete ? "false" : "true"}/><button aria-label={item.is_complete ? `Reopen ${item.title}` : `Complete ${item.title}`}><span className={item.is_complete ? "checkmark checked" : "checkmark"}>{item.is_complete ? "✓" : ""}</span><span className={item.is_complete ? "item-complete" : ""}>{item.title}</span></button></form> : <div className="checklist-item" key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}><span className={item.is_complete ? "checkmark checked" : "checkmark"}>{item.is_complete ? "✓" : ""}</span><span className={item.is_complete ? "item-complete" : ""}>{item.title}</span></div>)}{canEdit && <form action={createChecklistItem} className="relationship-form"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="taskId" value={taskId}/><input type="hidden" name="checklistId" value={checklist.id}/><input name="title" placeholder="Add checklist item" maxLength={300} required/><button className="mini-save">Add item</button></form>}</div>)}
                {canEdit && <form action={createTaskChecklist} className="relationship-form checklist-create-form"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="taskId" value={taskId}/><input name="title" placeholder="New checklist name" maxLength={100} required/><button className="mini-save">Create checklist</button></form>}
              </section>

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
                driveError={driveError}
                canEdit={canEdit}
              />

              {/* Comments Section */}
              <section className="task-comments-section">
                <div className="comments-heading"><div className="comments-icon"><MessageSquareText size={17}/></div><div><h2>Comments</h2><p>{comments?.length ?? 0} messages on this task</p></div></div>
                <div className="comments-feed">{comments?.length ? comments.map((comment) => <article className="comment-card" key={comment.id}><div className="comment-avatar">{profileLabel(comment.author_id)[0].toUpperCase()}</div><div className="comment-content"><div className="comment-author"><strong>{profileLabel(comment.author_id)}</strong><time>{new Date(comment.created_at).toLocaleString()}</time></div><p>{comment.body}</p></div></article>) : <div className="no-comments">No comments yet. Add a note or question for your team.</div>}</div>
                {canEdit ? (
                  <form action={createTaskComment} className="task-comment-form"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="taskId" value={taskId}/><label htmlFor="task-comment">Add a comment</label><textarea id="task-comment" name="body" placeholder="Share an update, ask a question, or leave context…" maxLength={10000} required/><div className="comment-submit-row"><span>Comments are visible to people with project access.</span><button className="button button-primary">Post comment</button></div></form>
                ) : (
                  <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '12px' }}>
                    Comments are read-only for Viewers.
                  </div>
                )}
              </section>

              {/* Activity Section */}
              <section className="task-activity-section"><div className="relationship-heading"><div><p className="eyebrow">HISTORY</p><h2>Activity</h2></div></div>{activityEvents?.length ? <ol className="activity-list">{activityEvents.map((event) => { const details = event.details && typeof event.details === "object" ? event.details as Record<string, unknown> : {}; const actor = event.actor_id ? profileLabel(event.actor_id) : "System"; const label = event.event_type.replaceAll("_", " "); const change = typeof details.from === "string" || typeof details.to === "string" ? ` · ${String(details.from ?? "—")} → ${String(details.to ?? "—")}` : ""; return <li key={event.id}><span className="activity-dot"/><div><p><strong>{actor}</strong> {label}{change}</p><time>{new Date(event.created_at).toLocaleString()}</time></div></li>; })}</ol> : <p className="muted small">Task changes and comments will appear here.</p>}</section>
            </div>

            {/* Right Column (Sidebar): Properties, Time tracking, Dependencies, Custom fields */}
            <div className="task-detail-right-col">
              <form action={updateTask} className="task-properties">
                <input type="hidden" name="projectId" value={projectId}/>
                <input type="hidden" name="taskId" value={taskId}/>
                <input type="hidden" name="title" value={task.title}/>
                <input type="hidden" name="description" value={task.description}/>

                <p className="eyebrow">PROPERTIES</p>
                <label className="detail-field">
                  Status
                  {canEdit ? (
                    <select name="statusId" defaultValue={task.status_id}>
                      {(statuses ?? []).map((status) => (
                        <option key={status.id} value={status.id}>{status.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${taskStatus?.color ?? '#cbd5cd'}`, color: taskStatus?.color ?? '#526057', background: `${taskStatus?.color ?? '#526057'}12`, fontWeight: 500, fontSize: '12px', width: 'fit-content', marginTop: '4px' }}>
                      <i style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: taskStatus?.color ?? '#526057', display: 'inline-block' }} />
                      {taskStatus?.name ?? "Unknown"}
                    </div>
                  )}
                </label>
                <label className="detail-field">
                  Priority
                  {canEdit ? (
                    <select name="priority" defaultValue={task.priority}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  ) : (
                    <span className={`priority-pill priority-${task.priority}`} style={{ width: 'fit-content', marginTop: '4px', textTransform: 'capitalize' }}>
                      {task.priority}
                    </span>
                  )}
                </label>
                <label className="detail-field">
                  Start date
                  {canEdit ? (
                    <DateInput name="startDate" defaultValue={task.start_date ?? ""}/>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                      {task.start_date ? new Date(`${task.start_date}T00:00:00`).toLocaleDateString() : "Not set"}
                    </span>
                  )}
                </label>
                <label className="detail-field">
                  Due date
                  {canEdit ? (
                    <DateInput name="dueDate" defaultValue={task.due_date ?? ""}/>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                      {task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString() : "No due date"}
                    </span>
                  )}
                </label>
                <label className="detail-field">
                  Estimate (e.g. 2h, 1d, 3w, 30m)
                  {canEdit ? (
                    <input name="estimateMinutes" type="text" placeholder="e.g. 2h, 1d, 3w, 30m" defaultValue={task.estimate_minutes ? formatEstimate(task.estimate_minutes) : ""}/>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                      {task.estimate_minutes ? formatEstimate(task.estimate_minutes) : "None"}
                    </span>
                  )}
                </label>
                <div className="property-line"><span>Worked (Billable)</span><strong>{formatMinutes(billableMinutes)}</strong></div>
                <div className="property-line"><span>Remaining / Added</span><strong className={`remaining-badge is-${remainingInfo.status}`}>{remainingInfo.label}</strong></div>
                <div className="detail-assignees">
                  <p className="eyebrow">ASSIGNEES</p>
                  {canEdit ? (
                    <AssigneeDropdowns key={`${task.id}-${task.primary_assignee_id ?? ""}-${task.secondary_assignee_id ?? ""}`} projectId={projectId} taskId={taskId} members={members} initialPrimary={task.primary_assignee_id} initialSecondary={task.secondary_assignee_id}/>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', marginTop: '6px' }}>
                      <div className="property-line"><span>Primary</span><strong>{task.primary_assignee_id ? profileLabel(task.primary_assignee_id) : "Unassigned"}</strong></div>
                      <div className="property-line"><span>Secondary</span><strong>{task.secondary_assignee_id ? profileLabel(task.secondary_assignee_id) : "Unassigned"}</strong></div>
                    </div>
                  )}
                </div>
                <div className="property-line"><span>Created by</span><strong>{profileLabel(task.created_by)}</strong></div>
                <div className="property-line"><span>Created</span><strong>{new Date(task.created_at).toLocaleDateString()}</strong></div>

                {canEdit && (
                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                    <button className="button button-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                      <Save size={13}/> Update properties
                    </button>
                  </div>
                )}
              </form>

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
                  return (
                    <div className="custom-field-item" key={field.id}>
                      <label>{field.name}</label>
                      <div style={{ fontSize: '13px', color: '#334155', padding: '6px 0', minHeight: '28px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <input
                          id={`field-${field.id}`}
                          name="value"
                          type="text"
                          defaultValue={value}
                          required={field.required}
                          placeholder={options.length > 0 ? `e.g. ${options.slice(0, 2).join(", ")}` : "Comma-separated values…"}
                        />
                        {options.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 10,
                                  border: "1px dashed var(--line, #cbd5e1)",
                                  background: "var(--nav-hover, #f8fafc)",
                                  color: "var(--ink)",
                                  cursor: "pointer",
                                }}
                                onClick={(e) => {
                                  const input = document.getElementById(`field-${field.id}`) as HTMLInputElement | null;
                                  if (!input) return;
                                  const current = input.value.split(",").map((s) => s.trim()).filter(Boolean);
                                  if (current.includes(opt)) {
                                    input.value = current.filter((s) => s !== opt).join(", ");
                                  } else {
                                    input.value = [...current, opt].join(", ");
                                  }
                                }}
                                title="Click to toggle option"
                              >
                                + {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <input
                          id={`field-${field.id}`}
                          name="value"
                          type={field.field_type === "datetime" ? "datetime-local" : ["number", "currency", "rating", "progress", "duration"].includes(field.field_type) ? "number" : field.field_type === "email" ? "text" : "text"}
                          defaultValue={value}
                          required={field.required}
                          maxLength={field.field_type === "text" || isUrlField ? 2000 : undefined}
                          step={field.field_type === "rating" || field.field_type === "progress" ? "1" : field.field_type === "currency" ? "0.01" : undefined}
                          placeholder={isUrlField ? "https://link1.com, https://link2.com" : "Comma-separated values supported"}
                        />
                        {(isUrlField || field.field_type === "text" || field.field_type === "email") && (
                          <small style={{ fontSize: 10, color: "var(--muted)" }}>
                            Multiple values supported (comma-separated)
                          </small>
                        )}
                      </div>
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
