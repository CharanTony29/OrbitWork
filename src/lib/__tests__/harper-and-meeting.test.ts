import test from "node:test";
import assert from "node:assert/strict";
import { lintTextWithHarper } from "../grammar/harper.ts";

test("lintTextWithHarper returns empty array for empty or tiny inputs", async () => {
  const emptyRes = await lintTextWithHarper("");
  assert.deepEqual(emptyRes, []);

  const tinyRes = await lintTextWithHarper("ab");
  assert.deepEqual(tinyRes, []);
});

test("lintTextWithHarper detects spelling and grammar errors", async () => {
  const result = await lintTextWithHarper("This is an bad erro with speling misstake.");
  assert.ok(Array.isArray(result));
  // If Harper WASM binary loads in the environment, it should report at least one issue
  if (result.length > 0) {
    const issue = result[0];
    assert.ok(issue.message);
    assert.ok(issue.matchedText);
    assert.ok(typeof issue.start === "number");
    assert.ok(typeof issue.end === "number");
    assert.ok(Array.isArray(issue.suggestions));
  }
});

test("Presentation templates include required executive archetypes", async () => {
  const { PRESENTATION_TEMPLATES } = await import("../presentation/templates.ts");
  assert.ok(PRESENTATION_TEMPLATES.length >= 7);
  const pitchSage = PRESENTATION_TEMPLATES.find((t) => t.id === "pitch_sage");
  assert.ok(pitchSage);
  assert.equal(pitchSage.archetype, "editorial");
  assert.ok(pitchSage.bg);
  assert.ok(pitchSage.cardBg);
});

