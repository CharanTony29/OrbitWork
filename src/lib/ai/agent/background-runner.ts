"use client";

export type AIAgentJob = {
  id: string;
  projectId: string;
  agentId?: string;
  agentName: string;
  status: "running" | "completed" | "error";
  summary?: string;
  processedCount?: number;
  totalSubtasks?: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

const JOBS_STORAGE_KEY = "orbitwork_ai_agent_jobs_v1";

let activeJobs: AIAgentJob[] = [];

function loadJobs(): AIAgentJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(JOBS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistJobs(jobs: AIAgentJob[]) {
  activeJobs = jobs;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs.slice(-5)));
    window.dispatchEvent(new CustomEvent("orbitwork:ai-agent-jobs-change", { detail: jobs }));
  } catch {
    // ignore
  }
}

export function getActiveAIAgentJobs(): AIAgentJob[] {
  if (activeJobs.length === 0) {
    activeJobs = loadJobs();
  }
  return activeJobs;
}

export function dismissAIAgentJob(jobId: string) {
  const current = getActiveAIAgentJobs();
  const next = current.filter((j) => j.id !== jobId);
  persistJobs(next);
}

/**
 * Triggers an AI Agent run in the global browser background.
 * Uncouples the execution lifecycle from any specific tab component (e.g. ProjectAIAgentsHub)
 * so that when the user navigates to List, Board, Calendar, or settings, the execution continues
 * and a confirmation toast is presented cleanly at the right-bottom corner.
 */
export async function triggerAIAgentRun({
  projectId,
  agentId,
  agentName,
  taskId,
  runAllTasks,
  runAllAgents,
}: {
  projectId: string;
  agentId?: string;
  agentName: string;
  taskId?: string;
  runAllTasks?: boolean;
  runAllAgents?: boolean;
}): Promise<AIAgentJob> {
  const jobId = `agent-run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newJob: AIAgentJob = {
    id: jobId,
    projectId,
    agentId,
    agentName,
    status: "running",
    startedAt: Date.now(),
  };

  const current = getActiveAIAgentJobs();
  persistJobs([...current, newJob]);

  // Execute in background
  (async () => {
    try {
      const res = await fetch("/api/ai/agent/custom/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          agentId,
          taskId,
          runAllTasks,
          runAllAgents,
        }),
      });

      let data: any = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = {};
        }
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(
            text && text.length < 160 ? text : `Server error (${res.status} ${res.statusText || "Request failed"})`
          );
        }
      }
      if (!res.ok) throw new Error(data?.error || `Execution failed (${res.status})`);

      // Update job to completed
      const updated = getActiveAIAgentJobs().map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: "completed" as const,
              summary:
                data.summary ||
                `Successfully processed ${data.processedCount || 0} task(s) in background.`,
              processedCount: data.processedCount || 0,
              totalSubtasks: data.totalSubtasks,
              finishedAt: Date.now(),
            }
          : j
      );
      persistJobs(updated);

      // Trigger tasks update event so any active view (List, Board, Table) immediately refreshes
      window.dispatchEvent(
        new CustomEvent("orbitwork:tasks-updated", {
          detail: { projectId, agentId, processedCount: data.processedCount },
        })
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Background agent execution failed";
      const updated = getActiveAIAgentJobs().map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: "error" as const,
              error: errorMsg,
              finishedAt: Date.now(),
            }
          : j
      );
      persistJobs(updated);
    }
  })();

  return newJob;
}
