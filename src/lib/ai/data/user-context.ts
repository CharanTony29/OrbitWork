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

export async function getUserLiveAIContext(userId: string): Promise<UserAIContext | null> {
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

  // 7. Format structured context for the AI prompt
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let formatted = `
### CURRENT USER IDENTITY
- Name: ${displayName} (Current User / You)
- Email: ${email}
- Today's Date: ${todayFormatted}

### RECOGNIZED WORKSPACE TEAM MEMBERS:
`;

  for (const p of profileMap.values()) {
    const isMe = p.id === userId;
    const aliases = getMemberAliases(p.name);
    const aliasStr = aliases.length ? ` (Recognized aliases/short names: ${aliases.join(", ")})` : "";
    formatted += `- **${p.name}**${isMe ? " (Current User / You)" : ""}${aliasStr} (Email: ${p.email || "N/A"})\n`;
  }

  formatted += `
### ALL LIVE ACTIVE TASKS ACROSS ACCESSIBLE PROJECTS (${allTeamTasks.length} active tasks)
`;

  if (allTeamTasks.length === 0) {
    formatted += `There are currently no active tasks in the workspace projects.\n`;
  } else {
    for (const t of allTeamTasks) {
      formatted += `- Task Name: **${t.title}**\n`;
      formatted += `  - Assigned To: ${t.assignees?.join(", ") || "Unassigned"}\n`;
      formatted += `  - Priority: ${t.priority.toUpperCase()}\n`;
      formatted += `  - Status: ${t.statusName}\n`;
      formatted += `  - Project: ${t.projectName}\n`;
      formatted += `  - Due Date: ${t.dueDate || "No deadline set"}${t.isOverdue ? " (⚠️ OVERDUE)" : t.isDueToday ? " (⚠️ DUE TODAY)" : ""}\n`;
    }
  }

  formatted += `
### MANDATORY INSTRUCTIONS FOR RECOGNIZING MEMBERS & FORMATTING RESPONSES:
1. TEAM MEMBER RECOGNITION (E.G. LEELA, LEELAVATHI, LAVANYA, TONY, CHARAN, ETC.):
   - When the user asks about ANY team member (e.g. "leela", "Leela", "leelavathi", "leelavathiamarapinni", "Lavanya", "Tony", "Kusuma"), match their name fuzzily, by prefix, nickname, or substring against the "RECOGNIZED WORKSPACE TEAM MEMBERS" list above.
   - Specifically: **"Leela"**, **"leela"**, **"Leelavathi"**, and **"leelavathi"** ALL refer directly to **leelavathiamarapinni**!
   - Look through the tasks above and list all tasks where "Assigned To" matches that person.
   - If the user asks about "my tasks" or "tasks for me", look for tasks assigned to "${displayName}".

2. TASK NAME FORMATTING ONLY (STRICT USER MANDATE):
   - NEVER output task IDs, UUIDs, or raw task link URLs (e.g., NEVER output "/projects/.../tasks/..." or "TASK-xxxx" or "[task-uuid]").
   - Mention ONLY the clean Task Name in bold (e.g., "**Prepare the mobile application for release**").
   - List tasks using clean markdown bullets with their Task Name, Priority, Status, and Project. For example:
     * **Prepare the mobile application for release** — Priority: High, Status: New (Project: TEST)
     * **Create an employee onboarding process** — Priority: High, Status: New (Project: TEST)

3. ZERO HALLUCINATION GUARANTEE:
   - ONLY mention real tasks listed in the real live data above. Never invent fake or generic tasks.
   - If a person has no tasks matching a filter (e.g. no urgent tasks), explicitly state: "[Person Name] has no urgent tasks right now in Orbitwork."
`;

  return {
    displayName,
    email,
    tasks: userTasks,
    allTasks: allTeamTasks,
    projects: (projects ?? []).map((p) => ({ id: p.id, name: p.name })),
    formattedPromptContext: formatted.trim(),
  };
}
