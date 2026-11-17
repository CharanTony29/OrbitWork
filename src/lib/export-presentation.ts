import PptxGenJS from "pptxgenjs";
import { getTemplateById, type PresentationTemplate } from "./presentation/templates.ts";

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

export function buildPresentationDeck(
  options: PresentationReportOptions,
  tasks: TaskReportItem[],
  statuses: StatusMetric[],
  resources: ResourceMetric[]
): PptxGenJS {
  const pptx = new PptxGenJS();

  // Modern Office 365 / Google Slides 16:9 widescreen format (13.333" x 7.5")
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${options.projectName} - Project Status Report`;
  pptx.author = "Orbitwork Project Management";
  pptx.company = options.organizationName || "Orbitwork Enterprise";

  // Dynamic Presentation Template Resolution (Supports 30+ Curated Templates)
  const template: PresentationTemplate = getTemplateById(options.templateId || options.style);
  
  let C_NAVY = template.bg;
  let C_DARK_SLATE = template.cardBg;
  let C_BLUE = template.accent;
  let C_EMERALD = template.accentSecondary || "10B981";
  let C_AMBER = "D97706";
  let C_GOLD = template.isDark ? "EAB308" : template.accent;
  let C_CRIMSON = "EF4444";
  let C_SLATE = template.textSecondary;
  let C_LIGHT_BG = template.isDark ? template.bg : template.bg;
  let C_WHITE = template.textPrimary;
  let C_BORDER = template.cardBorder;
  const FONT_TITLE = template.fontTitle || "Inter";
  const FONT_BODY = template.fontBody || "Calibri";

  // Pitch Sage Special Fine-Tuning
  if (template.id === "pitch_sage") {
    C_NAVY = "8FA173";
    C_DARK_SLATE = "7E9162";
    C_LIGHT_BG = "8FA173";
    C_WHITE = "FFFFFF";
    C_SLATE = "111111";
    C_BLUE = "111111";
    C_EMERALD = "111111";
    C_BORDER = "6F8254";
  }

  // Handle custom user color overrides if provided
  if (options.customColors) {
    if (options.customColors.primary) C_NAVY = options.customColors.primary.replace("#", "");
    if (options.customColors.secondary) C_DARK_SLATE = options.customColors.secondary.replace("#", "");
    if (options.customColors.accent) C_BLUE = options.customColors.accent.replace("#", "");
    if (options.customColors.background) C_LIGHT_BG = options.customColors.background.replace("#", "");
  }

  // Compute key summary figures
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

  // -------------------------------------------------------------
  // SLIDE 1: Cover Slide
  // -------------------------------------------------------------
  const slide1 = pptx.addSlide();
  slide1.background = { color: C_NAVY };
  if (template.transition && template.transition !== "none") {
    (slide1 as any).transition = { type: template.transition };
  }

  // Decorative top accent stripes
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0.7,
    y: 0.8,
    w: 1.2,
    h: 0.08,
    fill: { color: C_GOLD },
    line: { color: C_GOLD },
  });
  slide1.addShape(pptx.ShapeType.rect, {
    x: 2.0,
    y: 0.8,
    w: 2.5,
    h: 0.08,
    fill: { color: C_BLUE },
    line: { color: C_BLUE },
  });

  // Eyebrow tag
  slide1.addText(
    `${(options.organizationName || "PROJECT MANAGEMENT").toUpperCase()} • EXECUTIVE REPORT`,
    {
      x: 0.7,
      y: 1.1,
      w: 11.5,
      h: 0.35,
      fontSize: 11,
      bold: true,
      color: C_GOLD,
      fontFace: FONT_TITLE,
    }
  );

  // Main Title (Pitch Sage dual-tone or bold header)
  if (template.id === "pitch_sage") {
    slide1.addText(
      [
        { text: "PROJECT STATUS &\n", options: { color: "FFFFFF" } },
        { text: "KPI REPORT", options: { color: "111111" } },
      ],
      {
        x: 0.7,
        y: 1.55,
        w: 11.8,
        h: 1.15,
        fontSize: 34,
        bold: true,
        fontFace: FONT_TITLE,
      }
    );
  } else {
    slide1.addText("PROJECT STATUS & EXECUTION REPORT", {
      x: 0.7,
      y: 1.55,
      w: 11.8,
      h: 1.1,
      fontSize: 32,
      bold: true,
      color: C_WHITE,
      fontFace: FONT_TITLE,
    });
  }

  // Project & Scope subtitle
  slide1.addText(
    `Project: ${options.projectName}${options.workspaceName ? `  |  Workspace: ${options.workspaceName}` : ""}`,
    {
      x: 0.7,
      y: 2.75,
      w: 11.8,
      h: 0.45,
      fontSize: 16,
      color: template.id === "pitch_sage" ? "111111" : C_SLATE,
      fontFace: FONT_BODY,
    }
  );

  // Period Badge Card
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 0.7,
    y: 3.65,
    w: 5.6,
    h: 1.35,
    fill: { color: C_DARK_SLATE },
    line: { color: C_BORDER, width: 1 },
    rectRadius: 0.1,
  });

  slide1.addText("REPORTING TIMEFRAME", {
    x: 0.9,
    y: 3.85,
    w: 5.2,
    h: 0.3,
    fontSize: 10,
    bold: true,
    color: C_GOLD,
    fontFace: "Calibri",
  });

  slide1.addText(options.periodLabel, {
    x: 0.9,
    y: 4.2,
    w: 5.2,
    h: 0.5,
    fontSize: 15,
    bold: true,
    color: C_WHITE,
    fontFace: "Calibri",
  });

  // Summary Metrics Quick Strip on Cover
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 6.6,
    y: 3.65,
    w: 5.95,
    h: 1.35,
    fill: { color: C_DARK_SLATE },
    line: { color: "334155", width: 1 },
    rectRadius: 0.1,
  });

  slide1.addText("PROJECT EXECUTION AT A GLANCE", {
    x: 6.8,
    y: 3.85,
    w: 5.5,
    h: 0.3,
    fontSize: 10,
    bold: true,
    color: "94A3B8",
    fontFace: "Calibri",
  });

  slide1.addText(
    `${totalTasks} Total Tasks   •   ${completionRate}% Completed   •   ${inProgressTasks.length} In Process   •   ${holdTasks.length} On Hold`,
    {
      x: 6.8,
      y: 4.2,
      w: 5.5,
      h: 0.5,
      fontSize: 13,
      bold: true,
      color: C_WHITE,
      fontFace: "Calibri",
    }
  );

  // Footer Metadata
  const todayDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  slide1.addText(
    `Prepared for Management & Stakeholders  •  Generated on ${todayDate}  •  Confidential & Proprietary`,
    {
      x: 0.7,
      y: 6.6,
      w: 11.9,
      h: 0.4,
      fontSize: 9.5,
      color: "64748B",
      fontFace: "Calibri",
    }
  );

  // Helper for adding standard header on content slides
  function addSlideHeader(slide: PptxGenJS.Slide, title: string, subtitle: string) {
    slide.background = { color: C_LIGHT_BG };
    if (template.transition && template.transition !== "none") {
      (slide as any).transition = { type: template.transition };
    }

    // Top accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.08,
      fill: { color: C_BLUE },
      line: { color: C_BLUE },
    });

    // Header Title
    slide.addText(title, {
      x: 0.7,
      y: 0.4,
      w: 9.2,
      h: 0.45,
      fontSize: 19,
      bold: true,
      color: template.isDark ? C_WHITE : C_NAVY,
      fontFace: FONT_TITLE,
    });

    // Subtitle
    slide.addText(subtitle, {
      x: 0.7,
      y: 0.85,
      w: 9.2,
      h: 0.3,
      fontSize: 10.5,
      color: template.isDark ? "94A3B8" : C_SLATE,
      fontFace: FONT_BODY,
    });

    // Right-hand project chip
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 10.2,
      y: 0.35,
      w: 2.4,
      h: 0.7,
      fill: { color: template.isDark ? C_DARK_SLATE : C_WHITE },
      line: { color: C_BORDER, width: 1 },
      rectRadius: 0.06,
    });
    slide.addText(options.projectName.slice(0, 22), {
      x: 10.25,
      y: 0.4,
      w: 2.3,
      h: 0.3,
      fontSize: 9.5,
      bold: true,
      align: "center",
      color: template.isDark ? C_WHITE : C_NAVY,
      fontFace: FONT_TITLE,
    });
    slide.addText(options.periodLabel.slice(0, 26), {
      x: 10.25,
      y: 0.7,
      w: 2.3,
      h: 0.25,
      fontSize: 8,
      align: "center",
      color: template.isDark ? "94A3B8" : C_SLATE,
      fontFace: FONT_BODY,
    });
  }

  // Helper for adding footer
  function addSlideFooter(slide: PptxGenJS.Slide, slideNumber: string) {
    slide.addText(
      `Orbitwork Project Management  |  ${options.projectName}  |  ${options.periodLabel}`,
      {
        x: 0.7,
        y: 6.95,
        w: 10.5,
        h: 0.3,
        fontSize: 8.5,
        color: "94A3B8",
        fontFace: "Calibri",
      }
    );
    slide.addText(slideNumber, {
      x: 11.3,
      y: 6.95,
      w: 1.3,
      h: 0.3,
      fontSize: 8.5,
      bold: true,
      align: "right",
      color: "94A3B8",
      fontFace: "Calibri",
    });
  }

  // Helper for adding interactive slide navigation bar
  function addSlideNavBar(slide: PptxGenJS.Slide, currentSlideNum: number) {
    const navItems = [
      { label: "Overview", slideNum: 1 },
      { label: "KPIs", slideNum: 2 },
      { label: "Status", slideNum: 3 },
      { label: "Workload", slideNum: 4 },
      { label: "Risks", slideNum: 5 },
      ...(options.includeCatalog !== false ? [{ label: "Catalog", slideNum: 6 }] : []),
    ];

    const startX = 4.8;
    const btnW = 0.8;
    const btnH = 0.28;
    const gap = 0.08;
    const navY = 0.48;

    navItems.forEach((item, idx) => {
      const isCurrent = item.slideNum === currentSlideNum;
      const x = startX + idx * (btnW + gap);
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y: navY,
        w: btnW,
        h: btnH,
        fill: { color: isCurrent ? C_BLUE : C_WHITE },
        line: { color: isCurrent ? C_BLUE : C_BORDER, width: 1 },
        rectRadius: 0.05,
        hyperlink: { slide: item.slideNum },
      });
      slide.addText(item.label, {
        x,
        y: navY + 0.02,
        w: btnW,
        h: btnH - 0.04,
        fontSize: 7.5,
        bold: isCurrent,
        align: "center",
        color: isCurrent ? C_WHITE : C_DARK_SLATE,
        fontFace: "Calibri",
        hyperlink: { slide: item.slideNum },
      });
    });
  }

  // -------------------------------------------------------------
  // SLIDE 2: Executive Summary & Health KPIs
  // -------------------------------------------------------------
  const slide2 = pptx.addSlide();
  addSlideHeader(
    slide2,
    "Executive Summary & Performance KPIs",
    "High-level execution velocity, completion rate, and workload health"
  );
  addSlideNavBar(slide2, 2);

  // 5 KPI Metric Cards
  const kpiCards = [
    {
      label: "TOTAL TASKS",
      value: String(totalTasks),
      sub: "Active Deliverables",
      color: C_NAVY,
      accent: C_BLUE,
    },
    {
      label: "COMPLETION RATE",
      value: `${completionRate}%`,
      sub: `${completedTasks.length} Closed`,
      color: C_EMERALD,
      accent: C_EMERALD,
    },
    {
      label: "IN PROGRESS",
      value: String(inProgressTasks.length),
      sub: `${inProgressRate}% of Total`,
      color: C_BLUE,
      accent: C_BLUE,
    },
    {
      label: "ON HOLD",
      value: String(holdTasks.length),
      sub: `${holdRate}% Paused`,
      color: C_AMBER,
      accent: C_AMBER,
    },
    {
      label: "OVERDUE ACTIVE",
      value: String(overdueTasks.length),
      sub: overdueTasks.length > 0 ? "Needs Attention" : "All on Track",
      color: overdueTasks.length > 0 ? C_CRIMSON : C_EMERALD,
      accent: overdueTasks.length > 0 ? C_CRIMSON : C_EMERALD,
    },
  ];

  const cardW = 2.25;
  const cardGap = 0.16;
  const startX = 0.7;

  kpiCards.forEach((kpi, idx) => {
    const xPos = startX + idx * (cardW + cardGap);
    // Background card
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: xPos,
      y: 1.4,
      w: cardW,
      h: 1.55,
      fill: { color: C_WHITE },
      line: { color: C_BORDER, width: 1 },
      rectRadius: 0.08,
    });
    // Top colored indicator line
    slide2.addShape(pptx.ShapeType.rect, {
      x: xPos + 0.15,
      y: 1.5,
      w: cardW - 0.3,
      h: 0.05,
      fill: { color: kpi.accent },
      line: { color: kpi.accent },
    });
    // Label
    slide2.addText(kpi.label, {
      x: xPos + 0.15,
      y: 1.62,
      w: cardW - 0.3,
      h: 0.25,
      fontSize: 8.5,
      bold: true,
      color: C_SLATE,
      fontFace: "Calibri",
    });
    // Large Value
    slide2.addText(kpi.value, {
      x: xPos + 0.15,
      y: 1.88,
      w: cardW - 0.3,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: kpi.color,
      fontFace: "Calibri",
    });
    // Subtext
    slide2.addText(kpi.sub, {
      x: xPos + 0.15,
      y: 2.55,
      w: cardW - 0.3,
      h: 0.25,
      fontSize: 9,
      color: C_SLATE,
      fontFace: "Calibri",
    });
  });

  // Left Panel: Native Interactive Doughnut Chart
  if (totalTasks > 0) {
    slide2.addChart(
      pptx.ChartType.doughnut,
      [
        {
          name: "Task Composition",
          labels: ["Completed", "In Progress", "On Hold", "Pending"],
          values: [
            completedTasks.length,
            inProgressTasks.length,
            holdTasks.length,
            pendingTasks.length,
          ],
        },
      ],
      {
        x: 0.7,
        y: 3.25,
        w: 5.85,
        h: 3.45,
        chartColors: [C_EMERALD, C_BLUE, C_AMBER, C_SLATE],
        dataLabelColor: "FFFFFF",
        showPercent: true,
        showLegend: true,
        legendPos: "b",
        legendFontSize: 9,
        holeSize: 55,
        showTitle: true,
        title: "TASK COMPLETION & DISTRIBUTION",
        titleFontSize: 10.5,
        titleColor: C_NAVY,
        titleBold: true,
      }
    );
  } else {
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 3.25,
      w: 5.85,
      h: 3.45,
      fill: { color: C_WHITE },
      line: { color: C_BORDER, width: 1 },
      rectRadius: 0.08,
    });
    slide2.addText("No tasks recorded for the selected timeframe.", {
      x: 0.95,
      y: 4.8,
      w: 5.3,
      h: 0.5,
      fontSize: 12,
      color: C_SLATE,
      align: "center",
      fontFace: "Calibri",
    });
  }

  // Right Panel: Operational Focus & Attention + AI Prompt Directives
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 6.78,
    y: 3.25,
    w: 5.85,
    h: 3.45,
    fill: { color: C_WHITE },
    line: { color: C_BORDER, width: 1 },
    rectRadius: 0.08,
  });
  slide2.addText("MANAGEMENT FOCUS & RISK AREAS", {
    x: 7.05,
    y: 3.45,
    w: 5.3,
    h: 0.3,
    fontSize: 10.5,
    bold: true,
    color: overdueTasks.length > 0 || holdTasks.length > 0 ? C_AMBER : C_EMERALD,
    fontFace: "Calibri",
  });

  const focusPoints = [
    `• Overdue Deliverables: ${
      overdueTasks.length > 0
        ? `${overdueTasks.length} active task(s) have passed due date.`
        : "Zero overdue tasks. All scheduled deliverables within deadline."
    }`,
    `• Work on Hold: ${
      holdTasks.length > 0
        ? `${holdTasks.length} item(s) paused pending dependencies.`
        : "Zero active bottlenecks or paused deliverables."
    }`,
    `• Unassigned Tasks: ${
      tasks.filter((t) => t.assignees.length === 0 && !t.isCompleted).length
    } unassigned active item(s) awaiting resource allocation.`,
    `• Action: ${
      overdueTasks.length > 0
        ? "Prioritize overdue milestones and clear blocked dependencies."
        : "Maintain current execution pace across upcoming sprints."
    }`,
  ];
  slide2.addText(focusPoints.join("\n\n"), {
    x: 7.05,
    y: 3.8,
    w: 5.3,
    h: options.aiPrompt ? 1.5 : 2.5,
    fontSize: 9.5,
    color: C_DARK_SLATE,
    fontFace: "Calibri",
  });

  if (options.aiPrompt) {
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: 7.05,
      y: 5.4,
      w: 5.3,
      h: 1.15,
      fill: { color: C_LIGHT_BG },
      line: { color: C_BLUE, width: 1 },
      rectRadius: 0.06,
    });
    slide2.addText("EXECUTIVE AI STRATEGY DIRECTIVES", {
      x: 7.15,
      y: 5.48,
      w: 5.1,
      h: 0.2,
      fontSize: 8.5,
      bold: true,
      color: C_BLUE,
      fontFace: "Calibri",
    });
    slide2.addText(options.aiPrompt.slice(0, 240), {
      x: 7.15,
      y: 5.7,
      w: 5.1,
      h: 0.75,
      fontSize: 8,
      color: C_DARK_SLATE,
      italic: true,
      fontFace: "Calibri",
    });
  }

  addSlideFooter(slide2, "Slide 2");

  // -------------------------------------------------------------
  // SLIDE 3: Task Status Breakdown & Workflow Distribution
  // -------------------------------------------------------------
  const slide3 = pptx.addSlide();
  addSlideHeader(
    slide3,
    "Task Status Breakdown & Workflow Lifecycle",
    "Detailed status categorization across Completed, In Process, On Hold, and Pending states"
  );
  addSlideNavBar(slide3, 3);

  // 4 Top Category Summary Boxes
  const statusBoxes = [
    {
      title: "COMPLETED",
      count: completedTasks.length,
      pct: `${completionRate}%`,
      desc: "Verified & Delivered",
      border: C_EMERALD,
      bg: "F0FDF4",
    },
    {
      title: "IN PROCESS",
      count: inProgressTasks.length,
      pct: `${inProgressRate}%`,
      desc: "Active Development",
      border: C_BLUE,
      bg: "EFF6FF",
    },
    {
      title: "PENDING / NEW",
      count: pendingTasks.length,
      pct: `${pendingRate}%`,
      desc: "Scheduled Backlog",
      border: "6366F1",
      bg: "EEF2FF",
    },
    {
      title: "ON HOLD",
      count: holdTasks.length,
      pct: `${holdRate}%`,
      desc: "Blocked / Awaiting",
      border: C_AMBER,
      bg: "FFFBEB",
    },
  ];

  const boxW = 2.85;
  const boxGap = 0.17;
  statusBoxes.forEach((box, i) => {
    const x = 0.7 + i * (boxW + boxGap);
    slide3.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.4,
      w: boxW,
      h: 1.35,
      fill: { color: box.bg },
      line: { color: box.border, width: 1.5 },
      rectRadius: 0.08,
    });
    slide3.addText(box.title, {
      x: x + 0.15,
      y: 1.5,
      w: boxW - 0.3,
      h: 0.25,
      fontSize: 8.5,
      bold: true,
      color: box.border,
      fontFace: "Calibri",
    });
    slide3.addText(`${box.count} tasks  (${box.pct})`, {
      x: x + 0.15,
      y: 1.75,
      w: boxW - 0.3,
      h: 0.45,
      fontSize: 15,
      bold: true,
      color: C_NAVY,
      fontFace: "Calibri",
    });
    slide3.addText(box.desc, {
      x: x + 0.15,
      y: 2.25,
      w: boxW - 0.3,
      h: 0.3,
      fontSize: 8.5,
      color: C_SLATE,
      fontFace: "Calibri",
    });
  });

  // Table of all Project Statuses (Left Side)
  const statusTableHeaders = [
    { text: "Workflow Status", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
    { text: "Category", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
    { text: "Count", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Share", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Operational Status", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
  ];

  const statusRows = statuses.map((st) => {
    const count = st.count || 0;
    const share = totalTasks ? Math.round((count * 100) / totalTasks) : 0;
    let opStatus = "Active Backlog";
    if (st.category === "completed" || st.name.toLowerCase().includes("done")) opStatus = "Delivered";
    else if (st.name.toLowerCase().includes("hold")) opStatus = "Paused";
    else if (st.category === "in_progress" || st.name.toLowerCase().includes("progress")) opStatus = "In Progress";

    return [
      { text: st.name, options: { bold: true, color: C_NAVY } },
      { text: (st.category || "Workflow").replace("_", " ").toUpperCase(), options: { color: C_SLATE, fontSize: 8 } },
      { text: String(count), options: { align: "center" as const, bold: true, color: C_NAVY } },
      { text: `${share}%`, options: { align: "center" as const, color: C_SLATE } },
      { text: opStatus, options: { color: C_DARK_SLATE, fontSize: 8.5 } },
    ];
  });

  slide3.addTable([statusTableHeaders, ...statusRows], {
    x: 0.7,
    y: 3.05,
    w: 6.2,
    colW: [1.8, 1.2, 0.8, 0.8, 1.6],
    fontSize: 9,
    fontFace: "Calibri",
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE },
    autoPage: false,
  });

  // Native Column Chart on Right
  if (statuses.length > 0) {
    const topStatuses = statuses.slice(0, 6);
    slide3.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Tasks by Status",
          labels: topStatuses.map((s) => s.name.slice(0, 14)),
          values: topStatuses.map((s) => s.count),
        },
      ],
      {
        x: 7.15,
        y: 3.05,
        w: 5.48,
        h: 3.65,
        barDir: "col",
        chartColors: [C_BLUE],
        showValue: true,
        showLegend: false,
        showTitle: true,
        title: "DISTRIBUTION BY WORKFLOW STATUS",
        titleFontSize: 10,
        titleColor: C_NAVY,
        titleBold: true,
      }
    );
  }

  addSlideFooter(slide3, "Slide 3");

  // -------------------------------------------------------------
  // SLIDE 4: Resource Allocation & Team Workload ("Who is working on it")
  // -------------------------------------------------------------
  const slide4 = pptx.addSlide();
  addSlideHeader(
    slide4,
    "Resource Allocation & Team Workload",
    "Active task distribution, team ownership, and completed contributions"
  );
  addSlideNavBar(slide4, 4);

  const resourceTableHeaders = [
    { text: "Team Member / Resource", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
    { text: "Assigned", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Active", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Hold", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Done", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Late", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
  ];

  const resourceRows = (resources.length > 0 ? resources : [
    {
      id: "unassigned",
      name: "Unassigned Deliverables",
      totalAssigned: totalTasks,
      completedCount: completedTasks.length,
      inProgressCount: inProgressTasks.length,
      holdCount: holdTasks.length,
      pendingCount: pendingTasks.length,
      overdueCount: overdueTasks.length,
    },
  ]).slice(0, 8).map((r) => [
    { text: r.name, options: { bold: true, color: C_NAVY } },
    { text: String(r.totalAssigned), options: { align: "center" as const, bold: true } },
    { text: String(r.inProgressCount), options: { align: "center" as const, color: C_BLUE, bold: true } },
    { text: String(r.holdCount), options: { align: "center" as const, color: r.holdCount > 0 ? C_AMBER : C_SLATE } },
    { text: String(r.completedCount), options: { align: "center" as const, color: C_EMERALD, bold: true } },
    { text: String(r.overdueCount), options: { align: "center" as const, color: r.overdueCount > 0 ? C_CRIMSON : C_SLATE, bold: r.overdueCount > 0 } },
  ]);

  slide4.addTable([resourceTableHeaders, ...resourceRows], {
    x: 0.7,
    y: 1.4,
    w: 6.2,
    colW: [2.2, 0.8, 0.8, 0.8, 0.8, 0.8],
    fontSize: 9,
    fontFace: "Calibri",
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE },
    autoPage: false,
  });

  // Native Horizontal Bar Chart on Right
  const topRes = (resources.length > 0 ? resources : []).slice(0, 5);
  if (topRes.length > 0) {
    slide4.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Completed",
          labels: topRes.map((r) => r.name.slice(0, 12)),
          values: topRes.map((r) => r.completedCount),
        },
        {
          name: "In Progress",
          labels: topRes.map((r) => r.name.slice(0, 12)),
          values: topRes.map((r) => r.inProgressCount),
        },
      ],
      {
        x: 7.15,
        y: 1.4,
        w: 5.48,
        h: 3.8,
        barDir: "bar",
        chartColors: [C_EMERALD, C_BLUE],
        showLegend: true,
        legendPos: "b",
        legendFontSize: 8.5,
        showValue: true,
        showTitle: true,
        title: "TEAM WORKLOAD: COMPLETED VS ACTIVE",
        titleFontSize: 10,
        titleColor: C_NAVY,
        titleBold: true,
      }
    );
  }

  // Resource capacity note below table
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 0.7,
    y: 5.35,
    w: 11.93,
    h: 1.35,
    fill: { color: C_WHITE },
    line: { color: C_BORDER, width: 1 },
    rectRadius: 0.08,
  });
  slide4.addText("CAPACITY & WORKLOAD OBSERVATIONS", {
    x: 0.95,
    y: 5.5,
    w: 11.4,
    h: 0.25,
    fontSize: 9.5,
    bold: true,
    color: C_BLUE,
    fontFace: "Calibri",
  });
  slide4.addText(
    `• Active Resource Count: ${resources.length} team member(s) actively engaged on project work.\n• Workload Balance: ${
      resources.length > 0
        ? `Average of ${Math.round(totalTasks / Math.max(1, resources.length))} task(s) per assigned resource.`
        : "Tasks need assignments to ensure full accountability."
    }`,
    {
      x: 0.95,
      y: 5.8,
      w: 11.4,
      h: 0.65,
      fontSize: 9.5,
      color: C_DARK_SLATE,
      fontFace: "Calibri",
    }
  );

  addSlideFooter(slide4, "Slide 4");

  // -------------------------------------------------------------
  // SLIDE 5: Critical Items & What Needs Attention
  // -------------------------------------------------------------
  const slide5 = pptx.addSlide();
  addSlideHeader(
    slide5,
    "Critical Items & What Needs Attention",
    "Items requiring managerial intervention: Overdue deadlines and paused / blocked deliverables"
  );
  addSlideNavBar(slide5, 5);

  // Left Column: Overdue Tasks
  slide5.addText(`OVERDUE DELIVERABLES (${overdueTasks.length})`, {
    x: 0.7,
    y: 1.4,
    w: 5.8,
    h: 0.35,
    fontSize: 10.5,
    bold: true,
    color: overdueTasks.length > 0 ? C_CRIMSON : C_EMERALD,
    fontFace: "Calibri",
  });

  if (overdueTasks.length === 0) {
    slide5.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 1.8,
      w: 5.85,
      h: 4.8,
      fill: { color: "F0FDF4" },
      line: { color: C_EMERALD, width: 1 },
      rectRadius: 0.08,
    });
    slide5.addText("✓ Zero Overdue Tasks\n\nAll project deliverables are actively tracking within scheduled target dates.", {
      x: 0.95,
      y: 3.5,
      w: 5.3,
      h: 1.5,
      fontSize: 11.5,
      bold: true,
      align: "center",
      color: C_EMERALD,
      fontFace: "Calibri",
    });
  } else {
    const overdueHeaders = [
      { text: "Task Title", options: { bold: true, fill: { color: C_CRIMSON }, color: C_WHITE } },
      { text: "Assignee", options: { bold: true, fill: { color: C_CRIMSON }, color: C_WHITE } },
      { text: "Due Date", options: { bold: true, fill: { color: C_CRIMSON }, color: C_WHITE } },
      { text: "Priority", options: { bold: true, fill: { color: C_CRIMSON }, color: C_WHITE } },
    ];
    const overdueRows = overdueTasks.slice(0, 8).map((t) => [
      { text: t.title.slice(0, 30), options: { bold: true, color: C_NAVY } },
      { text: t.assignees.map((a) => a.name).join(", ").slice(0, 20) || "Unassigned", options: { color: C_SLATE } },
      { text: t.dueDate || "Past due", options: { color: C_CRIMSON, bold: true } },
      { text: t.priority.toUpperCase(), options: { color: C_DARK_SLATE, bold: true } },
    ]);
    slide5.addTable([overdueHeaders, ...overdueRows], {
      x: 0.7,
      y: 1.8,
      w: 5.85,
      colW: [2.55, 1.4, 1.0, 0.9],
      fontSize: 8.5,
      fontFace: "Calibri",
      border: { pt: 0.5, color: C_BORDER },
      fill: { color: C_WHITE },
    });
  }

  // Right Column: Hold Tasks
  slide5.addText(`DELIVERABLES ON HOLD (${holdTasks.length})`, {
    x: 6.78,
    y: 1.4,
    w: 5.8,
    h: 0.35,
    fontSize: 10.5,
    bold: true,
    color: holdTasks.length > 0 ? C_AMBER : C_EMERALD,
    fontFace: "Calibri",
  });

  if (holdTasks.length === 0) {
    slide5.addShape(pptx.ShapeType.roundRect, {
      x: 6.78,
      y: 1.8,
      w: 5.85,
      h: 4.8,
      fill: { color: "F0FDF4" },
      line: { color: C_EMERALD, width: 1 },
      rectRadius: 0.08,
    });
    slide5.addText("✓ Zero Deliverables on Hold\n\nNo tasks are currently stalled, blocked, or awaiting external dependencies.", {
      x: 7.05,
      y: 3.5,
      w: 5.3,
      h: 1.5,
      fontSize: 11.5,
      bold: true,
      align: "center",
      color: C_EMERALD,
      fontFace: "Calibri",
    });
  } else {
    const holdHeaders = [
      { text: "Task Title", options: { bold: true, fill: { color: C_AMBER }, color: C_WHITE } },
      { text: "Assignee", options: { bold: true, fill: { color: C_AMBER }, color: C_WHITE } },
      { text: "Status", options: { bold: true, fill: { color: C_AMBER }, color: C_WHITE } },
      { text: "Priority", options: { bold: true, fill: { color: C_AMBER }, color: C_WHITE } },
    ];
    const holdRows = holdTasks.slice(0, 8).map((t) => [
      { text: t.title.slice(0, 30), options: { bold: true, color: C_NAVY } },
      { text: t.assignees.map((a) => a.name).join(", ").slice(0, 20) || "Unassigned", options: { color: C_SLATE } },
      { text: t.statusName, options: { color: C_AMBER, bold: true } },
      { text: t.priority.toUpperCase(), options: { color: C_DARK_SLATE, bold: true } },
    ]);
    slide5.addTable([holdHeaders, ...holdRows], {
      x: 6.78,
      y: 1.8,
      w: 5.85,
      colW: [2.55, 1.4, 1.0, 0.9],
      fontSize: 8.5,
      fontFace: "Calibri",
      border: { pt: 0.5, color: C_BORDER },
      fill: { color: C_WHITE },
    });
  }

  addSlideFooter(slide5, "Slide 5");

  // -------------------------------------------------------------
  // SLIDE 6+: Comprehensive Detailed Task Catalog (Paginated)
  // -------------------------------------------------------------
  if (options.includeCatalog !== false && tasks.length > 0) {
    const tasksPerPage = 8;
    const totalPages = Math.ceil(tasks.length / tasksPerPage);

    for (let page = 0; page < totalPages; page++) {
      const pageSlide = pptx.addSlide();
      const pageTasks = tasks.slice(page * tasksPerPage, (page + 1) * tasksPerPage);

      addSlideHeader(
        pageSlide,
        `Task Status Inventory Catalog ${totalPages > 1 ? `(Part ${page + 1} of ${totalPages})` : ""}`,
        `Complete registry of deliverables, ownership, and current lifecycle status`
      );
      addSlideNavBar(pageSlide, 6 + page);

      const catalogHeaders = [
        { text: "Key", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
        { text: "Deliverable / Task Title", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
        { text: "Type", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
        { text: "Assignee(s)", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
        { text: "Status", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
        { text: "Priority", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
        { text: "Due Date", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
      ];

      const catalogRows = pageTasks.map((t) => {
        let statusTextColor = C_DARK_SLATE;
        if (t.isCompleted) statusTextColor = C_EMERALD;
        else if (t.isHold) statusTextColor = C_AMBER;
        else if (t.isInProgress) statusTextColor = C_BLUE;

        return [
          { text: t.key || "—", options: { bold: true, color: C_SLATE, fontSize: 8 } },
          { text: t.title.slice(0, 48), options: { bold: true, color: C_NAVY } },
          { text: (t.taskType || "Task").toUpperCase(), options: { color: C_SLATE, fontSize: 8 } },
          { text: t.assignees.map((a) => a.name).join(", ").slice(0, 24) || "Unassigned", options: { color: C_DARK_SLATE } },
          { text: t.statusName, options: { bold: true, color: statusTextColor } },
          { text: t.priority.toUpperCase(), options: { bold: true, color: t.priority === "urgent" ? C_CRIMSON : C_DARK_SLATE } },
          { text: t.dueDate || "—", options: { color: t.isOverdue && !t.isCompleted ? C_CRIMSON : C_SLATE, bold: t.isOverdue && !t.isCompleted } },
        ];
      });

      pageSlide.addTable([catalogHeaders, ...catalogRows], {
        x: 0.7,
        y: 1.4,
        w: 11.93,
        colW: [1.2, 4.33, 1.0, 1.8, 1.4, 1.1, 1.1],
        fontSize: 8.5,
        fontFace: "Calibri",
        border: { pt: 0.5, color: C_BORDER },
        fill: { color: C_WHITE },
        autoPage: false,
      });

      addSlideFooter(pageSlide, `Slide ${6 + page}`);
    }
  }

  return pptx;
}
