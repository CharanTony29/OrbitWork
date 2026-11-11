import Link from "next/link";
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  FolderKanban,
  PlayCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMinutes } from "@/lib/work";
import FavoritesCardClient, {
  FavoriteRecord,
  QuickPinCandidate,
} from "./FavoritesCardClient";
import AssignedTasksCardClient, {
  DashboardAssignedTaskItem,
} from "./AssignedTasksCardClient";

function isStatusInProgress(cat?: string, name?: string) {
  const nameLower = (name ?? "").toLowerCase();
  return (
    cat === "active" ||
    nameLower.includes("progress") ||
    nameLower.includes("review") ||
    nameLower.includes("working")
  );
}

type ProjectSummary = {
  id: string;
  name: string;
  status?: string | null;
};

export default async function UserDashboardSection({
  userId,
  projects,
}: {
  userId: string;
  projects: ProjectSummary[];
}) {
  const supabase = await createClient();

  const [
    { data: directAssigneeRows },
    { data: timeEntryRows },
    favoritesResult,
  ] = await Promise.all([
    supabase.from("task_assignees").select("task_id").eq("user_id", userId),
    supabase
      .from("time_entries")
      .select("duration_minutes, billable")
      .eq("user_id", userId)
      .eq("billable", true)
      .not("duration_minutes", "is", null),
    supabase
      .from("user_favorites")
      .select("id, entity_type, entity_id, project_id, title, subtitle")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const tableAvailable = !favoritesResult.error;
  const favorites: FavoriteRecord[] = (favoritesResult.data ?? []).map((f) => ({
    id: f.id,
    entity_type: f.entity_type as FavoriteRecord["entity_type"],
    entity_id: f.entity_id,
    project_id: f.project_id,
    title: f.title,
    subtitle: f.subtitle ?? "",
  }));

  const favoritedSet = new Set(
    favorites.map((f) => `${f.entity_type}:${f.entity_id}`)
  );

  // Build deduplicated list of tasks assigned to current user
  const joinedTaskIds = [...new Set((directAssigneeRows ?? []).map((r) => r.task_id))];
  const orFilter = `primary_assignee_id.eq.${userId},secondary_assignee_id.eq.${userId}`;

  const [directTasksRes, tableTasksRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, project_id, generated_key, title, priority, status_id, due_date, updated_at")
      .or(orFilter),
    joinedTaskIds.length
      ? supabase
          .from("tasks")
          .select("id, project_id, generated_key, title, priority, status_id, due_date, updated_at")
          .in("id", joinedTaskIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            project_id: string;
            generated_key: string;
            title: string;
            priority: string;
            status_id: string;
            due_date: string | null;
            updated_at: string;
          }>,
        }),
  ]);

  const taskById = new Map<
    string,
    {
      id: string;
      project_id: string;
      generated_key: string;
      title: string;
      priority: string;
      status_id: string;
      due_date: string | null;
      updated_at: string;
    }
  >();

  for (const t of directTasksRes.data ?? []) taskById.set(t.id, t);
  for (const t of tableTasksRes.data ?? []) taskById.set(t.id, t);

  const myTasks = [...taskById.values()];
  const myTaskProjectIds = [...new Set(myTasks.map((t) => t.project_id))];
  const allAccessibleProjectIds = [
    ...new Set([...projects.map((p) => p.id), ...myTaskProjectIds]),
  ];

  const [{ data: statuses }, { data: docs }] = await Promise.all([
    myTaskProjectIds.length
      ? supabase
          .from("project_statuses")
          .select("id, project_id, name, color, category")
          .in("project_id", myTaskProjectIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            project_id: string;
            name: string;
            color: string;
            category: string;
          }>,
        }),
    allAccessibleProjectIds.length
      ? supabase
          .from("project_documents")
          .select("id, project_id, title, updated_at")
          .in("project_id", allAccessibleProjectIds)
          .order("updated_at", { ascending: false })
          .limit(30)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            project_id: string;
            title: string;
            updated_at: string;
          }>,
        }),
  ]);

  const statusMap = new Map((statuses ?? []).map((s) => [s.id, s]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  let urgentCount = 0;
  let newCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;

  for (const t of myTasks) {
    const st = statusMap.get(t.status_id);
    const cat = st?.category;

    const isClosed = cat === "completed" || cat === "cancelled";
    if (isClosed) {
      completedCount++;
    } else if (isStatusInProgress(cat, st?.name)) {
      inProgressCount++;
    } else {
      newCount++;
    }

    if (t.priority === "urgent" && !isClosed) {
      urgentCount++;
    }
  }

  const totalBillableMinutes = (timeEntryRows ?? []).reduce(
    (sum, entry) => sum + (entry.duration_minutes ?? 0),
    0
  );
  const billedHoursDecimal = (totalBillableMinutes / 60).toFixed(1);

  const priorityRank: Record<string, number> = {
    urgent: 1,
    high: 2,
    normal: 3,
    low: 4,
  };

  const openAssignedTasks = myTasks
    .filter((t) => {
      const cat = statusMap.get(t.status_id)?.category;
      return cat !== "completed" && cat !== "cancelled";
    })
    .sort((a, b) => {
      const pDiff = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      if (pDiff !== 0) return pDiff;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return b.updated_at.localeCompare(a.updated_at);
    })
    .slice(0, 24);

  const assignedTaskItems: DashboardAssignedTaskItem[] = openAssignedTasks.map((task) => {
    const st = statusMap.get(task.status_id);
    const proj = projectMap.get(task.project_id);
    const inProgress = isStatusInProgress(st?.category, st?.name);
    return {
      id: task.id,
      projectId: task.project_id,
      projectName: proj?.name ?? "Project",
      title: task.title,
      priority: task.priority,
      statusName: st?.name ?? null,
      statusColor: st?.color ?? null,
      statusCategory: st?.category ?? null,
      dueDate: task.due_date,
      isUrgent: task.priority === "urgent",
      isInProgress: inProgress,
      isNew: !inProgress,
      isFavorited: favoritedSet.has(`task:${task.id}`),
    };
  });

  const activeProjectsCount = projects.filter(
    (p) => !p.status || p.status === "active"
  ).length;

  const candidates: QuickPinCandidate[] = [
    ...(docs ?? [])
      .filter((d) => {
        const lower = d.title.toLowerCase();
        return !lower.endsWith(".whiteboard") && !lower.endsWith(".flowchart");
      })
      .map((d) => ({
        entity_type: "document" as const,
        entity_id: d.id,
        project_id: d.project_id,
        title: d.title,
        subtitle: projectMap.get(d.project_id)?.name ?? "Project doc",
      })),
    ...projects.slice(0, 20).map((p) => ({
      entity_type: "project" as const,
      entity_id: p.id,
      project_id: p.id,
      title: p.name,
      subtitle: "Project",
    })),
    ...myTasks.slice(0, 20).map((t) => ({
      entity_type: "task" as const,
      entity_id: t.id,
      project_id: t.project_id,
      title: t.title,
      subtitle: projectMap.get(t.project_id)?.name ?? "Task",
    })),
  ];

  return (
    <section className="user-dashboard-wrap" aria-label="My personal dashboard">
      <div className="user-kpi-grid">
        <article className="user-kpi-card">
          <div className="user-kpi-icon is-green">
            <FolderKanban size={18} />
          </div>
          <div>
            <span className="user-kpi-label">My Projects</span>
            <strong className="user-kpi-value">{allAccessibleProjectIds.length}</strong>
            <small className="user-kpi-sub">{activeProjectsCount} active projects</small>
          </div>
        </article>

        <Link href="/inbox" className="user-kpi-card is-link">
          <div className="user-kpi-icon is-blue">
            <CheckSquare size={18} />
          </div>
          <div>
            <span className="user-kpi-label">Tasks Assigned to Me</span>
            <strong className="user-kpi-value">{myTasks.length}</strong>
            <small className="user-kpi-sub">
              {myTasks.length - completedCount} open · {completedCount} done
            </small>
          </div>
        </Link>

        <article className="user-kpi-card">
          <div className="user-kpi-icon is-red">
            <AlertTriangle size={18} />
          </div>
          <div>
            <span className="user-kpi-label">Urgent Tasks</span>
            <strong className="user-kpi-value">{urgentCount}</strong>
            <small className="user-kpi-sub">Needs immediate attention</small>
          </div>
        </article>

        <article className="user-kpi-card">
          <div className="user-kpi-icon is-amber">
            <PlayCircle size={18} />
          </div>
          <div>
            <span className="user-kpi-label">New &amp; In Progress</span>
            <strong className="user-kpi-value">{newCount + inProgressCount}</strong>
            <small className="user-kpi-sub">
              {newCount} New · {inProgressCount} In Progress
            </small>
          </div>
        </article>

        <article className="user-kpi-card">
          <div className="user-kpi-icon is-purple">
            <Clock size={18} />
          </div>
          <div>
            <span className="user-kpi-label">Hours I Billed</span>
            <strong className="user-kpi-value">{billedHoursDecimal}h</strong>
            <small className="user-kpi-sub">{formatMinutes(totalBillableMinutes)} billable</small>
          </div>
        </article>
      </div>

      <div className="user-dash-split">
        <AssignedTasksCardClient
          tasks={assignedTaskItems}
          tableAvailable={tableAvailable}
        />

        <FavoritesCardClient
          initialFavorites={favorites}
          candidates={candidates}
          tableAvailable={tableAvailable}
        />
      </div>
    </section>
  );
}
