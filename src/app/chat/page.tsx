import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import BackButton from "@/app/BackButton";
import ChatWorkspace from "./ChatWorkspace";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Fetch current user's profile
  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const currentUserName = ownProfile?.display_name?.trim() || user.email?.split("@")[0] || "User";

  // Fetch all organizations the user belongs to
  const { data: orgMemberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);

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
    <main className="app-shell" style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BackButton fallbackHref="/dashboard" label="Dashboard" />
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">O</span>Orbit<span>work</span>
          </Link>
        </div>
        <div className="topbar-right">
          <CurrentUserBadge email={user.email ?? ""} />
        </div>
      </header>

      <ChatWorkspace
        currentUserId={user.id}
        currentUserName={currentUserName}
        teamMembers={teamMembers}
      />
    </main>
  );
}
