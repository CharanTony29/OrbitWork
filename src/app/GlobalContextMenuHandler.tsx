"use client";

import { useEffect } from "react";

export default function GlobalContextMenuHandler() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Allow native menu only if right clicking inside an editable input / textarea so user can paste
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Suppress default browser context menu everywhere else
      e.preventDefault();
    };

    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
    };
  }, []);

  return null;
}
