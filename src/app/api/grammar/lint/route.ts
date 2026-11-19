import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { lintTextWithHarper } from "@/lib/grammar/harper";

export const dynamic = "force-dynamic";

const lintRequestSchema = z.object({
  text: z.string().max(100000, "Text must be 100,000 characters or fewer"),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = lintRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid text payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { text } = parsed.data;
    const issues = await lintTextWithHarper(text);

    return NextResponse.json({
      success: true,
      issuesCount: issues.length,
      issues,
    });
  } catch (err) {
    console.error("[Harper API Lint Error]:", err);
    return NextResponse.json(
      { error: "Failed to lint text with Harper" },
      { status: 500 }
    );
  }
}
