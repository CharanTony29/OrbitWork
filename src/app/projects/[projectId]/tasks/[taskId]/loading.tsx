export default function TaskDetailLoading() {
  return (
    <main className="app-shell project-app-shell">
      <header
        className="topbar app-topbar"
        aria-hidden="true"
        style={{
          background: "var(--surface, #ffffff)",
          borderBottom: "1px solid var(--line, #e4eae6)",
        }}
      >
        <div className="topbar-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="skeleton-shimmer" style={{ width: 130, height: 26, borderRadius: 6 }} />
        </div>
        <div className="topbar-center" style={{ display: "flex", justifyContent: "center" }}>
          <div
            className="skeleton-shimmer"
            style={{ width: "100%", maxWidth: 360, height: 34, borderRadius: 8 }}
          />
        </div>
        <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="skeleton-shimmer" style={{ width: 34, height: 34, borderRadius: "50%" }} />
        </div>
      </header>

      <div
        className="task-detail-page-container"
        style={{
          padding: "20px 24px",
          maxWidth: 1280,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Breadcrumb & Timer action skeleton */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div className="skeleton-shimmer" style={{ width: 220, height: 20, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 110, height: 32, borderRadius: 6 }} />
        </div>

        {/* Task Title Skeleton */}
        <div
          className="skeleton-shimmer"
          style={{ width: "55%", height: 36, borderRadius: 6, marginBottom: 20 }}
        />

        {/* Two-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Tabs skeleton */}
            <div
              style={{
                display: "flex",
                gap: 8,
                borderBottom: "1px solid var(--line, #e2e8f0)",
                paddingBottom: 10,
              }}
            >
              <div className="skeleton-shimmer" style={{ width: 90, height: 28, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 90, height: 28, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 90, height: 28, borderRadius: 6 }} />
            </div>

            {/* Description card skeleton */}
            <div
              className="skeleton-shimmer"
              style={{ width: "100%", height: 160, borderRadius: 10 }}
            />

            {/* Subtasks skeleton */}
            <div
              className="skeleton-shimmer"
              style={{ width: "100%", height: 140, borderRadius: 10 }}
            />
          </div>

          {/* Properties Panel Skeleton */}
          <div
            className="skeleton-shimmer"
            style={{ width: "100%", height: 440, borderRadius: 10 }}
          />
        </div>
      </div>
    </main>
  );
}
