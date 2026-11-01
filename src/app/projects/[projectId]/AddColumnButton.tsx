"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { createCustomField } from "@/app/actions";

export default function AddColumnButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <th className="add-col-th">
      <button
        ref={btnRef}
        className="add-col-btn"
        aria-label="Add column"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={13} />
      </button>

      {open && (
        <div ref={popRef} className="add-col-popover" role="dialog" aria-label="Add custom field">
          <div className="add-col-popover-head">
            <span>Add column</span>
            <button className="add-col-close" aria-label="Close" onClick={() => setOpen(false)}>
              <X size={13} />
            </button>
          </div>
          <form
            action={async (fd) => {
              await createCustomField(fd);
              setOpen(false);
            }}
            className="add-col-form"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <label>
              Column name
              <input name="name" placeholder="e.g. Budget" maxLength={80} required autoFocus />
            </label>
            <label>
              Type
              <select name="fieldType" defaultValue="text">
                <option value="text">Short text</option>
                <option value="long_text">Long text</option>
                <option value="number">Number</option>
                <option value="currency">Currency</option>
                <option value="date">Date</option>
                <option value="datetime">Date and time</option>
                <option value="dropdown">Dropdown</option>
                <option value="multi_select">Multi-select</option>
                <option value="checkbox">Checkbox</option>
                <option value="email">Email</option>
                <option value="url">URL</option>
                <option value="rating">Rating</option>
                <option value="progress">Progress</option>
                <option value="duration">Duration</option>
              </select>
            </label>
            <label>
              Options <span className="optional">dropdown/multi-select only, comma-separated</span>
              <input name="options" placeholder="Option A, Option B" />
            </label>
            <label className="add-col-required">
              <input type="checkbox" name="required" /> Required field
            </label>
            <button type="submit" className="button button-primary add-col-submit">Add column</button>
          </form>
        </div>
      )}
    </th>
  );
}
