import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  generateProjectScope,
  generateTaskScope,
} from "@/lib/ai/utilities/scope-writer";

export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("project_scope"),
    projectId: z.string().uuid(),
    meetingNotes: z.string().max(50000).optional(),
    goalText: z.string().max(5000).optional(),
    focusAreas: z.array(z.string()).optional(),
    saveAsDocument: z.boolean().default(false),
  }),
  z.object({
    mode: z.literal("task_scope"),
    taskTitle: z.string().min(2).max(500),
    taskId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    meetingSnippet: z.string().max(20000).optional(),
    context: z.string().max(10000).optional(),
    updateTask: z.boolean().default(false),
  }),
]);

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

    if (parsed.data.mode === "project_scope") {
      const result = await generateProjectScope({
        projectId: parsed.data.projectId,
        meetingNotes: parsed.data.meetingNotes,
        goalText: parsed.data.goalText,
        focusAreas: parsed.data.focusAreas,
        saveAsDocument: parsed.data.saveAsDocument,
      });
      return NextResponse.json({ ok: true, scope: result });
    } else {
      const result = await generateTaskScope({
        taskTitle: parsed.data.taskTitle,
        taskId: parsed.data.taskId,
        projectId: parsed.data.projectId,
        meetingSnippet: parsed.data.meetingSnippet,
        context: parsed.data.context,
        updateTask: parsed.data.updateTask,
      });
      return NextResponse.json({ ok: true, scope: result });
    }
  } catch (err: any) {
    console.error("AI Scope generation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate scope" },
      { status: 500 }
    );
  }
}
