import test from "node:test";
import assert from "node:assert/strict";
import {
  computeEasterSunday,
  generateBuiltinPublicHolidays,
} from "../publicHolidays.ts";
import { isCompletedStatusNameOrCategory } from "../email.ts";

test("computeEasterSunday calculates accurate Gregorian Easter dates", () => {
  assert.equal(computeEasterSunday(2025), "2025-04-20");
  assert.equal(computeEasterSunday(2026), "2026-04-05");
  assert.equal(computeEasterSunday(2027), "2027-03-28");
});

test("generateBuiltinPublicHolidays returns national holidays for India and US", () => {
  const india2026 = generateBuiltinPublicHolidays("IN", 2026);
  assert.ok(india2026.some((h) => h.date === "2026-01-26" && h.name === "Republic Day"));
  assert.ok(india2026.some((h) => h.date === "2026-08-15" && h.name === "Independence Day"));
  assert.ok(india2026.some((h) => h.date === "2026-10-02" && h.name === "Gandhi Jayanti"));

  const us2026 = generateBuiltinPublicHolidays("US", 2026);
  assert.ok(us2026.some((h) => h.name === "Independence Day"));
  assert.ok(us2026.some((h) => h.date === "2026-11-26" && h.name === "Thanksgiving Day"));
});

test("isCompletedStatusNameOrCategory detects completion accurately without false positives", () => {
  assert.equal(isCompletedStatusNameOrCategory("completed", "Anything"), true);
  assert.equal(isCompletedStatusNameOrCategory("active", "Completed"), true);
  assert.equal(isCompletedStatusNameOrCategory("backlog", "Done"), true);
  assert.equal(isCompletedStatusNameOrCategory("active", "Finished"), true);
  assert.equal(isCompletedStatusNameOrCategory("active", "In Progress"), false);
  assert.equal(isCompletedStatusNameOrCategory("cancelled", "Done"), false);
  assert.equal(isCompletedStatusNameOrCategory("cancelled", "Cancelled"), false);
});
