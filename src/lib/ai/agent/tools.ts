import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AgentToolsContext {
  supabase: SupabaseClient;
  projectId: string;
  userId: string;
  targetTaskId?: string;
  agentName?: string;
}

export function createAutonomousAgentTools(context: AgentToolsContext) {
  const { supabase, projectId, userId, targetTaskId } = context;
  const actionLog: string[] = [];

  const tools = {
    /**
     * Inspect complete details of a task (dates, estimates, assignees, status, description, parent task)
     */
    get_task_details: tool({
      description:
        "Get detailed information about a task or subtask, including title, description, start_date, due_date, estimate_minutes, priority, status, assignees, and parent task info.",
      inputSchema: z.object({
        taskId: z
          .string()
          .optional()
          .describe("The task ID to inspect. If omitted, defaults to the target task currently being processed."),
      }),
      execute: async ({ taskId }: { taskId?: string }) => {
        const id = taskId || targetTaskId;
        if (!id) return { error: "No task ID specified and no default task in context." };

        const { data: task, error } = await supabase
          .from("tasks")
          .select(
            "id, project_id, title, description, start_date, due_date, estimate_minutes, priority, status_id, progress, tags, primary_assignee_id, parent_task_id, generated_key"
          )
          .eq("id", id)
          .eq("project_id", projectId)
          .single();

        if (error || !task) {
          return { error: `Task not found: ${error?.message || "Invalid task ID"}` };
        }

        // Fetch status name
        let statusName = "Unknown";
        if (task.status_id) {
          const { data: status } = await supabase
            .from("project_statuses")
            .select("name, category")
            .eq("id", task.status_id)
            .single();
          if (status) statusName = status.name;
        }

        // Fetch primary assignee name
        let assigneeName: string | null = null;
        if (task.primary_assignee_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", task.primary_assignee_id)
            .single();
          if (profile) assigneeName = profile.full_name || profile.email;
        }

        // Fetch parent task details if this is a subtask
        let parentTask: Record<string, unknown> | null = null;
        if (task.parent_task_id) {
          const { data: parent } = await supabase
            .from("tasks")
            .select("id, title, start_date, due_date, estimate_minutes, priority")
            .eq("id", task.parent_task_id)
            .single();
          if (parent) parentTask = parent;
        }

        return {
          id: task.id,
          key: task.generated_key,
          title: task.title,
          description: task.description,
          startDate: task.start_date,
          dueDate: task.due_date,
          estimateMinutes: task.estimate_minutes,
          priority: task.priority,
          progress: task.progress,
          statusId: task.status_id,
          statusName,
          primaryAssigneeId: task.primary_assignee_id,
          primaryAssigneeName: assigneeName,
          isSubtask: Boolean(task.parent_task_id),
          parentTaskId: task.parent_task_id,
          parentTask,
          tags: task.tags,
        };
      },
    }),

    /**
     * Inspect all existing subtasks under a parent task
     */
    get_subtasks: tool({
      description:
        "Fetch all existing subtasks under a parent task with their IDs, titles, estimates, start dates, due dates, priorities, and assignees.",
      inputSchema: z.object({
        parentTaskId: z
          .string()
          .optional()
          .describe("The parent task ID whose subtasks to fetch. If omitted, defaults to the current target task."),
      }),
      execute: async ({ parentTaskId }: { parentTaskId?: string }) => {
        const id = parentTaskId || targetTaskId;
        if (!id) return { error: "No parent task ID specified." };

        const { data: subtasks, error } = await supabase
          .from("tasks")
          .select("id, title, description, start_date, due_date, estimate_minutes, priority, status_id, primary_assignee_id, created_at")
          .eq("parent_task_id", id)
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });

        if (error) {
          return { error: `Failed to fetch subtasks: ${error.message}` };
        }

        // Map assignees and statuses
        const mapped = await Promise.all(
          (subtasks || []).map(async (st) => {
            let assigneeName: string | null = null;
            if (st.primary_assignee_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, email")
                .eq("id", st.primary_assignee_id)
                .single();
              if (profile) assigneeName = profile.full_name || profile.email;
            }
            return {
              id: st.id,
              title: st.title,
              description: st.description,
              startDate: st.start_date,
              dueDate: st.due_date,
              estimateMinutes: st.estimate_minutes,
              priority: st.priority,
              statusId: st.status_id,
              primaryAssigneeId: st.primary_assignee_id,
              primaryAssigneeName: assigneeName,
            };
          })
        );

        return {
          parentTaskId: id,
          count: mapped.length,
          subtasks: mapped,
        };
      },
    }),

    /**
     * Inspect checklists and checklist items for a task
     */
    get_task_checklists: tool({
      description: "Get all checklists and their items for a task, including item completion status.",
      inputSchema: z.object({
        taskId: z
          .string()
          .optional()
          .describe("Task ID to inspect (defaults to current task if omitted)."),
      }),
      execute: async ({ taskId }: { taskId?: string }) => {
        const id = taskId || targetTaskId;
        if (!id) return { error: "No task ID specified." };

        const { data: checklists } = await supabase
          .from("task_checklists")
          .select("id, title, position")
          .eq("task_id", id)
          .eq("project_id", projectId)
          .order("position", { ascending: true });

        const { data: items } = await supabase
          .from("checklist_items")
          .select("id, checklist_id, title, is_complete, position")
          .eq("task_id", id)
          .eq("project_id", projectId)
          .order("position", { ascending: true });

        const grouped = (checklists || []).map((cl) => ({
          id: cl.id,
          title: cl.title,
          items: (items || [])
            .filter((it) => it.checklist_id === cl.id)
            .map((it) => ({
              id: it.id,
              title: it.title,
              isComplete: it.is_complete,
            })),
        }));

        return { taskId: id, checklists: grouped };
      },
    }),

    /**
     * Inspect task dependencies (blocking / blocked by / related)
     */
    get_task_dependencies: tool({
      description: "Get tasks that block, are blocked by, or are related to a given task.",
      inputSchema: z.object({
        taskId: z
          .string()
          .optional()
          .describe("Task ID to check dependencies for (defaults to current task if omitted)."),
      }),
      execute: async ({ taskId }: { taskId?: string }) => {
        const id = taskId || targetTaskId;
        if (!id) return { error: "No task ID specified." };

        const { data: deps } = await supabase
          .from("task_dependencies")
          .select("task_id, linked_task_id, relation")
          .eq("project_id", projectId)
          .or(`task_id.eq.${id},linked_task_id.eq.${id}`);

        return { taskId: id, dependencies: deps || [] };
      },
    }),

    /**
     * Inspect project structure, available workflow statuses, and team members
     */
    get_project_context: tool({
      description:
        "Fetch high-level project metadata, available workflow statuses (with IDs and categories), and project team members (with IDs, names, and emails).",
      inputSchema: z.object({
        includeMembers: z
          .boolean()
          .optional()
          .describe("Whether to fetch project team members (defaults to true)."),
      }),
      execute: async () => {
        const { data: project } = await supabase
          .from("projects")
          .select("id, name, description, status, priority, start_date, due_date")
          .eq("id", projectId)
          .single();

        const { data: statuses } = await supabase
          .from("project_statuses")
          .select("id, name, category, color, position, is_default")
          .eq("project_id", projectId)
          .order("position", { ascending: true });

        const { data: members } = await supabase
          .from("project_members")
          .select("user_id, role")
          .eq("project_id", projectId);

        const memberProfiles = await Promise.all(
          (members || []).map(async (m) => {
            const { data: prof } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .eq("id", m.user_id)
              .single();
            return {
              userId: m.user_id,
              role: m.role,
              fullName: prof?.full_name || "Unknown",
              email: prof?.email || "",
            };
          })
        );

        return {
          project,
          statuses: statuses || [],
          members: memberProfiles,
        };
      },
    }),

    /**
     * Search tasks in the project by keyword, status, priority, or assignee
     */
    search_project_tasks: tool({
      description: "Search and filter tasks in the current project by title keyword, status, priority, or assignee.",
      inputSchema: z.object({
        query: z.string().optional().describe("Search keyword to match in title or description"),
        statusId: z.string().optional().describe("Filter by status ID"),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Filter by priority"),
        assigneeId: z.string().optional().describe("Filter by primary assignee user ID"),
        onlyRootTasks: z.boolean().optional().describe("If true, return only root tasks (excluding subtasks)"),
      }),
      execute: async (args: {
        query?: string;
        statusId?: string;
        priority?: "low" | "normal" | "high" | "urgent";
        assigneeId?: string;
        onlyRootTasks?: boolean;
      }) => {
        let q = supabase
          .from("tasks")
          .select("id, title, start_date, due_date, estimate_minutes, priority, status_id, parent_task_id, primary_assignee_id")
          .eq("project_id", projectId);

        if (args.query && args.query.trim()) {
          q = q.ilike("title", `%${args.query.trim()}%`);
        }
        if (args.statusId) {
          q = q.eq("status_id", args.statusId);
        }
        if (args.priority) {
          q = q.eq("priority", args.priority);
        }
        if (args.assigneeId) {
          q = q.eq("primary_assignee_id", args.assigneeId);
        }
        if (args.onlyRootTasks) {
          q = q.is("parent_task_id", null);
        }

        const { data: tasks, error } = await q.limit(25);
        if (error) return { error: error.message };

        return { count: tasks?.length || 0, tasks: tasks || [] };
      },
    }),

    /**
     * Update task or subtask dates, estimates, priority, title, description, status, or assignee
     */
    update_task: tool({
      description:
        "Update fields of a task or subtask. Use this to set or reschedule start_date (YYYY-MM-DD), due_date (YYYY-MM-DD), estimateMinutes, priority, status, or assignee.",
      inputSchema: z.object({
        taskId: z.string().optional().describe("The ID of the task or subtask to update. Defaults to target task if omitted."),
        startDate: z.string().optional().describe("Start date in YYYY-MM-DD format (e.g. 2026-11-17)"),
        dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format (e.g. 2026-11-20)"),
        start_date: z.string().optional().describe("Alternative start date in YYYY-MM-DD format"),
        due_date: z.string().optional().describe("Alternative due date in YYYY-MM-DD format"),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Priority level"),
        estimateMinutes: z.number().optional().describe("Estimate duration in minutes"),
        estimate_minutes: z.number().optional().describe("Alternative estimate duration in minutes"),
        estimate: z.number().optional().describe("Alternative estimate duration in minutes"),
        title: z.string().optional().describe("New title for the task"),
        description: z.string().optional().describe("New description for the task"),
        statusId: z.string().optional().describe("Workflow status ID to set"),
        assigneeId: z.string().optional().describe("User ID of the member to assign as primary assignee"),
      }),
      execute: async (args: {
        taskId?: string;
        startDate?: string;
        dueDate?: string;
        start_date?: string;
        due_date?: string;
        priority?: "low" | "normal" | "high" | "urgent";
        estimateMinutes?: number;
        estimate_minutes?: number;
        estimate?: number;
        title?: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
      }) => {
        const id = args.taskId || targetTaskId;
        if (!id) return { error: "No task ID specified." };

        // Fetch existing task info for context & logging
        const { data: existingTask } = await supabase
          .from("tasks")
          .select("id, title, start_date, due_date, estimate_minutes, priority, status_id, primary_assignee_id")
          .eq("id", id)
          .eq("project_id", projectId)
          .single();

        if (!existingTask) {
          return { error: `Task not found with ID ${id}` };
        }

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        const changesSummary: string[] = [];

        const sDate = args.startDate || args.start_date;
        const dDate = args.dueDate || args.due_date;
        const est = args.estimateMinutes ?? args.estimate_minutes ?? args.estimate;
        const assignee = args.assigneeId;

        if (sDate !== undefined) {
          updates.start_date = sDate || null;
          changesSummary.push(`start_date: ${sDate}`);
        }
        if (dDate !== undefined) {
          updates.due_date = dDate || null;
          changesSummary.push(`due_date: ${dDate}`);
        }
        if (est !== undefined) {
          updates.estimate_minutes = est;
          changesSummary.push(`estimate: ${est}m`);
        }
        if (args.priority !== undefined) {
          updates.priority = args.priority;
          changesSummary.push(`priority: ${args.priority}`);
        }
        if (args.title !== undefined && args.title.trim()) {
          updates.title = args.title.trim().slice(0, 240);
          changesSummary.push(`title: "${args.title.trim()}"`);
        }
        if (args.description !== undefined) {
          updates.description = args.description.slice(0, 10000);
          changesSummary.push("description updated");
        }
        if (args.statusId !== undefined) {
          updates.status_id = args.statusId;
          changesSummary.push("status updated");
        }
        if (assignee !== undefined) {
          updates.primary_assignee_id = assignee || null;
          changesSummary.push(`assignee: ${assignee}`);
        }

        if (Object.keys(updates).length <= 1) {
          return { error: "No valid fields provided for update." };
        }

        const { error: updateError } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", id)
          .eq("project_id", projectId);

        if (updateError) {
          return { error: `Failed to update task: ${updateError.message}` };
        }

        // Sync task_assignees table if assignee changed
        if (assignee) {
          try {
            await supabase.from("task_assignees").upsert({
              project_id: projectId,
              task_id: id,
              user_id: assignee,
              assigned_by: userId,
            });
          } catch {
            // ignore non-fatal assignee sync errors
          }
        }

        const logMsg = `Updated "${existingTask.title}": ${changesSummary.join(", ")}`;
        actionLog.push(logMsg);

        return {
          success: true,
          taskId: id,
          title: existingTask.title,
          changes: changesSummary,
        };
      },
    }),

    /**
     * Create structured subtasks under a parent task
     */
    create_subtasks: tool({
      description:
        "Create one or more subtasks under a parent task. Each subtask can have title, description, estimateMinutes, priority, startDate, dueDate, and assigneeId.",
      inputSchema: z.object({
        parentTaskId: z
          .string()
          .optional()
          .describe("The parent task ID to add subtasks to. Defaults to current target task if omitted."),
        subtasks: z
          .array(
            z.object({
              title: z.string().describe("Concise subtask title"),
              description: z.string().optional().describe("Optional subtask description or scope"),
              estimateMinutes: z.number().optional().describe("Estimate in minutes (e.g. 30, 60, 120)"),
              estimate: z.number().optional().describe("Alternative estimate in minutes"),
              priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Priority"),
              startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
              dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format"),
              assigneeId: z.string().optional().describe("User ID to assign this subtask to"),
            })
          )
          .describe("Array of subtasks to create (typically 2 to 7 items)"),
      }),
      execute: async ({
        parentTaskId,
        subtasks,
      }: {
        parentTaskId?: string;
        subtasks: Array<{
          title: string;
          description?: string;
          estimateMinutes?: number;
          estimate?: number;
          priority?: "low" | "normal" | "high" | "urgent";
          startDate?: string;
          dueDate?: string;
          assigneeId?: string;
        }>;
      }) => {
        const parentId = parentTaskId || targetTaskId;
        if (!parentId) return { error: "No parent task ID specified." };

        // Fetch parent task to inherit status or assignee
        const { data: parent } = await supabase
          .from("tasks")
          .select("id, title, status_id, primary_assignee_id")
          .eq("id", parentId)
          .eq("project_id", projectId)
          .single();

        if (!parent) return { error: "Parent task not found." };

        const createdSubtasks: Array<{ id: string; title: string }> = [];

        for (const st of subtasks) {
          if (!st.title || !st.title.trim()) continue;
          const est = st.estimateMinutes ?? st.estimate ?? null;
          const { data: inserted, error: insErr } = await supabase
            .from("tasks")
            .insert({
              project_id: projectId,
              parent_task_id: parentId,
              status_id: parent.status_id,
              title: st.title.trim().slice(0, 240),
              description: st.description ? st.description.slice(0, 5000) : "",
              priority: st.priority || "normal",
              estimate_minutes: est,
              start_date: st.startDate || null,
              due_date: st.dueDate || null,
              primary_assignee_id: st.assigneeId || parent.primary_assignee_id || null,
              created_by: userId,
            })
            .select("id, title")
            .single();

          if (!insErr && inserted) {
            createdSubtasks.push({ id: inserted.id, title: inserted.title });
            // Sync assignee
            const assId = st.assigneeId || parent.primary_assignee_id;
            if (assId) {
              try {
                await supabase.from("task_assignees").upsert({
                  project_id: projectId,
                  task_id: inserted.id,
                  user_id: assId,
                  assigned_by: userId,
                });
              } catch {
                // ignore
              }
            }
          }
        }

        const logMsg = `Created ${createdSubtasks.length} subtasks under "${parent.title}": ${createdSubtasks.map((s) => s.title).join(", ")}`;
        actionLog.push(logMsg);

        return {
          success: true,
          parentTaskId: parentId,
          createdCount: createdSubtasks.length,
          subtasks: createdSubtasks,
        };
      },
    }),

    /**
     * Create a checklist and its checklist items on a task
     */
    create_checklist: tool({
      description:
        "Create an acceptance criteria or verification checklist with multiple actionable checklist items on a task.",
      inputSchema: z.object({
        taskId: z.string().optional().describe("Target task ID (defaults to current task if omitted)"),
        title: z.string().optional().describe("Checklist header title (defaults to 'Acceptance Criteria')"),
        items: z.array(z.string()).describe("Array of checklist item strings"),
      }),
      execute: async ({
        taskId,
        title,
        items,
      }: {
        taskId?: string;
        title?: string;
        items: string[];
      }) => {
        const id = taskId || targetTaskId;
        if (!id) return { error: "No task ID specified." };

        const checklistTitle = title?.trim() || "Acceptance Criteria";
        const validItems = (items || []).map((i: string) => i.trim()).filter((i: string) => i.length > 0);

        if (validItems.length === 0) {
          return { error: "No valid checklist items provided." };
        }

        // Insert checklist container
        const { data: cl, error: clErr } = await supabase
          .from("task_checklists")
          .insert({
            project_id: projectId,
            task_id: id,
            title: checklistTitle.slice(0, 100),
            created_by: userId,
          })
          .select("id")
          .single();

        if (clErr || !cl) {
          return { error: `Failed to create checklist container: ${clErr?.message || "Unknown error"}` };
        }

        let itemCount = 0;
        for (let i = 0; i < validItems.length; i++) {
          const { error: itemErr } = await supabase.from("checklist_items").insert({
            project_id: projectId,
            task_id: id,
            checklist_id: cl.id,
            title: validItems[i].slice(0, 300),
            position: (i + 1) * 1000.0,
            created_by: userId,
          });
          if (!itemErr) itemCount++;
        }

        const logMsg = `Created checklist "${checklistTitle}" with ${itemCount} items`;
        actionLog.push(logMsg);

        return {
          success: true,
          checklistId: cl.id,
          checklistTitle,
          itemCount,
        };
      },
    }),

    /**
     * Add a formal note or comment to a task
     */
    add_task_comment: tool({
      description: "Post an analysis note, recommendation, or comment to a task's discussion history.",
      inputSchema: z.object({
        taskId: z.string().optional().describe("Target task ID (defaults to current task if omitted)"),
        comment: z.string().describe("The comment message or analysis note to record"),
      }),
      execute: async ({
        taskId,
        comment,
      }: {
        taskId?: string;
        comment: string;
      }) => {
        const id = taskId || targetTaskId;
        if (!id) return { error: "No task ID specified." };
        if (!comment || !comment.trim()) return { error: "Comment cannot be empty." };

        const formatted = context.agentName
          ? `🤖 **AI Agent (${context.agentName})**:\n\n${comment.trim()}`
          : `🤖 **AI Agent**:\n\n${comment.trim()}`;

        const { error: comErr } = await supabase.from("task_comments").insert({
          project_id: projectId,
          task_id: id,
          author_id: userId,
          body: formatted.slice(0, 10000),
        });

        if (comErr) {
          return { error: `Failed to post comment: ${comErr.message}` };
        }

        actionLog.push(`Posted analysis note to task`);
        return { success: true };
      },
    }),

    /**
     * Link two tasks with a dependency relation
     */
    add_task_dependency: tool({
      description: "Add a dependency relationship between two tasks (blocks, blocked_by, related, duplicate).",
      inputSchema: z.object({
        taskId: z.string().optional().describe("Source task ID (defaults to current task if omitted)"),
        linkedTaskId: z.string().describe("Target task ID to link to"),
        relation: z
          .enum(["blocks", "blocked_by", "related", "duplicate"])
          .optional()
          .describe("Dependency relationship type (defaults to 'blocks')"),
      }),
      execute: async ({
        taskId,
        linkedTaskId,
        relation = "blocks",
      }: {
        taskId?: string;
        linkedTaskId: string;
        relation?: "blocks" | "blocked_by" | "related" | "duplicate";
      }) => {
        const id = taskId || targetTaskId;
        if (!id) return { error: "No source task ID specified." };
        if (id === linkedTaskId) return { error: "A task cannot depend on itself." };

        const { error } = await supabase.from("task_dependencies").upsert({
          project_id: projectId,
          task_id: id,
          linked_task_id: linkedTaskId,
          relation,
          created_by: userId,
        });

        if (error) {
          return { error: `Failed to link tasks: ${error.message}` };
        }

        actionLog.push(`Added dependency: task ${relation} linked task`);
        return { success: true, relation };
      },
    }),
  };

  return {
    tools,
    getActionLog: () => actionLog,
  };
}
