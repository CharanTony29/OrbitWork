import { notFound, redirect } from "next/navigation";
import HierarchyNavigation from "@/app/HierarchyNavigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: workspace } = await supabase.from("workspaces").select("id, name, organization_id").eq("id", workspaceId).maybeSingle();
  if (!workspace) notFound();
  const { data: organization } = await supabase.from("organizations").select("name").eq("id", workspace.organization_id).maybeSingle();
  if (!organization) notFound();
  return <div className="hierarchy-layout"><HierarchyNavigation organizationId={workspace.organization_id} organizationName={organization.name} currentWorkspaceId={workspace.id}/><div className="hierarchy-content">{children}</div></div>;
}
