import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch currently running timer (if any)
    const { data: runningTimerRow } = await supabase
      .from("time_entries")
      .select("id, task_id, project_id, started_at, billable, tasks(id, title, generated_key), projects(id, name)")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .maybeSingle();

    // 2. Fetch today's logged time total
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data: todayEntries } = await supabase
      .from("time_entries")
      .select("id, duration_minutes, started_at, description, task_id, tasks(title), projects(name)")
      .eq("user_id", user.id)
      .gte("started_at", startOfToday.toISOString())
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false });

    const todayTotalMinutes = (todayEntries ?? []).reduce(
      (sum, e) => sum + (e.duration_minutes ?? 0),
      0
    );

    // 3. Fetch active user tasks (assigned or recently worked on)
    let { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, generated_key, project_id, priority, due_date, estimate_minutes, projects(id, name), project_statuses(id, name, color, category)")
      .or(`primary_assignee_id.eq.${user.id},secondary_assignee_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(30);

    // If user has no directly assigned tasks, fallback to recent tasks across projects
    if (!tasks || tasks.length === 0) {
      const { data: generalTasks } = await supabase
        .from("tasks")
        .select("id, title, generated_key, project_id, priority, due_date, estimate_minutes, projects(id, name), project_statuses(id, name, color, category)")
        .order("created_at", { ascending: false })
        .limit(20);
      tasks = generalTasks ?? [];
    }

    return NextResponse.json({
      runningTimer: runningTimerRow
        ? {
            id: runningTimerRow.id,
            taskId: runningTimerRow.task_id,
            taskTitle: (runningTimerRow.tasks as any)?.title ?? "Task",
            generatedKey: (runningTimerRow.tasks as any)?.generated_key ?? "",
            projectId: runningTimerRow.project_id,
            projectName: (runningTimerRow.projects as any)?.name ?? "Project",
            startedAt: runningTimerRow.started_at,
            billable: runningTimerRow.billable,
          }
        : null,
      todayTotalMinutes,
      todayEntries: (todayEntries ?? []).slice(0, 5).map((e) => ({
        id: e.id,
        durationMinutes: e.duration_minutes,
        startedAt: e.started_at,
        description: e.description,
        taskTitle: (e.tasks as any)?.title ?? "Task",
        projectName: (e.projects as any)?.name ?? "Project",
      })),
      tasks: (tasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        generatedKey: t.generated_key,
        projectId: t.project_id,
        projectName: (t.projects as any)?.name ?? "Project",
        status: (t.project_statuses as any)?.name ?? "In Progress",
        statusColor: (t.project_statuses as any)?.color ?? "#3b82f6",
        priority: t.priority ?? "normal",
        dueDate: t.due_date,
        estimateMinutes: t.estimate_minutes,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, taskId, projectId, entryId, minutes, description, billable } = body;

    if (action === "start") {
      if (!taskId || !projectId) {
        return NextResponse.json({ error: "Missing taskId or projectId" }, { status: 400 });
      }

      // If user already has a running timer, stop it first
      const { data: running } = await supabase
        .from("time_entries")
        .select("id, started_at")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .maybeSingle();

      if (running) {
        const ended = new Date();
        const start = new Date(running.started_at);
        const elapsed = Math.max(1, Math.round((ended.getTime() - start.getTime()) / 60000));
        await supabase
          .from("time_entries")
          .update({ ended_at: ended.toISOString(), duration_minutes: elapsed })
          .eq("id", running.id);
      }

      const { data: newEntry, error } = await supabase
        .from("time_entries")
        .insert({
          project_id: projectId,
          task_id: taskId,
          user_id: user.id,
          started_at: new Date().toISOString(),
          billable: billable !== false,
        })
        .select("id, started_at, task_id, project_id, billable")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, runningTimer: newEntry });
    }

    if (action === "stop") {
      if (!entryId) {
        return NextResponse.json({ error: "Missing entryId" }, { status: 400 });
      }

      const { data: entry } = await supabase
        .from("time_entries")
        .select("started_at")
        .eq("id", entryId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .maybeSingle();

      if (!entry) {
        return NextResponse.json({ error: "Timer not found" }, { status: 404 });
      }

      const ended = new Date();
      const start = new Date(entry.started_at);
      const elapsed = Math.max(1, Math.round((ended.getTime() - start.getTime()) / 60000));

      const { error } = await supabase
        .from("time_entries")
        .update({ ended_at: ended.toISOString(), duration_minutes: elapsed })
        .eq("id", entryId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, elapsedMinutes: elapsed });
    }

    if (action === "log") {
      if (!taskId || !projectId || !minutes) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
      }

      const now = new Date();
      const dur = Math.max(1, parseInt(minutes, 10) || 1);
      const start = new Date(now.getTime() - dur * 60000);

      const { error } = await supabase.from("time_entries").insert({
        project_id: projectId,
        task_id: taskId,
        user_id: user.id,
        started_at: start.toISOString(),
        ended_at: now.toISOString(),
        duration_minutes: dur,
        description: description || "",
        billable: billable !== false,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
