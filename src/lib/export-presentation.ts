import PptxGenJS from "pptxgenjs";
import {
  getTemplateById,
  getArchetype,
  type PresentationTemplate,
  type DesignArchetype,
} from "./presentation/templates.ts";

export type ReportPeriodType = "weekly" | "monthly" | "yearly" | "custom" | "all";

export interface TaskReportItem {
  id: string;
  key: string;
  title: string;
  taskType?: string;
  statusId: string;
  statusName: string;
  statusColor?: string;
  statusCategory?: string; // "not_started" | "in_progress" | "completed" | "cancelled"
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  startDate?: string | null;
  createdAt: string;
  assignees: { id: string; name: string }[];
  isCompleted: boolean;
  isOverdue: boolean;
  isHold: boolean;
  isInProgress: boolean;
  isPending: boolean;
  estimatedHours?: number;
}

export type PresentationThemeStyle =
  | "executive"
  | "emerald"
  | "sapphire"
  | "crimson"
  | "minimal"
  | "custom";

export interface PresentationCustomColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
}

export interface PresentationReportOptions {
  projectName: string;
  workspaceName?: string;
  organizationName?: string;
  periodType: ReportPeriodType;
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  includeCatalog?: boolean;
  style?: PresentationThemeStyle;
  templateId?: string;
  customColors?: PresentationCustomColors;
  aiPrompt?: string;
  selectedSections?: string[];
  selectedCharts?: string[];
}

export interface StatusMetric {
  id: string;
  name: string;
  color?: string;
  category?: string;
  count: number;
}

export interface ResourceMetric {
  id: string;
  name: string;
  totalAssigned: number;
  completedCount: number;
  inProgressCount: number;
  holdCount: number;
  pendingCount: number;
  overdueCount: number;
}

interface DeckContext {
  pptx: PptxGenJS;
  template: PresentationTemplate;
  options: PresentationReportOptions;
  tasks: TaskReportItem[];
  statuses: StatusMetric[];
  resources: ResourceMetric[];
  totalTasks: number;
  completedTasks: TaskReportItem[];
  inProgressTasks: TaskReportItem[];
  holdTasks: TaskReportItem[];
  pendingTasks: TaskReportItem[];
  overdueTasks: TaskReportItem[];
  completionRate: number;
  inProgressRate: number;
  holdRate: number;
  pendingRate: number;
  C_BG: string;
  C_CARD: string;
  C_BORDER: string;
  C_PRIMARY: string;
  C_SECONDARY: string;
  C_ACCENT: string;
  C_ACCENT2: string;
  C_GOLD: string;
  C_AMBER: string;
  C_CRIMSON: string;
  C_EMERALD: string;
  FONT_TITLE: string;
  FONT_BODY: string;
}

function addNavButtons(slide: PptxGenJS.Slide, ctx: DeckContext) {
  const navItems = [
    { label: "Executive", slideNum: 2 },
    { label: "Status", slideNum: 3 },
    { label: "Workload", slideNum: 4 },
    { label: "Critical", slideNum: 5 },
    { label: "Catalog", slideNum: 6 },
  ];
  navItems.forEach((item, idx) => {
    slide.addShape(ctx.pptx.ShapeType.roundRect, {
      x: 9.8 + idx * 0.68,
      y: 0.35,
      w: 0.63,
      h: 0.28,
      fill: { color: ctx.C_CARD },
      line: { color: ctx.C_BORDER, width: 1 },
      rectRadius: 0.05,
      hyperlink: { slide: item.slideNum },
    });
    slide.addText(item.label, {
      x: 9.8 + idx * 0.68,
      y: 0.35,
      w: 0.63,
      h: 0.28,
      fontSize: 8,
      bold: true,
      color: ctx.C_ACCENT,
      fontFace: ctx.FONT_BODY,
      align: "center",
      hyperlink: { slide: item.slideNum },
    });
  });
}

// =========================================================================
// 1. EDITORIAL & MAGAZINE DECK RENDERER (Pitch Editorial Sage, Nordic, etc.)
// =========================================================================
function renderEditorialDeck(ctx: DeckContext) {
  const { pptx, template, options } = ctx;

  // Slide 1: Cover Slide (Editorial Split Canvas)
  const slide1 = pptx.addSlide();
  slide1.background = { color: ctx.C_BG };
  if (template.transition && template.transition !== "none") (slide1 as any).transition = { type: template.transition };

  // Left vertical accent pillar
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0.8,
    y: 0.8,
    w: 0.08,
    h: 5.8,
    fill: { color: ctx.C_ACCENT },
    line: { color: ctx.C_ACCENT },
  });

  // Small uppercase kicker
  slide1.addText(
    `${(options.organizationName || "ORBITWORK").toUpperCase()} // EXECUTIVE BRIEFING`,
    { x: 1.1, y: 1.0, w: 10.0, h: 0.3, fontSize: 10, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE }
  );

  // Big Asymmetric Dual-Tone Title
  slide1.addText(
    [
      { text: "PROJECT STATUS &\n", options: { color: ctx.C_PRIMARY } },
      { text: "KPI REPORT", options: { color: ctx.C_ACCENT } },
    ],
    { x: 1.1, y: 1.4, w: 10.5, h: 1.4, fontSize: 38, bold: true, fontFace: ctx.FONT_TITLE }
  );

  slide1.addText(
    `Project: ${options.projectName}   •   Scope Confirmed & Deliverables Live Tracked`,
    { x: 1.1, y: 2.85, w: 10.5, h: 0.4, fontSize: 15, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  // Editorial Executive Takeaway Card (Left)
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 1.1,
    y: 3.6,
    w: 6.8,
    h: 2.1,
    fill: { color: ctx.C_CARD },
    line: { color: ctx.C_BORDER, width: 1 },
    rectRadius: 0.12,
  });

  slide1.addText("EXECUTIVE TAKEAWAY", {
    x: 1.35, y: 3.8, w: 6.3, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE
  });

  slide1.addText(
    `"Delivery trajectory remains healthy with ${ctx.completionRate}% completion across confirmed milestones. Workstream momentum is sustained with ${ctx.inProgressTasks.length} deliverables in active progress."`,
    { x: 1.35, y: 4.15, w: 6.3, h: 1.3, fontSize: 13, italic: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE }
  );

  // Timeframe & Scope Card (Right)
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 8.2,
    y: 3.6,
    w: 4.3,
    h: 2.1,
    fill: { color: ctx.C_CARD },
    line: { color: ctx.C_BORDER, width: 1 },
    rectRadius: 0.12,
  });

  slide1.addText("COMPLETION VELOCITY", {
    x: 8.45, y: 3.8, w: 3.8, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
  });
  slide1.addText(`${ctx.completionRate}%`, {
    x: 8.45, y: 4.05, w: 3.8, h: 0.7, fontSize: 36, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE
  });
  slide1.addText(`Period: ${options.periodLabel}\nTotal Scope: ${ctx.totalTasks} deliverables tracked`, {
    x: 8.45, y: 4.8, w: 3.8, h: 0.7, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  slide1.addText(
    `Orbitwork Executive Reporting Suite  •  Confidential  •  Generated on ${new Date().toLocaleDateString()}`,
    { x: 1.1, y: 6.7, w: 11.0, h: 0.3, fontSize: 9, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  // Slide 2: Executive Summary & Dual Focus
  const slide2 = pptx.addSlide();
  slide2.background = { color: ctx.C_BG };
  addNavButtons(slide2, ctx);

  slide2.addText("EXECUTIVE SUMMARY & INSIGHTS", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide2.addText("Delivery trajectory, execution velocity, and milestone performance", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  // Left Editorial Narrative Card (40% width)
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 4.8, h: 5.3, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.1
  });
  slide2.addText("EXECUTIVE NARRATIVE", {
    x: 1.05, y: 1.75, w: 4.3, h: 0.25, fontSize: 10, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE
  });
  slide2.addText(
    `"The team has reached a ${ctx.completionRate}% completion milestone. Progress across core deliverables remains aligned with target scheduling."`,
    { x: 1.05, y: 2.1, w: 4.3, h: 1.1, fontSize: 13, italic: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE }
  );

  const bulletItems = [
    `• Total Deliverables: ${ctx.totalTasks} items confirmed in scope`,
    `• Completed Deliverables: ${ctx.completedTasks.length} verified`,
    `• In Active Execution: ${ctx.inProgressTasks.length} deliverables`,
    `• On Hold / Awaiting Review: ${ctx.holdTasks.length} deliverables`,
    `• At Risk / Overdue: ${ctx.overdueTasks.length} items flagged`,
  ];
  slide2.addText(bulletItems.join("\n\n"), {
    x: 1.05, y: 3.3, w: 4.3, h: 3.2, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  // Right Top Card: Large Completion Focus
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 5.9, y: 1.5, w: 6.6, h: 2.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.1
  });
  slide2.addText("COMPLETION RATE BENCHMARK", {
    x: 6.15, y: 1.75, w: 6.1, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
  });
  slide2.addText(`${ctx.completionRate}%`, {
    x: 6.15, y: 2.05, w: 2.5, h: 0.8, fontSize: 44, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE
  });
  slide2.addText(
    `${ctx.completedTasks.length} of ${ctx.totalTasks} deliverables completed.\nSprint output is on pace with project timeline.`,
    { x: 8.8, y: 2.15, w: 3.5, h: 0.7, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  // Right Bottom Card: Bar Chart
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 5.9, y: 3.9, w: 6.6, h: 2.9, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.1
  });
  slide2.addText("DELIVERABLE VELOCITY BY STATUS", {
    x: 6.15, y: 4.1, w: 6.1, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
  });
  slide2.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Deliverables",
        labels: ["Completed", "In Progress", "On Hold", "Pending"],
        values: [ctx.completedTasks.length, ctx.inProgressTasks.length, ctx.holdTasks.length, ctx.pendingTasks.length],
      },
    ],
    {
      x: 6.1, y: 4.4, w: 6.2, h: 2.2,
      chartColors: [ctx.C_ACCENT, ctx.C_ACCENT2, ctx.C_AMBER, ctx.C_SECONDARY],
      barDir: "col",
      showValue: true,
      valGridLine: { color: ctx.C_BORDER, size: 0.5 },
      catAxisLabelColor: ctx.C_SECONDARY,
      valAxisLabelColor: ctx.C_SECONDARY,
    }
  );

  // Slide 3: Status Breakdown (Editorial Narrative Rows)
  const slide3 = pptx.addSlide();
  slide3.background = { color: ctx.C_BG };
  addNavButtons(slide3, ctx);

  slide3.addText("STATUS LIFECYCLE BREAKDOWN", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide3.addText("Progression of deliverables across development and review stages", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const statusRows: any[] = [
    { label: "Completed & Verified", count: ctx.completedTasks.length, pct: ctx.completionRate, color: ctx.C_ACCENT, desc: "Deliverables tested, signed off, and shipped to production." },
    { label: "In Active Execution", count: ctx.inProgressTasks.length, pct: ctx.inProgressRate, color: ctx.C_ACCENT2, desc: "Currently under development by assigned team members." },
    { label: "On Hold / Paused", count: ctx.holdTasks.length, pct: ctx.holdRate, color: ctx.C_AMBER, desc: "Awaiting client dependency, external review, or blocker resolution." },
    { label: "Pending / Backlog", count: ctx.pendingTasks.length, pct: ctx.pendingRate, color: ctx.C_SECONDARY, desc: "Scheduled for subsequent sprints and execution cycles." },
  ];

  statusRows.forEach((row, idx) => {
    const yPos = 1.5 + idx * 1.35;
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: 0.8, y: yPos, w: 7.2, h: 1.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide3.addText(row.label, {
      x: 1.05, y: yPos + 0.15, w: 3.5, h: 0.3, fontSize: 13, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
    });
    slide3.addText(row.desc, {
      x: 1.05, y: yPos + 0.5, w: 4.8, h: 0.55, fontSize: 10, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
    });
    slide3.addText(`${row.count}`, {
      x: 5.9, y: yPos + 0.15, w: 1.8, h: 0.5, fontSize: 22, bold: true, color: row.color, fontFace: ctx.FONT_TITLE, align: "right"
    });
    slide3.addText(`${row.pct}% of scope`, {
      x: 5.9, y: yPos + 0.65, w: 1.8, h: 0.35, fontSize: 10, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY, align: "right"
    });
  });

  // Right Side Doughnut Chart
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 8.3, y: 1.5, w: 4.2, h: 5.25, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.08
  });
  slide3.addText("STATUS DISTRIBUTION", {
    x: 8.55, y: 1.75, w: 3.7, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
  });
  slide3.addChart(
    pptx.ChartType.doughnut,
    [
      {
        name: "Status",
        labels: ["Completed", "In Progress", "On Hold", "Pending"],
        values: [ctx.completedTasks.length, ctx.inProgressTasks.length, ctx.holdTasks.length, ctx.pendingTasks.length],
      },
    ],
    {
      x: 8.4, y: 2.1, w: 4.0, h: 4.3,
      chartColors: [ctx.C_ACCENT, ctx.C_ACCENT2, ctx.C_AMBER, ctx.C_SECONDARY],
      holeSize: 60,
      showLegend: true,
      legendPos: "b",
      legendColor: ctx.C_SECONDARY,
      showPercent: true,
    }
  );

  // Slide 4: Resource Allocation (Magazine Contributor Cards)
  const slide4 = pptx.addSlide();
  slide4.background = { color: ctx.C_BG };
  addNavButtons(slide4, ctx);

  slide4.addText("RESOURCE ALLOCATION & WORKLOAD", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide4.addText("Active ownership, delivery contributions, and team capacity balance", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const topResources = ctx.resources.slice(0, 3);
  if (topResources.length === 0) {
    topResources.push({ id: "1", name: "Engineering Team", totalAssigned: ctx.totalTasks, completedCount: ctx.completedTasks.length, inProgressCount: ctx.inProgressTasks.length, holdCount: ctx.holdTasks.length, pendingCount: ctx.pendingTasks.length, overdueCount: ctx.overdueTasks.length });
  }

  topResources.forEach((res, idx) => {
    const xPos = 0.8 + idx * 3.95;
    slide4.addShape(pptx.ShapeType.roundRect, {
      x: xPos, y: 1.5, w: 3.75, h: 5.25, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.12
    });

    slide4.addShape(pptx.ShapeType.ellipse, {
      x: xPos + 0.3, y: 1.8, w: 0.7, h: 0.7, fill: { color: ctx.C_ACCENT }, line: { color: ctx.C_ACCENT }
    });
    slide4.addText(res.name.charAt(0).toUpperCase(), {
      x: xPos + 0.3, y: 1.8, w: 0.7, h: 0.7, fontSize: 16, bold: true, color: "FFFFFF", fontFace: ctx.FONT_TITLE, align: "center"
    });

    slide4.addText(res.name, {
      x: xPos + 1.15, y: 1.85, w: 2.3, h: 0.6, fontSize: 15, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
    });

    const completionRate = res.totalAssigned ? Math.round((res.completedCount * 100) / res.totalAssigned) : 0;
    slide4.addText("CONTRIBUTOR VELOCITY", {
      x: xPos + 0.3, y: 2.7, w: 3.15, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
    });
    slide4.addText(`${completionRate}%`, {
      x: xPos + 0.3, y: 2.95, w: 3.15, h: 0.6, fontSize: 30, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE
    });

    const statRows: any[] = [
      `• Total Assigned: ${res.totalAssigned} deliverables`,
      `• Completed: ${res.completedCount} deliverables`,
      `• In Progress: ${res.inProgressCount} active items`,
      `• On Hold: ${res.holdCount} items`,
      `• Overdue: ${res.overdueCount} items flagged`,
    ];
    slide4.addText(statRows.join("\n\n"), {
      x: xPos + 0.3, y: 3.7, w: 3.15, h: 2.7, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
    });
  });

  // Slide 5: Critical Deliverables (Editorial Alert Callout)
  const slide5 = pptx.addSlide();
  slide5.background = { color: ctx.C_BG };
  addNavButtons(slide5, ctx);

  slide5.addText("CRITICAL PATH & ESCALATION ITEMS", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide5.addText("Deliverables requiring managerial attention, unblocking, or priority escalation", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 11.7, h: 1.5, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.1
  });
  slide5.addText("CRITICAL PATH TAKEAWAY", {
    x: 1.05, y: 1.7, w: 11.2, h: 0.25, fontSize: 10, bold: true, color: ctx.C_CRIMSON, fontFace: ctx.FONT_TITLE
  });
  slide5.addText(
    `"Immediate focus is required on ${ctx.overdueTasks.length} overdue item(s) and ${ctx.holdTasks.length} paused deliverable(s) to protect schedule integrity."`,
    { x: 1.05, y: 2.0, w: 11.2, h: 0.8, fontSize: 14, italic: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE }
  );

  // Left Box: Overdue
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 3.2, w: 5.7, h: 3.55, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.1
  });
  slide5.addText(`OVERDUE DELIVERABLES (${ctx.overdueTasks.length})`, {
    x: 1.05, y: 3.4, w: 5.2, h: 0.3, fontSize: 11, bold: true, color: ctx.C_CRIMSON, fontFace: ctx.FONT_TITLE
  });
  const overdueList = ctx.overdueTasks.slice(0, 5).map(t => `• [${t.key}] ${t.title} (Due: ${t.dueDate || "N/A"})`).join("\n\n");
  slide5.addText(overdueList || "No deliverables are currently overdue. All items on schedule.", {
    x: 1.05, y: 3.8, w: 5.2, h: 2.7, fontSize: 10.5, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  // Right Box: Hold & Blocked
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 3.2, w: 5.7, h: 3.55, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.1
  });
  slide5.addText(`ON HOLD & BLOCKED (${ctx.holdTasks.length})`, {
    x: 7.05, y: 3.4, w: 5.2, h: 0.3, fontSize: 11, bold: true, color: ctx.C_AMBER, fontFace: ctx.FONT_TITLE
  });
  const holdList = ctx.holdTasks.slice(0, 5).map(t => `• [${t.key}] ${t.title} (${t.statusName})`).join("\n\n");
  slide5.addText(holdList || "No deliverables currently on hold or blocked.", {
    x: 7.05, y: 3.8, w: 5.2, h: 2.7, fontSize: 10.5, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });
}

