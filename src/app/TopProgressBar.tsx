"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setVisible(true);
    setProgress((prev) => (prev > 0 && prev < 80 ? prev : 18));

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const remaining = 90 - prev;
        const step = Math.max(1, Math.floor(remaining * 0.12));
        return Math.min(88, prev + step);
      });
    }, 180);
  };

  const done = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(100);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      timeoutRef.current = setTimeout(() => {
        setProgress(0);
      }, 200);
    }, 250);
  };

  // Complete progress whenever route or query params change
  useEffect(() => {
    done();
  }, [pathname, searchParams]);

  // Global listeners for clicks, form submits, and popstate
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return;
      if (
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(anchor.href, window.location.href);

        if (targetUrl.origin !== currentUrl.origin) return;

        // Skip if exact same path and query
        if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
          return;
        }

        start();
      } catch {}
    };

    const handleFormSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      if (form.target && form.target !== "_self") return;
      start();
    };

    const handlePopState = () => {
      start();
    };

    const handleCustomStart = () => start();
    const handleCustomDone = () => done();

    document.addEventListener("click", handleAnchorClick, true);
    document.addEventListener("submit", handleFormSubmit, true);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("orbitwork-nav-start", handleCustomStart);
    window.addEventListener("orbitwork-nav-done", handleCustomDone);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener("click", handleAnchorClick, true);
      document.removeEventListener("submit", handleFormSubmit, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("orbitwork-nav-start", handleCustomStart);
      window.removeEventListener("orbitwork-nav-done", handleCustomDone);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        zIndex: 9999999,
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #10b981 0%, #16a34a 50%, #22c55e 100%)",
          boxShadow: "0 0 10px rgba(34, 197, 94, 0.7), 0 0 4px rgba(34, 197, 94, 0.5)",
          borderRadius: "0 2px 2px 0",
          opacity: visible ? 1 : 0,
          transition:
            progress === 100
              ? "width 180ms ease-out, opacity 200ms 150ms ease"
              : "width 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease",
        }}
      />
    </div>
  );
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressTracker />
    </Suspense>
  );
}
