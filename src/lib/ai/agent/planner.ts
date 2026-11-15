import { generateTextWithFallback } from "../client.ts";
import { AGENT_SYSTEM_PROMPT } from "./index.ts";

export interface SuggestedSubtask {
  id: string;
  title: string;
  description: string;
  estimateMinutes: number;
  priority: "urgent" | "high" | "normal" | "low";
  selected: boolean;
}

export interface AgentPlanResult {
  summary: string;
  subtasks: SuggestedSubtask[];
}

export async function planSubtasksWithAgent(options: {
  taskTitle: string;
  taskDescription?: string;
  projectTitle?: string;
}): Promise<AgentPlanResult> {
  const { taskTitle, taskDescription, projectTitle } = options;

  const prompt = `
You are an autonomous technical planning agent.
Analyze the following parent task and decompose it into 3 to 6 logical, non-overlapping subtasks with realistic time estimates.

Parent Task Title: "${taskTitle}"
${projectTitle ? `Project: "${projectTitle}"` : ""}
${taskDescription ? `Parent Task Scope/Description:\n"""\n${taskDescription.slice(0, 1500)}\n"""` : ""}

Respond ONLY with a valid JSON object matching this exact structure:
{
  "summary": "Brief explanation of the strategy",
  "subtasks": [
    {
      "title": "Concise subtask title",
      "description": "Short acceptance criteria or scope",
      "estimateMinutes": 60,
      "priority": "normal"
    }
  ]
}

Priority must be one of: "urgent", "high", "normal", "low".
EstimateMinutes should be realistic (e.g. 30, 45, 60, 120, 180).
Do not wrap in markdown quotes if possible, output raw JSON.
`.trim();

  const res = await generateTextWithFallback({
    prompt,
    system: AGENT_SYSTEM_PROMPT,
    temperature: 0.3,
  });

  const raw = res.text.trim();
  // Strip potential markdown code blocks ```json ... ```
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const subtasks: SuggestedSubtask[] = (parsed.subtasks || []).map(
      (s: Partial<SuggestedSubtask>, idx: number) => ({
        id: `plan-${idx + 1}-${Date.now()}`,
        title: s.title || `Subtask ${idx + 1}`,
        description: s.description || "",
        estimateMinutes: Number(s.estimateMinutes) || 60,
        priority: ["urgent", "high", "normal", "low"].includes(s.priority as string)
          ? s.priority
          : "normal",
        selected: true,
      })
    );

    return {
      summary: parsed.summary || "Generated subtask breakdown",
      subtasks,
    };
  } catch (err) {
    console.error("[Agent JSON Parse Error]:", raw);
    throw new Error("AI Agent produced invalid JSON plan. Please retry.");
  }
}
