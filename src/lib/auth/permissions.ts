export type BuiltInRole = "owner" | "admin" | "manager" | "member" | "viewer";
export type Scope = "organization" | "workspace" | "project" | "task" | "document";
export type Action = "view" | "create" | "edit" | "delete" | "assign" | "share" | "manage_members" | "manage_settings" | "export" | "manage_permissions";

const roleActions: Record<BuiltInRole, Action[]> = {
  owner: ["view", "create", "edit", "delete", "assign", "share", "manage_members", "manage_settings", "export", "manage_permissions"],
  admin: ["view", "create", "edit", "delete", "assign", "share", "manage_members", "manage_settings", "export", "manage_permissions"],
  manager: ["view", "create", "edit", "assign", "share", "manage_members", "export"],
  member: ["view", "create", "edit", "assign", "share"],
  viewer: ["view", "export"],
};

export function hasPermission(role: BuiltInRole, _scope: Scope, action: Action): boolean {
  return roleActions[role].includes(action);
}

export function isBuiltInRole(value: string): value is BuiltInRole {
  return value in roleActions;
}
