"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, AlertCircle } from "lucide-react";

interface ExcelPreviewViewerProps {
  url: string;
}

export default function ExcelPreviewViewer({
  url,
  height = "76vh",
}: {
  url: string;
  height?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetHtml, setSheetHtml] = useState<string>("");
  const workbookRef = useRef<XLSX.WorkBook | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadWorkbook() {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch spreadsheet (${response.status} ${response.statusText})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (!isMounted) return;

        const wb = XLSX.read(arrayBuffer, { type: "array" });
        workbookRef.current = wb;

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error("No sheets found in this workbook.");
        }

        setSheetNames(wb.SheetNames);
        const firstSheet = wb.SheetNames[0];
        setActiveSheet(firstSheet);

        const ws = wb.Sheets[firstSheet];
        const html = XLSX.utils.sheet_to_html(ws, { id: "excel-preview-table", editable: false });
        setSheetHtml(html);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to parse Excel file:", err);
        if (isMounted) {
          setError(err.message || "Failed to parse spreadsheet file");
          setLoading(false);
        }
      }
    }

    loadWorkbook();

    return () => {
      isMounted = false;
    };
  }, [url]);

  const handleSelectSheet = (name: string) => {
    setActiveSheet(name);
    if (workbookRef.current && workbookRef.current.Sheets[name]) {
      const ws = workbookRef.current.Sheets[name];
      const html = XLSX.utils.sheet_to_html(ws, { id: "excel-preview-table", editable: false });
      setSheetHtml(html);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12, color: "var(--muted)" }}>
        <Loader2 size={26} className="animate-spin text-green" />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Reading Excel spreadsheet…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 10, color: "#dc2626" }}>
        <AlertCircle size={28} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Could not render Excel spreadsheet</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{error}</span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height, display: "flex", flexDirection: "column", background: "var(--paper, #fff)" }}>
      {/* Sheet Tabs Header */}
      {sheetNames.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            background: "var(--surface, #f8fafc)",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted, #64748b)", textTransform: "uppercase", marginRight: 4 }}>
            Sheets:
          </span>
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleSelectSheet(name)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: activeSheet === name ? 600 : 500,
                border: activeSheet === name ? "1px solid #16a34a" : "1px solid var(--line, #cbd5e1)",
                background: activeSheet === name ? "#f0fdf4" : "var(--paper, #fff)",
                color: activeSheet === name ? "#15803d" : "var(--ink, #334155)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Spreadsheet Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
          background: "var(--paper, #fff)",
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: sheetHtml }}
          className="excel-preview-wrapper"
          style={{
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        />
        <style jsx global>{`
          .excel-preview-wrapper table {
            border-collapse: collapse;
            width: 100%;
            min-width: 600px;
            font-size: 12px;
            color: var(--ink, #1e293b);
          }
          .excel-preview-wrapper th,
          .excel-preview-wrapper td {
            border: 1px solid var(--line, #cbd5e1);
            padding: 6px 10px;
            text-align: left;
            white-space: nowrap;
          }
          .excel-preview-wrapper tr:first-child td,
          .excel-preview-wrapper th {
            background-color: var(--surface, #f8fafc);
            font-weight: 600;
          }
          .excel-preview-wrapper tr:nth-child(even) td {
            background-color: rgba(248, 250, 252, 0.4);
          }
          .excel-preview-wrapper tr:hover td {
            background-color: rgba(22, 163, 74, 0.05);
          }
        `}</style>
      </div>
    </div>
  );
}
