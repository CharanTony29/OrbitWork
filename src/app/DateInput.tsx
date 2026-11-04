"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";

type DateInputProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, form: HTMLFormElement | null) => void;
  onBlur?: (value: string, form: HTMLFormElement | null) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  containerClassName?: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIso(value: string) {
  const date = fromIso(value);
  return date ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}` : "";
}

function fromDisplay(value: string) {
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function DateInput({
  name,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  min,
  max,
  required,
  disabled,
  id,
  ariaLabel,
  className,
  containerClassName,
}: DateInputProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;
  const [draft, setDraft] = useState(formatIso(selectedValue));
  const initialView = fromIso(selectedValue) ?? new Date();
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const shellRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerId = useId();

  useEffect(() => {
    setDraft(formatIso(selectedValue));
    inputRef.current?.setCustomValidity("");
    const selected = fromIso(selectedValue);
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [selectedValue]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const bounds = shellRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(296, window.innerWidth - 16);
      const height = 360;
      const below = bounds.bottom + 8;
      setPosition({
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
        top: below + height <= window.innerHeight ? below : Math.max(8, bounds.top - height - 8),
      });
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!shellRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    updatePosition();
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const commit = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue, inputRef.current?.form ?? null);
  };

  const isAllowed = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  const todayIso = toIso(new Date());
  const firstYear = Math.min(1900, fromIso(min ?? "")?.getFullYear() ?? 1900);
  const lastYear = Math.max(
    new Date().getFullYear() + 20,
    fromIso(min ?? "")?.getFullYear() ?? 0,
    fromIso(max ?? "")?.getFullYear() ?? 0
  );
  const calendarStart = new Date(viewYear, viewMonth, 1 - new Date(viewYear, viewMonth, 1).getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index);
    return { date: day, iso: toIso(day), inMonth: day.getMonth() === viewMonth };
  });

  const selectDate = (date: Date) => {
    const iso = toIso(date);
    if (!isAllowed(iso)) return;
    const formatted = formatIso(iso);
    setDraft(formatted);
    inputRef.current?.setCustomValidity("");
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    commit(iso);
    setOpen(false);
  };

  const clearDate = () => {
    setDraft("");
    inputRef.current?.setCustomValidity("");
    commit("");
    setOpen(false);
  };

  const updateDraft = (nextDraft: string) => {
    setDraft(nextDraft);
    if (!nextDraft.trim()) {
      inputRef.current?.setCustomValidity("");
      commit("");
      return;
    }
    const parsed = fromDisplay(nextDraft);
    const iso = parsed ? toIso(parsed) : "";
    const error = !parsed
      ? "Enter a valid date as DD/MM/YYYY."
      : !isAllowed(iso)
        ? "Choose a date within the allowed range."
        : "";
    inputRef.current?.setCustomValidity(error);
    if (!error && parsed) {
      setDraft(formatIso(iso));
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      commit(iso);
    }
  };

  return (
    <div ref={shellRef} className={`app-date-input-shell${containerClassName ? ` ${containerClassName}` : ""}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        placeholder="DD/MM/YYYY"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-controls={pickerId}
        aria-expanded={open}
        required={required}
        disabled={disabled}
        className={`date-picker-input${className ? ` ${className}` : ""}`}
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") setOpen(true);
        }}
        onChange={(event) => updateDraft(event.currentTarget.value)}
        onBlur={() => {
          const parsed = fromDisplay(draft);
          if (inputRef.current?.validity.valid) {
            onBlur?.(parsed && isAllowed(toIso(parsed)) ? toIso(parsed) : selectedValue, inputRef.current?.form ?? null);
          }
        }}
      />
      <CalendarDays className="date-picker-icon" size={15} aria-hidden="true" />
      {name && <input type="hidden" name={name} value={selectedValue} />}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          id={pickerId}
          role="dialog"
          aria-label="Choose a date"
          className="app-date-picker"
          style={{ left: position.left, top: position.top }}
        >
          <div className="app-date-picker-header">
            <select
              aria-label="Choose month"
              value={viewMonth}
              onChange={(event) => setViewMonth(Number(event.target.value))}
            >
              {MONTHS.map((month, index) => <option value={index} key={month}>{month}</option>)}
            </select>
            <select
              aria-label="Choose year"
              value={viewYear}
              onChange={(event) => setViewYear(Number(event.target.value))}
            >
              {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map((year) => (
                <option value={year} key={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="app-date-picker-weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="app-date-picker-days">
            {calendarDays.map(({ date, iso, inMonth }) => {
              const isSelected = iso === selectedValue;
              const isToday = iso === todayIso;
              const unavailable = !isAllowed(iso);
              return (
                <button
                  type="button"
                  key={iso}
                  className={`app-date-picker-day${!inMonth ? " is-outside" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                  aria-label={formatIso(iso)}
                  aria-pressed={isSelected}
                  disabled={unavailable}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="app-date-picker-footer">
            <button type="button" onClick={clearDate} disabled={!selectedValue}>Clear</button>
            <button type="button" onClick={() => selectDate(new Date())} disabled={!isAllowed(todayIso)}>Today</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default DateInput;
