export type PublicHolidayCountry = {
  code: string;
  name: string;
};

export type PublicHolidayEntry = {
  date: string; // YYYY-MM-DD
  name: string;
  location: string;
};

export const SUPPORTED_HOLIDAY_COUNTRIES: PublicHolidayCountry[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "PL", name: "Poland" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" },
];

export function getCountryNameByCode(code: string): string {
  return (
    SUPPORTED_HOLIDAY_COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ??
    code.toUpperCase()
  );
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoDate(year: number, month1To12: number, day: number): string {
  return `${year}-${String(month1To12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcDate(dt);
}

/**
 * Meeus/Jones/Butcher Gregorian algorithm for Easter Sunday (YYYY-MM-DD).
 */
export function computeEasterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

function nthWeekdayOfMonth(
  year: number,
  month1To12: number,
  weekday0Sun: number,
  nth: number
): string {
  const first = new Date(Date.UTC(year, month1To12 - 1, 1));
  const diff = (weekday0Sun - first.getUTCDay() + 7) % 7;
  const day = 1 + diff + (nth - 1) * 7;
  return isoDate(year, month1To12, day);
}

function lastWeekdayOfMonth(
  year: number,
  month1To12: number,
  weekday0Sun: number
): string {
  const last = new Date(Date.UTC(year, month1To12, 0));
  const diff = (last.getUTCDay() - weekday0Sun + 7) % 7;
  last.setUTCDate(last.getUTCDate() - diff);
  return formatUtcDate(last);
}

function observedWeekendToWeekday(dateStr: string): string {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const day = dt.getUTCDay();
  if (day === 6) return addDays(dateStr, -1); // Saturday -> Friday
  if (day === 0) return addDays(dateStr, 1); // Sunday -> Monday
  return dateStr;
}

const INDIA_LUNISOLAR_MAJOR: Record<
  number,
  { name: string; date: string }[]
> = {
  2025: [
    { name: "Maha Shivaratri", date: "2025-02-26" },
    { name: "Holi", date: "2025-03-14" },
    { name: "Id-ul-Fitr", date: "2025-03-31" },
    { name: "Buddha Purnima", date: "2025-05-12" },
    { name: "Id-ul-Zuha (Bakrid)", date: "2025-06-07" },
    { name: "Muharram", date: "2025-07-06" },
    { name: "Janmashtami", date: "2025-08-16" },
    { name: "Dussehra", date: "2025-10-02" },
    { name: "Diwali / Deepavali", date: "2025-10-20" },
    { name: "Guru Nanak Jayanti", date: "2025-11-05" },
  ],
  2026: [
    { name: "Maha Shivaratri", date: "2026-02-15" },
    { name: "Holi", date: "2026-03-04" },
    { name: "Id-ul-Fitr", date: "2026-03-21" },
    { name: "Ram Navami", date: "2026-03-26" },
    { name: "Mahavir Jayanti", date: "2026-03-31" },
    { name: "Buddha Purnima", date: "2026-05-01" },
    { name: "Id-ul-Zuha (Bakrid)", date: "2026-05-27" },
    { name: "Muharram", date: "2026-06-26" },
    { name: "Janmashtami", date: "2026-09-04" },
    { name: "Dussehra", date: "2026-10-20" },
    { name: "Diwali / Deepavali", date: "2026-11-08" },
    { name: "Guru Nanak Jayanti", date: "2026-11-24" },
  ],
  2027: [
    { name: "Maha Shivaratri", date: "2027-03-06" },
    { name: "Id-ul-Fitr", date: "2027-03-10" },
    { name: "Holi", date: "2027-03-22" },
    { name: "Id-ul-Zuha (Bakrid)", date: "2027-05-17" },
    { name: "Buddha Purnima", date: "2027-05-20" },
    { name: "Janmashtami", date: "2027-08-25" },
    { name: "Dussehra", date: "2027-10-09" },
    { name: "Diwali / Deepavali", date: "2027-10-29" },
    { name: "Guru Nanak Jayanti", date: "2027-11-14" },
  ],
};

/**
 * Deterministic built-in public holiday calendar fallback used when external
 * holiday APIs don't cover a country (e.g., India, UAE) or are unreachable.
 */
export function generateBuiltinPublicHolidays(
  countryCode: string,
  year: number
): PublicHolidayEntry[] {
  const code = countryCode.toUpperCase();
  const countryName = getCountryNameByCode(code);
  const easter = computeEasterSunday(year);
  const goodFriday = addDays(easter, -2);
  const easterMonday = addDays(easter, 1);

  const build = (items: { date: string; name: string }[]) =>
    items
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        date: item.date,
        name: item.name,
        location: countryName,
      }));

  if (code === "IN") {
    return build([
      { date: isoDate(year, 1, 1), name: "New Year's Day" },
      { date: isoDate(year, 1, 14), name: "Makar Sankranti / Pongal" },
      { date: isoDate(year, 1, 26), name: "Republic Day" },
      { date: goodFriday, name: "Good Friday" },
      { date: isoDate(year, 5, 1), name: "May Day / Labour Day" },
      { date: isoDate(year, 8, 15), name: "Independence Day" },
      { date: isoDate(year, 10, 2), name: "Gandhi Jayanti" },
      { date: isoDate(year, 12, 25), name: "Christmas Day" },
      ...(INDIA_LUNISOLAR_MAJOR[year] ?? []),
    ]);
  }

  if (code === "US") {
    return build([
      { date: observedWeekendToWeekday(isoDate(year, 1, 1)), name: "New Year's Day" },
      { date: nthWeekdayOfMonth(year, 1, 1, 3), name: "Martin Luther King Jr. Day" },
      { date: nthWeekdayOfMonth(year, 2, 1, 3), name: "Presidents' Day" },
      { date: lastWeekdayOfMonth(year, 5, 1), name: "Memorial Day" },
      { date: observedWeekendToWeekday(isoDate(year, 6, 19)), name: "Juneteenth National Independence Day" },
      { date: observedWeekendToWeekday(isoDate(year, 7, 4)), name: "Independence Day" },
      { date: nthWeekdayOfMonth(year, 9, 1, 1), name: "Labor Day" },
      { date: nthWeekdayOfMonth(year, 10, 1, 2), name: "Columbus / Indigenous Peoples' Day" },
      { date: observedWeekendToWeekday(isoDate(year, 11, 11)), name: "Veterans Day" },
      { date: nthWeekdayOfMonth(year, 11, 4, 4), name: "Thanksgiving Day" },
      { date: observedWeekendToWeekday(isoDate(year, 12, 25)), name: "Christmas Day" },
    ]);
  }

  if (code === "GB") {
    return build([
      { date: isoDate(year, 1, 1), name: "New Year's Day" },
      { date: goodFriday, name: "Good Friday" },
      { date: easterMonday, name: "Easter Monday" },
      { date: nthWeekdayOfMonth(year, 5, 1, 1), name: "Early May Bank Holiday" },
      { date: lastWeekdayOfMonth(year, 5, 1), name: "Spring Bank Holiday" },
      { date: lastWeekdayOfMonth(year, 8, 1), name: "Summer Bank Holiday" },
      { date: isoDate(year, 12, 25), name: "Christmas Day" },
      { date: isoDate(year, 12, 26), name: "Boxing Day" },
    ]);
  }

  if (code === "CA") {
    const may25 = new Date(Date.UTC(year, 4, 25));
    const vicOffset = (may25.getUTCDay() - 1 + 7) % 7 || 7;
    may25.setUTCDate(25 - vicOffset);
    return build([
      { date: isoDate(year, 1, 1), name: "New Year's Day" },
      { date: goodFriday, name: "Good Friday" },
      { date: formatUtcDate(may25), name: "Victoria Day" },
      { date: isoDate(year, 7, 1), name: "Canada Day" },
      { date: nthWeekdayOfMonth(year, 9, 1, 1), name: "Labour Day" },
      { date: isoDate(year, 9, 30), name: "National Day for Truth and Reconciliation" },
      { date: nthWeekdayOfMonth(year, 10, 1, 2), name: "Thanksgiving" },
      { date: isoDate(year, 11, 11), name: "Remembrance Day" },
      { date: isoDate(year, 12, 25), name: "Christmas Day" },
      { date: isoDate(year, 12, 26), name: "Boxing Day" },
    ]);
  }

  if (code === "AU") {
    return build([
      { date: isoDate(year, 1, 1), name: "New Year's Day" },
      { date: isoDate(year, 1, 26), name: "Australia Day" },
      { date: goodFriday, name: "Good Friday" },
      { date: easterMonday, name: "Easter Monday" },
      { date: isoDate(year, 4, 25), name: "Anzac Day" },
      { date: isoDate(year, 12, 25), name: "Christmas Day" },
      { date: isoDate(year, 12, 26), name: "Boxing Day" },
    ]);
  }

  if (code === "AE") {
    return build([
      { date: isoDate(year, 1, 1), name: "New Year's Day" },
      { date: isoDate(year, 12, 2), name: "UAE National Day" },
      { date: isoDate(year, 12, 3), name: "UAE National Day Holiday" },
    ]);
  }

  return build([
    { date: isoDate(year, 1, 1), name: "New Year's Day" },
    { date: goodFriday, name: "Good Friday" },
    { date: easterMonday, name: "Easter Monday" },
    { date: isoDate(year, 5, 1), name: "Labour Day" },
    { date: isoDate(year, 12, 25), name: "Christmas Day" },
    { date: isoDate(year, 12, 26), name: "Boxing Day / Second Day of Christmas" },
  ]);
}

/**
 * Fetches official public holidays from Nager.Date when supported, falling back
 * smoothly to curated/algorithmic country holidays (including India & UAE).
 */
export async function fetchOrGenerateCountryPublicHolidays(
  countryCode: string,
  year: number
): Promise<PublicHolidayEntry[]> {
  const code = countryCode.toUpperCase();
  const countryName = getCountryNameByCode(code);

  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4500),
      }
    );
    if (res.ok) {
      const payload = (await res.json()) as Array<{
        date?: string;
        name?: string;
        localName?: string;
        global?: boolean;
      }>;
      if (Array.isArray(payload) && payload.length > 0) {
        const seen = new Set<string>();
        const mapped: PublicHolidayEntry[] = [];
        for (const row of payload) {
          if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
          const label = (row.name || row.localName || "").trim();
          if (!label) continue;
          const key = `${row.date}::${label.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          mapped.push({
            date: row.date,
            name: label.slice(0, 120),
            location: countryName,
          });
        }
        if (mapped.length > 0) {
          return mapped;
        }
      }
    }
  } catch {
    // Offline/timeout/unsupported country falls back cleanly to built-in generator.
  }

  return generateBuiltinPublicHolidays(code, year);
}
