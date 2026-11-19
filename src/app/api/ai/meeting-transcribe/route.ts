import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateMultimodalWithFallback, isAILimitError } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export interface TranscribedMoMOutput {
  title: string;
  date: string;
  attendees: string[];
  summary: string;
  keyDecisions: string[];
  discussionTopics: Array<{ topic: string; notes: string }>;
  markdown: string;
}

export interface ExtractedMeetingTask {
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  assigneeName?: string | null;
  assigneeId?: string | null;
  exists: boolean;
  existingTaskId?: string;
  existingTaskTitle?: string;
  duplicateReason?: string;
}

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawTranscript = (formData.get("transcriptText") as string | null) || "";
    const projectId = (formData.get("projectId") as string | null) || null;
    const meetingTitle = (formData.get("meetingTitle") as string | null) || "Meeting";

    if (!file && !rawTranscript.trim()) {
      return NextResponse.json(
        { error: "Please upload an audio/video recording or paste a meeting transcript." },
        { status: 400 }
      );
    }

    // 1. Fetch project context for duplicate detection and assignee matching if projectId provided
    let existingTasksSummary = "";
    let projectMembersList: Array<{ id: string; name: string }> = [];

    if (projectId) {
      const [tasksRes, membersRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, description")
          .eq("project_id", projectId)
          .limit(100),
        supabase
          .from("project_members")
          .select("user_id, profiles(id, display_name, email)")
          .eq("project_id", projectId),
      ]);

      if (tasksRes.data && tasksRes.data.length > 0) {
        existingTasksSummary = tasksRes.data
          .map((t) => `- [ID:${t.id}] ${t.title}`)
          .join("\n");
      }

      if (membersRes.data) {
        projectMembersList = membersRes.data
          .map((m: any) => {
            const p = m.profiles;
            const name = p?.display_name?.trim() || p?.email?.split("@")[0] || "";
            return { id: m.user_id, name };
          })
          .filter((m) => Boolean(m.name));
      }
    }

    const memberNamesStr = projectMembersList.map((m) => m.name).join(", ") || "None specified";

    const systemPrompt = `You are Orbitwork's AI Meeting Studio, an advanced AI specialized in transcribing and analyzing Zoom, Microsoft Teams, and Google Meet calls.
Your objective is to produce TWO DISTINCT, HIGH-QUALITY OUTPUTS from the provided meeting recording or transcript:

1. MINUTES OF MEETING (MoM):
   - A complete, executive-grade summary formatted for company documentation.
   - Includes: Meeting Title, Date, Attendees, Executive Summary, Discussion Topics & Notes, Key Decisions Made, and formatted Markdown.

2. STRUCTURED ACTION ITEMS & TASKS:
   - Extract every actionable deliverable, bug fix, or follow-up agreed upon.
   - Match assigned persons to real project members: [${memberNamesStr}].
   - If a person was mentioned, suggest their name.
   - For each task, check against EXISTING PROJECT TASKS:\n${existingTasksSummary || "No existing tasks."}\n
   - If an existing task already covers it, mark "exists": true with reason, else "exists": false.

Output ONLY a single valid JSON object with EXACTLY this structure:
{
  "transcript": "Full transcript or detailed spoken dialogue summary...",
  "mom": {
    "title": "${meetingTitle}",
    "date": "YYYY-MM-DD",
    "attendees": ["Name 1", "Name 2"],
    "summary": "2-3 paragraphs executive summary...",
    "keyDecisions": ["Decision 1", "Decision 2"],
    "discussionTopics": [
      {
        "topic": "Agenda Item Name",
        "notes": "Detailed discussion points, context, and arguments..."
      }
    ],
    "markdown": "# Minutes of Meeting: ${meetingTitle}\\n\\n## Executive Summary\\n...\\n\\n## Key Decisions\\n- ...\\n\\n## Discussion Notes\\n..."
  },
  "tasks": [
    {
      "title": "Action oriented task title",
      "description": "Clear context and acceptance criteria...",
      "priority": "low" | "normal" | "high" | "urgent",
      "dueDate": "YYYY-MM-DD" | null,
      "assigneeName": "Name" | null,
      "exists": false,
      "existingTaskId": null,
      "existingTaskTitle": null,
      "duplicateReason": null
    }
  ]
}`;

    let prompt = `Analyze this meeting recording and extract both the Minutes of Meeting (MoM) and Action Items/Tasks.`;
    let fileBuffer: Buffer | undefined = undefined;
    let mimeType: string | undefined = undefined;

    if (file) {
      const bytes = await file.arrayBuffer();
      fileBuffer = Buffer.from(bytes);
      mimeType = file.type || "audio/mp4";
      prompt += `\nAttached recording filename: ${file.name} (${file.size} bytes). Transcribe the dialogue carefully.`;
    } else {
      prompt += `\nRaw transcript provided:\n${rawTranscript}`;
    }

    const { text: rawOutput } = await generateMultimodalWithFallback({
      prompt,
      system: systemPrompt,
      fileBuffer,
      mimeType,
      temperature: 0.2,
      maxOutputTokens: 3500,
    });

    // Parse JSON safely
    let cleanJson = rawOutput.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```\s*/i, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleanJson);

    // Link matched assignee IDs from projectMembersList
    if (Array.isArray(parsed.tasks)) {
      for (const t of parsed.tasks) {
        if (t.assigneeName) {
          const matched = projectMembersList.find(
            (m) =>
              m.name.toLowerCase().includes(t.assigneeName.toLowerCase()) ||
              t.assigneeName.toLowerCase().includes(m.name.toLowerCase())
          );
          if (matched) {
            t.assigneeId = matched.id;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      transcript: parsed.transcript || "Meeting transcript processed.",
      mom: parsed.mom,
      tasks: parsed.tasks || [],
    });
  } catch (err: unknown) {
    console.error("[Meeting Transcribe API Error]:", err);
    return NextResponse.json(
      {
        error: isAILimitError(err)
          ? "AI processing limit reached. Please try again shortly or configure an API key."
          : "Failed to transcribe and analyze meeting recording. Please verify the audio file format.",
      },
      { status: isAILimitError(err) ? 429 : 500 }
    );
  }
}
