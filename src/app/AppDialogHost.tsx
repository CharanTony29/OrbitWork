"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  APP_CONFIRM_EVENT,
  APP_PROMPT_EVENT,
  APP_TOAST_EVENT,
  type AppConfirmRequest,
  type AppPromptRequest,
  type AppToastDetail,
} from "@/lib/app-feedback";

export default function AppDialogHost() {
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<AppToastDetail[]>([]);
  const [confirmReq, setConfirmReq] = useState<AppConfirmRequest | null>(null);
  const [promptReq, setPromptReq] = useState<AppPromptRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    setMounted(true);

    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<AppToastDetail>).detail;
      if (!detail) return;
      setToasts((prev) => [...prev.slice(-3), detail]);
      const duration = detail.durationMs ?? (detail.type === "error" ? 6500 : 4200);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, duration);
    };

    const onConfirm = (e: Event) => {
      const detail = (e as CustomEvent<AppConfirmRequest>).detail;
      if (!detail) return;
      setConfirmReq((prev) => {
        if (prev) prev.resolve(false);
        return detail;
      });
    };

    const onPrompt = (e: Event) => {
      const detail = (e as CustomEvent<AppPromptRequest>).detail;
      if (!detail) return;
      setPromptValue(detail.options.defaultValue ?? "");
      setPromptReq((prev) => {
        if (prev) prev.resolve(null);
        return detail;
      });
    };

    window.addEventListener(APP_TOAST_EVENT, onToast);
    window.addEventListener(APP_CONFIRM_EVENT, onConfirm);
    window.addEventListener(APP_PROMPT_EVENT, onPrompt);

    return () => {
      window.removeEventListener(APP_TOAST_EVENT, onToast);
      window.removeEventListener(APP_CONFIRM_EVENT, onConfirm);
      window.removeEventListener(APP_PROMPT_EVENT, onPrompt);
    };
  }, []);

  useEffect(() => {
    if (!confirmReq && !promptReq) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmReq) {
          confirmReq.resolve(false);
          setConfirmReq(null);
        }
        if (promptReq) {
          promptReq.resolve(null);
          setPromptReq(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReq, promptReq]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* In-App Orbitwork Toast Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: 18,
            right: 20,
            zIndex: 20010,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxWidth: 400,
            width: "calc(100vw - 40px)",
            pointerEvents: "none",
          }}
        >
          {toasts.map((toast) => {
            const accent =
              toast.type === "error"
                ? "#dc2626"
                : toast.type === "warning"
                ? "#d97706"
                : toast.type === "success"
                ? "#167c58"
                : "#2563eb";
            const Icon =
              toast.type === "error"
                ? AlertCircle
                : toast.type === "warning"
                ? AlertTriangle
                : toast.type === "success"
                ? CheckCircle2
                : Info;
            return (
              <div
                key={toast.id}
                role="status"
                style={{
                  pointerEvents: "auto",
                  background: "var(--surface, #ffffff)",
                  color: "var(--ink, #17231f)",
                  border: "1px solid var(--line, #dfe5e0)",
                  borderLeft: `4px solid ${accent}`,
                  borderRadius: 11,
                  padding: "12px 14px",
                  boxShadow: "0 14px 36px rgba(15, 23, 20, 0.2)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                }}
              >
                <Icon size={17} style={{ color: accent, flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {toast.title && (
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{toast.title}</div>
                  )}
                  <div style={{ wordBreak: "break-word" }}>{toast.message}</div>
                  {toast.actionHref && toast.actionLabel && (
                    <Link
                      href={toast.actionHref}
                      onClick={() =>
                        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                      }
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--green, #167c58)",
                        textDecoration: "underline",
                      }}
                    >
                      {toast.actionLabel} →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() =>
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                  }
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--muted, #64748b)",
                    cursor: "pointer",
                    padding: 2,
                    display: "inline-flex",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Orbitwork Confirm Modal */}
      {confirmReq && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            confirmReq.resolve(false);
            setConfirmReq(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20020,
            background: "rgba(10, 18, 14, 0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 420px)",
              background: "var(--surface, #ffffff)",
              color: "var(--ink, #17231f)",
              border: "1px solid var(--line, #dfe5e0)",
              borderRadius: 14,
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid var(--line, #e8ede8)",
              }}
            >
              <strong style={{ fontSize: 14.5 }}>
                {confirmReq.options.title || "Confirm Action"}
              </strong>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  confirmReq.resolve(false);
                  setConfirmReq(null);
                }}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 4,
                }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: "16px 18px", fontSize: 13, lineHeight: 1.55 }}>
              {confirmReq.options.message}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "12px 18px",
                borderTop: "1px solid var(--line, #e8ede8)",
                background: "var(--surface-subtle, #f8faf8)",
              }}
            >
              <button
                type="button"
                className="button button-secondary"
                style={{ minHeight: 34, padding: "0 14px", fontSize: 12 }}
                onClick={() => {
                  confirmReq.resolve(false);
                  setConfirmReq(null);
                }}
              >
                {confirmReq.options.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                className="button button-primary"
                style={{
                  minHeight: 34,
                  padding: "0 14px",
                  fontSize: 12,
                  background: confirmReq.options.destructive ? "#dc2626" : undefined,
                }}
                onClick={() => {
                  confirmReq.resolve(true);
                  setConfirmReq(null);
                }}
              >
                {confirmReq.options.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Orbitwork Prompt Modal */}
      {promptReq && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            promptReq.resolve(null);
            setPromptReq(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20020,
            background: "rgba(10, 18, 14, 0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const val = promptValue.trim();
              promptReq.resolve(val || null);
              setPromptReq(null);
            }}
            style={{
              width: "min(100%, 440px)",
              background: "var(--surface, #ffffff)",
              color: "var(--ink, #17231f)",
              border: "1px solid var(--line, #dfe5e0)",
              borderRadius: 14,
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid var(--line, #e8ede8)",
              }}
            >
              <strong style={{ fontSize: 14.5 }}>
                {promptReq.options.title || "Enter Value"}
              </strong>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  promptReq.resolve(null);
                  setPromptReq(null);
                }}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 4,
                }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: "16px 18px", display: "grid", gap: 10 }}>
              <label style={{ fontSize: 12.5, color: "var(--ink)" }}>
                {promptReq.options.message}
              </label>
              <input
                type="text"
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptReq.options.placeholder || ""}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line, #dfe5e0)",
                  background: "var(--paper, #ffffff)",
                  color: "var(--ink, #17231f)",
                  fontSize: 13,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "12px 18px",
                borderTop: "1px solid var(--line, #e8ede8)",
                background: "var(--surface-subtle, #f8faf8)",
              }}
            >
              <button
                type="button"
                className="button button-secondary"
                style={{ minHeight: 34, padding: "0 14px", fontSize: 12 }}
                onClick={() => {
                  promptReq.resolve(null);
                  setPromptReq(null);
                }}
              >
                {promptReq.options.cancelLabel || "Cancel"}
              </button>
              <button
                type="submit"
                className="button button-primary"
                style={{ minHeight: 34, padding: "0 14px", fontSize: 12 }}
              >
                {promptReq.options.confirmLabel || "OK"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>,
    document.body
  );
}
