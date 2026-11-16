import PptxGenJS from "pptxgenjs";

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

export interface PresentationReportOptions {
  projectName: string;
  workspaceName?: string;
  organizationName?: string;
  periodType: ReportPeriodType;
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  includeCatalog?: boolean;
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

  // Palette definitions
  const C_NAVY = "0F172A";
  const C_DARK_SLATE = "1E293B";
  const C_BLUE = "2563EB";
  const C_EMERALD = "10B981";
  const C_AMBER = "D97706";
  const C_GOLD = "EAB308";
  const C_CRIMSON = "EF4444";
  const C_SLATE = "64748B";
  const C_LIGHT_BG = "F8FAFC";
  const C_WHITE = "FFFFFF";
  const C_BORDER = "E2E8F0";

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
  // SLIDE 1: Cover Slide (Executive Modern Dark Theme)
  // -------------------------------------------------------------
  const slide1 = pptx.addSlide();
  slide1.background = { color: C_NAVY };

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
      fontFace: "Calibri",
    }
  );

  // Main Title
  slide1.addText("PROJECT STATUS & EXECUTION REPORT", {
    x: 0.7,
    y: 1.55,
    w: 11.8,
    h: 1.1,
    fontSize: 32,
    bold: true,
    color: C_WHITE,
    fontFace: "Calibri",
  });

  // Project & Scope subtitle
  slide1.addText(
    `Project: ${options.projectName}${options.workspaceName ? `  |  Workspace: ${options.workspaceName}` : ""}`,
    {
      x: 0.7,
      y: 2.75,
      w: 11.8,
      h: 0.45,
      fontSize: 16,
      color: "94A3B8",
      fontFace: "Calibri",
    }
  );

  // Period Badge Card
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 0.7,
    y: 3.65,
    w: 5.6,
    h: 1.35,
    fill: { color: C_DARK_SLATE },
    line: { color: "334155", width: 1 },
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
      color: C_NAVY,
      fontFace: "Calibri",
    });

    // Subtitle
    slide.addText(subtitle, {
      x: 0.7,
      y: 0.85,
      w: 9.2,
      h: 0.3,
      fontSize: 10.5,
      color: C_SLATE,
      fontFace: "Calibri",
    });

    // Right-hand project chip
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 10.2,
      y: 0.35,
      w: 2.4,
      h: 0.7,
      fill: { color: C_WHITE },
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
      color: C_NAVY,
      fontFace: "Calibri",
    });
    slide.addText(options.periodLabel.slice(0, 26), {
      x: 10.25,
      y: 0.7,
      w: 2.3,
      h: 0.25,
      fontSize: 8,
      align: "center",
      color: C_SLATE,
      fontFace: "Calibri",
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

  // -------------------------------------------------------------
  // SLIDE 2: Executive Summary & Health KPIs
  // -------------------------------------------------------------
  const slide2 = pptx.addSlide();
  addSlideHeader(
    slide2,
    "Executive Summary & Performance KPIs",
    "High-level execution velocity, completion rate, and workload health"
  );

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

  // Executive Insights Section below Cards (Two big analysis panels)
  // Left Panel: Delivery & Health Assessment
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.7,
    y: 3.25,
    w: 5.85,
    h: 3.45,
    fill: { color: C_WHITE },
    line: { color: C_BORDER, width: 1 },
    rectRadius: 0.08,
  });
  slide2.addText("DELIVERY VELOCITY & MILESTONE HEALTH", {
    x: 0.95,
    y: 3.45,
    w: 5.3,
    h: 0.3,
    fontSize: 10.5,
    bold: true,
    color: C_NAVY,
    fontFace: "Calibri",
  });

  const healthPoints = [
    `• Overall Completion: ${completionRate}% of deliverables are finalized and verified.`,
    `• Active Velocity: ${inProgressTasks.length} task(s) currently in progress across team members.`,
    `• Pending Pipeline: ${pendingTasks.length} task(s) scheduled in backlog and ready for execution.`,
    `• Delivery Pace: ${
      completionRate >= 70
        ? "Excellent momentum; project is tracking ahead of scheduled milestones."
        : completionRate >= 40
        ? "Healthy execution pace; core sprint deliverables moving steadily."
        : "Early execution stage; team is ramping up active deliverables."
    }`,
  ];
  slide2.addText(healthPoints.join("\n\n"), {
    x: 0.95,
    y: 3.85,
    w: 5.3,
    h: 2.6,
    fontSize: 10,
    color: C_DARK_SLATE,
    lineSpacingMultiple: 1.1,
    fontFace: "Calibri",
  });

  // Right Panel: Operational Focus & Attention
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
        ? `${overdueTasks.length} active task(s) have passed their due date and require expedited resolution.`
        : "Zero overdue tasks. All scheduled deliverables are within deadline."
    }`,
    `• Work on Hold: ${
      holdTasks.length > 0
        ? `${holdTasks.length} item(s) are paused pending requirements, external dependencies, or reviews.`
        : "Zero active bottlenecks or paused deliverables."
    }`,
    `• Unassigned Tasks: ${
      tasks.filter((t) => t.assignees.length === 0 && !t.isCompleted).length
    } unassigned active item(s) awaiting resource allocation.`,
    `• Action Recommended: ${
      overdueTasks.length > 0
        ? "Focus immediate team standups on clearing overdue items and unblocking hold dependencies."
        : "Maintain current delivery momentum and prepare next sprint backlog."
    }`,
  ];
  slide2.addText(focusPoints.join("\n\n"), {
    x: 7.05,
    y: 3.85,
    w: 5.3,
    h: 2.6,
    fontSize: 10,
    color: C_DARK_SLATE,
    lineSpacingMultiple: 1.1,
    fontFace: "Calibri",
  });

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

  // Table of all Project Statuses
  const statusTableHeaders = [
    { text: "Workflow Status", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
    { text: "Category", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
    { text: "Tasks Count", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "% Share", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Operational Status", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
  ];

  const statusRows = statuses.map((st) => {
    const count = st.count || 0;
    const share = totalTasks ? Math.round((count * 100) / totalTasks) : 0;
    let opStatus = "Active Backlog";
    if (st.category === "completed" || st.name.toLowerCase().includes("done")) opStatus = "Delivered / Closed";
    else if (st.name.toLowerCase().includes("hold")) opStatus = "Paused / Pending Resolution";
    else if (st.category === "in_progress" || st.name.toLowerCase().includes("progress")) opStatus = "Actively Moving";

    return [
      { text: st.name, options: { bold: true, color: C_NAVY } },
      { text: (st.category || "Workflow").replace("_", " ").toUpperCase(), options: { color: C_SLATE, fontSize: 8.5 } },
      { text: String(count), options: { align: "center" as const, bold: true, color: C_NAVY } },
      { text: `${share}%`, options: { align: "center" as const, color: C_SLATE } },
      { text: opStatus, options: { color: C_DARK_SLATE, fontSize: 9 } },
    ];
  });

  slide3.addTable([statusTableHeaders, ...statusRows], {
    x: 0.7,
    y: 3.05,
    w: 11.93,
    colW: [3.3, 2.0, 1.8, 1.6, 3.23],
    fontSize: 9.5,
    fontFace: "Calibri",
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE },
    autoPage: false,
  });

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

  const resourceTableHeaders = [
    { text: "Team Member / Resource", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE } },
    { text: "Assigned", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "In Process", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "On Hold", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Pending", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Completed", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
    { text: "Overdue", options: { bold: true, fill: { color: C_DARK_SLATE }, color: C_WHITE, align: "center" as const } },
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
    { text: String(r.pendingCount), options: { align: "center" as const, color: C_SLATE } },
    { text: String(r.completedCount), options: { align: "center" as const, color: C_EMERALD, bold: true } },
    { text: String(r.overdueCount), options: { align: "center" as const, color: r.overdueCount > 0 ? C_CRIMSON : C_SLATE, bold: r.overdueCount > 0 } },
  ]);

  slide4.addTable([resourceTableHeaders, ...resourceRows], {
    x: 0.7,
    y: 1.4,
    w: 11.93,
    colW: [3.53, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4],
    fontSize: 9.5,
    fontFace: "Calibri",
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE },
    autoPage: false,
  });

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
