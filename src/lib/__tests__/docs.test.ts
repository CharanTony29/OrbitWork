import test from "node:test";
import assert from "node:assert/strict";
import { blocksToMarkdown, markdownToBlocks } from "../docs/blocks.ts";
import { DOC_TEMPLATES } from "../docs/templates.ts";
import type { DocBlock, PageListingNode } from "../docs/types.ts";
import { hasPermission } from "../auth/permissions.ts";
import { markdownToSafeHtml } from "../markdown.ts";

test("blocksToMarkdown converts headings, lists, tables, code, and callouts accurately", () => {
  const blocks: DocBlock[] = [
    { id: "1", type: "heading_1", data: { text: "Architecture Overview" } },
    { id: "2", type: "callout", data: { calloutType: "info", text: "Important system notes" } },
    { id: "3", type: "bullet_list", data: { text: "Item 1" } },
    { id: "4", type: "checklist", data: { text: "Task item", checked: true } },
    { id: "5", type: "code", data: { language: "typescript", text: "const x = 1;" } },
    {
      id: "6",
      type: "table",
      data: {
        rows: [
          ["Header A", "Header B"],
          ["Cell 1", "Cell 2"],
        ],
      },
    },
  ];

  const md = blocksToMarkdown(blocks);

  assert.ok(md.includes("# Architecture Overview"));
  assert.ok(md.includes("> **[INFO]** Important system notes"));
  assert.ok(md.includes("- Item 1"));
  assert.ok(md.includes("- [x] Task item"));
  assert.ok(md.includes("```typescript\nconst x = 1;\n```"));
  assert.ok(md.includes("| Header A | Header B |"));
  assert.ok(md.includes("| Cell 1 | Cell 2 |"));
});

test("markdownToBlocks accurately parses headings, checklists, quotes, and code blocks", () => {
  const markdown = `# Architecture Blueprint

> Important note

- [ ] Write unit tests
- [x] Create database schema
- Bullet item

\`\`\`json
{ "status": "ok" }
\`\`\`
`;

  const blocks = markdownToBlocks(markdown);

  assert.ok(blocks.some((b) => b.type === "heading_1" && b.data.text === "Architecture Blueprint"));
  assert.ok(blocks.some((b) => b.type === "quote" && b.data.text === "Important note"));
  assert.ok(blocks.some((b) => b.type === "checklist" && b.data.text === "Write unit tests" && b.data.checked === false));
  assert.ok(blocks.some((b) => b.type === "checklist" && b.data.text === "Create database schema" && b.data.checked === true));
  assert.ok(blocks.some((b) => b.type === "bullet_list" && b.data.text === "Bullet item"));
  assert.ok(blocks.some((b) => b.type === "code" && b.data.language === "json"));
});

test("DOC_TEMPLATES contains all 12 required templates with structured initial blocks", () => {
  assert.equal(DOC_TEMPLATES.length, 12);

  const ids = DOC_TEMPLATES.map((t) => t.id);
  assert.ok(ids.includes("prd"));
  assert.ok(ids.includes("srs"));
  assert.ok(ids.includes("tech-spec"));
  assert.ok(ids.includes("architecture"));
  assert.ok(ids.includes("api-doc"));
  assert.ok(ids.includes("meeting-notes"));
  assert.ok(ids.includes("project-plan"));
  assert.ok(ids.includes("sop"));
  assert.ok(ids.includes("release-notes"));
  assert.ok(ids.includes("decision-record"));
  assert.ok(ids.includes("design-spec"));
  assert.ok(ids.includes("incident-report"));

  // Check each template has a title, description, category, and initial pages with blocks
  for (const t of DOC_TEMPLATES) {
    assert.ok(t.title && t.title.length > 0);
    assert.ok(t.description && t.description.length > 0);
    assert.ok(t.category && t.category.length > 0);
    assert.ok(t.initialPages.length > 0);
    assert.ok(t.initialPages[0].blocks.length > 0);
  }
});

test("Page listing hierarchy correctly computes nesting and parent-child relations", () => {
  const flatNodes: PageListingNode[] = [
    {
      id: "root-1",
      doc_id: "doc-1",
      parent_page_id: null,
      title: "Root Page 1",
      icon: "📄",
      position: 1000,
      has_children: false,
      children_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_archived: false,
      children: [],
    },
    {
      id: "child-1",
      doc_id: "doc-1",
      parent_page_id: "root-1",
      title: "Child Page 1",
      icon: "📄",
      position: 1000,
      has_children: false,
      children_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_archived: false,
      children: [],
    },
    {
      id: "child-2",
      doc_id: "doc-1",
      parent_page_id: "root-1",
      title: "Child Page 2",
      icon: "📄",
      position: 2000,
      has_children: false,
      children_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_archived: false,
      children: [],
    },
  ];

  // Tree assembly
  const nodeMap = new Map<string, PageListingNode>();
  const rootNodes: PageListingNode[] = [];

  for (const n of flatNodes) {
    nodeMap.set(n.id, { ...n, children: [] });
  }

  for (const n of nodeMap.values()) {
    if (n.parent_page_id && nodeMap.has(n.parent_page_id)) {
      const parent = nodeMap.get(n.parent_page_id)!;
      parent.children!.push(n);
      parent.has_children = true;
      parent.children_count += 1;
    } else {
      rootNodes.push(n);
    }
  }

  assert.equal(rootNodes.length, 1);
  assert.equal(rootNodes[0].id, "root-1");
  assert.equal(rootNodes[0].has_children, true);
  assert.equal(rootNodes[0].children_count, 2);
  assert.equal(rootNodes[0].children![0].id, "child-1");
  assert.equal(rootNodes[0].children![1].id, "child-2");
});

test("Document permissions enforce proper RBAC scopes", () => {
  assert.equal(hasPermission("owner", "document", "edit"), true);
  assert.equal(hasPermission("owner", "document", "delete"), true);
  assert.equal(hasPermission("owner", "document", "manage_permissions"), true);

  assert.equal(hasPermission("member", "document", "edit"), true);
  assert.equal(hasPermission("member", "document", "delete"), false);
  assert.equal(hasPermission("member", "document", "manage_permissions"), false);

  assert.equal(hasPermission("viewer", "document", "view"), true);
  assert.equal(hasPermission("viewer", "document", "edit"), false);
  assert.equal(hasPermission("viewer", "document", "delete"), false);
});

test("Document markdown sanitization prevents XSS and malicious scripts", () => {
  const unsafeInput = "## Safe Title\n<script>alert('xss')</script>\n<img src=x onerror=alert(1)>";
  const safe = markdownToSafeHtml(unsafeInput);

  assert.ok(!safe.includes("<script>"));
  assert.ok(!safe.includes("<script"));
  assert.ok(!safe.includes("<img src=x"));
  assert.ok(safe.includes("&lt;img"));
  assert.ok(safe.includes("Safe Title"));
});
