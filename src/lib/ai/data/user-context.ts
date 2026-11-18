import { createClient } from "@/lib/supabase/server";

export interface UserTaskContext {
  id: string;
  projectId: string;
  projectName: string;
  key: string;
  title: string;
  priority: string;
  statusName: string;
  dueDate: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  link: string;
  assignees?: string[];
  isAssignedToCurrentUser?: boolean;
}

export interface UserAIContext {
  displayName: string;
  email: string;
  tasks: UserTaskContext[];
  allTasks?: UserTaskContext[];
  projects: Array<{ id: string; name: string }>;
  formattedPromptContext: string;
}

function getMemberAliases(name: string): string[] {
  const clean = name.trim();
  const aliases = new Set<string>();
  const lower = clean.toLowerCase();

  // Common Indian/team name nicknames and prefixes
  if (lower.includes("leelavathi") || lower.includes("leela")) {
    aliases.add("Leela");
    aliases.add("Leelavathi");
  }
  if (lower.includes("kusuma") || lower.includes("chebrolu")) {
    aliases.add("Kusuma");
    aliases.add("Chebrolu");
  }
  if (lower.includes("lavanya")) {
    aliases.add("Lavanya");
  }

  // Split words, dots, underscores, or common patterns
  const parts = clean.split(/[\s._-]+/);
  for (const part of parts) {
    if (part.length >= 3) {
      aliases.add(part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    }
  }

  return [...aliases];
}

export interface UserAIContextOptions {
  /** "personal" formats only the current user's tasks (much lower tokens for briefings). */
  scope?: "personal" | "workspace";
  /** Maximum tasks included in formattedPromptContext to keep token usage low. */
  maxTasks?: number;
  /** Whether to include the workspace member roster in formattedPromptContext. */
  includeTeam?: boolean;
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  medium: 2,
  low: 3,
};

function sortTasksForContext(tasks: UserTaskContext[]): UserTaskContext[] {
  return [...tasks].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.isDueToday !== b.isDueToday) return a.isDueToday ? -1 : 1;
    const pa = PRIORITY_RANK[a.priority.toLowerCase()] ?? 2;
    const pb = PRIORITY_RANK[b.priority.toLowerCase()] ?? 2;
    if (pa !== pb) return pa - pb;
    if (Boolean(a.isAssignedToCurrentUser) !== Boolean(b.isAssignedToCurrentUser)) {
      return a.isAssignedToCurrentUser ? -1 : 1;
    }
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}

