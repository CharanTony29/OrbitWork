"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Download,
  FileSpreadsheet,
  FileCode,
  FileText,
  Check,
  Bookmark,
  Plus,
  Trash2,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatMinutes, formatRemaining } from "@/lib/work";

export type ExportFormat = "excel" | "html" | "csv";

export interface ExportColumnDef {
  id: string;
  label: string;
  category: "core" | "time" | "metadata" | "custom";
}

interface SavedTemplate {
  id: string;
  name: string;
  format: ExportFormat;
  columns: string[];
}

interface ProjectExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  tasks: Array<any>;
  statuses: Array<{ id: string; name: string; color: string; category?: string }>;
  members: Array<{ id: string; label: string; email?: string }>;
  customFields?: Array<{ id: string; name: string; field_type: string }>;
}

const BUILTIN_TEMPLATES: SavedTemplate[] = [
  {
    id: "executive",
    name: "Executive Summary",
    format: "excel",
    columns: ["title", "status", "priority", "primary_assignee", "due_date"],
  },
  {
    id: "time_tracking",
    name: "Time & Workload Tracking",
    format: "excel",
    columns: ["title", "primary_assignee", "estimate", "worked", "remaining", "due_date"],
  },
  {
    id: "sprint_delivery",
    name: "Sprint & Delivery Status",
    format: "csv",
    columns: ["generated_key", "title", "status", "priority", "due_date", "tags"],
  },
  {
    id: "full_backup",
    name: "Full Audit & Backup",
    format: "html",
    columns: [
      "generated_key",
      "title",
      "status",
      "priority",
      "primary_assignee",
      "all_assignees",
      "due_date",
      "created_at",
      "estimate",
      "worked",
      "remaining",
      "tags",
      "description",
    ],
  },
];

