import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";

export type GoalMilestone = {
  id: string;
  title: string;
  dueDate?: string | null;
  completed: boolean;
  completedAt?: string | null;
};

export type GoalAchievement = {
  id: string;
  title: string;
  note?: string;
  awardedAt: string;
};

const milestoneSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean(),
  completedAt: z.string().nullable().optional(),
});

const achievementSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(400).optional(),
  awardedAt: z.string(),
});

const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().default(""),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  keyPerformerId: z.string().uuid().nullable().optional(),
  milestones: z.array(milestoneSchema).max(50).optional().default([]),
  achievements: z.array(achievementSchema).max(50).optional().default([]),
});

const updateGoalSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  keyPerformerId: z.string().uuid().nullable().optional(),
  milestones: z.array(milestoneSchema).max(50).optional(),
  achievements: z.array(achievementSchema).max(50).optional(),
  action: z.enum(["complete", "reopen", "update"]).optional().default("update"),
});

function computeProgress(milestones: GoalMilestone[], status: string): number {
  if (status === "completed") return 100;
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.completed).length;
  return Math.round((done * 100) / milestones.length);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: canAccess } = await supabase.rpc("can_access_project", {
    target_project: projectId,
  });
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("project_goals")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isSchemaMissingError(error)) {
      return NextResponse.json({ goals: [], schemaMissing: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goals: data ?? [], schemaMissing: false });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", {
    target_project: projectId,
  });
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goal fields" }, { status: 400 });
  }

  const milestones = parsed.data.milestones;
  const allDone = milestones.length > 0 && milestones.every((m) => m.completed);
  const status = allDone ? "completed" : "in_progress";
  const progress = computeProgress(milestones, status);

  const { data: goal, error } = await supabase
    .from("project_goals")
    .insert({
      project_id: projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      target_date: parsed.data.targetDate ?? null,
      key_performer_id: parsed.data.keyPerformerId ?? null,
      milestones,
      achievements: parsed.data.achievements,
      status,
      progress,
      completed_at: allDone ? new Date().toISOString() : null,
      completed_by: allDone ? user.id : null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    if (isSchemaMissingError(error)) {
      return NextResponse.json(
        { error: "Please run migration 202611120003_platform_enhancements.sql in Supabase first.", schemaMissing: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", {
    target_project: projectId,
  });
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("project_goals")
    .select("*")
    .eq("id", parsed.data.goalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  let nextMilestones: GoalMilestone[] =
    parsed.data.milestones ?? (Array.isArray(existing.milestones) ? existing.milestones : []);
  let nextAchievements: GoalAchievement[] =
    parsed.data.achievements ?? (Array.isArray(existing.achievements) ? existing.achievements : []);
  const nextTitle = parsed.data.title ?? existing.title;
  const nextDescription = parsed.data.description ?? existing.description;
  const nextTargetDate =
    parsed.data.targetDate !== undefined ? parsed.data.targetDate : existing.target_date;
  const nextKeyPerformerId =
    parsed.data.keyPerformerId !== undefined
      ? parsed.data.keyPerformerId
      : existing.key_performer_id;

  let nextStatus: "in_progress" | "completed" = existing.status;
  let completedAt: string | null = existing.completed_at;
  let completedBy: string | null = existing.completed_by;

  const autoCompletedByMilestones =
    parsed.data.action !== "reopen" &&
    nextMilestones.length > 0 &&
    nextMilestones.every((m) => m.completed) &&
    existing.status !== "completed";

  const completingNow =
    (parsed.data.action === "complete" || autoCompletedByMilestones) &&
    existing.status !== "completed";

  if (parsed.data.action === "complete" || completingNow) {
    const nowIso = new Date().toISOString();
    nextMilestones = nextMilestones.map((m) => ({
      ...m,
      completed: true,
      completedAt: m.completedAt ?? nowIso,
    }));
    nextStatus = "completed";
    completedAt = nowIso;
    completedBy = user.id;

    // Auto-record completion achievement & Key Performer recognition if not yet logged
    const alreadyHasCompletionBadge = nextAchievements.some((a) =>
      a.id.startsWith("goal-completed-")
    );
    if (!alreadyHasCompletionBadge) {
      nextAchievements = [
        ...nextAchievements,
        {
          id: `goal-completed-${Date.now()}`,
          title: `Goal Completed: ${nextTitle}`,
          note: nextKeyPerformerId
            ? "Completed with Key Performer recognition and all milestones achieved."
            : "All milestones reached and goal marked complete.",
          awardedAt: nowIso,
        },
      ];
    }
  } else if (parsed.data.action === "reopen") {
    nextStatus = "in_progress";
    completedAt = null;
    completedBy = null;
  } else if (
    nextMilestones.length > 0 &&
    nextMilestones.some((m) => !m.completed) &&
    existing.status === "completed"
  ) {
    nextStatus = "in_progress";
    completedAt = null;
    completedBy = null;
  }

  const nextProgress = computeProgress(nextMilestones, nextStatus);

  const { data: updated, error: updateErr } = await supabase
    .from("project_goals")
    .update({
      title: nextTitle,
      description: nextDescription,
      target_date: nextTargetDate,
      key_performer_id: nextKeyPerformerId,
      milestones: nextMilestones,
      achievements: nextAchievements,
      status: nextStatus,
      progress: nextProgress,
      completed_at: completedAt,
      completed_by: completedBy,
    })
    .eq("id", parsed.data.goalId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // On completion: send in-app notification to Key Performer & project creator/team
  if (completingNow) {
    try {
      const admin = createAdminClient();
      const writer = admin ?? supabase;
      const { data: projectMembers } = await writer
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);

      const recipients = new Set<string>(
        (projectMembers ?? []).map((m) => m.user_id).filter(Boolean)
      );
      if (nextKeyPerformerId) recipients.add(nextKeyPerformerId);
      if (existing.created_by) recipients.add(existing.created_by);
      recipients.delete(user.id);

      if (recipients.size > 0) {
        const rows = [...recipients].map((uid) => ({
          recipient_id: uid,
          actor_id: user.id,
          project_id: projectId,
          event_type: uid === nextKeyPerformerId ? "goal_completed" : "goal_completed",
          message:
            uid === nextKeyPerformerId
              ? `Goal "${nextTitle}" completed! You were recognized as the Key Performer 🏆`
              : `Project goal "${nextTitle}" has been completed!`,
          action_url: `/projects/${projectId}?view=goals`,
        }));
        await writer.from("notifications").insert(rows);
      }
    } catch {
      // Non-fatal if extended notification columns not yet migrated
    }
  }

  return NextResponse.json({ goal: updated, completedJustNow: completingNow });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: canEdit } = await supabase.rpc("can_edit_project_tasks", {
    target_project: projectId,
  });
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const goalId = req.nextUrl.searchParams.get("goalId");
  if (!goalId) return NextResponse.json({ error: "Missing goalId" }, { status: 400 });

  const { error } = await supabase
    .from("project_goals")
    .delete()
    .eq("id", goalId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
