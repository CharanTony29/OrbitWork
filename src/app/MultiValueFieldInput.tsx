"use client";

import { useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";

function splitValues(raw: string | undefined): string[] {
  if (!raw) return [""];
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [""];
}

function serializeValues(rows: string[]): string {
  return rows
    .map((part) => part.replace(/,/g, " ").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Interactive multi-value input control with `+` and `-` row actions, replacing
 * manual comma-separated entry while keeping FormData comma-joined parity.
 */
export default function MultiValueFieldInput({
  id,
  name,
  defaultValue = "",
  value,
  onChange,
  placeholder = "Enter value",
  addLabel = "Add value",
  inputType = "text",
  maxItemLength = 240,
  required = false,
  suggestions = [],
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (serialized: string) => void;
  placeholder?: string;
  addLabel?: string;
  inputType?: "text" | "email" | "url";
  maxItemLength?: number;
  required?: boolean;
  suggestions?: string[];
}) {
  const isControlled = value !== undefined;
  const [rows, setRows] = useState<string[]>(() =>
    splitValues(isControlled ? value : defaultValue)
  );

  useEffect(() => {
    if (!isControlled) return;
    const incoming = value ?? "";
    setRows((prev) => {
      if (serializeValues(prev) === serializeValues(splitValues(incoming))) {
        return prev;
      }
      return splitValues(incoming);
    });
  }, [isControlled, value]);

  const commitRows = (nextRows: string[]) => {
    setRows(nextRows);
    if (onChange) {
      onChange(serializeValues(nextRows));
    }
  };

  const handleRowChange = (index: number, nextVal: string) => {
    const nextRows = rows.map((row, idx) => (idx === index ? nextVal : row));
    commitRows(nextRows);
  };

  const handleAddRow = () => {
    commitRows([...rows, ""]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      commitRows([""]);
      return;
    }
    commitRows(rows.filter((_, idx) => idx !== index));
  };

  const serialized = serializeValues(rows);
  const activeTokens = rows.map((r) => r.trim()).filter(Boolean);
  const hasAnyValue = activeTokens.length > 0;

  const toggleSuggestion = (opt: string) => {
    const cleanRows = rows.map((r) => r.trim()).filter(Boolean);
    if (cleanRows.includes(opt)) {
      const filtered = cleanRows.filter((item) => item !== opt);
      commitRows(filtered.length > 0 ? filtered : [""]);
    } else {
      commitRows([...cleanRows, opt]);
    }
  };

  return (
    <div className="multi-value-field">
      {name && <input type="hidden" name={name} value={serialized} />}
      <div className="multi-value-rows">
        {rows.map((row, idx) => {
          const isOnlyBlank = rows.length === 1 && row.trim() === "";
          const isLast = idx === rows.length - 1;
          return (
            <div className="multi-value-row" key={idx}>
              <input
                id={idx === 0 ? id : undefined}
                type={inputType}
                value={row}
                onChange={(e) => handleRowChange(idx, e.target.value)}
                placeholder={placeholder}
                maxLength={maxItemLength}
                required={required && !hasAnyValue && idx === 0}
                aria-label={`${placeholder} ${idx + 1}`}
              />
              <button
                type="button"
                className="multi-value-btn is-remove"
                onClick={() => handleRemoveRow(idx)}
                disabled={isOnlyBlank}
                title={rows.length === 1 ? "Clear value" : "Remove value"}
                aria-label={rows.length === 1 ? "Clear value" : "Remove value"}
              >
                <Minus size={13} />
              </button>
              {isLast && (
                <button
                  type="button"
                  className="multi-value-btn is-add"
                  onClick={handleAddRow}
                  title={addLabel}
                  aria-label={addLabel}
                >
                  <Plus size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {suggestions.length > 0 && (
        <div className="multi-value-suggestions">
          {suggestions.map((opt) => {
            const isSelected = activeTokens.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                className={`multi-value-chip${isSelected ? " is-selected" : ""}`}
                onClick={() => toggleSuggestion(opt)}
                title={isSelected ? `Remove ${opt}` : `Add ${opt}`}
              >
                {isSelected ? <Minus size={11} /> : <Plus size={11} />}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
