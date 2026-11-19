import JSZip from "jszip";
import * as XLSX from "xlsx";

export type DocumentChunk = {
  section: string;
  text: string;
  index: number;
};

export type ExtractedDocumentContent = {
  fullText: string;
  chunks: DocumentChunk[];
  fileType: "pptx" | "docx" | "pdf" | "xlsx" | "text" | "unknown";
  title?: string;
};

/**
 * Strips XML and HTML tags cleanly, replacing paragraph/block breaks with newlines.
 */
function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:p[^>]*>/gi, "\n")
    .replace(/<a:p[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/**
 * Extracts plain text from PPTX files using slide and notes XML streams.
 */
async function parsePptx(buffer: Buffer): Promise<ExtractedDocumentContent> {
  const zip = await JSZip.loadAsync(buffer);
  const chunks: DocumentChunk[] = [];
  const fullTextParts: string[] = [];

  // Find all slide files in ppt/slides/
  const slideFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/i.test(name)
  );

  // Sort slides in natural numerical order (slide1, slide2, slide10...)
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, "") || "0", 10);
    const numB = parseInt(b.replace(/[^0-9]/g, "") || "0", 10);
    return numA - numB;
  });

  for (let idx = 0; idx < slideFiles.length; idx++) {
    const fileName = slideFiles[idx];
    const file = zip.file(fileName);
    if (!file) continue;

    const xml = await file.async("text");
    const rawMatches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
    const textPieces = rawMatches
      .map((tag) => tag.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);

    const slideText = textPieces.join(" ").replace(/\s+/g, " ").trim();
    if (slideText) {
      const sectionName = `Slide ${idx + 1}`;
      chunks.push({
        section: sectionName,
        text: slideText,
        index: idx,
      });
      fullTextParts.push(`[${sectionName}] ${slideText}`);
    }
  }

  // Also extract speaker notes if available in ppt/notesSlides/
  const notesFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name)
  );
  for (const nName of notesFiles) {
    const nFile = zip.file(nName);
    if (!nFile) continue;
    const xml = await nFile.async("text");
    const textPieces = (xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [])
      .map((tag) => tag.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
    const notesText = textPieces.join(" ").trim();
    if (notesText && notesText.length > 5) {
      const noteNum = nName.replace(/[^0-9]/g, "");
      chunks.push({
        section: `Slide ${noteNum} Notes`,
        text: notesText,
        index: chunks.length,
      });
      fullTextParts.push(`[Slide ${noteNum} Notes] ${notesText}`);
    }
  }

  return {
    fullText: fullTextParts.join("\n\n"),
    chunks,
    fileType: "pptx",
  };
}

/**
 * Extracts plain text from DOCX files using word/document.xml.
 */
async function parseDocx(buffer: Buffer): Promise<ExtractedDocumentContent> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Invalid DOCX format: word/document.xml not found.");
  }

  const xml = await docFile.async("text");
  const cleaned = stripXmlTags(xml);

  // Chunk by paragraphs or sections (~200 words per chunk)
  const paragraphs = cleaned.split("\n").filter((p) => p.trim().length > 0);
  const chunks: DocumentChunk[] = [];
  let currentChunk: string[] = [];
  let currentWords = 0;
  let chunkIdx = 0;

  for (const p of paragraphs) {
    const words = p.split(/\s+/).length;
    currentChunk.push(p);
    currentWords += words;

    if (currentWords >= 150) {
      const chunkText = currentChunk.join("\n");
      chunks.push({
        section: `Section ${chunkIdx + 1}`,
        text: chunkText,
        index: chunkIdx,
      });
      chunkIdx++;
      currentChunk = [];
      currentWords = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      section: `Section ${chunkIdx + 1}`,
      text: currentChunk.join("\n"),
      index: chunkIdx,
    });
  }

  return {
    fullText: cleaned,
    chunks: chunks.length > 0 ? chunks : [{ section: "Document", text: cleaned, index: 0 }],
    fileType: "docx",
  };
}

/**
 * Extracts structured sheet and tabular text from XLSX files.
 */
async function parseXlsx(buffer: Buffer): Promise<ExtractedDocumentContent> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const chunks: DocumentChunk[] = [];
  const fullTextParts: string[] = [];

  for (let idx = 0; idx < wb.SheetNames.length; idx++) {
    const sheetName = wb.SheetNames[idx];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to CSV style lines for clean reading
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const cleanCsv = csv.trim();

    if (cleanCsv) {
      const sectionName = `Sheet: ${sheetName}`;
      chunks.push({
        section: sectionName,
        text: cleanCsv,
        index: idx,
      });
      fullTextParts.push(`[${sectionName}]\n${cleanCsv}`);
    }
  }

  return {
    fullText: fullTextParts.join("\n\n"),
    chunks,
    fileType: "xlsx",
  };
}

