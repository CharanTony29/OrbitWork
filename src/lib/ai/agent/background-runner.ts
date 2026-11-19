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
  status: "running" | "completed" | "error" | "cancelled";
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
 * Resilient batch loop that executes in discrete chunks (10 tasks per call).
 * If the user refreshes or navigates, the loop resumes on next page load from currentOffset.
 * Network blips are retried up to 3 times before failing.
 */
async function runJobBatchLoop(jobId: string) {
  if (inFlightJobLoops.has(jobId)) return;
  inFlightJobLoops.add(jobId);

  try {
    let job = getJobById(jobId);
    if (!job || job.status !== "running") return;

    // Single task execution
    if (job.taskId) {
      try {
        const res = await callAgentRunApi({
          projectId: job.projectId,
          agentId: job.agentId,
          taskId: job.taskId,
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

        updateJob(jobId, (j) => ({
          ...j,
          status: "completed",
          processedCount: 1,
          totalTasks: 1,
          finishedAt: Date.now(),
          summary: res.summary || "Task processed successfully.",
          logs: [...j.logs, ...newLogs],
        }));

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("orbitwork:tasks-updated", {
              detail: { projectId: job.projectId, agentId: job.agentId },
            })
          );
        }
      } catch (err: any) {
        updateJob(jobId, (j) => ({
          ...j,
          status: "error",
          error: err?.message || "Task execution failed",
          finishedAt: Date.now(),
        }));
      }
      return;
    }

    // Bulk tasks execution loop
    let done = false;
    let offset = job.currentOffset || 0;
    const batchSize = job.batchSize || 10;
    let retryCount = 0;

    while (!done) {
      job = getJobById(jobId);
      if (!job || job.status === "cancelled") {
        break;
      }

      try {
        const res = await callAgentRunApi({
          projectId: job.projectId,
          agentId: job.agentId,
          runAllTasks: job.runAllTasks,
          runAllAgents: job.runAllAgents,
          batchOffset: offset,
          batchSize,
          jobId,
        });

        retryCount = 0; // reset retry counter on success
        const total = res.totalTasks ?? job.totalTasks ?? 0;
        const newLogs: AIAgentLogEntry[] = (res.batchLogs || []).map((b: any, idx: number) => ({
          id: `log-${Date.now()}-${offset}-${idx}`,
          time: b.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          taskId: b.taskId,
          taskTitle: b.taskTitle,
          actionTaken: b.actionTaken,
          status: b.status === "failed" ? "failed" : b.status === "skipped" ? "info" : "success",
        }));

        const nextProcessed = Math.min(total, (job.processedCount || 0) + (res.processedInBatch || 0));

        if (res.done || res.nextOffset === null || res.processedInBatch === 0) {
          done = true;
          updateJob(jobId, (j) => ({
            ...j,
            status: "completed",
            totalTasks: total,
            processedCount: total || nextProcessed,
            finishedAt: Date.now(),
            summary: `Successfully completed across ${total || nextProcessed} task(s).`,
            logs: [
              ...j.logs,
              ...newLogs,
              {
                id: `log-${Date.now()}-done`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                actionTaken: `All ${total || nextProcessed} tasks completed.`,
                status: "success",
              },
            ],
          }));

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("orbitwork:tasks-updated", {
                detail: { projectId: job.projectId, agentId: job.agentId },
              })
            );
          }
          break;
        } else {
          offset = res.nextOffset;
          updateJob(jobId, (j) => ({
            ...j,
            totalTasks: total,
            currentOffset: offset,
            processedCount: nextProcessed,
            logs: [...j.logs, ...newLogs],
          }));
        }
      } catch (err: any) {
        retryCount++;
        console.warn(`[AIAgentRunner] Batch at offset ${offset} interrupted (attempt ${retryCount}/3):`, err);
        if (retryCount <= 3) {
          updateJob(jobId, (j) => ({
            ...j,
            logs: [
              ...j.logs,
              {
                id: `log-retry-${Date.now()}`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                actionTaken: `Connection interrupted. Retrying batch in 2s (attempt ${retryCount}/3)...`,
                status: "warn",
              },
            ],
          }));
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        } else {
          updateJob(jobId, (j) => ({
            ...j,
            status: "error",
            error: err?.message || "Execution encountered network interruption after 3 retries.",
            finishedAt: Date.now(),
          }));
          done = true;
        }
      }
    }
  } finally {
    inFlightJobLoops.delete(jobId);
  }
}

/**
 * Triggers an AI Agent run in the global browser background with resilient batching.
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
    totalTasks: 0,
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

  // Launch background loop asynchronously
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
          console.log(`[AIAgentRunner] Resuming background job "${j.agentName}" (${j.id}) from offset ${j.currentOffset}`);
          runJobBatchLoop(j.id);
        }
      });
    } catch {
      // ignore startup errors
    }
  }, 150);
}
