import { generateTextWithFallback } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { createDoc } from "@/lib/docs/service";

export interface GenerateProjectScopeOptions {
  projectId: string;
  meetingNotes?: string;
  goalText?: string;
  focusAreas?: string[];
  saveAsDocument?: boolean;
}

export interface GenerateTaskScopeOptions {
  taskTitle: string;
  taskId?: string;
  projectId?: string;
  meetingSnippet?: string;
  context?: string;
  updateTask?: boolean;
}

export interface ProjectScopeResult {
  title: string;
  executiveSummary: string;
  scopeMarkdown: string;
  savedDocumentId?: string;
}

export interface TaskScopeResult {
  title: string;
  userStory: string;
  scopeMarkdown: string;
  acceptanceCriteria: string[];
  estimatedHours: number;
  storyPoints: number;
  updatedTaskId?: string;
}

/**
 * Generates an executive-ready Project Scope document grounded in project data,
 * task backlog, and meeting notes/MoM.
 */
export async function generateProjectScope(
  options: GenerateProjectScopeOptions
): Promise<ProjectScopeResult> {
  const supabase = await createClient();

  // 1. Fetch project details
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, status, priority, due_date, workspace_id")
    .eq("id", options.projectId)
    .maybeSingle();

  if (!project) {
    throw new Error(`Project ${options.projectId} not found`);
  }

  // 2. Fetch existing tasks for grounding
  const { data: tasks } = await supabase
    .from("tasks")
    .select("generated_key, title, priority, status_id, due_date")
    .eq("project_id", options.projectId)
    .order("created_at", { ascending: false })
    .limit(30);

  // 3. Fetch recent meetings or MoMs
  const { data: meetings } = await supabase
    .from("meetings")
    .select("title, description, start_time, meeting_url")
    .eq("project_id", options.projectId)
    .order("start_time", { ascending: false })
    .limit(5);

  const taskSummary = (tasks || [])
    .map((t) => `- [${t.generated_key || "TASK"}] ${t.title} (Priority: ${t.priority})`)
    .join("\n");

  const meetingSummary = (meetings || [])
    .map((m) => `- Meeting: "${m.title}" (${m.description || "No notes recorded"})`)
    .join("\n");

  const prompt = `You are an elite Project Management Director & Technical Architect.
Generate an authoritative, comprehensive Project Scope Document for the project below.

PROJECT CONTEXT:
- Project Name: ${project.name}
- Current Description: ${project.description || "N/A"}
- Target Due Date: ${project.due_date || "Not specified"}
- Priority: ${project.priority}

${options.meetingNotes ? `MEETING MINUTES / STAKEHOLDER DISCUSSIONS:\n${options.meetingNotes}\n` : ""}
${options.goalText ? `PRIMARY GOAL / VISION:\n${options.goalText}\n` : ""}
${meetingSummary ? `PREVIOUS MEETINGS:\n${meetingSummary}\n` : ""}
${taskSummary ? `INITIAL TASK BACKLOG:\n${taskSummary}\n` : ""}

REQUIREMENTS:
Write a rigorous, professional Markdown Project Scope Document containing the following sections:
# Project Scope Specification: ${project.name}

## 1. Executive Summary & Business Objectives
- High-level project purpose and business rationale.
- Key measurable success criteria.

## 2. In-Scope Deliverables & Functional Capabilities
- Core modules, services, and features included in this release.
- Work breakdown structure (WBS) summary.

## 3. Explicit Out-of-Scope Boundaries (Anti-Scope Creep)
- Explicitly list features, integrations, and work items NOT included in this scope.

## 4. Definition of Done & Quality Acceptance Criteria
- Clear, testable acceptance checklist for project completion.

## 5. Technical Architecture & System Dependencies
- Database, API, third-party services, and external dependencies.

## 6. Milestones & Proposed Delivery Timeline
- Phased delivery schedule with milestone targets.

## 7. Risk Assessment & Mitigation Strategy
- Key identified risks and counter-measures.

Provide the full markdown document. Do not wrap in generic conversational chatter.`;

  const aiResponse = await generateTextWithFallback({
    prompt,
    temperature: 0.2,
    maxOutputTokens: 3500,
  });

  const scopeMarkdown = aiResponse.text.trim();
  const title = `Project Scope: ${project.name}`;

  let savedDocumentId: string | undefined;

  // 4. Save into project documents if requested
  if (options.saveAsDocument) {
    try {
      const docResult = await createDoc({
        workspaceId: project.workspace_id,
        projectId: project.id,
        title,
        icon: "📋",
        description: `Official AI-grounded project scope specification for ${project.name}.`,
        isWiki: true,
      });

      if (docResult.ok && docResult.doc) {
        savedDocumentId = docResult.doc.id;
        // Seed first page content with the generated markdown
        if (docResult.page?.id) {
          await supabase
            .from("document_pages")
            .update({
              content: scopeMarkdown,
              updated_at: new Date().toISOString(),
            })
            .eq("id", docResult.page.id);
        }
      }
    } catch (docErr) {
      console.warn("Failed to automatically save scope to document_pages:", docErr);
    }
  }

  return {
    title,
    executiveSummary: `Generated comprehensive project scope specification for ${project.name}.`,
    scopeMarkdown,
    savedDocumentId,
  };
}

