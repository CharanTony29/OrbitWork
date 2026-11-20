export type BuiltInRole = "owner" | "co_owner" | "admin" | "manager" | "member" | "viewer";
export type Scope = "organization" | "workspace" | "project" | "task" | "document";
export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "assign"
  | "share"
  | "manage_members"
  | "manage_settings"
  | "export"
  | "manage_permissions"
  | "comment"
  | "change_status";

/**
 * Strict permission matrix matching Orbitwork specifications:
 *
 * 1. OWNER: Full power on all scopes.
 * 2. CO-OWNER: Full power except direct delete on org, workspace, project requires Owner approval.
 * 3. ADMIN:
 *    - Organization: View, edit settings where permitted. CANNOT create org, CANNOT delete org.
 *    - Workspace: Create, edit, manage settings. CANNOT delete workspace!
 *    - Project: Create, edit, delete, configure.
 *    - Task: Full task access (view, create, edit, delete, assign, comment, change_status).
 *    - Document: Full access.
 * 4. MANAGER:
 *    - Organization: View only. CANNOT create, edit, delete, manage org.
 *    - Workspace: View only. CANNOT create, edit, delete workspace.
 *    - Project: Create, edit, delete, manage project.
 *    - Task: Full task access (view, create, edit, delete, assign, comment, change_status).
 * 5. MEMBER:
 *    - Organization/Workspace/Project: View only. CANNOT create, edit, or delete!
 *    - Task: View, create, edit permitted fields, change_status, comment. CANNOT delete tasks! CANNOT assign/reassign!
 * 6. VIEWER:
 *    - View on accessible scopes + Comment ONLY. CANNOT create, edit, delete, or modify any properties!
 */
export function hasPermission(role: BuiltInRole, scope: Scope, action: Action): boolean {
  if (role === "owner") {
    return true;
  }

  if (role === "viewer") {
    if (action === "view" || action === "export" || action === "comment") {
      return true;
    }
    return false;
  }

  if (role === "co_owner") {
    // Co-Owner has full power except destructive direct deletion on org/workspace/project
    // which requires Owner approval.
    if (action === "delete" && (scope === "organization" || scope === "workspace" || scope === "project")) {
      return false; // Direct delete is disabled; must submit deletion request
    }
    return true;
  }

  if (role === "admin") {
    switch (scope) {
      case "organization":
        if (action === "view" || action === "manage_settings" || action === "manage_members" || action === "export") {
          return true;
        }
        if (action === "edit") return true;
        return false; // CANNOT create org, CANNOT delete org
      case "workspace":
        if (action === "view" || action === "create" || action === "edit" || action === "manage_settings" || action === "manage_members" || action === "export") {
          return true;
        }
        return false; // CANNOT delete workspace!
      case "project":
        return true; // Can create, edit, delete, configure projects
      case "task":
      case "document":
        return true; // Full task/document access
    }
  }

  if (role === "manager") {
    switch (scope) {
      case "organization":
        return action === "view"; // CANNOT create, edit, or delete organization
      case "workspace":
        return action === "view"; // CANNOT create, edit, or delete workspace
      case "project":
        // CAN create, edit, delete projects
        if (action === "view" || action === "create" || action === "edit" || action === "delete" || action === "manage_members" || action === "manage_settings" || action === "export") {
          return true;
        }
        return false;
      case "task":
        // Full task-level access: create, edit, delete, assign, comment, change_status
        return true;
      case "document":
        if (action === "view" || action === "create" || action === "edit" || action === "delete" || action === "export" || action === "share") {
          return true;
        }
        return false;
    }
  }

  if (role === "member") {
    switch (scope) {
      case "organization":
      case "workspace":
      case "project":
        return action === "view"; // CANNOT create, edit, or delete org, workspace, project
      case "task":
        if (action === "view" || action === "create" || action === "edit" || action === "change_status" || action === "comment" || action === "share") {
          return true;
        }
        return false; // CANNOT delete tasks, CANNOT assign/reassign tasks
      case "document":
        if (action === "view" || action === "create" || action === "edit" || action === "comment") {
          return true;
        }
        return false;
    }
  }

  return false;
}

export function isBuiltInRole(value: string): value is BuiltInRole {
  return ["owner", "co_owner", "admin", "manager", "member", "viewer"].includes(value);
}
