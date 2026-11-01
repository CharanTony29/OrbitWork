"use client";

import { useEffect, useRef, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";
const storageKey = "orbitwork-theme";

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.colorScheme = dark ? "dark" : "light";
}

export default function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("system");
  const currentTheme = useRef<Theme>("system");
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    currentTheme.current = initial;
    setTheme(initial);
    applyTheme(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => { if (currentTheme.current === "system") applyTheme("system"); };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, []);
  function changeTheme(value: string) {
    if (value !== "light" && value !== "dark" && value !== "system") return;
    const next = value as Theme;
    currentTheme.current = next;
    setTheme(next);
    localStorage.setItem(storageKey, next);
    applyTheme(next);
  }
  return <div className="theme-picker" aria-label="Appearance setting"><span className="theme-picker-icon">{theme === "light" ? <Sun size={15}/> : theme === "dark" ? <Moon size={15}/> : <Laptop size={15}/>}</span><label htmlFor="orbitwork-theme">Theme</label><select id="orbitwork-theme" value={theme} onChange={(event) => changeTheme(event.target.value)} aria-label="Color theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>;
}
