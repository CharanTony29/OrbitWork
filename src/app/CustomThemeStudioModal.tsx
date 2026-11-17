"use client";

import { useState, useEffect } from "react";
import {
  Palette,
  X,
  RotateCcw,
  Check,
  Sun,
  Moon,
  Type,
  Maximize2,
  Sparkles,
} from "lucide-react";
import {
  ACCENT_PRESETS,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  FONT_FAMILY_OPTIONS,
  FONT_SCALE_OPTIONS,
  FULL_THEME_PRESETS,
  getUserThemePreferences,
  resetUserThemeToDefault,
  saveUserThemePreferences,
  type ThemeCustomization,
  type UserThemePreferences,
} from "@/lib/custom-theme";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CustomThemeStudioModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"light" | "dark">("light");
  const [preferences, setPreferences] = useState<UserThemePreferences>({
    light: { ...DEFAULT_LIGHT_THEME },
    dark: { ...DEFAULT_DARK_THEME },
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPreferences(getUserThemePreferences());
      const isDark =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark";
      setActiveTab(isDark ? "dark" : "light");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTheme = activeTab === "light" ? preferences.light : preferences.dark;

  const updateCurrentTheme = (updates: Partial<ThemeCustomization>) => {
    setPreferences((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        ...updates,
      },
    }));
  };

  const updateStatusColor = (key: keyof ThemeCustomization["statusColors"], val: string) => {
    setPreferences((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        statusColors: {
          ...prev[activeTab].statusColors,
          [key]: val,
        },
      },
    }));
  };

  const handleSave = () => {
    saveUserThemePreferences(preferences);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    if (window.confirm("Reset all appearance and status color customizations back to default OrbitWork styles?")) {
      resetUserThemeToDefault();
      setPreferences({
        light: { ...DEFAULT_LIGHT_THEME },
        dark: { ...DEFAULT_DARK_THEME },
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    }
  };

  return (
    <div
      className="canvas-modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 99999,
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="canvas-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          background: "var(--surface, #ffffff)",
          color: "var(--ink, #17231f)",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 24px 50px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface-subtle, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: currentTheme.accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <Palette size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Appearance & UI Customization Studio
              </h2>
              <p style={{ fontSize: 12, color: "var(--muted, #64748b)", margin: "2px 0 0" }}>
                Customize your theme palette, status colors, and typography strictly for your profile.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--muted, #64748b)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Dark / Light Mode Switcher Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            padding: "8px 24px 0",
            gap: 16,
            background: "var(--surface, #ffffff)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("light")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 650,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: activeTab === "light" ? currentTheme.accentColor : "var(--muted)",
              borderBottom: activeTab === "light" ? `2.5px solid ${currentTheme.accentColor}` : "2.5px solid transparent",
            }}
          >
            <Sun size={15} />
            <span>Light Theme Customizations</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dark")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 650,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: activeTab === "dark" ? currentTheme.accentColor : "var(--muted)",
              borderBottom: activeTab === "dark" ? `2.5px solid ${currentTheme.accentColor}` : "2.5px solid transparent",
            }}
          >
            <Moon size={15} />
            <span>Dark Theme Customizations</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {/* Section 0: Curated One-Click Full Themes */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                Curated Theme Presets (One-Click)
              </label>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Matrix, Cyberpunk, Solarized & more</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
              {FULL_THEME_PRESETS.map((preset) => {
                const isPresetActive =
                  currentTheme.accentColor.toLowerCase() === preset.accentColor.toLowerCase() &&
                  activeTab === preset.mode;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(preset.mode);
                      setPreferences((prev) => ({
                        ...prev,
                        [preset.mode]: {
                          ...prev[preset.mode],
                          accentColor: preset.accentColor,
                          accentDarkColor: preset.accentDarkColor,
                          fontFamily: preset.fontFamily,
                          statusColors: { ...preset.statusColors },
                        },
                      }));
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 4,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: isPresetActive ? `2px solid ${preset.accentColor}` : "1px solid var(--line, #cbd5e1)",
                      background: isPresetActive ? "color-mix(in srgb, var(--green, #167c58) 8%, transparent)" : "var(--surface-subtle, #f8fafc)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: preset.accentColor }} />
                        {preset.name}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 750, padding: "1px 5px", borderRadius: 4, background: preset.mode === "dark" ? "#0f172a" : "#e2e8f0", color: preset.mode === "dark" ? "#38bdf8" : "#475569" }}>
                        {preset.badge}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.3 }}>
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 1: Accent Color */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                Workspace Primary Accent Color
              </label>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Click box or type any RGB / Hex color</span>
            </div>

            {/* Presets */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {ACCENT_PRESETS.map((preset) => {
                const colorValue = activeTab === "light" ? preset.light : preset.dark;
                const isSelected = currentTheme.accentColor.toLowerCase() === colorValue.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      updateCurrentTheme({
                        accentColor: colorValue,
                        accentDarkColor: preset.darkVariant,
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: isSelected ? `2px solid ${colorValue}` : "1px solid var(--line, #cbd5e1)",
                      background: isSelected ? "var(--surface-subtle, #f1f5f9)" : "transparent",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: colorValue,
                        display: "inline-block",
                      }}
                    />
                    <span>{preset.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom RGB Color Box + Hex input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--surface-subtle, #f8fafc)",
              }}
            >
              <div style={{ position: "relative", width: 38, height: 38 }}>
                <input
                  type="color"
                  value={currentTheme.accentColor}
                  onChange={(e) => updateCurrentTheme({ accentColor: e.target.value, accentDarkColor: e.target.value })}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                  }}
                  title="Choose custom color from RGB box"
                />
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 8,
                    background: currentTheme.accentColor,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    border: "2px solid #ffffff",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
                  Custom Hex / RGB value
                </span>
                <input
                  type="text"
                  value={currentTheme.accentColor}
                  onChange={(e) => updateCurrentTheme({ accentColor: e.target.value, accentDarkColor: e.target.value })}
                  placeholder="#167c58"
                  style={{
                    fontSize: 13,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--line, #cbd5e1)",
                    background: "var(--surface, #ffffff)",
                    color: "var(--ink)",
                    width: 130,
                  }}
                />
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: currentTheme.accentColor,
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Sparkles size={12} />
                  Active Accent Preview
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: Custom Status Colors */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                Task Status Colors
              </label>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Change colors of all status badges in List & Tracker</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {[
                { key: "new", label: "New / To Do / Backlog", default: "#0284c7" },
                { key: "inProgress", label: "In Progress / Active", default: "#2563eb" },
                { key: "hold", label: "On Hold / Blocked", default: "#d97706" },
                { key: "review", label: "In Review / QA / Testing", default: "#9333ea" },
                { key: "done", label: "Done / Completed", default: "#167c58" },
                { key: "reopen", label: "Re-Open / Cancelled", default: "#dc2626" },
              ].map((status) => {
                const colorVal = currentTheme.statusColors[status.key as keyof ThemeCustomization["statusColors"]];
                return (
                  <div
                    key={status.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--line, #e2e8f0)",
                      background: "var(--surface-subtle, #f8fafc)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ position: "relative", width: 26, height: 26 }}>
                        <input
                          type="color"
                          value={colorVal}
                          onChange={(e) =>
                            updateStatusColor(status.key as keyof ThemeCustomization["statusColors"], e.target.value)
                          }
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            opacity: 0,
                            cursor: "pointer",
                          }}
                        />
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 6,
                            background: colorVal,
                            border: "1px solid rgba(0,0,0,0.15)",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 650 }}>{status.label}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          backgroundColor: `${colorVal}22`,
                          color: colorVal,
                          border: `1px solid ${colorVal}44`,
                        }}
                      >
                        Pill
                      </span>
                      <input
                        type="text"
                        value={colorVal}
                        onChange={(e) =>
                          updateStatusColor(status.key as keyof ThemeCustomization["statusColors"], e.target.value)
                        }
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          width: 68,
                          padding: "2px 4px",
                          borderRadius: 4,
                          border: "1px solid var(--line)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          textAlign: "center",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Typography & Font Scaling */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                Typography & Font Size
              </label>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Customizable across entire application</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Font Family
                </span>
                <select
                  value={currentTheme.fontFamily}
                  onChange={(e) => updateCurrentTheme({ fontFamily: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--line, #cbd5e1)",
                    background: "var(--surface, #ffffff)",
                    color: "var(--ink)",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {FONT_FAMILY_OPTIONS.map((f) => (
                    <option key={f.id} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Font Size Scaling
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {FONT_SCALE_OPTIONS.map((s) => {
                    const isSelected = Math.abs((currentTheme.fontScale || 1.0) - s.value) < 0.01;
                    return (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => updateCurrentTheme({ fontScale: s.value })}
                        style={{
                          flex: 1,
                          padding: "8px 4px",
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 650,
                          border: isSelected ? `2px solid ${currentTheme.accentColor}` : "1px solid var(--line)",
                          background: isSelected ? "var(--surface-subtle)" : "transparent",
                          color: isSelected ? currentTheme.accentColor : "var(--ink)",
                          cursor: "pointer",
                        }}
                      >
                        {s.label.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Live UI Preview Box */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: activeTab === "dark" ? "#0f1210" : "#ffffff",
              border: `1.5px solid ${activeTab === "dark" ? "#303a33" : "#e2e8f0"}`,
              color: activeTab === "dark" ? "#e8eee9" : "#17231f",
              fontFamily: currentTheme.fontFamily === "inherit" ? "inherit" : currentTheme.fontFamily,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                Live Workspace Preview ({activeTab.toUpperCase()})
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 6,
                  backgroundColor: currentTheme.accentColor,
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                Button
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  backgroundColor: `${currentTheme.statusColors.new}22`,
                  color: currentTheme.statusColors.new,
                  border: `1px solid ${currentTheme.statusColors.new}44`,
                }}
              >
                New Task
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  backgroundColor: `${currentTheme.statusColors.inProgress}22`,
                  color: currentTheme.statusColors.inProgress,
                  border: `1px solid ${currentTheme.statusColors.inProgress}44`,
                }}
              >
                In Progress
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  backgroundColor: `${currentTheme.statusColors.hold}22`,
                  color: currentTheme.statusColors.hold,
                  border: `1px solid ${currentTheme.statusColors.hold}44`,
                }}
              >
                On Hold
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  backgroundColor: `${currentTheme.statusColors.review}22`,
                  color: currentTheme.statusColors.review,
                  border: `1px solid ${currentTheme.statusColors.review}44`,
                }}
              >
                Review
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  backgroundColor: `${currentTheme.statusColors.done}22`,
                  color: currentTheme.statusColors.done,
                  border: `1px solid ${currentTheme.statusColors.done}44`,
                }}
              >
                Completed
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--line, #e2e8f0)",
            background: "var(--surface-subtle, #f8fafc)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--line, #cbd5e1)",
              background: "transparent",
              color: "var(--ink)",
              fontSize: 12.5,
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
            <span>Reset to Default</span>
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--line, #cbd5e1)",
                background: "transparent",
                color: "var(--ink)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 20px",
                borderRadius: 8,
                border: 0,
                background: savedSuccess ? "#16a34a" : currentTheme.accentColor,
                color: "#ffffff",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              }}
            >
              <Check size={14} />
              <span>{savedSuccess ? "Saved Successfully!" : "Save & Apply UI"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
