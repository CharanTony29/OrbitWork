import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const taskItemSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(10000).optional().default(""),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  secondaryAssigneeId: z.string().uuid().nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).optional().default([]),
  assigneeName: z.string().trim().max(120).nullable().optional(),
  isExternal: z.boolean().optional().default(false),
  externalAssignee: z.string().trim().max(120).nullable().optional(),
  tags: z.array(z.string().trim().max(40)).optional().default([]),
});

const batchSchema = z.object({
  projectId: z.string().uuid(),
  tasks: z.array(taskItemSchema).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId, tasks } = parsed.data;

    // Retrieve default workflow status for this project
    // Note: column is 'position', NOT 'order_index'
    let { data: statuses } = await supabase
      .from("project_statuses")
      .select("id, name, category, position, is_default")
      .eq("project_id", projectId)
      .order("position", { ascending: true });

    let defaultStatus =
      statuses?.find((s) => s.is_default) ||
      statuses?.find((s) => s.category === "not_started") ||
      statuses?.[0];

    // Fallback: Check adminClient if user has restricted select RLS
    if (!defaultStatus) {
      const adminClient = createAdminClient();
      if (adminClient) {
        const { data: adminStatuses } = await adminClient
          .from("project_statuses")
          .select("id, name, category, position, is_default")
          .eq("project_id", projectId)
          .order("position", { ascending: true });

        defaultStatus =
          adminStatuses?.find((s) => s.is_default) ||
          adminStatuses?.find((s) => s.category === "not_started") ||
          adminStatuses?.[0];
      }
    }

    // Auto-seed standard statuses if the project has none configured
    if (!defaultStatus) {
      const adminClient = createAdminClient();
      const clientForStatus = adminClient ?? supabase;
      const initialStatuses = [
        { project_id: projectId, name: "To Do", color: "#87938b", category: "not_started" as const, position: 0, is_default: true },
        { project_id: projectId, name: "In Progress", color: "#0891b2", category: "in_progress" as const, position: 1, is_default: false },
        { project_id: projectId, name: "In Review", color: "#d97706", category: "in_progress" as const, position: 2, is_default: false },
        { project_id: projectId, name: "Done", color: "#167c58", category: "completed" as const, position: 3, is_default: false },
      ];

      const { data: seeded } = await clientForStatus
        .from("project_statuses")
        .insert(initialStatuses)
        .select("id, name, category, position, is_default")
        .order("position", { ascending: true });

      defaultStatus = seeded?.find((s) => s.is_default) || seeded?.[0];
    }

    if (!defaultStatus) {
      return NextResponse.json(
        { error: "Project has no valid workflow statuses configured." },
        { status: 400 }
      );
    }

    // Lookup organization ID to validate primary/secondary assignees
    const { data: projectData } = await supabase
      .from("projects")
      .select("workspaces ( organization_id )")
      .eq("id", projectId)
      .maybeSingle();

    const ws = Array.isArray(projectData?.workspaces)
      ? projectData?.workspaces[0]
      : projectData?.workspaces;
    const orgId = ws?.organization_id;

    let validMemberIds = new Set<string>();
    if (orgId) {
      const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "active");
      (orgMembers || []).forEach((m) => validMemberIds.add(m.user_id));
    }

    // Prepare insert payload for tasks
    const insertPayload = tasks.map((t) => {
      // Collect valid internal assignee IDs
      const rawAssigneeList = [
        t.assigneeId,
        t.secondaryAssigneeId,
        ...(t.assigneeIds || []),
      ].filter((id): id is string => Boolean(id) && typeof id === "string" && validMemberIds.has(id));

      const uniqueAssigneeIds = Array.from(new Set(rawAssigneeList));
      const primaryAssignee = uniqueAssigneeIds[0] ?? null;
      const secondaryAssignee = uniqueAssigneeIds[1] ?? null;

      // Handle external assignee tags and description
      const tags = [...(t.tags || [])];
      let formattedDescription = t.description || "";

      if (t.externalAssignee || t.isExternal) {
        const extName = (t.externalAssignee || t.assigneeName || "External Stakeholder").trim();
        if (!tags.includes("external")) tags.push("external");
        if (extName && !tags.includes(`ext:${extName}`)) {
          tags.push(`ext:${extName.slice(0, 36)}`);
        }

        const externalNotice = `\n\n> 🌐 **External Stakeholder / Assignee:** ${extName}`;
        if (!formattedDescription.includes("**External Stakeholder")) {
          formattedDescription = formattedDescription.trim()
            ? `${formattedDescription.trim()}${externalNotice}`
            : `> 🌐 **External Stakeholder / Assignee:** ${extName}`;
        }
      }

      return {
        project_id: projectId,
        status_id: defaultStatus.id,
        title: t.title,
        description: formattedDescription,
        priority: t.priority,
        task_type: "task",
        due_date: t.dueDate ? t.dueDate.slice(0, 10) : null,
        primary_assignee_id: primaryAssignee,
        secondary_assignee_id: secondaryAssignee,
        tags: Array.from(new Set(tags)).slice(0, 20),
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { data: createdTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(insertPayload)
      .select("id, title, primary_assignee_id, secondary_assignee_id");

    if (insertError) {
      console.error("[Batch Task Insert Error]:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Insert task_assignees junction rows and send notifications
    if (createdTasks && createdTasks.length > 0) {
      const assigneeRowsToInsert: Array<{
        project_id: string;
        task_id: string;
        user_id: string;
        assigned_by: string;
      }> = [];

      createdTasks.forEach((createdTask, idx) => {
        const origTask = tasks[idx];
        if (!origTask) return;

        const candidateIds = [
          origTask.assigneeId,
          origTask.secondaryAssigneeId,
          ...(origTask.assigneeIds || []),
        ].filter((id): id is string => Boolean(id) && typeof id === "string" && validMemberIds.has(id));

        const unique = Array.from(new Set(candidateIds));
        for (const uid of unique) {
          assigneeRowsToInsert.push({
            project_id: projectId,
            task_id: createdTask.id,
            user_id: uid,
            assigned_by: user.id,
          });
        }
      });

      if (assigneeRowsToInsert.length > 0) {
        try {
          await supabase.from("task_assignees").insert(assigneeRowsToInsert);
        } catch (assigneeErr) {
          console.warn("[Batch Task Assignees Sync Error]:", assigneeErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      createdCount: createdTasks?.length ?? 0,
      tasks: createdTasks,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create tasks";
    console.error("[Batch Task Creation Exception]:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
