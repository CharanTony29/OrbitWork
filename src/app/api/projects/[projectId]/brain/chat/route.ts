// src/app/api/projects/[projectId]/brain/chat/route.ts
// Scoped AI Chat for Orbitwork Project Brain

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildProjectBrainContext } from "@/lib/brain/context-builder";
import { analyzeDependencies, analyzeWorkload, computeProjectHealth } from "@/lib/brain/analytics";
import { streamProjectBrainChat } from "@/lib/brain/ai-service";
import { isAILimitError } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
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

    // 1. Build Project Brain Context
    const brainData = await buildProjectBrainContext(projectId, user.id);

    if (!brainData || !brainData.projectExists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!brainData.hasAccess) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }

    const { context, formattedLLMContext } = brainData;

    // 2. Compute Deterministic Metrics for Chat
    const deps = analyzeDependencies(context);
    const workload = analyzeWorkload(context);
    const health = computeProjectHealth(context, deps, workload);

    // 3. Stream AI response with failover
    const stream = await streamProjectBrainChat({
      messages: parsed.data.messages,
      formattedLLMContext,
      health,
      deps,
      workload,
    });

    return stream.toTextStreamResponse();
  } catch (err: unknown) {
    console.error("[Project Brain Chat Error]:", err);
    const msg = err instanceof Error ? err.message : "Internal chat error";
    return NextResponse.json(
      { error: msg },
      { status: isAILimitError(err) ? 429 : 500 }
    );
  }
}
