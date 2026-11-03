"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Clock, Check, X, Loader2 } from "lucide-react";
import { updateTaskField } from "@/app/actions";
import { formatEstimate, parseEstimateToMinutes } from "@/lib/work";

type UnitOption = "m" | "h" | "d" | "w" | "mo";

const PRESETS = [
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "2h", value: "2h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
  { label: "2d", value: "2d" },
  { label: "1w", value: "1w" },
];

export default function TaskEstimateCell({
  projectId,
  taskId,
  taskTitle,
  initialMinutes,
  canEdit = true,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  initialMinutes: number | null;
  canEdit?: boolean;
}) {
  const [minutes, setMinutes] = useState<number | null>(initialMinutes);
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [unit, setUnit] = useState<UnitOption>("h");
  const [isPending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMinutes(initialMinutes);
  }, [initialMinutes]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleOpen = () => {
    // Pre-populate amount and unit based on existing minutes
    if (minutes && minutes > 0) {
      if (minutes % 9600 === 0) {
        setAmount(String(minutes / 9600));
        setUnit("mo");
      } else if (minutes % 2400 === 0) {
        setAmount(String(minutes / 2400));
        setUnit("w");
      } else if (minutes % 480 === 0) {
        setAmount(String(minutes / 480));
        setUnit("d");
      } else if (minutes % 60 === 0) {
        setAmount(String(minutes / 60));
        setUnit("h");
      } else {
        setAmount(String(minutes));
        setUnit("m");
      }
    } else {
      setAmount("");
      setUnit("h");
    }
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveEstimate = (formattedString: string) => {
    const parsed = parseEstimateToMinutes(formattedString);
    setMinutes(parsed);
    setIsOpen(false);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("taskId", taskId);
      fd.set("field", "estimate_minutes");
      fd.set("value", parsed != null ? String(parsed) : "");
      await updateTaskField(fd);
    });
  };

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!amount.trim()) {
      saveEstimate("");
      return;
    }
    const str = `${amount.trim()}${unit}`;
    saveEstimate(str);
  };

  const handlePresetClick = (presetValue: string) => {
    saveEstimate(presetValue);
  };

  const handleClear = () => {
    saveEstimate("");
  };

  const displayLabel = minutes ? formatEstimate(minutes) : null;

  if (!canEdit) {
    return (
      <div className="task-estimate-cell-wrap">
        <span
          className={`task-estimate-btn${displayLabel ? " has-estimate" : ""}`}
          style={{ cursor: "default", opacity: 0.9 }}
          title={displayLabel ? `Estimate: ${displayLabel}` : "No estimate set"}
        >
          <Clock size={12} className="estimate-icon" />
          <span className="estimate-text">{displayLabel || <span className="estimate-empty">—</span>}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="task-estimate-cell-wrap" ref={popoverRef}>
      <button
        type="button"
        className={`task-estimate-btn${displayLabel ? " has-estimate" : ""}`}
        onClick={handleOpen}
        title={displayLabel ? `Estimate: ${displayLabel}` : `Add estimate for ${taskTitle}`}
      >
        <Clock size={12} className="estimate-icon" />
        <span className="estimate-text">{displayLabel || <span className="estimate-empty">Set est</span>}</span>
        {isPending && <Loader2 size={10} className="animate-spin estimate-spinner" />}
      </button>

      {isOpen && (
        <div className="task-estimate-popover" onClick={(e) => e.stopPropagation()}>
          <div className="estimate-popover-header">
            <span className="estimate-popover-title">Estimate Time</span>
            <button
              type="button"
              className="estimate-popover-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>

          <form onSubmit={handleApply} className="estimate-input-form">
            <div className="estimate-input-row">
              <input
                ref={inputRef}
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="estimate-amount-input"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as UnitOption)}
                className="estimate-unit-select"
              >
                <option value="m">Minutes</option>
                <option value="h">Hours</option>
                <option value="d">Days (8h)</option>
                <option value="w">Weeks (5d)</option>
                <option value="mo">Months (20d)</option>
              </select>
            </div>

            <div className="estimate-presets-row">
              <span className="presets-label">Quick select:</span>
              <div className="preset-pills">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className="estimate-preset-pill"
                    onClick={() => handlePresetClick(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="estimate-actions-row">
              {minutes != null && minutes > 0 && (
                <button
                  type="button"
                  className="estimate-clear-btn"
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
              <button type="submit" className="estimate-save-btn">
                <Check size={12} /> Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
