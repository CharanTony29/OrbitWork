import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, distinctAssigneeIds, elapsedMinutes, parseEstimateToMinutes, formatEstimate, formatMinutes, formatRemaining, parseInviteEmails } from "../src/lib/work.ts";
import { markdownToSafeHtml } from "../src/lib/markdown.ts";

test("assignee slots omit blanks and never duplicate a teammate", () => {
  assert.deepEqual(distinctAssigneeIds(null, null), []);
  assert.deepEqual(distinctAssigneeIds("person-a", null), ["person-a"]);
  assert.deepEqual(distinctAssigneeIds("person-a", "person-b"), ["person-a", "person-b"]);
  assert.deepEqual(distinctAssigneeIds("person-a", "person-a"), ["person-a"]);
});

test("elapsed time rounds partial minutes up and rejects invalid intervals", () => {
  assert.equal(elapsedMinutes("2026-10-30T10:00:00Z", "2026-10-30T10:00:01Z"), 1);
  assert.equal(elapsedMinutes("2026-10-30T10:00:00Z", "2026-10-30T10:01:00Z"), 1);
  assert.equal(elapsedMinutes("2026-10-30T10:00:00Z", "2026-10-30T10:01:01Z"), 2);
  assert.throws(() => elapsedMinutes("invalid", "2026-10-30T10:01:00Z"), RangeError);
  assert.throws(() => elapsedMinutes("2026-10-30T10:01:00Z", "2026-10-30T10:00:00Z"), RangeError);
});

test("CSV cells escape quotes and preserve delimiter-containing values", () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell('says "hello", world'), '"says ""hello"", world"');
  assert.equal(csvCell("=1+1"), "\"'=1+1\"");
});

test("Markdown formatting renders safe blocks while escaping embedded HTML", () => {
  const html = markdownToSafeHtml("# Summary\n\n- **Ready**\n- [Docs](https://example.com/help)\n\n<script>alert(1)</script>");
  assert.match(html, /<h1>Summary<\/h1>/);
  assert.match(html, /<ul>[\s\S]*<strong>Ready<\/strong>/);
  assert.match(html, /rel="nofollow noopener noreferrer"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("Markdown does not create links for non-web protocols", () => {
  assert.equal(markdownToSafeHtml("[launch](javascript:alert(1))"), "<p>[launch](javascript:alert(1))</p>");
});

test("Estimate parser handles minutes, hours, days, weeks, months", () => {
  assert.equal(parseEstimateToMinutes("45"), 45);
  assert.equal(parseEstimateToMinutes("45m"), 45);
  assert.equal(parseEstimateToMinutes("2h"), 120);
  assert.equal(parseEstimateToMinutes("2.5h"), 150);
  assert.equal(parseEstimateToMinutes("1d"), 480);
  assert.equal(parseEstimateToMinutes("2 days"), 960);
  assert.equal(parseEstimateToMinutes("1w"), 2400);
  assert.equal(parseEstimateToMinutes("1 week"), 2400);
  assert.equal(parseEstimateToMinutes("1mo"), 9600);
  assert.equal(parseEstimateToMinutes("1 month"), 9600);
  assert.equal(parseEstimateToMinutes("1h 30m"), 90);
  assert.equal(parseEstimateToMinutes(""), null);
  assert.equal(parseEstimateToMinutes(null), null);
});

test("Estimate formatter converts minutes to human readable units", () => {
  assert.equal(formatEstimate(45), "45m");
  assert.equal(formatEstimate(120), "2h");
  assert.equal(formatEstimate(90), "1h 30m");
  assert.equal(formatEstimate(480), "1d");
  assert.equal(formatEstimate(2400), "1w");
  assert.equal(formatEstimate(9600), "1mo");
  assert.equal(formatEstimate(null), "");
});

test("formatMinutes formats worked duration cleanly", () => {
  assert.equal(formatMinutes(0), "0m");
  assert.equal(formatMinutes(null), "0m");
  assert.equal(formatMinutes(undefined), "0m");
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(120), "2h");
  assert.equal(formatMinutes(90), "1h 30m");
});

test("formatRemaining calculates status and balance accurately", () => {
  // No estimate set
  assert.deepEqual(formatRemaining(null, 60), { status: "none", diff: null, label: "—" });
  assert.deepEqual(formatRemaining(0, 60), { status: "none", diff: null, label: "—" });

  // Healthy (>= 60 mins remaining)
  assert.deepEqual(formatRemaining(180, 60), { status: "ok", diff: 120, label: "2h left" });
  assert.deepEqual(formatRemaining(120, 60), { status: "ok", diff: 60, label: "1h left" });

  // Exhausting (< 60 mins remaining or 0m)
  assert.deepEqual(formatRemaining(120, 75), { status: "exhausting", diff: 45, label: "45m left" });
  assert.deepEqual(formatRemaining(60, 60), { status: "exhausting", diff: 0, label: "0m left" });

  // Exceeded (negative diff / over budget)
  assert.deepEqual(formatRemaining(60, 90), { status: "exceeded", diff: -30, label: "+30m over" });
  assert.deepEqual(formatRemaining(60, 180), { status: "exceeded", diff: -120, label: "+2h over" });
});

test("parseInviteEmails extracts, deduplicates, and validates multiple emails with varied separators", () => {
  assert.deepEqual(parseInviteEmails(null), []);
  assert.deepEqual(parseInviteEmails(""), []);
  assert.deepEqual(parseInviteEmails("   "), []);
  assert.deepEqual(parseInviteEmails("alice@example.com"), ["alice@example.com"]);
  assert.deepEqual(
    parseInviteEmails("alice@example.com, bob@example.com, charlie@example.com"),
    ["alice@example.com", "bob@example.com", "charlie@example.com"]
  );
  assert.deepEqual(
    parseInviteEmails("alice@example.com bob@example.com; charlie@example.com\ndavid@example.com"),
    ["alice@example.com", "bob@example.com", "charlie@example.com", "david@example.com"]
  );
  // Deduplication and case normalization
  assert.deepEqual(
    parseInviteEmails("Alice@Example.com, alice@example.com; ALICE@EXAMPLE.COM"),
    ["alice@example.com"]
  );
  // Filters out invalid tokens
  assert.deepEqual(
    parseInviteEmails("alice@example.com, not-an-email, bob@example.com, foo@bar"),
    ["alice@example.com", "bob@example.com"]
  );
});
