import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import AppTopBar from "@/app/AppTopBar";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createTask } from "@/app/actions";

import TaskTable from "./TaskTable";
import TaskBoard from "./TaskBoard";
import TaskCalendar from "./TaskCalendar";
import TaskGantt from "./TaskGantt";
import TaskWorkload from "./TaskWorkload";
import ProjectSettingsPanel from "./ProjectSettingsPanel";
import TaskFilterToolbar from "./TaskFilterToolbar";
import ProjectWhiteboardView from "./ProjectWhiteboardView";
import ProjectFlowchartView from "./ProjectFlowchartView";
import ProjectViewTabsClient from "./ProjectViewTabsClient";
import ProjectChannelView from "./ProjectChannelView";
import ProjectGoalsView, { type ProjectGoalRecord } from "./ProjectGoalsView";
import ProjectAIAgentsHub from "@/app/ai/ProjectAIAgentsHub";
import ProjectBrainView from "./brain/ProjectBrainView";
import ProjectLiveTracker from "./ProjectLiveTracker";
import ProjectExportButton from "./ProjectExportButton";
import FavoriteButton from "@/app/FavoriteButton";
import { resolveProfileAvatarSrc } from "@/lib/chat";
import { normalizeMemberDesignations } from "@/lib/designations";
import {
  DEFAULT_PROJECT_TAB_ORDER,
  normalizeTabOrder,
  parsePreferenceArrayCookie,
  parsePreferenceWidthsCookie,
  PROJECT_TAB_COOKIE,
  ProjectTabKey,
  TABLE_COL_COOKIE,
  TABLE_COL_WIDTHS_COOKIE,
  TABLE_FROZEN_COLS_COOKIE,
} from "@/lib/project-preferences";

