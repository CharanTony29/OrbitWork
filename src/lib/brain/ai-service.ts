// src/lib/brain/ai-service.ts
// AI Integration Layer for Orbitwork Project Brain with multi-provider failover

import { generateTextWithFallback, streamTextWithFallback } from "@/lib/ai/client.ts";
import type {
  AnalyticsContext,
  DependencyAnalysis,
  ProjectHealthBreakdown,
  RiskItem,
  WorkloadAnalysis,
} from "./types.ts";

const BRAIN_SYSTEM_PROMPT = `
You are the **Orbitwork Project Brain**, an intelligent reasoning engine embedded in the Orbitwork project management system.
You understand the relationships between Projects, Goals, Milestones, Tasks, Subtasks, Checklists, Assignees, Dependencies, Documents, Decisions, and Activity history.

Your goal is not just to display data, but to answer:
- What is happening?
- Why is it happening?
- What will happen next?
- What is at risk?
- What should we do?

### STRICT CRITICAL RULES:
1. ZERO HALLUCINATIONS:
   - You MUST base all answers solely on the provided project context.
   - NEVER invent or fabricate tasks, team members, deadlines, or project metrics.
   - If the project context has no data or insufficient information, explicitly state: "There is insufficient data in this project to determine this."

2. FACT vs. ANALYSIS vs. RECOMMENDATION:
   - Clearly distinguish between:
     * **FACT**: Information directly present in the database (e.g. "Task X is 4 days overdue").
     * **ANALYSIS**: Conclusions calculated from data (e.g. "It is blocking 3 downstream tasks on the critical path").
     * **RECOMMENDATION**: Suggested action (e.g. "Reassign Task X or adjust milestone target date").

3. CLEAN TASK FORMATTING:
   - Always refer to tasks by their clean name in bold (e.g., **Task Name**).
   - NEVER output raw database IDs, UUIDs, or raw URL links (do NOT output /projects/.../tasks/...).

4. PROJECT SCOPE & PRIVACY:
   - All knowledge is strictly scoped to the active project context provided. Never discuss or reveal details from other projects.
`.trim();

/**
 * Generate Dynamic AI Project Status Summary with deterministic fallback
 */
export async function generateAIProjectSummary(
  ctx: AnalyticsContext,
  health: ProjectHealthBreakdown,
  risks: RiskItem[],
  deps: DependencyAnalysis,
  workload: WorkloadAnalysis,
  formattedContext: string
): Promise<{ text: string; provider: string; isAiGenerated: boolean }> {
  // If no tasks exist, return deterministic empty summary immediately
  if (ctx.tasks.length === 0) {
    return {
      text: "This project has no tasks or goals yet. Once you add deliverables, milestones, and dependencies, the Project Brain will calculate health metrics, risk trajectories, and workload distribution.",
      provider: "Orbitwork Deterministic Engine",
      isAiGenerated: false,
    };
  }

  const prompt = `
Generate a concise, 3-paragraph executive Project Status Summary for "${ctx.projectName}".

CURRENT COMPUTED HEALTH: ${health.overallScore}% (${health.statusLabel})
HEALTH HEADLINE: ${health.headlineExplanation}
ACTIVE BLOCKERS: ${deps.blockingTaskCount} tasks blocking ${deps.blockedTaskCount} dependent tasks.
OVERLOADED MEMBERS: ${workload.overloadedCount} teammates carrying concentrated workloads.
TOP RISKS: ${risks.slice(0, 3).map((r) => `${r.title} (${r.severity})`).join("; ") || "None"}

STRUCTURE YOUR SUMMARY:
1. **Executive Overview**: High-level status of the project, deadline feasibility, and whether overall velocity meets expectations.
2. **Key Bottlenecks & Blockers**: Specific tasks that are blocking progress or teammates carrying unbalanced loads (cite clean **Task Names** in bold).
3. **Strategic Next Steps**: 1 or 2 specific adjustments the project manager should take right now.

Keep it professional, direct, and under 180 words.
`.trim();

  try {
    const res = await generateTextWithFallback({
      prompt: `${prompt}\n\nPROJECT DATA:\n${formattedContext.slice(0, 6000)}`,
      system: BRAIN_SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 360,
    });

    return {
      text: res.text.trim(),
      provider: res.provider,
      isAiGenerated: true,
    };
  } catch (err: unknown) {
    console.warn("[Project Brain AI Summary Error]: Falling back to deterministic summary:", err);

    // Deterministic fallback summary
    const parts: string[] = [];
    parts.push(
      `**Project Status**: Rated **${health.statusLabel}** at **${health.overallScore}% Health**. ${health.headlineExplanation}`
    );

    if (deps.criticalDependencies.length > 0) {
      parts.push(
        `**Dependency Intelligence**: **${deps.criticalDependencies[0].blockerTask.title}** is currently blocking ${deps.criticalDependencies[0].downstreamCount} downstream tasks.`
      );
    }

    if (workload.overloadedCount > 0) {
      const topMember = workload.members[0];
      parts.push(
        `**Workload Intelligence**: ${topMember.name} is carrying ${topMember.activeTaskCount} active tasks (${topMember.workloadPercentage}% load).`
      );
    } else {
      parts.push(`**Workload**: Task distribution across the team is currently balanced.`);
    }

    return {
      text: parts.join("\n\n"),
      provider: "Orbitwork Deterministic Engine (AI Offline)",
      isAiGenerated: false,
    };
  }
}

