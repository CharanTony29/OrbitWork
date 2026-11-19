import JSZip from "jszip";
import { generateTextWithFallback } from "@/lib/ai/client";

export type DocxCorrectionMode =
  | "grammar_and_clarity"
  | "executive_polish"
  | "technical_precision"
  | "concise_summary";

export interface DocxCorrectionOptions {
  docxBuffer: Uint8Array | ArrayBuffer;
  mode?: DocxCorrectionMode;
  contextTitle?: string;
  generateRedline?: boolean; // If true, highlights revisions
}

export interface DocxCorrectionResult {
  correctedDocxBuffer: Uint8Array;
  originalText: string;
  correctedText: string;
  improvementsSummary: string;
  changesCount: number;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extracts visible text paragraphs from OpenXML word/document.xml
 */
export function extractTextFromDocxXml(documentXml: string): string[] {
  const paragraphs: string[] = [];
  // Match each <w:p> paragraph
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(documentXml)) !== null) {
    const pContent = pMatch[1];
    // Match each <w:t> text run
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    let paragraphText = "";

    while ((tMatch = tRegex.exec(pContent)) !== null) {
      paragraphText += tMatch[1];
    }

    if (paragraphText.trim()) {
      paragraphs.push(paragraphText.trim());
    }
  }

  return paragraphs;
}

/**
 * Corrects and polishes a .docx file using AI while preserving all OpenXML formatting.
 */
export async function correctDocx(
  options: DocxCorrectionOptions
): Promise<DocxCorrectionResult> {
  const zip = await JSZip.loadAsync(options.docxBuffer);
  const documentXmlFile = zip.file("word/document.xml");

  if (!documentXmlFile) {
    throw new Error("Invalid .docx file: missing word/document.xml");
  }

  const originalXml = await documentXmlFile.async("string");
  const paragraphs = extractTextFromDocxXml(originalXml);

  if (paragraphs.length === 0) {
    throw new Error("The uploaded .docx file contains no readable text paragraphs.");
  }

  const rawDocumentText = paragraphs.join("\n\n");
  const mode = options.mode || "grammar_and_clarity";

  const modeInstructions: Record<DocxCorrectionMode, string> = {
    grammar_and_clarity:
      "Correct all grammatical mistakes, punctuation errors, spelling typos, and clumsy phrasing while preserving the original meaning.",
    executive_polish:
      "Rewrite with executive-level corporate polish, confident active tone, leadership vocabulary, and crisp professional syntax.",
    technical_precision:
      "Refine for engineering precision, eliminate ambiguity, standardize terminology, and ensure clear, actionable technical specifications.",
    concise_summary:
      "Tighten the prose, remove fluff and redundant adjectives, and make the text significantly more concise and impactful.",
  };

  const prompt = `You are an elite Document Editor and Professional Proofreader.
Your task is to correct and polish the text from a Microsoft Word document (.docx).

DOCUMENT CONTEXT:
${options.contextTitle ? `Title: ${options.contextTitle}\n` : ""}
Correction Objective: ${modeInstructions[mode]}

ORIGINAL DOCUMENT TEXT:
"""
${rawDocumentText}
"""

INSTRUCTIONS:
1. Provide the fully corrected document text.
2. Maintain the exact paragraph structure of the original so it can be re-mapped into Word paragraphs.
3. At the end, provide a brief bulleted summary of the improvements made under a section header:
=== SUMMARY OF IMPROVEMENTS ===
- [Improvement 1]
- [Improvement 2]

FORMAT YOUR RESPONSE:
[CORRECTED TEXT]
... (the corrected paragraphs, matching original paragraph count) ...
=== SUMMARY OF IMPROVEMENTS ===
- [Brief bulleted summary of key corrections made]`;

  const aiResponse = await generateTextWithFallback({
    prompt,
    temperature: 0.1,
    maxOutputTokens: 3800,
  });

  const fullOutput = aiResponse.text.trim();
  let correctedText = fullOutput;
  let improvementsSummary = "Document corrected for grammar, clarity, and professional tone.";

  if (fullOutput.includes("=== SUMMARY OF IMPROVEMENTS ===")) {
    const parts = fullOutput.split("=== SUMMARY OF IMPROVEMENTS ===");
    correctedText = parts[0].trim();
    improvementsSummary = parts[1].trim();
  }

  const correctedParagraphs = correctedText
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  // Re-inject corrected paragraphs into word/document.xml
  let pIdx = 0;
  const updatedXml = originalXml.replace(
    /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g,
    (fullMatch, openTag, pContent, closeTag) => {
      // Check if this paragraph had visible text
      const hasText = /<w:t\b[^>]*>[\s\S]*?<\/w:t>/.test(pContent);
      if (!hasText) return fullMatch;

      const replacementText = correctedParagraphs[pIdx];
      pIdx++;

      if (!replacementText) return fullMatch;

      // Preserve paragraph properties <w:pPr> if present
      const pPrMatch = pContent.match(/(<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>)/);
      const pPrXml = pPrMatch ? pPrMatch[1] : "";

      // Replace inner content with updated text run
      const safeEscaped = escapeXml(replacementText);
      return `${openTag}${pPrXml}<w:r><w:t xml:space="preserve">${safeEscaped}</w:t></w:r>${closeTag}`;
    }
  );

  zip.file("word/document.xml", updatedXml);

  const correctedBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    correctedDocxBuffer: new Uint8Array(correctedBuffer),
    originalText: rawDocumentText,
    correctedText,
    improvementsSummary,
    changesCount: Math.abs(correctedText.length - rawDocumentText.length) + correctedParagraphs.length,
  };
}