export default function ProjectExportModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  tasks,
  statuses,
  members,
  customFields = [],
}: ProjectExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("excel");
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(["title", "status", "priority", "primary_assignee", "due_date"])
  );
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("executive");

  const storageKey = `orbitwork:export-templates:${projectId}`;

  // Load custom saved templates from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    } catch {}
  }, [storageKey]);

  // Available column definitions including project custom fields
  const allColumns: ExportColumnDef[] = useMemo(() => {
    const list: ExportColumnDef[] = [
      { id: "generated_key", label: "Task Key (ID)", category: "core" },
      { id: "title", label: "Task Title / Name", category: "core" },
      { id: "status", label: "Status", category: "core" },
      { id: "priority", label: "Priority", category: "core" },
      { id: "primary_assignee", label: "Primary Assignee", category: "core" },
      { id: "all_assignees", label: "All Assignees", category: "core" },
      { id: "due_date", label: "Due Date", category: "core" },
      { id: "estimate", label: "Estimated Effort", category: "time" },
      { id: "worked", label: "Worked / Billable Time", category: "time" },
      { id: "remaining", label: "Remaining Balance", category: "time" },
      { id: "tags", label: "Tags / Labels", category: "metadata" },
      { id: "created_at", label: "Created Date", category: "metadata" },
      { id: "description", label: "Description / Notes", category: "metadata" },
    ];

    customFields.forEach((cf) => {
      list.push({
        id: `cf_${cf.id}`,
        label: `${cf.name} (${cf.field_type})`,
        category: "custom",
      });
    });

    return list;
  }, [customFields]);

  if (!isOpen) return null;

  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
    setActiveTemplateId("");
  };

  const selectAll = () => {
    setSelectedColumns(new Set(allColumns.map((c) => c.id)));
    setActiveTemplateId("");
  };

  const deselectAll = () => {
    setSelectedColumns(new Set(["title"]));
    setActiveTemplateId("");
  };

  const applyTemplate = (t: SavedTemplate) => {
    setActiveTemplateId(t.id);
    setSelectedFormat(t.format);
    setSelectedColumns(new Set(t.columns));
  };

  const handleSaveCustomTemplate = () => {
    if (!newTemplateName.trim()) return;
    const newT: SavedTemplate = {
      id: `custom_${Date.now()}`,
      name: newTemplateName.trim(),
      format: selectedFormat,
      columns: Array.from(selectedColumns),
    };
    const nextList = [...savedTemplates, newT];
    setSavedTemplates(nextList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextList));
    } catch {}
    setActiveTemplateId(newT.id);
    setNewTemplateName("");
    setShowSaveInput(false);
  };

  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = savedTemplates.filter((t) => t.id !== id);
    setSavedTemplates(nextList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextList));
    } catch {}
    if (activeTemplateId === id) setActiveTemplateId("");
  };

  // Maps task value to string based on column ID
  const getTaskCellValue = (task: any, colId: string): string => {
    const statusObj = statuses.find((s) => s.id === task.status_id);
    const memberMap = new Map(members.map((m) => [m.id, m.label]));

    switch (colId) {
      case "generated_key":
        return task.generated_key || task.id.slice(0, 8);
      case "title":
        return task.title || "Untitled";
      case "status":
        return statusObj?.name || "Open";
      case "priority":
        return (task.priority || "normal").toUpperCase();
      case "primary_assignee": {
        const id = task.primary_assignee_id || (task.assigneeIds && task.assigneeIds[0]);
        return id ? memberMap.get(id) || "Unassigned" : "Unassigned";
      }
      case "all_assignees": {
        const ids: string[] = task.assigneeIds || [];
        if (task.primary_assignee_id && !ids.includes(task.primary_assignee_id)) {
          ids.unshift(task.primary_assignee_id);
        }
        if (task.secondary_assignee_id && !ids.includes(task.secondary_assignee_id)) {
          ids.push(task.secondary_assignee_id);
        }
        return ids.map((id) => memberMap.get(id) || "Member").join(", ") || "Unassigned";
      }
      case "due_date":
        return task.due_date || "-";
      case "estimate":
        return task.estimate_minutes ? formatMinutes(task.estimate_minutes) : "-";
      case "worked":
        return task.billable_minutes ? formatMinutes(task.billable_minutes) : "0m";
      case "remaining":
        return task.estimate_minutes
          ? formatRemaining(task.estimate_minutes, task.billable_minutes || 0).label
          : "-";
      case "tags":
        return Array.isArray(task.tags) ? task.tags.join(", ") : "-";
      case "created_at":
        return task.created_at ? new Date(task.created_at).toLocaleDateString() : "-";
      case "description":
        return (task.description || "").replace(/\r?\n/g, " ").slice(0, 500);
      default:
        if (colId.startsWith("cf_")) {
          const cfId = colId.slice(3);
          const cfValues = task.custom_field_values || {};
          const val = cfValues[cfId];
          return val !== undefined && val !== null ? String(val) : "-";
        }
        return "-";
    }
  };

  const handleDownload = () => {
    const colsToExport = allColumns.filter((c) => selectedColumns.has(c.id));
    if (colsToExport.length === 0) return;

    const dateStr = new Date().toISOString().slice(0, 10);
    const sanitizedProject = projectName.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (selectedFormat === "csv") {
      // Generate CSV
      const headers = colsToExport.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
      const rows = tasks.map((task) =>
        colsToExport
          .map((col) => {
            const val = getTaskCellValue(task, col.id);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(",")
      );
      const csvContent = "\uFEFF" + [headers, ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `${sanitizedProject}_Tasks_${dateStr}.csv`);
    } else if (selectedFormat === "excel") {
      // Generate Excel XML Spreadsheet (native Excel format, opens cleanly without 3rd party bloat)
      const xml = generateExcelXml(projectName, colsToExport, tasks);
      const blob = new Blob([xml], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBlob(blob, `${sanitizedProject}_Report_${dateStr}.xls`);
    } else if (selectedFormat === "html") {
      // Generate Styled HTML Executive Report
      const html = generateHtmlReport(projectName, colsToExport, tasks, statuses);
      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
      downloadBlob(blob, `${sanitizedProject}_Report_${dateStr}.html`);
    }

    onClose();
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate Excel 2003 XML Spreadsheet
  const generateExcelXml = (
    projName: string,
    cols: ExportColumnDef[],
    taskList: any[]
  ) => {
    const headerRow = cols
      .map(
        (c) =>
          `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`
      )
      .join("");

    const dataRows = taskList
      .map((t) => {
        const cells = cols
          .map((c) => {
            const val = getTaskCellValue(t, c.id);
            return `<Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
          })
          .join("");
        return `<Row ss:Height="20">${cells}</Row>`;
      })
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#167c58"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#167c58" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Data">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1e293b"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(projName)}">
  <Table ss:DefaultRowHeight="18">
   ${cols.map(() => `<Column ss:Width="130"/>`).join("")}
   <Row ss:Height="24">${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
  };

  // Generate Styled HTML Executive Report
  const generateHtmlReport = (
    projName: string,
    cols: ExportColumnDef[],
    taskList: any[],
    statusList: any[]
  ) => {
    const totalCount = taskList.length;
    const openCount = taskList.filter((t) => {
      const s = statusList.find((x) => x.id === t.status_id);
      return !s?.category?.toLowerCase().includes("closed") && !s?.category?.toLowerCase().includes("complete");
    }).length;
    const completedCount = totalCount - openCount;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeXml(projName)} — Status & Tasks Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 36px 48px; }
    .report-card { max-width: 1200px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.05); overflow: hidden; }
    .report-header { padding: 32px; background: linear-gradient(135deg, #0c6243 0%, #167c58 100%); color: #ffffff; display: flex; justify-content: space-between; align-items: center; }
    .report-header h1 { margin: 0 0 6px; font-size: 26px; font-weight: 800; }
    .report-header p { margin: 0; opacity: 0.85; font-size: 13px; }
    .metrics-bar { display: flex; gap: 24px; padding: 20px 32px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .metric { display: flex; flex-direction: column; }
    .metric-val { font-size: 20px; font-weight: 800; color: #0c6243; }
    .metric-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f8fafc; color: #475569; font-weight: 700; text-align: left; padding: 12px 16px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; }
    td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #334155; }
    tr:hover td { background: #fafcff; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; }
    .footer { padding: 20px 32px; font-size: 11px; color: #94a3b8; text-align: right; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="report-header">
      <div>
        <h1>${escapeXml(projName)}</h1>
        <p>Project Tasks &amp; Status Executive Report &bull; Generated on ${new Date().toLocaleString()}</p>
      </div>
      <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">OrbitWork</div>
    </div>
    <div class="metrics-bar">
      <div class="metric"><span class="metric-val">${totalCount}</span><span class="metric-lbl">Total Tasks</span></div>
      <div class="metric"><span class="metric-val">${openCount}</span><span class="metric-lbl">Open Tasks</span></div>
      <div class="metric"><span class="metric-val">${completedCount}</span><span class="metric-lbl">Completed</span></div>
    </div>
    <table>
      <thead>
        <tr>${cols.map((c) => `<th>${escapeXml(c.label)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${taskList
          .map(
            (t) =>
              `<tr>${cols
                .map((c) => `<td>${escapeXml(getTaskCellValue(t, c.id))}</td>`)
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
    <div class="footer">Generated by OrbitWork Work Management System</div>
  </div>
</body>
</html>`;
  };

  const escapeXml = (str: string) => {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(100%, 720px)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface, #ffffff)",
          color: "var(--ink, #0f172a)",
          borderRadius: "16px",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                background: "rgba(22, 124, 88, 0.12)",
                color: "var(--green, #167c58)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Download size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Export Project Tasks</h2>
              <span style={{ fontSize: "12px", color: "var(--muted, #64748b)" }}>
                {projectName} &bull; {tasks.length} total tasks
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              padding: "4px",
              color: "var(--muted, #64748b)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "grid", gap: "20px" }}>
          {/* Section 1: Export Format */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #64748b)", display: "block", marginBottom: "8px" }}>
              1. CHOOSE EXPORT FORMAT
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              {[
                { format: "excel", label: "Excel Spreadsheet", ext: ".xls", icon: FileSpreadsheet, color: "#167c58" },
                { format: "html", label: "Executive HTML Report", ext: ".html", icon: FileCode, color: "#2563eb" },
                { format: "csv", label: "CSV Data File", ext: ".csv", icon: FileText, color: "#d97706" },
              ].map((item) => {
                const isSelected = selectedFormat === item.format;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.format}
                    type="button"
                    onClick={() => setSelectedFormat(item.format as ExportFormat)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: isSelected ? `2px solid ${item.color}` : "1px solid var(--line, #e2e8f0)",
                      background: isSelected ? "rgba(22, 124, 88, 0.05)" : "var(--surface, #ffffff)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: "6px" }}>
                      <IconComponent size={18} style={{ color: item.color }} />
                      {isSelected && <Check size={14} style={{ color: item.color }} />}
                    </div>
                    <strong style={{ fontSize: "13px", color: "var(--ink, #0f172a)" }}>{item.label}</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>{item.ext} file</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Reusable Saved Templates */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #64748b)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Bookmark size={13} style={{ color: "var(--green)" }} />
                <span>2. TEMPLATES (SAMPLE &amp; SAVED)</span>
              </label>
              {!showSaveInput && (
                <button
                  type="button"
                  onClick={() => setShowSaveInput(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "transparent",
                    border: 0,
                    color: "var(--green, #167c58)",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={12} />
                  <span>Save Current as Template</span>
                </button>
              )}
            </div>

            {showSaveInput && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: "var(--surface-subtle, #f8fafc)",
                  border: "1px solid var(--line, #cbd5e1)",
                  borderRadius: "8px",
                  marginBottom: "10px",
                }}
              >
                <input
                  type="text"
                  placeholder="e.g. Weekly Management Export"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  style={{
                    flex: 1,
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    fontSize: "12.5px",
                    color: "var(--ink, #0f172a)",
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveCustomTemplate}
                  disabled={!newTemplateName.trim()}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: "var(--green, #167c58)",
                    color: "#ffffff",
                    border: 0,
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: newTemplateName.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveInput(false)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "transparent",
                    color: "var(--muted, #64748b)",
                    border: 0,
                    fontSize: "11.5px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {BUILTIN_TEMPLATES.map((t) => {
                const isActive = activeTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      borderRadius: "999px",
                      border: isActive ? "1px solid var(--green, #167c58)" : "1px solid var(--line, #e2e8f0)",
                      background: isActive ? "rgba(22, 124, 88, 0.12)" : "var(--surface, #ffffff)",
                      color: isActive ? "var(--green, #167c58)" : "var(--ink, #334155)",
                      fontSize: "11.5px",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    <Sparkles size={11} style={{ opacity: 0.7 }} />
                    <span>{t.name}</span>
                  </button>
                );
              })}

              {savedTemplates.map((t) => {
                const isActive = activeTemplateId === t.id;
                return (
                  <span
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      border: isActive ? "1px solid #7c3aed" : "1px solid var(--line, #e2e8f0)",
                      background: isActive ? "rgba(124, 58, 237, 0.12)" : "var(--surface, #ffffff)",
                      color: isActive ? "#7c3aed" : "var(--ink, #334155)",
                      fontSize: "11.5px",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    <Bookmark size={11} />
                    <span>{t.name}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomTemplate(t.id, e)}
                      title="Delete template"
                      style={{
                        background: "transparent",
                        border: 0,
                        padding: 0,
                        marginLeft: 2,
                        cursor: "pointer",
                        color: "var(--muted, #64748b)",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Section 3: Attribute / Field Selection */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #64748b)" }}>
                3. SELECT ATTRIBUTES TO EXPORT ({selectedColumns.size} SELECTED)
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--green, #167c58)",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--muted, #64748b)",
                    fontSize: "11.5px",
                    cursor: "pointer",
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "8px",
                maxHeight: "220px",
                overflowY: "auto",
                padding: "8px 10px",
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: "10px",
                background: "var(--surface-subtle, #f8fafc)",
              }}
            >
              {allColumns.map((col) => {
                const checked = selectedColumns.has(col.id);
                return (
                  <label
                    key={col.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background: checked ? "var(--surface, #ffffff)" : "transparent",
                      border: checked ? "1px solid var(--line, #cbd5e1)" : "1px solid transparent",
                      cursor: "pointer",
                      fontSize: "12px",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(col.id)}
                      style={{ accentColor: "var(--green, #167c58)", width: 14, height: 14 }}
                    />
                    <span style={{ fontWeight: checked ? 650 : 450, color: checked ? "var(--ink, #0f172a)" : "var(--muted, #64748b)" }}>
                      {col.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--line, #e2e8f0)",
            background: "var(--surface-subtle, #f8fafc)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--muted, #64748b)" }}>
            Ready to export <strong>{tasks.length}</strong> tasks with <strong>{selectedColumns.size}</strong> columns
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid var(--line, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                color: "var(--ink, #334155)",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={selectedColumns.size === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "8px",
                border: 0,
                background: selectedColumns.size === 0 ? "var(--muted, #94a3b8)" : "var(--green, #167c58)",
                color: "#ffffff",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: selectedColumns.size === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 2px 6px rgba(22, 124, 88, 0.25)",
              }}
            >
              <Download size={14} />
              <span>Download {selectedFormat.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
