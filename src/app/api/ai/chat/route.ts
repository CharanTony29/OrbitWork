import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { streamTextWithFallback } from "@/lib/ai/client.ts";
import { CHATBOT_SYSTEM_PROMPT } from "@/lib/ai/chatbot/index.ts";
import { getUserLiveAIContext } from "@/lib/ai/data/user-context.ts";

export const dynamic = "force-dynamic";

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1).max(10000),
    })
  ).min(1),
  context: z
    .object({
      workspaceName: z.string().optional(),
      projectTitle: z.string().optional(),
      taskTitle: z.string().optional(),
      taskDescription: z.string().optional(),
      pageTitle: z.string().optional(),
    })
    .optional(),
});

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
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid chat payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { messages, context } = parsed.data;

    // 3. Fetch real live user data (tasks, projects, overdue status)
    let userContextString = "";
    try {
      const liveContext = await getUserLiveAIContext(user.id);
      if (liveContext?.formattedPromptContext) {
        userContextString = `\n${liveContext.formattedPromptContext}\n`;
      }
    } catch (dataErr) {
      console.warn("[AI Chat] Failed to load user live context:", dataErr);
    }

    const contextLines: string[] = [];
    if (context?.workspaceName) contextLines.push(`Workspace: ${context.workspaceName}`);
    if (context?.projectTitle) contextLines.push(`Current Project: ${context.projectTitle}`);
    if (context?.taskTitle) contextLines.push(`Current Task: ${context.taskTitle}`);
    if (context?.taskDescription) contextLines.push(`Task Details: ${context.taskDescription.slice(0, 500)}`);
    if (context?.pageTitle) contextLines.push(`Active Document: ${context.pageTitle}`);

    const systemPrompt = [
      CHATBOT_SYSTEM_PROMPT,
      userContextString,
      contextLines.length > 0 ? "\n--- Currently Viewed Page Context ---" : "",
      ...contextLines,
      "\nProvide crisp, helpful answers formatted in clean markdown (bullet points, numbered lists, checklists, bold text, clickable markdown links).",
    ]
      .filter(Boolean)
      .join("\n");

    const stream = await streamTextWithFallback({
      messages,
      system: systemPrompt,
      temperature: 0.5,
    });

    return stream.toTextStreamResponse();
  } catch (err: unknown) {
    console.error("[AI Chat Route Error]:", err);
    const message = err instanceof Error ? err.message : "Internal chat error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
