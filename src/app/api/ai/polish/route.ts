import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { polishText, PolishMode } from "@/lib/ai/utilities/polish";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  text: z.string().min(1, "Text cannot be empty").max(25000, "Text exceeds maximum character limit"),
  mode: z
    .enum(["grammar", "professional", "concise", "bullet_points", "expand"])
    .default("grammar"),
  contextTitle: z.string().max(300).optional(),
  target: z.enum(["task", "document", "comment", "general"]).default("task"),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user via Supabase
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate request body
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // 3. Execute AI Polish utility
    const polishedText = await polishText({
      text: parsed.data.text,
      mode: parsed.data.mode as PolishMode,
      contextTitle: parsed.data.contextTitle,
      target: parsed.data.target,
    });

    return NextResponse.json({
      success: true,
      polishedText,
      mode: parsed.data.mode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to polish text";
    console.error("[AI Polish Error]:", err);

    return NextResponse.json(
      {
        error: message.includes("API key")
          ? "Gemini API key is missing or invalid. Check your environment variables."
          : message,
      },
      { status: 500 }
    );
  }
}
