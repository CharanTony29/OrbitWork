import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "../auth/permissions.ts";

test("Table 8: Project Permissions Matrix", () => {
  // Owner: create, edit, delete
  assert.equal(hasPermission("owner", "project", "create"), true);
  assert.equal(hasPermission("owner", "project", "edit"), true);
  assert.equal(hasPermission("owner", "project", "delete"), true);

  // Co-Owner: create, edit (delete is false for direct delete because it requires owner approval workflow)
  assert.equal(hasPermission("co_owner", "project", "create"), true);
  assert.equal(hasPermission("co_owner", "project", "edit"), true);
  assert.equal(hasPermission("co_owner", "project", "delete"), false);

  // Admin: create, edit, delete
  assert.equal(hasPermission("admin", "project", "create"), true);
  assert.equal(hasPermission("admin", "project", "edit"), true);
  assert.equal(hasPermission("admin", "project", "delete"), true);

  // Manager: create, edit, delete
  assert.equal(hasPermission("manager", "project", "create"), true);
  assert.equal(hasPermission("manager", "project", "edit"), true);
  assert.equal(hasPermission("manager", "project", "delete"), true);

  // Member: NO, NO, NO
  assert.equal(hasPermission("member", "project", "create"), false);
  assert.equal(hasPermission("member", "project", "edit"), false);
  assert.equal(hasPermission("member", "project", "delete"), false);

  // Viewer: NO, NO, NO (view only)
  assert.equal(hasPermission("viewer", "project", "create"), false);
  assert.equal(hasPermission("viewer", "project", "edit"), false);
  assert.equal(hasPermission("viewer", "project", "delete"), false);
  assert.equal(hasPermission("viewer", "project", "view"), true);
});

test("Table 9: Workspace Permissions Matrix", () => {
  // Owner: create, edit, delete
  assert.equal(hasPermission("owner", "workspace", "create"), true);
  assert.equal(hasPermission("owner", "workspace", "edit"), true);
  assert.equal(hasPermission("owner", "workspace", "delete"), true);

  // Co-Owner: create, edit (delete requires owner approval)
  assert.equal(hasPermission("co_owner", "workspace", "create"), true);
  assert.equal(hasPermission("co_owner", "workspace", "edit"), true);
  assert.equal(hasPermission("co_owner", "workspace", "delete"), false);

  // Admin: create, edit, delete = NO!
  assert.equal(hasPermission("admin", "workspace", "create"), true);
  assert.equal(hasPermission("admin", "workspace", "edit"), true);
  assert.equal(hasPermission("admin", "workspace", "delete"), false);

  // Manager: NO, NO, NO
  assert.equal(hasPermission("manager", "workspace", "create"), false);
  assert.equal(hasPermission("manager", "workspace", "edit"), false);
  assert.equal(hasPermission("manager", "workspace", "delete"), false);

  // Member: NO, NO, NO
  assert.equal(hasPermission("member", "workspace", "create"), false);
  assert.equal(hasPermission("member", "workspace", "edit"), false);
  assert.equal(hasPermission("member", "workspace", "delete"), false);

  // Viewer: NO, NO, NO
  assert.equal(hasPermission("viewer", "workspace", "create"), false);
  assert.equal(hasPermission("viewer", "workspace", "edit"), false);
  assert.equal(hasPermission("viewer", "workspace", "delete"), false);
  assert.equal(hasPermission("viewer", "workspace", "view"), true);
});

