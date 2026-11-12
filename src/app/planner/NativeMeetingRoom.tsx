"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  DoorOpen,
  ExternalLink,
  Hand,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  Play,
  Radio,
  Send,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type NativeRoomMeeting = {
  id: string;
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

type PeerPresence = {
  userId: string;
  displayName: string;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  handRaised: boolean;
};

type RoomChatItem = {
  id: string;
  userId: string;
  senderName: string;
  text: string;
  sentAt: string;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function RemoteVideoTile({
  peer,
  stream,
  isHost,
}: {
  peer: PeerPresence;
  stream?: MediaStream;
  isHost: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  const hasLiveVideo =
    Boolean(stream) &&
    stream!.getVideoTracks().some((t) => t.readyState === "live" && t.enabled) &&
    (peer.camOn || peer.screenOn);

  const initials = (peer.displayName || "M")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={`native-room-tile${peer.handRaised ? " is-hand" : ""}`}>
      {stream && <audio ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }} autoPlay playsInline style={{ display: "none" }} />}
      {hasLiveVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="native-room-video"
        />
      ) : (
        <div className="native-room-avatar-stage">
          <div className="native-room-avatar-circle">{initials || "M"}</div>
          <span className="native-room-avatar-hint">
            {peer.camOn ? "Connecting video..." : "Camera off"}
          </span>
        </div>
      )}
      <div className="native-room-tile-bar">
        <span className="native-room-tile-name">
          {peer.displayName}
          {isHost ? " (Host)" : ""}
        </span>
        <span className="native-room-tile-badges">
          {peer.handRaised && (
            <span className="native-room-pill is-hand" title="Hand raised">
              <Hand size={11} />
            </span>
          )}
          <span
            className={`native-room-pill${peer.micOn ? "" : " is-muted"}`}
            title={peer.micOn ? "Mic on" : "Muted"}
          >
            {peer.micOn ? <Mic size={11} /> : <MicOff size={11} />}
          </span>
        </span>
      </div>
    </div>
  );
}

function describeMediaError(err: unknown, kind: "camera" | "microphone"): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return `Browser requires HTTPS (or localhost) to access your ${kind}.`;
  }
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return `${kind === "camera" ? "Camera" : "Microphone"} permission was denied. Allow access in your browser address bar site settings.`;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return `No ${kind} device was detected on this system.`;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return `Your ${kind} is currently in use by another app or browser tab.`;
  }
  return `Unable to access ${kind}.`;
}

