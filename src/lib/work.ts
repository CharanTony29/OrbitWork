export function distinctAssigneeIds(primary: string | null, secondary: string | null) {
  return [...new Set([primary, secondary].filter((id): id is string => Boolean(id)))];
}

export function elapsedMinutes(startedAt: string | Date, endedAt: string | Date) {
  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) throw new RangeError("End time must be later than a valid start time");
  return Math.max(1, Math.ceil((ended - started) / 60000));
}

export function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  const text = /^[\t\r=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

// -------------------------------------------------------------
// Estimation Helpers (Minutes, Hours, Days, Weeks, Months)
// Standard workday conversion:
// 1 hour = 60 mins
// 1 day = 8 hours = 480 mins
// 1 week = 5 workdays (40 hours) = 2400 mins
// 1 month = 20 workdays (160 hours) = 9600 mins
// -------------------------------------------------------------

export function parseEstimateToMinutes(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input) : null;
  }
  const str = String(input).trim().toLowerCase();
  if (!str) return null;

  // Plain integer or float without unit -> assume minutes
  if (/^\d+(\.\d+)?$/.test(str)) {
    const val = parseFloat(str);
    return Number.isFinite(val) && val >= 0 ? Math.round(val) : null;
  }

  // Parse multi-unit strings like "1w 2d 3h 30m" or single like "2.5h", "3 days"
  const regex = /([\d.]+)\s*(mo(?:nth(?:s)?)?|mth|w(?:(?:ee)?k(?:s)?)?|d(?:ay(?:s)?)?|h(?:(?:ou)?r(?:s)?)?|m(?:in(?:ute)?(?:s)?)?)/g;
  let totalMinutes = 0;
  let matched = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(str)) !== null) {
    matched = true;
    const num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(num) || num < 0) continue;

    if (unit.startsWith("mo")) {
      totalMinutes += num * 9600;
    } else if (unit.startsWith("w")) {
      totalMinutes += num * 2400;
    } else if (unit.startsWith("d")) {
      totalMinutes += num * 480;
    } else if (unit.startsWith("h")) {
      totalMinutes += num * 60;
    } else if (unit.startsWith("m")) {
      totalMinutes += num;
    }
  }

  return matched ? Math.round(totalMinutes) : null;
}

export function formatEstimate(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "";

  // Exact unit matches
  if (minutes % 9600 === 0) return `${minutes / 9600}mo`;
  if (minutes % 2400 === 0) return `${minutes / 2400}w`;
  if (minutes % 480 === 0) return `${minutes / 480}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;

  // Mixed or fractional units
  if (minutes >= 9600) {
    const mo = Math.floor(minutes / 9600);
    const rem = minutes % 9600;
    if (rem >= 480) {
      return `${mo}mo ${Math.round(rem / 480)}d`;
    }
    const val = (minutes / 9600).toFixed(1);
    return `${val.endsWith(".0") ? val.slice(0, -2) : val}mo`;
  }

  if (minutes >= 2400) {
    const w = Math.floor(minutes / 2400);
    const rem = minutes % 2400;
    if (rem >= 480) {
      return `${w}w ${Math.round(rem / 480)}d`;
    }
    const val = (minutes / 2400).toFixed(1);
    return `${val.endsWith(".0") ? val.slice(0, -2) : val}w`;
  }

  if (minutes >= 480) {
    const d = Math.floor(minutes / 480);
    const rem = minutes % 480;
    if (rem >= 60) {
      return `${d}d ${Math.round(rem / 60)}h`;
    }
    const val = (minutes / 480).toFixed(1);
    return `${val.endsWith(".0") ? val.slice(0, -2) : val}d`;
  }

  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return `${minutes}m`;
}

export function formatEstimateDetailed(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "No estimate";
  return formatEstimate(minutes);
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes === 0) return "0m";
  const abs = Math.abs(minutes);
  const formatted = formatEstimate(abs) || `${abs}m`;
  return minutes < 0 ? `-${formatted}` : formatted;
}

export function formatRemaining(
  estimateMinutes: number | null | undefined,
  billableMinutes: number | null | undefined
): {
  status: "none" | "ok" | "exhausting" | "exceeded";
  diff: number | null;
  label: string;
} {
  if (estimateMinutes == null || estimateMinutes <= 0) {
    return { status: "none", diff: null, label: "—" };
  }
  const billable = billableMinutes ?? 0;
  const diff = estimateMinutes - billable;
  if (diff < 0) {
    const over = Math.abs(diff);
    return { status: "exceeded", diff, label: `+${formatEstimate(over) || `${over}m`} over` };
  }
  if (diff === 0) {
    return { status: "exhausting", diff: 0, label: "0m left" };
  }
  if (diff < 60) {
    return { status: "exhausting", diff, label: `${formatEstimate(diff) || `${diff}m`} left` };
  }
  return { status: "ok", diff, label: `${formatEstimate(diff) || `${diff}m`} left` };
}