export async function getUserLiveAIContext(
  userId: string,
  options: UserAIContextOptions = {}
): Promise<UserAIContext | null> {
  const scope = options.scope ?? "workspace";
  const maxTasks = options.maxTasks ?? (scope === "personal" ? 25 : 50);
  const includeTeam = options.includeTeam ?? scope === "workspace";
  const supabase = await createClient();

  // 1. Fetch current user identity
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName = profile?.display_name?.trim() || user?.email?.split("@")[0] || "User";
  const email = profile?.email || user?.email || "";

  // 2. Fetch all accessible projects
  const { data: accessibleProjects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(60);

  const projects = accessibleProjects ?? [];
  const projectIds = projects.map((p) => p.id);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  // 3. Fetch project statuses
  const { data: statuses } = projectIds.length
    ? await supabase
        .from("project_statuses")
        .select("id, project_id, name, category")
        .in("project_id", projectIds)
    : { data: [] };

  const statusMap = new Map((statuses ?? []).map((s) => [s.id, s]));

  // 4. Fetch all team members in workspace (profiles)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .limit(150);

  const profileMap = new Map<string, { id: string; name: string; email: string }>();
  for (const p of profiles ?? []) {
    const rawName = p.display_name?.trim() || p.email?.split("@")[0] || "Team Member";
    profileMap.set(p.id, {
      id: p.id,
      name: rawName,
      email: p.email || "",
    });
  }

  // 5. Fetch active tasks across accessible projects
  const { data: rawTasks } = projectIds.length
    ? await supabase
        .from("tasks")
        .select("id, project_id, generated_key, title, priority, status_id, due_date, primary_assignee_id, secondary_assignee_id, updated_at")
        .in("project_id", projectIds)
        .order("updated_at", { ascending: false })
        .limit(200)
    : { data: [] };

  // 6. Fetch all assignee rows for these tasks
  const taskIds = (rawTasks ?? []).map((t) => t.id);
  const { data: taskAssigneeRows } = taskIds.length
    ? await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .in("task_id", taskIds)
    : { data: [] };

  const taskAssigneesMap = new Map<string, Set<string>>();
  for (const row of taskAssigneeRows ?? []) {
    if (!taskAssigneesMap.has(row.task_id)) {
      taskAssigneesMap.set(row.task_id, new Set());
    }
    taskAssigneesMap.get(row.task_id)!.add(row.user_id);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const userTasks: UserTaskContext[] = [];
  const allTeamTasks: UserTaskContext[] = [];

  for (const t of rawTasks ?? []) {
    const statusObj = statusMap.get(t.status_id);
    const statusName = statusObj?.name || "To Do";
    const statusCategory = statusObj?.category || "active";

    // Filter out completed and cancelled tasks
    if (
      statusCategory === "completed" ||
      statusCategory === "cancelled" ||
      statusName.toLowerCase() === "done" ||
      statusName.toLowerCase() === "completed"
    ) {
      continue;
    }

    const dueDate = t.due_date ? String(t.due_date).split("T")[0] : null;
    const isDueToday = dueDate === todayStr;
    const isOverdue = Boolean(dueDate && dueDate < todayStr);
    const projectName = projectMap.get(t.project_id) || "Default Project";

    // Collect all assignees
    const assigneeIdSet = new Set<string>();
    if (t.primary_assignee_id) assigneeIdSet.add(t.primary_assignee_id);
    if (t.secondary_assignee_id) assigneeIdSet.add(t.secondary_assignee_id);
    const moreAssignees = taskAssigneesMap.get(t.id);
    if (moreAssignees) {
      for (const uid of moreAssignees) assigneeIdSet.add(uid);
    }

    const assigneeNames = [...assigneeIdSet]
      .map((uid) => profileMap.get(uid)?.name || "Unknown")
      .filter(Boolean);

    const isAssignedToCurrentUser = assigneeIdSet.has(userId);

    const taskItem: UserTaskContext = {
      id: t.id,
      projectId: t.project_id,
      projectName,
      key: t.generated_key || t.id.slice(0, 8),
      title: t.title,
      priority: t.priority || "normal",
      statusName,
      dueDate,
      isDueToday,
      isOverdue,
      link: `/projects/${t.project_id}/tasks/${t.id}`,
      assignees: assigneeNames.length ? assigneeNames : ["Unassigned"],
      isAssignedToCurrentUser,
    };

    allTeamTasks.push(taskItem);
    if (isAssignedToCurrentUser) {
      userTasks.push(taskItem);
    }
  }

  // 7. Format ultra-compact context for low token usage
  const sourceTasks = scope === "personal" ? userTasks : allTeamTasks;
  const prioritizedTasks = sortTasksForContext(sourceTasks);
  const includedTasks = prioritizedTasks.slice(0, maxTasks);
  const omittedCount = Math.max(0, prioritizedTasks.length - includedTasks.length);

  const lines: string[] = [
    `USER: ${displayName} | DATE: ${todayStr}`,
  ];

  if (includeTeam && profileMap.size > 0) {
    const memberEntries: string[] = [];
    for (const p of profileMap.values()) {
      const aliases = getMemberAliases(p.name).filter(
        (a) => a.toLowerCase() !== p.name.toLowerCase()
      );
      const tag = p.id === userId ? "(You)" : "";
      const aliasPart = aliases.length ? `[${aliases.slice(0, 3).join(",")}]` : "";
      memberEntries.push(`${p.name}${tag}${aliasPart}`);
    }
    lines.push(`TEAM: ${memberEntries.slice(0, 40).join("; ")}`);
  }

  const label = scope === "personal" ? "MY ACTIVE TASKS" : "ACTIVE TASKS";
  lines.push(`${label} (${includedTasks.length}/${prioritizedTasks.length}):`);

  if (includedTasks.length === 0) {
    lines.push("None.");
  } else {
    for (const t of includedTasks) {
      const dueTag = t.dueDate
        ? `${t.dueDate}${t.isOverdue ? " OVERDUE" : t.isDueToday ? " TODAY" : ""}`
        : "none";
      const byPart = scope === "personal" ? "" : ` | By:${t.assignees?.join(",") || "Unassigned"}`;
      lines.push(
        `- **${t.title.slice(0, 100)}** | P:${t.priority.toUpperCase()} | S:${t.statusName} | Proj:${t.projectName}${byPart} | Due:${dueTag}`
      );
    }
    if (omittedCount > 0) {
      lines.push(`(+${omittedCount} lower-priority tasks omitted)`);
    }
  }

  lines.push(
    `RULES: Match member nicknames/prefixes (e.g. Leela/Leelavathi -> leelavathiamarapinni) against TEAM. Refer to tasks ONLY by bold **Task Name** (never IDs, UUIDs, or URLs). Only cite tasks listed above; never invent tasks; if none match, state that clearly. Keep answers brief.`
  );

  return {
    displayName,
    email,
    tasks: userTasks,
    allTasks: allTeamTasks,
    projects: (projects ?? []).map((p) => ({ id: p.id, name: p.name })),
    formattedPromptContext: lines.join("\n").trim(),
  };
}
