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
  PanelLeftClose,
  PanelLeftOpen,
  X,
  FileText,
  Image as ImageIcon,
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [attachedFile, setAttachedFile] = useState<{ name: string; dataUrl: string; isImage: boolean } | null>(null);
  const [recentSnippets, setRecentSnippets] = useState<Record<string, { text: string; time: string; sender: string }>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const msgList: ChatMessage[] = data.messages ?? [];
        setMessages(msgList);

        if (msgList.length > 0) {
          const last = msgList[msgList.length - 1];
          const key = activeType === "channel" ? `ch:${activeChannel}` : `dm:${activeRecipient?.id}`;
          setRecentSnippets((prev) => ({
            ...prev,
            [key]: {
              text: last.message,
              sender: last.isCurrentUser ? "You" : last.senderName,
              time: new Date(last.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            },
          }));
        }
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be 5 MB or smaller for direct chat attachment.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setAttachedFile({
        name: file.name,
        dataUrl: result,
        isImage: file.type.startsWith("image/"),
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputVal.trim();
    if ((!text && !attachedFile) || sending) return;

    setSending(true);
    try {
      let finalMessage = text;
      if (attachedFile) {
        if (attachedFile.isImage) {
          finalMessage = finalMessage
            ? `${finalMessage}\n\n![${attachedFile.name}](${attachedFile.dataUrl})`
            : `![${attachedFile.name}](${attachedFile.dataUrl})`;
        } else {
          finalMessage = finalMessage
            ? `${finalMessage}\n\n📎 [${attachedFile.name}](${attachedFile.dataUrl})`
            : `📎 [${attachedFile.name}](${attachedFile.dataUrl})`;
        }
      }

      const payload: any = {
        type: activeType,
        message: finalMessage,
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
          setAttachedFile(null);
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
        gridTemplateColumns: isSidebarOpen ? "270px 1fr" : "1fr",
        height: "calc(100vh - 66px)",
        background: "var(--paper, #fff)",
        overflow: "hidden",
        transition: "grid-template-columns 0.2s ease",
      }}
    >
      {/* Left Chat Rail */}
      {isSidebarOpen && (
        <aside
          style={{
            borderRight: "1px solid var(--line, #e2e8f0)",
            background: "var(--sidebar, #fafbf9)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--line, #e2e8f0)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                <MessageSquare size={16} color="var(--green, #167c58)" />
                <span>Chat &amp; Channels</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                title="Hide sidebar"
                style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 3 }}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "var(--muted)" }} />
              <input
                type="text"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                placeholder="Search team members…"
                style={{
                  width: "100%",
                  height: 30,
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
          <div style={{ padding: "10px 10px 6px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.8, padding: "0 8px 5px" }}>
              TEAM CHANNELS
            </div>
            {CHANNELS.map((ch) => {
              const snippet = recentSnippets[`ch:${ch.id}`];
              const isSelected = activeType === "channel" && activeChannel === ch.id;

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setActiveType("channel");
                    setActiveChannel(ch.id);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    padding: "6px 9px",
                    borderRadius: 6,
                    border: 0,
                    background: isSelected ? "rgba(22, 124, 88, 0.12)" : "transparent",
                    color: isSelected ? "var(--green, #167c58)" : "var(--ink, #334155)",
                    cursor: "pointer",
                    textAlign: "left",
                    marginBottom: 2,
                    gap: 2,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
                    <Hash size={13} color={isSelected ? "var(--green, #167c58)" : "var(--muted)"} />
                    <span style={{ fontWeight: isSelected ? 700 : 600, fontSize: 12 }}>{ch.name}</span>
                  </div>
                  {snippet && (
                    <div style={{ fontSize: 10, color: "var(--muted)", paddingLeft: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                      {snippet.sender}: {snippet.text.replace(/!\[.*?\]\(.*?\)/g, "[Image]")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Direct Messages Section */}
          <div style={{ padding: "6px 10px 16px", flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.8, padding: "0 8px 5px", display: "flex", justifyContent: "space-between" }}>
              <span>DIRECT MESSAGES</span>
              <span style={{ fontSize: 9 }}>{filteredMembers.length}</span>
            </div>
            {filteredMembers.map((member) => {
              const isSelected = activeType === "direct" && activeRecipient?.id === member.id;
              const snippet = recentSnippets[`dm:${member.id}`];

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setActiveType("direct");
                    setActiveRecipient(member);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    padding: "6px 9px",
                    borderRadius: 6,
                    border: 0,
                    background: isSelected ? "rgba(22, 124, 88, 0.12)" : "transparent",
                    color: isSelected ? "var(--green, #167c58)" : "var(--ink, #334155)",
                    cursor: "pointer",
                    textAlign: "left",
                    marginBottom: 2,
                    gap: 2,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundColor: "#167c58",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {member.name}
                    </span>
                  </div>
                  {snippet && (
                    <div style={{ fontSize: 10, color: "var(--muted)", paddingLeft: 30, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                      {snippet.text.replace(/!\[.*?\]\(.*?\)/g, "[Image]")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* Main Conversation Pane */}
      <section style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Pane Top Header */}
        <header
          style={{
            height: 48,
            padding: "0 18px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--paper, #fff)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                title="Show sidebar"
                style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "4px 8px 4px 0", display: "flex", alignItems: "center" }}
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            {activeType === "channel" ? (
              <>
                <Hash size={16} color="var(--green, #167c58)" />
                <strong style={{ fontSize: 14, color: "var(--ink)" }}>#{activeChannel}</strong>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                  {CHANNELS.find((c) => c.id === activeChannel)?.desc}
                </span>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#167c58",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {activeRecipient?.name.charAt(0).toUpperCase()}
                </div>
                <strong style={{ fontSize: 14, color: "var(--ink)" }}>{activeRecipient?.name}</strong>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>{activeRecipient?.email}</span>
              </>
            )}
          </div>
        </header>

        {/* Message Stream */}
        <div style={{ flex: 1, padding: "14px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
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

              // Check if message has image markdown
              const imgMatch = msg.message.match(/!\[(.*?)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/);
              const cleanText = msg.message.replace(/!\[(.*?)\]\((.*?)\)/g, "").replace(/📎 \[(.*?)\]\((.*?)\)/g, "").trim();

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    gap: 9,
                    alignSelf: msg.isCurrentUser ? "flex-end" : "flex-start",
                    maxWidth: "75%",
                  }}
                >
                  {!msg.isCurrentUser && (
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        backgroundColor: "#167c58",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {msg.senderName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", alignItems: msg.isCurrentUser ? "flex-end" : "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, fontSize: 10.5, color: "var(--muted)" }}>
                      <span style={{ fontWeight: 600, color: "var(--ink)" }}>{msg.isCurrentUser ? "You" : msg.senderName}</span>
                      <span>{timeStr}</span>
                    </div>

                    <div
                      style={{
                        padding: "7px 12px",
                        borderRadius: 10,
                        borderBottomRightRadius: msg.isCurrentUser ? 2 : 10,
                        borderBottomLeftRadius: msg.isCurrentUser ? 10 : 2,
                        backgroundColor: msg.isCurrentUser ? "var(--green, #167c58)" : "var(--soft, #f1f5f9)",
                        color: msg.isCurrentUser ? "#ffffff" : "var(--ink, #1e293b)",
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                    >
                      {cleanText && <div>{cleanText}</div>}
                      {imgMatch && (
                        <div style={{ marginTop: cleanText ? 6 : 0, borderRadius: 6, overflow: "hidden" }}>
                          <img
                            src={imgMatch[2]}
                            alt={imgMatch[1] || "Attachment"}
                            style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 6, display: "block" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer (clean, reduced padding) */}
        <div style={{ padding: "6px 16px 10px", borderTop: "1px solid var(--line, #e2e8f0)", position: "relative" }}>
          {/* Emoji Popover (Anchored to the right) */}
          {showEmoji && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                right: 50,
                background: "var(--paper, #fff)",
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: 8,
                padding: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 5,
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
                  style={{ border: 0, background: "transparent", fontSize: 17, padding: 3, cursor: "pointer", borderRadius: 4 }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* Pending attachment preview */}
          {attachedFile && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                marginBottom: 6,
                borderRadius: 6,
                background: "var(--soft, #f1f5f9)",
                border: "1px solid var(--line, #cbd5e1)",
                fontSize: 11,
              }}
            >
              {attachedFile.isImage ? <ImageIcon size={13} color="#167c58" /> : <FileText size={13} color="#167c58" />}
              <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {attachedFile.name}
              </span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)", padding: 1 }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 8,
              border: "1px solid var(--line, #cbd5e1)",
              background: "var(--paper, #fff)",
              padding: "4px 8px 4px 10px",
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
                fontSize: 12.5,
                resize: "none",
                maxHeight: 100,
                fontFamily: "inherit",
                color: "var(--ink)",
                background: "transparent",
                lineHeight: 1.4,
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "4px" }}
              title="Attach an image or document"
            >
              <Paperclip size={16} />
            </button>

            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", padding: "4px" }}
              title="Add emoji"
            >
              <Smile size={16} />
            </button>

            <button
              type="submit"
              disabled={(!inputVal.trim() && !attachedFile) || sending}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 0,
                backgroundColor: inputVal.trim() || attachedFile ? "var(--green, #167c58)" : "var(--soft, #f1f5f9)",
                color: inputVal.trim() || attachedFile ? "#fff" : "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputVal.trim() || attachedFile ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
              }}
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
