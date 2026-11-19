import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctDocx, DocxCorrectionMode } from "@/lib/docx-ai";

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

    const contentType = req.headers.get("content-type") || "";

    let docxBuffer: Uint8Array;
    let mode: DocxCorrectionMode = "grammar_and_clarity";
    let contextTitle = "Orbitwork Document";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided in form-data" }, { status: 400 });
      }
      const rawMode = formData.get("mode") as string | null;
      if (rawMode) mode = rawMode as DocxCorrectionMode;
      contextTitle = (formData.get("contextTitle") as string | null) || file.name;
      const arrayBuffer = await file.arrayBuffer();
      docxBuffer = new Uint8Array(arrayBuffer);
    } else {
      const body = await req.json();
      if (!body.base64Data) {
        return NextResponse.json(
          { error: "base64Data required for JSON payload" },
          { status: 400 }
        );
      }
      mode = (body.mode as DocxCorrectionMode) || "grammar_and_clarity";
      contextTitle = body.contextTitle || "Orbitwork Document";
      const binaryString = atob(body.base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      docxBuffer = bytes;
    }

    const result = await correctDocx({
      docxBuffer,
      mode,
      contextTitle,
    });

    // Check if user requested raw binary download or JSON result
    const acceptHeader = req.headers.get("accept") || "";
    if (acceptHeader.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
      return new NextResponse(result.correctedDocxBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="corrected_${contextTitle}.docx"`,
        },
      });
    }

    // Return JSON with base64 buffer and summary
    const base64Corrected = Buffer.from(result.correctedDocxBuffer).toString("base64");

    return NextResponse.json({
      ok: true,
      contextTitle,
      improvementsSummary: result.improvementsSummary,
      changesCount: result.changesCount,
      originalText: result.originalText,
      correctedText: result.correctedText,
      base64Docx: base64Corrected,
    });
  } catch (err: any) {
    console.error("DOCX AI Correction error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process .docx file" },
      { status: 500 }
    );
  }
}
