"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Paperclip,
  Smile,
  AtSign,
  Plus,
  Video,
  Mic,
  ThumbsUp,
  MessageSquare,
  Loader2,
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
  const feedEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    // If the character right before cursor is '@', replace it, otherwise append
    let prefix = currentVal.slice(0, start);
    if (prefix.endsWith("@")) {
      prefix = prefix.slice(0, -1);
    }
    const nextVal = `${prefix}@${memberName} ${currentVal.slice(start)}`;
    setBody(nextVal);
    setShowMentionPicker(false);
    setTimeout(() => {
      textarea.focus();
    }, 20);
  };

  // Scroll to bottom on initial load / new comment
  useEffect(() => {
    if (!loading) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, loading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), projectId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => [...prev, data.comment]);
          setBody("");
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

                    <div className="comment-card-body">
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
                  backgroundColor: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  padding: 4,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", padding: "6px 8px 4px", borderBottom: "1px solid #f1f5f9" }}>
                  SELECT TEAM MEMBER TO MENTION
                </div>
                {members.length > 0 ? (
                  members.map((m) => (
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
                        color: "#1e293b",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          backgroundColor: "#059669",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        {m.email && <div style={{ fontSize: 10, color: "#64748b" }}>{m.email}</div>}
                      </div>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "8px", fontSize: 11, color: "#64748b" }}>No members found</div>
                )}
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
                if (val.endsWith("@")) {
                  setShowMentionPicker(true);
                }
              }}
              onKeyDown={handleKeyDown}
              rows={3}
              maxLength={10000}
            />

            <div className="comments-composer-toolbar">
              <div className="composer-tools-left">
                <button
                  type="button"
                  className="composer-tool-btn"
                  title="Add integration / action"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  className="composer-tool-btn"
                  title="Attach file"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.onchange = () => {
                      if (input.files?.[0]) {
                        setBody((prev) => `${prev}\n[Attached: ${input.files![0].name}]`);
                      }
                    };
                    input.click();
                  }}
                >
                  <Paperclip size={14} />
                </button>
                <button
                  type="button"
                  className={`composer-tool-btn${showMentionPicker ? " is-active" : ""}`}
                  title="Mention someone (@)"
                  onClick={() => setShowMentionPicker((v) => !v)}
                >
                  <AtSign size={14} />
                </button>
                <button
                  type="button"
                  className="composer-tool-btn"
                  title="Emoji"
                  onClick={() => setBody((prev) => `${prev}👍`)}
                >
                  <Smile size={14} />
                </button>
                <button type="button" className="composer-tool-btn" title="Record video / Loom">
                  <Video size={14} />
                </button>
                <button type="button" className="composer-tool-btn" title="Voice clip">
                  <Mic size={14} />
                </button>
              </div>

              <div className="composer-tools-right">
                <button
                  type="submit"
                  className="composer-send-btn"
                  disabled={!body.trim() || submitting}
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
