"use client";

import { useState, useEffect } from "react";

export default function TimeEntryTimestamp({ isoString }: { isoString: string }) {
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    try {
      const d = new Date(isoString);
      const datePart = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setFormatted(`${datePart} · ${timePart}`);
    } catch {
      setFormatted(isoString);
    }
  }, [isoString]);

  if (!formatted) {
    try {
      const d = new Date(isoString);
      return <span>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
    } catch {
      return <span>{isoString}</span>;
    }
  }

  return <span>{formatted}</span>;
}
