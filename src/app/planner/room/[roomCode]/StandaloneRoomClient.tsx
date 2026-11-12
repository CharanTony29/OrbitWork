"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NativeMeetingRoom, { type NativeRoomMeeting } from "../../NativeMeetingRoom";

export default function StandaloneRoomClient({
  initialMeeting,
  currentUserId,
  currentUserName,
  memberEntries,
}: {
  initialMeeting: NativeRoomMeeting;
  currentUserId: string;
  currentUserName: string;
  memberEntries: Array<[string, string]>;
}) {
  const [meeting, setMeeting] = useState<NativeRoomMeeting>(initialMeeting);
  const [busy, setBusy] = useState(false);

  const memberNameById = useMemo(() => new Map(memberEntries), [memberEntries]);

  async function handleStatusChange(
    meetingId: string,
    status: "scheduled" | "live" | "completed" | "cancelled"
  ) {
    setBusy(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, status }),
      });
      const json = await res.json();
      if (res.ok && json.meeting) {
        setMeeting(json.meeting as NativeRoomMeeting);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="planner-standalone-shell">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <Link href="/planner" className="button button-ghost" style={{ fontSize: "13px" }}>
          <ArrowLeft size={14} /> Back to Planner
        </Link>
        <span className="muted" style={{ fontSize: "12.5px" }}>
          Dedicated Meeting Room Window
        </span>
      </div>

      <NativeMeetingRoom
        meeting={meeting}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        memberNameById={memberNameById}
        busy={busy}
        standalone
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