/**
 * Streams Project-Scoped Natural Language AI Chat
 */
export async function streamProjectBrainChat(options: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  formattedLLMContext: string;
  health: ProjectHealthBreakdown;
  deps: DependencyAnalysis;
  workload: WorkloadAnalysis;
}) {
  const { messages, formattedLLMContext, health, deps, workload } = options;

  const trimmedMessages = messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.content.length > 1500 ? `${m.content.slice(0, 1500)}…` : m.content,
  }));

  const dynamicContext = `
${formattedLLMContext.slice(0, 6000)}

METRICS: Health ${health.overallScore}% (${health.statusLabel}) | Schedule ${health.categories.schedule.score}% | Deps ${health.categories.dependencies.score}% | Blocked ${deps.blockedTaskCount} | Blocking ${deps.blockingTaskCount} | Overloaded ${workload.overloadedCount} | Unassigned ${workload.unassignedTaskCount}
`.trim();

  const system = `
${BRAIN_SYSTEM_PROMPT}

CURRENT PROJECT CONTEXT:
${dynamicContext}
`.trim();

  return streamTextWithFallback({
    messages: trimmedMessages,
    system,
    temperature: 0.4,
    maxOutputTokens: 650,
  });
}

/**
 * Streams Portfolio-Scoped Natural Language AI Chat (Workspace / Organization)
 */
