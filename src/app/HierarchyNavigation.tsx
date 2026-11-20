import "./app-styles.css";
import { createClient } from "@/lib/supabase/server";
import HierarchyNavClient from "./HierarchyNavClient";

export default async function HierarchyNavigation({
  organizationId,
  organizationName,
  currentWorkspaceId,
  currentProjectId,
}: {
  organizationId: string;
  organizationName: string;
  currentWorkspaceId: string;
  currentProjectId?: string;
}) {
  const supabase = await createClient();
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");
  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id);
  const { data: projects } = workspaceIds.length
    ? await supabase
        .from("projects")
        .select("id, name, workspace_id, icon")
        .in("workspace_id", workspaceIds)
        .order("name")
    : { data: [] };

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: taskRows } = projectIds.length
    ? await supabase.from("tasks").select("project_id").in("project_id", projectIds)
    : { data: [] };

  const taskCountMap: Record<string, number> = {};
  for (const row of taskRows ?? []) {
    taskCountMap[row.project_id] = (taskCountMap[row.project_id] ?? 0) + 1;
  }

  const { data: orgMembers } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId);
  const userIds = (orgMembers ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
    : { data: [] };

  const memberList = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || "Team member",
    avatarUrl: p.avatar_url || null,
  }));

  return (
    <HierarchyNavClient
      organizationId={organizationId}
      organizationName={organizationName}
      currentWorkspaceId={currentWorkspaceId}
      currentProjectId={currentProjectId}
      workspaces={(workspaces ?? []).map((w) => ({ id: w.id, name: w.name }))}
      projects={(projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        workspace_id: p.workspace_id,
        icon: (p as any).icon || "📁",
        taskCount: taskCountMap[p.id] || 0,
      }))}
      members={memberList}
    />
  );
}
