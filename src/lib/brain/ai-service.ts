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
      prompt: `${prompt}\n\nPROJECT DATA:\n${formattedContext}`,
      system: BRAIN_SYSTEM_PROMPT,
      temperature: 0.3,
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

  const dynamicContext = `
${formattedLLMContext}

### REAL-TIME DETERMINISTIC ENGINE METRICS:
- Overall Health: ${health.overallScore}% (${health.statusLabel})
- Schedule Score: ${health.categories.schedule.score}% (${health.categories.schedule.metricLabel})
- Dependencies Score: ${health.categories.dependencies.score}% (${health.categories.dependencies.metricLabel})
- Blockers: ${deps.blockedTaskCount} blocked tasks, ${deps.blockingTaskCount} active blocking tasks
- Workload Status: ${workload.overloadedCount} overloaded members, ${workload.unassignedTaskCount} unassigned tasks
`.trim();

  const system = `
${BRAIN_SYSTEM_PROMPT}

CURRENT PROJECT CONTEXT:
${dynamicContext}
`.trim();

  return streamTextWithFallback({
    messages,
    system,
    temperature: 0.4,
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
  const explicitTasks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = numberedTaskRegex.exec(fullText)) !== null) {
    const taskName = match[2].trim().replace(/\*\*/g, "");
    if (taskName.length > 2 && !taskName.toLowerCase().startsWith("task structure") && !taskName.toLowerCase().startsWith("subtask creation")) {
      explicitTasks.push(taskName);
    }
  }

  // Check for test case scenarios (e.g. TC01 - TC64)
  const tcRegex = /\b(TC\d{1,3})\b/gi;
  const detectedTCs: string[] = [];
  let tcMatch: RegExpExecArray | null;
  while ((tcMatch = tcRegex.exec(fullText)) !== null) {
    const tcId = tcMatch[1].toUpperCase();
    if (!detectedTCs.includes(tcId)) detectedTCs.push(tcId);
  }

  // If user provided a comprehensive explicit breakdown (e.g. 5+ numbered tasks)
  if (explicitTasks.length >= 4) {
    const generated: Array<{
      title: string;
      description: string;
      priority: "low" | "normal" | "high" | "urgent";
      subtasks: string[];
      checklists: string[];
      dependsOnTitle?: string;
    }> = [];

    explicitTasks.forEach((taskTitle, idx) => {
      // Allocate test cases or subtasks across the tasks
      const startIdx = idx * 4;
      const assignedTCs = detectedTCs.slice(startIdx, startIdx + 4);
      const subtasks = assignedTCs.length > 0
        ? assignedTCs.map((tc) => `${tc}: Execute & Validate Scenario for ${taskTitle}`)
        : [
            `Analyze requirements & preconditions for ${taskTitle}`,
            `Execute positive & standard functional scenarios`,
            `Perform boundary, negative & permission testing`,
            `Verify data persistence and audit trail`,
          ];

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
