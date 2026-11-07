import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import HierarchyNavigation from "@/app/HierarchyNavigation";
import { createClient } from "@/lib/supabase/server";
import OrganizationDocsClient, {
  OrgAttachmentItem,
  OrgDocumentItem,
} from "./OrganizationDocsClient";

export default async function OrganizationDocsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();
  if (!organization) notFound();

  // Get all workspaces in this organization
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");

  const workspaceIds = (workspaces ?? []).map((w) => w.id);

  // Get all projects in these workspaces
  const { data: projects } = workspaceIds.length
    ? await supabase
        .from("projects")
        .select("id, name, workspace_id")
        .in("workspace_id", workspaceIds)
        .order("name")
    : { data: [] };

  const projectList = (projects ?? []).map((p) => ({ id: p.id, name: p.name }));
  const projectMap = new Map(projectList.map((p) => [p.id, p.name]));
  const projectIds = projectList.map((p) => p.id);

  // Query all project documents
  const { data: rawDocs } = projectIds.length
    ? await supabase
        .from("project_documents")
        .select("id, project_id, title, updated_at, created_by")
        .in("project_id", projectIds)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const documents: OrgDocumentItem[] = (rawDocs ?? []).map((d) => ({
    id: d.id,
    project_id: d.project_id,
    project_name: projectMap.get(d.project_id) || "Project",
    title: d.title,
    updated_at: d.updated_at,
  }));

  // Query all task attachments across all projects (exclude canvases)
  const { data: rawAttachments } = projectIds.length
    ? await supabase
        .from("task_attachments")
        .select(
          "id, task_id, project_id, file_name, mime_type, file_size_bytes, storage_provider, external_file_id, created_at, tasks(id, title)"
        )
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const attachments: OrgAttachmentItem[] = (rawAttachments ?? [])
    .filter((a) => {
      const isCanvas =
        a.mime_type.includes("whiteboard") ||
        a.mime_type.includes("flowchart") ||
        a.file_name.toLowerCase().endsWith(".whiteboard") ||
        a.file_name.toLowerCase().endsWith(".flowchart");
      return !isCanvas;
    })
    .map((a) => ({
      id: a.id,
      project_id: a.project_id,
      project_name: projectMap.get(a.project_id) || "Project",
      task_id: a.task_id,
      task_title: (a.tasks as any)?.title || "Task",
      file_name: a.file_name,
      mime_type: a.mime_type,
      file_size_bytes: a.file_size_bytes ?? undefined,
      created_at: a.created_at,
    }));

  const currentWorkspaceId = workspaces?.[0]?.id ?? "";

  return (
    <div className="hierarchy-layout">
      <HierarchyNavigation
        organizationId={organizationId}
        organizationName={organization.name}
        currentWorkspaceId={currentWorkspaceId}
      />
      <div className="hierarchy-content">
        <main className="app-shell project-app-shell">
          <header className="topbar">
            <Link className="brand" href="/dashboard">
              <span className="brand-mark">O</span>Orbit<span>work</span>
            </Link>
            <div className="topbar-right">
              <CurrentUserBadge email={user.email ?? ""} />
            </div>
          </header>

          <div
            className="project-page"
            style={{
              height: "calc(100vh - 46px)",
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              padding: 0,
              margin: 0,
              width: "100%",
              maxWidth: "100%",
            }}
          >
            <OrganizationDocsClient
              organizationName={organization.name}
              projects={projectList}
              attachments={attachments}
              documents={documents}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
