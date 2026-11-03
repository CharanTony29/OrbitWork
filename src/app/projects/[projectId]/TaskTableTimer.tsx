"use client";

import { useState, useEffect } from "react";
import { Play, Pause, Clock, X, DollarSign } from "lucide-react";
import { startTaskTimer, stopTaskTimer } from "@/app/actions";

export default function TaskTableTimer({
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
  const [elapsed, setElapsed] = useState("0m");

  useEffect(() => {
    if (!runningEntry?.started_at) return;
    const start = new Date(runningEntry.started_at).getTime();
    const update = () => {
      const diffMin = Math.max(0, Math.floor((Date.now() - start) / 60000));
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      setElapsed(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [runningEntry?.started_at]);

  if (!canEdit) return null;

  // Active running timer: Show Pause / Stop button directly in table row!
  if (runningEntry) {
    return (
      <form action={stopTaskTimer} style={{ display: "inline-flex", margin: 0 }}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="entryId" value={runningEntry.id} />
        <button
          type="submit"
          className="table-timer-btn is-running"
          title={`Pause / Stop timer for ${taskTitle} (${elapsed} active)`}
          aria-label="Pause timer"
        >
          <span className="table-timer-pulse" />
          <Pause size={10} fill="currentColor" />
        </button>
      </form>
    );
  }

  return (
    <>
      <button
        type="button"
        className="table-timer-btn"
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        title={`Start timer for ${taskTitle}`}
        aria-label="Start timer"
      >
        <Play size={10} fill="currentColor" />
      </button>

      {modalOpen && (
        <div
          className="timer-modal-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(false);
          }}
        >
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
                  <span>Start timer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
