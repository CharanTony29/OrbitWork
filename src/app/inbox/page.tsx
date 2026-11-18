import AppTopBar from "@/app/AppTopBar";
import PrimarySpaceLeftSlot from "@/app/PrimarySpaceLeftSlot";
import AppRailLayout from "@/app/AppRailLayout";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import InboxClient, { type InboxBucket, type InboxItemKind, type InboxRowItem } from "./InboxClient";
import "./inbox-redesign.css";

function isPrimaryNotificationType(eventType: string): boolean {
  const lower = (eventType || "").toLowerCase();
  return (
    lower.includes("assign") ||
    lower.includes("mention") ||
    lower.includes("comment") ||
    lower.includes("leave") ||
    lower.includes("overdue") ||
    lower.includes("due") ||
    lower.includes("approval")
  );
}

function classifyNotificationKind(eventType: string): InboxItemKind {
  const lower = (eventType || "").toLowerCase();
  if (lower.includes("leave")) return "leave";
  if (lower.includes("assign")) return "assignment";
  if (lower.includes("mention") || lower.includes("comment")) return "mention";
  if (lower.includes("overdue")) return "overdue";
  return "activity";
}

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) redirect("/login");

  const extNotifPromise = supabase
    .from("notifications")
    .select(
      "id, actor_id, project_id, task_id, organization_id, action_url, event_type, message, created_at, read_at"
    )
    .order("created_at", { ascending: false })
    .limit(120);

  const inboxStatesPromise = supabase
    .from("user_inbox_states")
    .select("item_key, bucket, is_read")
    .eq("user_id", user.id);

  const [
    notifResultExt,
    multiAssigneeResult,
    directAssigneeResult,
    pendingLeavesResult,
    inboxStatesResult,
  ] = await Promise.all([
    extNotifPromise,
    supabase.from("task_assignees").select("task_id").eq("user_id", user.id),
    supabase
      .from("tasks")
      .select(
        "id, project_id, title, generated_key, priority, due_date, status_id, created_at, updated_at, created_by, projects(id, name, workspace_id, workspaces(id, name))"
      )
      .or(`primary_assignee_id.eq.${user.id},secondary_assignee_id.eq.${user.id}`),
    supabase
      .from("leave_requests")
      .select(
        "id, organization_id, user_id, leave_type, start_date, end_date, request_note, status, created_at"
      )
      .eq("status", "pending")
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    inboxStatesPromise,
  ]);

  const notifications: Array<{
    id: string;
    actor_id: string | null;
    project_id: string | null;
    task_id: string | null;
    organization_id?: string | null;
    action_url?: string | null;
    event_type: string;
    message: string;
    created_at: string;
    read_at: string | null;
  }> = notifResultExt.error
    ? (
        await supabase
          .from("notifications")
          .select("id, actor_id, project_id, task_id, event_type, message, created_at, read_at")
          .order("created_at", { ascending: false })
          .limit(120)
      ).data ?? []
    : notifResultExt.data ?? [];

  const savedStates = new Map<string, { bucket: InboxBucket; is_read: boolean }>();
  if (!inboxStatesResult.error && inboxStatesResult.data) {
    for (const row of inboxStatesResult.data) {
      if (
        row.bucket === "primary" ||
        row.bucket === "other" ||
        row.bucket === "later" ||
        row.bucket === "cleared"
      ) {
        savedStates.set(row.item_key, { bucket: row.bucket, is_read: Boolean(row.is_read) });
      }
    }
  }

  const pendingLeaves = pendingLeavesResult.data ?? [];
  const multiTaskIds = (multiAssigneeResult.data ?? []).map((r) => r.task_id);
  const directTasks = directAssigneeResult.data ?? [];

  const notifTaskIds = notifications
    .map((n) => n.task_id)
    .filter((id): id is string => Boolean(id));

  const allNeededTaskIds = [
    ...new Set([...multiTaskIds, ...directTasks.map((t) => t.id), ...notifTaskIds]),
  ];
  const missingTaskIds = allNeededTaskIds.filter(
    (id) => !directTasks.some((t) => t.id === id)
  );

  const { data: missingTasks } = missingTaskIds.length
    ? await supabase
        .from("tasks")
        .select(
          "id, project_id, title, generated_key, priority, due_date, status_id, created_at, updated_at, created_by, projects(id, name, workspace_id, workspaces(id, name))"
        )
        .in("id", missingTaskIds)
    : { data: [] };

  const allTasksMap = new Map<string, (typeof directTasks)[number]>();
  for (const t of directTasks) allTasksMap.set(t.id, t);
  for (const t of missingTasks ?? []) allTasksMap.set(t.id, t);

  const assignedTaskIdSet = new Set([...multiTaskIds, ...directTasks.map((t) => t.id)]);
  const assignedTasks = [...assignedTaskIdSet]
    .map((id) => allTasksMap.get(id))
    .filter((t): t is (typeof directTasks)[number] => Boolean(t));

  const projectIds = [
    ...new Set([
      ...assignedTasks.map((t) => t.project_id).filter(Boolean),
      ...notifications.map((n) => n.project_id).filter((id): id is string => Boolean(id)),
    ]),
  ];

  const [{ data: statuses }, { data: projectsRows }] = await Promise.all([
    projectIds.length
      ? supabase
          .from("project_statuses")
          .select("id, project_id, name, color, category")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const statusMap = new Map(
    (statuses ?? []).map((s) => [`${s.project_id}-${s.id}`, s])
  );
  const projectNameMap = new Map((projectsRows ?? []).map((p) => [p.id, p.name]));

  const actorIds = [
    ...new Set([
      ...notifications
        .map((item) => item.actor_id)
        .filter((id): id is string => Boolean(id)),
      ...pendingLeaves.map((l) => l.user_id).filter(Boolean),
      ...assignedTasks
        .map((t) => (t as { created_by?: string | null }).created_by)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const { data: profiles } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", actorIds)
    : { data: [] };

  const actorNames = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.display_name?.trim() || profile.email || "A teammate",
    ])
  );

  const today = new Date().toISOString().slice(0, 10);
  const unifiedItems: InboxRowItem[] = [];
  const handledTaskIds = new Set<string>();

  // 1. Group notifications by task_id (or standalone notification id)
  const taskNotifGroups = new Map<string, typeof notifications>();
  const standaloneNotifs: typeof notifications = [];
  for (const n of notifications) {
    if (n.task_id) {
      const list = taskNotifGroups.get(n.task_id) ?? [];
      list.push(n);
      taskNotifGroups.set(n.task_id, list);
    } else {
      standaloneNotifs.push(n);
    }
  }

  for (const [taskId, group] of taskNotifGroups.entries()) {
    handledTaskIds.add(taskId);
    const latest = group[0];
    const task = allTasksMap.get(taskId);
    const status = task ? statusMap.get(`${task.project_id}-${task.status_id}`) : undefined;
    const projectObj = task
      ? Array.isArray(task.projects)
        ? task.projects[0]
        : task.projects
      : null;
    const projectName =
      projectObj?.name || (latest.project_id ? projectNameMap.get(latest.project_id) ?? null : null);
    const isOverdue = Boolean(
      task?.due_date &&
        task.due_date < today &&
        status?.category !== "completed" &&
        status?.category !== "cancelled"
    );
    const isAssigned = assignedTaskIdSet.has(taskId);
    const defaultBucket: "primary" | "other" =
      isAssigned || isOverdue || group.some((n) => isPrimaryNotificationType(n.event_type))
        ? "primary"
        : "other";
    const itemKey = `task:${taskId}`;
    const saved = savedStates.get(itemKey);
    const unreadInGroup = group.some((n) => !n.read_at);

    unifiedItems.push({
      itemKey,
      defaultBucket,
      bucket: saved?.bucket ?? defaultBucket,
      isRead: saved ? saved.is_read : !unreadInGroup,
      kind: isOverdue ? "overdue" : classifyNotificationKind(latest.event_type),
      title: task?.title || latest.message.slice(0, 90),
      actorName: latest.actor_id ? actorNames.get(latest.actor_id) ?? "A teammate" : "Orbitwork",
      summaryText: latest.message,
      href:
        latest.action_url ||
        (latest.project_id ? `/projects/${latest.project_id}/tasks/${taskId}` : null),
      projectName,
      statusColor: status?.color ?? null,
      statusName: status?.name ?? null,
      priority: task?.priority ?? null,
      isOverdue,
      eventCount: group.length,
      createdAt: latest.created_at,
      notificationIds: group.map((n) => n.id),
    });
  }

  // 2. Assigned tasks that don't already have a grouped notification row
  for (const task of assignedTasks) {
    if (handledTaskIds.has(task.id)) continue;
    const status = statusMap.get(`${task.project_id}-${task.status_id}`);
    if (status?.category === "completed" || status?.category === "cancelled") continue;
    const projectObj = Array.isArray(task.projects) ? task.projects[0] : task.projects;
    const isOverdue = Boolean(task.due_date && task.due_date < today);
    const itemKey = `task:${task.id}`;
    const saved = savedStates.get(itemKey);
    const createdBy = (task as { created_by?: string | null }).created_by;

    unifiedItems.push({
      itemKey,
      defaultBucket: "primary",
      bucket: saved?.bucket ?? "primary",
      isRead: saved ? saved.is_read : false,
      kind: isOverdue ? "overdue" : "assignment",
      title: task.title,
      actorName: createdBy ? actorNames.get(createdBy) ?? "Teammate" : "Orbitwork",
      summaryText: isOverdue
        ? `assigned this task to you (overdue since ${task.due_date})`
        : "assigned this task to you",
      href: `/projects/${task.project_id}/tasks/${task.id}`,
      projectName: projectObj?.name ?? projectNameMap.get(task.project_id) ?? null,
      statusColor: status?.color ?? null,
      statusName: status?.name ?? null,
      priority: task.priority ?? null,
      isOverdue,
      eventCount: 1,
      createdAt: (task as { updated_at?: string | null }).updated_at || task.created_at,
      notificationIds: [],
    });
  }

  // 3. Standalone notifications (project-level, org-level, leave notifications)
  for (const item of standaloneNotifs) {
    const defaultBucket: "primary" | "other" = isPrimaryNotificationType(item.event_type)
      ? "primary"
      : "other";
    const itemKey = `notif:${item.id}`;
    const saved = savedStates.get(itemKey);
    const targetHref =
      item.action_url ||
      (item.organization_id && item.event_type.startsWith("leave")
        ? `/organizations/${item.organization_id}/calendar`
        : item.project_id
        ? `/projects/${item.project_id}`
        : null);

    unifiedItems.push({
      itemKey,
      defaultBucket,
      bucket: saved?.bucket ?? defaultBucket,
      isRead: saved ? saved.is_read : Boolean(item.read_at),
      kind: classifyNotificationKind(item.event_type),
      title:
        item.project_id && projectNameMap.get(item.project_id)
          ? `${projectNameMap.get(item.project_id)} update`
          : item.event_type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      actorName: item.actor_id ? actorNames.get(item.actor_id) ?? "A teammate" : "Orbitwork",
      summaryText: item.message,
      href: targetHref,
      projectName: item.project_id ? projectNameMap.get(item.project_id) ?? null : null,
      statusColor: null,
      statusName: null,
      priority: null,
      isOverdue: false,
      eventCount: 1,
      createdAt: item.created_at,
      notificationIds: [item.id],
    });
  }

  // 4. Pending leave approvals for managers/admins
  for (const leave of pendingLeaves) {
    const itemKey = `leave:${leave.id}`;
    const saved = savedStates.get(itemKey);
    const requester = actorNames.get(leave.user_id) ?? "Teammate";
    unifiedItems.push({
      itemKey,
      defaultBucket: "primary",
      bucket: saved?.bucket ?? "primary",
      isRead: saved ? saved.is_read : false,
      kind: "leave",
      title: `${leave.leave_type} leave (${leave.start_date} – ${leave.end_date})`,
      actorName: requester,
      summaryText: leave.request_note
        ? `requested ${leave.leave_type} leave · ${leave.request_note}`
        : `requested ${leave.leave_type} leave for approval`,
      href: `/organizations/${leave.organization_id}/calendar`,
      projectName: null,
      statusColor: "#f59e0b",
      statusName: "Pending approval",
      priority: null,
      isOverdue: false,
      eventCount: 1,
      createdAt: leave.created_at,
      notificationIds: [],
    });
  }

  unifiedItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <AppRailLayout>
      <main className="app-shell ov-shell ov-fullpage-shell">
        <AppTopBar
          email={user.email ?? ""}
          leftSlot={
            <PrimarySpaceLeftSlot
              activeNav="inbox"
              assignedTaskCount={multiTaskIds.length}
            />
          }
        />

        <section className="ov-fullpage-content">
          <section className="inbox-page ov-command-wrap ov-full-wrap">
            <InboxClient initialItems={unifiedItems} />
          </section>
        </section>
      </main>
    </AppRailLayout>
  );
}
