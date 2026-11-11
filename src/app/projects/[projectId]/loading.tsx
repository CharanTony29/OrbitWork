export default function ProjectLoading() {
  return (
    <main className="app-shell project-app-shell">
      <header className="topbar app-topbar" aria-hidden="true">
        <div className="topbar-left" />
        <div className="topbar-center">
          <div
            style={{
              width: "100%",
              maxWidth: "360px",
              height: "34px",
              borderRadius: "8px",
              background: "var(--surface-subtle, #f1f5f3)",
              border: "1px solid var(--line, #e4eae6)",
            }}
          />
        </div>
        <div className="topbar-right">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--surface-subtle, #f1f5f3)",
            }}
          />
        </div>
      </header>
      <div className="project-page">
        <section
          className="task-panel"
          style={{ minHeight: "360px", padding: "18px", display: "grid", gap: "12px", alignContent: "start" }}
          aria-busy="true"
          aria-label="Loading project workspace"
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[72, 64, 80, 76, 82].map((w, idx) => (
              <div
                key={idx}
                style={{
                  width: `${w}px`,
                  height: "30px",
                  borderRadius: "6px",
                  background: "var(--surface-subtle, #f1f5f3)",
                }}
              />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              style={{
                height: "40px",
                borderRadius: "7px",
                background: "var(--surface-subtle, #f5f8f6)",
                border: "1px solid var(--line, #eaf0ec)",
              }}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
