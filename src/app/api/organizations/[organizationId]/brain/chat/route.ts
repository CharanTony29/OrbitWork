// src/app/api/organizations/[organizationId]/brain/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildOrganizationBrain } from "@/lib/brain/portfolio-brain";
import { streamPortfolioBrainChat } from "@/lib/brain/ai-service";

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
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await params;
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

    const portfolioData = await buildOrganizationBrain(organizationId, user.id);

    const stream = await streamPortfolioBrainChat({
      messages: parsed.data.messages,
      portfolioData,
    });

    return stream.toTextStreamResponse();
  } catch (err: unknown) {
    console.error("Organization Brain Chat error:", err);
    return NextResponse.json(
      { error: (err as any)?.message || "Chat failed" },
      { status: 500 }
    );
  }
}
