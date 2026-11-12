import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import AppTopBar from "@/app/AppTopBar";
import PrimarySpaceLeftSlot from "@/app/PrimarySpaceLeftSlot";
import { getAssignedTaskCount } from "@/lib/workspace-space";
import ChatWorkspace from "./ChatWorkspace";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();

  if (!user) redirect("/login");

  // Fetch current user's profile, assigned count, and organization memberships
  const [{ data: ownProfile }, assignedTaskCount, { data: orgMemberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    getAssignedTaskCount(user.id),
    supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id),
  ]);

  const currentUserName = ownProfile?.display_name?.trim() || user.email?.split("@")[0] || "User";

  const orgIds = (orgMemberships ?? []).map((m) => m.organization_id);

  // Fetch all members in those organizations
  let memberUserIds: string[] = [];
  if (orgIds.length > 0) {
    const { data: allOrgMembers } = await supabase
      .from("organization_members")
      .select("user_id")
      .in("organization_id", orgIds)
      .eq("status", "active");
    memberUserIds = [...new Set((allOrgMembers ?? []).map((m) => m.user_id))];
  }

  // Also include the current user
  if (!memberUserIds.includes(user.id)) {
    memberUserIds.push(user.id);
  }

  // Fetch profiles for all members
  const { data: memberProfiles } = memberUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", memberUserIds)
    : { data: [] };

  const teamMembers = (memberProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name?.trim() || p.email || "Team member",
    email: p.email || "",
    avatarUrl: p.avatar_url || null,
  }));

  return (
    <main
      className="app-shell ov-shell ov-fullpage-shell"
      style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <AppTopBar
        email={user.email ?? ""}
        leftSlot={
          <PrimarySpaceLeftSlot
            activeNav="chat"
            assignedTaskCount={assignedTaskCount}
          />
        }
      />

      <ChatWorkspace
        currentUserId={user.id}
        currentUserName={currentUserName}
        teamMembers={teamMembers}
      />
    </main>
  );
}
