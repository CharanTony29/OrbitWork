import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { streamTextWithFallback, isAILimitError } from "@/lib/ai/client.ts";
import { CHATBOT_SYSTEM_PROMPT } from "@/lib/ai/chatbot/index.ts";
import { getUserLiveAIContext } from "@/lib/ai/data/user-context.ts";

export const dynamic = "force-dynamic";

const SMALLTALK_REGEX =
  /^(hi+|hello+|hey+|hlo|yo|sup|good\s*(morning|afternoon|evening)|thanks?|thank\s*you|thx|ok(ay)?|cool|great|bye|goodbye)[!.,?\s]*$/i;

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

    // Keep only the most recent 6 messages and cap length to save tokens
    const trimmedMessages = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content.length > 1500 ? `${m.content.slice(0, 1500)}…` : m.content,
    }));

    const latestUserMsg =
      [...trimmedMessages].reverse().find((m) => m.role === "user")?.content.trim() || "";
    const isSimpleGreeting =
      trimmedMessages.length <= 2 && SMALLTALK_REGEX.test(latestUserMsg);

    // Fetch live workspace context only when the message is not trivial smalltalk
    let userContextString = "";
    if (!isSimpleGreeting) {
      try {
        const liveContext = await getUserLiveAIContext(user.id, {
          scope: "workspace",
          maxTasks: 45,
          includeTeam: true,
        });
        if (liveContext?.formattedPromptContext) {
          userContextString = `\n${liveContext.formattedPromptContext}\n`;
        }
      } catch (dataErr) {
        console.warn("[AI Chat] Failed to load user live context:", dataErr);
      }
    }

    const contextLines: string[] = [];
    if (context?.workspaceName) contextLines.push(`Workspace: ${context.workspaceName}`);
    if (context?.projectTitle) contextLines.push(`Project: ${context.projectTitle}`);
    if (context?.taskTitle) contextLines.push(`Task: ${context.taskTitle}`);
    if (context?.taskDescription) contextLines.push(`Details: ${context.taskDescription.slice(0, 350)}`);
    if (context?.pageTitle) contextLines.push(`Doc: ${context.pageTitle}`);

    const systemPrompt = [
      CHATBOT_SYSTEM_PROMPT,
      userContextString,
      contextLines.length > 0 ? `Page: ${contextLines.join(" | ")}` : "",
      "Be concise and use clean markdown. Refer to tasks ONLY by bold **Task Name** (never IDs, UUIDs, or URLs).",
    ]
      .filter(Boolean)
      .join("\n");

    const stream = await streamTextWithFallback({
      messages: trimmedMessages,
      system: systemPrompt,
      temperature: 0.4,
      maxOutputTokens: isSimpleGreeting ? 120 : 650,
    });

    return stream.toTextStreamResponse();
  } catch (err: unknown) {
    console.error("[AI Chat Route Error]:", err);
    const message = err instanceof Error ? err.message : "Internal chat error";
    return NextResponse.json(
      { error: message },
      { status: isAILimitError(err) ? 429 : 500 }
    );
  }
}