export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; view?: string; q?: string; status?: string; priority?: string; assignee?: string; page?: string; month?: string; sort?: string; group?: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: project } = await supabase
    .from("projects")
    .select("id, workspace_id, name, description, status, priority, start_date, due_date, created_at, icon, po_number, client_name, budget_amount, billing_notes, workspaces(name, organization_id)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();
  const filters = await searchParams;

  const cookieStore = await cookies();
  let dbPrefs: {
    project_tab_order?: unknown;
    list_column_order?: unknown;
    list_column_widths?: unknown;
    list_frozen_columns?: unknown;
  } | null = null;
  try {
    const extPrefRes = await supabase
      .from("user_preferences")
      .select("project_tab_order, list_column_order, list_column_widths, list_frozen_columns")
      .eq("user_id", user.id)
      .maybeSingle();
    if (extPrefRes.error) {
      const basePrefRes = await supabase
        .from("user_preferences")
        .select("project_tab_order, list_column_order")
        .eq("user_id", user.id)
        .maybeSingle();
      dbPrefs = basePrefRes.data;
    } else {
      dbPrefs = extPrefRes.data;
    }
  } catch {
    dbPrefs = null;
  }

  const cookieTabOrder = parsePreferenceArrayCookie(
    cookieStore.get(PROJECT_TAB_COOKIE)?.value
  );
  const rawTabOrder = Array.isArray(dbPrefs?.project_tab_order)
    ? dbPrefs.project_tab_order
    : cookieTabOrder;
  const userTabOrder = normalizeTabOrder(rawTabOrder);
  const defaultUserView: ProjectTabKey = userTabOrder[0] ?? "list";

  const cookieColOrder = parsePreferenceArrayCookie(
    cookieStore.get(TABLE_COL_COOKIE)?.value
  );
  const userColumnOrder = Array.isArray(dbPrefs?.list_column_order)
    ? dbPrefs.list_column_order.filter((c): c is string => typeof c === "string")
    : cookieColOrder;

  const cookieColWidths = parsePreferenceWidthsCookie(
    cookieStore.get(TABLE_COL_WIDTHS_COOKIE)?.value
  );
  const userColumnWidths: Record<string, number> =
    dbPrefs?.list_column_widths &&
    typeof dbPrefs.list_column_widths === "object" &&
    !Array.isArray(dbPrefs.list_column_widths) &&
    Object.keys(dbPrefs.list_column_widths).length > 0
      ? (dbPrefs.list_column_widths as Record<string, number>)
      : cookieColWidths;

  const cookieFrozenCols = parsePreferenceArrayCookie(
    cookieStore.get(TABLE_FROZEN_COLS_COOKIE)?.value
  );
  const hasDbFrozen = Array.isArray(dbPrefs?.list_frozen_columns);
  const hasCookieFrozen = Boolean(cookieStore.get(TABLE_FROZEN_COLS_COOKIE)?.value);
  const userFrozenColumns: string[] | undefined = hasDbFrozen
    ? (dbPrefs?.list_frozen_columns as unknown[]).filter((c): c is string => typeof c === "string")
    : hasCookieFrozen
    ? cookieFrozenCols
    : undefined;

  const validViews = new Set<string>(DEFAULT_PROJECT_TAB_ORDER);
  const view = (
    filters.view && validViews.has(filters.view) ? filters.view : defaultUserView
  ) as ProjectTabKey;
  const page = Math.max(1, Math.min(10000, Number.parseInt(filters.page ?? "1", 10) || 1));
  let taskQuery = supabase.from("tasks").select("id, generated_key, title, description, task_type, tags, priority, start_date, due_date, estimate_minutes, progress, status_id, parent_task_id, created_at, created_by, primary_assignee_id, secondary_assignee_id", { count: "exact" }).eq("project_id", projectId);
  const query = filters.q?.trim().replace(/[,%()]/g, " ").slice(0, 80);
  const assigneeId = filters.assignee && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.assignee) ? filters.assignee : undefined;
  if (query) taskQuery = taskQuery.or(`title.ilike.%${query}%,generated_key.ilike.%${query}%`);
  if (filters.status) taskQuery = taskQuery.eq("status_id", filters.status);
  if (["low", "normal", "high", "urgent"].includes(filters.priority ?? "")) taskQuery = taskQuery.eq("priority", filters.priority!);
  if (assigneeId) taskQuery = taskQuery.or(`primary_assignee_id.eq.${assigneeId},secondary_assignee_id.eq.${assigneeId}`);
  if (filters.sort === "due") taskQuery = taskQuery.order("due_date", { ascending: true, nullsFirst: false });
  else if (filters.sort === "due_desc") taskQuery = taskQuery.order("due_date", { ascending: false, nullsFirst: true });
  else if (filters.sort === "name" || filters.sort === "title" || filters.sort === "name_asc") taskQuery = taskQuery.order("title", { ascending: true });
  else if (filters.sort === "name_desc" || filters.sort === "title_desc") taskQuery = taskQuery.order("title", { ascending: false });
  else if (filters.sort === "priority" || filters.sort === "priority_asc") taskQuery = taskQuery.order("priority", { ascending: true });
  else if (filters.sort === "priority_desc") taskQuery = taskQuery.order("priority", { ascending: false });
  else if (filters.sort === "created" || filters.sort === "created_asc") taskQuery = taskQuery.order("created_at", { ascending: true });
  else taskQuery = taskQuery.order("created_at", { ascending: false });
  const PAGE_SIZE = 500;
  const [statusResult, taskResult, memberResult, fieldResult, canEditResult, canManageResult] = await Promise.all([
    supabase.from("project_statuses").select("id, name, color, category, position, is_default").eq("project_id", projectId).order("position"),
    taskQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
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
  const { data: orgMembers } = orgId ? await supabase.from("organization_members").select("user_id, role, designations, primary_designation").eq("organization_id", orgId).eq("status", "active") : { data: [] };
  const monthKey = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : today.slice(0, 7);
  const currentYear = Number(monthKey.slice(0, 4));
  const rangeStart = view === "gantt" ? `${currentYear}-01-01` : `${monthKey}-01`;
  const rangeEnd = view === "gantt"
    ? `${currentYear}-12-31`
    : new Date(Date.UTC(currentYear, Number(monthKey.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [holidayResult, leaveResult] = orgId ? await Promise.all([
    supabase.from("organization_holidays").select("id, name, holiday_date, location").eq("organization_id", orgId).gte("holiday_date", rangeStart).lte("holiday_date", rangeEnd),
    supabase.from("leave_requests").select("id, user_id, start_date, end_date, leave_type").eq("organization_id", orgId).eq("status", "approved").lte("start_date", rangeEnd).gte("end_date", rangeStart),
  ]) : [{ data: [] }, { data: [] }];
  const calendarEvents = [
    ...(holidayResult.data ?? []).map((item) => ({
      id: item.id,
      label: item.name ?? "Holiday",
      start: item.holiday_date,
      kind: "holiday" as const,
    })),
    ...(leaveResult.data ?? []).map((item) => {
      const rawType = typeof item.leave_type === "string" ? item.leave_type.trim() : "";
      const typeLabel = rawType ? `${rawType.charAt(0).toUpperCase()}${rawType.slice(1)}` : "Sick";
      return {
        id: item.id,
        label: `${typeLabel} leave`,
        start: item.start_date,
        end: item.end_date,
        kind: "leave" as const,
        userId: item.user_id,
      };
    }),
  ];
  const taskIds = (tasks ?? []).map((task) => task.id);
  const customFieldIds = (customFields ?? []).map((field) => field.id);
  const needsProjectDocs = view === "list" || view === "whiteboard" || view === "flowchart";
  const [fieldValuesResult, taskAssigneesResult, projectDocsResult, attachmentsResult, commentsResult, timeEntriesResult, runningTimersResult, projectGoalsResult] = await Promise.all([
    taskIds.length && customFieldIds.length ? supabase.from("task_custom_field_values").select("task_id, field_id, value").in("task_id", taskIds).in("field_id", customFieldIds) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("task_assignees").select("task_id, user_id, assigned_at").in("task_id", taskIds).order("assigned_at", { ascending: true }) : Promise.resolve({ data: [] }),
    needsProjectDocs
      ? supabase.from("project_documents").select("id, title, body_markdown, updated_at").eq("project_id", projectId).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("task_attachments").select("id, task_id, file_name, mime_type, external_file_id, external_url").in("task_id", taskIds) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("task_comments").select("task_id").in("task_id", taskIds) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("time_entries").select("task_id, duration_minutes, billable").in("task_id", taskIds).not("ended_at", "is", null) : Promise.resolve({ data: [] }),
    taskIds.length ? supabase.from("time_entries").select("id, task_id, user_id, started_at, billable").in("task_id", taskIds).is("ended_at", null) : Promise.resolve({ data: [] }),
    view === "goals"
      ? supabase.from("project_goals").select("*").eq("project_id", projectId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: fieldValues } = fieldValuesResult;
  const { data: taskAssigneeRows } = taskAssigneesResult;

  const peopleIds = [
    ...new Set([
      ...(orgMembers ?? []).map((member) => member.user_id),
      ...(projectMembers ?? []).map((member) => member.user_id),
      ...(tasks ?? []).map((task) => task.created_by),
      ...(tasks ?? []).flatMap((task) => [task.primary_assignee_id, task.secondary_assignee_id].filter((id): id is string => Boolean(id))),
      ...(taskAssigneeRows ?? []).map((row) => row.user_id),
      ...calendarEvents.flatMap((event) => ("userId" in event && event.userId ? [event.userId] : [])),
    ]),
  ];
  const { data: profiles } = peopleIds.length
    ? await supabase.from("profiles").select("id, display_name, email, avatar_url, designation, designations").in("id", peopleIds)
    : { data: [] };

  const profileAvatars = new Map(
    (profiles ?? []).map((p) => [p.id, resolveProfileAvatarSrc(p.id, p.avatar_url)])
  );
  const people = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "Team member"])
  );
  const rawProjectDocs = projectDocsResult.data ?? [];
  const projectDocs =
    view === "list"
      ? rawProjectDocs.map((doc) => ({
          ...doc,
          // Preserve JSON canvas payloads for quick whiteboard/flowchart opening; strip large markdown docs on List view
          body_markdown: doc.body_markdown?.trimStart().startsWith("{") ? doc.body_markdown : "",
        }))
      : rawProjectDocs;
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
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const members = (orgMembers ?? []).map((member: any) => {
    const prof = profileMap.get(member.user_id);
    const desigs = normalizeMemberDesignations(
      member.designations || prof?.designations,
      member.primary_designation || prof?.designation
    );
    return {
      id: member.user_id,
      label: people.get(member.user_id) ?? "Team member",
      avatarUrl: profileAvatars.get(member.user_id) ?? null,
      designations: desigs,
      role: member.role,
    };
  });

  const getTaskAssignees = (task: { id: string; primary_assignee_id?: string | null; secondary_assignee_id?: string | null }) => {
    const fromMap = taskAssigneeMap.get(task.id) ?? [];
    const direct = [task.primary_assignee_id, task.secondary_assignee_id].filter((id): id is string => Boolean(id));
    return [...new Set([...fromMap, ...direct])];
  };

  const enrichedCalendarEvents = calendarEvents.map((event) => ({
    id: event.id,
    label: event.label,
    start: event.start,
    end: "end" in event ? event.end : undefined,
    kind: event.kind,
    person: "userId" in event && event.userId ? people.get(event.userId) : undefined,
    avatarUrl: "userId" in event && event.userId ? profileAvatars.get(event.userId) : undefined,
  }));
  const projectMemberIds = new Set((projectMembers ?? []).map((member) => member.user_id));
  const availableMembers = members.filter((member) => !projectMemberIds.has(member.id));
  const customValues = new Map<string, Map<string, string>>();
  for (const row of fieldValues ?? []) {
    const value = row.value == null ? "" : Array.isArray(row.value) ? row.value.join(", ") : typeof row.value === "object" ? JSON.stringify(row.value) : String(row.value);
    customValues.set(row.task_id, new Map(customValues.get(row.task_id) ?? []).set(row.field_id, value));
  }
  const error = filters.error;
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const key of ["view", "q", "status", "priority", "assignee", "sort", "month", "group"]) if (filters[key as keyof typeof filters]) params.set(key, filters[key as keyof typeof filters]!);
    params.set("page", String(nextPage));
    return `/projects/${projectId}?${params.toString()}`;
  };

  return <main className="app-shell project-app-shell">
    <AppTopBar
      email={user.email ?? ""}
      projectId={projectId}
      workspaceId={project.workspace_id}
      workspaceName={workspace?.name}
      organizationId={workspace?.organization_id}
    />
    <div className="project-page">
      {error && <p className="error" role="alert">That change could not be saved. Check access and required fields.</p>}
      <section className="task-panel">
        <nav className="view-tabs" aria-label="Task views">
          <ProjectViewTabsClient
            projectId={project.id}
            activeView={view}
            initialTabOrder={userTabOrder}
            preservedFilters={{
              q: filters.q,
              status: filters.status,
              priority: filters.priority,
              assignee: filters.assignee,
              sort: filters.sort,
              month: filters.month,
              group: filters.group,
            }}
          />
          <div className="view-tabs-actions" style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
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
            <ProjectExportButton
              projectId={projectId}
              projectName={project.name}
              tasks={(tasks ?? []).map((t) => ({
                ...t,
                assigneeIds: getTaskAssignees(t),
              }))}
              statuses={(statuses ?? []).map(({ id, name, color, category }) => ({ id, name, color, category }))}
              members={members}
              customFields={(customFields ?? []).map(({ id, name, field_type }) => ({ id, name, field_type }))}
            />
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
                projectName={project.name}
                projectDescription={project.description}
                projectIcon={(project as any).icon || "📁"}
                startDate={(project as any).start_date || ""}
                dueDate={project.due_date || ""}
                poNumber={(project as any).po_number || ""}
                clientName={(project as any).client_name || ""}
                budgetAmount={(project as any).budget_amount ? String((project as any).budget_amount) : ""}
                billingNotes={(project as any).billing_notes || ""}
                canManage={canManage}
              />
            )}
          </div>
        </nav>
        {view !== "channel" && view !== "goals" && view !== "agents" && view !== "brain" && view !== "live" && (
          <TaskFilterToolbar
            projectId={project.id}
            projectName={project.name}
            statuses={(statuses ?? []).map(({ id, name, color, category }) => ({ id, name, color, category }))}
            members={members}
            customFields={(customFields ?? []).map(({ id, name, field_type }) => ({ id, name, field_type }))}
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
        )}
        {view === "live" ? (
          <ProjectLiveTracker
            projectId={project.id}
            projectName={project.name}
            workspaceName={workspace?.name}
            initialTasks={(tasks ?? []).map((task) => ({
              ...task,
              assigneeIds: getTaskAssignees(task),
            }))}
            statuses={(statuses ?? []).map(({ id, name, color, category }) => ({ id, name, color, category }))}
            people={people}
            canEdit={canEdit}
          />
        ) : view === "list" ? (
          <TaskTable
            projectId={project.id}
            canEdit={canEdit}
            initialColumnOrder={userColumnOrder}
            initialColumnWidths={userColumnWidths}
            initialFrozenColumns={userFrozenColumns}
            tasks={(tasks ?? []).map((task) => ({
              ...task,
              assigneeIds: getTaskAssignees(task),
              billable_minutes: billableMinutesMap.get(task.id) ?? 0,
            }))}
            statuses={(statuses ?? []).map(({ id, name, color }) => ({ id, name, color }))}
            members={members}
            createdBy={createdBy}
            customFields={(customFields ?? []).map(({ id, name, field_type }) => ({ id, name, field_type }))}
            customValues={customValues}
            attachmentsMap={attachmentsMap}
            projectDocuments={(projectDocs ?? []).map(({ id, title, body_markdown }) => ({ id, title, body_markdown }))}
            commentCounts={commentCounts}
            runningTimerMap={runningTimerMap}
            initialGroupBy={filters.group || "status"}
          />
        ) : view === "board" ? (
          <TaskBoard
            projectId={project.id}
            canEdit={canEdit}
            tasks={tasks ?? []}
            statuses={(statuses ?? []).map(({ id, name, color, category }) => ({ id, name, color, category }))}
            people={people}
            profileAvatars={profileAvatars}
          />
        ) : view === "calendar" ? (
          <TaskCalendar
            projectId={project.id}
            tasks={(tasks ?? []).map((task) => ({
              ...task,
              status_category: statuses?.find((status) => status.id === task.status_id)?.category,
            }))}
            statuses={(statuses ?? []).map(({ id, name, color }) => ({ id, name, color }))}
            events={enrichedCalendarEvents}
            month={filters.month}
          />
        ) : view === "gantt" ? (
          <TaskGantt
            projectId={project.id}
            tasks={(tasks ?? []).map((task) => ({
              id: task.id,
              generated_key: task.generated_key,
              title: task.title,
              start_date: task.start_date,
              due_date: task.due_date,
              progress: task.progress,
              created_at: task.created_at,
              parent_task_id: task.parent_task_id,
              status_id: task.status_id,
              status_category: statuses?.find((status) => status.id === task.status_id)?.category,
              assigneeIds: getTaskAssignees(task),
            }))}
            events={enrichedCalendarEvents}
            people={people}
            profileAvatars={profileAvatars}
            month={filters.month}
          />
        ) : view === "whiteboard" ? (
          <ProjectWhiteboardView projectId={project.id} documents={projectDocs ?? []} />
        ) : view === "flowchart" ? (
          <ProjectFlowchartView projectId={project.id} documents={projectDocs ?? []} />
        ) : view === "channel" ? (
          <ProjectChannelView projectId={project.id} projectName={project.name} />
        ) : view === "goals" ? (
          <ProjectGoalsView
            projectId={project.id}
            projectName={project.name}
            canEdit={canEdit}
            members={members}
            initialGoals={((projectGoalsResult.data ?? []) as ProjectGoalRecord[])}
            schemaMissing={Boolean(projectGoalsResult.error)}
          />
        ) : view === "agents" ? (
          <ProjectAIAgentsHub projectId={project.id} projectName={project.name} />
        ) : view === "brain" ? (
          <ProjectBrainView
            projectId={project.id}
            projectName={project.name}
            canEdit={canEdit}
          />
        ) : (
          <TaskWorkload
            projectId={project.id}
            tasks={(tasks ?? []).map(({ id, generated_key, title, estimate_minutes, primary_assignee_id, secondary_assignee_id, due_date }) => ({
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
          />
        )}
        {view !== "channel" && view !== "goals" && view !== "agents" && view !== "brain" && view !== "live" && (taskCount ?? 0) > 100 && (
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
