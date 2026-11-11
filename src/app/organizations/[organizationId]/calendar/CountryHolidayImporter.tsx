"use client";

import { useState, useTransition } from "react";
import { Globe, Loader2, Sparkles } from "lucide-react";
import { SUPPORTED_HOLIDAY_COUNTRIES } from "@/lib/publicHolidays";
import { autoImportCountryHolidays } from "@/app/actions";

type Props = {
  organizationId: string;
  initialCountryCode?: string | null;
};

export default function CountryHolidayImporter({
  organizationId,
  initialCountryCode,
}: Props) {
  const currentYear = new Date().getUTCFullYear();
  const [countryCode, setCountryCode] = useState(
    (initialCountryCode || "IN").toUpperCase()
  );
  const [year, setYear] = useState(currentYear);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleImport = () => {
    setStatusMsg(null);
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    fd.set("countryCode", countryCode);
    fd.set("year", String(year));

    startTransition(async () => {
      const res = await autoImportCountryHolidays(fd);
      if (!res.ok) {
        setErrorMsg(res.error ?? "Could not import public holidays.");
      } else {
        setStatusMsg(
          res.addedCount > 0
            ? `Added ${res.addedCount} public holidays for ${res.countryName} (${year}).`
            : `All ${year} public holidays for ${res.countryName} are already on your calendar.`
        );
      }
    });
  };

  return (
    <div className="holiday-country-importer">
      <div className="holiday-country-head">
        <span className="holiday-country-title">
          <Globe size={15} />
          <strong>Auto-add public holidays by country</strong>
        </span>
        <small>Save your country and import official holidays automatically.</small>
      </div>
      <div className="holiday-country-controls">
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          aria-label="Select country for public holidays"
          disabled={pending}
        >
          {SUPPORTED_HOLIDAY_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          aria-label="Select holiday year"
          disabled={pending}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="mini-save"
          onClick={handleImport}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 size={13} className="spin" /> Importing…
            </>
          ) : (
            <>
              <Sparkles size={13} /> Import holidays
            </>
          )}
        </button>
      </div>
      {statusMsg && (
        <p className="notice holiday-country-msg" role="status">
          {statusMsg}
        </p>
      )}
      {errorMsg && (
        <p className="error holiday-country-msg" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
