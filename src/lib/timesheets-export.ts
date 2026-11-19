import JSZip from "jszip";

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

type ExcelCell = {
  value?: string | number;
  formula?: string;
  styleId?: number;
};

type ExcelRow = {
  height?: number;
  cells: ExcelCell[];
};

type ExcelSheetDef = {
  name: string;
  cols: number[];
  rows: ExcelRow[];
  merges?: string[];
};

function escapeXml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colName(index: number): string {
  let name = "";
  let temp = index;
  while (temp >= 0) {
    name = String.fromCharCode((temp % 26) + 65) + name;
    temp = Math.floor(temp / 26) - 1;
  }
  return name;
}

/**
 * Builds a styled, executive-grade OpenXML (.xlsx) workbook using JSZip.
 * Features:
 * - Executive Dark Slate Navy headers (#1E293B) with bold white text (#FFFFFF)
 * - Thin slate borders (#CBD5E1) on all cells
 * - Zebra row striping (#F8FAFC)
 * - Formatted status badges (green #DCFCE7 for Billable, amber #FEF3C7 for Non-Billable)
 * - Numeric right alignment with decimals (0.00)
 * - KPI Metric summary cards
 * - Accounting double-underlined grand totals
 */
function buildOpenXmlWorkbook(sheets: ExcelSheetDef[]): JSZip {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`;

  sheets.forEach((_, idx) => {
    contentTypesXml += `\n  <Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  });
  contentTypesXml += `\n</Types>`;
  zip.file("[Content_Types].xml", contentTypesXml);

  // 2. _rels/.rels
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  // 3. xl/styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="0.00"/>
  </numFmts>
  <fonts count="8">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Segoe UI"/></font> <!-- 0: Normal Dark Slate -->
    <font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font> <!-- 1: Header Bold White -->
    <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Segoe UI"/></font> <!-- 2: Subheader / Bold Label -->
    <font><b/><sz val="15"/><color rgb="FF0F172A"/><name val="Segoe UI"/></font> <!-- 3: Sheet Title -->
    <font><b/><sz val="16"/><color rgb="FF2563EB"/><name val="Segoe UI"/></font> <!-- 4: KPI Large Number -->
    <font><b/><sz val="9.5"/><color rgb="FF166534"/><name val="Segoe UI"/></font> <!-- 5: Pill Green Text -->
    <font><b/><sz val="9.5"/><color rgb="FF92400E"/><name val="Segoe UI"/></font> <!-- 6: Pill Amber Text -->
    <font><sz val="9"/><color rgb="FF64748B"/><name val="Segoe UI"/></font> <!-- 7: Small Muted Label -->
  </fonts>
  <fills count="9">
    <fill><patternFill patternType="none"/></fill> <!-- 0: None -->
    <fill><patternFill patternType="gray125"/></fill> <!-- 1: Gray125 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill> <!-- 2: Dark Navy Header #1E293B -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill> <!-- 3: Zebra Banding #F8FAFC -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill> <!-- 4: Pill Green #DCFCE7 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill> <!-- 5: Pill Amber #FEF3C7 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill> <!-- 6: KPI Card Fill #F1F5F9 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill> <!-- 7: Total Row Fill #E2E8F0 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/></patternFill></fill> <!-- 8: Brand Blue #2563EB -->
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border> <!-- 0: None -->
    <border> <!-- 1: Thin light gray border #CBD5E1 -->
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
    <border> <!-- 2: Accounting Grand Total border (top thin, bottom double) -->
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FF94A3B8"/></top>
      <bottom style="double"><color rgb="FF0F172A"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/> <!-- 0: Plain default -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf> <!-- 1: Dark Navy Header (centered) -->
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf> <!-- 2: Zebra text cell -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf> <!-- 3: White text cell -->
    <xf numFmtId="2" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf> <!-- 4: Zebra numeric right -->
    <xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf> <!-- 5: White numeric right -->
    <xf numFmtId="0" fontId="2" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf> <!-- 6: Total row bold label -->
    <xf numFmtId="2" fontId="2" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf> <!-- 7: Total row numeric right bold -->
    <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf> <!-- 8: Pill Green Status -->
    <xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf> <!-- 9: Pill Amber Status -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf> <!-- 10: Title Font -->
    <xf numFmtId="0" fontId="7" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf> <!-- 11: KPI Card Title -->
    <xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf> <!-- 12: KPI Metric Value -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf> <!-- 13: Dark Navy Header (left-aligned) -->
  </cellXfs>
