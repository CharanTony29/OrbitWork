import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback, isAILimitError } from "@/lib/ai/client.ts";
import { getUserLiveAIContext } from "@/lib/ai/data/user-context.ts";
import { AGENT_SYSTEM_PROMPT } from "@/lib/ai/agent/index.ts";

export const dynamic = "force-dynamic";

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

    // Fetch compact personal task context (keeps token consumption minimal)
    const liveContext = await getUserLiveAIContext(user.id, {
      scope: "personal",
      maxTasks: 25,
      includeTeam: false,
    });
    if (!liveContext) {
      return NextResponse.json({ error: "Could not load user workspace context" }, { status: 500 });
    }

    const { displayName, tasks } = liveContext;

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        briefing: `### Good day, ${displayName}! 👋\n\nYou currently have **no open or pending tasks** assigned to you in Orbitwork. Enjoy your clear queue, or check with your team if new work needs to be picked up!`,
      });
    }

    const prompt = `Create a brief Daily Standup for ${displayName} from these real tasks:
${liveContext.formattedPromptContext}

Sections (under 180 words total):
1. 🎯 **Primary Focus Today**: Top 1-3 priority/due tasks (**Task Name**).
2. ⏳ **Deadlines & Overdue Watch**: Overdue or due within 48h (or note all on track).
3. 🚀 **Quick Wins**: 1-2 smaller next steps.
4. 💡 **Tip**: One short sentence.

Use only real tasks above in bold **Task Name**. No IDs or URLs.`;

    const response = await generateTextWithFallback({
      prompt,
      system: AGENT_SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 420,
    });

    return NextResponse.json({
      success: true,
      briefing: response.text.trim(),
      taskCount: tasks.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[AI Agent Briefing Error]:", err);
    const msg = err instanceof Error ? err.message : "Failed to generate briefing";
    return NextResponse.json(
      { error: msg },
      { status: isAILimitError(err) ? 429 : 500 }
    );
  }
}