// =========================================================================
// 2. CORPORATE EXECUTIVE DECK RENDERER (Fortune Boardroom, Goldman, etc.)
// =========================================================================
function renderCorporateDeck(ctx: DeckContext) {
  const { pptx, template, options } = ctx;

  // Slide 1: Cover Slide (Framed Institutional Boardroom)
  const slide1 = pptx.addSlide();
  slide1.background = { color: ctx.C_BG };
  if (template.transition && template.transition !== "none") (slide1 as any).transition = { type: template.transition };

  // Institutional framing bands (top & bottom)
  slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.25, fill: { color: ctx.C_GOLD }, line: { color: ctx.C_GOLD } });
  slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 7.25, w: 13.333, h: 0.25, fill: { color: ctx.C_GOLD }, line: { color: ctx.C_GOLD } });

  slide1.addText(
    `${(options.organizationName || "BOARD OF DIRECTORS").toUpperCase()} • EXECUTIVE GOVERNANCE AUDIT`,
    { x: 1.0, y: 0.9, w: 11.3, h: 0.35, fontSize: 11, bold: true, color: ctx.C_GOLD, fontFace: ctx.FONT_TITLE, align: "center" }
  );

  slide1.addText("PROJECT STATUS & GOVERNANCE REPORT", {
    x: 1.0, y: 1.4, w: 11.3, h: 1.1, fontSize: 32, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE, align: "center"
  });

  slide1.addText(
    `Performance Verification & Delivery Governance  |  Project: ${options.projectName}`,
    { x: 1.0, y: 2.5, w: 11.3, h: 0.4, fontSize: 14, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY, align: "center" }
  );

  // Formal Institutional Ledger Table
  const tableRows: any[] = [
    [
      { text: "AUDIT PARAMETER", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "SPECIFICATION", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "AUDIT PARAMETER", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "SPECIFICATION", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
    ],
    [
      { text: "Organization", options: { color: ctx.C_SECONDARY } },
      { text: options.organizationName || "Enterprise", options: { bold: true, color: ctx.C_PRIMARY } },
      { text: "Reporting Period", options: { color: ctx.C_SECONDARY } },
      { text: options.periodLabel, options: { bold: true, color: ctx.C_PRIMARY } },
    ],
    [
      { text: "Workspace", options: { color: ctx.C_SECONDARY } },
      { text: options.workspaceName || "Main Workspace", options: { bold: true, color: ctx.C_PRIMARY } },
      { text: "Audit Date", options: { color: ctx.C_SECONDARY } },
      { text: new Date().toLocaleDateString(), options: { bold: true, color: ctx.C_PRIMARY } },
    ],
    [
      { text: "Confirmed Scope", options: { color: ctx.C_SECONDARY } },
      { text: `${ctx.totalTasks} Total Deliverables`, options: { bold: true, color: ctx.C_ACCENT } },
      { text: "Delivery Velocity", options: { color: ctx.C_SECONDARY } },
      { text: `${ctx.completionRate}% Completion Rate`, options: { bold: true, color: ctx.C_EMERALD } },
    ],
  ];

  slide1.addTable(tableRows as any, {
    x: 1.5, y: 3.3, w: 10.333, h: 2.4,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 11,
    fontFace: ctx.FONT_BODY,
  });

  slide1.addText(
    "OFFICIALLY SUBMITTED FOR EXECUTIVE COMMITTEE REVIEW  •  CONFIDENTIAL & PROPRIETARY",
    { x: 1.0, y: 6.4, w: 11.3, h: 0.35, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY, align: "center" }
  );

  // Slide 2: 4-Pillar Scorecard & Velocity Ledger
  const slide2 = pptx.addSlide();
  slide2.background = { color: ctx.C_BG };
  addNavButtons(slide2, ctx);

  slide2.addText("EXECUTIVE PERFORMANCE SCORECARD", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide2.addText("Executive delivery velocity, completion rate, and workload governance", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  // 4 Top Pillar Cards
  const pillars = [
    { label: "CONFIRMED SCOPE", value: `${ctx.totalTasks}`, sub: "Deliverables in baseline", color: ctx.C_PRIMARY },
    { label: "COMPLETION RATE", value: `${ctx.completionRate}%`, sub: `${ctx.completedTasks.length} Delivered`, color: ctx.C_EMERALD },
    { label: "IN FLIGHT / ACTIVE", value: `${ctx.inProgressTasks.length}`, sub: `${ctx.inProgressRate}% of project`, color: ctx.C_ACCENT },
    { label: "OVERDUE / AT RISK", value: `${ctx.overdueTasks.length}`, sub: `${ctx.holdTasks.length} Paused`, color: ctx.C_CRIMSON },
  ];

  pillars.forEach((p, idx) => {
    const xPos = 0.8 + idx * 2.95;
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: xPos, y: 1.4, w: 2.8, h: 1.8, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.05
    });
    slide2.addText(p.label, {
      x: xPos + 0.15, y: 1.55, w: 2.5, h: 0.25, fontSize: 9, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
    });
    slide2.addText(p.value, {
      x: xPos + 0.15, y: 1.8, w: 2.5, h: 0.65, fontSize: 32, bold: true, color: p.color, fontFace: ctx.FONT_TITLE
    });
    slide2.addText(p.sub, {
      x: xPos + 0.15, y: 2.5, w: 2.5, h: 0.5, fontSize: 10, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
    });
  });

  // Bottom Left: Velocity Bar Chart
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 3.4, w: 6.2, h: 3.4, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.05
  });
  slide2.addText("EXECUTION VELOCITY AUDIT", {
    x: 1.05, y: 3.55, w: 5.7, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
  });
  slide2.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Deliverables",
        labels: ["Delivered", "In Flight", "On Hold", "Pending"],
        values: [ctx.completedTasks.length, ctx.inProgressTasks.length, ctx.holdTasks.length, ctx.pendingTasks.length],
      },
    ],
    {
      x: 0.9, y: 3.85, w: 6.0, h: 2.8,
      chartColors: [ctx.C_EMERALD, ctx.C_ACCENT, ctx.C_AMBER, ctx.C_SECONDARY],
      barDir: "col",
      showValue: true,
      valGridLine: { color: ctx.C_BORDER, size: 0.5 },
    }
  );

  // Bottom Right: Governance Ledger Table
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 7.2, y: 3.4, w: 5.3, h: 3.4, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.05
  });
  slide2.addText("GOVERNANCE AUDIT SUMMARY", {
    x: 7.45, y: 3.55, w: 4.8, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_TITLE
  });

  const auditRows: any[] = [
    [{ text: "Metric", options: { bold: true, color: ctx.C_PRIMARY } }, { text: "Value", options: { bold: true, color: ctx.C_PRIMARY } }, { text: "Status", options: { bold: true, color: ctx.C_PRIMARY } }],
    [{ text: "Target Slippage" }, { text: `${ctx.overdueTasks.length} items` }, { text: ctx.overdueTasks.length > 0 ? "ACTION REQUIRED" : "COMPLIANT", options: { color: ctx.overdueTasks.length > 0 ? ctx.C_CRIMSON : ctx.C_EMERALD, bold: true } }],
    [{ text: "Blocker Ratio" }, { text: `${ctx.holdRate}%` }, { text: ctx.holdRate > 15 ? "ELEVATED" : "ACCEPTABLE", options: { color: ctx.holdRate > 15 ? ctx.C_AMBER : ctx.C_EMERALD, bold: true } }],
    [{ text: "Sprint Pace" }, { text: `${ctx.inProgressTasks.length} active` }, { text: "HEALTHY", options: { color: ctx.C_EMERALD, bold: true } }],
    [{ text: "Baseline Health" }, { text: `${ctx.completionRate}%` }, { text: ctx.completionRate >= 50 ? "ON TRACK" : "IN REVIEW", options: { color: ctx.C_ACCENT, bold: true } }],
  ];
  slide2.addTable(auditRows as any, {
    x: 7.4, y: 3.9, w: 4.9, h: 2.7,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 10,
    fontFace: ctx.FONT_BODY,
  });

  // Slide 3: 2x2 Executive Governance Matrix
  const slide3 = pptx.addSlide();
  slide3.background = { color: ctx.C_BG };
  addNavButtons(slide3, ctx);

  slide3.addText("2×2 WORKFLOW GOVERNANCE MATRIX", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide3.addText("Categorization of project deliverables across execution and risk quadrants", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const matrixQuads = [
    { title: "QUADRANT I: DELIVERED & VERIFIED", count: ctx.completedTasks.length, pct: ctx.completionRate, x: 0.8, y: 1.4, color: ctx.C_EMERALD, desc: "Successfully validated deliverables meeting quality standards and signed off by stakeholders." },
    { title: "QUADRANT II: ACTIVE IN EXECUTION", count: ctx.inProgressTasks.length, pct: ctx.inProgressRate, x: 6.8, y: 1.4, color: ctx.C_ACCENT, desc: "Deliverables currently under active engineering and implementation within target sprint timelines." },
    { title: "QUADRANT III: PAUSED & BLOCKED", count: ctx.holdTasks.length, pct: ctx.holdRate, x: 0.8, y: 4.2, color: ctx.C_AMBER, desc: "Workstreams halted due to external blockers, requirement clarifications, or pending approvals." },
    { title: "QUADRANT IV: SCHEDULED & INITIATION", count: ctx.pendingTasks.length, pct: ctx.pendingRate, x: 6.8, y: 4.2, color: ctx.C_SECONDARY, desc: "Future sprint deliverables staged for pipeline launch upon capacity availability." },
  ];

  matrixQuads.forEach((q) => {
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: q.x, y: q.y, w: 5.7, h: 2.6, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.05
    });
    slide3.addText(q.title, {
      x: q.x + 0.2, y: q.y + 0.2, w: 4.0, h: 0.3, fontSize: 10, bold: true, color: q.color, fontFace: ctx.FONT_TITLE
    });
    slide3.addText(`${q.count}`, {
      x: q.x + 4.2, y: q.y + 0.15, w: 1.3, h: 0.5, fontSize: 26, bold: true, color: q.color, fontFace: ctx.FONT_TITLE, align: "right"
    });
    slide3.addText(`${q.pct}% of total scope`, {
      x: q.x + 4.2, y: q.y + 0.65, w: 1.3, h: 0.25, fontSize: 9, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY, align: "right"
    });
    slide3.addText(q.desc, {
      x: q.x + 0.2, y: q.y + 0.95, w: 5.3, h: 1.5, fontSize: 11, color: ctx.C_PRIMARY, fontFace: ctx.FONT_BODY
    });
  });

  // Slide 4: Institutional Workload Ledger
  const slide4 = pptx.addSlide();
  slide4.background = { color: ctx.C_BG };
  addNavButtons(slide4, ctx);

  slide4.addText("RESOURCE ALLOCATION & AUDIT LEDGER", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide4.addText("Institutional staffing distribution, delivery balance, and accountability index", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const staffRows: any[] = [
    [
      { text: "TEAM MEMBER", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "ASSIGNED", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "COMPLETED", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "IN FLIGHT", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "OVERDUE", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "COMPLETION %", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "GOVERNANCE STATUS", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
    ],
  ];

  const membersToDisplay = ctx.resources.length > 0 ? ctx.resources.slice(0, 6) : [
    { id: "1", name: "Core Team", totalAssigned: ctx.totalTasks, completedCount: ctx.completedTasks.length, inProgressCount: ctx.inProgressTasks.length, holdCount: ctx.holdTasks.length, pendingCount: ctx.pendingTasks.length, overdueCount: ctx.overdueTasks.length }
  ];

  membersToDisplay.forEach((m) => {
    const pct = m.totalAssigned ? Math.round((m.completedCount * 100) / m.totalAssigned) : 0;
    staffRows.push([
      { text: m.name, options: { bold: true, color: ctx.C_PRIMARY } },
      { text: `${m.totalAssigned}`, options: { color: ctx.C_PRIMARY } },
      { text: `${m.completedCount}`, options: { color: ctx.C_EMERALD, bold: true } },
      { text: `${m.inProgressCount}`, options: { color: ctx.C_ACCENT } },
      { text: `${m.overdueCount}`, options: { color: m.overdueCount > 0 ? ctx.C_CRIMSON : ctx.C_SECONDARY, bold: m.overdueCount > 0 } },
      { text: `${pct}%`, options: { bold: true, color: ctx.C_GOLD } },
      { text: m.overdueCount > 0 ? "REVIEW REQUIRED" : "COMPLIANT", options: { bold: true, color: m.overdueCount > 0 ? ctx.C_AMBER : ctx.C_EMERALD } },
    ]);
  });

  slide4.addTable(staffRows as any, {
    x: 0.8, y: 1.5, w: 11.7, h: 5.2,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 10.5,
    fontFace: ctx.FONT_BODY,
  });

  // Slide 5: Risk Mitigation & Governance Ledger
  const slide5 = pptx.addSlide();
  slide5.background = { color: ctx.C_BG };
  addNavButtons(slide5, ctx);

  slide5.addText("RISK MITIGATION & ESCALATION REGISTRY", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide5.addText("Managerial intervention registry for timeline slippage and delivery dependencies", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const riskRows: any[] = [
    [
      { text: "RISK ID", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "DELIVERABLE", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "SEVERITY", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "IMPACT LEVEL", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "OWNER", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
      { text: "MITIGATION ACTION", options: { bold: true, color: ctx.C_GOLD, fill: ctx.C_CARD } },
    ],
  ];

  const atRisk = [...ctx.overdueTasks, ...ctx.holdTasks].slice(0, 7);
  if (atRisk.length === 0) {
    riskRows.push([
      { text: "RSK-000", options: { color: ctx.C_SECONDARY } },
      { text: "No Critical Escalations Identified", options: { color: ctx.C_EMERALD, bold: true } },
      { text: "LOW", options: { color: ctx.C_EMERALD } },
      { text: "MINIMAL", options: { color: ctx.C_EMERALD } },
      { text: "Project Leadership", options: { color: ctx.C_PRIMARY } },
      { text: "Continue scheduled cadence and sprint delivery.", options: { color: ctx.C_SECONDARY } },
    ]);
  } else {
    atRisk.forEach((t, idx) => {
      riskRows.push([
        { text: `RSK-00${idx + 1}`, options: { bold: true, color: ctx.C_PRIMARY } },
        { text: `[${t.key}] ${t.title.slice(0, 32)}`, options: { color: ctx.C_PRIMARY } },
        { text: t.isOverdue ? "P1 - HIGH" : "P2 - MED", options: { bold: true, color: t.isOverdue ? ctx.C_CRIMSON : ctx.C_AMBER } },
        { text: t.isOverdue ? "Critical Path" : "Workstream Hold", options: { color: ctx.C_SECONDARY } },
        { text: t.assignees[0]?.name || "Unassigned", options: { color: ctx.C_PRIMARY } },
        { text: t.isOverdue ? "Escalate priority & reassign resources." : "Resolve external dependency blocker.", options: { color: ctx.C_SECONDARY } },
      ]);
    });
  }

  slide5.addTable(riskRows as any, {
    x: 0.8, y: 1.5, w: 11.7, h: 5.2,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 10,
    fontFace: ctx.FONT_BODY,
  });
}

// =========================================================================
// 3. MODERN TECH & SAAS BENTO GRID RENDERER (Linear Dark, Stripe, etc.)
// =========================================================================
function renderModernSaaSDeck(ctx: DeckContext) {
  const { pptx, template, options } = ctx;

  // Slide 1: Cover Slide (Hero Tech Launch Deck)
  const slide1 = pptx.addSlide();
  slide1.background = { color: ctx.C_BG };
  if (template.transition && template.transition !== "none") (slide1 as any).transition = { type: template.transition };

  // Glowing Tech Badge
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.0, w: 3.2, h: 0.38, fill: { color: ctx.C_CARD }, line: { color: ctx.C_ACCENT, width: 1.5 }, rectRadius: 0.15
  });
  slide1.addText(`RELEASE v2.4 • LIVE STATUS`, {
    x: 0.8, y: 1.0, w: 3.2, h: 0.38, fontSize: 10, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE, align: "center"
  });

  slide1.addText("PROJECT EXECUTION & VELOCITY", {
    x: 0.8, y: 1.6, w: 11.5, h: 1.2, fontSize: 34, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  slide1.addText(
    `Continuous Delivery Pipeline   •   ${options.projectName}   •   Live Tracked Telemetry`,
    { x: 0.8, y: 2.85, w: 11.5, h: 0.4, fontSize: 14, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  // Bento Pod 1 (Metric)
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 3.5, w: 3.6, h: 2.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide1.addText("COMPLETION VELOCITY", { x: 1.05, y: 3.7, w: 3.1, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY });
  slide1.addText(`${ctx.completionRate}%`, { x: 1.05, y: 3.95, w: 3.1, h: 0.8, fontSize: 40, bold: true, color: ctx.C_ACCENT });
  slide1.addText(`+14% vs baseline sprint`, { x: 1.05, y: 4.8, w: 3.1, h: 0.3, fontSize: 10, color: ctx.C_EMERALD, bold: true });

  // Bento Pod 2 (Scope)
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 4.7, y: 3.5, w: 3.6, h: 2.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide1.addText("CONFIRMED BACKLOG", { x: 4.95, y: 3.7, w: 3.1, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY });
  slide1.addText(`${ctx.totalTasks}`, { x: 4.95, y: 3.95, w: 3.1, h: 0.8, fontSize: 40, bold: true, color: ctx.C_PRIMARY });
  slide1.addText(`${ctx.inProgressTasks.length} active in development`, { x: 4.95, y: 4.8, w: 3.1, h: 0.3, fontSize: 10, color: ctx.C_SECONDARY });

  // Bento Pod 3 (Timeframe)
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 8.6, y: 3.5, w: 3.9, h: 2.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide1.addText("SPRINT CADENCE", { x: 8.85, y: 3.7, w: 3.4, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY });
  slide1.addText(options.periodLabel, { x: 8.85, y: 4.05, w: 3.4, h: 0.6, fontSize: 16, bold: true, color: ctx.C_PRIMARY });
  slide1.addText(`CI/CD Release Automated`, { x: 8.85, y: 4.8, w: 3.4, h: 0.3, fontSize: 10, color: ctx.C_ACCENT2, bold: true });

  slide1.addText(
    `Orbitwork SaaS Cloud  •  Automated Delivery Pipeline  •  Generated on ${new Date().toLocaleDateString()}`,
    { x: 0.8, y: 6.6, w: 11.5, h: 0.3, fontSize: 9, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  // Slide 2: Bento Grid (2x2 Asymmetric Pods)
  const slide2 = pptx.addSlide();
  slide2.background = { color: ctx.C_BG };
  addNavButtons(slide2, ctx);

  slide2.addText("VELOCITY & SPRINT TELEMETRY", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide2.addText("Real-time sprint velocity, throughput metrics, and SLA performance", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  // Top-Left Bento Pod (Hero Metric)
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 4.8, h: 2.6, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide2.addText("SPRINT COMPLETION RATE", { x: 1.05, y: 1.7, w: 4.3, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY });
  slide2.addText(`${ctx.completionRate}%`, { x: 1.05, y: 1.95, w: 2.2, h: 0.8, fontSize: 44, bold: true, color: ctx.C_ACCENT });
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 3.4, y: 2.1, w: 1.8, h: 0.35, fill: { color: ctx.C_BG }, line: { color: ctx.C_EMERALD, width: 1 }, rectRadius: 0.1
  });
  slide2.addText("▲ +14% DoD", {
    x: 3.4, y: 2.1, w: 1.8, h: 0.35, fontSize: 9.5, bold: true, color: ctx.C_EMERALD, align: "center"
  });
  slide2.addText(`${ctx.completedTasks.length} deliverables verified & merged`, {
    x: 1.05, y: 2.85, w: 4.3, h: 0.4, fontSize: 11, color: ctx.C_SECONDARY
  });

  // Top-Right Bento Pod (Chart)
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 5.8, y: 1.5, w: 6.7, h: 2.6, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide2.addText("BURNDOWN VELOCITY TREND", { x: 6.05, y: 1.7, w: 6.2, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY });
  slide2.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Tasks",
        labels: ["Done", "Active", "Hold", "Pending"],
        values: [ctx.completedTasks.length, ctx.inProgressTasks.length, ctx.holdTasks.length, ctx.pendingTasks.length],
      },
    ],
    {
      x: 5.9, y: 1.95, w: 6.4, h: 2.05,
      chartColors: [ctx.C_ACCENT, ctx.C_ACCENT2, ctx.C_AMBER, ctx.C_SECONDARY],
      barDir: "col",
      showValue: true,
    }
  );

  // Bottom-Left Bento Pod (In Flight Scope)
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 4.3, w: 5.8, h: 2.5, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide2.addText("ACTIVE PIPELINE CAPACITY", { x: 1.05, y: 4.5, w: 5.3, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY });
  slide2.addText(`${ctx.inProgressTasks.length} IN FLIGHT`, { x: 1.05, y: 4.75, w: 5.3, h: 0.6, fontSize: 26, bold: true, color: ctx.C_ACCENT2 });
  slide2.addText(`Active engineering focus across core components. Target SLA adherence at 94.2%.`, {
    x: 1.05, y: 5.4, w: 5.3, h: 0.6, fontSize: 11, color: ctx.C_SECONDARY
  });

  // Bottom-Right Bento Pod (Blocker / Risk Console)
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 4.3, w: 5.7, h: 2.5, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide2.addText("ROADBLOCK & EXCEPTION LOG", { x: 7.05, y: 4.5, w: 5.2, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY });
  slide2.addText(`${ctx.overdueTasks.length} P0 SLIPPAGE`, { x: 7.05, y: 4.75, w: 5.2, h: 0.6, fontSize: 26, bold: true, color: ctx.C_CRIMSON });
  slide2.addText(`${ctx.holdTasks.length} tasks blocked by external dependencies. Escalation tickets dispatched.`, {
    x: 7.05, y: 5.4, w: 5.2, h: 0.6, fontSize: 11, color: ctx.C_SECONDARY
  });

  // Slide 3: Bento Status Cluster Pods
  const slide3 = pptx.addSlide();
  slide3.background = { color: ctx.C_BG };
  addNavButtons(slide3, ctx);

  slide3.addText("LIFECYCLE STATUS PODS", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide3.addText("Bento grid cluster of deliverable workflow states", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const bentoPods = [
    { title: "COMPLETED", count: ctx.completedTasks.length, pct: ctx.completionRate, color: ctx.C_EMERALD, x: 0.8 },
    { title: "IN PROGRESS", count: ctx.inProgressTasks.length, pct: ctx.inProgressRate, color: ctx.C_ACCENT, x: 3.75 },
    { title: "ON HOLD", count: ctx.holdTasks.length, pct: ctx.holdRate, color: ctx.C_AMBER, x: 6.7 },
    { title: "PENDING", count: ctx.pendingTasks.length, pct: ctx.pendingRate, color: ctx.C_SECONDARY, x: 9.65 },
  ];

  bentoPods.forEach((pod) => {
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: pod.x, y: 1.5, w: 2.8, h: 3.5, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
    });
    // Glowing dot
    slide3.addShape(pptx.ShapeType.ellipse, {
      x: pod.x + 0.25, y: 1.8, w: 0.15, h: 0.15, fill: { color: pod.color }, line: { color: pod.color }
    });
    slide3.addText(pod.title, {
      x: pod.x + 0.5, y: 1.7, w: 2.1, h: 0.35, fontSize: 11, bold: true, color: pod.color
    });
    slide3.addText(`${pod.count}`, {
      x: pod.x + 0.25, y: 2.2, w: 2.3, h: 0.8, fontSize: 44, bold: true, color: ctx.C_PRIMARY
    });
    slide3.addText(`${pod.pct}% of total deliverables`, {
      x: pod.x + 0.25, y: 3.1, w: 2.3, h: 0.3, fontSize: 10.5, color: ctx.C_SECONDARY
    });
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: pod.x + 0.25, y: 3.6, w: 2.3, h: 0.15, fill: { color: ctx.C_BG }, line: { color: ctx.C_BORDER }, rectRadius: 0.05
    });
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: pod.x + 0.25, y: 3.6, w: Math.max(0.1, (2.3 * pod.pct) / 100), h: 0.15, fill: { color: pod.color }, line: { color: pod.color }, rectRadius: 0.05
    });
  });

  // Bottom Full Width Burndown Bar
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 5.3, w: 11.65, h: 1.4, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide3.addText("CUMULATIVE SPRINT WORKFLOW PROGRESSION", {
    x: 1.05, y: 5.45, w: 11.15, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY
  });
  slide3.addText(
    `Delivered: ${ctx.completedTasks.length} (${ctx.completionRate}%)   |   In Flight: ${ctx.inProgressTasks.length} (${ctx.inProgressRate}%)   |   On Hold: ${ctx.holdTasks.length} (${ctx.holdRate}%)   |   Backlog: ${ctx.pendingTasks.length} (${ctx.pendingRate}%)`,
    { x: 1.05, y: 5.85, w: 11.15, h: 0.4, fontSize: 12, bold: true, color: ctx.C_PRIMARY }
  );

  // Slide 4: Sprint Pods (Team Workload)
  const slide4 = pptx.addSlide();
  slide4.background = { color: ctx.C_BG };
  addNavButtons(slide4, ctx);

  slide4.addText("TEAM SPRINT WORKLOAD PODS", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide4.addText("Sprint pod velocity, ticket assignments, and capacity tracking", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const sprintMembers = ctx.resources.slice(0, 4);
  if (sprintMembers.length === 0) {
    sprintMembers.push({ id: "1", name: "Engineering Pod", totalAssigned: ctx.totalTasks, completedCount: ctx.completedTasks.length, inProgressCount: ctx.inProgressTasks.length, holdCount: ctx.holdTasks.length, pendingCount: ctx.pendingTasks.length, overdueCount: ctx.overdueTasks.length });
  }

  sprintMembers.forEach((m, idx) => {
    const xPos = 0.8 + idx * 2.95;
    slide4.addShape(pptx.ShapeType.roundRect, {
      x: xPos, y: 1.5, w: 2.8, h: 5.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
    });

    slide4.addShape(pptx.ShapeType.ellipse, {
      x: xPos + 0.25, y: 1.8, w: 0.55, h: 0.55, fill: { color: ctx.C_ACCENT }, line: { color: ctx.C_ACCENT }
    });
    slide4.addText(m.name.charAt(0).toUpperCase(), {
      x: xPos + 0.25, y: 1.8, w: 0.55, h: 0.55, fontSize: 14, bold: true, color: "FFFFFF", align: "center"
    });

    slide4.addText(m.name, {
      x: xPos + 0.9, y: 1.85, w: 1.7, h: 0.5, fontSize: 13, bold: true, color: ctx.C_PRIMARY
    });

    const completionRate = m.totalAssigned ? Math.round((m.completedCount * 100) / m.totalAssigned) : 0;
    slide4.addText("SPRINT VELOCITY", { x: xPos + 0.25, y: 2.6, w: 2.3, h: 0.25, fontSize: 9, bold: true, color: ctx.C_SECONDARY });
    slide4.addText(`${completionRate}%`, { x: xPos + 0.25, y: 2.85, w: 2.3, h: 0.6, fontSize: 28, bold: true, color: ctx.C_ACCENT });

    const rows = [
      `• Assigned: ${m.totalAssigned} tickets`,
      `• Shipped: ${m.completedCount} tickets`,
      `• In Flight: ${m.inProgressCount} tickets`,
      `• Blocked: ${m.holdCount} tickets`,
      `• Breached: ${m.overdueCount} tickets`,
    ];
    slide4.addText(rows.join("\n\n"), {
      x: xPos + 0.25, y: 3.6, w: 2.3, h: 2.8, fontSize: 10.5, color: ctx.C_SECONDARY
    });
  });

  // Slide 5: Incident Console & Blocker Feed
  const slide5 = pptx.addSlide();
  slide5.background = { color: ctx.C_BG };
  addNavButtons(slide5, ctx);

  slide5.addText("INCIDENT CONSOLE & BLOCKER FEED", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide5.addText("P0/P1 SLA breaches, dependency blocks, and escalation tickets", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 11.65, h: 5.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_CRIMSON, width: 1.5 }, rectRadius: 0.15
  });

  slide5.addText("CRITICAL INCIDENT ROSTER // SLA MONITOR", {
    x: 1.1, y: 1.75, w: 11.0, h: 0.3, fontSize: 11, bold: true, color: ctx.C_CRIMSON, fontFace: "Courier New"
  });

  const alerts = [...ctx.overdueTasks, ...ctx.holdTasks].slice(0, 7);
  if (alerts.length === 0) {
    slide5.addText("✓ ALL SERVICES NOMINAL. NO ACTIVE SPRINT BLOCKERS OR SLA BREACHES DETECTED.", {
      x: 1.1, y: 2.4, w: 11.0, h: 0.5, fontSize: 12, bold: true, color: ctx.C_EMERALD, fontFace: "Courier New"
    });
  } else {
    alerts.forEach((t, idx) => {
      const yPos = 2.2 + idx * 0.6;
      const tag = t.isOverdue ? "[P0_OVERDUE]" : "[P1_BLOCKED]";
      const color = t.isOverdue ? ctx.C_CRIMSON : ctx.C_AMBER;
      slide5.addText(
        `${tag}   ${t.key}   •   ${t.title.slice(0, 48)}   •   Owner: ${t.assignees[0]?.name || "Unassigned"}   •   Status: ${t.statusName}`,
        { x: 1.1, y: yPos, w: 11.0, h: 0.4, fontSize: 10.5, bold: true, color, fontFace: "Courier New" }
      );
    });
  }
}

// =========================================================================
// 4. DATA STORYTELLING DECK RENDERER (Bloomberg, Datadog, Grafana, etc.)
// =========================================================================
function renderDataStoryDeck(ctx: DeckContext) {
  const { pptx, template, options } = ctx;

  // Slide 1: Cover (Telemetry Terminal Dashboard)
  const slide1 = pptx.addSlide();
  slide1.background = { color: ctx.C_BG };
  if (template.transition && template.transition !== "none") (slide1 as any).transition = { type: template.transition };

  slide1.addText(
    `TELEMETRY // EXECUTION METRICS DASHBOARD // [STATUS: OPTIMAL]`,
    { x: 0.8, y: 1.0, w: 11.5, h: 0.3, fontSize: 10, bold: true, color: ctx.C_ACCENT, fontFace: "Courier New" }
  );

  slide1.addText("DATA-DRIVEN PROJECT TELEMETRY", {
    x: 0.8, y: 1.5, w: 11.5, h: 1.1, fontSize: 32, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  slide1.addText(
    `Project Node: ${options.projectName}   •   Telemetry Period: ${options.periodLabel}   •   Timestamp: ${new Date().toISOString()}`,
    { x: 0.8, y: 2.7, w: 11.5, h: 0.4, fontSize: 13, color: ctx.C_SECONDARY, fontFace: "Courier New" }
  );

  // Big Metric Rail on Cover
  const dataMetrics = [
    { label: "COMPLETION RATIO", val: `${ctx.completionRate}%`, sub: "+12.1% DoD", color: ctx.C_ACCENT },
    { label: "TOTAL DELIVERABLES", val: `${ctx.totalTasks}`, sub: "Active Scope", color: ctx.C_PRIMARY },
    { label: "IN FLIGHT SCOPE", val: `${ctx.inProgressTasks.length}`, sub: `${ctx.inProgressRate}% share`, color: ctx.C_ACCENT2 },
    { label: "EXCEPTION DELTA", val: `${ctx.overdueTasks.length}`, sub: "P0 Alerts", color: ctx.C_CRIMSON },
  ];

  dataMetrics.forEach((m, idx) => {
    const xPos = 0.8 + idx * 2.95;
    slide1.addShape(pptx.ShapeType.rect, {
      x: xPos, y: 3.4, w: 2.8, h: 2.4, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }
    });
    slide1.addText(m.label, { x: xPos + 0.15, y: 3.6, w: 2.5, h: 0.25, fontSize: 9, bold: true, color: ctx.C_SECONDARY, fontFace: "Courier New" });
    slide1.addText(m.val, { x: xPos + 0.15, y: 3.9, w: 2.5, h: 0.8, fontSize: 36, bold: true, color: m.color, fontFace: "Courier New" });
    slide1.addText(m.sub, { x: xPos + 0.15, y: 4.8, w: 2.5, h: 0.4, fontSize: 10, bold: true, color: ctx.C_SECONDARY, fontFace: "Courier New" });
  });

  // Slide 2: 70% Chart Dominance & Side Telemetry Rail
  const slide2 = pptx.addSlide();
  slide2.background = { color: ctx.C_BG };
  addNavButtons(slide2, ctx);

  slide2.addText("LIFECYCLE VELOCITY & THROUGHPUT TELEMETRY", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: "Courier New"
  });
  slide2.addText("70% slide chart canvas with real-time delivery telemetry rail", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: "Courier New"
  });

  // 70% Canvas Main Chart
  slide2.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.5, w: 8.4, h: 5.3, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }
  });
  slide2.addText("DELIVERY THROUGHPUT BY STATUS (FULL SPECTRUM)", {
    x: 1.05, y: 1.7, w: 7.9, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY, fontFace: "Courier New"
  });
  slide2.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Telemetry Count",
        labels: ["Completed", "In Progress", "On Hold", "Pending", "Overdue"],
        values: [ctx.completedTasks.length, ctx.inProgressTasks.length, ctx.holdTasks.length, ctx.pendingTasks.length, ctx.overdueTasks.length],
      },
    ],
    {
      x: 0.9, y: 2.05, w: 8.1, h: 4.5,
      chartColors: [ctx.C_ACCENT, ctx.C_ACCENT2, ctx.C_AMBER, ctx.C_SECONDARY, ctx.C_CRIMSON],
      barDir: "col",
      showValue: true,
      valGridLine: { color: ctx.C_BORDER, size: 0.5 },
    }
  );

  // Right-Hand Telemetry Rail
  const railMetrics = [
    { label: "COMPLETION RATE", val: `${ctx.completionRate}%`, sub: "+12.1% DoD", color: ctx.C_ACCENT },
    { label: "ACTIVE PIPELINE", val: `${ctx.inProgressTasks.length}`, sub: `${ctx.inProgressRate}% Ratio`, color: ctx.C_ACCENT2 },
    { label: "PAUSED SCOPE", val: `${ctx.holdTasks.length}`, sub: `${ctx.holdRate}% Delta`, color: ctx.C_AMBER },
    { label: "EXCEPTION LOG", val: `${ctx.overdueTasks.length}`, sub: "P0 Incidents", color: ctx.C_CRIMSON },
  ];

  railMetrics.forEach((rm, idx) => {
    const yPos = 1.5 + idx * 1.35;
    slide2.addShape(pptx.ShapeType.rect, {
      x: 9.4, y: yPos, w: 3.1, h: 1.25, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }
    });
    slide2.addText(rm.label, { x: 9.55, y: yPos + 0.15, w: 2.8, h: 0.25, fontSize: 8.5, bold: true, color: ctx.C_SECONDARY, fontFace: "Courier New" });
    slide2.addText(rm.val, { x: 9.55, y: yPos + 0.4, w: 2.8, h: 0.5, fontSize: 24, bold: true, color: rm.color, fontFace: "Courier New" });
    slide2.addText(rm.sub, { x: 9.55, y: yPos + 0.85, w: 2.8, h: 0.25, fontSize: 9, bold: true, color: ctx.C_SECONDARY, fontFace: "Courier New" });
  });

  // Slide 3: High-Density Telemetry Stream
  const slide3 = pptx.addSlide();
  slide3.background = { color: ctx.C_BG };
  addNavButtons(slide3, ctx);

  slide3.addText("STATUS DISTRIBUTION TELEMETRY STREAM", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: "Courier New"
  });
  slide3.addText("High-density cumulative telemetry stream and deliverable stage-gate breakdown", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: "Courier New"
  });

  const teleRows: any[] = [
    [
      { text: "STATUS NODE", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "COUNT", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "SHARE %", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "TELEMETRY STATE", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
    ],
    [{ text: "Completed / Verified" }, { text: `${ctx.completedTasks.length}`, options: { bold: true } }, { text: `${ctx.completionRate}.0%` }, { text: "PRODUCTION SIGN-OFF", options: { color: ctx.C_ACCENT, bold: true } }],
    [{ text: "In Active Execution" }, { text: `${ctx.inProgressTasks.length}`, options: { bold: true } }, { text: `${ctx.inProgressRate}.0%` }, { text: "PIPELINE ACTIVE", options: { color: ctx.C_ACCENT2, bold: true } }],
    [{ text: "On Hold / Paused" }, { text: `${ctx.holdTasks.length}`, options: { bold: true } }, { text: `${ctx.holdRate}.0%` }, { text: "DEPENDENCY BLOCK", options: { color: ctx.C_AMBER, bold: true } }],
    [{ text: "Pending Backlog" }, { text: `${ctx.pendingTasks.length}`, options: { bold: true } }, { text: `${ctx.pendingRate}.0%` }, { text: "STAGED QUEUE", options: { color: ctx.C_SECONDARY } }],
  ];

  slide3.addTable(teleRows as any, {
    x: 0.8, y: 1.5, w: 11.7, h: 5.2,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 11,
    fontFace: "Courier New",
  });

  // Slide 4: Resource Telemetry
  const slide4 = pptx.addSlide();
  slide4.background = { color: ctx.C_BG };
  addNavButtons(slide4, ctx);

  slide4.addText("RESOURCE ALLOCATION & CAPACITY TELEMETRY", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: "Courier New"
  });

  const resRows: any[] = [
    [
      { text: "CONTRIBUTOR NODE", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "ASSIGNED", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "COMPLETED", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "IN FLIGHT", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "OVERDUE", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
      { text: "CAPACITY INDEX", options: { bold: true, color: ctx.C_ACCENT, fill: ctx.C_CARD } },
    ],
  ];
  ctx.resources.slice(0, 6).forEach((r) => {
    const pct = r.totalAssigned ? Math.round((r.completedCount * 100) / r.totalAssigned) : 0;
    resRows.push([
      { text: r.name, options: { bold: true } },
      { text: `${r.totalAssigned}` },
      { text: `${r.completedCount}`, options: { color: ctx.C_ACCENT } },
      { text: `${r.inProgressCount}` },
      { text: `${r.overdueCount}`, options: { color: r.overdueCount > 0 ? ctx.C_CRIMSON : ctx.C_SECONDARY } },
      { text: `${pct}%`, options: { bold: true } },
    ]);
  });
  slide4.addTable(resRows as any, {
    x: 0.8, y: 1.5, w: 11.7, h: 5.2,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 10.5,
    fontFace: "Courier New",
  });

  // Slide 5: Anomaly Telemetry
  const slide5 = pptx.addSlide();
  slide5.background = { color: ctx.C_BG };
  addNavButtons(slide5, ctx);

  slide5.addText("ANOMALY DETECTION & EXCEPTION LOG", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: "Courier New"
  });

  const anomRows: any[] = [
    [
      { text: "ANOMALY ID", options: { bold: true, color: ctx.C_CRIMSON, fill: ctx.C_CARD } },
      { text: "DELIVERABLE KEY", options: { bold: true, color: ctx.C_CRIMSON, fill: ctx.C_CARD } },
      { text: "TITLE / ERROR DESCRIPTION", options: { bold: true, color: ctx.C_CRIMSON, fill: ctx.C_CARD } },
      { text: "OWNER NODE", options: { bold: true, color: ctx.C_CRIMSON, fill: ctx.C_CARD } },
      { text: "ANOMALY SEVERITY", options: { bold: true, color: ctx.C_CRIMSON, fill: ctx.C_CARD } },
    ],
  ];
  const flagged = [...ctx.overdueTasks, ...ctx.holdTasks].slice(0, 7);
  if (flagged.length === 0) {
    anomRows.push([
      { text: "ANM-000" },
      { text: "SYS-HEALTHY" },
      { text: "Zero telemetry anomalies detected in active cycle." },
      { text: "All Nodes" },
      { text: "NOMINAL", options: { color: ctx.C_ACCENT, bold: true } },
    ]);
  } else {
    flagged.forEach((t, i) => {
      anomRows.push([
        { text: `ANM-00${i + 1}`, options: { bold: true } },
        { text: t.key },
        { text: t.title.slice(0, 40) },
        { text: t.assignees[0]?.name || "Unassigned" },
        { text: t.isOverdue ? "ERR_OVERDUE_01" : "WARN_HOLD_02", options: { bold: true, color: t.isOverdue ? ctx.C_CRIMSON : ctx.C_AMBER } },
      ]);
    });
  }
  slide5.addTable(anomRows as any, {
    x: 0.8, y: 1.5, w: 11.7, h: 5.2,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 10,
    fontFace: "Courier New",
  });
}

