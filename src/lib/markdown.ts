function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inline(value: string) {
  // Support image markdown: data:image (base64), https?:// URLs, or internal /api/attachments/ URLs
  const pattern =
    /(!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+|(?:https?:\/\/|\/api\/attachments\/)[^\s)]+)\)|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|~~([^~]+)~~)/g;
  let output = "";
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    output += escapeHtml(value.slice(cursor, index));
    if (match[1]?.startsWith("![") && match[3]) {
      const cleanSrc = match[3].replace(/\s+/g, "");
      output += `<img src="${escapeHtml(cleanSrc)}" alt="${escapeHtml(
        match[2] ?? "Pasted image"
      )}" class="doc-embedded-img" loading="lazy">`;
    } else if (match[4] && match[5]) {
      // Relative links (starting with /) don't need URL validation
      if (match[5].startsWith("/")) {
        output += `<a href="${escapeHtml(match[5])}">${escapeHtml(match[4])}</a>`;
      } else {
        try {
          const href = new URL(match[5]);
          if (href.protocol === "https:" || href.protocol === "http:") {
            output += `<a href="${escapeHtml(
              href.toString()
            )}" target="_blank" rel="nofollow noopener noreferrer">${escapeHtml(match[4])}</a>`;
          } else {
            output += escapeHtml(match[0]);
          }
        } catch {
          output += escapeHtml(match[0]);
        }
      }
    } else if (match[6]) {
      output += `<strong>${escapeHtml(match[6])}</strong>`;
    } else if (match[7]) {
      output += `<code>${escapeHtml(match[7])}</code>`;
    } else if (match[8] || match[9]) {
      output += `<em>${escapeHtml(match[8] ?? match[9] ?? "")}</em>`;
    } else if (match[10]) {
      output += `<del>${escapeHtml(match[10])}</del>`;
    }
    cursor = index + match[0].length;
  }
  output += escapeHtml(value.slice(cursor));
  return output;
}

export function markdownToSafeHtml(markdown: string) {
  // Strip out doc-meta comment if present at top
  const cleanMarkdown = markdown.replace(/^<!--\s*doc-meta:\s*\{[\s\S]*?\}\s*-->\s*/i, "");

  const lines = cleanMarkdown.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;
  let paragraph: string[] = [];
  let inDetails = false;

  const closeList = () => {
    if (list) output.push(`</${list}>`);
    list = null;
  };

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Single-line or multi-line details / toggle:
    // Pattern 1: <details open><summary>Header</summary> or <details><summary>Header</summary>
    const singleLineDetails = line.match(/^<details(?:\s+open)?\s*>\s*<summary>(.*?)<\/summary>\s*$/i);
    if (singleLineDetails) {
      flushParagraph();
      closeList();
      output.push('<details class="doc-toggle-block" open>');
      output.push(`<summary class="doc-toggle-summary">${inline(singleLineDetails[1])}</summary>`);
      output.push('<div class="doc-toggle-body">');
      inDetails = true;
      continue;
    }

    // Pattern 2: Details / Toggle list start: <details> or :::toggle Header
    const detailsMatch = line.match(/^<details(?:\s+open)?\s*>\s*$/i);
    const summaryMatch = line.match(/^<summary>(.*?)<\/summary>\s*$/i);
    const detailsClose = line.match(/^<\/details>\s*$/i);
    const toggleStart = line.match(/^:::toggle\s+(.+)$/i);
    const toggleEnd = line.match(/^:::\s*$/);

    if (detailsMatch || toggleStart) {
      flushParagraph();
      closeList();
      output.push('<details class="doc-toggle-block" open>');
      inDetails = true;
      if (toggleStart) {
        output.push(`<summary class="doc-toggle-summary">${inline(toggleStart[1])}</summary>`);
        output.push('<div class="doc-toggle-body">');
      }
      continue;
    }

    if (summaryMatch) {
      output.push(`<summary class="doc-toggle-summary">${inline(summaryMatch[1])}</summary>`);
      output.push('<div class="doc-toggle-body">');
      continue;
    }

    if (detailsClose || (inDetails && toggleEnd)) {
      flushParagraph();
      closeList();
      output.push('</div>');
      output.push("</details>");
      inDetails = false;
      continue;
    }

    // Table row: | Col 1 | Col 2 |
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushParagraph();
      closeList();
      const tableLines: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|") && lines[i + 1].trim().endsWith("|")) {
        i++;
        tableLines.push(lines[i]);
      }
      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r
            .trim()
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
        const headerCells = parseRow(tableLines[0]);
        const isSep = tableLines[1].replace(/[\s|:-]/g, "").length === 0;
        const rowStartIdx = isSep ? 2 : 1;

        let tableHtml = '<table class="doc-table"><thead><tr>';
        for (const cell of headerCells) {
          tableHtml += `<th>${inline(cell)}</th>`;
        }
        tableHtml += '</tr></thead><tbody>';

        for (let r = rowStartIdx; r < tableLines.length; r++) {
          const cells = parseRow(tableLines[r]);
          tableHtml += '<tr>';
          for (let c = 0; c < headerCells.length; c++) {
            tableHtml += `<td>${inline(cells[c] ?? "")}</td>`;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
        output.push(tableHtml);
        continue;
      }
    }

    // Callout / Banner: > [!NOTE], > [!TIP], > [!WARNING]
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i);
    if (calloutMatch) {
      flushParagraph();
      closeList();
      const type = calloutMatch[1].toLowerCase();
      const content = calloutMatch[2];
      output.push(
        `<div class="doc-callout-banner callout-${type}"><span class="callout-badge">${calloutMatch[1]}</span>${
          content ? `<span>${inline(content)}</span>` : ""
        }</div>`
      );
      continue;
    }

    // Checklist item: - [ ] or - [x]
    const checklistMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (checklistMatch) {
      flushParagraph();
      if (list !== "ul") {
        closeList();
        output.push('<ul class="doc-checklist">');
        list = "ul";
      }
      const isChecked = checklistMatch[1].toLowerCase() === "x";
      output.push(
        `<li class="doc-checklist-item"><input type="checkbox" ${
          isChecked ? "checked" : ""
        } disabled> <span class="${isChecked ? "checked-text" : ""}">${inline(
          checklistMatch[2]
        )}</span></li>`
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.+)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    if (heading || /^\s*-{3,}\s*$/.test(line) || bullet || numbered || quote) {
      flushParagraph();
    }

    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (/^\s*-{3,}\s*$/.test(line)) {
      closeList();
      output.push("<hr>");
    } else if (bullet || numbered) {
      const tag = bullet ? "ul" : "ol";
      if (list !== tag) {
        closeList();
        output.push(`<${tag}>`);
        list = tag;
      }
      output.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
    } else if (quote) {
      closeList();
      output.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`);
    } else {
      closeList();
      paragraph.push(line);
    }
  }

  flushParagraph();
  closeList();
  if (inDetails) {
    output.push("</div>");
    output.push("</details>");
  }
  return output.join("\n");
}
