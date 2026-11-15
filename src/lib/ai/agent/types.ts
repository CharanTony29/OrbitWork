/**
 * Type definitions for the Autonomous AI Agent.
 * The AI Agent is action-driven: executes workflows, tool-calls, automated triage, and database mutations.
 */

export type AgentActionType =
  | "create_subtasks"
  | "auto_assign"
  | "triage_priority"
  | "summarize_due_dates"
  | "generate_daily_briefing";

export interface AgentActionPayload {
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  taskId?: string;
  triggerEvent: "manual" | "subtask_created" | "daily_schedule" | "status_changed";
  parameters?: Record<string, unknown>;
}

export interface AgentExecutionResult {
  action: AgentActionType;
  status: "success" | "partial" | "failed";
  summary: string;
  mutationsApplied: number;
  data?: Record<string, unknown>;
}
