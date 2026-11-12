"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock,
  DoorOpen,
  ExternalLink,
  Plus,
  Radio,
  Trash2,
  Video,
  X,
} from "lucide-react";
import NativeMeetingRoom from "./NativeMeetingRoom";

export type PlannerOrganization = {
  id: string;
  name: string;
};

export type PlannerProject = {
  id: string;
  name: string;
  organizationId: string;
  workspaceId: string;
};

export type PlannerMember = {
  userId: string;
  organizationId: string;
  fullName: string;
  email: string;
  role: string;
};

export type PlannerMeeting = {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  project_id: string | null;
  title: string;
  description: string;
  room_name: string;
  room_code: string;
  meeting_url: string;
  start_time: string;
  end_time: string;
  organizer_id: string;
  participant_ids: string[];
  status: "scheduled" | "live" | "completed" | "cancelled";
};

export type PlannerTask = {
  id: string;
  project_id: string;
  title: string;
  generated_key: string | null;
  priority: string;
  due_date: string | null;
  projectName: string;
};

export type PlannerHoliday = {
  id: string;
  organization_id: string;
  name: string;
  holiday_date: string;
};

const PRESET_ROOMS = [
  "Virtual Lobby",
  "Boardroom A",
  "Focus Pod 1",
  "Sprint War Room",
  "Design Studio",
];

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function PlannerClient({
  currentUserId,
  initialOrgId,
  initialRoomCode,
  organizations,
  projects,
  members,
  initialMeetings,
  tasks,
  holidays,
  schemaMissing,
}: {
  currentUserId: string;
  initialOrgId: string;
  initialRoomCode: string | null;
  organizations: PlannerOrganization[];
  projects: PlannerProject[];
  members: PlannerMember[];
  initialMeetings: PlannerMeeting[];
  tasks: PlannerTask[];
  holidays: PlannerHoliday[];
  schemaMissing: boolean;
}) {
  const now = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const d = new Date(now.getTime() + 15 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return toLocalDateTimeInput(d);
  }, [now]);
  const defaultEnd = useMemo(() => {
    const d = new Date(new Date(defaultStart).getTime() + 45 * 60 * 1000);
    return toLocalDateTimeInput(d);
  }, [defaultStart]);

  const [meetings, setMeetings] = useState<PlannerMeeting[]>(initialMeetings);
  const [selectedOrgId, setSelectedOrgId] = useState(
    initialOrgId || organizations[0]?.id || ""
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [roomName, setRoomName] = useState(PRESET_ROOMS[0]);
  const [customRoom, setCustomRoom] = useState("");
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [description, setDescription] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([currentUserId]);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(initialRoomCode);
  const [filterTab, setFilterTab] = useState<"upcoming" | "live" | "past" | "all">("upcoming");
  const [submitting, setSubmitting] = useState(false);
  const [busyMeetingId, setBusyMeetingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );

  const orgMembers = useMemo(
    () => members.filter((m) => m.organizationId === selectedOrgId),
    [members, selectedOrgId]
  );

  const orgProjects = useMemo(
    () => projects.filter((p) => p.organizationId === selectedOrgId),
    [projects, selectedOrgId]
  );

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.userId, m.fullName || m.email || "Member");
    }
    return map;
  }, [members]);

  const currentUserName = memberNameById.get(currentUserId) ?? "You";
  const effectiveRoomName = roomName === "__custom__" ? customRoom.trim() : roomName;

  const busyRooms = useMemo(() => {
    const set = new Set<string>();
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    for (const m of meetings) {
      if (m.organization_id !== selectedOrgId) continue;
      if (m.status !== "scheduled" && m.status !== "live") continue;
      if (m.status === "live") {
        set.add(m.room_name.toLowerCase());
      } else if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        const ms = new Date(m.start_time).getTime();
        const me = new Date(m.end_time).getTime();
        if (ms < endMs && me > startMs) {
          set.add(m.room_name.toLowerCase());
        }
      }
    }
    return set;
  }, [meetings, selectedOrgId, startTime, endTime]);

  const activeMeeting = useMemo(() => {
    if (!activeRoomCode) return null;
    return meetings.find((m) => m.room_code === activeRoomCode) ?? null;
  }, [meetings, activeRoomCode]);

  const visibleMeetings = useMemo(() => {
    const currentMs = Date.now();
    return meetings.filter((m) => {
      if (selectedOrgId && m.organization_id !== selectedOrgId) return false;
      const endMs = new Date(m.end_time).getTime();
      if (filterTab === "live") return m.status === "live";
      if (filterTab === "upcoming") {
        return m.status === "live" || (m.status === "scheduled" && endMs >= currentMs - 3600000);
      }
      if (filterTab === "past") {
        return m.status === "completed" || m.status === "cancelled" || endMs < currentMs - 3600000;
      }
      return true;
    });
  }, [meetings, selectedOrgId, filterTab]);

  const liveCount = useMemo(
    () =>
      meetings.filter(
        (m) => m.organization_id === selectedOrgId && m.status === "live"
      ).length,
    [meetings, selectedOrgId]
  );

  const upcomingCount = useMemo(
    () =>
      meetings.filter(
        (m) =>
          m.organization_id === selectedOrgId &&
          (m.status === "scheduled" || m.status === "live")
      ).length,
    [meetings, selectedOrgId]
  );

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) {
      setMessage({ type: "error", text: "Select an organization first." });
      return;
    }
    if (!title.trim() || !effectiveRoomName) {
      setMessage({ type: "error", text: "Provide both a meeting title and room name." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const selectedProj = orgProjects.find((p) => p.id === selectedProjectId);
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          workspaceId: selectedProj?.workspaceId ?? null,
          projectId: selectedProjectId || null,
          title: title.trim(),
          description: description.trim(),
          roomName: effectiveRoomName,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          meetingUrl: meetingUrl.trim(),
          participantIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Could not create meeting." });
        return;
      }
      const created: PlannerMeeting = json.meeting;
      setMeetings((prev) =>
        [...prev, created].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      );
      setActiveRoomCode(created.room_code);
      setTitle("");
      setDescription("");
      setMeetingUrl("");
      setMessage({
        type: "ok",
        text: `Booked "${created.room_name}" for "${created.title}". OrbitWork room (${created.room_code}) is ready below.`,
      });
    } catch {
      setMessage({ type: "error", text: "Network error creating meeting." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartInstantRoom() {
    if (!selectedOrgId) return;
    setSubmitting(true);
    setMessage(null);
    const nowDate = new Date();
    const endDate = new Date(nowDate.getTime() + 45 * 60 * 1000);
    const room = effectiveRoomName || "Virtual Lobby";
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          projectId: selectedProjectId || null,
          title: title.trim() || `Instant Sync (${room})`,
          description: description.trim() || "Quick instant meeting room session",
          roomName: room,
          startTime: nowDate.toISOString(),
          endTime: endDate.toISOString(),
          meetingUrl: meetingUrl.trim(),
          participantIds,
          instant: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Could not open instant room." });
        return;
      }
      const created: PlannerMeeting = json.meeting;
      setMeetings((prev) => [created, ...prev]);
      setActiveRoomCode(created.room_code);
      setTitle("");
      setMessage({
        type: "ok",
        text: `Live OrbitWork room "${created.room_name}" (${created.room_code}) opened!`,
      });
    } catch {
      setMessage({ type: "error", text: "Failed to start instant meeting room." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    meetingId: string,
    status: "scheduled" | "live" | "completed" | "cancelled"
  ) {
    setBusyMeetingId(meetingId);
    setMessage(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Failed to update meeting." });
        return;
      }
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? (json.meeting as PlannerMeeting) : m))
      );
    } finally {
      setBusyMeetingId(null);
    }
  }

  async function handleDeleteMeeting(meetingId: string) {
    setBusyMeetingId(meetingId);
    setMessage(null);
    try {
      const res = await fetch(`/api/meetings?meetingId=${encodeURIComponent(meetingId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Failed to delete booking." });
        return;
      }
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      if (activeMeeting?.id === meetingId) {
        setActiveRoomCode(null);
      }
      setMessage({ type: "ok", text: "Meeting booking removed." });
    } finally {
      setBusyMeetingId(null);
    }
  }

  const upcomingHolidays = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return holidays
      .filter((h) => h.organization_id === selectedOrgId && h.holiday_date >= todayIso)
      .slice(0, 5);
  }, [holidays, selectedOrgId]);

  return (
    <main className="planner-main">
      <div className="planner-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>
            Planner &amp; Meeting Rooms
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "13.5px" }}>
            Schedule team syncs, reserve meeting rooms without overlaps, and host live OrbitWork audio/video meetings right inside your workspace.
          </p>
        </div>

        <div className="planner-header-actions">
          {organizations.length > 0 && (
            <select
              className="planner-select"
              aria-label="Filter by organization"
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setSelectedProjectId("");
              }}
              style={{ minWidth: "210px", width: "auto" }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="button button-primary"
            disabled={submitting || organizations.length === 0}
            onClick={handleStartInstantRoom}
          >
            <Radio size={15} />
            Start Instant Room
          </button>
        </div>
      </div>

      {schemaMissing && (
        <div
          className="planner-card"
          style={{
            borderColor: "#f59e0b",
            background: "rgba(245, 158, 11, 0.08)",
          }}
        >
          <strong>Database migration required for Meeting Rooms</strong>
          <span style={{ fontSize: "13px" }}>
            Run <code>supabase/migrations/202611120003_platform_enhancements.sql</code> in
            your Supabase SQL Editor to enable creating and storing meeting room bookings.
          </span>
        </div>
      )}

      {message && (
        <div
          className="planner-card"
          style={{
            padding: "12px 16px",
            borderColor: message.type === "error" ? "#ef4444" : "#16a34a",
            color: message.type === "error" ? "#b91c1c" : "#15803d",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ fontSize: "13.5px", fontWeight: 600 }}>{message.text}</span>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setMessage(null)}
              style={{ padding: "4px" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="planner-kpis">
        <div className="planner-kpi">
          <strong>{liveCount}</strong>
          <span>Live meeting rooms right now</span>
        </div>
        <div className="planner-kpi">
          <strong>{upcomingCount}</strong>
          <span>Scheduled &amp; active bookings</span>
        </div>
        <div className="planner-kpi">
          <strong>{tasks.length}</strong>
          <span>Assigned open tasks</span>
        </div>
        <div className="planner-kpi">
          <strong>{upcomingHolidays.length}</strong>
          <span>Upcoming org holidays</span>
        </div>
      </div>

      {activeMeeting && (
        <NativeMeetingRoom
          meeting={activeMeeting}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          memberNameById={memberNameById}
          busy={busyMeetingId === activeMeeting.id}
          onStatusChange={handleStatusChange}
          onClose={() => setActiveRoomCode(null)}
        />
      )}

      <div className="planner-grid">
        {/* Left: Schedule Meeting & Book Room + Meetings List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="planner-card">
            <div className="planner-card-head">
              <h2>
                <Plus size={17} /> Schedule Meeting &amp; Book Room
              </h2>
              <span className="muted" style={{ fontSize: "12px" }}>
                Built-in OrbitWork Room · Conflict protection enabled
              </span>
            </div>

            <form className="planner-form" onSubmit={handleCreateMeeting}>
              <div className="planner-field">
                <label className="planner-label" htmlFor="meeting-title">
                  Meeting title
                </label>
                <input
                  id="meeting-title"
                  className="planner-input"
                  placeholder="e.g. Sprint Planning, Client Design Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="planner-field">
                <span className="planner-label">Select meeting room</span>
                <div className="planner-room-chips">
                  {PRESET_ROOMS.map((preset) => {
                    const isBusy = busyRooms.has(preset.toLowerCase());
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`planner-room-chip${
                          roomName === preset ? " is-active" : ""
                        }${isBusy ? " is-busy" : ""}`}
                        onClick={() => setRoomName(preset)}
                        title={
                          isBusy
                            ? "This room currently has an overlapping or live session"
                            : "Room available"
                        }
                      >
                        <DoorOpen size={13} />
                        {preset}
                        {isBusy ? " (In use)" : ""}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`planner-room-chip${
                      roomName === "__custom__" ? " is-active" : ""
                    }`}
                    onClick={() => setRoomName("__custom__")}
                  >
                    + Custom Room
                  </button>
                </div>
                {roomName === "__custom__" && (
                  <input
                    className="planner-input"
                    style={{ marginTop: "8px" }}
                    placeholder="Enter custom room name (e.g. Floor 3 Pod)"
                    value={customRoom}
                    onChange={(e) => setCustomRoom(e.target.value)}
                    required
                  />
                )}
              </div>

              <div className="planner-form-grid">
                <div className="planner-field">
                  <label className="planner-label" htmlFor="meeting-start">
                    Start date &amp; time
                  </label>
                  <input
                    id="meeting-start"
                    type="datetime-local"
                    className="planner-input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="planner-field">
                  <label className="planner-label" htmlFor="meeting-end">
                    End date &amp; time
                  </label>
                  <input
                    id="meeting-end"
                    type="datetime-local"
                    className="planner-input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="planner-form-grid">
                <div className="planner-field">
                  <label className="planner-label" htmlFor="meeting-project">
                    Linked project (optional)
                  </label>
                  <select
                    id="meeting-project"
                    className="planner-select"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Organization-wide meeting</option>
                    {orgProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="planner-field">
                  <label className="planner-label" htmlFor="meeting-url">
                    Custom external video link (optional)
                  </label>
                  <input
                    id="meeting-url"
                    type="url"
                    className="planner-input"
                    placeholder="Leave blank to use OrbitWork Built-in Room"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="planner-field">
                <label className="planner-label" htmlFor="meeting-agenda">
                  Agenda / notes
                </label>
                <textarea
                  id="meeting-agenda"
                  className="planner-textarea"
                  rows={3}
                  placeholder="Share meeting goals, sprint topics, or prep notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="planner-field">
                <div className="planner-field-head">
                  <span className="planner-label">
                    Invite teammates ({participantIds.length} selected)
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="button button-ghost"
                      style={{ fontSize: "12px", padding: "3px 8px" }}
                      onClick={() =>
                        setParticipantIds(
                          Array.from(
                            new Set([currentUserId, ...orgMembers.map((m) => m.userId)])
                          )
                        )
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      style={{ fontSize: "12px", padding: "3px 8px" }}
                      onClick={() => setParticipantIds([currentUserId])}
                    >
                      Only me
                    </button>
                  </div>
                </div>
                <div className="planner-participants-grid">
                  {orgMembers.map((member) => {
                    const checked = participantIds.includes(member.userId);
                    const labelName = member.fullName || member.email || "Member";
                    return (
                      <label
                        key={`${member.organizationId}:${member.userId}`}
                        className={`planner-participant-option${
                          checked ? " is-selected" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipant(member.userId)}
                        />
                        <div className="planner-participant-text">
                          <span className="planner-participant-name">
                            {labelName}
                            {member.userId === currentUserId ? " (You)" : ""}
                          </span>
                          {member.email && member.email !== labelName && (
                            <span className="planner-participant-sub">{member.email}</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submitting || organizations.length === 0}
                >
                  <Calendar size={15} />
                  {submitting ? "Booking..." : "Book Meeting Room"}
                </button>
              </div>
            </form>
          </section>

          <section className="planner-card">
            <div className="planner-card-head">
              <h2>
                <Video size={17} /> Meetings &amp; Room Bookings
              </h2>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(["upcoming", "live", "past", "all"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`planner-room-chip${filterTab === tab ? " is-active" : ""}`}
                    onClick={() => setFilterTab(tab)}
                  >
                    {tab === "upcoming"
                      ? "Upcoming"
                      : tab === "live"
                        ? `Live (${liveCount})`
                        : tab === "past"
                          ? "Past"
                          : "All"}
                  </button>
                ))}
              </div>
            </div>

            {visibleMeetings.length === 0 ? (
              <p className="muted" style={{ margin: "4px 0", fontSize: "13px" }}>
                No meetings in this view. Schedule one above or click &ldquo;Start Instant Room&rdquo;.
              </p>
            ) : (
              <div className="planner-meeting-list">
                {visibleMeetings.map((m) => {
                  const hasCustomExternalUrl =
                    Boolean(m.meeting_url) &&
                    !m.meeting_url.includes("meet.jit.si/orbitwork-");
                  return (
                    <article
                      key={m.id}
                      className={`planner-meeting-item${m.status === "live" ? " is-live" : ""}`}
                    >
                      <div className="planner-meeting-top">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "15px" }}>{m.title}</strong>
                            <span className={`planner-badge is-${m.status}`}>
                              {m.status}
                            </span>
                            <span className="planner-badge is-room">
                              <DoorOpen size={11} /> {m.room_name}
                            </span>
                          </div>
                          <div className="planner-meeting-meta" style={{ marginTop: "6px" }}>
                            <span>
                              <Clock size={12} style={{ verticalAlign: "-1px", marginRight: "4px" }} />
                              {new Date(m.start_time).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}{" "}
                              –{" "}
                              {new Date(m.end_time).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            <span>
                              Host: {memberNameById.get(m.organizer_id) ?? "Organizer"}
                            </span>
                            <span>{m.participant_ids.length} participants</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ padding: "5px 10px", fontSize: "12px", minHeight: "30px" }}
                            onClick={() => setActiveRoomCode(m.room_code)}
                          >
                            <DoorOpen size={13} /> Enter OrbitWork Room
                          </button>
                          <a
                            href={`/planner/room/${encodeURIComponent(m.room_code)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-secondary"
                            style={{ padding: "5px 10px", fontSize: "12px", minHeight: "30px" }}
                            title="Open meeting room in new browser tab"
                          >
                            <ExternalLink size={13} /> New Tab
                          </a>
                          {hasCustomExternalUrl && (
                            <a
                              href={m.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                              className="button button-secondary"
                              style={{ padding: "5px 10px", fontSize: "12px", minHeight: "30px" }}
                            >
                              <ExternalLink size={13} /> External
                            </a>
                          )}
                          <button
                            type="button"
                            className="button button-ghost"
                            style={{ padding: "5px 8px", minHeight: "30px" }}
                            title="Delete booking"
                            disabled={busyMeetingId === m.id}
                            onClick={() => handleDeleteMeeting(m.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {m.description && (
                        <p className="muted" style={{ margin: 0, fontSize: "12.5px" }}>
                          {m.description}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right: Daily Focus Tasks & Holidays */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="planner-card">
            <div className="planner-card-head">
              <h3>
                <CalendarDays size={16} /> My Planned Tasks
              </h3>
              <Link
                href="/my-dashboard"
                className="button button-ghost"
                style={{ fontSize: "12px", padding: "4px 8px" }}
              >
                Full Dashboard
              </Link>
            </div>

            {tasks.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
                No upcoming tasks assigned to you.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tasks.slice(0, 10).map((t) => (
                  <Link
                    key={t.id}
                    href={`/projects/${t.project_id}/tasks/${t.id}`}
                    className="planner-task-row"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "13px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.generated_key ? `${t.generated_key} · ` : ""}
                        {t.title}
                      </div>
                      <div className="muted" style={{ fontSize: "11.5px" }}>
                        {t.projectName} · Priority: {t.priority}
                      </div>
                    </div>
                    <span className="planner-badge">
                      {t.due_date
                        ? new Date(`${t.due_date}T00:00:00`).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "No due date"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="planner-card">
            <div className="planner-card-head">
              <h3>
                <Calendar size={16} /> Upcoming Organization Holidays
              </h3>
              {selectedOrgId && (
                <Link
                  href={`/organizations/${selectedOrgId}/calendar`}
                  className="button button-ghost"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                >
                  Org Calendar
                </Link>
              )}
            </div>
            {upcomingHolidays.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
                No upcoming holidays scheduled for this organization.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {upcomingHolidays.map((h) => (
                  <div key={h.id} className="planner-task-row">
                    <strong style={{ fontSize: "13px" }}>{h.name}</strong>
                    <span className="planner-badge is-room">
                      {new Date(`${h.holiday_date}T00:00:00`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
