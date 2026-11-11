import { notFound, redirect } from "next/navigation";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createTask, signOut } from "@/app/actions";

import TaskTable from "./TaskTable";
import TaskBoard from "./TaskBoard";
import TaskCalendar from "./TaskCalendar";
import TaskGantt from "./TaskGantt";
import TaskWorkload from "./TaskWorkload";
import ProjectSettingsPanel from "./ProjectSettingsPanel";
import TaskFilterToolbar from "./TaskFilterToolbar";
import ProjectWhiteboardView from "./ProjectWhiteboardView";
import ProjectFlowchartView from "./ProjectFlowchartView";
import FavoriteButton from "@/app/FavoriteButton";
import { checkAndSendDueDateReminders } from "@/lib/email";

export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; view?: string; q?: string; status?: string; priority?: string; assignee?: string; page?: string; month?: string; sort?: string; group?: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase.from("projects").select("id, workspace_id, name, description, status, priority, due_date, created_at, workspaces(name, organization_id)").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const filters = await searchParams;
  const view = ["list", "board", "calendar", "gantt", "workload", "whiteboard", "flowchart"].includes(filters.view ?? "") ? filters.view! : "list";
  const page = Math.max(1, Math.min(10000, Number.parseInt(filters.page ?? "1", 10) || 1));
  let taskQuery = supabase.from("tasks").select("id, generated_key, title, description, task_type, tags, priority, start_date, due_date, estimate_minutes, progress, status_id, parent_task_id, created_at, created_by, primary_assignee_id, secondary_assignee_id", { count: "exact" }).eq("project_id", projectId);
  const query = filters.q?.trim().replace(/[,%()]/g, " ").slice(0, 80);
  const assigneeId = filters.assignee && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.assignee) ? filters.assignee : undefined;
  if (query) taskQuery = taskQuery.or(`title.ilike.%${query}%,generated_key.ilike.%${query}%`);
  if (filters.status) taskQuery = taskQuery.eq("status_id", filters.status);
  if (["low", "normal", "high", "urgent"].includes(filters.priority ?? "")) taskQuery = taskQuery.eq("priority", filters.priority!);
  if (assigneeId) taskQuery = taskQuery.or(`primary_assignee_id.eq.${assigneeId},secondary_assignee_id.eq.${assigneeId}`);
  if (filters.sort === "due") taskQuery = taskQuery.order("due_date", { ascending: true, nullsFirst: false });
  else taskQuery = taskQuery.order("created_at", { ascending: false });
  const [statusResult, taskResult, memberResult, fieldResult, canEditResult, canManageResult] = await Promise.all([
    supabase.from("project_statuses").select("id, name, color, category, position, is_default").eq("project_id", projectId).order("position"),
    taskQuery.range((page - 1) * 100, page * 100 - 1),
    supabase.from("project_members").select("user_id, role").eq("project_id", projectId),
    supabase.from("custom_field_definitions").select("id, name, field_type, options, required, position").eq("project_id", projectId).order("position"),
    supabase.rpc("can_edit_project_tasks", { target_project: projectId }),
    supabase.rpc("can_manage_project", { target_project: projectId }),
  ]);
  const { data: statuses } = statusResult;
  const { data: tasks, count: taskCount } = taskResult;
  const { data: projectMembers } = memberResult;
  const { data: customFields } = fieldResult;
  const canEdit = Boolean(canEditResult.data);
  const canManage = Boolean(canManageResult.data);
  let isProjectFavorited = false;
  const { data: projectFav, error: projectFavError } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .maybeSingle();
  if (!projectFavError && projectFav) {
    isProjectFavorited = true;
  }
  const today = new Date().toISOString().slice(0, 10);

  // Check and dispatch due date email reminders for this project
  checkAndSendDueDateReminders(projectId).catch(console.error);
  const completedStatusIds = (statuses ?? []).filter((status) => status.category === "completed" || status.category === "cancelled").map((status) => status.id);
  const [totalMetric, overdueMetric, statusMetrics] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    (async () => {
      let query = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId).lt("due_date", today);
      if (completedStatusIds.length) query = query.not("status_id", "in", `(${completedStatusIds.join(",")})`);
      return query;
    })(),
    Promise.all((statuses ?? []).map(async (status) => {
      const result = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status_id", status.id);
      return { ...status, count: result.count ?? 0 };
    })),
  ]);
  const workspace = Array.isArray(project.workspaces) ? project.workspaces[0] : project.workspaces;
  const orgId = workspace?.organization_id;
  const { data: orgMembers } = orgId ? await supabase.from("organization_members").select("user_id").eq("organization_id", orgId).eq("status", "active") : { data: [] };
  const monthKey = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : today.slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const monthEnd = new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [holidayResult, leaveResult] = orgId ? await Promise.all([
    supabase.from("organization_holidays").select("id, name, holiday_date, location").eq("organization_id", orgId).gte("holiday_date", monthStart).lte("holiday_date", monthEnd),
    supabase.from("leave_requests").select("id, user_id, start_date, end_date, leave_type").eq("organization_id", orgId).eq("status", "approved").lte("start_date", monthEnd).gte("end_date", monthStart),
  ]) : [{ data: [] }, { data: [] }];
  const calendarEvents = [...(holidayResult.data ?? []).map((item) => ({ id: item.id, label: item.name, start: item.holiday_date, kind: "holiday" as const })), ...(leaveResult.data ?? []).map((item) => ({ id: item.id, label: `${item.leave_type[0]?.toUpperCase() ?? ""}${item.leave_type.slice(1)} leave`, start: item.start_date, end: item.end_date, kind: "leave" as const, userId: item.user_id }))];
  const peopleIds = [...new Set([...(orgMembers ?? []).map((member) => member.user_id), ...(projectMembers ?? []).map((member) => member.user_id), ...(tasks ?? []).map((task) => task.created_by), ...(tasks ?? []).flatMap((task) => [task.primary_assignee_id, task.secondary_assignee_id].filter((id): id is string => Boolean(id))), ...calendarEvents.flatMap((event) => "userId" in event ? [event.userId] : [])])];
  const { data: profiles } = peopleIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", peopleIds) : { data: [] };
  const taskIds = (tasks ?? []).map((task) => task.id);
  const customFieldIds = (customFields ?? []).map((field) => field.id);
  const [fieldValuesResult, taskAssigneesResult, projectDocsResult, attachmentsResult, commentsResult, timeEntriesResult, runningTimersResult] = await Promise.all([
    taskIds.length && customFieldIds.length ? supabase.from("task_custom_field_values").select("task_id, field_id, value").in("task_id", taskIds).in("field_id", customFieldIds) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("task_assignees").select("task_id, user_id, assigned_at").in("task_id", taskIds).order("assigned_at", { ascending: true }) : Promise.resolve({ data: [] }),
    supabase.from("project_documents").select("id, title, body_markdown, updated_at").eq("project_id", projectId).order("updated_at", { ascending: false }),
    taskIds.length ? supabase.from("task_attachments").select("id, task_id, file_name, mime_type, external_file_id, external_url").in("task_id", taskIds) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("task_comments").select("task_id").in("task_id", taskIds) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("time_entries").select("task_id, duration_minutes, billable").in("task_id", taskIds).not("ended_at", "is", null) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("time_entries").select("id, task_id, user_id, started_at, billable").in("task_id", taskIds).is("ended_at", null) : Promise.resolve({ data: [] }),
  ]);
  const { data: fieldValues } = fieldValuesResult;
  const { data: taskAssigneeRows } = taskAssigneesResult;
  const { data: projectDocs } = projectDocsResult;
  const taskAttachments = attachmentsResult.data ?? [];
  const commentRows = commentsResult.data ?? [];
  const timeEntriesRows = timeEntriesResult.data ?? [];

  const billableMinutesMap = new Map<string, number>();
  for (const entry of timeEntriesRows) {
    if (entry.billable && entry.duration_minutes) {
      billableMinutesMap.set(
        entry.task_id,
        (billableMinutesMap.get(entry.task_id) ?? 0) + entry.duration_minutes
      );
    }
  }

  const attachmentsMap = new Map<string, Array<{ id: string; file_name: string; mime_type: string; external_file_id: string; external_url: string | null }>>();
  for (const att of taskAttachments) {
    const list = attachmentsMap.get(att.task_id) ?? [];
    list.push(att);
    attachmentsMap.set(att.task_id, list);
  }

  const people = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "Team member"]));

  const runningTimerMap = new Map<string, { id: string; started_at: string; billable?: boolean; user_id?: string; user_name?: string; is_current_user?: boolean }>();
  for (const rt of runningTimersResult.data ?? []) {
    if (rt.task_id) {
      runningTimerMap.set(rt.task_id, {
        id: rt.id,
        started_at: rt.started_at,
        billable: rt.billable ?? true,
        user_id: rt.user_id,
        user_name: people.get(rt.user_id) || "Teammate",
        is_current_user: rt.user_id === user.id,
      });
    }
  }

  const commentCounts = new Map<string, number>();
  for (const c of commentRows) {
    commentCounts.set(c.task_id, (commentCounts.get(c.task_id) ?? 0) + 1);
  }
  // Build ordered assignee map: taskId -> [userId in order]
  const taskAssigneeMap = new Map<string, string[]>();
  for (const row of taskAssigneeRows ?? []) {
    const list = taskAssigneeMap.get(row.task_id) ?? [];
    list.push(row.user_id);
    taskAssigneeMap.set(row.task_id, list);
  }
  const createdBy = new Map((tasks ?? []).map((task) => [task.created_by, people.get(task.created_by) ?? "Team member"]));
  const members = (orgMembers ?? []).map((member) => ({ id: member.user_id, label: people.get(member.user_id) ?? "Team member" }));
  const projectMemberIds = new Set((projectMembers ?? []).map((member) => member.user_id));
  const availableMembers = members.filter((member) => !projectMemberIds.has(member.id));
  const customValues = new Map<string, Map<string, string>>();
  for (const row of fieldValues ?? []) {
    const value = row.value == null ? "" : Array.isArray(row.value) ? row.value.join(", ") : typeof row.value === "object" ? JSON.stringify(row.value) : String(row.value);
    customValues.set(row.task_id, new Map(customValues.get(row.task_id) ?? []).set(row.field_id, value));
  }
  const error = filters.error;
  const viewHref = (nextView: string) => {
    const params = new URLSearchParams();
    params.set("view", nextView);
    for (const key of ["q", "status", "priority", "assignee", "sort", "month", "group"]) if (filters[key as keyof typeof filters]) params.set(key, filters[key as keyof typeof filters]!);
    return `/projects/${projectId}?${params.toString()}`;
  };
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const key of ["view", "q", "status", "priority", "assignee", "sort", "month", "group"]) if (filters[key as keyof typeof filters]) params.set(key, filters[key as keyof typeof filters]!);
    params.set("page", String(nextPage));
    return `/projects/${projectId}?${params.toString()}`;
  };

  return <main className="app-shell project-app-shell">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/></div></header>
    <div className="project-page">
      {error && <p className="error" role="alert">That change could not be saved. Check access and required fields.</p>}
      <section className="task-panel">
        <nav className="view-tabs" aria-label="Task views">
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "nowrap" }}>
            <Link className={view === "list" ? "selected" : ""} href={viewHref("list")}>List</Link>
            <Link className={view === "board" ? "selected" : ""} href={viewHref("board")}>Board</Link>
            <Link className={view === "calendar" ? "selected" : ""} href={viewHref("calendar")}>Calendar</Link>
            <Link className={view === "gantt" ? "selected" : ""} href={viewHref("gantt")}>Timeline</Link>
            <Link className={view === "workload" ? "selected" : ""} href={viewHref("workload")}>Workload</Link>
            <Link className={view === "whiteboard" ? "selected" : ""} href={viewHref("whiteboard")}>Whiteboard</Link>
            <Link className={view === "flowchart" ? "selected" : ""} href={viewHref("flowchart")}>Flowchart</Link>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            {!canEdit && <span className="role-pill" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontSize: "11px", padding: "2px 8px" }}>View-only</span>}
            <FavoriteButton
              entityType="project"
              entityId={projectId}
              projectId={projectId}
              title={project.name}
              subtitle={workspace?.name ? `${workspace.name} · Project` : "Project"}
              initialFavorited={isProjectFavorited}
              label="Favorite"
              compact
            />
            <a className="export-link" href={`/api/projects/${projectId}/tasks.csv`} style={{ fontSize: "12px" }}>Export CSV</a>
            {canManage && (
              <ProjectSettingsPanel
                projectId={project.id}
                statuses={(statuses ?? []).map(({ id, name, color, category }) => ({ id, name, color, category }))}
                members={members}
                projectMembers={projectMembers ?? []}
                customFields={(customFields ?? []).map(({ id, name, field_type, required }) => ({ id, name, field_type, required }))}
                people={people}
                availableMembers={availableMembers}
                currentStatus={project.status}
              />
            )}
          </div>
        </nav>
        <TaskFilterToolbar
          projectId={project.id}
          projectName={project.name}
          statuses={(statuses ?? []).map(({ id, name, color, category }) => ({ id, name, color, category }))}
          members={members}
          currentFilters={{
            q: filters.q,
            status: filters.status,
            priority: filters.priority,
            assignee: filters.assignee,
            sort: filters.sort,
            view,
            group: filters.group,
          }}
        />
        {view === "list" ? <TaskTable projectId={project.id} canEdit={canEdit} tasks={(tasks ?? []).map((task) => ({ ...task, assigneeIds: taskAssigneeMap.get(task.id) ?? [], billable_minutes: billableMinutesMap.get(task.id) ?? 0 }))} statuses={(statuses ?? []).map(({ id, name, color }) => ({ id, name, color }))} members={members} createdBy={createdBy} customFields={(customFields ?? []).map(({ id, name, field_type }) => ({ id, name, field_type }))} customValues={customValues} attachmentsMap={attachmentsMap} projectDocuments={(projectDocs ?? []).map(({ id, title, body_markdown }) => ({ id, title, body_markdown }))} commentCounts={commentCounts} runningTimerMap={runningTimerMap} initialGroupBy={(filters.group as "status" | "priority" | "due_date" | "none") || "status"} /> : view === "board" ? <TaskBoard projectId={project.id} canEdit={canEdit} tasks={tasks ?? []} statuses={(statuses ?? []).map(({ id, name, color }) => ({ id, name, color }))} people={people}/> : view === "calendar" ? <TaskCalendar projectId={project.id} tasks={(tasks ?? []).map((task) => ({ ...task, status_category: statuses?.find((status) => status.id === task.status_id)?.category }))} statuses={(statuses ?? []).map(({ id, name, color }) => ({ id, name, color }))} events={calendarEvents.map((event) => ({ id: event.id, label: event.label, start: event.start, end: "end" in event ? event.end : undefined, kind: event.kind, person: "userId" in event ? people.get(event.userId) : undefined }))} month={filters.month}/> : view === "gantt" ? <TaskGantt projectId={project.id} tasks={(tasks ?? []).map(({ id, generated_key, title, start_date, due_date, progress, created_at, status_id }) => ({ id, generated_key, title, start_date, due_date, progress, created_at, status_category: statuses?.find((status) => status.id === status_id)?.category }))} events={calendarEvents.map((event) => ({ id: event.id, label: event.label, start: event.start, end: "end" in event ? event.end : undefined, kind: event.kind, person: "userId" in event ? people.get(event.userId) : undefined }))} month={filters.month}/> : view === "whiteboard" ? <ProjectWhiteboardView projectId={project.id} documents={projectDocs ?? []}/> : view === "flowchart" ? <ProjectFlowchartView projectId={project.id} documents={projectDocs ?? []}/> : <TaskWorkload projectId={project.id} tasks={(tasks ?? []).map(({ id, generated_key, title, estimate_minutes, primary_assignee_id, secondary_assignee_id, due_date }) => ({ id, generated_key, title, estimate_minutes, primary_assignee_id, secondary_assignee_id, due_date }))} people={people}/>}
        {(taskCount ?? 0) > 100 && (
          <div className="task-pagination">
            {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}
            <span>Page {page} of {Math.ceil((taskCount ?? 0) / 100)}</span>
            {page * 100 < (taskCount ?? 0) && <Link href={pageHref(page + 1)}>Next</Link>}
          </div>
        )}
      </section>
    </div>
  </main>;
}
