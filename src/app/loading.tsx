export default function GlobalLoading() {
  return (
    <div className="global-route-loading" role="status" aria-live="polite" aria-label="Loading page">
      <div className="global-route-progress-track">
        <div className="global-route-progress-fill" />
      </div>
      <div className="global-route-loading-card">
        <div className="global-route-spinner" />
        <span>Loading Orbitwork…</span>
      </div>
      <style>{`
        .global-route-loading {
          position: fixed;
          inset: 0;
          z-index: 999990;
          pointer-events: none;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 56px;
        }
        .global-route-progress-track {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(22, 124, 88, 0.14);
          overflow: hidden;
        }
        .global-route-progress-fill {
          height: 100%;
          width: 45%;
          background: linear-gradient(90deg, #10b981, #16a34a, #22c55e);
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.65);
          animation: orbitworkIndeterminate 1.1s ease-in-out infinite;
        }
        .global-route-loading-card {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          background: var(--surface, #ffffff);
          border: 1px solid var(--line, #dfe5e0);
          box-shadow: 0 8px 24px rgba(15, 23, 20, 0.12);
          font-size: 12px;
          font-weight: 600;
          color: var(--ink, #1e293b);
        }
        .global-route-spinner {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(22, 124, 88, 0.22);
          border-top-color: var(--green, #167c58);
          animation: orbitworkSpin 0.7s linear infinite;
        }
        @keyframes orbitworkIndeterminate {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(260%); }
        }
        @keyframes orbitworkSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
