export type ThemeStatusColors = {
  new: string;
  inProgress: string;
  hold: string;
  review: string;
  done: string;
  reopen: string;
};

export type ThemeCustomization = {
  accentColor: string;
  accentDarkColor: string;
  fontFamily: string;
  fontScale: number; // 0.9, 1.0, 1.08, 1.16
  statusColors: ThemeStatusColors;
};

export type UserThemePreferences = {
  light: ThemeCustomization;
  dark: ThemeCustomization;
};

export const DEFAULT_LIGHT_THEME: ThemeCustomization = {
  accentColor: "#167c58",
  accentDarkColor: "#0c6243",
  fontFamily: "inherit",
  fontScale: 1.0,
  statusColors: {
    new: "#0284c7",
    inProgress: "#2563eb",
    hold: "#d97706",
    review: "#9333ea",
    done: "#167c58",
    reopen: "#dc2626",
  },
};

export const DEFAULT_DARK_THEME: ThemeCustomization = {
  accentColor: "#10b981",
  accentDarkColor: "#0d6642",
  fontFamily: "inherit",
  fontScale: 1.0,
  statusColors: {
    new: "#38bdf8",
    inProgress: "#60a5fa",
    hold: "#fbbf24",
    review: "#c084fc",
    done: "#34d399",
    reopen: "#f87171",
  },
};

export const DEFAULT_THEME_PREFERENCES: UserThemePreferences = {
  light: DEFAULT_LIGHT_THEME,
  dark: DEFAULT_DARK_THEME,
};

export const ACCENT_PRESETS = [
  { name: "Emerald Green", light: "#167c58", dark: "#10b981", darkVariant: "#0c6243" },
  { name: "Royal Sapphire", light: "#2563eb", dark: "#3b82f6", darkVariant: "#1d4ed8" },
  { name: "Mystic Purple", light: "#7c3aed", dark: "#a855f7", darkVariant: "#6d28d9" },
  { name: "Crimson Ruby", light: "#dc2626", dark: "#f43f5e", darkVariant: "#b91c1c" },
  { name: "Sunset Amber", light: "#d97706", dark: "#f59e0b", darkVariant: "#b45309" },
  { name: "Teal Cyan", light: "#0d9488", dark: "#14b8a6", darkVariant: "#0f766e" },
  { name: "Midnight Slate", light: "#475569", dark: "#94a3b8", darkVariant: "#334155" },
];

export const FONT_FAMILY_OPTIONS = [
  { id: "inherit", label: "Default ('DM Sans', sans-serif)", value: "inherit" },
  { id: "inter", label: "Inter", value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: "jakarta", label: "Plus Jakarta Sans", value: "'Plus Jakarta Sans', -apple-system, sans-serif" },
  { id: "outfit", label: "Outfit", value: "'Outfit', 'DM Sans', sans-serif" },
  { id: "system", label: "System UI", value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: "mono", label: "JetBrains Mono", value: "'JetBrains Mono', 'Fira Code', monospace" },
];

export const FONT_SCALE_OPTIONS = [
  { label: "Compact (90%)", value: 0.9 },
  { label: "Default (100%)", value: 1.0 },
  { label: "Comfortable (108%)", value: 1.08 },
  { label: "Large (116%)", value: 1.16 },
];

const STORAGE_KEY = "orbitwork_user_theme_v2";

export function getUserThemePreferences(): UserThemePreferences {
  if (typeof window === "undefined") return DEFAULT_THEME_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      light: {
        ...DEFAULT_LIGHT_THEME,
        ...(parsed.light || {}),
        statusColors: {
          ...DEFAULT_LIGHT_THEME.statusColors,
          ...(parsed.light?.statusColors || {}),
        },
      },
      dark: {
        ...DEFAULT_DARK_THEME,
        ...(parsed.dark || {}),
        statusColors: {
          ...DEFAULT_DARK_THEME.statusColors,
          ...(parsed.dark?.statusColors || {}),
        },
      },
    };
  } catch {
    return DEFAULT_THEME_PREFERENCES;
  }
}

export function saveUserThemePreferences(prefs: UserThemePreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    applyUserTheme();
    window.dispatchEvent(new CustomEvent("orbitwork:theme-change", { detail: prefs }));
  } catch (err) {
    console.error("Failed to save theme preferences:", err);
  }
}

export function resetUserThemeToDefault() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    applyUserTheme();
    window.dispatchEvent(new CustomEvent("orbitwork:theme-change", { detail: DEFAULT_THEME_PREFERENCES }));
  } catch (err) {
    console.error("Failed to reset theme preferences:", err);
  }
}

export function isCurrentThemeDark(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark" ||
    document.documentElement.getAttribute("data-color-scheme") === "dark" ||
    (document.documentElement.getAttribute("data-theme") === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export function applyUserTheme() {
  if (typeof window === "undefined") return;
  const prefs = getUserThemePreferences();
  const isDark = isCurrentThemeDark();
  const current = isDark ? prefs.dark : prefs.light;

  const root = document.documentElement;

  // Apply accent colors
  root.style.setProperty("--green", current.accentColor);
  root.style.setProperty("--green-dark", current.accentDarkColor);
  root.style.setProperty("--rail-bg", isDark ? "#0b211a" : current.accentDarkColor);
  root.style.setProperty("--rail-line", isDark ? "#19352a" : current.accentDarkColor);
  root.style.setProperty("--rail-hover", isDark ? "#15352a" : current.accentColor);

  // Apply typography
  if (current.fontFamily && current.fontFamily !== "inherit") {
    root.style.setProperty("--app-font-family", current.fontFamily);
    document.body.style.fontFamily = current.fontFamily;
  } else {
    root.style.removeProperty("--app-font-family");
    document.body.style.removeProperty("font-family");
  }

  root.style.setProperty("--app-font-scale", String(current.fontScale || 1.0));
  root.style.fontSize = `${14 * (current.fontScale || 1.0)}px`;

  // Apply status colors
  root.style.setProperty("--status-new", current.statusColors.new);
  root.style.setProperty("--status-progress", current.statusColors.inProgress);
  root.style.setProperty("--status-hold", current.statusColors.hold);
  root.style.setProperty("--status-review", current.statusColors.review);
  root.style.setProperty("--status-done", current.statusColors.done);
  root.style.setProperty("--status-reopen", current.statusColors.reopen);
}

export function getCustomStatusColor(statusName?: string, category?: string): string | null {
  if (typeof window === "undefined") return null;
  const prefs = getUserThemePreferences();
  const isDark = isCurrentThemeDark();
  const colors = isDark ? prefs.dark.statusColors : prefs.light.statusColors;

  const name = (statusName ?? "").toLowerCase();
  if (
    name.includes("new") ||
    name.includes("to do") ||
    name.includes("todo") ||
    name.includes("backlog") ||
    category === "not_started"
  ) {
    return colors.new;
  }
  if (
    name.includes("progress") ||
    name.includes("doing") ||
    name.includes("active") ||
    category === "in_progress"
  ) {
    return colors.inProgress;
  }
  if (name.includes("hold") || name.includes("block") || name.includes("wait")) {
    return colors.hold;
  }
  if (name.includes("review") || name.includes("qa") || name.includes("test")) {
    return colors.review;
  }
  if (
    name.includes("complete") ||
    name.includes("done") ||
    name.includes("closed") ||
    category === "completed"
  ) {
    return colors.done;
  }
  if (
    name.includes("reject") ||
    name.includes("cancel") ||
    name.includes("re open") ||
    name.includes("reopen") ||
    category === "cancelled"
  ) {
    return colors.reopen;
  }

  return null;
}
