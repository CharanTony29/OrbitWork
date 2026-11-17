export default function InboxLoading() {
  return (
    <div className="inbox-layout" style={{ minHeight: "100vh", display: "flex" }}>
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
      <div style={{ flex: 1, padding: "24px 32px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="skeleton-shimmer" style={{ width: 140, height: 28, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 220, height: 16 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="skeleton-shimmer" style={{ width: 90, height: 32, borderRadius: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 90, height: 32, borderRadius: 8 }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                padding: "16px 20px",
                borderRadius: 12,
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--surface, #ffffff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                <div>
                  <div className="skeleton-shimmer" style={{ width: 240, height: 16, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ width: 140, height: 12 }} />
                </div>
              </div>
              <div className="skeleton-shimmer" style={{ width: 80, height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
