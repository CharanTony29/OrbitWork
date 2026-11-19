import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client";
import { PRESENTATION_TEMPLATES } from "@/lib/presentation/templates";

export interface StatusGraphItem {
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface TeamWorkloadItem {
  name: string;
  role?: string;
  total: number;
  completed: number;
  inProgress: number;
  rate: string;
  status: string;
}

export interface CriticalTaskItem {
  key: string;
  title: string;
  assignee: string;
  priority: string;
  dueDate?: string;
  status: string;
}

export interface GeneratedSlide {
  id: string;
  title: string;
  category: string;
  layout:
    | "title"
    | "kpi"
    | "status_graph"
    | "team_workload"
    | "critical_tasks"
    | "split"
    | "cards"
    | "timeline"
    | "quote";
  bullets?: string[];
  metrics?: { label: string; value: string; change?: string }[];
  cards?: { title: string; description: string; tag?: string }[];
  takeaway?: string;
  statusGraph?: {
    items: StatusGraphItem[];
    completionRate: number;
    totalTasks: number;
  };
  teamWorkload?: TeamWorkloadItem[];
  criticalTasks?: CriticalTaskItem[];
}

export interface GeneratedPresentationDeck {
  title: string;
  subtitle: string;
  templateId: string;
  projectId?: string;
  slides: GeneratedSlide[];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const topic = (body.topic || "").trim();
    const projectId = body.projectId;
    const templateId = body.templateId || "pitch_sage";
    const slideCount = Math.min(10, Math.max(5, Number(body.slideCount) || 6));

    if (!topic && !projectId) {
      return NextResponse.json(
        { error: "Please provide a presentation topic or select a project." },
        { status: 400 }
      );
    }

    let projectGrounding = "";
    let calculatedStatusGraph: GeneratedSlide["statusGraph"] | undefined;
    let calculatedWorkload: TeamWorkloadItem[] | undefined;
    let calculatedCriticalTasks: CriticalTaskItem[] | undefined;
    let projectTitle = topic || "Executive Project Status Deck";
    let projectSubtitle = "Comprehensive status, performance metrics, and strategic roadmap";

