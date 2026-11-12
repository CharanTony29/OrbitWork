import "../../planner.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppTopBar from "@/app/AppTopBar";
import PrimarySpaceLeftSlot from "@/app/PrimarySpaceLeftSlot";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { NativeRoomMeeting } from "../../NativeMeetingRoom";
import StandaloneRoomClient from "./StandaloneRoomClient";

export default async function StandaloneMeetingRoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) redirect("/login");

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(
      "id, organization_id, workspace_id, project_id, title, description, room_name, room_code, meeting_url, start_time, end_time, organizer_id, participant_ids, status"
    )
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error || !meeting) {
    if (!error) notFound();
    return (
      <div className="planner-shell">
        <AppTopBar
          email={user.email ?? ""}
          leftSlot={<PrimarySpaceLeftSlot activeNav="planner" />}
        />
        <div className="planner-standalone-shell">
          <div className="planner-card">
            <strong>Unable to open room {roomCode}</strong>
            <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
              {error.message}
            </p>
            <Link href="/planner" className="button button-primary" style={{ alignSelf: "flex-start" }}>
              Return to Planner
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: orgMembers } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", meeting.organization_id)
    .eq("status", "active");

  const userIds = Array.from(
    new Set([
      user.id,
      meeting.organizer_id,
      ...(meeting.participant_ids ?? []),
      ...(orgMembers ?? []).map((m) => m.user_id),
    ])
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds);

  const memberMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    memberMap.set(p.id, p.display_name?.trim() || p.email || "Member");
  }

  const fallbackSelf =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    user.email ||
    "You";
  const currentUserName = memberMap.get(user.id) ?? fallbackSelf;
  if (!memberMap.has(user.id)) memberMap.set(user.id, currentUserName);

  return (
    <div className="planner-shell">
      <AppTopBar
        email={user.email ?? ""}
        organizationId={meeting.organization_id}
        leftSlot={<PrimarySpaceLeftSlot activeNav="planner" />}
      />
      <StandaloneRoomClient
        initialMeeting={meeting as unknown as NativeRoomMeeting}
        currentUserId={user.id}
        currentUserName={currentUserName}
        memberEntries={Array.from(memberMap.entries())}
      />
    </div>
  );
}
