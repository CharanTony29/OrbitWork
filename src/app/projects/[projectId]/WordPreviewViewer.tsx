"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface WordPreviewViewerProps {
  url: string;
}

export default function WordPreviewViewer({
  url,
  height = "76vh",
}: {
  url: string;
  height?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadDocx() {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch document (${response.status} ${response.statusText})`);
        }
        const blob = await response.blob();
        if (!isMounted) return;

        const docx = await import("docx-preview");
        if (containerRef.current && isMounted) {
          containerRef.current.innerHTML = "";
          await docx.renderAsync(blob, containerRef.current, undefined, {
            className: "docx-rendered-document",
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
          });
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to render Word docx file:", err);
        if (isMounted) {
          setError(err.message || "Failed to render Word document");
          setLoading(false);
        }
      }
    }

    loadDocx();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <div
      style={{
        width: "100%",
        height,
        display: "flex",
        flexDirection: "column",
        background: "#f1f5f9",
        overflow: "hidden",
      }}
    >
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12, color: "var(--muted)" }}>
          <Loader2 size={26} className="animate-spin text-green" />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Rendering Word document…</span>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 10, color: "#dc2626" }}>
          <AlertCircle size={28} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Could not render Word document</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{error}</span>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
          display: loading || error ? "none" : "block",
        }}
      >
        <div
          ref={containerRef}
          style={{
            margin: "0 auto",
            maxWidth: "850px",
            background: "#ffffff",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
            borderRadius: 6,
            minHeight: "100%",
            padding: "20px",
          }}
        />
      </div>
    </div>
  );
}
