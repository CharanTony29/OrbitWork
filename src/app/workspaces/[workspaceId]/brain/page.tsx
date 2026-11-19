import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppTopBar from "@/app/AppTopBar";
import { createClient } from "@/lib/supabase/server";
import { buildWorkspaceBrain } from "@/lib/brain/portfolio-brain";
import WorkspaceBrainView from "./WorkspaceBrainView";

export default async function WorkspaceBrainPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, organization_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) notFound();

  let initialData;
  try {
    initialData = await buildWorkspaceBrain(workspaceId, user.id);
  } catch (err) {
    console.warn("Failed to prefetch workspace brain data on server:", err);
  }

  return (
    <>
      <AppTopBar email={user.email || ""} />
      <main className="container" style={{ padding: "20px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href={`/workspaces/${workspaceId}`}
            className="button button-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px" }}
          >
            <ArrowLeft size={14} />
            <span>Back to Workspace</span>
          </Link>
        </div>

        <WorkspaceBrainView workspaceId={workspaceId} initialData={initialData} />
      </main>
    </>
  );
}