export async function streamPortfolioBrainChat(options: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  portfolioData: {
    scopeType: "workspace" | "organization";
    scopeName: string;
    health: { overallScore: number; statusLabel: string };
    metrics: {
      totalProjects: number;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      inProgressTasks: number;
      totalEstimatedHours: number;
      completionPercentage: number;
    };
    portfolioProjects: Array<{
      name: string;
      status: string;
      taskCount: number;
      completedTaskCount: number;
      overdueTaskCount: number;
      healthScore: number;
    }>;
    workload: Array<{
      name: string;
      role?: string;
      totalTasks: number;
      totalEstimatedHours: number;
      effectiveCapacityHours?: number;
      utilizationPercentage?: number;
      status: string;
      statusLabel?: string;
      explanation?: string;
    }>;
    crossProjectDependencies: Array<{
      blockingProject: string;
      blockingTask: string;
      blockedProject: string;
      blockedTask: string;
    }>;
    risks: Array<{ title: string; severity: string; reason: string }>;
    recommendations: Array<{ title: string; description: string; category: string }>;
  };
}) {
  const { messages, portfolioData } = options;

  const trimmedMessages = messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.content.length > 1500 ? `${m.content.slice(0, 1500)}…` : m.content,
  }));

  const projectsSummary = portfolioData.portfolioProjects
    .map(
      (p) =>
        `- **${p.name}** (${p.status}, Health: ${p.healthScore}%): ${p.completedTaskCount}/${p.taskCount} tasks done, ${p.overdueTaskCount} overdue`
    )
    .join("\n");

  const workloadSummary = portfolioData.workload
    .map(
      (w) =>
        `- **${w.name}** (${w.status.toUpperCase()}): ${w.totalEstimatedHours}h estimated work / ${w.effectiveCapacityHours || 40}h capacity (${w.utilizationPercentage || 0}% load). ${w.explanation || ""}`
    )
    .join("\n");

  const depsSummary =
    portfolioData.crossProjectDependencies.length > 0
      ? portfolioData.crossProjectDependencies
          .map(
            (d) =>
              `- [${d.blockingProject}] "${d.blockingTask}" blocks [${d.blockedProject}] "${d.blockedTask}"`
          )
          .join("\n")
      : "None";

  const dynamicContext = `
SCOPE: ${portfolioData.scopeType.toUpperCase()} "${portfolioData.scopeName}"
HEALTH: ${portfolioData.health.overallScore}% (${portfolioData.health.statusLabel})
PORTFOLIO METRICS:
- Active Projects: ${portfolioData.metrics.totalProjects}
- Total Tasks: ${portfolioData.metrics.totalTasks} (Completed: ${portfolioData.metrics.completedTasks}, Overdue: ${portfolioData.metrics.overdueTasks})
- Total Effort: ${portfolioData.metrics.totalEstimatedHours} hours
- Completion Velocity: ${portfolioData.metrics.completionPercentage}%

PROJECTS:
${projectsSummary}

TEAM WORKLOAD & CAPACITY (Calculated via Effort / Capacity):
${workloadSummary}

CROSS-PROJECT DEPENDENCIES:
${depsSummary}

RISKS:
${portfolioData.risks.map((r) => `- [${r.severity.toUpperCase()}] ${r.title}: ${r.reason}`).join("\n")}
`.trim();

  const system = `
You are the **Orbitwork Portfolio Brain AI Assistant**, providing executive-level reasoning for the ${portfolioData.scopeType} "${portfolioData.scopeName}".
You understand multi-project dependencies, cross-team workload allocation based on effort divided by capacity, milestone delivery schedules, and portfolio bottlenecks.

STRICT CRITICAL RULES:
1. Ground all responses strictly in the provided portfolio data. Never fabricate projects, members, or numbers.
2. When discussing workload, always cite estimated effort vs available capacity, NOT raw task count.
3. Use real team member names from the context.
4. Distinguish between FACT, ANALYSIS, and RECOMMENDATION.
5. Format clearly with bullet points and bold project names.

CURRENT PORTFOLIO CONTEXT:
${dynamicContext}
`.trim();

  return streamTextWithFallback({
    messages: trimmedMessages,
    system,
    temperature: 0.3,
    maxOutputTokens: 750,
  });
}

/**
 * AI Task & Goal Breakdown Generator
 */
