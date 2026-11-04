"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Paperclip,
  Smile,
  AtSign,
  ThumbsUp,
  MessageSquare,
  Loader2,
  FileText,
} from "lucide-react";

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
};

const COMMON_EMOJIS = [
  "👍", "❤️", "🔥", "🎉", "🚀", "😀", "😂", "😊",
  "🙌", "👏", "👀", "💡", "✅", "❌", "⚡", "🎯"
];

export default function TaskCommentsModal({
  taskId,
  taskKey,
  taskTitle,
  projectId,
  onClose,
  onCommentAdded,
}: {
  taskId: string;
  taskKey: string;
  taskTitle: string;
  projectId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"comment" | "email">("comment");
  const [reactions, setReactions] = useState<Record<string, { thumbs: number; smile: number }>>({});
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const feedEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch comments
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/tasks/${taskId}/comments`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setComments(data.comments ?? []);
          }
        }
      } catch (err) {
        console.error("Failed to load comments", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [taskId]);

  // Fetch project members for mentions
  useEffect(() => {
    let ignore = false;
    async function loadMembers() {
      try {
        const res = await fetch(`/api/projects/${projectId}/members`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.members) {
            setMembers(data.members);
          }
        }
      } catch (err) {
        console.error("Failed to load project members", err);
      }
    }
    loadMembers();
    return () => {
      ignore = true;
    };
  }, [projectId]);

  const insertMention = (memberName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((prev) => `${prev}@${memberName} `);
      setShowMentionPicker(false);
      return;
    }
    const start = textarea.selectionStart;
    const currentVal = textarea.value;
    const lastAtIndex = currentVal.lastIndexOf("@", start);
    let nextVal = "";
    if (lastAtIndex !== -1) {
      nextVal = `${currentVal.slice(0, lastAtIndex)}@${memberName} ${currentVal.slice(start)}`;
    } else {
      nextVal = `${currentVal}@${memberName} `;
    }
    setBody(nextVal);
    setShowMentionPicker(false);
    setMentionFilter("");
    setTimeout(() => {
      textarea.focus();
    }, 20);
  };

  const insertEmoji = (emoji: string) => {
    setBody((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...selected]);
    }
    e.target.value = "";
  };

  const removeAttachedFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Scroll to bottom on initial load / new comment
  useEffect(() => {
    if (!loading) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, loading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!body.trim() && attachedFiles.length === 0) || submitting) return;

    setSubmitting(true);
    try {
      let finalBody = body.trim();
      if (attachedFiles.length > 0) {
        const attachmentNotes = attachedFiles.map((f) => `📎 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("\n");
        finalBody = finalBody ? `${finalBody}\n\n${attachmentNotes}` : attachmentNotes;
      }

      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: finalBody, projectId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => [...prev, data.comment]);
          setBody("");
          setAttachedFiles([]);
          onCommentAdded?.();
          textareaRef.current?.focus();
        }
      }
    } catch (err) {
      console.error("Failed to post comment", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleReaction = (commentId: string, type: "thumbs" | "smile") => {
    setReactions((prev) => {
      const current = prev[commentId] ?? { thumbs: 0, smile: 0 };
      return {
        ...prev,
        [commentId]: {
          ...current,
          [type]: current[type] > 0 ? 0 : 1,
        },
      };
    });
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      !mentionFilter ||
      m.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
      m.email.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  return (
    <div className="comments-modal-backdrop" onClick={onClose}>
      <div
        className="comments-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Comments for ${taskTitle}`}
      >
        {/* Header */}
        <div className="comments-modal-header">
          <div className="comments-header-info">
            <span className="comments-task-key">{taskKey}</span>
            <h3 className="comments-task-title">{taskTitle}</h3>
          </div>
          <button
            type="button"
            className="comments-close-btn"
            onClick={onClose}
            aria-label="Close comments"
          >
            <X size={16} />
          </button>
        </div>

        {/* Comments Feed */}
        <div className="comments-modal-body">
          {loading ? (
            <div className="comments-loading">
              <Loader2 size={20} className="animate-spin text-muted" />
              <span>Loading discussion…</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="comments-empty-state">
              <MessageSquare size={28} className="empty-icon" />
              <p>No comments yet on this task.</p>
              <small>Share an update, ask a question, or leave context for your team.</small>
            </div>
          ) : (
            <div className="comments-list">
              {comments.map((comment) => {
                const rx = reactions[comment.id] ?? { thumbs: 0, smile: 0 };
                return (
                  <div key={comment.id} className="comments-thread-card">
                    <div className="comment-card-top">
                      <div className="comment-user-avatar">
                        {comment.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={comment.avatarUrl} alt={comment.authorName} />
                        ) : (
                          <span>{comment.authorName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="comment-meta">
                        <span className="comment-author-name">{comment.authorName}</span>
                        <time className="comment-timestamp">{formatDate(comment.createdAt)}</time>
                      </div>
                    </div>

                    <div className="comment-card-body" style={{ whiteSpace: "pre-wrap" }}>
                      <p>{comment.body}</p>
                    </div>

                    <div className="comment-card-actions">
                      <button
                        type="button"
                        className={`reaction-btn${rx.thumbs ? " is-active" : ""}`}
                        onClick={() => toggleReaction(comment.id, "thumbs")}
                        title="Like"
                      >
                        <ThumbsUp size={12} />
                        {rx.thumbs > 0 && <span className="rx-count">1</span>}
                      </button>
                      <button
                        type="button"
                        className={`reaction-btn${rx.smile ? " is-active" : ""}`}
                        onClick={() => toggleReaction(comment.id, "smile")}
                        title="React"
                      >
                        <Smile size={12} />
                        {rx.smile > 0 && <span className="rx-count">1</span>}
                      </button>
                      <button
                        type="button"
                        className="comment-reply-btn"
                        onClick={() => {
                          setBody(`@${comment.authorName} `);
                          textareaRef.current?.focus();
                        }}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                );
              })}
              <div ref={feedEndRef} />
            </div>
          )}
        </div>

        {/* Input Box (ClickUp style) */}
        <div className="comments-composer-container">
          <div className="comments-composer-tabs">
            <button
              type="button"
              className={`composer-tab${activeTab === "comment" ? " is-active" : ""}`}
              onClick={() => setActiveTab("comment")}
            >
              Comment
            </button>
            <button
              type="button"
              className={`composer-tab${activeTab === "email" ? " is-active" : ""}`}
              onClick={() => setActiveTab("email")}
            >
              Email
            </button>
          </div>

          <form onSubmit={handleSubmit} className="comments-composer-box" style={{ position: "relative" }}>
            {/* Mention Picker Popover */}
            {showMentionPicker && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 12,
                  zIndex: 200,
                  width: 260,
                  maxHeight: 200,
                  overflowY: "auto",
                  backgroundColor: "var(--paper, #ffffff)",
                  borderRadius: 8,
                  border: "1px solid var(--line, #e2e8f0)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  padding: 4,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", padding: "6px 8px 4px", borderBottom: "1px solid var(--line, #f1f5f9)" }}>
                  MENTION TEAM MEMBER
                </div>
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => insertMention(m.name)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "6px 8px",
                        border: 0,
                        borderRadius: 6,
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--soft, #f1f5f9)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          backgroundColor: "#167c58",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        {m.email && <div style={{ fontSize: 10, color: "var(--muted)" }}>{m.email}</div>}
                      </div>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "8px", fontSize: 11, color: "var(--muted)" }}>No members found</div>
                )}
              </div>
            )}

            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 60,
                  zIndex: 200,
                  width: 220,
                  backgroundColor: "var(--paper, #ffffff)",
                  borderRadius: 8,
                  border: "1px solid var(--line, #e2e8f0)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  padding: 8,
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                }}
              >
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    style={{
                      border: 0,
                      background: "transparent",
                      fontSize: 18,
                      padding: 6,
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--soft, #f1f5f9)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px 0" }}>
                {attachedFiles.map((file, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "var(--soft, #f1f5f9)",
                      fontSize: 11,
                      color: "var(--ink)",
                      border: "1px solid var(--line, #e2e8f0)",
                    }}
                  >
                    <FileText size={12} color="var(--green, #167c58)" />
                    <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachedFile(idx)}
                      style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0, color: "var(--muted)" }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="comments-textarea"
              placeholder="Comment or type '@' to mention team members…"
              value={body}
              onChange={(e) => {
                const val = e.target.value;
                setBody(val);
                const lastAt = val.lastIndexOf("@");
                if (lastAt !== -1 && lastAt >= val.length - 20) {
                  setShowMentionPicker(true);
                  setMentionFilter(val.slice(lastAt + 1));
                } else {
                  setShowMentionPicker(false);
                }
              }}
              onKeyDown={handleKeyDown}
              rows={3}
              maxLength={10000}
            />

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileSelect}
              multiple
            />

            <div className="comments-composer-toolbar">
              <div className="composer-tools-left">
                {/* Paperclip (Attachments) */}
                <button
                  type="button"
                  className={`composer-tool-btn${attachedFiles.length ? " is-active" : ""}`}
                  title="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={14} />
                </button>

                {/* AtSign (Mentions) */}
                <button
                  type="button"
                  className={`composer-tool-btn${showMentionPicker ? " is-active" : ""}`}
                  title="Mention someone (@)"
                  onClick={() => {
                    setShowMentionPicker((v) => !v);
                    setShowEmojiPicker(false);
                  }}
                >
                  <AtSign size={14} />
                </button>

                {/* Smile (Emojis) */}
                <button
                  type="button"
                  className={`composer-tool-btn${showEmojiPicker ? " is-active" : ""}`}
                  title="Emoji picker"
                  onClick={() => {
                    setShowEmojiPicker((v) => !v);
                    setShowMentionPicker(false);
                  }}
                >
                  <Smile size={14} />
                </button>
              </div>

              <div className="composer-tools-right">
                <button
                  type="submit"
                  className="composer-send-btn"
                  disabled={(!body.trim() && !attachedFiles.length) || submitting}
                  title="Send (Ctrl+Enter)"
                >
                  {submitting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
