import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DESIGNATIONS,
  normalizeMemberDesignations,
  memberMatchesRole,
  canDelegateRoleAligned,
} from "../designations.ts";

test("DEFAULT_DESIGNATIONS covers Zoho-style executive, management, HR, engineering, and testing roles", () => {
  const names = DEFAULT_DESIGNATIONS.map((d) => d.name);
  assert.ok(names.includes("CEO"), "Must include CEO");
  assert.ok(names.includes("COO"), "Must include COO");
  assert.ok(names.includes("CTO"), "Must include CTO");
  assert.ok(names.includes("HR Director"), "Must include HR Director");
  assert.ok(names.includes("HR Manager"), "Must include HR Manager");
  assert.ok(names.includes("Developer"), "Must include Developer");
  assert.ok(names.includes("Tester"), "Must include Tester");
  assert.ok(names.includes("Support Specialist"), "Must include Support Specialist");
  assert.ok(names.includes("Administrator"), "Must include Administrator");

  // Check tiers
  const ceo = DEFAULT_DESIGNATIONS.find((d) => d.name === "CEO");
  assert.equal(ceo?.hierarchy_level, 1);
  const hrMgr = DEFAULT_DESIGNATIONS.find((d) => d.name === "HR Manager");
  assert.equal(hrMgr?.hierarchy_level, 3);
});

test("normalizeMemberDesignations handles arrays, comma-delimited strings, and multi-designation deduplication", () => {
  // Array input
  assert.deepEqual(
    normalizeMemberDesignations(["Developer", "Lead Developer", "Developer"]),
    ["Developer", "Lead Developer"]
  );

  // Comma-separated string input
  assert.deepEqual(
    normalizeMemberDesignations("Developer, Tester, HR Manager"),
    ["Developer", "Tester", "HR Manager"]
  );

  // Mixed array and fallback profile string
  assert.deepEqual(
    normalizeMemberDesignations(["Developer"], "Project Manager, Developer"),
    ["Developer", "Project Manager"]
  );

  // Empty or null
  assert.deepEqual(normalizeMemberDesignations(null, undefined), []);
  assert.deepEqual(normalizeMemberDesignations([], ""), []);
});

test("memberMatchesRole accurately detects roles and categories", () => {
  const devTester = ["Senior Developer", "QA Tester"];
  assert.ok(memberMatchesRole(devTester, "developer"));
  assert.ok(memberMatchesRole(devTester, "tester"));
  assert.ok(!memberMatchesRole(devTester, "hr"));
  assert.ok(!memberMatchesRole(devTester, "ceo"));

  const hrLeader = ["HR Manager", "People Operations Director"];
  assert.ok(memberMatchesRole(hrLeader, "hr"));
  assert.ok(memberMatchesRole(hrLeader, "manager"));
  assert.ok(!memberMatchesRole(hrLeader, "developer"));

  const exec = ["COO", "Executive Vice President"];
  assert.ok(memberMatchesRole(exec, "coo"));
  assert.ok(memberMatchesRole(exec, "executive"));
});

test("canDelegateRoleAligned enforces role-aligned delegation and management overrides", () => {
  // Developer to Developer -> Allowed
  const devToDev = canDelegateRoleAligned(
    ["Developer"],
    ["Senior Developer"],
    "Fix API endpoint bug"
  );
  assert.equal(devToDev.isAllowed, true);

  // Developer to Tester for bug fix -> Blocked / Warning
  const devToTester = canDelegateRoleAligned(
    ["Developer"],
    ["Tester"],
    "Fix backend auth bug"
  );
  assert.equal(devToTester.isAllowed, false);
  assert.ok(devToTester.reason.includes("requires developer skills"));

  // Tester to Tester for verification task -> Allowed
  const testerToTester = canDelegateRoleAligned(
    ["Tester"],
    ["QA Lead"],
    "Verify regression test suite"
  );
  assert.equal(testerToTester.isAllowed, true);

  // Leadership (CEO/COO/Manager) delegating -> Permitted
  const managerDelegation = canDelegateRoleAligned(
    ["Engineering Manager"],
    ["Developer"],
    "Any task"
  );
  assert.equal(managerDelegation.isAllowed, true);
  assert.ok(managerDelegation.reason.includes("Management delegation"));
});
