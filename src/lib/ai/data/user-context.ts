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
}

export interface UserAIContext {
  displayName: string;
  email: string;
  tasks: UserTaskContext[];
  projects: Array<{ id: string; name: string }>;
  formattedPromptContext: string;
}

export async function getUserLiveAIContext(userId: string): Promise<UserAIContext | null> {
  const supabase = await createClient();

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";

  // 2. Fetch assigned task IDs
  const { data: assigneeRows } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", userId);

  const assignedTaskIds = [...new Set((assigneeRows ?? []).map((r) => r.task_id))];
  const orFilter = `primary_assignee_id.eq.${userId},secondary_assignee_id.eq.${userId}`;

  // 3. Fetch task details
  const [directTasksRes, tableTasksRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, project_id, generated_key, title, priority, status_id, due_date, updated_at")
      .or(orFilter)
      .limit(60),
    assignedTaskIds.length
      ? supabase
          .from("tasks")
          .select("id, project_id, generated_key, title, priority, status_id, due_date, updated_at")
          .in("id", assignedTaskIds)
          .limit(60)
      : Promise.resolve({ data: [] }),
  ]);

  const taskMap = new Map<string, any>();
  for (const t of directTasksRes.data ?? []) taskMap.set(t.id, t);
  for (const t of tableTasksRes.data ?? []) taskMap.set(t.id, t);

  const rawTasks = [...taskMap.values()];
  const projectIds = [...new Set(rawTasks.map((t) => t.project_id))];

  // 4. Fetch projects and statuses
  const [{ data: projects }, { data: statuses }] = await Promise.all([
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase.from("project_statuses").select("id, name, category").in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const statusMap = new Map((statuses ?? []).map((s) => [s.id, s]));

  const todayStr = new Date().toISOString().split("T")[0];

  const userTasks: UserTaskContext[] = [];

  for (const t of rawTasks) {
    const statusObj = statusMap.get(t.status_id);
    const statusName = statusObj?.name || "To Do";
    const statusCategory = statusObj?.category || "active";

    // Filter out completed tasks so the context focuses on active/pending work
    if (statusCategory === "done" || statusCategory === "closed" || statusName.toLowerCase() === "done" || statusName.toLowerCase() === "completed") {
      continue;
    }

    const dueDate = t.due_date ? String(t.due_date).split("T")[0] : null;
    const isDueToday = dueDate === todayStr;
    const isOverdue = Boolean(dueDate && dueDate < todayStr);
    const projectName = projectMap.get(t.project_id) || "Default Project";

    userTasks.push({
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
    });
  }

  // 5. Format into structured markdown context for the AI
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgentTasks = userTasks.filter((t) => t.priority === "urgent" || t.priority === "high");
  const dueTodayTasks = userTasks.filter((t) => t.isDueToday);
  const overdueTasks = userTasks.filter((t) => t.isOverdue);

  let formatted = `
### CURRENT USER IDENTITY
- Name: ${displayName}
- Email: ${email}
- Today's Date: ${todayFormatted}

### USER'S REAL ASSIGNED TASKS IN ORBITWORK (${userTasks.length} active tasks)
`;

  if (userTasks.length === 0) {
    formatted += `The user currently has NO active tasks assigned to them in Orbitwork.\n`;
  } else {
    for (const t of userTasks) {
      formatted += `- **[${t.key}] ${t.title}**\n`;
      formatted += `  - Project: ${t.projectName}\n`;
      formatted += `  - Priority: ${t.priority.toUpperCase()}\n`;
      formatted += `  - Status: ${t.statusName}\n`;
      formatted += `  - Due Date: ${t.dueDate || "No deadline set"}${t.isOverdue ? " (⚠️ OVERDUE)" : t.isDueToday ? " (⚠️ DUE TODAY)" : ""}\n`;
      formatted += `  - Link: ${t.link}\n`;
    }
  }

  formatted += `
### CRITICAL INSTRUCTIONS REGARDING USER DATA:
1. ONLY refer to the real tasks listed above. NEVER invent, imagine, or hallucinate fake tasks (e.g. "Review Q3 Marketing Budget").
2. If the user asks for urgent tasks, list tasks marked priority URGENT or HIGH from the list above. If there are none, explicitly state: "You currently have no tasks marked urgent or high priority in Orbitwork."
3. Always include the markdown link format: [Task Title](Link) so the user can click directly into their task.
4. If the user asks about due dates or overdue tasks, reference the exact Due Date and overdue flags above.
`;

  return {
    displayName,
    email,
    tasks: userTasks,
    projects: (projects ?? []).map((p) => ({ id: p.id, name: p.name })),
    formattedPromptContext: formatted.trim(),
  };
}
