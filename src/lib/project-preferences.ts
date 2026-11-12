export const DEFAULT_PROJECT_TAB_ORDER = [
  "list",
  "board",
  "calendar",
  "gantt",
  "workload",
  "whiteboard",
  "flowchart",
  "channel",
  "goals",
] as const;

export type ProjectTabKey = (typeof DEFAULT_PROJECT_TAB_ORDER)[number];

export const PROJECT_TAB_LABELS: Record<ProjectTabKey, string> = {
  list: "List",
  board: "Board",
  calendar: "Calendar",
  gantt: "Timeline",
  workload: "Workload",
  whiteboard: "Whiteboard",
  flowchart: "Flowchart",
  channel: "Channel",
  goals: "Goals",
};

export const BASE_TABLE_COLUMN_ORDER = [
  "name",
  "assignee",
  "due_date",
  "priority",
  "status",
  "created_by",
  "estimate",
  "worked",
  "remaining",
  "docs",
  "comments",
] as const;

export type BaseTableColumnKey = (typeof BASE_TABLE_COLUMN_ORDER)[number];

export const BASE_TABLE_COLUMN_LABELS: Record<BaseTableColumnKey, string> = {
  name: "Task",
  assignee: "Assignees",
  due_date: "Due date",
  priority: "Priority",
  status: "Status",
  created_by: "Created by",
  estimate: "Estimate",
  worked: "Worked (Billable)",
  remaining: "Remaining",
  docs: "Linked Docs",
  comments: "Comments",
};

export const PROJECT_TAB_COOKIE = "orbitwork_tab_order";
export const TABLE_COL_COOKIE = "orbitwork_col_order";

export function parsePreferenceArrayCookie(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }
}

export function normalizeTabOrder(input: unknown): ProjectTabKey[] {
  const validSet = new Set<string>(DEFAULT_PROJECT_TAB_ORDER);
  const result: ProjectTabKey[] = [];
  const seen = new Set<string>();

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string" && validSet.has(item) && !seen.has(item)) {
        seen.add(item);
        result.push(item as ProjectTabKey);
      }
    }
  }

  for (const key of DEFAULT_PROJECT_TAB_ORDER) {
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  return result;
}

export function buildDefaultColumnOrder(customFieldIds: string[]): string[] {
  const result: string[] = [];
  for (const key of BASE_TABLE_COLUMN_ORDER) {
    if (key === "comments") {
      for (const fid of customFieldIds) {
        result.push(`cf:${fid}`);
      }
    }
    result.push(key);
  }
  return result;
}

export function normalizeColumnOrder(
  input: unknown,
  customFieldIds: string[]
): string[] {
  const defaults = buildDefaultColumnOrder(customFieldIds);
  const validSet = new Set<string>(defaults);
  const result: string[] = [];
  const seen = new Set<string>();

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string" && validSet.has(item) && !seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }

  for (const key of defaults) {
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  return result;
}