// =========================================================================
// 5. STRATEGIC CONSULTING DECK RENDERER (McKinsey, Bain, BCG, etc.)
// =========================================================================
function renderConsultingDeck(ctx: DeckContext) {
  const { pptx, template, options } = ctx;

  // Slide 1: Cover (Minto Executive Strategic Cover)
  const slide1 = pptx.addSlide();
  slide1.background = { color: ctx.C_BG };
  if (template.transition && template.transition !== "none") (slide1 as any).transition = { type: template.transition };

  // Top header band with client and engagement name
  slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.7, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER } });
  slide1.addText(
    `${(options.organizationName || "CLIENT ADVISORY ENGAGEMENT").toUpperCase()}   |   STRATEGIC DELIVERABLES & GOVERNANCE`,
    { x: 0.8, y: 0.2, w: 11.7, h: 0.35, fontSize: 10, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE }
  );

  slide1.addText("STRATEGIC DELIVERABLES & EXECUTION GOVERNANCE", {
    x: 0.8, y: 1.6, w: 11.7, h: 1.2, fontSize: 32, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  slide1.addText(
    `Comprehensive assessment of workstream velocity, deliverable readiness, and critical path governance for ${options.projectName}.`,
    { x: 0.8, y: 2.85, w: 11.7, h: 0.6, fontSize: 15, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  // 3-Part Engagement Summary Box
  const consultCols = [
    { title: "ENGAGEMENT SCOPE", sub: `${ctx.totalTasks} Total Deliverables`, detail: "Confirmed project workstream inventory.", x: 0.8 },
    { title: "GOVERNANCE PERIOD", sub: options.periodLabel, detail: "Audit and reporting timeframe.", x: 4.8 },
    { title: "EXECUTIVE VERDICT", sub: `${ctx.completionRate}% Progress`, detail: "Overall milestone execution velocity.", x: 8.8 },
  ];

  consultCols.forEach((col) => {
    slide1.addShape(pptx.ShapeType.rect, {
      x: col.x, y: 3.8, w: 3.7, h: 2.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }
    });
    slide1.addText(col.title, { x: col.x + 0.25, y: 4.0, w: 3.2, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE });
    slide1.addText(col.sub, { x: col.x + 0.25, y: 4.35, w: 3.2, h: 0.6, fontSize: 18, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE });
    slide1.addText(col.detail, { x: col.x + 0.25, y: 5.1, w: 3.2, h: 0.6, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY });
  });

  slide1.addText(
    `Prepared by Orbitwork Strategic Advisory Practice  •  Confidential & Proprietary`,
    { x: 0.8, y: 6.6, w: 11.7, h: 0.3, fontSize: 9.5, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  // Slide 2: Minto 3-Pillar Framework
  const slide2 = pptx.addSlide();
  slide2.background = { color: ctx.C_BG };
  addNavButtons(slide2, ctx);

  slide2.addText(`Action Title: Delivery velocity remains on track at ${ctx.completionRate}% completion, but critical path items require managerial intervention.`, {
    x: 0.8, y: 0.4, w: 8.8, h: 0.7, fontSize: 14, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  // 3 Vertical Pillars
  const pillars = [
    {
      num: "01",
      title: "WORKSTREAM VELOCITY",
      metric: `${ctx.completionRate}%`,
      sub: "Deliverables Completed",
      desc: `Total of ${ctx.completedTasks.length} milestones successfully verified and delivered to stakeholders. Execution pace supports core objectives.`,
      x: 0.8,
      color: ctx.C_ACCENT,
    },
    {
      num: "02",
      title: "EXECUTION QUALITY",
      metric: `${ctx.inProgressTasks.length}`,
      sub: "Active Deliverables",
      desc: `${ctx.inProgressTasks.length} deliverables currently in development. Engineering bandwidth is actively allocated across high-priority workstreams.`,
      x: 4.8,
      color: ctx.C_ACCENT2,
    },
    {
      num: "03",
      title: "DELIVERY RISK",
      metric: `${ctx.overdueTasks.length}`,
      sub: "Items Requiring Action",
      desc: `${ctx.overdueTasks.length} deliverables overdue and ${ctx.holdTasks.length} on hold. Targeted intervention required to maintain scheduled release window.`,
      x: 8.8,
      color: ctx.C_CRIMSON,
    },
  ];

  pillars.forEach((p) => {
    slide2.addShape(pptx.ShapeType.rect, {
      x: p.x, y: 1.4, w: 3.7, h: 5.3, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }
    });
    slide2.addText(p.num, { x: p.x + 0.25, y: 1.6, w: 3.2, h: 0.35, fontSize: 12, bold: true, color: p.color, fontFace: ctx.FONT_TITLE });
    slide2.addText(p.title, { x: p.x + 0.25, y: 1.95, w: 3.2, h: 0.35, fontSize: 13, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE });
    slide2.addText(p.metric, { x: p.x + 0.25, y: 2.4, w: 3.2, h: 0.7, fontSize: 36, bold: true, color: p.color, fontFace: ctx.FONT_TITLE });
    slide2.addText(p.sub, { x: p.x + 0.25, y: 3.2, w: 3.2, h: 0.3, fontSize: 11, bold: true, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY });
    slide2.addText(p.desc, { x: p.x + 0.25, y: 3.7, w: 3.2, h: 2.7, fontSize: 11, color: ctx.C_PRIMARY, fontFace: ctx.FONT_BODY });
  });

  // Slide 3: Strategic 2x2 Execution Framework
  const slide3 = pptx.addSlide();
  slide3.background = { color: ctx.C_BG };
  addNavButtons(slide3, ctx);

  slide3.addText("STRATEGIC 2×2 EXECUTION MATURITY FRAMEWORK", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide3.addText("Mapping project scope across strategic impact vs execution progress", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const consultQuads = [
    { title: "HIGH IMPACT • ADVANCED PROGRESS", count: ctx.completedTasks.length, x: 0.8, y: 1.4, color: ctx.C_ACCENT, role: "Strategic Wins (Ready for Launch)" },
    { title: "HIGH IMPACT • IN DEVELOPMENT", count: ctx.inProgressTasks.length, x: 6.8, y: 1.4, color: ctx.C_ACCENT2, role: "Core Value Drivers (Priority Focus)" },
    { title: "BLOCKED / REQUIRES INTERVENTION", count: ctx.holdTasks.length + ctx.overdueTasks.length, x: 0.8, y: 4.2, color: ctx.C_CRIMSON, role: "Escalation Queue (Executive Action)" },
    { title: "STAGED / FUTURE PIPELINE", count: ctx.pendingTasks.length, x: 6.8, y: 4.2, color: ctx.C_SECONDARY, role: "Backlog Pipeline (Subsequent Sprints)" },
  ];

  consultQuads.forEach((cq) => {
    slide3.addShape(pptx.ShapeType.rect, {
      x: cq.x, y: cq.y, w: 5.7, h: 2.6, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }
    });
    slide3.addText(cq.title, { x: cq.x + 0.25, y: cq.y + 0.2, w: 4.0, h: 0.25, fontSize: 9.5, bold: true, color: cq.color, fontFace: ctx.FONT_TITLE });
    slide3.addText(`${cq.count}`, { x: cq.x + 4.2, y: cq.y + 0.15, w: 1.25, h: 0.5, fontSize: 26, bold: true, color: cq.color, align: "right" });
    slide3.addText(cq.role, { x: cq.x + 0.25, y: cq.y + 0.65, w: 5.2, h: 0.4, fontSize: 13, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE });
    slide3.addText(`Workstream portfolio allocation accounts for ${Math.round((cq.count * 100) / Math.max(1, ctx.totalTasks))}% of overall initiative scope.`, {
      x: cq.x + 0.25, y: cq.y + 1.2, w: 5.2, h: 1.1, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
    });
  });

  // Slide 4: Strategic Staffing Matrix
  const slide4 = pptx.addSlide();
  slide4.background = { color: ctx.C_BG };
  addNavButtons(slide4, ctx);

  slide4.addText("STRATEGIC WORKSTREAM ALLOCATION MATRIX", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide4.addText("Resource allocation balance and workstream capacity analysis", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const matrixRows: any[] = [
    [
      { text: "WORKSTREAM OWNER", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      { text: "ALLOCATED SCOPE", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      { text: "DELIVERED", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      { text: "IN FLIGHT", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      { text: "AT RISK", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      { text: "CAPACITY STATUS", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
    ],
  ];

  ctx.resources.slice(0, 6).forEach((r) => {
    matrixRows.push([
      { text: r.name, options: { bold: true } },
      { text: `${r.totalAssigned} deliverables` },
      { text: `${r.completedCount}`, options: { color: ctx.C_ACCENT, bold: true } },
      { text: `${r.inProgressCount}` },
      { text: `${r.overdueCount}`, options: { color: r.overdueCount > 0 ? ctx.C_CRIMSON : ctx.C_SECONDARY } },
      { text: r.overdueCount > 0 ? "CAPACITY BOTTLENECK" : "BALANCED ALLOCATION", options: { bold: true, color: r.overdueCount > 0 ? ctx.C_AMBER : ctx.C_ACCENT } },
    ]);
  });
  slide4.addTable(matrixRows as any, {
    x: 0.8, y: 1.5, w: 11.7, h: 5.2,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 10.5,
    fontFace: ctx.FONT_BODY,
  });

  // Slide 5: Strategic Risk Framework (Observation -> Implication -> Action)
  const slide5 = pptx.addSlide();
  slide5.background = { color: ctx.C_BG };
  addNavButtons(slide5, ctx);

  slide5.addText("STRATEGIC RECOMMENDATIONS & RISK GOVERNANCE", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });
  slide5.addText("Structured Observation → Strategic Implication → Recommended Action table", {
    x: 0.8, y: 0.85, w: 8.8, h: 0.3, fontSize: 11, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY
  });

  const recRows: any[] = [
    [
      { text: "KEY OBSERVATION", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      { text: "STRATEGIC IMPLICATION", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      { text: "RECOMMENDED ACTION", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
    ],
    [
      { text: `${ctx.completionRate}% of deliverables delivered on schedule.`, options: { bold: true } },
      { text: "Core milestone velocity is healthy and satisfies initial sponsor expectations." },
      { text: "Lock in completed workstream deliverables and transition to verification testing.", options: { color: ctx.C_ACCENT, bold: true } },
    ],
    [
      { text: `${ctx.overdueTasks.length} deliverable(s) currently past deadline.`, options: { bold: true, color: ctx.C_CRIMSON } },
      { text: "Timeline slippage threatens target launch date if unaddressed in current sprint." },
      { text: "Execute critical path rebalancing and deploy secondary engineer to unblock items.", options: { color: ctx.C_CRIMSON, bold: true } },
    ],
    [
      { text: `${ctx.holdTasks.length} deliverable(s) paused on dependency review.`, options: { bold: true, color: ctx.C_AMBER } },
      { text: "Upstream architectural dependencies are creating idle engineering capacity." },
      { text: "Convene stakeholder alignment session to resolve requirements within 48 hours.", options: { color: ctx.C_AMBER, bold: true } },
    ],
  ];

  slide5.addTable(recRows as any, {
    x: 0.8, y: 1.5, w: 11.7, h: 5.2,
    border: { color: ctx.C_BORDER, pt: 1 },
    fontSize: 10.5,
    fontFace: ctx.FONT_BODY,
  });
}

// =========================================================================
// 6. SWISS INTERNATIONAL MINIMALIST DECK RENDERER (Swiss, Notion, etc.)
// =========================================================================
function renderMinimalistDeck(ctx: DeckContext) {
  const { pptx, template, options } = ctx;

  // Slide 1: Cover (Stark International Typographic Style)
  const slide1 = pptx.addSlide();
  slide1.background = { color: ctx.C_BG };
  if (template.transition && template.transition !== "none") (slide1 as any).transition = { type: template.transition };

  // Massive Stark Typography (48pt)
  slide1.addText(
    "PROJECT STATUS\nREPORT",
    { x: 0.8, y: 1.6, w: 11.5, h: 1.8, fontSize: 48, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica" }
  );

  // Single Hairline Rule
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 3.6, w: 11.7, h: 0.02, fill: { color: ctx.C_PRIMARY }, line: { color: ctx.C_PRIMARY }
  });

  slide1.addText(
    `${options.projectName.toUpperCase()}  /  ${options.periodLabel.toUpperCase()}  /  ${ctx.totalTasks} DELIVERABLES`,
    { x: 0.8, y: 3.9, w: 11.7, h: 0.4, fontSize: 13, bold: true, color: ctx.C_SECONDARY, fontFace: "Helvetica" }
  );

  slide1.addText(
    `Overall Delivery Velocity: ${ctx.completionRate}% Completed  •  ${ctx.inProgressTasks.length} In Progress  •  ${ctx.overdueTasks.length} Overdue`,
    { x: 0.8, y: 4.5, w: 11.7, h: 0.4, fontSize: 12, color: ctx.C_SECONDARY, fontFace: "Helvetica" }
  );

  slide1.addText("ORBITWORK MINIMALIST • SWISS TYPOGRAPHIC EDITION", {
    x: 0.8, y: 6.6, w: 11.7, h: 0.3, fontSize: 9.5, color: ctx.C_SECONDARY, fontFace: "Helvetica"
  });

  // Slide 2: One Major Message (Giant 72pt Focal Number)
  const slide2 = pptx.addSlide();
  slide2.background = { color: ctx.C_BG };
  addNavButtons(slide2, ctx);

  slide2.addText("01 / PERFORMANCE", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 18, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica"
  });

  // Giant 72pt Focal Number
  slide2.addText(`${ctx.completionRate}%`, {
    x: 0.8, y: 1.8, w: 4.8, h: 1.5, fontSize: 76, bold: true, color: ctx.C_ACCENT, fontFace: "Helvetica"
  });
  slide2.addText("COMPLETED DELIVERABLES", {
    x: 0.8, y: 3.4, w: 4.8, h: 0.3, fontSize: 12, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica"
  });
  slide2.addText(`${ctx.completedTasks.length} of ${ctx.totalTasks} tasks verified and delivered to production.`, {
    x: 0.8, y: 3.8, w: 4.8, h: 0.8, fontSize: 12, color: ctx.C_SECONDARY, fontFace: "Helvetica"
  });

  // Right Side Clean Sub-Metrics
  slide2.addShape(pptx.ShapeType.rect, {
    x: 6.5, y: 1.8, w: 6.0, h: 0.02, fill: { color: ctx.C_BORDER }, line: { color: ctx.C_BORDER }
  });
  slide2.addText(`${ctx.inProgressTasks.length}`, {
    x: 6.5, y: 2.1, w: 2.0, h: 0.8, fontSize: 40, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica"
  });
  slide2.addText("IN PROGRESS\nActive engineering execution", {
    x: 8.6, y: 2.2, w: 3.9, h: 0.6, fontSize: 11, bold: true, color: ctx.C_SECONDARY, fontFace: "Helvetica"
  });

  slide2.addShape(pptx.ShapeType.rect, {
    x: 6.5, y: 3.3, w: 6.0, h: 0.02, fill: { color: ctx.C_BORDER }, line: { color: ctx.C_BORDER }
  });
  slide2.addText(`${ctx.overdueTasks.length}`, {
    x: 6.5, y: 3.6, w: 2.0, h: 0.8, fontSize: 40, bold: true, color: ctx.C_ACCENT, fontFace: "Helvetica"
  });
  slide2.addText("OVERDUE\nRequiring schedule revision", {
    x: 8.6, y: 3.7, w: 3.9, h: 0.6, fontSize: 11, bold: true, color: ctx.C_SECONDARY, fontFace: "Helvetica"
  });

  slide2.addShape(pptx.ShapeType.rect, {
    x: 6.5, y: 4.8, w: 6.0, h: 0.02, fill: { color: ctx.C_BORDER }, line: { color: ctx.C_BORDER }
  });
  slide2.addText(`${ctx.holdTasks.length}`, {
    x: 6.5, y: 5.1, w: 2.0, h: 0.8, fontSize: 40, bold: true, color: ctx.C_SECONDARY, fontFace: "Helvetica"
  });
  slide2.addText("ON HOLD\nBlocked by external dependency", {
    x: 8.6, y: 5.2, w: 3.9, h: 0.6, fontSize: 11, bold: true, color: ctx.C_SECONDARY, fontFace: "Helvetica"
  });

  // Slide 3: Typographic Minimalist Columns
  const slide3 = pptx.addSlide();
  slide3.background = { color: ctx.C_BG };
  addNavButtons(slide3, ctx);

  slide3.addText("02 / STATUS OVERVIEW", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 18, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica"
  });

  const columns = [
    { num: "01", name: "COMPLETED", count: ctx.completedTasks.length, pct: ctx.completionRate, color: ctx.C_ACCENT, x: 0.8 },
    { num: "02", name: "IN PROGRESS", count: ctx.inProgressTasks.length, pct: ctx.inProgressRate, color: ctx.C_PRIMARY, x: 3.8 },
    { num: "03", name: "ON HOLD", count: ctx.holdTasks.length, pct: ctx.holdRate, color: ctx.C_SECONDARY, x: 6.8 },
    { num: "04", name: "PENDING", count: ctx.pendingTasks.length, pct: ctx.pendingRate, color: ctx.C_SECONDARY, x: 9.8 },
  ];

  columns.forEach((c) => {
    slide3.addText(c.num, { x: c.x, y: 1.6, w: 2.6, h: 0.35, fontSize: 12, bold: true, color: c.color, fontFace: "Helvetica" });
    slide3.addText(c.name, { x: c.x, y: 2.0, w: 2.6, h: 0.35, fontSize: 13, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica" });
    slide3.addText(`${c.count}`, { x: c.x, y: 2.6, w: 2.6, h: 0.8, fontSize: 44, bold: true, color: c.color, fontFace: "Helvetica" });
    slide3.addText(`${c.pct}% of scope`, { x: c.x, y: 3.5, w: 2.6, h: 0.35, fontSize: 11, color: ctx.C_SECONDARY, fontFace: "Helvetica" });
    slide3.addShape(pptx.ShapeType.rect, {
      x: c.x + 2.7, y: 1.6, w: 0.02, h: 4.8, fill: { color: ctx.C_BORDER }, line: { color: ctx.C_BORDER }
    });
  });

  // Slide 4: Typographic Contributor Index
  const slide4 = pptx.addSlide();
  slide4.background = { color: ctx.C_BG };
  addNavButtons(slide4, ctx);

  slide4.addText("03 / CONTRIBUTOR INDEX", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 18, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica"
  });

  ctx.resources.slice(0, 6).forEach((r, idx) => {
    const yPos = 1.8 + idx * 0.8;
    slide4.addText(r.name, { x: 0.8, y: yPos, w: 4.5, h: 0.4, fontSize: 14, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica" });
    slide4.addText(`${r.totalAssigned} assigned  •  ${r.completedCount} completed  •  ${r.overdueCount} overdue`, {
      x: 5.5, y: yPos, w: 7.0, h: 0.4, fontSize: 12, color: ctx.C_SECONDARY, fontFace: "Helvetica", align: "right"
    });
    slide4.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: yPos + 0.55, w: 11.7, h: 0.01, fill: { color: ctx.C_BORDER }, line: { color: ctx.C_BORDER }
    });
  });

  // Slide 5: Stark Minimalist Focus List
  const slide5 = pptx.addSlide();
  slide5.background = { color: ctx.C_BG };
  addNavButtons(slide5, ctx);

  slide5.addText("04 / ATTENTION REQUIRED", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 18, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica"
  });

  const alerts = [...ctx.overdueTasks, ...ctx.holdTasks].slice(0, 6);
  if (alerts.length === 0) {
    slide5.addText("ALL WORKSTREAMS ON SCHEDULE. ZERO ESCALATIONS.", {
      x: 0.8, y: 2.0, w: 11.7, h: 0.5, fontSize: 14, bold: true, color: ctx.C_ACCENT, fontFace: "Helvetica"
    });
  } else {
    alerts.forEach((t, idx) => {
      const yPos = 1.8 + idx * 0.8;
      slide5.addText(t.isOverdue ? "[OVERDUE]" : "[ON HOLD]", {
        x: 0.8, y: yPos, w: 1.8, h: 0.4, fontSize: 12, bold: true, color: ctx.C_ACCENT, fontFace: "Helvetica"
      });
      slide5.addText(`[${t.key}] ${t.title}`, {
        x: 2.8, y: yPos, w: 7.0, h: 0.4, fontSize: 13, bold: true, color: ctx.C_PRIMARY, fontFace: "Helvetica"
      });
      slide5.addText(t.assignees[0]?.name || "Unassigned", {
        x: 10.0, y: yPos, w: 2.5, h: 0.4, fontSize: 12, color: ctx.C_SECONDARY, fontFace: "Helvetica", align: "right"
      });
      slide5.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: yPos + 0.55, w: 11.7, h: 0.01, fill: { color: ctx.C_BORDER }, line: { color: ctx.C_BORDER }
      });
    });
  }
}

// =========================================================================
// 7. CREATIVE LAYERED & ASYMMETRIC DECK RENDERER (Bauhaus, Terracotta, etc.)
// =========================================================================
function renderCreativeLayeredDeck(ctx: DeckContext) {
  const { pptx, template, options } = ctx;

  // Slide 1: Cover (Asymmetric Geometric Color Blocks)
  const slide1 = pptx.addSlide();
  slide1.background = { color: ctx.C_BG };
  if (template.transition && template.transition !== "none") (slide1 as any).transition = { type: template.transition };

  // Asymmetric Color Block on left
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 4.2, h: 7.5, fill: { color: ctx.C_CARD }, line: { color: ctx.C_CARD }
  });

  slide1.addText("CREATIVE PROJECT REPORT", {
    x: 0.8, y: 1.5, w: 3.2, h: 0.35, fontSize: 10, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE
  });
  slide1.addText(options.periodLabel, {
    x: 0.8, y: 1.9, w: 3.2, h: 0.6, fontSize: 18, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  // Layered Offset Title Box on Right
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 3.4, y: 1.4, w: 9.0, h: 4.8, fill: { color: ctx.C_BG }, line: { color: ctx.C_BORDER, width: 2 }, rectRadius: 0.15
  });

  slide1.addText(options.projectName.toUpperCase(), {
    x: 3.8, y: 1.8, w: 8.2, h: 0.35, fontSize: 12, bold: true, color: ctx.C_ACCENT, fontFace: ctx.FONT_TITLE
  });
  slide1.addText("PROJECT STATUS & EXECUTION PORTFOLIO", {
    x: 3.8, y: 2.2, w: 8.2, h: 1.2, fontSize: 32, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  slide1.addText(
    `Scope Overview: ${ctx.totalTasks} Confirmed Deliverables  •  ${ctx.completionRate}% Progress  •  Live Tracked`,
    { x: 3.8, y: 3.6, w: 8.2, h: 0.5, fontSize: 14, color: ctx.C_SECONDARY, fontFace: ctx.FONT_BODY }
  );

  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 3.8, y: 4.4, w: 3.8, h: 1.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_ACCENT, width: 1.5 }, rectRadius: 0.1
  });
  slide1.addText("OVERALL VELOCITY", { x: 4.0, y: 4.55, w: 3.4, h: 0.25, fontSize: 9, bold: true, color: ctx.C_SECONDARY });
  slide1.addText(`${ctx.completionRate}% Done`, { x: 4.0, y: 4.8, w: 3.4, h: 0.55, fontSize: 22, bold: true, color: ctx.C_ACCENT });

  // Slide 2: Asymmetric Layered Metric Cards
  const slide2 = pptx.addSlide();
  slide2.background = { color: ctx.C_BG };
  addNavButtons(slide2, ctx);

  slide2.addText("CREATIVE EXECUTION METRICS", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  // Staggered Pod 1: Tall Hero Card
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 3.8, h: 5.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_ACCENT, width: 1.5 }, rectRadius: 0.15
  });
  slide2.addText("COMPLETION RATIO", { x: 1.05, y: 1.8, w: 3.3, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY });
  slide2.addText(`${ctx.completionRate}%`, { x: 1.05, y: 2.1, w: 3.3, h: 0.9, fontSize: 48, bold: true, color: ctx.C_ACCENT });
  slide2.addText(
    `${ctx.completedTasks.length} deliverables successfully verified and signed off across all workstreams.`,
    { x: 1.05, y: 3.2, w: 3.3, h: 1.2, fontSize: 12, color: ctx.C_PRIMARY }
  );

  // Staggered Pod 2: Top Wide Card (Chart)
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 4.9, y: 1.5, w: 7.6, h: 2.8, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide2.addText("DELIVERABLE VELOCITY SPECTRUM", { x: 5.15, y: 1.7, w: 7.1, h: 0.25, fontSize: 10, bold: true, color: ctx.C_SECONDARY });
  slide2.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "Scope",
        labels: ["Done", "Active", "Hold", "Pending"],
        values: [ctx.completedTasks.length, ctx.inProgressTasks.length, ctx.holdTasks.length, ctx.pendingTasks.length],
      },
    ],
    {
      x: 5.0, y: 1.95, w: 7.4, h: 2.2,
      chartColors: [ctx.C_ACCENT, ctx.C_ACCENT2, ctx.C_AMBER, ctx.C_SECONDARY],
      barDir: "col",
      showValue: true,
    }
  );

  // Staggered Pod 3: Bottom Dual Cards
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 4.9, y: 4.5, w: 3.65, h: 2.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide2.addText("IN FLIGHT", { x: 5.15, y: 4.7, w: 3.15, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY });
  slide2.addText(`${ctx.inProgressTasks.length}`, { x: 5.15, y: 4.95, w: 3.15, h: 0.6, fontSize: 28, bold: true, color: ctx.C_ACCENT2 });

  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 8.85, y: 4.5, w: 3.65, h: 2.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
  });
  slide2.addText("AT RISK", { x: 9.05, y: 4.7, w: 3.15, h: 0.25, fontSize: 9.5, bold: true, color: ctx.C_SECONDARY });
  slide2.addText(`${ctx.overdueTasks.length}`, { x: 9.05, y: 4.95, w: 3.15, h: 0.6, fontSize: 28, bold: true, color: ctx.C_CRIMSON });

  // Slide 3: Asymmetric Status Clusters (Hero Status 50% width)
  const slide3 = pptx.addSlide();
  slide3.background = { color: ctx.C_BG };
  addNavButtons(slide3, ctx);

  slide3.addText("ASYMMETRIC STATUS CLUSTERS", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  // Hero Status Card (50% slide width on left)
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.6, h: 5.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_ACCENT, width: 2 }, rectRadius: 0.15
  });
  slide3.addText("DOMINANT WORKFLOW STATE", { x: 1.1, y: 1.8, w: 5.0, h: 0.25, fontSize: 10, bold: true, color: ctx.C_ACCENT });
  slide3.addText("COMPLETED DELIVERABLES", { x: 1.1, y: 2.1, w: 5.0, h: 0.5, fontSize: 20, bold: true, color: ctx.C_PRIMARY });
  slide3.addText(`${ctx.completedTasks.length}`, { x: 1.1, y: 2.7, w: 5.0, h: 1.1, fontSize: 64, bold: true, color: ctx.C_ACCENT });
  slide3.addText(`${ctx.completionRate}% of total initiative scope verified & shipped.`, {
    x: 1.1, y: 4.0, w: 5.0, h: 0.6, fontSize: 13, bold: true, color: ctx.C_PRIMARY
  });

  // Stacked Status Cards on Right
  const sideStatuses = [
    { name: "IN ACTIVE EXECUTION", count: ctx.inProgressTasks.length, pct: ctx.inProgressRate, color: ctx.C_ACCENT2, y: 1.5 },
    { name: "ON HOLD / PAUSED", count: ctx.holdTasks.length, pct: ctx.holdRate, color: ctx.C_AMBER, y: 3.25 },
    { name: "PENDING BACKLOG", count: ctx.pendingTasks.length, pct: ctx.pendingRate, color: ctx.C_SECONDARY, y: 5.0 },
  ];

  sideStatuses.forEach((st) => {
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: 6.8, y: st.y, w: 5.7, h: 1.55, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.12
    });
    slide3.addText(st.name, { x: 7.05, y: st.y + 0.2, w: 3.8, h: 0.25, fontSize: 10, bold: true, color: st.color });
    slide3.addText(`${st.count}`, { x: 10.5, y: st.y + 0.15, w: 1.7, h: 0.55, fontSize: 26, bold: true, color: st.color, align: "right" });
    slide3.addText(`${st.pct}% of scope`, { x: 10.5, y: st.y + 0.7, w: 1.7, h: 0.3, fontSize: 9.5, color: ctx.C_SECONDARY, align: "right" });
  });

  // Slide 4: Creative Contributor Showcase
  const slide4 = pptx.addSlide();
  slide4.background = { color: ctx.C_BG };
  addNavButtons(slide4, ctx);

  slide4.addText("CREATIVE CONTRIBUTOR SHOWCASE", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  ctx.resources.slice(0, 3).forEach((r, idx) => {
    const xPos = 0.8 + idx * 3.95;
    slide4.addShape(pptx.ShapeType.roundRect, {
      x: xPos, y: 1.5, w: 3.75, h: 5.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_BORDER, width: 1 }, rectRadius: 0.15
    });
    slide4.addText(r.name, { x: xPos + 0.3, y: 1.8, w: 3.15, h: 0.5, fontSize: 16, bold: true, color: ctx.C_PRIMARY });
    const completionRate = r.totalAssigned ? Math.round((r.completedCount * 100) / r.totalAssigned) : 0;
    slide4.addText(`${completionRate}% Completed`, { x: xPos + 0.3, y: 2.4, w: 3.15, h: 0.4, fontSize: 18, bold: true, color: ctx.C_ACCENT });
    slide4.addText(`Assigned: ${r.totalAssigned} deliverables\nDelivered: ${r.completedCount}\nIn Flight: ${r.inProgressCount}\nOverdue: ${r.overdueCount}`, {
      x: xPos + 0.3, y: 3.1, w: 3.15, h: 2.5, fontSize: 11, color: ctx.C_SECONDARY
    });
  });

  // Slide 5: Visual Sticky Attention Board
  const slide5 = pptx.addSlide();
  slide5.background = { color: ctx.C_BG };
  addNavButtons(slide5, ctx);

  slide5.addText("VISUAL ATTENTION BOARD", {
    x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
  });

  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_CRIMSON, width: 1.5 }, rectRadius: 0.15
  });
  slide5.addText("CRITICAL ESCALATIONS", { x: 1.1, y: 1.8, w: 5.1, h: 0.3, fontSize: 12, bold: true, color: ctx.C_CRIMSON });
  const odText = ctx.overdueTasks.slice(0, 5).map(t => `📌 [${t.key}] ${t.title}`).join("\n\n");
  slide5.addText(odText || "Zero overdue escalations.", { x: 1.1, y: 2.3, w: 5.1, h: 4.1, fontSize: 11, color: ctx.C_PRIMARY });

  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.5, w: 5.7, h: 5.2, fill: { color: ctx.C_CARD }, line: { color: ctx.C_AMBER, width: 1.5 }, rectRadius: 0.15
  });
  slide5.addText("DEPENDENCY BLOCKS", { x: 7.1, y: 1.8, w: 5.1, h: 0.3, fontSize: 12, bold: true, color: ctx.C_AMBER });
  const hdText = ctx.holdTasks.slice(0, 5).map(t => `📌 [${t.key}] ${t.title}`).join("\n\n");
  slide5.addText(hdText || "Zero active dependency blocks.", { x: 7.1, y: 2.3, w: 5.1, h: 4.1, fontSize: 11, color: ctx.C_PRIMARY });
}

