"use client";

export type AIAgentLogEntry = {
  id: string;
  time: string;
  taskId?: string;
  taskTitle?: string;
  actionTaken: string;
  status: "success" | "info" | "warn" | "failed";
};

export type AIAgentJob = {
  id: string;
  projectId: string;
  agentId?: string;
  agentName: string;
  status: "running" | "completed" | "partially_completed" | "failed" | "error" | "cancelled";
  summary?: string;
  processedCount: number;
  totalTasks: number;
  currentOffset: number;
  batchSize: number;
  logs: AIAgentLogEntry[];
  error?: string;
  startedAt: number;
  finishedAt?: number;
  runAllTasks?: boolean;
  runAllAgents?: boolean;
  taskId?: string;
};

const JOBS_STORAGE_KEY = "orbitwork_ai_agent_jobs_v2";

let activeJobs: AIAgentJob[] = [];
const inFlightJobLoops = new Set<string>();

function loadJobs(): AIAgentJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(JOBS_STORAGE_KEY);
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
    localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs.slice(-10)));
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

export function getJobById(jobId: string): AIAgentJob | undefined {
  return getActiveAIAgentJobs().find((j) => j.id === jobId);
}

function updateJob(jobId: string, updater: (job: AIAgentJob) => AIAgentJob): AIAgentJob | undefined {
  const current = getActiveAIAgentJobs();
  let updatedJob: AIAgentJob | undefined;
  const next = current.map((j) => {
    if (j.id === jobId) {
      updatedJob = updater(j);
      return updatedJob;
    }
    return j;
  });
  persistJobs(next);
  return updatedJob;
}

export function dismissAIAgentJob(jobId: string) {
  const current = getActiveAIAgentJobs();
  const next = current.filter((j) => j.id !== jobId);
  persistJobs(next);
}

export function cancelAIAgentJob(jobId: string) {
  updateJob(jobId, (j) => ({
    ...j,
    status: "cancelled",
    finishedAt: Date.now(),
    logs: [
      ...j.logs,
      {
        id: `log-cancel-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        actionTaken: "Execution cancelled by user.",
        status: "warn",
      },
    ],
  }));
}

/**
 * Executes a single API batch run with safe JSON parsing and error handling
 */
async function callAgentRunApi(payload: {
  projectId: string;
  agentId?: string;
  taskId?: string;
  runAllTasks?: boolean;
  runAllAgents?: boolean;
  batchOffset?: number;
  batchSize?: number;
  jobId?: string;
}) {
  const res = await fetch("/api/ai/agent/custom/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = {};
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

  if (!res.ok) {
    throw new Error(data?.error || `Execution failed (${res.status})`);
  }

  return data;
}

/**
 * Resilient execution runner.
 * Initiates the AI agent execution against the Orbitwork backend engine,
 * updates live job state, and records verified database changes.
 */
async function runJobBatchLoop(jobId: string) {
  if (inFlightJobLoops.has(jobId)) return;
  inFlightJobLoops.add(jobId);

  try {
    let job = getJobById(jobId);
    if (!job || job.status !== "running") return;

    try {
      const res = await callAgentRunApi({
        projectId: job.projectId,
        agentId: job.agentId,
        taskId: job.taskId,
        runAllTasks: job.runAllTasks,
        runAllAgents: job.runAllAgents,
        jobId,
      });

      const newLogs: AIAgentLogEntry[] = (res.batchLogs || []).map((b: any, idx: number) => ({
        id: `log-${Date.now()}-${idx}`,
        time: b.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        taskId: b.taskId,
        taskTitle: b.taskTitle,
        actionTaken: b.actionTaken,
        status: b.status === "failed" ? "failed" : b.status === "skipped" ? "info" : "success",
      }));

      const finalStatus: AIAgentJob["status"] =
        res.status === "partially_completed"
          ? "partially_completed"
          : res.status === "failed"
          ? "failed"
          : res.success
          ? "completed"
          : "error";

      const verifiedCount = res.verifiedCount ?? (finalStatus === "completed" ? 1 : 0);

      updateJob(jobId, (j) => ({
        ...j,
        status: finalStatus,
        processedCount: verifiedCount,
        totalTasks: Math.max(verifiedCount, 1),
        finishedAt: Date.now(),
        summary: res.summary || (res.success ? "AI Agent executed and verified changes successfully." : "Execution completed with warnings."),
        logs: [
          ...j.logs,
          ...newLogs,
          {
            id: `log-${Date.now()}-done`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            actionTaken:
              verifiedCount > 0
                ? `Finished. Verified ${verifiedCount} real database update(s).`
                : "Finished. No matching tasks required modifications.",
            status: finalStatus === "failed" ? "failed" : "success",
          },
        ],
      }));

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("orbitwork:tasks-updated", {
            detail: { projectId: job.projectId, agentId: job.agentId, processedCount: verifiedCount },
          })
        );
      }
    } catch (err: any) {
      console.error(`[AIAgentRunner] Execution error for job ${jobId}:`, err);
      updateJob(jobId, (j) => ({
        ...j,
        status: "failed",
        error: err?.message || "Task execution failed",
        summary: err?.message || "Task execution failed",
        finishedAt: Date.now(),
        logs: [
          ...j.logs,
          {
            id: `log-err-${Date.now()}`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            actionTaken: `Error: ${err?.message || "Execution failed"}`,
            status: "failed",
          },
        ],
      }));
    }
  } finally {
    inFlightJobLoops.delete(jobId);
  }
}

/**
 * Triggers an AI Agent run in the global browser background.
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
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const initialAction = taskId
    ? `Initiating agent "${agentName}" run on task...`
    : `Initiating agent "${agentName}" across project tasks...`;

  const newJob: AIAgentJob = {
    id: jobId,
    projectId,
    agentId,
    agentName,
    status: "running",
    processedCount: 0,
    totalTasks: 1,
    currentOffset: 0,
    batchSize: 10,
    logs: [
      {
        id: `log-${Date.now()}-init`,
        time: timeStr,
        actionTaken: initialAction,
        status: "info",
      },
    ],
    startedAt: Date.now(),
    runAllTasks,
    runAllAgents,
    taskId,
  };

  const current = getActiveAIAgentJobs();
  persistJobs([...current, newJob]);

  // Launch background execution asynchronously
  setTimeout(() => {
    runJobBatchLoop(jobId);
  }, 10);

  return newJob;
}

// Auto-recovery: Resume running jobs on page load/refresh
if (typeof window !== "undefined") {
  setTimeout(() => {
    try {
      const active = getActiveAIAgentJobs();
      active.forEach((j) => {
        if (j.status === "running") {
          console.log(`[AIAgentRunner] Resuming background job "${j.agentName}" (${j.id})`);
          runJobBatchLoop(j.id);
        }
      });
    } catch {
      // ignore startup errors
    }
  }, 150);
}
