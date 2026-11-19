import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { extractDocumentText, extractMatchingSnippet } from "../src/lib/ai/rag/document-parser.ts";

test("RAG parser extracts plain text and markdown cleanly", async () => {
  const content = "This is a custom feature developed for task ORBIT-102.\nSecurity and authorization policies.";
  const buffer = Buffer.from(content, "utf8");

  const result = await extractDocumentText(buffer, "notes.txt", "text/plain");
  assert.equal(result.fileType, "text");
  assert.match(result.fullText, /custom feature developed/);
  assert.equal(result.chunks.length, 1);
});

test("RAG parser extracts DOCX contents from word/document.xml", async () => {
  const zip = new JSZip();
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Customization developed for Task 45</w:t></w:r></w:p>
        <w:p><w:r><w:t>Architecture overview and deployment steps.</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
  zip.file("word/document.xml", docXml);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  const result = await extractDocumentText(buffer, "Architecture.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(result.fileType, "docx");
  assert.match(result.fullText, /Customization developed for Task 45/);
  assert.match(result.fullText, /Architecture overview/);
});

test("RAG parser extracts PPTX slides with section markers", async () => {
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Executive Summary</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
    </p:sld>`);
  zip.file("ppt/slides/slide2.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>AI Agent automation metrics</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
    </p:sld>`);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  const result = await extractDocumentText(buffer, "Q3-Review.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(result.fileType, "pptx");
  assert.match(result.fullText, /Executive Summary/);
  assert.match(result.fullText, /AI Agent automation metrics/);
  assert.equal(result.chunks.length, 2);
  assert.equal(result.chunks[0].section, "Slide 1");
  assert.equal(result.chunks[1].section, "Slide 2");
});

test("RAG parser extracts XLSX worksheets and cell content", async () => {
  const wb = XLSX.utils.book_new();
  const wsData = [
    ["Feature", "Status", "Assignee"],
    ["RAG Concept Search", "Delivered", "Engineering"],
    ["Executive Slides", "Done", "Product"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Deliverables");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const result = await extractDocumentText(buffer, "Status.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(result.fileType, "xlsx");
  assert.match(result.fullText, /RAG Concept Search/);
  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].section, "Sheet: Deliverables");
});

test("extractMatchingSnippet centers on search keyword cleanly", () => {
  const text = "Orbitwork provides high performance work management with real-time sync, customizable designations, and RAG document search on attachments.";
  const snippet = extractMatchingSnippet(text, "RAG document search", 60);
  assert.match(snippet, /RAG document search/);
});
