export default function DashboardLoading() {
  return (
    <div className="dashboard-layout" style={{ minHeight: "100vh", display: "flex" }}>
      {/* Navigation rail skeleton */}
      <div
        className="skeleton-shimmer"
        style={{
          width: 58,
          height: "100vh",
          flexShrink: 0,
          borderRadius: 0,
          borderRight: "1px solid var(--line, #e2e8f0)",
        }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar Skeleton */}
        <header
          style={{
            height: 52,
            borderBottom: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "var(--surface, #ffffff)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skeleton-shimmer" style={{ width: 120, height: 20 }} />
            <div className="skeleton-shimmer" style={{ width: 80, height: 16 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skeleton-shimmer" style={{ width: 220, height: 32, borderRadius: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: "50%" }} />
          </div>
        </header>

        {/* Dashboard Content Skeleton */}
        <main style={{ flex: 1, padding: "24px 32px", maxWidth: 1240, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {/* Welcome greeting skeleton */}
          <div style={{ marginBottom: 28 }}>
            <div className="skeleton-shimmer" style={{ width: 260, height: 32, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 380, height: 16 }} />
          </div>

          {/* Metric cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  border: "1px solid var(--line, #e2e8f0)",
                  background: "var(--surface, #ffffff)",
                }}
              >
                <div className="skeleton-shimmer" style={{ width: 100, height: 14, marginBottom: 12 }} />
                <div className="skeleton-shimmer" style={{ width: 64, height: 28, marginBottom: 8 }} />
                <div className="skeleton-shimmer" style={{ width: 140, height: 12 }} />
              </div>
            ))}
          </div>

          {/* Section rows */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            <div
              style={{
                padding: 24,
                borderRadius: 14,
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--surface, #ffffff)",
                display: "grid",
                gap: 16,
              }}
            >
              <div className="skeleton-shimmer" style={{ width: 180, height: 20, marginBottom: 8 }} />
              {[1, 2, 3, 4, 5].map((r) => (
                <div
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--line-light, #f1f5f9)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="skeleton-shimmer" style={{ width: 16, height: 16, borderRadius: 4 }} />
                    <div className="skeleton-shimmer" style={{ width: 220, height: 16 }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div className="skeleton-shimmer" style={{ width: 70, height: 20, borderRadius: 12 }} />
                    <div className="skeleton-shimmer" style={{ width: 80, height: 14 }} />
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: 24,
                borderRadius: 14,
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--surface, #ffffff)",
                display: "grid",
                gap: 16,
                alignContent: "start",
              }}
            >
              <div className="skeleton-shimmer" style={{ width: 140, height: 20, marginBottom: 8 }} />
              {[1, 2, 3].map((r) => (
                <div key={r} style={{ display: "grid", gap: 6, padding: "8px 0" }}>
                  <div className="skeleton-shimmer" style={{ width: "100%", height: 14 }} />
                  <div className="skeleton-shimmer" style={{ width: "60%", height: 12 }} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
