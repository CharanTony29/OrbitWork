"use client";

import { useEffect } from "react";

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

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f7f9f7",
          color: "#17231f",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <section
          role="alert"
          style={{
            width: "min(100%, 440px)",
            background: "#ffffff",
            border: "1px solid #e4e9e5",
            borderRadius: "12px",
            padding: "28px",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.08)",
            display: "grid",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "#167c58",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "15px",
              }}
            >
              O
            </span>
            <strong style={{ fontSize: "16px", letterSpacing: "-0.02em" }}>
              Orbit<span style={{ color: "#167c58" }}>Work</span>
            </strong>
          </div>

          <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700 }}>
            {isNetwork ? "Connection reset — please reload" : "Unable to display this page"}
          </h1>

          <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.55, color: "#637169" }}>
            {isNetwork
              ? "A transient network drop or new deployment interrupted page loading. Reload to resume where you left off."
              : "An unexpected client error occurred. Reload the page or retry."}
          </p>

          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                height: "36px",
                padding: "0 16px",
                borderRadius: "7px",
                border: 0,
                background: "#167c58",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload OrbitWork
            </button>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: "36px",
                padding: "0 14px",
                borderRadius: "7px",
                border: "1px solid #d9e1dc",
                background: "#ffffff",
                color: "#17231f",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </section>
      </body>
    </html>
  );
}
