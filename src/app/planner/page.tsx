import "./planner.css";
import { redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import PrimarySpaceLeftSlot from "@/app/PrimarySpaceLeftSlot";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isSchemaMissingError } from "@/lib/chat";
import PlannerClient, {
  type PlannerHoliday,
  type PlannerMeeting,
  type PlannerMember,
  type PlannerOrganization,
  type PlannerProject,
  type PlannerTask,
} from "./PlannerClient";

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; room?: string }>;
}) {
  const { org: requestedOrgId, room: initialRoomCode } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) redirect("/login");

  // 1. Organizations the user belongs to
  const { data: myOrgRows } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const organizations: PlannerOrganization[] = (myOrgRows ?? [])
    .map((row) => {
      const orgRel = row.organizations as unknown as { id: string; name: string } | null;
      return orgRel ? { id: orgRel.id, name: orgRel.name } : null;
    })
    .filter((o): o is PlannerOrganization => Boolean(o));

  const orgIds = organizations.map((o) => o.id);
  const initialOrgId =
    (requestedOrgId && orgIds.includes(requestedOrgId) ? requestedOrgId : orgIds[0]) ?? "";

  if (orgIds.length === 0) {
    return (
      <div className="planner-shell">
        <AppTopBar
          email={user.email ?? ""}
          leftSlot={<PrimarySpaceLeftSlot activeNav="planner" />}
        />
        <PlannerClient
          currentUserId={user.id}
          initialOrgId=""
          initialRoomCode={initialRoomCode ?? null}
          organizations={[]}
          projects={[]}
          members={[]}
          initialMeetings={[]}
          tasks={[]}
          holidays={[]}
          schemaMissing={false}
        />
      </div>
    );
  }

  // 2. Parallel load members, workspaces+projects, holidays, meetings, assigned tasks
  const [
    membersRes,
    workspacesRes,
    holidaysRes,
    meetingsRes,
    directTasksRes,
    multiAssigneesRes,
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("organization_id, user_id, role")
      .in("organization_id", orgIds)
      .eq("status", "active"),
    supabase
      .from("workspaces")
      .select("id, organization_id, projects(id, name)")
      .in("organization_id", orgIds),
    supabase
      .from("organization_holidays")
      .select("id, organization_id, name, holiday_date")
      .in("organization_id", orgIds)
      .order("holiday_date", { ascending: true }),
    supabase
      .from("meetings")
      .select(
        "id, organization_id, workspace_id, project_id, title, description, room_name, room_code, meeting_url, start_time, end_time, organizer_id, participant_ids, status"
      )
      .in("organization_id", orgIds)
      .order("start_time", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, project_id, title, generated_key, priority, due_date, projects(name)")
      .or(`primary_assignee_id.eq.${user.id},secondary_assignee_id.eq.${user.id}`)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase.from("task_assignees").select("task_id").eq("user_id", user.id),
  ]);

  const rawMembers = membersRes.data ?? [];
  const memberUserIds = Array.from(new Set(rawMembers.map((m) => m.user_id)));
  const { data: profilesData } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", memberUserIds)
      : { data: [] };

  const profileMap = new Map(
    (profilesData ?? []).map((p) => [
      p.id,
      {
        fullName: p.display_name?.trim() || p.email || "Member",
        email: p.email ?? "",
      },
    ])
  );

  const members: PlannerMember[] = rawMembers.map((m) => {
    const profile = profileMap.get(m.user_id);
    const fallbackName =
      m.user_id === user.id
        ? (typeof user.user_metadata?.full_name === "string" &&
            user.user_metadata.full_name.trim()) ||
          user.email ||
          "You"
        : "Member";
    return {
      userId: m.user_id,
      organizationId: m.organization_id,
      fullName: profile?.fullName || fallbackName,
      email: profile?.email || (m.user_id === user.id ? user.email ?? "" : ""),
      role: m.role,
    };
  });

  const projects: PlannerProject[] = [];
  for (const ws of workspacesRes.data ?? []) {
    const projList = (ws.projects as unknown as Array<{ id: string; name: string }>) ?? [];
    for (const p of projList) {
      projects.push({
        id: p.id,
        name: p.name,
        organizationId: ws.organization_id,
        workspaceId: ws.id,
      });
    }
  }

  // Merge direct + task_assignees assigned tasks
  const extraTaskIds = (multiAssigneesRes.data ?? []).map((r) => r.task_id);
  let extraTasks: typeof directTasksRes.data = [];
  if (extraTaskIds.length > 0) {
    const { data } = await supabase
      .from("tasks")
      .select("id, project_id, title, generated_key, priority, due_date, projects(name)")
      .in("id", extraTaskIds)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(30);
    extraTasks = data ?? [];
  }

  const taskMap = new Map<string, PlannerTask>();
  for (const row of [...(directTasksRes.data ?? []), ...(extraTasks ?? [])]) {
    if (taskMap.has(row.id)) continue;
    const projRel = row.projects as unknown as { name: string } | null;
    taskMap.set(row.id, {
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      generated_key: row.generated_key,
      priority: row.priority,
      due_date: row.due_date,
      projectName: projRel?.name ?? "Project",
    });
  }

  const tasks = Array.from(taskMap.values()).sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const schemaMissing = Boolean(meetingsRes.error && isSchemaMissingError(meetingsRes.error));
  const initialMeetings: PlannerMeeting[] = schemaMissing
    ? []
    : ((meetingsRes.data ?? []) as PlannerMeeting[]);

  const holidays: PlannerHoliday[] = (holidaysRes.data ?? []) as PlannerHoliday[];

  return (
    <div className="planner-shell">
      <AppTopBar
        email={user.email ?? ""}
        organizationId={initialOrgId}
        leftSlot={<PrimarySpaceLeftSlot activeNav="planner" />}
      />
      <PlannerClient
        currentUserId={user.id}
        initialOrgId={initialOrgId}
        initialRoomCode={initialRoomCode ?? null}
        organizations={organizations}
        projects={projects}
        members={members}
        initialMeetings={initialMeetings}
        tasks={tasks}
        holidays={holidays}
        schemaMissing={schemaMissing}
      />
    </div>
  );
}
