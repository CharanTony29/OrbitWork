"use client";

import { useEffect, useRef } from "react";

type Theme = "light" | "dark" | "system";
const storageKey = "orbitwork-theme";

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.colorScheme = dark ? "dark" : "light";
    document.documentElement.setAttribute("data-color-scheme", dark ? "dark" : "light");
  }
}

export default function ThemePicker() {
  const currentTheme = useRef<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) || localStorage.getItem("color-scheme");
    const initial: Theme =
      stored === "light" || stored === "dark" || stored === "system" ? (stored as Theme) : "system";
    currentTheme.current = initial;
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      if (currentTheme.current === "system") applyTheme("system");
    };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, []);

  // Removed theme picker from bottom right as requested (theme is managed via User Profile Menu)
  return null;
}