test("Table 10: Organization Permissions Matrix", () => {
  // Owner: create, edit, delete
  assert.equal(hasPermission("owner", "organization", "create"), true);
  assert.equal(hasPermission("owner", "organization", "edit"), true);
  assert.equal(hasPermission("owner", "organization", "delete"), true);

  // Co-Owner: create, edit, delete (delete requires owner approval)
  assert.equal(hasPermission("co_owner", "organization", "create"), true);
  assert.equal(hasPermission("co_owner", "organization", "edit"), true);
  assert.equal(hasPermission("co_owner", "organization", "delete"), false);

  // Admin: NO create, edit where permitted, NO delete
  assert.equal(hasPermission("admin", "organization", "create"), false);
  assert.equal(hasPermission("admin", "organization", "edit"), true);
  assert.equal(hasPermission("admin", "organization", "delete"), false);

  // Manager: NO, NO, NO
  assert.equal(hasPermission("manager", "organization", "create"), false);
  assert.equal(hasPermission("manager", "organization", "edit"), false);
  assert.equal(hasPermission("manager", "organization", "delete"), false);

  // Member: NO, NO, NO
  assert.equal(hasPermission("member", "organization", "create"), false);
  assert.equal(hasPermission("member", "organization", "edit"), false);
  assert.equal(hasPermission("member", "organization", "delete"), false);

  // Viewer: NO, NO, NO
  assert.equal(hasPermission("viewer", "organization", "create"), false);
  assert.equal(hasPermission("viewer", "organization", "edit"), false);
  assert.equal(hasPermission("viewer", "organization", "delete"), false);
});

test("Table 11: Task Permissions Matrix", () => {
  // Owner: Full task permissions
  assert.equal(hasPermission("owner", "task", "view"), true);
  assert.equal(hasPermission("owner", "task", "create"), true);
  assert.equal(hasPermission("owner", "task", "edit"), true);
  assert.equal(hasPermission("owner", "task", "delete"), true);
  assert.equal(hasPermission("owner", "task", "assign"), true);
  assert.equal(hasPermission("owner", "task", "change_status"), true);
  assert.equal(hasPermission("owner", "task", "comment"), true);

  // Co-Owner: Full task permissions
  assert.equal(hasPermission("co_owner", "task", "view"), true);
  assert.equal(hasPermission("co_owner", "task", "create"), true);
  assert.equal(hasPermission("co_owner", "task", "edit"), true);
  assert.equal(hasPermission("co_owner", "task", "delete"), true);
  assert.equal(hasPermission("co_owner", "task", "assign"), true);
  assert.equal(hasPermission("co_owner", "task", "change_status"), true);
  assert.equal(hasPermission("co_owner", "task", "comment"), true);

  // Admin: Full task permissions
  assert.equal(hasPermission("admin", "task", "view"), true);
  assert.equal(hasPermission("admin", "task", "create"), true);
  assert.equal(hasPermission("admin", "task", "edit"), true);
  assert.equal(hasPermission("admin", "task", "delete"), true);
  assert.equal(hasPermission("admin", "task", "assign"), true);
  assert.equal(hasPermission("admin", "task", "change_status"), true);
  assert.equal(hasPermission("admin", "task", "comment"), true);

  // Manager: Full task permissions (including DELETE and ASSIGN)
  assert.equal(hasPermission("manager", "task", "view"), true);
  assert.equal(hasPermission("manager", "task", "create"), true);
  assert.equal(hasPermission("manager", "task", "edit"), true);
  assert.equal(hasPermission("manager", "task", "delete"), true);
  assert.equal(hasPermission("manager", "task", "assign"), true);
  assert.equal(hasPermission("manager", "task", "change_status"), true);
  assert.equal(hasPermission("manager", "task", "comment"), true);

  // Member: Partial task access (CAN edit permitted, CAN change status, CAN comment)
  // CANNOT DELETE TASKS, CANNOT ASSIGN/REASSIGN TASKS
  assert.equal(hasPermission("member", "task", "view"), true);
  assert.equal(hasPermission("member", "task", "create"), true);
  assert.equal(hasPermission("member", "task", "edit"), true);
  assert.equal(hasPermission("member", "task", "delete"), false);
  assert.equal(hasPermission("member", "task", "assign"), false);
  assert.equal(hasPermission("member", "task", "change_status"), true);
  assert.equal(hasPermission("member", "task", "comment"), true);

  // Viewer: Read + Comment ONLY
  assert.equal(hasPermission("viewer", "task", "view"), true);
  assert.equal(hasPermission("viewer", "task", "create"), false);
  assert.equal(hasPermission("viewer", "task", "edit"), false);
  assert.equal(hasPermission("viewer", "task", "delete"), false);
  assert.equal(hasPermission("viewer", "task", "assign"), false);
  assert.equal(hasPermission("viewer", "task", "change_status"), false);
  assert.equal(hasPermission("viewer", "task", "comment"), true);
});
