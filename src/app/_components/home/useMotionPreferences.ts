"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` OS/browser preference.
 * Defaults to false during SSR and syncs cleanly on mount.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  return reduced;
}

/**
 * Observes whether an element is currently visible in the viewport.
 * Used to lazy-activate animations and pause offscreen product reels for Core Web Vitals.
 */
export function useInViewport<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "120px"
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) {
          setHasEntered(true);
        }
      },
      { rootMargin, threshold: 0.12 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView, hasEntered };
}
