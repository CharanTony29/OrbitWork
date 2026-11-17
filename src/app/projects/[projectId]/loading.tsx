export default function ProjectLoading() {
  return (
    <main className="app-shell project-app-shell">
      <header className="topbar app-topbar" aria-hidden="true" style={{ background: "var(--surface, #ffffff)", borderBottom: "1px solid var(--line, #e4eae6)" }}>
        <div className="topbar-left">
          <div className="skeleton-shimmer" style={{ width: 140, height: 24, borderRadius: 6 }} />
        </div>
        <div className="topbar-center">
          <div
            className="skeleton-shimmer"
            style={{
              width: "100%",
              maxWidth: "360px",
              height: "34px",
              borderRadius: "8px",
            }}
          />
        </div>
        <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="skeleton-shimmer"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
            }}
          />
        </div>
      </header>

      <div className="project-page">
        {/* Navigation Rail Skeleton */}
        <div
          className="skeleton-shimmer"
          style={{
            width: 58,
            minHeight: "calc(100vh - 52px)",
            borderRadius: 0,
            borderRight: "1px solid var(--line, #e2e8f0)",
          }}
        />

        <section
          className="task-panel"
          style={{ minHeight: "360px", padding: "18px 24px", display: "grid", gap: "16px", alignContent: "start", flex: 1 }}
          aria-busy="true"
          aria-label="Loading project workspace"
        >
          {/* Tabs bar skeleton */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid var(--line-light, #eef2f0)", paddingBottom: 12 }}>
            {[80, 68, 76, 84, 88, 70].map((w, idx) => (
              <div
                key={idx}
                className="skeleton-shimmer"
                style={{
                  width: `${w}px`,
                  height: "28px",
                  borderRadius: "6px",
                }}
              />
            ))}
          </div>

          {/* Action toolbar skeleton */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton-shimmer" style={{ width: 110, height: 32, borderRadius: 8 }} />
              <div className="skeleton-shimmer" style={{ width: 95, height: 32, borderRadius: 8 }} />
              <div className="skeleton-shimmer" style={{ width: 105, height: 32, borderRadius: 8 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton-shimmer" style={{ width: 80, height: 32, borderRadius: 8 }} />
              <div className="skeleton-shimmer" style={{ width: 110, height: 32, borderRadius: 8 }} />
            </div>
          </div>

          {/* Table header skeleton */}
          <div
            className="skeleton-shimmer"
            style={{
              height: "36px",
              borderRadius: "8px",
              border: "1px solid var(--line, #eaf0ec)",
            }}
          />

          {/* Task rows skeleton */}
          {[1, 2, 3, 4, 5, 6, 7].map((row) => (
            <div
              key={row}
              className="skeleton-shimmer"
              style={{
                height: "40px",
                borderRadius: "7px",
                border: "1px solid var(--line, #eaf0ec)",
              }}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
