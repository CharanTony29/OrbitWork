import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { redirect } from "next/navigation";
import BackButton from "@/app/BackButton";
import {
  Bell,
  CheckSquare,
  Clock,
  FolderKanban,
  ExternalLink,
} from "lucide-react";
import { markNotificationsRead, signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // 1. Parallel fetch notifications, task_assignees rows, and direct assignee tasks
  const [notifResult, multiAssigneeResult, directAssigneeResult] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("id, actor_id, project_id, task_id, event_type, message, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("task_assignees")
        .select("task_id")
        .eq("user_id", user.id),
      supabase
        .from("tasks")
        .select("id, project_id, title, generated_key, priority, due_date, status_id, created_at, projects(id, name, workspace_id, workspaces(id, name))")
        .or(`primary_assignee_id.eq.${user.id},secondary_assignee_id.eq.${user.id}`),
    ]);

  const notifications = notifResult.data ?? [];
  const multiTaskIds = (multiAssigneeResult.data ?? []).map((r) => r.task_id);
  const directTasks = directAssigneeResult.data ?? [];

  // Combine task IDs
  const allTaskIds = [
    ...new Set([...multiTaskIds, ...directTasks.map((t) => t.id)]),
  ];

  // Fetch full details for multi-assignee tasks not in directTasks
  const missingTaskIds = allTaskIds.filter(
    (id) => !directTasks.some((t) => t.id === id)
  );

  const { data: missingTasks } = missingTaskIds.length
    ? await supabase
        .from("tasks")
        .select(
          "id, project_id, title, generated_key, priority, due_date, status_id, created_at, projects(id, name, workspace_id, workspaces(id, name))"
        )
        .in("id", missingTaskIds)
    : { data: [] };

  const assignedTasks = [...directTasks, ...(missingTasks ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Fetch statuses for assigned tasks
  const projectIds = [
    ...new Set(assignedTasks.map((t) => t.project_id).filter(Boolean)),
  ];
  const { data: statuses } = projectIds.length
    ? await supabase
        .from("project_statuses")
        .select("id, project_id, name, color, category")
        .in("project_id", projectIds)
    : { data: [] };

  const statusMap = new Map(
    (statuses ?? []).map((s) => [`${s.project_id}-${s.id}`, s])
  );

  // Fetch actor names for notifications
  const actorIds = [
    ...new Set(
      notifications
        .map((item) => item.actor_id)
        .filter((id): id is string => Boolean(id))
    ),
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

  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>
        <div className="topbar-right">
          <CurrentUserBadge email={user.email ?? ""} />
        </div>
      </header>

      <section className="inbox-page">
        <BackButton fallbackHref="/dashboard" label="Dashboard" />

        <div className="inbox-heading">
          <div>
            <p className="eyebrow">YOUR SPACE</p>
            <h1>
              Inbox{" "}
              <span className="count-pill">
                {assignedTasks.length} assigned {assignedTasks.length === 1 ? "task" : "tasks"}
              </span>
              {unreadCount > 0 && (
                <span className="count-pill unread-pill">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="muted">
              Tasks assigned to you across projects and recent team activity.
            </p>
          </div>
          {unreadCount > 0 && (
            <form action={markNotificationsRead}>
              <button className="button button-secondary">Mark all read</button>
            </form>
          )}
        </div>

        {/* Quick summary stat cards */}
        <div className="inbox-stats-grid">
          <div className="inbox-stat-card">
            <span className="inbox-stat-icon">
              <CheckSquare size={20} />
            </span>
            <div>
              <div className="inbox-stat-num">{assignedTasks.length}</div>
              <div className="inbox-stat-label">Tasks Assigned to You</div>
            </div>
          </div>
          <div className="inbox-stat-card">
            <span className="inbox-stat-icon notif-icon">
              <Bell size={20} />
            </span>
            <div>
              <div className="inbox-stat-num">{unreadCount}</div>
              <div className="inbox-stat-label">Unread Notifications</div>
            </div>
          </div>
        </div>

        {/* Section 1: Tasks Assigned to You */}
        <div className="inbox-section">
          <div className="inbox-section-title">
            <h2>
              <CheckSquare size={17} style={{ color: "var(--green)" }} />
              Assigned to you <span className="count-pill">{assignedTasks.length}</span>
            </h2>
          </div>

          <div className="inbox-tasks-list">
            {assignedTasks.length > 0 ? (
              assignedTasks.map((task) => {
                const status = statusMap.get(`${task.project_id}-${task.status_id}`);
                const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
                const isOverdue =
                  task.due_date &&
                  task.due_date < today &&
                  status?.category !== "completed" &&
                  status?.category !== "cancelled";

                return (
                  <article className="inbox-task-row" key={task.id}>
                    <div className="inbox-task-main">
                      {status && (
                        <span
                          className="status-color"
                          style={{
                            backgroundColor: status.color,
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            display: "inline-block",
                            flex: "none",
                          }}
                          title={`Status: ${status.name}`}
                        />
                      )}
                      <span className="inbox-task-key">{task.generated_key}</span>
                      <Link
                        className="inbox-task-title"
                        href={`/projects/${task.project_id}/tasks/${task.id}`}
                      >
                        {task.title}
                      </Link>
                    </div>

                    <div className="inbox-task-meta">
                      {project?.name && (
                        <span className="inbox-project-pill">
                          <FolderKanban size={11} />
                          {project.name}
                        </span>
                      )}

                      <span
                        className={`inbox-priority-pill inbox-priority-${task.priority}`}
                      >
                        {task.priority}
                      </span>

                      {task.due_date && (
                        <span
                          className={`inbox-due-tag${isOverdue ? " inbox-due-overdue" : ""}`}
                          title={isOverdue ? "Task is overdue!" : `Due ${task.due_date}`}
                        >
                          <Clock size={11} />
                          {new Date(`${task.due_date}T00:00:00`).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                      )}

                      <Link
                        className="button button-secondary"
                        style={{ padding: "4px 9px", fontSize: "11px", minHeight: "28px" }}
                        href={`/projects/${task.project_id}/tasks/${task.id}`}
                      >
                        Open <ExternalLink size={11} style={{ marginLeft: "3px" }} />
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-tasks">
                <h3>No tasks assigned to you</h3>
                <p>Tasks assigned to you will show up here for quick access.</p>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Notifications and Activity */}
        <div className="inbox-section">
          <div className="inbox-section-title">
            <h2>
              <Bell size={17} style={{ color: "#b45309" }} />
              Activity &amp; Notifications <span className="count-pill">{notifications.length}</span>
            </h2>
          </div>

          <div className="inbox-list">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <article
                  className={`inbox-item${item.read_at ? " read" : " unread"}`}
                  key={item.id}
                >
                  <span className="inbox-icon">
                    <Bell size={16} />
                  </span>
                  <div className="inbox-copy">
                    <p>
                      <strong>
                        {item.actor_id
                          ? actorNames.get(item.actor_id) ?? "A teammate"
                          : "Orbitwork"}
                      </strong>{" "}
                      · {item.message}
                    </p>
                    <time>{new Date(item.created_at).toLocaleString()}</time>
                  </div>
                  {item.task_id && (
                    <Link
                      className="discussion-link"
                      href={`/projects/${item.project_id}/tasks/${item.task_id}`}
                    >
                      Open task
                    </Link>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-tasks">
                <h3>You’re all caught up</h3>
                <p>Activity and mentions will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