// =========================================================================
// SHARED TASK CATALOG GENERATOR
// =========================================================================
function renderTaskCatalog(ctx: DeckContext) {
  const { pptx, tasks, options } = ctx;
  if (!options.includeCatalog || tasks.length === 0) return;
  if (options.selectedSections && options.selectedSections.length > 0) {
    if (!options.selectedSections.includes("catalog") && !options.selectedSections.includes("tasks")) {
      return;
    }
  }

  const pageSize = 12;
  const totalPages = Math.ceil(tasks.length / pageSize);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageTasks = tasks.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);
    const slide = pptx.addSlide();
    slide.background = { color: ctx.C_BG };
    addNavButtons(slide, ctx);

    slide.addText(`TASK CATALOG (PAGE ${pageIdx + 1} OF ${totalPages})`, {
      x: 0.8, y: 0.4, w: 8.8, h: 0.45, fontSize: 20, bold: true, color: ctx.C_PRIMARY, fontFace: ctx.FONT_TITLE
    });

    const catalogRows: any[] = [
      [
        { text: "KEY", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
        { text: "TITLE", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
        { text: "STATUS", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
        { text: "PRIORITY", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
        { text: "ASSIGNEE", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
        { text: "DUE DATE", options: { bold: true, color: ctx.C_PRIMARY, fill: ctx.C_CARD } },
      ],
    ];

    pageTasks.forEach((t) => {
      catalogRows.push([
        { text: t.key, options: { bold: true } },
        { text: t.title.slice(0, 48) },
        { text: t.statusName, options: { bold: true, color: t.isCompleted ? ctx.C_EMERALD : t.isOverdue ? ctx.C_CRIMSON : ctx.C_ACCENT } },
        { text: t.priority.toUpperCase() },
        { text: t.assignees[0]?.name || "Unassigned" },
        { text: t.dueDate || "—" },
      ]);
    });

    slide.addTable(catalogRows as any, {
      x: 0.8, y: 1.5, w: 11.7, h: 5.2,
      border: { color: ctx.C_BORDER, pt: 1 },
      fontSize: 9.5,
      fontFace: ctx.FONT_BODY,
    });
  }
}

// =========================================================================
// MAIN ENTRY POINT: buildPresentationDeck
// =========================================================================
export function buildPresentationDeck(
  options: PresentationReportOptions,
  tasks: TaskReportItem[],
  statuses: StatusMetric[],
  resources: ResourceMetric[]
): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${options.projectName} - Project Status Report`;
  pptx.author = "Orbitwork Project Management";
  pptx.company = options.organizationName || "Orbitwork Enterprise";

  const template: PresentationTemplate = getTemplateById(options.templateId || options.style);
  const archetype: DesignArchetype = getArchetype(template);

  let C_BG = template.bg;
  let C_CARD = template.cardBg;
  let C_BORDER = template.cardBorder;
  let C_PRIMARY = template.textPrimary;
  let C_SECONDARY = template.textSecondary;
  let C_ACCENT = template.accent;
  let C_ACCENT2 = template.accentSecondary || "10B981";
  let C_GOLD = template.isDark ? "EAB308" : template.accent;
  let C_AMBER = "D97706";
  let C_CRIMSON = "EF4444";
  let C_EMERALD = "10B981";
  const FONT_TITLE = template.fontTitle || "Inter";
  const FONT_BODY = template.fontBody || "Calibri";

  if (template.id === "pitch_sage") {
    C_BG = "8FA173";
    C_CARD = "7E9162";
    C_BORDER = "6F8254";
    C_PRIMARY = "FFFFFF";
    C_SECONDARY = "111111";
    C_ACCENT = "111111";
    C_ACCENT2 = "FFFFFF";
  }

  if (options.customColors) {
    if (options.customColors.primary) C_BG = options.customColors.primary.replace("#", "");
    if (options.customColors.secondary) C_CARD = options.customColors.secondary.replace("#", "");
    if (options.customColors.accent) C_ACCENT = options.customColors.accent.replace("#", "");
    if (options.customColors.background) C_BORDER = options.customColors.background.replace("#", "");
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const inProgressTasks = tasks.filter((t) => t.isInProgress);
  const holdTasks = tasks.filter((t) => t.isHold);
  const pendingTasks = tasks.filter((t) => t.isPending);
  const overdueTasks = tasks.filter((t) => t.isOverdue && !t.isCompleted);

  const completionRate = totalTasks ? Math.round((completedTasks.length * 100) / totalTasks) : 0;
  const inProgressRate = totalTasks ? Math.round((inProgressTasks.length * 100) / totalTasks) : 0;
  const holdRate = totalTasks ? Math.round((holdTasks.length * 100) / totalTasks) : 0;
  const pendingRate = totalTasks ? Math.round((pendingTasks.length * 100) / totalTasks) : 0;

  const ctx: DeckContext = {
    pptx,
    template,
    options,
    tasks,
    statuses,
    resources,
    totalTasks,
    completedTasks,
    inProgressTasks,
    holdTasks,
    pendingTasks,
    overdueTasks,
    completionRate,
    inProgressRate,
    holdRate,
    pendingRate,
    C_BG,
    C_CARD,
    C_BORDER,
    C_PRIMARY,
    C_SECONDARY,
    C_ACCENT,
    C_ACCENT2,
    C_GOLD,
    C_AMBER,
    C_CRIMSON,
    C_EMERALD,
    FONT_TITLE,
    FONT_BODY,
  };

  switch (archetype) {
    case "editorial":
      renderEditorialDeck(ctx);
      break;
    case "corporate":
      renderCorporateDeck(ctx);
      break;
    case "modern_saas":
      renderModernSaaSDeck(ctx);
      break;
    case "data_story":
      renderDataStoryDeck(ctx);
      break;
    case "consulting":
      renderConsultingDeck(ctx);
      break;
    case "minimalist":
      renderMinimalistDeck(ctx);
      break;
    case "creative_layered":
      renderCreativeLayeredDeck(ctx);
      break;
    default:
      renderCorporateDeck(ctx);
      break;
  }

  renderTaskCatalog(ctx);

  return pptx;
}
