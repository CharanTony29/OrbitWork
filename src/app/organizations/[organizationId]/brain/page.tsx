import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppTopBar from "@/app/AppTopBar";
import { createClient } from "@/lib/supabase/server";
import { buildOrganizationBrain } from "@/lib/brain/portfolio-brain";
import OrganizationBrainView from "./OrganizationBrainView";

export default async function OrganizationBrainPage({
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

  let initialData;
  try {
    initialData = await buildOrganizationBrain(organizationId, user.id);
  } catch (err) {
    console.warn("Failed to prefetch organization brain data on server:", err);
  }

  return (
    <>
      <AppTopBar email={user.email || ""} />
      <main className="container" style={{ padding: "20px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href={`/organizations/${organizationId}/workspaces`}
            className="button button-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px" }}
          >
            <ArrowLeft size={14} />
            <span>Back to Workspaces</span>
          </Link>
        </div>

        <OrganizationBrainView organizationId={organizationId} initialData={initialData} />
      </main>
    </>
  );
}
