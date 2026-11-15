import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client.ts";
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

    // Fetch real live task data
    const liveContext = await getUserLiveAIContext(user.id);
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

    const prompt = `
You are the Orbitwork Executive Project Agent.
Generate a concise, highly structured Daily Standup & Action Briefing for ${displayName}.

Analyze the following REAL tasks assigned to them:
${liveContext.formattedPromptContext}

Structure your response with these exact sections:
1. 🎯 **Primary Focus Today**: 1 to 3 highest priority or due-today tasks they should tackle first (using the clean Task Name in bold: **Task Name**).
2. ⏳ **Deadlines & Overdue Watch**: Clearly highlight any overdue tasks or tasks due in the next 48 hours. If none are overdue, mention that everything is on track!
3. 🚀 **Quick Wins & Next Steps**: 1 or 2 smaller tasks to knock out for immediate momentum.
4. 💡 **Productivity Tip**: A single punchy sentence on execution strategy for today.

Rules:
- Base this strictly on the real tasks provided above. NEVER invent fake task names.
- Mention tasks ONLY by their clean Task Name in bold (**Task Name**). NEVER output raw task IDs, keys, or UUID URLs.
- Keep it concise, motivational, and easy to scan in 30 seconds.
`.trim();

    const response = await generateTextWithFallback({
      prompt,
      system: AGENT_SYSTEM_PROMPT,
      temperature: 0.3,
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
