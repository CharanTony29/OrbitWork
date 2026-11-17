import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string().uuid(),
  momText: z.string().min(10, "Meeting minutes text must be at least 10 characters").max(40000),
});

export type ExtractedMoMTask = {
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  assigneeName?: string | null;
  exists: boolean;
  existingTaskId?: string;
  existingTaskTitle?: string;
  duplicateReason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId, momText } = parsed.data;

    // Fetch existing tasks in this project to prevent duplicates
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("id, title, description, priority, due_date")
      .eq("project_id", projectId)
      .limit(200);

    const existingSummaryList = (existingTasks || []).map((t) => ({
      id: t.id,
      title: t.title.trim(),
      descPreview: (t.description || "").slice(0, 100),
    }));

    // Fetch project members for potential assignee matching
    const { data: membersData } = await supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);

    let memberNames: string[] = [];
    if (membersData && membersData.length > 0) {
      const userIds = membersData.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, email")
        .in("id", userIds);
      memberNames = (profiles || []).map((p) => p.display_name?.trim() || p.email || "");
    }

    const systemPrompt = `You are an expert Project Management AI specialized in analyzing Minutes of Meetings (MoM), transcripts, and meeting notes.
Your task is to extract clear, actionable tasks from the meeting text, AND check them against existing project tasks to detect duplicates.

Rules:
1. Extract every distinct actionable task, deliverable, bug fix, or follow-up agreed upon in the meeting.
2. For each task, provide:
   - "title": Action-oriented, concise title (e.g. "Configure SSO with Azure AD", "Update database connection pool").
   - "description": Context, requirements, or next steps mentioned during the call.
   - "priority": "low" | "normal" | "high" | "urgent" based on urgency mentioned.
   - "dueDate": ISO date string (YYYY-MM-DD) if an ETA, deadline, or day was mentioned, otherwise null.
   - "assigneeName": Name of the team member assigned in the meeting, or null.
3. DUPLICATE DETECTION:
   Compare each extracted task against the provided list of EXISTING PROJECT TASKS.
   - If an existing task already covers the same objective, feature, or bug (even with slightly different phrasing), mark "exists": true, provide "existingTaskId" and "existingTaskTitle", and give "duplicateReason".
   - If it is completely new work, mark "exists": false.

Output ONLY a valid JSON array of objects with the structure:
[
  {
    "title": "string",
    "description": "string",
    "priority": "low" | "normal" | "high" | "urgent",
    "dueDate": "YYYY-MM-DD" | null,
    "assigneeName": "string" | null,
    "exists": boolean,
    "existingTaskId": "string" | null,
    "existingTaskTitle": "string" | null,
    "duplicateReason": "string" | null
  }
]`;

    const userPrompt = `MEETING MINUTES TEXT:
"""
${momText}
"""

EXISTING PROJECT TASKS (${existingSummaryList.length} tasks currently in project):
${JSON.stringify(existingSummaryList, null, 2)}

TEAM MEMBERS IN PROJECT:
${JSON.stringify(memberNames)}`;

    let rawOutput = "";
    try {
      const aiResponse = await generateTextWithFallback({
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        temperature: 0.2,
      });
      rawOutput = aiResponse.text;
    } catch (aiErr) {
      console.warn("[MoM AI Error, falling back to smart heuristic parsing]:", aiErr);
    }

    let parsedTasks: ExtractedMoMTask[] = [];

    if (rawOutput) {
      try {
        const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedTasks = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("Failed to parse AI JSON, falling back:", parseErr);
      }
    }

    // Heuristic Fallback if AI was unavailable or returned empty
    if (!parsedTasks || parsedTasks.length === 0) {
      const lines = momText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 5);

      for (const line of lines) {
        const isActionItem =
          /^[-*•]\s*(?:\[\s*\])?/i.test(line) ||
          /(?:todo|action item|task|follow up|deliverable|must|should|will do):/i.test(line) ||
          /^(?:1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.|9\.)/i.test(line);

        if (isActionItem) {
          const cleanedTitle = line
            .replace(/^[-*•]\s*(?:\[\s*\])?/i, "")
            .replace(/^(?:todo|action item|task|follow up|deliverable):\s*/i, "")
            .replace(/^\d+\.\s*/, "")
            .trim();

          if (cleanedTitle.length > 5) {
            // Check heuristic duplicate
            const lowerTitle = cleanedTitle.toLowerCase();
            const matchedExisting = existingSummaryList.find(
              (et) =>
                et.title.toLowerCase() === lowerTitle ||
                (lowerTitle.length > 10 && et.title.toLowerCase().includes(lowerTitle)) ||
                (et.title.length > 10 && lowerTitle.includes(et.title.toLowerCase()))
            );

            parsedTasks.push({
              title: cleanedTitle,
              description: `Extracted from meeting minutes: "${line}"`,
              priority: /urgent|p0|asap|blocker/i.test(line)
                ? "urgent"
                : /high|p1/i.test(line)
                ? "high"
                : "normal",
              dueDate: null,
              assigneeName: null,
              exists: Boolean(matchedExisting),
              existingTaskId: matchedExisting?.id,
              existingTaskTitle: matchedExisting?.title,
              duplicateReason: matchedExisting
                ? `Matches existing task "${matchedExisting.title}"`
                : undefined,
            });
          }
        }
      }
    }

    // Secondary safety check for duplicates against existing tasks
    parsedTasks = parsedTasks.map((t) => {
      if (t.exists) return t;
      const lower = t.title.toLowerCase();
      const match = existingSummaryList.find((et) => {
        const etLower = et.title.toLowerCase();
        return (
          etLower === lower ||
          (lower.length > 10 && etLower.includes(lower)) ||
          (etLower.length > 10 && lower.includes(etLower))
        );
      });
      if (match) {
        return {
          ...t,
          exists: true,
          existingTaskId: match.id,
          existingTaskTitle: match.title,
          duplicateReason: `Similar task already exists: "${match.title}"`,
        };
      }
      return t;
    });

    return NextResponse.json({
      success: true,
      tasks: parsedTasks,
      totalCount: parsedTasks.length,
      duplicateCount: parsedTasks.filter((t) => t.exists).length,
      newCount: parsedTasks.filter((t) => !t.exists).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process meeting minutes";
    console.error("[MoM Extraction Error]:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
