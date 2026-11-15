// src/lib/brain/context-builder.ts
// Secure Project Data Context Assembler for Orbitwork Project Brain

import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";
import type {
  AnalyticsContext,
  ProjectDecision,
  RawActivityEvent,
  RawDependencyItem,
  RawDocumentItem,
  RawGoalItem,
  RawProfileItem,
  RawStatusItem,
  RawTaskItem,
} from "./types.ts";

export interface FullProjectBrainData {
  context: AnalyticsContext;
  decisions: ProjectDecision[];
  formattedLLMContext: string;
  hasAccess: boolean;
  canEdit: boolean;
  projectExists: boolean;
}

export async function buildProjectBrainContext(
  projectId: string,
  userId: string
): Promise<FullProjectBrainData | null> {
  const supabase = await createClient();

  // 1. Permission check
  const { data: canAccess } = await supabase.rpc("can_access_project", {
    target_project: projectId,
  });

  if (!canAccess) {
    return {
      context: null as unknown as AnalyticsContext,
      decisions: [],
      formattedLLMContext: "",
      hasAccess: false,
      canEdit: false,
      projectExists: false,
    };
  }

  const { data: canEditData } = await supabase.rpc("can_edit_project_tasks", {
    target_project: projectId,
  });
  const canEdit = Boolean(canEditData);

  // 2. Load Project details
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, status, priority, due_date, created_at, workspace_id, workspaces(name, organization_id)")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return null;
  }

  // 3. Load all core relational entities in parallel
  const [
    tasksResult,
    statusesResult,
    depsResult,
    goalsResult,
    docsResult,
    activityResult,
    checklistsResult,
    decisionsResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, project_id, generated_key, title, description, priority, status_id, start_date, due_date, estimate_minutes, progress, parent_task_id, created_at, created_by, primary_assignee_id, secondary_assignee_id, task_type")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("project_statuses")
      .select("id, name, color, category, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    supabase
      .from("task_dependencies")
      .select("project_id, task_id, linked_task_id, relation, created_at")
      .eq("project_id", projectId),
    supabase
      .from("project_goals")
      .select("id, project_id, title, description, target_date, progress, status, milestones")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_documents")
      .select("id, project_id, title, body_markdown, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("project_activity_events")
      .select("id, project_id, task_id, actor_id, event_type, details, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("task_checklists")
      .select("id, task_id, title")
      .eq("project_id", projectId),
    // Query project_decisions safely
    (async () => {
      try {
        return await supabase
          .from("project_decisions")
          .select("*")
          .eq("project_id", projectId)
          .order("decision_date", { ascending: false });
      } catch (err: unknown) {
        console.warn("[Project Brain] project_decisions table query exception:", err);
        return { data: null, error: err };
      }
    })(),
  ]);

  const rawTasks: RawTaskItem[] = ((tasksResult.data || []) as Array<Record<string, unknown>>).map((t) => ({
    id: String(t.id),
    project_id: String(t.project_id),
    generated_key: t.generated_key ? String(t.generated_key) : null,
    title: String(t.title),
    description: t.description ? String(t.description) : null,
    priority: String(t.priority || "normal"),
    status_id: String(t.status_id),
    start_date: t.start_date ? String(t.start_date) : null,
    due_date: t.due_date ? String(t.due_date) : null,
    estimate_minutes: typeof t.estimate_minutes === "number" ? t.estimate_minutes : null,
    progress: typeof t.progress === "number" ? t.progress : 0,
    parent_task_id: t.parent_task_id ? String(t.parent_task_id) : null,
    created_at: String(t.created_at || new Date().toISOString()),
    created_by: String(t.created_by || ""),
    primary_assignee_id: t.primary_assignee_id ? String(t.primary_assignee_id) : null,
    secondary_assignee_id: t.secondary_assignee_id ? String(t.secondary_assignee_id) : null,
    task_type: t.task_type ? String(t.task_type) : null,
  }));
  const rawStatuses: RawStatusItem[] = ((statusesResult.data || []) as RawStatusItem[]);
  const rawDeps: RawDependencyItem[] = ((depsResult.data || []) as RawDependencyItem[]);
  const rawGoals: RawGoalItem[] = ((goalsResult.data || []) as Array<Record<string, unknown>>).map((g) => ({
    id: String(g.id),
    project_id: String(g.project_id),
    title: String(g.title),
    description: String(g.description || ""),
    target_date: g.target_date ? String(g.target_date) : null,
    progress: typeof g.progress === "number" ? g.progress : 0,
    status: (g.status as "in_progress" | "completed") || "in_progress",
    milestones: Array.isArray(g.milestones) ? g.milestones : [],
  }));
  const rawDocs: RawDocumentItem[] = ((docsResult.data || []) as Array<Record<string, unknown>>).map((d) => ({
    id: String(d.id),
    project_id: String(d.project_id),
    title: String(d.title),
    body_markdown: typeof d.body_markdown === "string" ? d.body_markdown.slice(0, 1000) : "",
    updated_at: String(d.updated_at || new Date().toISOString()),
  }));
  const rawActivity: RawActivityEvent[] = ((activityResult.data || []) as Array<Record<string, unknown>>).map((a) => ({
    id: (a.id as string | number) || 0,
    project_id: String(a.project_id),
    task_id: a.task_id ? String(a.task_id) : null,
    actor_id: a.actor_id ? String(a.actor_id) : null,
    event_type: String(a.event_type || ""),
    details: (a.details as Record<string, unknown>) || {},
    created_at: String(a.created_at || new Date().toISOString()),
  }));
  const rawChecklists: Array<{ id: string; task_id: string; title: string }> =
    ((checklistsResult.data || []) as Array<{ id: string; task_id: string; title: string }>);

  // 4. Fetch checklist items and task assignees
  const taskIds = rawTasks.map((t) => t.id);
  const checklistIds = rawChecklists.map((c) => c.id);

  const [assigneesResult, checklistItemsResult] = await Promise.all([
    taskIds.length
      ? supabase.from("task_assignees").select("task_id, user_id").in("task_id", taskIds)
      : { data: [] },
    checklistIds.length
      ? supabase.from("checklist_items").select("id, checklist_id, is_complete").in("checklist_id", checklistIds)
      : { data: [] },
  ]);

  const taskAssignees = assigneesResult.data || [];
  const checklistItems = checklistItemsResult.data || [];

  // 5. Collect all user IDs involved
  const userIds = new Set<string>();
  if (userId) userIds.add(userId);
  for (const t of rawTasks) {
    if (t.created_by) userIds.add(t.created_by);
    if (t.primary_assignee_id) userIds.add(t.primary_assignee_id);
    if (t.secondary_assignee_id) userIds.add(t.secondary_assignee_id);
  }
  for (const a of taskAssignees) userIds.add(a.user_id);
  for (const act of rawActivity) {
    if (act.actor_id) userIds.add(act.actor_id);
  }

  // 6. Fetch profiles for all involved users
  const { data: rawProfiles } = userIds.size
    ? await supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", [...userIds])
    : { data: [] };

  const profiles: RawProfileItem[] = rawProfiles || [];
  const profileMap = new Map(
    profiles.map((p) => [
      p.id,
      p.display_name?.trim() || p.email?.split("@")[0] || "Team Member",
    ])
  );

  // 7. Parse decisions safely
  const decisions: ProjectDecision[] = [];
  if (decisionsResult && !decisionsResult.error && Array.isArray(decisionsResult.data)) {
    for (const d of decisionsResult.data) {
      decisions.push({
        id: d.id,
        projectId: d.project_id,
        title: d.title,
        decisionDate: d.decision_date,
        reason: d.reason || "",
        impact: d.impact || "",
        status: d.status || "accepted",
        relatedTasks: Array.isArray(d.related_tasks) ? d.related_tasks : [],
        relatedDocuments: Array.isArray(d.related_documents) ? d.related_documents : [],
        tags: Array.isArray(d.tags) ? d.tags : [],
        decidedByName: (d.decided_by && profileMap.get(d.decided_by)) || "Team Lead",
        decidedBy: d.decided_by,
        createdAt: d.created_at,
      });
    }
  }

  const context: AnalyticsContext = {
    projectId: project.id,
    projectName: project.name,
    projectDueDate: project.due_date,
    tasks: rawTasks,
    statuses: rawStatuses,
    dependencies: rawDeps,
    goals: rawGoals,
    documents: rawDocs,
    activity: rawActivity,
    profiles,
    taskAssignees,
    checklists: rawChecklists,
    checklistItems,
    currentUserId: userId,
  };

  // 8. Format structured LLM prompt context
  const statusNameMap = new Map(rawStatuses.map((s) => [s.id, s.name]));
  const todayStr = new Date().toISOString().split("T")[0];

  let prompt = `
### PROJECT IDENTITY
- Project ID: ${project.id}
- Project Name: "${project.name}"
- Status: ${project.status}
- Priority: ${project.priority}
- Due Date: ${project.due_date ? String(project.due_date).split("T")[0] : "Not set"}
- Created At: ${project.created_at?.split("T")[0] || "N/A"}
- Description: ${project.description || "No description provided."}

### TEAM MEMBERS (${profiles.length} members)
`;

  for (const p of profiles) {
    const isCurrent = p.id === userId;
    prompt += `- ${p.display_name?.trim() || p.email} (${p.email || "No email"})${isCurrent ? " [CURRENT USER]" : ""}\n`;
  }

  prompt += `
### TASKS IN PROJECT (${rawTasks.length} tasks)
`;

  if (rawTasks.length === 0) {
    prompt += `No tasks created in this project yet.\n`;
  } else {
    for (const t of rawTasks) {
      const sName = statusNameMap.get(t.status_id) || "To Do";
      const dStr = t.due_date ? String(t.due_date).split("T")[0] : null;
      const isOverdue = Boolean(dStr && dStr < todayStr);

      const assignees: string[] = [];
      if (t.primary_assignee_id && profileMap.has(t.primary_assignee_id)) {
        assignees.push(profileMap.get(t.primary_assignee_id)!);
      }
      if (t.secondary_assignee_id && profileMap.has(t.secondary_assignee_id)) {
        assignees.push(profileMap.get(t.secondary_assignee_id)!);
      }

      prompt += `- Task: **${t.title}** (Key: ${t.generated_key || "N/A"})
  - Status: ${sName} | Priority: ${t.priority.toUpperCase()}
  - Due Date: ${dStr || "None"}${isOverdue ? " [⚠️ OVERDUE]" : ""}
  - Assignees: ${assignees.length ? assignees.join(", ") : "Unassigned"}
  - Progress: ${t.progress || 0}% | Estimate: ${t.estimate_minutes ? `${t.estimate_minutes}m` : "None"}
`;
    }
  }

  prompt += `
### DEPENDENCIES (${rawDeps.length} link rules)
`;
  const taskTitleMap = new Map(rawTasks.map((t) => [t.id, t.title]));
  if (rawDeps.length === 0) {
    prompt += `No task dependencies configured.\n`;
  } else {
    for (const d of rawDeps) {
      const t1 = taskTitleMap.get(d.task_id) || d.task_id;
      const t2 = taskTitleMap.get(d.linked_task_id) || d.linked_task_id;
      prompt += `- "${t1}" ${d.relation.toUpperCase()} "${t2}"\n`;
    }
  }

  prompt += `
### GOALS & MILESTONES (${rawGoals.length} goals)
`;
  if (rawGoals.length === 0) {
    prompt += `No high-level goals defined.\n`;
  } else {
    for (const g of rawGoals) {
      prompt += `- Goal: "${g.title}" (Progress: ${g.progress}%, Status: ${g.status})\n`;
      for (const m of g.milestones || []) {
        prompt += `  * Milestone: "${m.title}" | Due: ${m.dueDate || "N/A"} | Completed: ${m.completed ? "Yes" : "No"}\n`;
      }
    }
  }

  prompt += `
### RECORDED DECISIONS (${decisions.length} decisions)
`;
  if (decisions.length === 0) {
    prompt += `No architectural or product decisions recorded yet.\n`;
  } else {
    for (const dec of decisions) {
      prompt += `- Decision: "${dec.title}" (${dec.decisionDate})
  - Reason: ${dec.reason}
  - Impact: ${dec.impact}
  - Status: ${dec.status.toUpperCase()} (Decided by: ${dec.decidedByName})
`;
    }
  }

  prompt += `
### RECENT PROJECT EVENTS (Last ${Math.min(rawActivity.length, 15)} events)
`;
  for (const act of rawActivity.slice(0, 15)) {
    const actor = act.actor_id ? profileMap.get(act.actor_id) || "Teammate" : "System";
    prompt += `- [${act.created_at?.split("T")[0] || "Recent"}] ${act.event_type.replace(/_/g, " ")} by ${actor}\n`;
  }

  return {
    context,
    decisions,
    formattedLLMContext: prompt.trim(),
    hasAccess: true,
    canEdit,
    projectExists: true,
  };
}
