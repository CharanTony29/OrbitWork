import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { planSubtasksWithAgent } from "@/lib/ai/agent/planner.ts";

export const dynamic = "force-dynamic";

const planSchema = z.object({
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
    const parsed = planSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid plan request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const plan = await planSubtasksWithAgent(parsed.data);
    return NextResponse.json({ success: true, plan });
  } catch (err: unknown) {
    console.error("[AI Agent Plan Error]:", err);
    const msg = err instanceof Error ? err.message : "Agent planning failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
