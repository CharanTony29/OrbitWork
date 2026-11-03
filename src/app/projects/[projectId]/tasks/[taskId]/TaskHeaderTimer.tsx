"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Clock, X, DollarSign } from "lucide-react";
import { startTaskTimer, stopTaskTimer } from "@/app/actions";

export default function TaskHeaderTimer({
  projectId,
  taskId,
  taskTitle,
  runningEntry,
  canEdit = true,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  runningEntry?: { id: string; started_at: string; billable?: boolean } | null;
  canEdit?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [billable, setBillable] = useState(true);
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (!runningEntry?.started_at) return;

    const startedTime = new Date(runningEntry.started_at).getTime();

    const updateTicker = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startedTime) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      setElapsed(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [runningEntry?.started_at]);

  if (!canEdit) return null;

  return (
    <div className="task-header-timer-wrap">
      {runningEntry ? (
        <form action={stopTaskTimer} className="running-timer-pill">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="entryId" value={runningEntry.id} />
          <span className="timer-pulse-dot" />
          <Clock size={13} className="timer-active-icon" />
          <span className="timer-ticker">{elapsed}</span>
          <span className={`timer-billable-pill ${runningEntry.billable ? "is-billable" : "is-non-billable"}`}>
            {runningEntry.billable ? "Billable" : "Non-billable"}
          </span>
          <button type="submit" className="timer-stop-btn" title="Stop timer and log hours">
            <Square size={11} fill="currentColor" />
            <span>Stop</span>
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            className="start-timer-trigger-btn"
            onClick={() => setModalOpen(true)}
            title="Start timer for this task"
          >
            <Play size={12} fill="currentColor" />
            <span>Start timer</span>
          </button>

          {modalOpen && (
            <div className="timer-modal-backdrop" onClick={() => setModalOpen(false)}>
              <div className="timer-modal-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="timer-modal-header">
                  <div className="timer-modal-title">
                    <Clock size={16} />
                    <strong>Start task timer</strong>
                  </div>
                  <button
                    type="button"
                    className="timer-modal-close"
                    onClick={() => setModalOpen(false)}
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>

                <form
                  action={startTaskTimer}
                  onSubmit={() => setModalOpen(false)}
                  className="timer-modal-form"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="taskId" value={taskId} />
                  <input type="hidden" name="billable" value={billable ? "true" : "false"} />

                  <p className="timer-task-name">{taskTitle}</p>

                  <div className="timer-billable-selector">
                    <label className="timer-billable-label">Time classification:</label>
                    <div className="timer-billable-options">
                      <button
                        type="button"
                        className={`timer-option-btn${billable ? " is-active" : ""}`}
                        onClick={() => setBillable(true)}
                      >
                        <DollarSign size={13} />
                        <span>Billable</span>
                      </button>
                      <button
                        type="button"
                        className={`timer-option-btn${!billable ? " is-active" : ""}`}
                        onClick={() => setBillable(false)}
                      >
                        <span>Non-billable</span>
                      </button>
                    </div>
                    <small className="timer-hint">
                      {billable
                        ? "Billable hours are factored into client timesheets and invoices."
                        : "Non-billable hours are recorded for internal tracking only."}
                    </small>
                  </div>

                  <div className="timer-modal-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="button button-primary">
                      <Play size={13} fill="currentColor" />
                      <span>Start timer now</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
