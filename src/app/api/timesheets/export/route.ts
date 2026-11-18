import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTimesheetWorkbook, TimesheetEntryExport } from "@/lib/timesheets-export";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scopeType = searchParams.get("scope") || "workspace"; // "workspace" | "project" | "organization"
    const targetId = searchParams.get("id"); // workspaceId, projectId, or organizationId
    const rangeType = searchParams.get("range") || "month"; // "year" | "month" | "custom"
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const month = searchParams.get("month") || String(new Date().getMonth() + 1).padStart(2, "0"); // "01".."12"
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");

    if (!targetId) {
      return NextResponse.json({ error: "Target ID (id parameter) is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let startDateStr = "";
    let endDateStr = "";
    let dateRangeLabel = "";

    if (rangeType === "year") {
      const yr = parseInt(year, 10) || new Date().getFullYear();
      startDateStr = `${yr}-01-01`;
      endDateStr = `${yr + 1}-01-01`;
      dateRangeLabel = `Year ${yr}`;
    } else if (rangeType === "month") {
      const yr = parseInt(year, 10) || new Date().getFullYear();
      const mo = parseInt(month, 10) || (new Date().getMonth() + 1);
      const start = new Date(Date.UTC(yr, mo - 1, 1));
      const end = new Date(Date.UTC(yr, mo, 1));
      startDateStr = start.toISOString().slice(0, 10);
      endDateStr = end.toISOString().slice(0, 10);
      const monthName = start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
      dateRangeLabel = `${monthName} ${yr}`;
    } else {
      if (!customStart || !customEnd) {
        return NextResponse.json({ error: "Start and end dates required for custom range" }, { status: 400 });
      }
      startDateStr = customStart;
      const endD = new Date(`${customEnd}T00:00:00Z`);
      endD.setUTCDate(endD.getUTCDate() + 1);
      endDateStr = endD.toISOString().slice(0, 10);
      dateRangeLabel = `${customStart} to ${customEnd}`;
    }

    if (scopeType !== "project" && scopeType !== "workspace" && scopeType !== "organization") {
      return NextResponse.json({ error: "Invalid scope parameter" }, { status: 400 });
    }

    let scopeName = "Timesheet Report";
    let projectIdsToQuery: string[] = [];
    let canManage = false;

    if (scopeType === "project") {
      const { data: project } = await supabase
        .from("projects")
        .select("id, name, workspace_id")
        .eq("id", targetId)
        .maybeSingle();

      if (!project) {
        return NextResponse.json({ error: "Project not found or accessible" }, { status: 404 });
      }
      const managerResult = await supabase.rpc("can_manage_project", { target_project: targetId });
      canManage = managerResult.data === true;
      scopeName = project.name;
      projectIdsToQuery = [project.id];
    } else if (scopeType === "workspace") {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id, name, organization_id")
        .eq("id", targetId)
        .maybeSingle();

      if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      }
      const managerResult = await supabase.rpc("can_manage_workspace", { target_workspace: targetId });
      canManage = managerResult.data === true;
      scopeName = workspace.name;

      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("workspace_id", targetId);

      projectIdsToQuery = (projects || []).map((p) => p.id);
    } else if (scopeType === "organization") {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", targetId)
        .maybeSingle();

      if (!org) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }
      const orgRoleResult = await supabase.rpc("has_org_role", {
        target_org: targetId,
        allowed_roles: ["owner", "admin", "manager"],
      });
      canManage = orgRoleResult.data === true;
      scopeName = org.name;

      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id")
        .eq("organization_id", targetId);

      const wsIds = (workspaces || []).map((w) => w.id);
      if (wsIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .in("workspace_id", wsIds);
        projectIdsToQuery = (projects || []).map((p) => p.id);
      }
    }

    if (projectIdsToQuery.length === 0) {
      const emptyBuffer = generateTimesheetWorkbook(
        {
          type: scopeType,
          name: scopeName,
          dateRangeLabel,
          startDate: startDateStr,
          endDate: endDateStr,
        },
        []
      );
      return new NextResponse(emptyBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="timesheets_${scopeType}_${startDateStr}.xlsx"`,
        },
      });
    }

    // Query time entries
    let entryQuery = supabase
      .from("time_entries")
      .select("id, user_id, task_id, project_id, started_at, ended_at, duration_minutes, description, billable, tasks(generated_key, title), projects(name)")
      .in("project_id", projectIdsToQuery)
      .gte("started_at", `${startDateStr}T00:00:00Z`)
      .lt("started_at", `${endDateStr}T00:00:00Z`)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: true })
      .limit(10000);

    if (!canManage) {
      entryQuery = entryQuery.eq("user_id", user.id);
    }

    const { data: rawEntries, error: entriesError } = await entryQuery;

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }

    const entries = rawEntries || [];
    const userIds = [...new Set(entries.map((e) => e.user_id))];

    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds)
      : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const mappedEntries: TimesheetEntryExport[] = entries.map((e: any) => {
      const profile = profileMap.get(e.user_id);
      const task = Array.isArray(e.tasks) ? e.tasks[0] : e.tasks;
      const project = Array.isArray(e.projects) ? e.projects[0] : e.projects;

      return {
        id: e.id,
        user_id: e.user_id,
        userName: profile?.display_name?.trim() || profile?.email || "Team member",
        userEmail: profile?.email || "",
        projectName: project?.name || "General",
        taskKey: task?.generated_key || "",
        taskTitle: task?.title || "",
        startedAt: e.started_at,
        endedAt: e.ended_at,
        durationMinutes: e.duration_minutes || 0,
        description: e.description || "",
        billable: e.billable ?? false,
      };
    });

    const excelBuffer = generateTimesheetWorkbook(
      {
        type: scopeType as any,
        name: scopeName,
        dateRangeLabel,
        startDate: startDateStr,
        endDate: endDateStr,
      },
      mappedEntries
    );

    const safeName = scopeName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const filename = `timesheet_${safeName}_${startDateStr}.xlsx`;

    return new NextResponse(excelBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Failed to export timesheets to excel:", err);
    return NextResponse.json({ error: err.message || "Export failed" }, { status: 500 });
  }
}
