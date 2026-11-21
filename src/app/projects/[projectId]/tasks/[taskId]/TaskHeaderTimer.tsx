"use client";

import { useState, useEffect, useRef, useTransition } from "react";
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
  runningEntry?: {
    id: string;
    started_at: string;
    billable?: boolean;
    user_id?: string;
    user_name?: string;
    is_current_user?: boolean;
  } | null;
  canEdit?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [billable, setBillable] = useState(true);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [currentEntry, setCurrentEntry] = useState(runningEntry);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("error=")) {
      const url = new URL(window.location.href);
      const err = url.searchParams.get("error");
      url.searchParams.delete("error");
      window.history.replaceState(null, "", url.toString());
      if (err) {
        showToast(err.replace(/_/g, " "));
      }
    }
  }, []);

  useEffect(() => {
    setCurrentEntry(runningEntry);
  }, [runningEntry]);

  useEffect(() => {
    if (!currentEntry?.started_at) return;

    const startedTime = new Date(currentEntry.started_at).getTime();

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
  }, [currentEntry?.started_at]);

  if (!canEdit) return null;

  const handleStartTimer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const optimistic = {
      id: "opt-" + Date.now(),
      started_at: new Date().toISOString(),
      billable,
      is_current_user: true,
    };
    setCurrentEntry(optimistic);
    setModalOpen(false);

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("billable", billable ? "true" : "false");

    startTransition(async () => {
      try {
        const res = await startTaskTimer(fd);
        if (res && !res.ok) {
          setCurrentEntry(runningEntry);
          showToast(res.error || "Could not start timer.");
        }
      } catch (err: any) {
        setCurrentEntry(runningEntry);
        showToast(err?.message || "Could not start timer.");
      }
    });
  };

  const handleStopTimer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const prev = currentEntry;
    setCurrentEntry(null);

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    if (prev?.id) fd.set("entryId", prev.id);

    startTransition(async () => {
      try {
        const res = await stopTaskTimer(fd);
        if (res && !res.ok) {
          setCurrentEntry(prev);
          showToast(res.error || "Could not stop timer.");
        }
      } catch (err: any) {
        setCurrentEntry(prev);
        showToast(err?.message || "Could not stop timer.");
      }
    });
  };

  return (
    <div className="task-header-timer-wrap">
      {currentEntry && currentEntry.is_current_user === false ? (
        <div
          className="running-timer-pill"
          style={{ background: "rgba(22, 163, 74, 0.1)", border: "1px solid rgba(22, 163, 74, 0.3)" }}
        >
          <span className="timer-pulse-dot" style={{ background: "#16a34a" }} />
          <Clock size={13} className="timer-active-icon" />
          <span className="timer-ticker" style={{ color: "#16a34a" }}>{elapsed}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>
            In progress by {currentEntry.user_name || "Teammate"}
          </span>
        </div>
      ) : currentEntry ? (
        <form onSubmit={handleStopTimer} className="running-timer-pill">
          <span className="timer-pulse-dot" />
          <Clock size={13} className="timer-active-icon" />
          <span className="timer-ticker">{elapsed}</span>
          <span className={`timer-billable-pill ${currentEntry.billable ? "is-billable" : "is-non-billable"}`}>
            {currentEntry.billable ? "Billable" : "Non-billable"}
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
                  onSubmit={handleStartTimer}
                  className="timer-modal-form"
                >
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

      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: "#dc2626",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>⚠️ {toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{
              background: "none",
              border: 0,
              color: "#fff",
              cursor: "pointer",
              padding: 0,
              marginLeft: 8,
              display: "flex",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
