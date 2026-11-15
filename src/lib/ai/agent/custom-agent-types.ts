export type AgentTriggerType =
  | "on_subtask_created"
  | "on_task_created"
  | "on_status_change"
  | "manual";

export type AgentActionType =
  | "auto_assign_parent"
  | "generate_checklist"
  | "estimate_time"
  | "custom_agent";

export interface CustomAIAgent {
  id: string;
  project_id?: string | null;
  workspace_id?: string | null;
  organization_id?: string | null;
  name: string;
  description: string;
  trigger_type: AgentTriggerType;
  action_type: AgentActionType;
  system_instructions: string;
  enabled: boolean;
  runs_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export const AGENT_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  trigger_type: AgentTriggerType;
  action_type: AgentActionType;
  system_instructions: string;
}> = [
  {
    id: "template-auto-assign",
    name: "Subtask Auto-Inheritor",
    description: "Automatically assigns newly created subtasks to the parent task assignee.",
    trigger_type: "on_subtask_created",
    action_type: "auto_assign_parent",
    system_instructions: "Inherit parent task assignee and ensure no subtask is left unassigned.",
  },
  {
    id: "template-checklist",
    name: "Acceptance Criteria Generator",
    description: "Generates 3 to 5 acceptance criteria checklist items based on the task description.",
    trigger_type: "on_task_created",
    action_type: "generate_checklist",
    system_instructions: "Analyze the task scope and generate clear, testable acceptance criteria as checklist items.",
  },
  {
    id: "template-estimate",
    name: "Effort & Priority Estimator",
    description: "Analyzes task complexity and automatically suggests realistic estimate minutes and priority.",
    trigger_type: "on_task_created",
    action_type: "estimate_time",
    system_instructions: "Estimate realistic working minutes (30m, 60m, 120m, 240m) and set priority based on task urgency.",
  },
  {
    id: "template-custom",
    name: "Custom Autonomous Agent",
    description: "Define your own trigger and prompt instructions in plain English.",
    trigger_type: "manual",
    action_type: "custom_agent",
    system_instructions: "Analyze the task and write an executive summary and recommended next steps in the task notes.",
  },
];
