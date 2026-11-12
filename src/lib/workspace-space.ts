import { createClient, getAuthUser } from "@/lib/supabase/server";

export type SpaceOrganization = {
  id: string;
  name: string;
  created_at: string;
  role: string;
  ownerLabel: string;
};

export type SpaceWorkspace = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  ownerLabel: string;
  memberCount: number;
  projectCount: number;
  lastActivityAt: string | null;
  lastActivitySummary: string | null;
};

export type SpaceProject = {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
};

export type UserSpaceData = {
  user: { id: string; email?: string | null };
  displayName: string;
  organizations: SpaceOrganization[];
  workspaces: SpaceWorkspace[];
  projects: SpaceProject[];
  organizationMembers: { organization_id: string; user_id: string; role: string }[];
  assignedTaskCount: number;
};

function formatActivityEventSummary(eventType: string, details: unknown): string {
  const rec = details && typeof details === "object" ? (details as Record<string, unknown>) : null;
  const title = typeof rec?.title === "string" && rec.title.trim() ? rec.title.trim() : null;
  if (eventType === "subtask_added") {
    return title ? `Subtask added: ${title}` : "Subtask added";
  }
  if (eventType === "task_created") {
    return title ? `Created task: ${title}` : "Task created";
  }
  const readable = eventType.replaceAll("_", " ");
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

/**
 * Returns the count of tasks assigned to the given user across all projects.
 */
export async function getAssignedTaskCount(userId?: string): Promise<number> {
  const supabase = await createClient();
  let targetUserId = userId;
  if (!targetUserId) {
    const {
      data: { user },
    } = await getAuthUser();
    targetUserId = user?.id;
  }
  if (!targetUserId) return 0;

  const { count } = await supabase
    .from("task_assignees")
    .select("task_id", { count: "exact", head: true })
    .eq("user_id", targetUserId);
  return count ?? 0;
}

/**
 * Loads the authenticated user's space summary (profile name, organizations,
 * workspaces, projects, active members, owners, recent activity, and assigned
 * task count) shared by `/dashboard` and `/my-dashboard`.
 */
export async function getUserSpaceData(): Promise<UserSpaceData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return null;

  try {
    await supabase.rpc("accept_user_pending_invitations");
  } catch {
    // Invitation auto-acceptance is best-effort on page load.
  }

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    ownProfile?.display_name?.trim() || user.email?.split("@")[0] || "there";

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, created_at, created_by)")
    .eq("user_id", user.id);

  const rawOrgs = (memberships ?? [])
    .map((item) => {
      const org = (Array.isArray(item.organizations)
        ? item.organizations[0]
        : item.organizations) as {
        id: string;
        name: string;
        created_at: string;
        created_by?: string;
      } | null;
      if (!org?.id) return null;
      return {
        id: org.id,
        name: org.name,
        created_at: org.created_at,
        created_by: org.created_by ?? null,
        role: item.role,
      };
    })
    .filter(
      (item): item is { id: string; name: string; created_at: string; created_by: string | null; role: string } =>
        Boolean(item)
    );

  const orgIds = rawOrgs.map((o) => o.id);

  const [{ data: rawWorkspaces }, { data: rawOrgMembers }] = await Promise.all([
    orgIds.length
      ? supabase
          .from("workspaces")
          .select("id, organization_id, name, description, archived_at, created_by, created_at, updated_at")
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            organization_id: string;
            name: string;
            description: string | null;
            archived_at: string | null;
            created_by: string;
            created_at: string;
            updated_at: string;
          }>,
        }),
    orgIds.length
      ? supabase
          .from("organization_members")
          .select("organization_id, user_id, role")
          .in("organization_id", orgIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as { organization_id: string; user_id: string; role: string }[] }),
  ]);

  const workspaceList = rawWorkspaces ?? [];
  const orgMembersList = (rawOrgMembers ?? []) as {
    organization_id: string;
    user_id: string;
    role: string;
  }[];
  const workspaceIds = workspaceList.map((w) => w.id);

  const [{ data: rawProjects }, { data: rawWorkspaceMembers }, { count: assignedTaskCount }] = await Promise.all([
    workspaceIds.length
      ? supabase
          .from("projects")
          .select("id, workspace_id, name, status, updated_at")
          .in("workspace_id", workspaceIds)
          .order("name")
      : Promise.resolve({
          data: [] as Array<{ id: string; workspace_id: string; name: string; status: string; updated_at?: string }>,
        }),
    workspaceIds.length
      ? supabase
          .from("workspace_members")
          .select("workspace_id, user_id")
          .in("workspace_id", workspaceIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as { workspace_id: string; user_id: string }[] }),
    supabase
      .from("task_assignees")
      .select("task_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const projectsList = (rawProjects ?? []) as Array<{
    id: string;
    workspace_id: string;
    name: string;
    status: string;
    updated_at?: string;
  }>;
  const projectIds = projectsList.map((p) => p.id);

  const ownerUserByOrg = new Map<string, string>();
  for (const member of orgMembersList) {
    if (member.role === "owner" && !ownerUserByOrg.has(member.organization_id)) {
      ownerUserByOrg.set(member.organization_id, member.user_id);
    }
  }
  for (const org of rawOrgs) {
    if (!ownerUserByOrg.has(org.id) && org.created_by) {
      ownerUserByOrg.set(org.id, org.created_by);
    }
  }

  const profileIds = [
    ...new Set(
      [
        ...Array.from(ownerUserByOrg.values()),
        ...workspaceList.map((w) => w.created_by),
      ].filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: profilesData }, { data: recentEventsData }] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles").select("id, display_name, email").in("id", profileIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; display_name: string | null; email: string | null }>,
        }),
    projectIds.length
      ? supabase
          .from("project_activity_events")
          .select("project_id, event_type, details, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({
          data: [] as Array<{ project_id: string; event_type: string; details: unknown; created_at: string }>,
        }),
  ]);

  const profileMap = new Map<string, string>();
  for (const prof of profilesData ?? []) {
    const label = prof.display_name?.trim() || prof.email || "Team member";
    profileMap.set(prof.id, label);
  }

  const projectCountByWorkspace = new Map<string, number>();
  const projectToWorkspace = new Map<string, string>();
  const latestProjectUpdatedByWorkspace = new Map<string, string>();
  for (const proj of projectsList) {
    projectCountByWorkspace.set(proj.workspace_id, (projectCountByWorkspace.get(proj.workspace_id) ?? 0) + 1);
    projectToWorkspace.set(proj.id, proj.workspace_id);
    if (proj.updated_at) {
      const existing = latestProjectUpdatedByWorkspace.get(proj.workspace_id);
      if (!existing || proj.updated_at > existing) {
        latestProjectUpdatedByWorkspace.set(proj.workspace_id, proj.updated_at);
      }
    }
  }

  const memberCountByWorkspace = new Map<string, number>();
  for (const wm of rawWorkspaceMembers ?? []) {
    memberCountByWorkspace.set(wm.workspace_id, (memberCountByWorkspace.get(wm.workspace_id) ?? 0) + 1);
  }

  const latestActivityByWorkspace = new Map<string, { at: string; summary: string }>();
  for (const evt of recentEventsData ?? []) {
    const wsId = projectToWorkspace.get(evt.project_id);
    if (!wsId || latestActivityByWorkspace.has(wsId)) continue;
    latestActivityByWorkspace.set(wsId, {
      at: evt.created_at,
      summary: formatActivityEventSummary(evt.event_type, evt.details),
    });
  }

  const organizations: SpaceOrganization[] = rawOrgs.map((org) => {
    const ownerId = ownerUserByOrg.get(org.id);
    return {
      id: org.id,
      name: org.name,
      created_at: org.created_at,
      role: org.role,
      ownerLabel: (ownerId ? profileMap.get(ownerId) : null) ?? "Organization owner",
    };
  });

  const workspaces: SpaceWorkspace[] = workspaceList.map((ws) => {
    const evt = latestActivityByWorkspace.get(ws.id);
    const projectUpdated = latestProjectUpdatedByWorkspace.get(ws.id);
    const lastActivityAt = evt?.at ?? projectUpdated ?? ws.updated_at ?? ws.created_at;
    const lastActivitySummary = evt?.summary ?? (projectUpdated ? "Project updated" : "Workspace initialized");
    return {
      id: ws.id,
      organization_id: ws.organization_id,
      name: ws.name,
      description: ws.description,
      archived_at: ws.archived_at,
      created_by: ws.created_by,
      created_at: ws.created_at,
      updated_at: ws.updated_at,
      ownerLabel: profileMap.get(ws.created_by) ?? "Workspace owner",
      memberCount: memberCountByWorkspace.get(ws.id) ?? 0,
      projectCount: projectCountByWorkspace.get(ws.id) ?? 0,
      lastActivityAt,
      lastActivitySummary,
    };
  });

  return {
    user: { id: user.id, email: user.email },
    displayName,
    organizations,
    workspaces,
    projects: projectsList.map((p) => ({
      id: p.id,
      workspace_id: p.workspace_id,
      name: p.name,
      status: p.status,
    })),
    organizationMembers: orgMembersList,
    assignedTaskCount: assignedTaskCount ?? 0,
  };
}