    if (projectId) {
      const [projectRes, statusesRes, tasksRes, assigneesRes, profilesRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, description, target_date")
          .eq("id", projectId)
          .single(),
        supabase
          .from("project_statuses")
          .select("id, name, color, category, position")
          .eq("project_id", projectId)
          .order("position"),
        supabase
          .from("tasks")
          .select(
            "id, generated_key, title, task_type, priority, due_date, status_id, created_at, primary_assignee_id, secondary_assignee_id"
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase.from("task_assignees").select("task_id, user_id"),
        supabase.from("profiles").select("id, display_name, email"),
      ]);

      const project = projectRes.data;
      if (project) {
        projectTitle = project.name;
        projectSubtitle =
          project.description || `Milestones, deliverables, and team allocation report`;

        const rawStatuses = statusesRes.data || [];
        const rawTasks = tasksRes.data || [];
        const rawAssignees = assigneesRes.data || [];
        const rawProfiles = profilesRes.data || [];

        const profileMap = new Map(
          rawProfiles.map((p) => [
            p.id,
            p.display_name?.trim() || p.email?.split("@")[0] || "Team Member",
          ])
        );
        const statusMap = new Map(rawStatuses.map((s) => [s.id, s]));

        // Assignee mapping
        const taskAssigneeMap = new Map<string, Set<string>>();
        for (const t of rawTasks) {
          const s = new Set<string>();
          if (t.primary_assignee_id) s.add(t.primary_assignee_id);
          if (t.secondary_assignee_id) s.add(t.secondary_assignee_id);
          taskAssigneeMap.set(t.id, s);
        }
        for (const a of rawAssignees) {
          let s = taskAssigneeMap.get(a.task_id);
          if (!s) {
            s = new Set<string>();
            taskAssigneeMap.set(a.task_id, s);
          }
          s.add(a.user_id);
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        let completedCount = 0;
        let inProgressCount = 0;
        let holdCount = 0;
        let pendingCount = 0;
        let overdueCount = 0;

        const statusCountMap = new Map<string, number>();
        const assigneeStatsMap = new Map<
          string,
          { total: number; completed: number; inProgress: number; overdue: number }
        >();
        const criticalTasksList: CriticalTaskItem[] = [];

        for (const t of rawTasks) {
          const st = statusMap.get(t.status_id);
          const stName = (st?.name || "To Do").toLowerCase();
          const stCat = st?.category || "not_started";

          const isCompleted =
            stCat === "completed" ||
            stCat === "cancelled" ||
            stName.includes("done") ||
            stName.includes("complete") ||
            stName.includes("closed");

          const isHold =
            stName.includes("hold") || stName.includes("block") || stName.includes("wait");
          const isInProgress =
            !isCompleted &&
            !isHold &&
            (stCat === "in_progress" ||
              stName.includes("progress") ||
              stName.includes("review") ||
              stName.includes("active"));
          const isPending = !isCompleted && !isHold && !isInProgress;
          const isOverdue = Boolean(t.due_date && t.due_date < todayStr && !isCompleted);

          if (isCompleted) completedCount++;
          else if (isHold) holdCount++;
          else if (isInProgress) inProgressCount++;
          else pendingCount++;

          if (isOverdue) overdueCount++;

          statusCountMap.set(t.status_id, (statusCountMap.get(t.status_id) || 0) + 1);

          // Workload computation
          const uids = Array.from(taskAssigneeMap.get(t.id) || []);
          const firstAssignee =
            uids.length > 0 ? profileMap.get(uids[0]) || "Team Member" : "Unassigned";

          if (uids.length === 0) {
            const cur = assigneeStatsMap.get("Unassigned") || {
              total: 0,
              completed: 0,
              inProgress: 0,
              overdue: 0,
            };
            cur.total++;
            if (isCompleted) cur.completed++;
            if (isInProgress) cur.inProgress++;
            if (isOverdue) cur.overdue++;
            assigneeStatsMap.set("Unassigned", cur);
          } else {
            for (const uid of uids) {
              const name = profileMap.get(uid) || "Team Member";
              const cur = assigneeStatsMap.get(name) || {
                total: 0,
                completed: 0,
                inProgress: 0,
                overdue: 0,
              };
              cur.total++;
              if (isCompleted) cur.completed++;
              if (isInProgress) cur.inProgress++;
              if (isOverdue) cur.overdue++;
              assigneeStatsMap.set(name, cur);
            }
          }

          // Critical or high priority items
          if (
            isOverdue ||
            t.priority === "urgent" ||
            t.priority === "high" ||
            isHold
          ) {
            criticalTasksList.push({
              key: t.generated_key || `#${t.id.slice(0, 6)}`,
              title: t.title,
              assignee: firstAssignee,
              priority: (t.priority || "normal").toUpperCase(),
              dueDate: t.due_date ? String(t.due_date).split("T")[0] : undefined,
              status: isOverdue ? "OVERDUE" : isHold ? "ON HOLD" : st?.name || "Active",
            });
          }
        }

        // If no urgent/overdue tasks, take top in-progress deliverables so table is populated
        if (criticalTasksList.length < 4 && rawTasks.length > 0) {
          for (const t of rawTasks) {
            const taskKey = t.generated_key || `#${t.id.slice(0, 6)}`;
            if (criticalTasksList.some((c) => c.key === taskKey)) continue;
            const uids = Array.from(taskAssigneeMap.get(t.id) || []);
            const assigneeName =
              uids.length > 0 ? profileMap.get(uids[0]) || "Team Member" : "Unassigned";
            const st = statusMap.get(t.status_id);
            criticalTasksList.push({
              key: taskKey,
              title: t.title,
              assignee: assigneeName,
              priority: (t.priority || "normal").toUpperCase(),
              dueDate: t.due_date ? String(t.due_date).split("T")[0] : undefined,
              status: st?.name || "In Flight",
            });
            if (criticalTasksList.length >= 6) break;
          }
        }

        const totalTasks = rawTasks.length;
        const completionRate =
          totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        // Status graph items
        const statusGraphItems: StatusGraphItem[] = rawStatuses.map((s) => {
          const count = statusCountMap.get(s.id) || 0;
          const percent = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
          return {
            label: s.name,
            count,
            percent,
            color: s.color || "#3b82f6",
          };
        });

        if (statusGraphItems.length === 0) {
          statusGraphItems.push(
            {
              label: "Completed & Verified",
              count: completedCount,
              percent: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
              color: "#10b981",
            },
            {
              label: "In Active Execution",
              count: inProgressCount,
              percent: totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0,
              color: "#3b82f6",
            },
            {
              label: "On Hold / Review",
              count: holdCount,
              percent: totalTasks > 0 ? Math.round((holdCount / totalTasks) * 100) : 0,
              color: "#f59e0b",
            },
            {
              label: "Pending Backlog",
              count: pendingCount,
              percent: totalTasks > 0 ? Math.round((pendingCount / totalTasks) * 100) : 0,
              color: "#94a3b8",
            }
          );
        }

        calculatedStatusGraph = {
          items: statusGraphItems,
          completionRate,
          totalTasks,
        };

        // Workload list
        calculatedWorkload = Array.from(assigneeStatsMap.entries())
          .map(([name, stats]) => {
            const rate =
              stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : "0%";
            const status =
              stats.overdue > 0
                ? "ACTION NEEDED"
                : stats.completed > 0
                ? "ON TRACK"
                : "IN FLIGHT";
            return {
              name,
              total: stats.total,
              completed: stats.completed,
              inProgress: stats.inProgress,
              rate,
              status,
            };
          })
          .sort((a, b) => b.total - a.total);

        calculatedCriticalTasks = criticalTasksList.slice(0, 6);

        projectGrounding = `
PROJECT GROUNDING WITH REAL METRICS:
- Project: "${project.name}" (${project.description || "Active Delivery"})
- Target Date: ${project.target_date || "Current Milestone"}
- Total Deliverables: ${totalTasks}
- Completion Velocity: ${completionRate}% (${completedCount} completed, ${inProgressCount} in progress, ${holdCount} on hold, ${overdueCount} overdue)
- Team Assignees: ${calculatedWorkload.map((w) => `${w.name} (${w.total} tasks, ${w.rate} done)`).join(", ")}
- Critical / Blocked Deliverables: ${calculatedCriticalTasks.map((c) => `[${c.key}] ${c.title} -> ${c.assignee} (${c.status})`).join("; ")}
`;
      }
    } else {
      // General topic fallback synthesis
      calculatedStatusGraph = {
        completionRate: 74,
        totalTasks: 42,
        items: [
          { label: "Completed & Verified", count: 31, percent: 74, color: "#10b981" },
          { label: "In Active Execution", count: 8, percent: 19, color: "#3b82f6" },
          { label: "On Hold / Review", count: 2, percent: 5, color: "#f59e0b" },
          { label: "Pending Backlog", count: 1, percent: 2, color: "#94a3b8" },
        ],
      };
      calculatedWorkload = [
        {
          name: "Charan Admin",
          role: "Project Lead",
          total: 18,
          completed: 14,
          inProgress: 4,
          rate: "78%",
          status: "ON TRACK",
        },
        {
          name: "Core Engineering",
          role: "Platform Architecture",
          total: 14,
          completed: 10,
          inProgress: 4,
          rate: "71%",
          status: "ON TRACK",
        },
        {
          name: "QA & Verification",
          role: "Quality Team",
          total: 10,
          completed: 7,
          inProgress: 3,
          rate: "70%",
          status: "IN FLIGHT",
        },
      ];
      calculatedCriticalTasks = [
        {
          key: "TASK-101",
          title: "API Endpoint Architecture & Schema Validation",
          assignee: "Charan Admin",
          priority: "HIGH",
          dueDate: "2026-11-25",
          status: "IN REVIEW",
        },
        {
          key: "TASK-102",
          title: "Cross-Workspace Attachment Indexing Engine",
          assignee: "Core Engineering",
          priority: "URGENT",
          dueDate: "2026-11-22",
          status: "ACTIVE",
        },
        {
          key: "TASK-103",
          title: "Realtime Live Tracker Real-Time Event Bus",
          assignee: "Charan Admin",
          priority: "NORMAL",
          dueDate: "2026-11-28",
          status: "ON TRACK",
        },
      ];
    }

    const selectedTemplate =
      PRESENTATION_TEMPLATES.find((t) => t.id === templateId) || PRESENTATION_TEMPLATES[0];

    const systemPrompt = `
You are the Executive Presentation Deck Architect in Orbitwork (similar to Gamma and expert PowerPoint consulting).
Create a structured presentation deck of exactly ${slideCount} slides with real graphs, team assignee workload, and critical deliverables tables.

THE DECK MUST INCLUDE:
Slide 1 (layout "title"): Executive Title & Cover. Main title, strategic subtitle, project velocity thesis.
Slide 2 (layout "kpi"): Executive KPI Scorecard. 4 prominent metric cards with real numbers.
Slide 3 (layout "status_graph"): Status Lifecycle Breakdown. Real distribution of tasks across Completed, In Flight, On Hold, and Backlog.
Slide 4 (layout "team_workload"): Team Workload & Assignee Capacity. Workload allocation by member name, deliverables count, completion rate.
Slide 5 (layout "critical_tasks"): Critical Deliverables & Risk Ledger. Specific tasks with keys, owners, priorities, and deadlines.
Slide 6 (layout "timeline"): Strategic Roadmap & Milestones. Key release phases.
Slide 7+ (layout "split" or "quote"): Strategic Next Steps & Executive Sign-Off.

Return ONLY raw JSON conforming to this schema (no markdown, no extra commentary):
{
  "title": "${projectTitle}",
  "subtitle": "${projectSubtitle}",
  "templateId": "${selectedTemplate.id}",
  "slides": [
    {
      "id": "slide-1",
      "title": "Title",
      "category": "Cover | Executive KPI | Status Lifecycle | Team Workload | Critical Deliverables | Roadmap | Conclusion",
      "layout": "title | kpi | status_graph | team_workload | critical_tasks | timeline | split",
      "bullets": ["Point 1", "Point 2"],
      "metrics": [{"label": "Completion Rate", "value": "78%", "change": "+12%"}, {"label": "Scope", "value": "113 Tasks"}],
      "cards": [{"title": "Card Title", "description": "Details...", "tag": "Priority"}],
      "takeaway": "Executive takeaway line..."
    }
  ]
}
`;

    const userPrompt = `
TOPIC / GOAL: "${topic || projectTitle}"
${projectGrounding}
TEMPLATE STYLE: ${selectedTemplate.name} (Archetype: ${selectedTemplate.archetype})
Generate ${slideCount} high-impact slides with real project metrics, graph layouts, assignee allocations, and critical deliverables.
`;

    let deck: GeneratedPresentationDeck;

    try {
      const aiRes = await generateTextWithFallback({
        prompt: userPrompt,
        system: systemPrompt,
        temperature: 0.2,
        maxOutputTokens: 4000,
      });

      let cleaned = (aiRes.text || "").trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
      if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      deck = JSON.parse(cleaned) as GeneratedPresentationDeck;
    } catch {
      // Graceful high-impact deck fallback
      deck = {
        title: projectTitle,
        subtitle: projectSubtitle,
        templateId: selectedTemplate.id,
        slides: [
          {
            id: "slide-1",
            title: projectTitle,
            category: "Executive Briefing",
            layout: "title",
            bullets: [
              "Operational execution overview and delivery progression",
              `Total deliverables in scope: ${calculatedStatusGraph?.totalTasks || 42} items`,
              "Comprehensive milestone tracking and cross-functional capacity",
            ],
            takeaway: "Executive summary on current execution velocity and timeline confidence.",
          },
          {
            id: "slide-2",
            title: "Executive Performance Scorecard",
            category: "Executive KPI",
            layout: "kpi",
            metrics: [
              { label: "Completion Rate", value: `${calculatedStatusGraph?.completionRate ?? 74}%`, change: "+12%" },
              { label: "Total Scope", value: `${calculatedStatusGraph?.totalTasks ?? 42} Tasks` },
              {
                label: "Active Execution",
                value: `${
                  calculatedStatusGraph?.items.find((i) =>
                    i.label.toLowerCase().includes("progress") ||
                    i.label.toLowerCase().includes("flight") ||
                    i.label.toLowerCase().includes("execution")
                  )?.count ?? 8
                } In Flight`,
              },
              {
                label: "Critical Items",
                value: `${calculatedCriticalTasks?.length ?? 3} Deliverables`,
                change: "Monitored",
              },
            ],
            takeaway: `Delivery progressing at ${calculatedStatusGraph?.completionRate ?? 74}% completion across all active workstreams.`,
          },
          {
            id: "slide-3",
            title: "Status Lifecycle & Scope Distribution",
            category: "Status Lifecycle",
            layout: "status_graph",
            statusGraph: calculatedStatusGraph,
            takeaway: "Balanced lifecycle distribution with clear milestone progression.",
          },
          {
            id: "slide-4",
            title: "Resource Allocation & Workload Distribution",
            category: "Team Capacity",
            layout: "team_workload",
            teamWorkload: calculatedWorkload,
            takeaway: "Workload actively distributed with transparent team member ownership.",
          },
          {
            id: "slide-5",
            title: "Critical Deliverables & Milestone Ledger",
            category: "Critical Deliverables",
            layout: "critical_tasks",
            criticalTasks: calculatedCriticalTasks,
            takeaway: "Key priority deliverables tracked for milestone closure.",
          },
          {
            id: "slide-6",
            title: "Strategic Roadmap & Milestone Outlook",
            category: "Roadmap & Milestones",
            layout: "timeline",
            cards: [
              {
                title: "Sprint Execution",
                description: "Finalize in-flight deliverables and resolve blocking dependencies.",
                tag: "In Progress",
              },
              {
                title: "Verification & QA",
                description: "End-to-end integration testing and operational compliance audit.",
                tag: "Next Milestone",
              },
              {
                title: "Production Release",
                description: "Executive stakeholder sign-off and deployment activation.",
                tag: "Upcoming",
              },
            ],
            takeaway: "Structured sequential delivery path toward final milestone completion.",
          },
        ],
      };
    }

    deck.projectId = projectId;
    deck.templateId = templateId;

    // Ensure slides array is populated and properly typed
    if (!deck.slides || deck.slides.length === 0) {
      deck.slides = [];
    }

    // Attach calculated graph, workload, and task table data to respective slides
    deck.slides = deck.slides.map((s, idx) => {
      // Slide 1: ensure KPI metrics exist
      if (idx === 1 || s.layout === "kpi") {
        if (!s.metrics || s.metrics.length === 0) {
          s.metrics = [
            {
              label: "Completion Rate",
              value: `${calculatedStatusGraph?.completionRate ?? 74}%`,
              change: "+8%",
            },
            { label: "Total Deliverables", value: `${calculatedStatusGraph?.totalTasks ?? 42} Tasks` },
            {
              label: "In Active Sprint",
              value: `${
                calculatedStatusGraph
                  ? calculatedStatusGraph.items.find((i) =>
                      i.label.toLowerCase().includes("progress") ||
                      i.label.toLowerCase().includes("flight") ||
                      i.label.toLowerCase().includes("execution")
                    )?.count ?? 12
                  : 12
              } Tasks`,
            },
            {
              label: "Critical Blockers",
              value: `${calculatedCriticalTasks?.length ?? 2} Items`,
              change: "Requires review",
            },
          ];
        }
      }

      // Slide 2: Status Graph
      if (
        idx === 2 ||
        s.layout === "status_graph" ||
        s.category.toLowerCase().includes("status") ||
        s.category.toLowerCase().includes("lifecycle")
      ) {
        s.layout = "status_graph";
        s.statusGraph = calculatedStatusGraph;
      }

      // Slide 3: Team Workload
      if (
        idx === 3 ||
        s.layout === "team_workload" ||
        s.category.toLowerCase().includes("workload") ||
        s.category.toLowerCase().includes("team") ||
        s.category.toLowerCase().includes("capacity")
      ) {
        s.layout = "team_workload";
        s.teamWorkload = calculatedWorkload;
      }

      // Slide 4: Critical Tasks
      if (
        idx === 4 ||
        s.layout === "critical_tasks" ||
        s.category.toLowerCase().includes("critical") ||
        s.category.toLowerCase().includes("deliverable") ||
        s.category.toLowerCase().includes("risk") ||
        s.category.toLowerCase().includes("overdue")
      ) {
        s.layout = "critical_tasks";
        s.criticalTasks = calculatedCriticalTasks;
      }

      return s;
    });

    return NextResponse.json({ deck });
  } catch (err: any) {
    console.error("[Presentation Generator Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate presentation deck" },
      { status: 500 }
    );
  }
}