/**
 * Generates an engineering-grade Task Scope & Technical Specification
 * from a simple task title or meeting discussion snippet.
 */
export async function generateTaskScope(
  options: GenerateTaskScopeOptions
): Promise<TaskScopeResult> {
  const supabase = await createClient();

  let projectContext = "";
  if (options.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("name, description")
      .eq("id", options.projectId)
      .maybeSingle();
    if (project) {
      projectContext = `Project: ${project.name} (${project.description || ""})`;
    }
  }

  const prompt = `You are a Principal Software Engineer and Agile Scrum Master.
Write a comprehensive, professional Task Scope & Technical Specification for the following task:

TASK TITLE: "${options.taskTitle}"
${projectContext ? `PROJECT CONTEXT: ${projectContext}\n` : ""}
${options.meetingSnippet ? `MEETING DISCUSSION SNIPPET:\n${options.meetingSnippet}\n` : ""}
${options.context ? `ADDITIONAL CONTEXT:\n${options.context}\n` : ""}

REQUIREMENTS:
Write an engineering task specification in Markdown format:
### User Story
As a [user role], I want [feature/capability], so that [business value/benefit].

### Scope of Work
- Detailed description of what must be implemented.
- Frontend / UI changes (if applicable).
- Backend APIs & Server Actions (if applicable).
- Database / Data Model considerations.

### Acceptance Criteria
- [ ] Criterion 1 (Given-When-Then or clear checkbox)
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] Criterion 4

### Edge Cases & Failure Modes
- Potential error conditions, validation rules, or edge cases.

### Recommended Story Points & Hours
- Story Points: [1, 2, 3, 5, 8, 13]
- Estimated Hours: [e.g. 4 - 8 hours]

Return cleanly formatted Markdown without unnecessary preamble.`;

  const aiResponse = await generateTextWithFallback({
    prompt,
    temperature: 0.2,
    maxOutputTokens: 2000,
  });

  const scopeMarkdown = aiResponse.text.trim();

  // Extract story points and hours if present
  let storyPoints = 3;
  let estimatedHours = 6;
  const pointsMatch = scopeMarkdown.match(/Story Points:\s*(\d+)/i);
  if (pointsMatch) storyPoints = parseInt(pointsMatch[1], 10);
  const hoursMatch = scopeMarkdown.match(/Estimated Hours:\s*(\d+)/i);
  if (hoursMatch) estimatedHours = parseInt(hoursMatch[1], 10);

  // Extract acceptance criteria lines
  const acceptanceCriteria: string[] = [];
  const lines = scopeMarkdown.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("- [ ]") || line.trim().startsWith("- [x]")) {
      acceptanceCriteria.push(line.replace(/-\s*\[[ x]\]\s*/, "").trim());
    }
  }

  // If updateTask is true and taskId provided, update the task in database
  let updatedTaskId: string | undefined;
  if (options.updateTask && options.taskId) {
    try {
      await supabase
        .from("tasks")
        .update({
          description: scopeMarkdown,
          estimate_minutes: estimatedHours * 60,
          updated_at: new Date().toISOString(),
        })
        .eq("id", options.taskId);
      updatedTaskId = options.taskId;
    } catch (updateErr) {
      console.warn("Failed to update task description with scope:", updateErr);
    }
  }

  return {
    title: options.taskTitle,
    userStory: `User story & technical specification for "${options.taskTitle}".`,
    scopeMarkdown,
    acceptanceCriteria,
    estimatedHours,
    storyPoints,
    updatedTaskId,
  };
}
