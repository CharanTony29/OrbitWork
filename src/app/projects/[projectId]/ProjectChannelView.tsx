"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  Download,
  FileText,
  GitBranch,
  ImagePlus,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";

type ChannelMember = {
  id: string;
  label: string;
  email: string;
  avatarUrl: string | null;
};

type ChannelDocumentRef = {
  id: string;
  title: string;
  rawTitle: string;
  kind: "document" | "flowchart" | "whiteboard";
  href: string;
};

type ChannelFile = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  url: string;
};

type ChannelPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isMine: boolean;
  body: string;
  mentionedUserIds: string[];
  files: ChannelFile[];
  sharedDocs: ChannelDocumentRef[];
  createdAt: string;
};

type Props = {
  projectId: string;
  projectName: string;
};

function formatFileSize(bytes: number) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMessageWithMentions(text: string, members: ChannelMember[]) {
  if (!text) return null;
  const knownNames = members
    .map((m) => m.label)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (knownNames.length === 0) return text;
  const pattern = new RegExp(`(@(?:${knownNames.join("|")}|[^\\s@]+))`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span className="channel-mention-chip" key={idx}>
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function ProjectChannelView({ projectId, projectName }: Props) {
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [documents, setDocuments] = useState<ChannelDocumentRef[]>([]);
  const [posts, setPosts] = useState<ChannelPost[]>([]);

  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<ChannelFile[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<ChannelDocumentRef[]>([]);
  const [explicitMentionIds, setExplicitMentionIds] = useState<string[]>([]);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const loadChannel = useCallback(
    async (scrollToBottom = false) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/channel`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load channel");
        setMigrationMissing(Boolean(data.migrationMissing));
        setCanManage(Boolean(data.canManage));
        setMembers(data.members ?? []);
        setDocuments(data.documents ?? []);
        setPosts(data.posts ?? []);
        if (scrollToBottom) {
          requestAnimationFrame(() =>
            feedEndRef.current?.scrollIntoView({ behavior: "smooth" })
          );
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Could not load channel data."
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadChannel(true);
    const poll = setInterval(() => void loadChannel(false), 10000);
    return () => clearInterval(poll);
  }, [loadChannel]);

  const filteredMembers =
    mentionQuery === null
      ? []
      : members
          .filter(
            (m) =>
              m.label.toLowerCase().includes(mentionQuery.toLowerCase()) ||
              m.email.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 7);

  const detectMention = (text: string, caret: number) => {
    const beforeCaret = text.slice(0, caret);
    const match = /(?:^|\s)@([^\s@]{0,40})$/.exec(beforeCaret);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMemberMention = (member: ChannelMember) => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? body.length;
    const beforeCaret = body.slice(0, caret);
    const afterCaret = body.slice(caret);
    const replaced = /@([^\s@]{0,40})$/.test(beforeCaret)
      ? beforeCaret.replace(/@([^\s@]{0,40})$/, `@${member.label} `)
      : `${beforeCaret}${beforeCaret && !beforeCaret.endsWith(" ") ? " " : ""}@${member.label} `;
    setBody(`${replaced}${afterCaret}`);
    setExplicitMentionIds((prev) =>
      prev.includes(member.id) ? prev : [...prev, member.id]
    );
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(replaced.length, replaced.length);
      }
    });
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/projects/${projectId}/channel/files`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok || !data.file) {
          throw new Error(data.error ?? "Upload failed");
        }
        setPendingFiles((prev) => [...prev, data.file as ChannelFile]);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not upload attachment."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (
      posting ||
      (!body.trim() && pendingFiles.length === 0 && selectedDocs.length === 0)
    ) {
      return;
    }

    setPosting(true);
    setErrorMsg(null);
    setStatusBanner(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          attachmentIds: pendingFiles.map((f) => f.id),
          referencedDocumentIds: selectedDocs.map((d) => d.id),
          explicitMentionIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to post message");
      }
      setBody("");
      setPendingFiles([]);
      setSelectedDocs([]);
      setExplicitMentionIds([]);
      setMentionQuery(null);
      if (data.alertedCount > 0) {
        setStatusBanner(
          `Posted to channel and alerted ${data.alertedCount} mentioned teammate${
            data.alertedCount === 1 ? "" : "s"
          }.`
        );
      }
      await loadChannel(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not send post.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/channel?postId=${encodeURIComponent(postId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      // Ignore transient delete error
    }
  };

  return (
    <section className="channel-shell" aria-label="Project team channel">
      <div className="channel-main">
        <header className="channel-header">
          <div>
            <p className="eyebrow">TEAM UPDATES &amp; RESOURCES</p>
            <h2>
              <MessageSquare size={17} /> #{projectName} Channel
            </h2>
          </div>
          <span className="channel-member-pill">
            <Users size={13} /> {members.length} team member
            {members.length === 1 ? "" : "s"} included automatically
          </span>
        </header>

        {migrationMissing && (
          <div className="error banner-error" style={{ margin: "12px 16px" }}>
            Run Supabase migration <code>202611110002_preferences_channels_and_holidays.sql</code> to enable project channel storage.
          </div>
        )}

        <div className="channel-feed">
          {loading ? (
            <div className="channel-empty">
              <Loader2 size={20} className="spin" /> Loading project channel…
            </div>
          ) : posts.length === 0 ? (
            <div className="channel-empty">
              <MessageSquare size={26} style={{ opacity: 0.45 }} />
              <strong>No announcements yet in #{projectName}</strong>
              <small>
                Share important project updates, screenshots, files, flowcharts, and docs. Every team member has access automatically — use{" "}
                <code>@name</code> to send instant alerts.
              </small>
            </div>
          ) : (
            posts.map((post) => {
              const images = post.files.filter((f) =>
                f.mime_type.startsWith("image/")
              );
              const otherFiles = post.files.filter(
                (f) => !f.mime_type.startsWith("image/")
              );
              return (
                <article className="channel-post-card" key={post.id}>
                  <div className="channel-post-avatar">
                    {post.authorAvatarUrl ? (
                      <img src={post.authorAvatarUrl} alt={post.authorName} />
                    ) : (
                      <span>{post.authorName.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="channel-post-body">
                    <div className="channel-post-meta">
                      <strong>{post.authorName}</strong>
                      <time>
                        {new Date(post.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      {(post.isMine || canManage) && (
                        <button
                          type="button"
                          className="channel-post-delete"
                          title="Delete post"
                          aria-label="Delete post"
                          onClick={() => void handleDeletePost(post.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {post.body && (
                      <div className="channel-post-text">
                        {renderMessageWithMentions(post.body, members)}
                      </div>
                    )}

                    {images.length > 0 && (
                      <div className="channel-post-images">
                        {images.map((img) => (
                          <a
                            key={img.id}
                            href={img.url}
                            target="_blank"
                            rel="noreferrer"
                            className="channel-image-link"
                          >
                            <img src={img.url} alt={img.file_name} />
                          </a>
                        ))}
                      </div>
                    )}

                    {otherFiles.length > 0 && (
                      <div className="channel-post-files">
                        {otherFiles.map((file) => (
                          <a
                            key={file.id}
                            href={`${file.url}?download=1`}
                            className="channel-file-chip"
                          >
                            <Paperclip size={13} />
                            <span>{file.file_name}</span>
                            <small>{formatFileSize(file.file_size_bytes)}</small>
                            <Download size={12} />
                          </a>
                        ))}
                      </div>
                    )}

                    {post.sharedDocs.length > 0 && (
                      <div className="channel-post-docs">
                        {post.sharedDocs.map((doc) => (
                          <Link
                            key={doc.id}
                            href={doc.href}
                            className="channel-doc-card"
                          >
                            {doc.kind === "flowchart" ? (
                              <GitBranch size={15} />
                            ) : (
                              <FileText size={15} />
                            )}
                            <div>
                              <strong>{doc.title}</strong>
                              <small>
                                Shared{" "}
                                {doc.kind === "flowchart"
                                  ? "Flowchart"
                                  : doc.kind === "whiteboard"
                                    ? "Whiteboard"
                                    : "Document"}{" "}
                                · Click to open
                              </small>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
          <div ref={feedEndRef} />
        </div>

        <form className="channel-composer" onSubmit={handleSend}>
          {(pendingFiles.length > 0 || selectedDocs.length > 0) && (
            <div className="channel-composer-staged">
              {pendingFiles.map((file) => (
                <span className="channel-staged-chip" key={file.id}>
                  {file.mime_type.startsWith("image/") ? (
                    <ImagePlus size={12} />
                  ) : (
                    <Paperclip size={12} />
                  )}
                  <span>{file.file_name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.file_name}`}
                    onClick={() =>
                      setPendingFiles((prev) =>
                        prev.filter((f) => f.id !== file.id)
                      )
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {selectedDocs.map((doc) => (
                <span className="channel-staged-chip is-doc" key={doc.id}>
                  {doc.kind === "flowchart" ? (
                    <GitBranch size={12} />
                  ) : (
                    <FileText size={12} />
                  )}
                  <span>{doc.title}</span>
                  <button
                    type="button"
                    aria-label={`Unlink ${doc.title}`}
                    onClick={() =>
                      setSelectedDocs((prev) =>
                        prev.filter((d) => d.id !== doc.id)
                      )
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="channel-composer-input-wrap">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => {
                const nextVal = e.target.value;
                setBody(nextVal);
                detectMention(nextVal, e.target.selectionStart ?? nextVal.length);
              }}
              onKeyDown={(e) => {
                if (mentionQuery !== null && filteredMembers.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((i) => (i + 1) % filteredMembers.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex(
                      (i) => (i - 1 + filteredMembers.length) % filteredMembers.length
                    );
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    insertMemberMention(
                      filteredMembers[mentionIndex] ?? filteredMembers[0]
                    );
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMentionQuery(null);
                    return;
                  }
                }

                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files ?? []);
                if (files.length > 0) {
                  e.preventDefault();
                  void uploadFiles(files);
                }
              }}
              placeholder="Post an important message, paste screenshots, or type @ to mention & alert teammates…"
              rows={2}
              maxLength={20000}
            />

            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div
                className="task-mention-popover channel-mention-popover"
                role="listbox"
                aria-label="Mention project member"
              >
                {filteredMembers.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={idx === mentionIndex}
                    className={`task-mention-option${
                      idx === mentionIndex ? " is-selected" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMemberMention(m);
                    }}
                  >
                    <span className="task-mention-avatar">
                      {m.label.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="channel-composer-actions">
            <div className="channel-composer-tools">
              <button
                type="button"
                className="channel-tool-btn"
                disabled={uploading}
                onClick={() => imageInputRef.current?.click()}
                title="Upload image"
              >
                {uploading ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <ImagePlus size={14} />
                )}
                <span>Image</span>
              </button>
              <button
                type="button"
                className="channel-tool-btn"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                title="Attach document or file"
              >
                <Paperclip size={14} />
                <span>Attachment</span>
              </button>

              <div className="channel-doc-picker-wrap">
                <button
                  type="button"
                  className="channel-tool-btn"
                  onClick={() => setDocPickerOpen((o) => !o)}
                  title="Share a project document or flowchart"
                >
                  <GitBranch size={14} />
                  <span>Doc / Flowchart</span>
                </button>
                {docPickerOpen && (
                  <div className="channel-doc-picker-menu">
                    {documents.length === 0 ? (
                      <div className="channel-doc-picker-empty">
                        No documents or flowcharts in this project yet.
                      </div>
                    ) : (
                      documents.map((doc) => {
                        const already = selectedDocs.some((d) => d.id === doc.id);
                        return (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => {
                              setSelectedDocs((prev) =>
                                already
                                  ? prev.filter((d) => d.id !== doc.id)
                                  : [...prev, doc]
                              );
                              setDocPickerOpen(false);
                            }}
                          >
                            {doc.kind === "flowchart" ? (
                              <GitBranch size={13} />
                            ) : (
                              <FileText size={13} />
                            )}
                            <span>{doc.title}</span>
                            <small>{doc.kind}</small>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="channel-tool-btn"
                onClick={() => {
                  const ta = textareaRef.current;
                  const val = body;
                  const caret = ta?.selectionStart ?? val.length;
                  const next = `${val.slice(0, caret)}@${val.slice(caret)}`;
                  setBody(next);
                  setMentionQuery("");
                  requestAnimationFrame(() => {
                    if (ta) {
                      ta.focus();
                      ta.setSelectionRange(caret + 1, caret + 1);
                    }
                  });
                }}
                title="Mention & alert a teammate"
              >
                <AtSign size={14} />
                <span>Mention</span>
              </button>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) void uploadFiles(files);
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) void uploadFiles(files);
                }}
              />
            </div>

            <button
              type="submit"
              className="button button-primary"
              disabled={
                posting ||
                uploading ||
                (!body.trim() &&
                  pendingFiles.length === 0 &&
                  selectedDocs.length === 0)
              }
            >
              {posting ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Post update</span>
            </button>
          </div>

          {statusBanner && (
            <p className="notice" style={{ margin: "6px 0 0", fontSize: 12 }}>
              {statusBanner}
            </p>
          )}
          {errorMsg && (
            <p className="error" style={{ margin: "6px 0 0", fontSize: 12 }}>
              {errorMsg}
            </p>
          )}
        </form>
      </div>

      <aside className="channel-roster" aria-label="Channel members">
        <header>
          <p className="eyebrow">TEAM ROSTER</p>
          <h3>In this channel ({members.length})</h3>
          <small>All project teammates join automatically when added.</small>
        </header>
        <div className="channel-roster-list">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              className="channel-roster-item"
              title={`Click to mention @${member.label}`}
              onClick={() => insertMemberMention(member)}
            >
              <span className="channel-roster-avatar">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.label} />
                ) : (
                  member.label.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="channel-roster-meta">
                <strong>{member.label}</strong>
                {member.email && <small>{member.email}</small>}
              </span>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
