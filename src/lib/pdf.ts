function cleanAscii(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

function pdfText(value: string) {
  return cleanAscii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function markdownToPdf(markdown: string, title: string) {
  const lines = [`# ${title}`, "", ...markdown.replaceAll("\r\n", "\n").split("\n")];
  const rows: Array<{ text: string; size: number; bold: boolean }> = [];
  for (const line of lines) {
    if (/^!\[[^\]]*\]\(data:image\//.test(line)) { rows.push({ text: `[Image: ${line.slice(2, line.indexOf("]"))}]`, size: 9, bold: false }); continue; }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const text = (heading?.[2] ?? line).replace(/^\s*[-*+]\s+/, "• ").replace(/^\s*\d+\.\s+/, "• ").replace(/^>\s?/, "").replace(/\*\*|__|~~|[*_`]/g, "");
    if (!text.trim()) { rows.push({ text: "", size: 9, bold: false }); continue; }
    const size = heading ? heading[1].length === 1 ? 20 : heading[1].length === 2 ? 15 : 12 : 10;
    const max = size > 15 ? 58 : 100;
    for (let index = 0; index < text.length; index += max) rows.push({ text: text.slice(index, index + max), size, bold: Boolean(heading) });
  }
  const pages: typeof rows[] = []; let page: typeof rows = []; let used = 0;
  for (const row of rows) {
    const height = (row.size || 9) + 8;
    if (used + height > 690 && page.length) { pages.push(page); page = []; used = 0; }
    page.push(row); used += height;
  }
  if (page.length) pages.push(page);
  if (!pages.length) pages.push([]);
  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalogId = add(""); const pagesId = add("");
  const regularFontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    let y = 752; const commands: string[] = ["BT"];
    for (const row of page) {
      if (!row.text) { y -= 9; continue; }
      commands.push(`/${row.bold ? "F2" : "F1"} ${row.size} Tf 1 0 0 1 52 ${y} Tm (${pdfText(row.text)}) Tj`);
      y -= row.size + 8;
    }
    commands.push("ET");
    const stream = commands.join("\n");
    const streamId = add(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`));
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n% Orbitwork\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(output).length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(output);
}
