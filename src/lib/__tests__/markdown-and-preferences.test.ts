import test from "node:test";
import assert from "node:assert/strict";
import {
  markdownToSafeHtml,
  parseMarkdownImageAltAndWidth,
} from "../markdown.ts";
import {
  buildDefaultColumnOrder,
  DEFAULT_PROJECT_TAB_ORDER,
  normalizeColumnOrder,
  normalizeTabOrder,
  parsePreferenceArrayCookie,
} from "../project-preferences.ts";

test("parseMarkdownImageAltAndWidth parses explicit widths and clamps bounds", () => {
  assert.deepEqual(parseMarkdownImageAltAndWidth("screenshot.png|w=360"), {
    alt: "screenshot.png",
    widthPx: 360,
  });

  assert.deepEqual(parseMarkdownImageAltAndWidth("tiny.png|w=10"), {
    alt: "tiny.png",
    widthPx: 48,
  });

  assert.deepEqual(parseMarkdownImageAltAndWidth("huge.png|w=5000"), {
    alt: "huge.png",
    widthPx: 1200,
  });

  assert.deepEqual(parseMarkdownImageAltAndWidth("plain.png"), {
    alt: "plain.png",
    widthPx: null,
  });
});

test("markdownToSafeHtml renders inline resized images safely and strips scripts", () => {
  const html = markdownToSafeHtml(
    "Hello ![wireframe|w=420](/api/attachments/abc) <script>alert(1)</script>"
  );
  assert.ok(html.includes('src="/api/attachments/abc"'));
  assert.ok(html.includes('alt="wireframe"'));
  assert.ok(html.includes('data-width="420"'));
  assert.ok(html.includes("style=\"width:420px;max-width:100%;height:auto\""));
  assert.ok(!html.includes("<script>"));
});

test("normalizeTabOrder puts custom tabs first and fills missing tabs", () => {
  const custom = normalizeTabOrder(["channel", "flowchart", "unknown_tab"]);
  assert.equal(custom[0], "channel");
  assert.equal(custom[1], "flowchart");
  assert.equal(custom.length, DEFAULT_PROJECT_TAB_ORDER.length);
  assert.ok(!custom.includes("unknown_tab" as never));
});

test("normalizeColumnOrder keeps user-defined column order and includes new custom fields", () => {
  const defaults = buildDefaultColumnOrder(["cf1", "cf2"]);
  assert.ok(defaults.includes("cf:cf1"));
  assert.ok(defaults.includes("cf:cf2"));

  const reordered = normalizeColumnOrder(
    ["status", "priority", "cf:cf1", "name", "stale_removed"],
    ["cf1", "cf3"]
  );
  assert.deepEqual(reordered.slice(0, 4), ["status", "priority", "cf:cf1", "name"]);
  assert.ok(reordered.includes("cf:cf3"));
  assert.ok(!reordered.includes("cf:cf2"));
  assert.ok(!reordered.includes("stale_removed"));
});

test("parsePreferenceArrayCookie parses encoded JSON string arrays safely", () => {
  const encoded = encodeURIComponent(JSON.stringify(["board", "channel", "list"]));
  assert.deepEqual(parsePreferenceArrayCookie(encoded), ["board", "channel", "list"]);
  assert.deepEqual(parsePreferenceArrayCookie("not-json"), []);
});
