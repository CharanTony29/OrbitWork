"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  Loader2,
  Trash2,
  Bot,
  User,
  Copy,
  Check,
  ArrowRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { markdownToSafeHtml } from "@/lib/markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatDrawerProps {
  context?: {
    workspaceName?: string;
    projectTitle?: string;
    taskTitle?: string;
    taskDescription?: string;
    pageTitle?: string;
  };
}

const SUGGESTED_PROMPTS = [
  "💡 Brainstorm solution approach for this",
  "📋 Break this down into actionable steps",
  "⚠️ What are the potential risks or blockers?",
  "✉️ Draft a concise progress update for the team",
];

export default function AIChatDrawer({ context }: AIChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      textareaRef.current?.focus();
    }
  }, [isOpen, messages]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };

    const assistantMessageId = `assistant-${Date.now()}`;
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to connect to AI assistant");
      }

      if (!response.body) throw new Error("No response stream available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulated }
              : msg
          )
        );
      }

      if (!accumulated.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "Daily free AI limit reached across all providers. Please try again tomorrow.",
                }
              : msg
          )
        );
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const errMsg = err instanceof Error ? err.message : "Chat request failed";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `⚠️ **Error:** ${errMsg}. Please try again.` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleClear = () => {
    if (confirm("Clear this conversation history?")) {
      setMessages([]);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        className={`ai-chat-fab ${isOpen ? "is-hidden" : ""}`}
        onClick={() => setIsOpen(true)}
        title="Open AI Assistant"
        aria-label="Open AI Assistant"
      >
        <Sparkles size={16} className="ai-fab-sparkle" />
        <span className="ai-fab-text">AI Assistant</span>
      </button>

      {/* Slide-in Drawer */}
      <div className={`ai-chat-drawer ${isOpen ? "is-open" : ""} ${isExpanded ? "is-expanded" : ""}`}>
        {/* Drawer Header */}
        <div className="ai-chat-header">
          <div className="ai-header-left">
            <div className="ai-avatar-icon">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="ai-header-title">
                Orbitwork AI
                <span className="ai-status-pill">Active</span>
              </div>
              <div className="ai-header-sub">
                Multi-AI Free &bull; Low Token
              </div>
            </div>
          </div>

          <div className="ai-header-actions">
            {messages.length > 0 && (
              <button
                type="button"
                className="ai-icon-btn"
                title="Clear conversation"
                onClick={handleClear}
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              type="button"
              className="ai-icon-btn"
              title={isExpanded ? "Collapse" : "Expand"}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              className="ai-icon-btn is-close"
              title="Close drawer"
              onClick={() => setIsOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Current Context Pill (if open in specific task or project) */}
        {(context?.taskTitle || context?.projectTitle) && (
          <div className="ai-chat-context-banner">
            <span className="ai-context-tag">Context</span>
            <span className="ai-context-name">
              {context.taskTitle ? `Task: ${context.taskTitle}` : `Project: ${context.projectTitle}`}
            </span>
          </div>
        )}

        {/* Message Stream */}
        <div className="ai-chat-messages">
          {messages.length === 0 ? (
            <div className="ai-chat-empty-state">
              <div className="ai-empty-icon-wrap">
                <Bot size={28} />
              </div>
              <h3>How can I help you today?</h3>
              <p>Ask anything about this project, brainstorm technical solutions, or plan subtasks.</p>

              <div className="ai-prompt-suggestions">
                {SUGGESTED_PROMPTS.map((promptText, i) => (
                  <button
                    key={i}
                    type="button"
                    className="ai-suggestion-chip"
                    onClick={() => handleSend(promptText.replace(/^[\p{Emoji}\s]+/u, ""))}
                  >
                    <span>{promptText}</span>
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`ai-message-row ${msg.role === "user" ? "is-user" : "is-assistant"}`}
              >
                <div className="ai-msg-avatar">
                  {msg.role === "user" ? <User size={14} /> : <Sparkles size={14} />}
                </div>

                <div className="ai-msg-body">
                  <div className="ai-msg-header">
                    <span className="ai-msg-author">
                      {msg.role === "user" ? "You" : "Orbitwork AI"}
                    </span>
                    {msg.role === "assistant" && msg.content && (
                      <button
                        type="button"
                        className="ai-msg-copy-btn"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        title="Copy text"
                      >
                        {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>

                  {msg.content ? (
                    <div
                      className="ai-msg-text doc-markdown-body"
                      dangerouslySetInnerHTML={{
                        __html: markdownToSafeHtml(msg.content),
                      }}
                    />
                  ) : isStreaming ? (
                    <div className="ai-msg-loading">
                      <Loader2 size={14} className="spin" />
                      <span>Thinking…</span>
                    </div>
                  ) : (
                    <div className="ai-msg-text doc-markdown-body">
                      Daily free AI limit reached across all providers. Please try again tomorrow.
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="ai-chat-input-box">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="ai-input-form"
          >
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              placeholder="Ask anything or brainstorm… (Shift+Enter for new line)"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />

            <div className="ai-input-controls">
              {isStreaming ? (
                <button
                  type="button"
                  className="ai-stop-btn"
                  onClick={handleStop}
                  title="Stop generating"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  className="ai-send-btn"
                  disabled={!input.trim()}
                  title="Send message"
                >
                  <Send size={15} />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
