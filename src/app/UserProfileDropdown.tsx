"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Settings,
  Bell,
  Palette,
  Command,
  HelpCircle,
  CheckSquare,
  Briefcase,
  Clock,
  FileText,
  PenTool,
  Users,
  LogOut,
  Smile,
  VolumeX,
  FileSpreadsheet,
  StickyNote,
  Sun,
  Moon,
  Monitor,
  X,
} from "lucide-react";
import { signOut } from "./actions";
import UniversalCreateModal from "./UniversalCreateModal";

export default function UserProfileDropdown({
  email,
  displayName,
  avatarUrl,
  organizationId,
  workspaceId,
  projectId,
}: {
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
  organizationId?: string;
  workspaceId?: string;
  projectId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [userStatus, setUserStatus] = useState("Online");
  const [customStatusInput, setCustomStatusInput] = useState("");
  const [showStatusEdit, setShowStatusEdit] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
  const [notepadContent, setNotepadContent] = useState("");
  const [themeSubmenu, setThemeSubmenu] = useState(false);
  const [universalModalTab, setUniversalModalTab] = useState<"task" | "reminder" | "doc" | "whiteboard" | "dashboard" | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const name = displayName?.trim() || email.split("@")[0] || "User";
  const initial = name.charAt(0).toUpperCase();

  // Load saved notepad from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("orbitwork_personal_notepad");
      if (saved) setNotepadContent(saved);
      const savedStatus = localStorage.getItem("orbitwork_user_status");
      if (savedStatus) setUserStatus(savedStatus);
    } catch {}
  }, []);

  // Save notepad
  const handleNotepadChange = (val: string) => {
    setNotepadContent(val);
    try {
      localStorage.setItem("orbitwork_personal_notepad", val);
    } catch {}
  };

  // Close dropdown / modals on Escape
  useEffect(() => {
    if (!isOpen && !showShortcuts && !showNotepad) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (showNotepad) {
          setShowNotepad(false);
        } else if (isOpen) {
          setIsOpen(false);
          setShowStatusEdit(false);
          setThemeSubmenu(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showShortcuts, showNotepad]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowStatusEdit(false);
        setThemeSubmenu(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const setTheme = (theme: "light" | "dark" | "system") => {
    try {
      const isDark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-color-scheme", isDark ? "dark" : "light");
      document.documentElement.dataset.colorScheme = isDark ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("orbitwork-theme", theme);
      localStorage.setItem("color-scheme", theme);
    } catch {}
    setThemeSubmenu(false);
  };

  return (
    <div className="user-profile-widget" style={{ position: "relative" }}>
      {/* User Initial Circle at Top Right */}
      <button
        ref={buttonRef}
        type="button"
        className="user-avatar-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="User profile and personal tools menu"
        style={{
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: "50%",
          backgroundColor: avatarUrl ? "transparent" : "#167c58",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          border: avatarUrl ? "1.5px solid var(--line, #dfe5e0)" : "2px solid rgba(255,255,255,0.8)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          cursor: "pointer",
          position: "relative",
          outline: "none",
          boxSizing: "border-box",
        }}
      >
        {avatarUrl ? (
          <span
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              overflow: "hidden",
              display: "block",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={name}
              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
            />
          </span>
        ) : (
          initial
        )}
        {/* Green Online status dot */}
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            border: "2px solid #ffffff",
          }}
        />
      </button>

      {/* ClickUp-style Action Items Dropdown */}
      {isOpen && (
        <div
          ref={menuRef}
          className="user-profile-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 270,
            maxHeight: "85vh",
            overflowY: "auto",
            backgroundColor: "var(--paper, #ffffff)",
            color: "var(--ink, #1e293b)",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid var(--line, #e2e8f0)",
            zIndex: 1000,
            padding: "8px 0",
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          {/* User Info Header */}
          <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid var(--line, #f1f5f9)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  backgroundColor: avatarUrl ? "transparent" : "#167c58",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 16,
                  position: "relative",
                  flexShrink: 0,
                  border: avatarUrl ? "1px solid var(--line, #dfe5e0)" : "none",
                }}
              >
                {avatarUrl ? (
                  <span
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      overflow: "hidden",
                      display: "block",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt={name}
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
                    />
                  </span>
                ) : (
                  initial
                )}
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    border: "2px solid #ffffff",
                  }}
                />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {name}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>{userStatus}</div>
              </div>
            </div>

            {/* Set Status Input */}
            <div style={{ marginTop: 10 }}>
              {!showStatusEdit ? (
                <button
                  type="button"
                  onClick={() => setShowStatusEdit(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #e2e8f0)",
                    background: "var(--soft, #f8fafc)",
                    fontSize: 11.5,
                    color: "var(--muted, #64748b)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Smile size={13} />
                  <span>{userStatus === "Online" ? "Set status…" : userStatus}</span>
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={customStatusInput}
                    onChange={(e) => setCustomStatusInput(e.target.value)}
                    placeholder="In a meeting, working remote…"
                    maxLength={50}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--green, #167c58)",
                      fontSize: 11,
                      outline: "none",
                      background: "var(--paper, #fff)",
                      color: "var(--ink, #1e293b)",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (customStatusInput.trim()) {
                          setUserStatus(customStatusInput.trim());
                          localStorage.setItem("orbitwork_user_status", customStatusInput.trim());
                        }
                        setShowStatusEdit(false);
                      } else if (e.key === "Escape") {
                        setShowStatusEdit(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customStatusInput.trim()) {
                        setUserStatus(customStatusInput.trim());
                        localStorage.setItem("orbitwork_user_status", customStatusInput.trim());
                      }
                      setShowStatusEdit(false);
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "var(--green, #167c58)",
                      color: "#fff",
                      border: 0,
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Nav Items */}
          <div style={{ padding: "6px 0", borderBottom: "1px solid var(--line, #f1f5f9)" }}>
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                textDecoration: "none",
              }}
            >
              <Settings size={14} />
              <span>Settings</span>
            </Link>
            <Link
              href="/inbox"
              onClick={() => setIsOpen(false)}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                textDecoration: "none",
              }}
            >
              <Bell size={14} />
              <span>Notifications</span>
            </Link>

            {/* Themes Selector */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setThemeSubmenu((v) => !v)}
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 16px",
                  fontSize: 12.5,
                  color: "var(--ink, #334155)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Palette size={14} />
                  <span>Themes</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Toggle ›</span>
              </button>
              {themeSubmenu && (
                <div
                  style={{
                    margin: "4px 16px 8px",
                    padding: 4,
                    borderRadius: 8,
                    background: "var(--soft, #f8fafc)",
                    display: "flex",
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "4px",
                      fontSize: 10.5,
                      border: 0,
                      borderRadius: 5,
                      background: "var(--paper, #fff)",
                      cursor: "pointer",
                      color: "var(--ink)",
                    }}
                  >
                    <Sun size={12} /> Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "4px",
                      fontSize: 10.5,
                      border: 0,
                      borderRadius: 5,
                      background: "var(--paper, #fff)",
                      cursor: "pointer",
                      color: "var(--ink)",
                    }}
                  >
                    <Moon size={12} /> Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "4px",
                      fontSize: 10.5,
                      border: 0,
                      borderRadius: 5,
                      background: "var(--paper, #fff)",
                      cursor: "pointer",
                      color: "var(--ink)",
                    }}
                  >
                    <Monitor size={12} /> Auto
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowShortcuts(true);
                setIsOpen(false);
              }}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Command size={14} />
              <span>Keyboard shortcuts</span>
            </button>
          </div>

          {/* Personal Tools Section (Matches ClickUp Screenshot) */}
          <div style={{ padding: "6px 0", borderBottom: "1px solid var(--line, #f1f5f9)" }}>
            <div
              style={{
                padding: "4px 16px 2px",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--muted, #94a3b8)",
                letterSpacing: 0.8,
              }}
            >
              PERSONAL TOOLS
            </div>

            <button
              type="button"
              onClick={() => {
                setUniversalModalTab("task");
                setIsOpen(false);
              }}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "7px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <CheckSquare size={14} />
              <span>Create task</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUniversalModalTab("reminder");
                setIsOpen(false);
              }}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "7px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Bell size={14} />
              <span>Create Reminder</span>
            </button>

            <Link
              href="/inbox"
              onClick={() => setIsOpen(false)}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                textDecoration: "none",
              }}
            >
              <Briefcase size={14} />
              <span>My Work</span>
            </Link>

            <Link
              href={
                workspaceId
                  ? `/workspaces/${workspaceId}/timesheets`
                  : projectId
                  ? `/projects/${projectId}/timesheets`
                  : "/dashboard"
              }
              onClick={() => setIsOpen(false)}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                textDecoration: "none",
              }}
            >
              <Clock size={14} />
              <span>Track Time</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setShowNotepad(true);
                setIsOpen(false);
              }}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "7px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <StickyNote size={14} />
              <span>Notepad</span>
            </button>

            {projectId && (
              <Link
                href={`/projects/${projectId}/documents`}
                onClick={() => setIsOpen(false)}
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 16px",
                  fontSize: 12.5,
                  color: "var(--ink, #334155)",
                  textDecoration: "none",
                }}
              >
                <FileText size={14} />
                <span>Create Doc</span>
              </Link>
            )}

            {projectId && (
              <Link
                href={`/projects/${projectId}?view=whiteboard`}
                onClick={() => setIsOpen(false)}
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 16px",
                  fontSize: 12.5,
                  color: "var(--ink, #334155)",
                  textDecoration: "none",
                }}
              >
                <PenTool size={14} />
                <span>Create Whiteboard</span>
              </Link>
            )}

            {organizationId && (
              <Link
                href={`/organizations/${organizationId}/members`}
                onClick={() => setIsOpen(false)}
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 16px",
                  fontSize: 12.5,
                  color: "var(--ink, #334155)",
                  textDecoration: "none",
                }}
              >
                <Users size={14} />
                <span>View People</span>
              </Link>
            )}

            {/* Chat link */}
            <Link
              href="/chat"
              onClick={() => setIsOpen(false)}
              className="user-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 16px",
                fontSize: 12.5,
                color: "var(--ink, #334155)",
                textDecoration: "none",
              }}
            >
              <Smile size={14} />
              <span>Team &amp; Personal Chat</span>
            </Link>
          </div>

          {/* Footer / Sign out */}
          <div style={{ padding: "4px 0 0" }}>
            <form action={signOut} style={{ margin: 0 }}>
              <button
                type="submit"
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 16px",
                  fontSize: 12.5,
                  color: "#e11d48",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: 600,
                }}
              >
                <LogOut size={14} />
                <span>Log out</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating / Popover Notepad */}
      {showNotepad && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 340,
            height: 380,
            backgroundColor: "var(--paper, #fff)",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: 12,
            boxShadow: "0 12px 36px rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--soft, #f8fafc)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
              <StickyNote size={15} color="#167c58" />
              <span>Personal Notepad</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNotepad(false)}
              style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted)" }}
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            value={notepadContent}
            onChange={(e) => handleNotepadChange(e.target.value)}
            placeholder="Jot down quick thoughts, to-dos, or scratch notes… Auto-saved."
            style={{
              flex: 1,
              padding: 14,
              border: 0,
              outline: "none",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "none",
              background: "transparent",
              color: "var(--ink)",
              lineHeight: 1.6,
            }}
          />
          <div
            style={{
              padding: "6px 12px",
              fontSize: 10.5,
              color: "var(--muted)",
              borderTop: "1px solid var(--line, #e2e8f0)",
              textAlign: "right",
            }}
          >
            Saved automatically
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            style={{
              width: 440,
              backgroundColor: "var(--paper, #fff)",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink, #17231f)" }}>Keyboard Shortcuts</h3>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--muted, #64748b)" }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
              <button
                type="button"
                onClick={() => {
                  setShowShortcuts(false);
                  setTimeout(() => window.dispatchEvent(new CustomEvent("orbitwork:open-search")), 40);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line, #e2e8f0)",
                  background: "var(--surface-soft, #f8fafc)",
                  color: "var(--ink, #17231f)",
                  cursor: "pointer",
                }}
              >
                <span>
                  <strong>Global Search</strong>
                  <small style={{ display: "block", fontSize: 11, color: "var(--muted, #64748b)" }}>
                    Click or press to search tasks, docs, projects &amp; workspaces
                  </small>
                </span>
                <kbd style={{ background: "var(--paper, #fff)", color: "var(--ink, #17231f)", border: "1px solid var(--line, #cbd5e1)", padding: "3px 7px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>Ctrl + K</kbd>
              </button>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line, #e2e8f0)",
                  color: "var(--ink, #17231f)",
                }}
              >
                <span>
                  <strong>Submit / Send Comment</strong>
                  <small style={{ display: "block", fontSize: 11, color: "var(--muted, #64748b)" }}>
                    Works in task discussions &amp; team channel posts
                  </small>
                </span>
                <kbd style={{ background: "var(--paper, #fff)", color: "var(--ink, #17231f)", border: "1px solid var(--line, #cbd5e1)", padding: "3px 7px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>Ctrl + Enter</kbd>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line, #e2e8f0)",
                  color: "var(--ink, #17231f)",
                }}
              >
                <span>
                  <strong>Mention Team Member</strong>
                  <small style={{ display: "block", fontSize: 11, color: "var(--muted, #64748b)" }}>
                    Type @ in task comments or team channel to tag &amp; alert teammates
                  </small>
                </span>
                <kbd style={{ background: "var(--paper, #fff)", color: "var(--ink, #17231f)", border: "1px solid var(--line, #cbd5e1)", padding: "3px 7px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>@</kbd>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line, #e2e8f0)",
                  background: "transparent",
                  color: "var(--ink, #17231f)",
                  cursor: "pointer",
                }}
              >
                <span>
                  <strong>Close modal</strong>
                  <small style={{ display: "block", fontSize: 11, color: "var(--muted, #64748b)" }}>
                    Dismisses dialogs, popovers, search, and comment drawers
                  </small>
                </span>
                <kbd style={{ background: "var(--paper, #fff)", color: "var(--ink, #17231f)", border: "1px solid var(--line, #cbd5e1)", padding: "3px 7px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>Escape</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Create Modal (Screenshot 2 & Screenshot 3: Task, Doc, Reminder, Whiteboard, Dashboard) */}
      <UniversalCreateModal
        isOpen={Boolean(universalModalTab)}
        onClose={() => setUniversalModalTab(null)}
        initialTab={universalModalTab || "task"}
        projectId={projectId}
      />
    </div>
  );
}