export default function NativeMeetingRoom({
  meeting,
  currentUserId,
  currentUserName,
  memberNameById,
  busy,
  standalone = false,
  onStatusChange,
  onClose,
}: {
  meeting: NativeRoomMeeting;
  currentUserId: string;
  currentUserName: string;
  memberNameById: Map<string, string>;
  busy: boolean;
  standalone?: boolean;
  onStatusChange: (
    meetingId: string,
    status: "scheduled" | "live" | "completed" | "cancelled"
  ) => void;
  onClose?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerPresence[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<RoomChatItem[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const stateRef = useRef({ micOn, camOn, screenOn, handRaised });
  stateRef.current = { micOn, camOn, screenOn, handRaised };

  const stopAllMedia = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setRemoteStreams(new Map());
    setPeers([]);
    setScreenOn(false);
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      stopAllMedia();
    };
  }, [meeting.room_code, stopAllMedia]);

  // Keep local <video> attached whenever cam/screen changes
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (screenOn && screenStreamRef.current) {
      el.srcObject = screenStreamRef.current;
    } else if (localStreamRef.current && camOn) {
      el.srcObject = localStreamRef.current;
    } else {
      el.srcObject = null;
    }
  }, [joined, camOn, screenOn]);

  const syncPresence = useCallback(async () => {
    const ch = channelRef.current;
    if (!ch) return;
    const st = stateRef.current;
    await ch.track({
      userId: currentUserId,
      displayName: currentUserName,
      micOn: st.micOn,
      camOn: st.camOn,
      screenOn: st.screenOn,
      handRaised: st.handRaised,
    });
  }, [currentUserId, currentUserName]);

  const ensurePeerConnection = useCallback(
    (remoteUserId: string) => {
      const existing = pcsRef.current.get(remoteUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcsRef.current.set(remoteUserId, pc);

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteUserId, stream);
          return next;
        });
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !channelRef.current) return;
        channelRef.current.send({
          type: "broadcast",
          event: "rtc-ice",
          payload: {
            from: currentUserId,
            to: remoteUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "closed" || pc.connectionState === "failed") {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(remoteUserId);
            return next;
          });
        }
      };

      return pc;
    },
    [currentUserId]
  );

  async function joinRoom(withVideo: boolean) {
    setMediaNotice(null);
    let nextMic = true;
    let nextCam = withVideo;

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: withVideo,
        });
        localStreamRef.current = stream;
      } catch (firstErr) {
        if (withVideo) {
          // Try audio-only first, then video-only (in case PC has no mic or no webcam)
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            localStreamRef.current = audioOnly;
            nextCam = false;
            setMediaNotice(`${describeMediaError(firstErr, "camera")} Joined with audio & chat.`);
          } catch {
            try {
              const videoOnly = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: true,
              });
              localStreamRef.current = videoOnly;
              nextMic = false;
              setMediaNotice("Microphone unavailable — joined with camera & room chat.");
            } catch (camErr) {
              nextMic = false;
              nextCam = false;
              setMediaNotice(`${describeMediaError(camErr, "camera")} Joined in listen & chat mode.`);
            }
          }
        } else {
          nextMic = false;
          nextCam = false;
          setMediaNotice(`${describeMediaError(firstErr, "microphone")} Joined in listen & chat mode.`);
        }
      }
    } else {
      nextMic = false;
      nextCam = false;
      setMediaNotice("Browser media devices unavailable — joined in chat-only mode.");
    }

    setMicOn(nextMic);
    setCamOn(nextCam);
    stateRef.current = { ...stateRef.current, micOn: nextMic, camOn: nextCam };

    const supabase = createClient();
    const channel = supabase.channel(`orbit-meeting:${meeting.room_code}`, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, async () => {
      const rawState = channel.presenceState<PeerPresence>();
      const list: PeerPresence[] = [];
      for (const key of Object.keys(rawState)) {
        const entries = rawState[key];
        if (entries && entries.length > 0) {
          list.push(entries[0]);
        }
      }
      setPeers(list);

      const activeIds = new Set(list.map((p) => p.userId));
      // Close left peers
      for (const [peerId, pc] of pcsRef.current.entries()) {
        if (!activeIds.has(peerId)) {
          pc.close();
          pcsRef.current.delete(peerId);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      }

      // Deterministic offerer (lexicographically smaller userId initiates WebRTC offer)
      for (const peer of list) {
        if (peer.userId === currentUserId) continue;
        if (currentUserId < peer.userId && !pcsRef.current.has(peer.userId)) {
          const pc = ensurePeerConnection(peer.userId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: "broadcast",
              event: "rtc-offer",
              payload: { from: currentUserId, to: peer.userId, sdp: offer },
            });
          } catch {
            // ignore transient negotiation errors
          }
        }
      }
    });

    channel.on("broadcast", { event: "rtc-offer" }, async ({ payload }) => {
      if (!payload || payload.to !== currentUserId) return;
      const pc = ensurePeerConnection(payload.from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "rtc-answer",
          payload: { from: currentUserId, to: payload.from, sdp: answer },
        });
      } catch {
        // ignore negotiation failure
      }
    });

    channel.on("broadcast", { event: "rtc-answer" }, async ({ payload }) => {
      if (!payload || payload.to !== currentUserId) return;
      const pc = pcsRef.current.get(payload.from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch {
        // ignore
      }
    });

    channel.on("broadcast", { event: "rtc-ice" }, async ({ payload }) => {
      if (!payload || payload.to !== currentUserId) return;
      const pc = ensurePeerConnection(payload.from);
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // ignore
      }
    });

    channel.on("broadcast", { event: "room-chat" }, ({ payload }) => {
      if (!payload) return;
      setChatMessages((prev) => [...prev, payload as RoomChatItem]);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: currentUserId,
          displayName: currentUserName,
          micOn: nextMic,
          camOn: nextCam,
          screenOn: false,
          handRaised: false,
        });
      }
    });

    setJoined(true);
    if (meeting.status === "scheduled" && meeting.organizer_id === currentUserId) {
      onStatusChange(meeting.id, "live");
    }
  }

  function leaveRoom() {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    stopAllMedia();
    setJoined(false);
  }

  async function toggleMic() {
    const next = !micOn;
    if (next) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaNotice(describeMediaError(null, "microphone"));
        return;
      }
      if (!localStreamRef.current) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = s;
          const track = s.getAudioTracks()[0];
          if (track) {
            pcsRef.current.forEach((pc) => pc.addTrack(track, s));
          }
          setMediaNotice(null);
        } catch (err) {
          setMediaNotice(describeMediaError(err, "microphone"));
          return;
        }
      } else {
        const audioTracks = localStreamRef.current.getAudioTracks();
        if (audioTracks.length === 0) {
          try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            const track = s.getAudioTracks()[0];
            if (track) {
              localStreamRef.current.addTrack(track);
              pcsRef.current.forEach((pc) => pc.addTrack(track, localStreamRef.current!));
            }
            setMediaNotice(null);
          } catch (err) {
            setMediaNotice(describeMediaError(err, "microphone"));
            return;
          }
        } else {
          audioTracks.forEach((t) => {
            t.enabled = true;
          });
          setMediaNotice(null);
        }
      }
    } else if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    }
    setMicOn(next);
    stateRef.current = { ...stateRef.current, micOn: next };
    syncPresence();
  }

  async function toggleCamera() {
    const next = !camOn;
    if (next) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaNotice(describeMediaError(null, "camera"));
        return;
      }
      if (!localStreamRef.current) {
        try {
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
          localStreamRef.current = vStream;
          const track = vStream.getVideoTracks()[0];
          if (track) {
            pcsRef.current.forEach((pc) => pc.addTrack(track, vStream));
          }
          setMediaNotice(null);
        } catch (err) {
          setMediaNotice(describeMediaError(err, "camera"));
          return;
        }
      } else {
        const vTracks = localStreamRef.current.getVideoTracks();
        if (vTracks.length === 0) {
          try {
            const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const track = vStream.getVideoTracks()[0];
            if (track) {
              localStreamRef.current.addTrack(track);
              pcsRef.current.forEach((pc) => pc.addTrack(track, localStreamRef.current!));
            }
            setMediaNotice(null);
          } catch (err) {
            setMediaNotice(describeMediaError(err, "camera"));
            return;
          }
        } else {
          vTracks.forEach((t) => {
            t.enabled = true;
          });
          setMediaNotice(null);
        }
      }
    } else if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = false;
      });
    }
    setCamOn(next);
    stateRef.current = { ...stateRef.current, camOn: next };
    syncPresence();
  }

  async function toggleScreenShare() {
    if (screenOn) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setScreenOn(false);
      stateRef.current = { ...stateRef.current, screenOn: false };
      syncPresence();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaNotice("Screen sharing is not supported in this browser.");
      return;
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = display;
      const screenTrack = display.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.onended = () => {
          screenStreamRef.current = null;
          setScreenOn(false);
          stateRef.current = { ...stateRef.current, screenOn: false };
          syncPresence();
        };
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack).catch(() => {});
          } else {
            pc.addTrack(screenTrack, display);
          }
        });
      }
      setScreenOn(true);
      stateRef.current = { ...stateRef.current, screenOn: true };
      syncPresence();
    } catch {
      // User cancelled screen share picker
    }
  }

  function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    stateRef.current = { ...stateRef.current, handRaised: next };
    syncPresence();
  }

  function sendRoomChat(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    const item: RoomChatItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: currentUserId,
      senderName: currentUserName,
      text: trimmed,
      sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setChatMessages((prev) => [...prev, item]);
    setChatDraft("");
    channelRef.current?.send({
      type: "broadcast",
      event: "room-chat",
      payload: item,
    });
  }

  async function copyRoomInvite() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `${meeting.title}\nRoom: ${meeting.room_name} (${meeting.room_code})\nJoin inside OrbitWork: ${origin}/planner/room/${meeting.room_code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // ignore
    }
  }

  const remotePeers = useMemo(
    () => peers.filter((p) => p.userId !== currentUserId),
    [peers, currentUserId]
  );

  const hasCustomExternalUrl =
    Boolean(meeting.meeting_url) &&
    !meeting.meeting_url.includes("meet.jit.si/orbitwork-");

  const localInitials = (currentUserName || "Y")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const roomSection = (
    <section
      className={`planner-live-room${expanded ? " is-expanded" : ""}${
        standalone ? " is-standalone" : ""
      }`}
      aria-label="OrbitWork Meeting Room"
    >
      <div className="planner-card-head">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className={`planner-badge is-${meeting.status}`}>
            {meeting.status === "live" ? <Radio size={12} /> : <DoorOpen size={12} />}
            {meeting.status.toUpperCase()}
          </span>
          <h2 style={{ margin: 0, fontSize: "18px" }}>{meeting.title}</h2>
          <span className="planner-badge is-room">
            {meeting.room_name} · {meeting.room_code}
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Exit expanded view (Esc)" : "Expand room to full screen"}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {expanded ? "Collapse" : "Expand"}
          </button>

          {!standalone && (
            <a
              href={`/planner/room/${encodeURIComponent(meeting.room_code)}`}
              target="_blank"
              rel="noreferrer"
              className="button button-secondary"
              title="Open this meeting room in a dedicated browser tab"
            >
              <ExternalLink size={14} />
              New Tab
            </a>
          )}

          <button
            type="button"
            className="button button-secondary"
            onClick={copyRoomInvite}
          >
            <Copy size={14} />
            {copiedInvite ? "Copied Invite Link" : "Copy Room Link"}
          </button>

          {hasCustomExternalUrl && (
            <a
              href={meeting.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="button button-secondary"
            >
              <ExternalLink size={14} />
              External Link
            </a>
          )}

          {meeting.status === "scheduled" && (
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => onStatusChange(meeting.id, "live")}
            >
              <Play size={14} /> Go Live
            </button>
          )}

          {meeting.status === "live" && (
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                leaveRoom();
                onStatusChange(meeting.id, "completed");
              }}
            >
              <CheckCircle2 size={14} /> End Meeting
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setExpanded(false);
                leaveRoom();
                onClose();
              }}
            >
              <X size={14} /> Close
            </button>
          )}
        </div>
      </div>

      <div className="planner-meeting-meta">
        <span>
          {new Date(meeting.start_time).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          –{" "}
          {new Date(meeting.end_time).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <span>
          <Users size={13} style={{ verticalAlign: "-2px", marginRight: "4px" }} />
          Invited:{" "}
          {meeting.participant_ids
            .map((id) => memberNameById.get(id) ?? "Member")
            .join(", ")}
        </span>
      </div>

      {!joined ? (
        <div className="native-room-lobby">
          <div>
            <strong style={{ fontSize: "15px" }}>
              OrbitWork Native Meeting Room (English · Built-in Audio, Video &amp; Screen Share)
            </strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
              Join directly inside OrbitWork — no external redirects or third-party language barriers.
              {meeting.description ? ` Agenda: ${meeting.description}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => joinRoom(false)}
            >
              <Mic size={15} /> Join Room (Audio)
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => joinRoom(true)}
            >
              <Video size={15} /> Join with Camera
            </button>
          </div>
        </div>
      ) : (
        <div className="native-room-stage-layout">
          <div className="native-room-main-stage">
            {mediaNotice && <div className="native-room-notice">{mediaNotice}</div>}

            <div className="native-room-grid">
              {/* Local User Tile */}
              <div className={`native-room-tile${handRaised ? " is-hand" : ""}`}>
                {camOn || screenOn ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="native-room-video"
                  />
                ) : (
                  <div className="native-room-avatar-stage">
                    <div className="native-room-avatar-circle">{localInitials}</div>
                    <span className="native-room-avatar-hint">
                      {micOn ? "Audio connected" : "Listen & chat mode"}
                    </span>
                  </div>
                )}
                <div className="native-room-tile-bar">
                  <span className="native-room-tile-name">{currentUserName} (You)</span>
                  <span className="native-room-tile-badges">
                    {handRaised && (
                      <span className="native-room-pill is-hand" title="Hand raised">
                        <Hand size={11} />
                      </span>
                    )}
                    <span className={`native-room-pill${micOn ? "" : " is-muted"}`}>
                      {micOn ? <Mic size={11} /> : <MicOff size={11} />}
                    </span>
                  </span>
                </div>
              </div>

              {/* Remote Teammate Tiles */}
              {remotePeers.map((peer) => (
                <RemoteVideoTile
                  key={peer.userId}
                  peer={peer}
                  stream={remoteStreams.get(peer.userId)}
                  isHost={peer.userId === meeting.organizer_id}
                />
              ))}
            </div>

            <div className="native-room-controls">
              <button
                type="button"
                className={`native-ctrl-btn${!micOn ? " is-danger" : ""}`}
                onClick={toggleMic}
              >
                {micOn ? <Mic size={15} /> : <MicOff size={15} />}
                {micOn ? "Mute" : "Unmute"}
              </button>
              <button
                type="button"
                className={`native-ctrl-btn${camOn ? " is-active" : ""}`}
                onClick={toggleCamera}
              >
                {camOn ? <Video size={15} /> : <VideoOff size={15} />}
                {camOn ? "Stop Camera" : "Start Camera"}
              </button>
              <button
                type="button"
                className={`native-ctrl-btn${screenOn ? " is-active" : ""}`}
                onClick={toggleScreenShare}
              >
                <MonitorUp size={15} />
                {screenOn ? "Stop Share" : "Share Screen"}
              </button>
              <button
                type="button"
                className={`native-ctrl-btn${handRaised ? " is-hand" : ""}`}
                onClick={toggleHand}
              >
                <Hand size={15} />
                {handRaised ? "Lower Hand" : "Raise Hand"}
              </button>
              <button
                type="button"
                className={`native-ctrl-btn${chatOpen ? " is-active" : ""}`}
                onClick={() => setChatOpen((v) => !v)}
              >
                <MessageSquare size={15} />
                Room Chat ({chatMessages.length})
              </button>
              <button
                type="button"
                className="native-ctrl-btn is-leave"
                onClick={leaveRoom}
              >
                <PhoneOff size={15} />
                Leave Call
              </button>
            </div>
          </div>

          {chatOpen && (
            <aside className="native-room-chat" aria-label="In-meeting chat">
              <div className="native-room-chat-head">
                <strong>Room Chat</strong>
                <span className="muted" style={{ fontSize: "11.5px" }}>
                  {peers.length || 1} in room
                </span>
              </div>
              <div className="native-room-chat-feed">
                {chatMessages.length === 0 ? (
                  <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
                    Send a quick note or link to teammates in this room.
                  </p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="native-room-chat-msg">
                      <div className="native-room-chat-meta">
                        <strong>{msg.senderName}</strong>
                        <span>{msg.sentAt}</span>
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  ))
                )}
              </div>
              <form className="native-room-chat-form" onSubmit={sendRoomChat}>
                <input
                  className="planner-input"
                  placeholder="Message room..."
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                />
                <button type="submit" className="button button-primary" style={{ padding: "8px 12px" }}>
                  <Send size={14} />
                </button>
              </form>
            </aside>
          )}
        </div>
      )}
    </section>
  );

  if (expanded) {
    return (
      <>
        <div
          className="planner-room-backdrop"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
        {roomSection}
      </>
    );
  }

  return roomSection;
}