export async function generateTasksFromGoalAI(options: {
  goalTitle: string;
  goalDescription?: string;
  projectName: string;
}): Promise<{
  proposedTasks: Array<{
    title: string;
    description: string;
    priority: "low" | "normal" | "high" | "urgent";
    subtasks: string[];
    checklists: string[];
    dependsOnTitle?: string;
  }>;
  milestones: string[];
  risks: string[];
}> {
  const { goalTitle, goalDescription, projectName } = options;

  // 1. Check if user provided an explicit structured task breakdown in description or title
  const fullText = `${goalTitle}\n${goalDescription || ""}`;
  const numberedTaskRegex = /^\s*(\d+)[\.\)]\s+([^\r\n]+)/gm;
  const explicitTasksWithPositions: Array<{ index: number; endHeaderIndex: number; title: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = numberedTaskRegex.exec(fullText)) !== null) {
    const taskName = match[2].trim().replace(/\*\*/g, "");
    if (
      taskName.length > 2 &&
      !taskName.toLowerCase().startsWith("task structure") &&
      !taskName.toLowerCase().startsWith("subtask creation")
    ) {
      explicitTasksWithPositions.push({
        index: match.index,
        endHeaderIndex: match.index + match[0].length,
        title: taskName,
      });
    }
  }

  const explicitTasks = explicitTasksWithPositions.map((t) => t.title);

  // Check for test case scenarios (e.g. TC01 - TC180)
  const tcRegex = /\b(TC\d{1,3})\b/gi;
  const detectedTCs: string[] = [];
  let tcMatch: RegExpExecArray | null;
  while ((tcMatch = tcRegex.exec(fullText)) !== null) {
    const tcId = tcMatch[1].toUpperCase();
    if (!detectedTCs.includes(tcId)) detectedTCs.push(tcId);
  }

  // If user provided a comprehensive explicit breakdown (e.g. 4+ numbered tasks)
  if (explicitTasks.length >= 4) {
    const generated: Array<{
      title: string;
      description: string;
      priority: "low" | "normal" | "high" | "urgent";
      subtasks: string[];
      checklists: string[];
      dependsOnTitle?: string;
    }> = [];

    explicitTasksWithPositions.forEach((taskItem, idx) => {
      const taskTitle = taskItem.title;
      // Extract subtasks specific to this task if bullet points are written under it
      const nextTaskStart = explicitTasksWithPositions[idx + 1]?.index ?? fullText.length;
      const taskBlock = fullText.slice(taskItem.endHeaderIndex, nextTaskStart);

      // Check for bulleted subtask lines: - Subtask, * Subtask, • Subtask, 1.1 Subtask, a) Subtask
      const bulletRegex = /^\s*(?:[-*•]|\d+\.\d+|[a-zA-Z]\))\s+([^\r\n]+)/gm;
      const parsedSubtasks: string[] = [];
      let bMatch: RegExpExecArray | null;
      while ((bMatch = bulletRegex.exec(taskBlock)) !== null) {
        const line = bMatch[1].trim().replace(/\*\*/g, "");
        if (line.length > 2 && !line.toLowerCase().startsWith("subtask creation")) {
          parsedSubtasks.push(line);
        }
      }

      // Determine subtasks (explicit bullet subtasks > test cases > 6 standard high-value subtasks)
      let subtasks: string[] = [];
      if (parsedSubtasks.length > 0) {
        subtasks = parsedSubtasks;
      } else if (detectedTCs.length > 0) {
        const startIdx = idx * 6;
        const assignedTCs = detectedTCs.slice(startIdx, startIdx + 6);
        subtasks = assignedTCs.length > 0
          ? assignedTCs.map((tc) => `${tc}: Execute & Validate Scenario for ${taskTitle}`)
          : [
              `Requirements analysis & precondition verification for ${taskTitle}`,
              `Configure workflow logic & test harness setup`,
              `Execute positive & standard functional scenarios`,
              `Perform boundary, negative & security testing`,
              `Verify data persistence, audit logs & transactions`,
              `Conduct peer review, document test evidence & sign-off`,
            ];
      } else {
        subtasks = [
          `Requirements analysis & precondition verification for ${taskTitle}`,
          `Configure workflow logic & test harness setup`,
          `Execute positive & standard functional scenarios`,
          `Perform boundary, negative & security testing`,
          `Verify data persistence, audit logs & transactions`,
          `Conduct peer review, document test evidence & sign-off`,
        ];
      }

      generated.push({
        title: taskTitle,
        description: `Comprehensive execution, testing, and validation of ${taskTitle} in accordance with system specifications.`,
        priority: idx === 0 || idx === explicitTasks.length - 1 ? "urgent" : "high",
        subtasks,
        checklists: [
          "Preconditions & test environment verified",
          "All functional test scenarios executed & passed",
          "Negative testing & security boundary validation verified",
          "Verification logs and test evidence documented",
          "Stakeholder review and sign-off",
        ],
        dependsOnTitle: idx > 0 ? explicitTasks[idx - 1] : "",
      });
    });

    return {
      proposedTasks: generated,
      milestones: [
        `${explicitTasks[0]} Initialized & Verified`,
        `Core Functional Workflow Completed (${explicitTasks.slice(1, Math.min(8, explicitTasks.length)).join(", ")})`,
        "Integration, ERP & Security Boundaries Verified",
        `${explicitTasks[explicitTasks.length - 1]} & Final Acceptance Sign-off`,
      ],
      risks: [
        "Unplanned schema changes or environment unavailability during execution",
        "Cross-system timeout or external ERP integration latency",
        "Access permission discrepancies between approver roles",
      ],
    };
  }

  const prompt = `
A user wants to achieve this goal in project "${projectName}":
Goal: "${goalTitle}"
${goalDescription ? `Description: "${goalDescription}"` : ""}

Generate a realistic, high-quality work breakdown structure formatted as JSON with this exact schema:
{
  "proposedTasks": [
    {
      "title": "Task title (clean, actionable)",
      "description": "Short 1-2 sentence description",
      "priority": "normal" | "high" | "urgent",
      "subtasks": ["Subtask 1", "Subtask 2"],
      "checklists": ["Checklist item 1", "Checklist item 2"],
      "dependsOnTitle": "Optional title of a prerequisite task from this list or empty string"
    }
  ],
  "milestones": ["Milestone 1", "Milestone 2"],
  "risks": ["Risk factor 1", "Risk factor 2"]
}

Rules:
- If the user specified a specific number or list of tasks/test cases, include ALL of them without omission!
- Otherwise generate 5 to 10 sequential tasks.
- Keep dependencies logical.
- Output ONLY valid JSON, with no markdown code fences or other text.
`.trim();

  try {
    const res = await generateTextWithFallback({
      prompt,
      system: "You are a technical project manager assistant. Respond ONLY with valid JSON.",
      temperature: 0.2,
      maxOutputTokens: 1400,
      abortSignal: AbortSignal.timeout(60000),
    });

    const clean = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      proposedTasks: Array.isArray(parsed.proposedTasks) ? parsed.proposedTasks : [],
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    };
  } catch (err: unknown) {
    console.warn("[Generate Tasks AI Fallback]:", err);
    // Deterministic fallback
    return {
      proposedTasks: [
        {
          title: `Requirements & Discovery for ${goalTitle}`,
          description: "Define scope, technical requirements, and acceptance criteria.",
          priority: "high",
          subtasks: ["Gather stakeholder inputs", "Document scope constraints"],
          checklists: ["Draft specifications", "Approval sign-off"],
          dependsOnTitle: "",
        },
        {
          title: `Implementation & Development: ${goalTitle}`,
          description: "Build core features and required integration endpoints.",
          priority: "normal",
          subtasks: ["Develop primary logic", "Configure data model"],
          checklists: ["Code review", "Unit test pass"],
          dependsOnTitle: `Requirements & Discovery for ${goalTitle}`,
        },
        {
          title: `QA Testing & Validation: ${goalTitle}`,
          description: "End-to-end testing, bug verification, and edge case coverage.",
          priority: "high",
          subtasks: ["Execute test suites", "Validate edge conditions"],
          checklists: ["Zero blocker bugs", "Release sign-off"],
          dependsOnTitle: `Implementation & Development: ${goalTitle}`,
        },
      ],
      milestones: ["Requirements Signed Off", "Feature Complete", "Ready for Production"],
      risks: ["Integration scope expansion", "Unplanned prerequisite dependencies"],
    };
  }
}
