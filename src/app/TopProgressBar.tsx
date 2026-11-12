"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function notifyNavigationStart(targetHref?: string) {
  if (typeof window === "undefined") return;
  if (targetHref) {
    try {
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(targetHref, window.location.href);
      if (targetUrl.origin !== currentUrl.origin) return;
      if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
        return;
      }
    } catch {
      return;
    }
  }
  window.dispatchEvent(new Event("orbitwork-nav-start"));
}

export function notifyNavigationDone() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("orbitwork-nav-done"));
}

function ProgressTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (failsafeTimerRef.current) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }
  }, []);

  const done = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearAllTimers();
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      resetTimerRef.current = setTimeout(() => {
        setProgress(0);
      }, 220);
    }, 180);
  }, [clearAllTimers]);

  const start = useCallback(() => {
    clearAllTimers();
    activeRef.current = true;
    setVisible(true);
    setProgress((prev) => (prev > 0 && prev < 80 ? prev : 18));

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const remaining = 90 - prev;
        const step = Math.max(1, Math.floor(remaining * 0.14));
        return Math.min(88, prev + step);
      });
    }, 160);

    // Prevent the bar from ever remaining stuck if a request stalls, aborts, or does not change URL
    failsafeTimerRef.current = setTimeout(() => {
      done();
    }, 8000);
  }, [clearAllTimers, done]);

  // Complete progress whenever route or query params change
  useEffect(() => {
    done();
  }, [pathname, searchParams, done]);

  // Global listeners for bubble-phase anchor navigation, history changes, and error recovery
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

        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        start();
      } catch {
        // Ignore malformed URLs
      }
    };

    const handlePopState = () => {
      start();
    };

    const handleFormSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      start();
    };

    // Safely observe programmatic router.push() calls without mutating React state synchronously during commit
    const origPushState = window.history.pushState.bind(window.history);
    const wrappedPushState: History["pushState"] = (data, unused, url) => {
      const prevHref = window.location.href;
      origPushState(data, unused, url);
      if (url) {
        try {
          const prev = new URL(prevHref);
          const next = new URL(String(url), prevHref);
          if (prev.pathname !== next.pathname || prev.search !== next.search) {
            window.setTimeout(() => start(), 0);
          }
        } catch {
          // ignore malformed URL
        }
      }
    };
    window.history.pushState = wrappedPushState;

    const handleCustomStart = () => start();
    const handleCustomDone = () => done();
    const handleNavError = () => {
      if (activeRef.current) done();
    };

    // Listen in bubble phase so React/component onClick handlers calling preventDefault() are respected
    document.addEventListener("click", handleAnchorClick, false);
    document.addEventListener("submit", handleFormSubmit, false);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("orbitwork-nav-start", handleCustomStart);
    window.addEventListener("orbitwork-nav-done", handleCustomDone);
    window.addEventListener("error", handleNavError);
    window.addEventListener("unhandledrejection", handleNavError);

    return () => {
      clearAllTimers();
      window.history.pushState = origPushState;
      document.removeEventListener("click", handleAnchorClick, false);
      document.removeEventListener("submit", handleFormSubmit, false);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("orbitwork-nav-start", handleCustomStart);
      window.removeEventListener("orbitwork-nav-done", handleCustomDone);
      window.removeEventListener("error", handleNavError);
      window.removeEventListener("unhandledrejection", handleNavError);
    };
  }, [clearAllTimers, done, start]);

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
              ? "width 160ms ease-out, opacity 200ms 120ms ease"
              : "width 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease",
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
