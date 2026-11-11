"use client";

import { useEffect } from "react";
import { RefreshCw, ArrowLeft, AlertTriangle } from "lucide-react";

function isTransientNetworkOrChunkError(error: Error): boolean {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    msg.includes("network error") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("chunkloaderror") ||
    msg.includes("loading chunk") ||
    msg.includes("connection")
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNetwork = isTransientNetworkOrChunkError(error);

  useEffect(() => {
    window.dispatchEvent(new Event("orbitwork-nav-done"));

    if (isNetwork && typeof window !== "undefined") {
      try {
        const lastReload = Number(
          sessionStorage.getItem("orbitwork_auto_reload_ts") || "0"
        );
        const now = Date.now();
        if (!lastReload || now - lastReload > 15000) {
          sessionStorage.setItem("orbitwork_auto_reload_ts", String(now));
          window.location.reload();
        }
      } catch {
        // Ignore storage restrictions
      }
    }
  }, [error, isNetwork]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "var(--app-bg, #f7f9f7)",
        color: "var(--ink, #17231f)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <section
        role="alert"
        style={{
          width: "min(100%, 460px)",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #e4e9e5)",
          borderRadius: "12px",
          padding: "28px",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.08)",
          display: "grid",
          gap: "14px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "rgba(22, 124, 88, 0.1)",
            color: "var(--green, #167c58)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <AlertTriangle size={20} />
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <h1
            style={{
              margin: 0,
              font: "750 20px/1.25 Manrope, system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            {isNetwork ? "Connection interrupted" : "Something went wrong"}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "13.5px",
              lineHeight: 1.55,
              color: "var(--muted, #69766f)",
            }}
          >
            {isNetwork
              ? "The network connection reset while loading this view. Retry to reconnect or reload the page cleanly."
              : "An unexpected error occurred while rendering this view. Your data is safe—try again or reload."}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: "36px",
              padding: "0 14px",
              borderRadius: "7px",
              border: 0,
              background: "var(--green, #167c58)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            <span>Try again</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              height: "36px",
              padding: "0 14px",
              borderRadius: "7px",
              border: "1px solid var(--line, #dce3de)",
              background: "var(--surface, #ffffff)",
              color: "var(--ink, #17231f)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>

          <a
            href="/dashboard"
            style={{
              height: "36px",
              padding: "0 12px",
              borderRadius: "7px",
              color: "var(--muted, #69766f)",
              fontSize: "13px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />
            <span>Overview</span>
          </a>
        </div>
      </section>
    </main>
  );
}
