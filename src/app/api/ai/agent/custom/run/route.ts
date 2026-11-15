import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeCustomAgent, type CustomAIAgent } from "@/lib/ai/agent/custom-agents.ts";

export const dynamic = "force-dynamic";

const runSchema = z.object({
  agentId: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid execution payload" }, { status: 400 });
    }

    const { agentId, taskId, projectId } = parsed.data;

    // Fetch the agent
    const { data: agent, error: agentErr } = await supabase
      .from("custom_ai_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentErr || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await executeCustomAgent({
      agent: agent as CustomAIAgent,
      taskId,
      projectId,
      userId: user.id,
    });

    return NextResponse.json({ success: true, summary: result.summary });
  } catch (err: unknown) {
    console.error("[Custom Agent Run Error]:", err);
    const msg = err instanceof Error ? err.message : "Agent run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
