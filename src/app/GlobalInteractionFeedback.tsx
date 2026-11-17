"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface GlobalToastState {
  type: "transition" | "error";
  message: string;
  target?: string;
}

const SPINNER_HTML = `<span class="global-btn-spinner" aria-hidden="true"><span class="global-btn-spinner-icon"></span></span>`;

function shouldIgnoreButton(btn: HTMLElement): boolean {
  if (btn.hasAttribute("data-no-feedback")) return true;
  if (btn.getAttribute("aria-expanded") !== null) return true;
  if (btn.classList.contains("view-tabs-customize-btn")) return true;
  if (btn.classList.contains("modal-close") || btn.getAttribute("aria-label") === "Close") return true;
  return false;
}

function setButtonBusy(btn: HTMLElement, busy: boolean) {
  if (!btn || !btn.isConnected) return;

  if (busy) {
    if (btn.getAttribute("data-interaction-busy") === "true") return;
    btn.setAttribute("data-interaction-busy", "true");
    btn.setAttribute("aria-busy", "true");

    // Prepend spinner if not already has one
    const hasExistingSpinner =
      btn.querySelector(".global-btn-spinner") ||
      btn.querySelector(".spin") ||
      btn.querySelector(".loader");

    if (!hasExistingSpinner) {
      const span = document.createElement("span");
      span.className = "global-btn-spinner";
      span.setAttribute("aria-hidden", "true");
      span.innerHTML = `<span class="global-btn-spinner-icon"></span>`;
      btn.insertBefore(span, btn.firstChild);
    }
  } else {
    btn.removeAttribute("data-interaction-busy");
    btn.setAttribute("aria-busy", "false");
    const injected = btn.querySelectorAll(".global-btn-spinner");
    injected.forEach((el) => el.remove());
  }
}

function flashButtonError(btn: HTMLElement) {
  if (!btn || !btn.isConnected) return;
  setButtonBusy(btn, false);
  btn.setAttribute("data-interaction-error", "true");
  setTimeout(() => {
    if (btn.isConnected) {
      btn.removeAttribute("data-interaction-error");
    }
  }, 400);
}

function GlobalFeedbackManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<GlobalToastState | null>(null);

  const busyButtonsRef = useRef<Set<HTMLElement>>(new Set());
  const lastInteractedBtnRef = useRef<HTMLElement | null>(null);
  const lastInteractedTimeRef = useRef<number>(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear busy buttons and toast whenever route or query params change
  useEffect(() => {
    busyButtonsRef.current.forEach((btn) => setButtonBusy(btn, false));
    busyButtonsRef.current.clear();
    setToast(null);
  }, [pathname, searchParams]);

  useEffect(() => {
    // 1. Intercept physical clicks & duplicate clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const btn = target.closest("button, input[type='submit'], input[type='button'], .button") as HTMLElement | null;
      if (!btn) return;

      // Prevent duplicate clicks if button is currently busy
      if (btn.getAttribute("data-interaction-busy") === "true") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (shouldIgnoreButton(btn)) return;

      lastInteractedBtnRef.current = btn;
      lastInteractedTimeRef.current = Date.now();
    };

    // 2. Intercept Form Submissions
    const handleSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const form = e.target as HTMLFormElement | null;
      if (!form) return;

      // Find submit button in form
      const submitBtn = (
        (lastInteractedBtnRef.current && form.contains(lastInteractedBtnRef.current)
          ? lastInteractedBtnRef.current
          : null) ||
        form.querySelector("button[type='submit'], input[type='submit']")
      ) as HTMLElement | null;

      if (submitBtn && !shouldIgnoreButton(submitBtn)) {
        setButtonBusy(submitBtn, true);
        busyButtonsRef.current.add(submitBtn);

        // Failsafe auto-reset after 7 seconds
        setTimeout(() => {
          if (busyButtonsRef.current.has(submitBtn)) {
            setButtonBusy(submitBtn, false);
            busyButtonsRef.current.delete(submitBtn);
          }
        }, 7000);
      }
    };

    // 3. Form reset handler
    const handleReset = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const buttons = form.querySelectorAll("[data-interaction-busy='true']");
      buttons.forEach((el) => {
        const btn = el as HTMLElement;
        setButtonBusy(btn, false);
        busyButtonsRef.current.delete(btn);
      });
    };

    // 4. Intercept window.fetch to provide immediate loading & duplicate-click prevention
    const origFetch = window.fetch;
    window.fetch = async function (...args: Parameters<typeof origFetch>) {
      const now = Date.now();
      const recentBtn = (now - lastInteractedTimeRef.current < 450) ? lastInteractedBtnRef.current : null;
      const applyBtn = recentBtn && !shouldIgnoreButton(recentBtn) ? recentBtn : null;

      if (applyBtn) {
        setButtonBusy(applyBtn, true);
        busyButtonsRef.current.add(applyBtn);
      }

      try {
        const res = await origFetch.apply(this, args);
        if (!res.ok && res.status >= 400 && applyBtn) {
          flashButtonError(applyBtn);
        }
        return res;
      } catch (err) {
        if (applyBtn) {
          flashButtonError(applyBtn);
        }
        // Surface network failure toast
        if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
          setToast({
            type: "error",
            message: "Network request failed. Please check your connection.",
          });
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
        }
        throw err;
      } finally {
        if (applyBtn) {
          setButtonBusy(applyBtn, false);
          busyButtonsRef.current.delete(applyBtn);
        }
      }
    };

    // 5. Custom event: Tab transition started
    const handleTabStart = (e: Event) => {
      const custom = e as CustomEvent<{ to?: string; label?: string }>;
      const label = custom.detail?.label || "tab";
      setToast({
        type: "transition",
        message: `Loading ${label}...`,
        target: label,
      });

      // Failsafe auto-dismiss
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToast((curr) => (curr?.type === "transition" ? null : curr));
      }, 7000);
    };

    // 6. Navigation done / error
    const handleNavDone = () => {
      busyButtonsRef.current.forEach((btn) => setButtonBusy(btn, false));
      busyButtonsRef.current.clear();
      setToast(null);
    };

    const handleNavError = () => {
      busyButtonsRef.current.forEach((btn) => setButtonBusy(btn, false));
      busyButtonsRef.current.clear();
      setToast(null);
    };

    document.addEventListener("click", handleClick, true); // Capture phase to prevent duplicate events
    document.addEventListener("submit", handleSubmit, false);
    document.addEventListener("reset", handleReset, false);
    window.addEventListener("orbitwork:tab-transition-start", handleTabStart);
    window.addEventListener("orbitwork-nav-done", handleNavDone);
    window.addEventListener("orbitwork-nav-error", handleNavError);

    return () => {
      window.fetch = origFetch;
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, false);
      document.removeEventListener("reset", handleReset, false);
      window.removeEventListener("orbitwork:tab-transition-start", handleTabStart);
      window.removeEventListener("orbitwork-nav-done", handleNavDone);
      window.removeEventListener("orbitwork-nav-error", handleNavError);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className={`global-interaction-toast ${toast.type === "error" ? "is-error" : ""}`}
      role="status"
      aria-live="polite"
    >
      {toast.type === "transition" ? (
        <>
          <span className="toast-spinner" aria-hidden="true" />
          <span>
            Loading <strong>{toast.target}</strong> view...
          </span>
        </>
      ) : (
        <span>{toast.message}</span>
      )}
    </div>
  );
}

export default function GlobalInteractionFeedback() {
  return (
    <Suspense fallback={null}>
      <GlobalFeedbackManager />
    </Suspense>
  );
}
