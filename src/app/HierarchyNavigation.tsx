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
        .select("id, name, workspace_id")
        .in("workspace_id", workspaceIds)
        .order("name")
    : { data: [] };

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
      }))}
    />
  );
}
