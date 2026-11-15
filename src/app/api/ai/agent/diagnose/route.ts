import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateTextWithFallback } from "@/lib/ai/client.ts";
import { AGENT_SYSTEM_PROMPT } from "@/lib/ai/agent/index.ts";

export const dynamic = "force-dynamic";

const diagnoseSchema = z.object({
  taskTitle: z.string().min(1).max(300),
  taskDescription: z.string().max(8000).optional(),
  projectTitle: z.string().max(200).optional(),
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
    const parsed = diagnoseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid diagnose payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { taskTitle, taskDescription, projectTitle } = parsed.data;

    const prompt = `
You are an expert technical lead and software architect AI Agent.
A team member needs ideas, technical diagnosis, and a resolution strategy for this task.

Task Title: "${taskTitle}"
${projectTitle ? `Project: "${projectTitle}"` : ""}
${taskDescription ? `Task Description / Context:\n"""\n${taskDescription.slice(0, 2000)}\n"""` : ""}

Generate a clear, professional technical breakdown formatted in markdown:
1. 🔍 **Problem Understanding & Scope**: Clarify what this task actually involves and why it matters.
2. 🛠️ **Step-by-Step Resolution Plan**: Practical, logical steps to implement or resolve this.
3. 🧪 **Verification & Acceptance Criteria**: Bullet list of checks to confirm it works correctly.
4. ⚠️ **Potential Edge Cases & Gotchas**: Things that could go wrong or common oversights to avoid.

Be concise, practical, and direct. Use markdown formatting with bolding and bullet lists.
`.trim();

    const response = await generateTextWithFallback({
      prompt,
      system: AGENT_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    return NextResponse.json({
      success: true,
      analysis: response.text.trim(),
    });
  } catch (err: unknown) {
    console.error("[AI Agent Diagnose Error]:", err);
    const msg = err instanceof Error ? err.message : "Failed to analyze task";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
