"use client";

import { useRef, useState } from "react";
import { createTaskComment } from "@/app/actions";

type MemberOption = {
  id: string;
  label: string;
};

type Props = {
  projectId: string;
  taskId: string;
  members: MemberOption[];
};

export default function TaskCommentForm({ projectId, taskId, members }: Props) {
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const filteredMembers =
    mentionQuery === null
      ? []
      : members
          .filter((m) =>
            m.label.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 6);

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

  const insertMention = (member: MemberOption) => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? body.length;
    const beforeCaret = body.slice(0, caret);
    const afterCaret = body.slice(caret);
    const replaced = beforeCaret.replace(/@([^\s@]{0,40})$/, `@${member.label} `);
    const nextValue = `${replaced}${afterCaret}`;
    setBody(nextValue);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        const pos = replaced.length;
        textarea.setSelectionRange(pos, pos);
      }
    });
  };

  return (
    <form
      ref={formRef}
      action={createTaskComment}
      className="task-comment-form"
      onSubmit={() => {
        // Clear locally right after server action starts
        requestAnimationFrame(() => {
          setBody("");
          setMentionQuery(null);
        });
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <label htmlFor="task-comment">Add a comment</label>
      <div className="task-comment-input-wrap">
        <textarea
          ref={textareaRef}
          id="task-comment"
          name="body"
          value={body}
          onChange={(e) => {
            const val = e.target.value;
            setBody(val);
            detectMention(val, e.target.selectionStart ?? val.length);
          }}
          onKeyUp={(e) => {
            const el = e.currentTarget;
            detectMention(el.value, el.selectionStart ?? el.value.length);
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
                insertMention(filteredMembers[mentionIndex] ?? filteredMembers[0]);
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
              if (body.trim()) {
                formRef.current?.requestSubmit();
              }
            }
          }}
          placeholder="Share an update, type @ to mention a teammate, or press Ctrl+Enter to send…"
          maxLength={10000}
          required
        />

        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="task-mention-popover" role="listbox" aria-label="Mention team member">
            {filteredMembers.map((member, idx) => (
              <button
                key={member.id}
                type="button"
                role="option"
                aria-selected={idx === mentionIndex}
                className={`task-mention-option${idx === mentionIndex ? " is-selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(member);
                }}
              >
                <span className="task-mention-avatar">
                  {member.label.slice(0, 1).toUpperCase()}
                </span>
                <span>{member.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="comment-submit-row">
        <span>
          Type <code>@</code> to mention · Press <code>Ctrl + Enter</code> to post
        </span>
        <button className="button button-primary" type="submit">
          Post comment
        </button>
      </div>
    </form>
  );
}
