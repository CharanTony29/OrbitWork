import * as XLSX from "xlsx";

export type TimesheetEntryExport = {
  id: string;
  user_id: string;
  userName: string;
  userEmail: string;
  projectName: string;
  taskKey: string;
  taskTitle: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  description: string;
  billable: boolean;
};

export type TimesheetExportScope = {
  type: "workspace" | "project" | "organization";
  name: string;
  dateRangeLabel: string;
  startDate: string;
  endDate: string;
};

/**
 * Builds an Excel Workbook (.xlsx) with:
 * 1. "Summary" sheet listing all team members, total logged hours, billable hours, and task count.
 * 2. Dedicated sheets per user with itemized log entries and totals.
 */
export function generateTimesheetWorkbook(
  scope: TimesheetExportScope,
  entries: TimesheetEntryExport[]
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // --- 1. Summary Sheet ---
  const userMap = new Map<
    string,
    {
      name: string;
      email: string;
      totalMinutes: number;
      billableMinutes: number;
      entriesCount: number;
      entries: TimesheetEntryExport[];
    }
  >();

  for (const entry of entries) {
    if (!userMap.has(entry.user_id)) {
      userMap.set(entry.user_id, {
        name: entry.userName || "Team Member",
        email: entry.userEmail || "",
        totalMinutes: 0,
        billableMinutes: 0,
        entriesCount: 0,
        entries: [],
      });
    }
    const u = userMap.get(entry.user_id)!;
    u.totalMinutes += entry.durationMinutes || 0;
    if (entry.billable) {
      u.billableMinutes += entry.durationMinutes || 0;
    }
    u.entriesCount += 1;
    u.entries.push(entry);
  }

  const totalAllMinutes = entries.reduce((acc, e) => acc + (e.durationMinutes || 0), 0);
  const totalBillableMinutes = entries.filter((e) => e.billable).reduce((acc, e) => acc + (e.durationMinutes || 0), 0);

  const summaryData: (string | number)[][] = [
    ["ORBITWORK TIMESHEET REPORT"],
    ["Scope", `${scope.type.toUpperCase()}: ${scope.name}`],
    ["Period", scope.dateRangeLabel],
    ["Date Range", `${scope.startDate} to ${scope.endDate}`],
    ["Generated At", new Date().toISOString().replace("T", " ").slice(0, 19)],
    [],
    ["HIGH-LEVEL METRICS"],
    ["Total Team Members", userMap.size],
    ["Total Logged Hours", Number((totalAllMinutes / 60).toFixed(2))],
    ["Total Billable Hours", Number((totalBillableMinutes / 60).toFixed(2))],
    ["Non-Billable Hours", Number(((totalAllMinutes - totalBillableMinutes) / 60).toFixed(2))],
    ["Total Time Entries", entries.length],
    [],
    ["TEAM SUMMARY BY MEMBER"],
    ["Team Member", "Email", "Total Hours", "Billable Hours", "Non-Billable Hours", "Entries Count", "Sheet Name"],
  ];

  const sheetNameCounts = new Map<string, number>();

  function sanitizeSheetName(rawName: string): string {
    let clean = rawName.replace(/[:\\/?*\[\]]/g, "_").trim();
    if (!clean) clean = "Member";
    if (clean.length > 25) clean = clean.slice(0, 25);
    const count = sheetNameCounts.get(clean) || 0;
    sheetNameCounts.set(clean, count + 1);
    return count === 0 ? clean : `${clean.slice(0, 22)}_${count}`;
  }

  const userSheetsInfo: Array<{
    user: ReturnType<typeof userMap.get>;
    sheetName: string;
  }> = [];

  for (const [, userData] of userMap) {
    const sheetName = sanitizeSheetName(userData.name);
    userSheetsInfo.push({ user: userData, sheetName });

    summaryData.push([
      userData.name,
      userData.email,
      Number((userData.totalMinutes / 60).toFixed(2)),
      Number((userData.billableMinutes / 60).toFixed(2)),
      Number(((userData.totalMinutes - userData.billableMinutes) / 60).toFixed(2)),
      userData.entriesCount,
      sheetName,
    ]);
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs["!cols"] = [
    { wch: 25 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Overview Summary");

  // --- 2. Per-User Sheets ---
  for (const { user, sheetName } of userSheetsInfo) {
    if (!user) continue;

    const userRows: (string | number)[][] = [
      [`Timesheet: ${user.name}`],
      ["Email", user.email],
      ["Period", scope.dateRangeLabel],
      ["Date Range", `${scope.startDate} to ${scope.endDate}`],
      ["Total Logged Hours", Number((user.totalMinutes / 60).toFixed(2))],
      ["Billable Hours", Number((user.billableMinutes / 60).toFixed(2))],
      [],
      [
        "Date",
        "Project",
        "Task Key",
        "Task Title",
        "Description / Notes",
        "Duration (Hrs)",
        "Duration (Mins)",
        "Billable",
        "Start Time",
        "End Time",
      ],
    ];

    // Sort user's entries by date ascending
    const sorted = [...user.entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

    for (const e of sorted) {
      const datePart = e.startedAt ? e.startedAt.slice(0, 10) : "";
      const startTime = e.startedAt ? e.startedAt.replace("T", " ").slice(0, 19) : "";
      const endTime = e.endedAt ? e.endedAt.replace("T", " ").slice(0, 19) : "";
      const hours = Number(((e.durationMinutes || 0) / 60).toFixed(2));

      userRows.push([
        datePart,
        e.projectName || "General",
        e.taskKey || "—",
        e.taskTitle || "—",
        e.description || "",
        hours,
        e.durationMinutes || 0,
        e.billable ? "Yes" : "No",
        startTime,
        endTime,
      ]);
    }

    userRows.push([]);
    userRows.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      Number((user.totalMinutes / 60).toFixed(2)),
      user.totalMinutes,
      "",
      "",
      "",
    ]);

    const userWs = XLSX.utils.aoa_to_sheet(userRows);
    userWs["!cols"] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 14 },
      { wch: 28 },
      { wch: 35 },
      { wch: 14 },
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, userWs, sheetName);
  }

  // Generate binary output buffer
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}