/**
 * Extracts plain text from PDF documents via pdf-parse.
 */
async function parsePdf(buffer: Buffer): Promise<ExtractedDocumentContent> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy().catch(() => undefined);

  const fullText = (textResult.text || "").trim();
  const chunks: DocumentChunk[] = [];

  // Parse page boundaries if available
  const rawPages = textResult.pages || [];
  if (rawPages.length > 0) {
    rawPages.forEach((page: any, idx: number) => {
      const pageText = (page.text || "").trim();
      if (pageText) {
        chunks.push({
          section: `Page ${idx + 1}`,
          text: pageText,
          index: idx,
        });
      }
    });
  }

  if (chunks.length === 0 && fullText) {
    chunks.push({
      section: "Document",
      text: fullText,
      index: 0,
    });
  }

  return {
    fullText,
    chunks,
    fileType: "pdf",
  };
}

/**
 * Universal extractor entry point. Automatically detects document type
 * from filename or MIME type and extracts clean text and structured chunks.
 */
export async function extractDocumentText(
  buffer: Buffer,
  fileName: string,
  mimeType: string = ""
): Promise<ExtractedDocumentContent> {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  try {
    // 1. PPTX
    if (
      lowerName.endsWith(".pptx") ||
      lowerName.endsWith(".ppt") ||
      lowerMime.includes("presentationml") ||
      lowerMime.includes("powerpoint")
    ) {
      return await parsePptx(buffer);
    }

    // 2. DOCX
    if (
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".doc") ||
      lowerMime.includes("wordprocessingml")
    ) {
      return await parseDocx(buffer);
    }

    // 3. XLSX
    if (
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls") ||
      lowerMime.includes("spreadsheetml") ||
      lowerMime.includes("ms-excel")
    ) {
      return await parseXlsx(buffer);
    }

    // 4. PDF
    if (lowerName.endsWith(".pdf") || lowerMime.includes("pdf")) {
      return await parsePdf(buffer);
    }

    // 5. Plain text, markdown, CSV, JSON
    if (
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      lowerName.endsWith(".csv") ||
      lowerName.endsWith(".json") ||
      lowerName.endsWith(".log") ||
      lowerMime.includes("text/") ||
      lowerMime.includes("json")
    ) {
      const rawText = buffer.toString("utf-8").trim();
      return {
        fullText: rawText,
        chunks: [{ section: "Content", text: rawText, index: 0 }],
        fileType: "text",
      };
    }

    return {
      fullText: "",
      chunks: [],
      fileType: "unknown",
    };
  } catch (err) {
    console.warn(`[DocumentParser] Failed to extract text from "${fileName}":`, err);
    return {
      fullText: "",
      chunks: [],
      fileType: "unknown",
    };
  }
}

/**
 * Extracts a contextual snippet (e.g. ~140 chars) around the matching query keyword.
 */
export function extractMatchingSnippet(text: string, query: string, maxLength: number = 160): string {
  if (!text) return "";
  const cleanText = text.replace(/\s+/g, " ").trim();
  const lowerText = cleanText.toLowerCase();

  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  let matchIndex = -1;
  let matchWordLen = query.length;

  // Try matching full query first
  matchIndex = lowerText.indexOf(query.toLowerCase());

  // Otherwise match the longest keyword
  if (matchIndex === -1 && words.length > 0) {
    const sortedWords = [...words].sort((a, b) => b.length - a.length);
    for (const w of sortedWords) {
      const idx = lowerText.indexOf(w);
      if (idx !== -1) {
        matchIndex = idx;
        matchWordLen = w.length;
        break;
      }
    }
  }

  if (matchIndex === -1) {
    return cleanText.length > maxLength
      ? cleanText.slice(0, maxLength).trim() + "…"
      : cleanText;
  }

  const half = Math.floor((maxLength - matchWordLen) / 2);
  const start = Math.max(0, matchIndex - half);
  const end = Math.min(cleanText.length, matchIndex + matchWordLen + half);

  let snippet = cleanText.slice(start, end).trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < cleanText.length) snippet = snippet + "…";
  return snippet;
}