</styleSheet>`;
  zip.file("xl/styles.xml", stylesXml);

  // 4. xl/workbook.xml & xl/_rels/workbook.xml.rels
  let workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>`;
  let workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;

  sheets.forEach((sheet, idx) => {
    const rId = `rIdSheet${idx + 1}`;
    workbookXml += `\n    <sheet name="${escapeXml(sheet.name)}" sheetId="${idx + 1}" r:id="${rId}"/>`;
    workbookRelsXml += `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`;
  });
  workbookXml += `\n  </sheets>\n</workbook>`;
  workbookRelsXml += `\n</Relationships>`;

  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", workbookRelsXml);

  // 5. Individual worksheets
  sheets.forEach((sheet, sheetIdx) => {
    let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;

    if (sheet.cols && sheet.cols.length > 0) {
      sheetXml += `\n  <cols>`;
      sheet.cols.forEach((width, cIdx) => {
        sheetXml += `\n    <col min="${cIdx + 1}" max="${cIdx + 1}" width="${width}" customWidth="1"/>`;
      });
      sheetXml += `\n  </cols>`;
    }

    sheetXml += `\n  <sheetData>`;

    sheet.rows.forEach((row, rIdx) => {
      const rowNum = rIdx + 1;
      const rowHeightAttr = row.height ? ` ht="${row.height}" customHeight="1"` : "";
      sheetXml += `\n    <row r="${rowNum}"${rowHeightAttr}>`;

      row.cells.forEach((cell, cIdx) => {
        if (!cell || (cell.value === undefined && cell.formula === undefined)) return;
        const cellRef = `${colName(cIdx)}${rowNum}`;
        const styleAttr = cell.styleId !== undefined ? ` s="${cell.styleId}"` : "";

        if (cell.formula) {
          sheetXml += `\n      <c r="${cellRef}"${styleAttr}><f>${escapeXml(cell.formula)}</f></c>`;
        } else if (typeof cell.value === "number") {
          sheetXml += `\n      <c r="${cellRef}"${styleAttr}><v>${cell.value}</v></c>`;
        } else {
          sheetXml += `\n      <c r="${cellRef}"${styleAttr} t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
        }
      });

      sheetXml += `\n    </row>`;
    });

    sheetXml += `\n  </sheetData>`;

    if (sheet.merges && sheet.merges.length > 0) {
      sheetXml += `\n  <mergeCells count="${sheet.merges.length}">`;
      sheet.merges.forEach((m) => {
        sheetXml += `\n    <mergeCell ref="${m}"/>`;
      });
      sheetXml += `\n  </mergeCells>`;
    }

    sheetXml += `\n</worksheet>`;
    zip.file(`xl/worksheets/sheet${sheetIdx + 1}.xml`, sheetXml);
  });

  return zip;
}

/**
 * Builds an executive-grade Excel Workbook (.xlsx) with:
 * 1. "Executive Summary" sheet: KPI metric cards, high-level deliverables, styled member breakdown.
 * 2. Dedicated sheets per team member with itemized entries, badge styling, and accounting totals.
 */
export async function generateTimesheetWorkbook(
  scope: TimesheetExportScope,
  entries: TimesheetEntryExport[]
): Promise<Uint8Array> {
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
  const totalBillableMinutes = entries
    .filter((e) => e.billable)
    .reduce((acc, e) => acc + (e.durationMinutes || 0), 0);
  const totalHours = Number((totalAllMinutes / 60).toFixed(2));
  const billableHours = Number((totalBillableMinutes / 60).toFixed(2));
  const nonBillableHours = Number(((totalAllMinutes - totalBillableMinutes) / 60).toFixed(2));
  const billableRate = totalAllMinutes > 0 ? Math.round((totalBillableMinutes / totalAllMinutes) * 100) : 0;

  const sheets: ExcelSheetDef[] = [];
  const sheetNameCounts = new Map<string, number>();

  function sanitizeSheetName(rawName: string): string {
    let clean = rawName.replace(/[:\\/?*\[\]]/g, "_").trim();
    if (!clean) clean = "Member";
    if (clean.length > 25) clean = clean.slice(0, 25);
    const count = sheetNameCounts.get(clean) || 0;
    sheetNameCounts.set(clean, count + 1);
    return count === 0 ? clean : `${clean.slice(0, 22)}_${count}`;
  }

  // --- SHEET 1: Executive Overview Summary ---
  const summaryRows: ExcelRow[] = [];

  // Row 1: Title
  summaryRows.push({
    height: 32,
    cells: [{ value: "ORBITWORK EXECUTIVE TIMESHEET REPORT", styleId: 10 }],
  });

  // Row 2: Subtitle / Scope details
  summaryRows.push({
    height: 18,
    cells: [
      {
        value: `Scope: ${scope.type.toUpperCase()} • ${scope.name}   |   Period: ${scope.dateRangeLabel} (${scope.startDate} to ${scope.endDate})`,
        styleId: 0,
      },
    ],
  });

  // Row 3: Generated timestamp
  summaryRows.push({
    height: 16,
    cells: [
      {
        value: `Exported at: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
        styleId: 0,
      },
    ],
  });

  // Row 4: Spacer
  summaryRows.push({ height: 10, cells: [] });

  // Rows 5-6: 4 KPI Cards (Total Hours, Billable Hours, Non-Billable, Active Members)
  summaryRows.push({
    height: 20,
    cells: [
      { value: "TOTAL LOGGED HOURS", styleId: 11 },
      { value: "BILLABLE HOURS", styleId: 11 },
      { value: "BILLABLE UTILIZATION", styleId: 11 },
      { value: "TOTAL LOG ENTRIES", styleId: 11 },
      { value: "TEAM MEMBERS", styleId: 11 },
    ],
  });
  summaryRows.push({
    height: 34,
    cells: [
      { value: `${totalHours} hrs`, styleId: 12 },
      { value: `${billableHours} hrs`, styleId: 12 },
      { value: `${billableRate}%`, styleId: 12 },
      { value: `${entries.length} items`, styleId: 12 },
      { value: `${userMap.size} users`, styleId: 12 },
    ],
  });

  // Row 7: Spacer
  summaryRows.push({ height: 16, cells: [] });

  // Row 8: Section Title
  summaryRows.push({
    height: 22,
    cells: [{ value: "TEAM MEMBER UTILIZATION BREAKDOWN", styleId: 10 }],
  });

  // Row 9: Table Header (Navy #1E293B, Bold White #FFFFFF)
  summaryRows.push({
    height: 28,
    cells: [
      { value: "Team Member", styleId: 13 },
      { value: "Email Address", styleId: 13 },
      { value: "Total Hours", styleId: 1 },
      { value: "Billable Hours", styleId: 1 },
      { value: "Non-Billable", styleId: 1 },
      { value: "Utilization", styleId: 1 },
      { value: "Entries Count", styleId: 1 },
      { value: "Member Sheet", styleId: 1 },
    ],
  });

  const userSheetsInfo: Array<{
    user: NonNullable<ReturnType<typeof userMap.get>>;
    sheetName: string;
  }> = [];

  let rowIndex = 0;
  for (const [, userData] of userMap) {
    const sheetName = sanitizeSheetName(userData.name);
    userSheetsInfo.push({ user: userData, sheetName });

    const isZebra = rowIndex % 2 === 1;
    const textStyle = isZebra ? 2 : 3;
    const numStyle = isZebra ? 4 : 5;
    const uTotal = Number((userData.totalMinutes / 60).toFixed(2));
    const uBillable = Number((userData.billableMinutes / 60).toFixed(2));
    const uNonBillable = Number(((userData.totalMinutes - userData.billableMinutes) / 60).toFixed(2));
    const uRate = userData.totalMinutes > 0 ? `${Math.round((userData.billableMinutes / userData.totalMinutes) * 100)}%` : "0%";

    summaryRows.push({
      height: 22,
      cells: [
        { value: userData.name, styleId: textStyle },
        { value: userData.email, styleId: textStyle },
        { value: uTotal, styleId: numStyle },
        { value: uBillable, styleId: numStyle },
        { value: uNonBillable, styleId: numStyle },
        { value: uRate, styleId: isZebra ? 8 : 8 },
        { value: userData.entriesCount, styleId: numStyle },
        { value: sheetName, styleId: textStyle },
      ],
    });
    rowIndex++;
  }

  // Grand Total Row with accounting borders
  summaryRows.push({
    height: 26,
    cells: [
      { value: "TOTAL", styleId: 6 },
      { value: "", styleId: 6 },
      { value: totalHours, styleId: 7 },
      { value: billableHours, styleId: 7 },
      { value: nonBillableHours, styleId: 7 },
      { value: `${billableRate}%`, styleId: 7 },
      { value: entries.length, styleId: 7 },
      { value: "", styleId: 6 },
    ],
  });

  sheets.push({
    name: "Executive Overview",
    cols: [26, 32, 16, 16, 16, 15, 15, 22],
    rows: summaryRows,
    merges: ["A1:H1", "A2:H2", "A3:H3"],
  });

  // --- SHEET 2+: Dedicated Per-User Itemized Sheets ---
  for (const { user, sheetName } of userSheetsInfo) {
    const userRows: ExcelRow[] = [];
    const userTotalHours = Number((user.totalMinutes / 60).toFixed(2));
    const userBillableHours = Number((user.billableMinutes / 60).toFixed(2));
    const userNonBillable = Number(((user.totalMinutes - user.billableMinutes) / 60).toFixed(2));
    const userRate = user.totalMinutes > 0 ? Math.round((user.billableMinutes / user.totalMinutes) * 100) : 0;

    // Title & Info
    userRows.push({
      height: 30,
      cells: [{ value: `ITEMIZED TIMESHEET: ${user.name.toUpperCase()}`, styleId: 10 }],
    });
    userRows.push({
      height: 18,
      cells: [
        {
          value: `Email: ${user.email}   |   Period: ${scope.dateRangeLabel} (${scope.startDate} to ${scope.endDate})`,
          styleId: 0,
        },
      ],
    });
    userRows.push({ height: 10, cells: [] });

    // Mini KPI Cards for user
    userRows.push({
      height: 20,
      cells: [
        { value: "TOTAL HOURS", styleId: 11 },
        { value: "BILLABLE HOURS", styleId: 11 },
        { value: "NON-BILLABLE", styleId: 11 },
        { value: "BILLABLE RATE", styleId: 11 },
        { value: "LOGGED ENTRIES", styleId: 11 },
      ],
    });
    userRows.push({
      height: 32,
      cells: [
        { value: `${userTotalHours} hrs`, styleId: 12 },
        { value: `${userBillableHours} hrs`, styleId: 12 },
        { value: `${userNonBillable} hrs`, styleId: 12 },
        { value: `${userRate}%`, styleId: 12 },
        { value: `${user.entriesCount} logs`, styleId: 12 },
      ],
    });
    userRows.push({ height: 14, cells: [] });

    // Itemized Table Header (Navy #1E293B)
    userRows.push({
      height: 28,
      cells: [
        { value: "Date", styleId: 1 },
        { value: "Project", styleId: 13 },
        { value: "Task Key", styleId: 1 },
        { value: "Task Title", styleId: 13 },
        { value: "Description / Work Notes", styleId: 13 },
        { value: "Duration (Hrs)", styleId: 1 },
        { value: "Minutes", styleId: 1 },
        { value: "Billable", styleId: 1 },
        { value: "Start Time", styleId: 1 },
        { value: "End Time", styleId: 1 },
      ],
    });

    const sorted = [...user.entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

    let uRowIdx = 0;
    for (const e of sorted) {
      const isZebra = uRowIdx % 2 === 1;
      const textStyle = isZebra ? 2 : 3;
      const numStyle = isZebra ? 4 : 5;
      const pillStyle = e.billable ? 8 : 9;

      const datePart = e.startedAt ? e.startedAt.slice(0, 10) : "";
      const startTime = e.startedAt ? e.startedAt.replace("T", " ").slice(0, 19) : "";
      const endTime = e.endedAt ? e.endedAt.replace("T", " ").slice(0, 19) : "";
      const hours = Number(((e.durationMinutes || 0) / 60).toFixed(2));

      userRows.push({
        height: 22,
        cells: [
          { value: datePart, styleId: textStyle },
          { value: e.projectName || "General", styleId: textStyle },
          { value: e.taskKey || "—", styleId: textStyle },
          { value: e.taskTitle || "—", styleId: textStyle },
          { value: e.description || "", styleId: textStyle },
          { value: hours, styleId: numStyle },
          { value: e.durationMinutes || 0, styleId: numStyle },
          { value: e.billable ? "Billable" : "Non-Billable", styleId: pillStyle },
          { value: startTime, styleId: textStyle },
          { value: endTime, styleId: textStyle },
        ],
      });
      uRowIdx++;
    }

    // Grand total row for member
    userRows.push({
      height: 26,
      cells: [
        { value: "TOTAL", styleId: 6 },
        { value: "", styleId: 6 },
        { value: "", styleId: 6 },
        { value: "", styleId: 6 },
        { value: "", styleId: 6 },
        { value: userTotalHours, styleId: 7 },
        { value: user.totalMinutes, styleId: 7 },
        { value: "", styleId: 6 },
        { value: "", styleId: 6 },
        { value: "", styleId: 6 },
      ],
    });

    sheets.push({
      name: sheetName,
      cols: [14, 22, 14, 28, 38, 16, 14, 15, 20, 20],
      rows: userRows,
      merges: ["A1:J1", "A2:J2"],
    });
  }

  const zip = buildOpenXmlWorkbook(sheets);
  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new Uint8Array(outBuffer);
}
