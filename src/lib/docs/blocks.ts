// src/lib/docs/blocks.ts
import type { DocBlock } from "./types.ts";

// Helper to convert blocks to markdown
export function blocksToMarkdown(blocks: DocBlock[]): string {
  if (!blocks || !Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading_1":
          return `# ${b.data.text || ""}\n`;
        case "heading_2":
          return `## ${b.data.text || ""}\n`;
        case "heading_3":
          return `### ${b.data.text || ""}\n`;
        case "heading_4":
          return `#### ${b.data.text || ""}\n`;
        case "bullet_list":
          return `- ${b.data.text || ""}`;
        case "numbered_list":
          return `1. ${b.data.text || ""}`;
        case "checklist":
          return `- [${b.data.checked ? "x" : " "}] ${b.data.text || ""}`;
        case "quote":
          return `> ${b.data.text || ""}\n`;
        case "callout":
          return `> **[${(b.data.calloutType || "info").toUpperCase()}]** ${b.data.text || ""}\n`;
        case "code":
          return `\`\`\`${b.data.language || ""}\n${b.data.text || ""}\n\`\`\`\n`;
        case "divider":
          return `---\n`;
        case "image":
          return `![${b.data.caption || "Image"}](${b.data.url || ""})\n`;
        case "table": {
          const rows = b.data.rows || [];
          if (!rows.length) return "";
          const header = `| ${rows[0].join(" | ")} |`;
          const sep = `| ${rows[0].map(() => "---").join(" | ")} |`;
          const body = rows
            .slice(1)
            .map((r) => `| ${r.join(" | ")} |`)
            .join("\n");
          return `${header}\n${sep}\n${body}\n`;
        }
        case "task_reference":
          return `[Task: ${b.data.taskTitle || "Task"}](#task-${b.data.taskId})`;
        case "page_reference":
          return `[Page: ${b.data.pageTitle || "Page"}](#page-${b.data.pageId})`;
        default:
          return `${b.data.text || ""}\n`;
      }
    })
    .join("\n");
}

// Helper to convert plain markdown to block array
export function markdownToBlocks(markdown: string): DocBlock[] {
  if (!markdown || !markdown.trim()) {
    return [{ id: "b-init", type: "paragraph", data: { text: "" } }];
  }

  // Remove legacy metadata comment if present
  const cleaned = markdown.replace(/^<!--\s*doc-meta:\s*(\{[\s\S]*?\})\s*-->\s*/i, "").trim();
  const lines = cleaned.split("\n");
  const blocks: DocBlock[] = [];
  let currentCode: { lang: string; lines: string[] } | null = null;
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (currentCode) {
        blocks.push({
          id: `code-${i}`,
          type: "code",
          data: { language: currentCode.lang, text: currentCode.lines.join("\n") },
        });
        currentCode = null;
      } else {
        const lang = line.trim().slice(3).trim();
        currentCode = { lang, lines: [] };
      }
      continue;
    }

    if (currentCode) {
      currentCode.lines.push(line);
      continue;
    }

    // Markdown Table detection
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const cells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      // Skip separator row like |---|---|
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        continue;
      }
      tableRows.push(cells);
      // Check if next line is not a table row
      const nextLine = lines[i + 1];
      if (!nextLine || !nextLine.trim().startsWith("|")) {
        blocks.push({
          id: `table-${i}`,
          type: "table",
          data: { rows: tableRows },
        });
        tableRows = [];
      }
      continue;
    }

    if (!line.trim()) continue;

    if (line.startsWith("# ")) {
      blocks.push({ id: `h1-${i}`, type: "heading_1", data: { text: line.slice(2).trim() } });
    } else if (line.startsWith("## ")) {
      blocks.push({ id: `h2-${i}`, type: "heading_2", data: { text: line.slice(3).trim() } });
    } else if (line.startsWith("### ")) {
      blocks.push({ id: `h3-${i}`, type: "heading_3", data: { text: line.slice(4).trim() } });
    } else if (line.startsWith("#### ")) {
      blocks.push({ id: `h4-${i}`, type: "heading_4", data: { text: line.slice(5).trim() } });
    } else if (line.startsWith("- [ ] ") || line.startsWith("* [ ] ")) {
      blocks.push({ id: `chk-${i}`, type: "checklist", data: { text: line.slice(6).trim(), checked: false } });
    } else if (line.startsWith("- [x] ") || line.startsWith("* [x] ") || line.startsWith("- [X] ")) {
      blocks.push({ id: `chk-${i}`, type: "checklist", data: { text: line.slice(6).trim(), checked: true } });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ id: `ul-${i}`, type: "bullet_list", data: { text: line.slice(2).trim() } });
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^\d+\.\s/);
      blocks.push({ id: `ol-${i}`, type: "numbered_list", data: { text: line.slice(match![0].length).trim() } });
    } else if (line.startsWith("> ")) {
      const quoteText = line.slice(2).trim();
      if (quoteText.startsWith("**[INFO]**") || quoteText.startsWith("**[TIP]**") || quoteText.startsWith("**[WARNING]**")) {
        const typeMatch = quoteText.match(/^\*\*\[([A-Z]+)\]\*\*\s*/i);
        const type = (typeMatch ? typeMatch[1].toLowerCase() : "info") as any;
        blocks.push({
          id: `callout-${i}`,
          type: "callout",
          data: { calloutType: type, text: quoteText.replace(/^\*\*\[[A-Z]+\]\*\*\s*/i, "") },
        });
      } else {
        blocks.push({ id: `q-${i}`, type: "quote", data: { text: quoteText } });
      }
    } else if (line.trim() === "---" || line.trim() === "***") {
      blocks.push({ id: `hr-${i}`, type: "divider", data: {} });
    } else if (line.match(/^!\[(.*?)\]\((.*?)\)$/)) {
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      blocks.push({ id: `img-${i}`, type: "image", data: { caption: imgMatch?.[1] || "", url: imgMatch?.[2] || "" } });
    } else {
      blocks.push({ id: `p-${i}`, type: "paragraph", data: { text: line } });
    }
  }

  if (blocks.length === 0) {
    blocks.push({ id: "p-empty", type: "paragraph", data: { text: "" } });
  }

  return blocks;
}
