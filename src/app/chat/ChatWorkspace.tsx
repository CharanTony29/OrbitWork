"use client";

import { useState, useEffect, useRef } from "react";
import {
  Hash,
  User,
  Send,
  Smile,
  Paperclip,
  Search,
  MessageSquare,
  Users,
  Loader2,
  Sparkles,
} from "lucide-react";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type ChatMessage = {
  id: string;
  senderId: string;
  recipientId: string | null;
  channel: string;
  message: string;
  createdAt: string;
  senderName: string;
  senderAvatar: string | null;
  isCurrentUser: boolean;
};

const CHANNELS = [
  { id: "general", name: "general", desc: "General workspace discussions" },
  { id: "announcements", name: "announcements", desc: "Company & team wide announcements" },
  { id: "dev-team", name: "dev-team", desc: "Engineering & development updates" },
  { id: "random", name: "random", desc: "Casual banter and sharing" },
];

const EMOJIS = ["👍", "❤️", "🔥", "🎉", "🚀", "😀", "😂", "😊", "👀", "💡", "✅", "⚡"];

export default function ChatWorkspace({
  currentUserId,
  currentUserName,
  teamMembers,
}: {
  currentUserId: string;
  currentUserName: string;
  teamMembers: TeamMember[];
}) {
  const [activeType, setActiveType] = useState<"channel" | "direct">("channel");
  const [activeChannel, setActiveChannel] = useState("general");
  const [activeRecipient, setActiveRecipient] = useState<TeamMember | null>(teamMembers[0] ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch messages
  const fetchMessages = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeType === "channel") {
        params.set("type", "channel");
        params.set("channel", activeChannel);
      } else if (activeRecipient) {
        params.set("type", "direct");
        params.set("recipientId", activeRecipient.id);
      }

      const res = await fetch(`/api/chat/messages?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch (err) {
      console.error("Failed to load chat messages", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeType, activeChannel, activeRecipient?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputVal.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const payload: any = {
        type: activeType,
        message: text,
      };
      if (activeType === "channel") {
        payload.channel = activeChannel;
      } else if (activeRecipient) {
        payload.recipientId = activeRecipient.id;
      }

      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
          setInputVal("");
          inputRef.current?.focus();
        }
      }
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.id !== currentUserId &&
      (m.name.toLowerCase().includes(memberFilter.toLowerCase()) ||
        m.email.toLowerCase().includes(memberFilter.toLowerCase()))
  );

  return (
    <div
      className="chat-workspace-root"
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        height: "calc(100vh - 66px)",
        background: "var(--paper, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Left Chat Rail */}
      <aside
        style={{
          borderRight: "1px solid var(--line, #e2e8f0)",
          background: "var(--sidebar, #fafbf9)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--line, #e2e8f0)" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={17} color="var(--green, #167c58)" />
            <span>Chat &amp; Channels</span>
          </h2>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: 10, color: "var(--muted)" }} />
            <input
              type="text"
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              placeholder="Search team members…"
              style={{
                width: "100%",
                height: 32,
                paddingLeft: 28,
                paddingRight: 10,
                fontSize: 11.5,
                borderRadius: 6,
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--paper, #fff)",
                outline: "none",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>

        {/* Channels Section */}
        <div style={{ padding: "12px 10px 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.8, padding: "0 8px 6px" }}>
            TEAM CHANNELS
          </div>
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                setActiveType("channel");
                setActiveChannel(ch.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                border: 0,
                background: activeType === "channel" && activeChannel === ch.id ? "rgba(22, 124, 88, 0.12)" : "transparent",
                color: activeType === "channel" && activeChannel === ch.id ? "var(--green, #167c58)" : "var(--ink, #334155)",
                fontWeight: activeType === "channel" && activeChannel === ch.id ? 700 : 500,
                fontSize: 12.5,
                cursor: "pointer",
                textAlign: "left",
                marginBottom: 2,
              }}
            >
              <Hash size={14} color={activeType === "channel" && activeChannel === ch.id ? "var(--green, #167c58)" : "var(--muted)"} />
              <span>{ch.name}</span>
            </button>
          ))}
        </div>

        {/* Direct Messages Section */}
        <div style={{ padding: "8px 10px 16px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.8, padding: "0 8px 6px", display: "flex", justifyContent: "space-between" }}>
            <span>DIRECT MESSAGES</span>
            <span style={{ fontSize: 9 }}>{filteredMembers.length}</span>
          </div>
          {filteredMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setActiveType("direct");
                setActiveRecipient(member);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: 0,
                background: activeType === "direct" && activeRecipient?.id === member.id ? "rgba(22, 124, 88, 0.12)" : "transparent",
                color: activeType === "direct" && activeRecipient?.id === member.id ? "var(--green, #167c58)" : "var(--ink, #334155)",
                fontWeight: activeType === "direct" && activeRecipient?.id === member.id ? 700 : 500,
                fontSize: 12.5,
                cursor: "pointer",
                textAlign: "left",
                marginBottom: 2,
              }}
            >
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#167c58",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span
                  style={{
                    position: "absolute",
                    bottom: -1,
                    right: -1,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    border: "1.5px solid #fff",
                  }}
                />
              </div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                <span>{member.name}</span>
              </div>
            </button>
          ))}
          {!filteredMembers.length && (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--muted)" }}>No members found</div>
          )}
        </div>
      </aside>

      {/* Main Conversation Stream */}
      <section style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--paper, #fff)" }}>
        {/* Chat Header */}
        <header
          style={{
            height: 54,
            borderBottom: "1px solid var(--line, #e2e8f0)",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--paper, #fff)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {activeType === "channel" ? (
              <>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--soft, #f1f5f9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Hash size={16} color="var(--green, #167c58)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>#{activeChannel}</h3>
                  <small style={{ fontSize: 11, color: "var(--muted)" }}>
                    {CHANNELS.find((c) => c.id === activeChannel)?.desc}
                  </small>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#167c58", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                  {activeRecipient?.name.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{activeRecipient?.name ?? "Direct Message"}</h3>
                  <small style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Online</small>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Message Stream */}
        <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, gap: 8, color: "var(--muted)" }}>
              <Loader2 size={18} className="animate-spin" />
              <span>Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--muted)", textAlign: "center" }}>
              <MessageSquare size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
              <h4 style={{ margin: "0 0 4px", fontSize: 15, color: "var(--ink)" }}>No messages yet</h4>
              <p style={{ margin: 0, fontSize: 12.5 }}>
                {activeType === "channel"
                  ? `Be the first to post a message in #${activeChannel}!`
                  : `Start a direct conversation with ${activeRecipient?.name}.`}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const d = new Date(msg.createdAt);
              const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignSelf: msg.isCurrentUser ? "flex-end" : "flex-start",
                    maxWidth: "75%",
                  }}
                >
                  {!msg.isCurrentUser && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        backgroundColor: "#167c58",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {msg.senderName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", alignItems: msg.isCurrentUser ? "flex-end" : "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, fontSize: 11, color: "var(--muted)" }}>
                      <span style={{ fontWeight: 600, color: "var(--ink)" }}>{msg.isCurrentUser ? "You" : msg.senderName}</span>
                      <span>{timeStr}</span>
                    </div>

                    <div
                      style={{
                        padding: "9px 14px",
                        borderRadius: 12,
                        borderBottomRightRadius: msg.isCurrentUser ? 2 : 12,
                        borderBottomLeftRadius: msg.isCurrentUser ? 12 : 2,
                        backgroundColor: msg.isCurrentUser ? "var(--green, #167c58)" : "var(--soft, #f1f5f9)",
                        color: msg.isCurrentUser ? "#ffffff" : "var(--ink, #1e293b)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }}
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--line, #e2e8f0)", position: "relative" }}>
          {/* Emoji Popover */}
          {showEmoji && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: 20,
                background: "var(--paper, #fff)",
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: 8,
                padding: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 6,
                zIndex: 100,
              }}
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setInputVal((prev) => `${prev}${emoji}`);
                    setShowEmoji(false);
                    inputRef.current?.focus();
                  }}
                  style={{ border: 0, background: "transparent", fontSize: 18, padding: 4, cursor: "pointer", borderRadius: 4 }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              borderRadius: 10,
              border: "1px solid var(--line, #cbd5e1)",
              background: "var(--paper, #fff)",
              padding: "6px 8px 6px 12px",
            }}
          >
            <textarea
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeType === "channel"
                  ? `Message #${activeChannel} (Press Enter to send)…`
                  : `Direct message ${activeRecipient?.name ?? ""}…`
              }
              rows={1}
              style={{
                flex: 1,
                border: 0,
                outline: "none",
                fontSize: 13,
                resize: "none",
                maxHeight: 120,
                fontFamily: "inherit",
                color: "var(--ink)",
                background: "transparent",
                lineHeight: 1.4,
              }}
            />

            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "4px" }}
              title="Add emoji"
            >
              <Smile size={17} />
            </button>

            <button
              type="submit"
              disabled={!inputVal.trim() || sending}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 0,
                backgroundColor: inputVal.trim() ? "var(--green, #167c58)" : "var(--soft, #f1f5f9)",
                color: inputVal.trim() ? "#fff" : "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputVal.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
              }}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
