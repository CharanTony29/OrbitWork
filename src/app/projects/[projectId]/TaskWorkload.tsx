import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Users } from "lucide-react";

type Task = {
  id: string;
  generated_key: string;
  title: string;
  estimate_minutes: number | null;
  primary_assignee_id: string | null;
  secondary_assignee_id: string | null;
  due_date: string | null;
};

export default function TaskWorkload({
  projectId,
  tasks,
  people,
  profileAvatars,
}: {
  projectId: string;
  tasks: Task[];
  people: Map<string, string>;
  profileAvatars?: Map<string, string | null>;
}) {
  const rows = new Map<string, { minutes: number; tasks: Task[]; unestimatedCount: number }>();

  for (const task of tasks) {
    const ids = [
      ...new Set(
        [task.primary_assignee_id, task.secondary_assignee_id].filter(
          (id): id is string => Boolean(id)
        )
      ),
    ];
    const owners = ids.length ? ids : [""];
    const hasEst = typeof task.estimate_minutes === "number" && task.estimate_minutes > 0;
    const estMins = hasEst ? Math.ceil(task.estimate_minutes! / owners.length) : 0;

    for (const id of owners) {
      const entry = rows.get(id) ?? { minutes: 0, tasks: [], unestimatedCount: 0 };
      entry.minutes += estMins;
      if (!hasEst) entry.unestimatedCount += 1;
      entry.tasks.push(task);
      rows.set(id, entry);
    }
  }

  // Sort by estimated minutes descending
  const sorted = [...rows.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
  const weeklyCapacityHours = 40;

  return (
    <div className="workload-view" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sorted.length ? (
        sorted.map(([id, row]) => {
          const avatar = id ? profileAvatars?.get(id) : null;
          const rawName = id ? people.get(id) : null;
          const name = rawName && rawName.trim() ? rawName : id ? "Team Member" : "Unassigned Backlog";

          const estimatedHours = Number((row.minutes / 60).toFixed(1));
          const utilization = Math.round((estimatedHours / weeklyCapacityHours) * 100);

          let statusBadge = {
            label: "Healthy",
            bg: "#dcfce7",
            color: "#166534",
            border: "#bbf7d0",
            barColor: "#16a34a",
          };

          if (utilization > 120) {
            statusBadge = {
              label: "Severely Overloaded",
              bg: "#fee2e2",
              color: "#991b1b",
              border: "#fecaca",
              barColor: "#dc2626",
            };
          } else if (utilization > 100) {
            statusBadge = {
              label: "Over Capacity",
              bg: "#fef2f2",
              color: "#b91c1c",
              border: "#fca5a5",
              barColor: "#ef4444",
            };
          } else if (utilization > 80) {
            statusBadge = {
              label: "High Utilization",
              bg: "#fef3c7",
              color: "#92400e",
              border: "#fde68a",
              barColor: "#d97706",
            };
          } else if (utilization >= 60) {
            statusBadge = {
              label: "Balanced",
              bg: "#eff6ff",
              color: "#1e40af",
              border: "#bfdbfe",
              barColor: "#2563eb",
            };
          }

          return (
            <section
              className="workload-person"
              key={id || "unassigned"}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    className="assignee-avatar"
                    style={{
                      overflow: "hidden",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#e2e8f0",
                      fontWeight: 700,
                      color: "#334155",
                      fontSize: 13,
                    }}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      name[0].toUpperCase()
                    )}
                  </span>
                  <div>
                    <strong style={{ fontSize: 15, color: "#0f172a", fontWeight: 700 }}>
                      {name}
                    </strong>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Capacity: {weeklyCapacityHours}h / week · Assigned: {row.tasks.length} tasks
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 750, color: "#0f172a" }}>
                      {estimatedHours}h / {weeklyCapacityHours}h
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: statusBadge.color }}>
                      {utilization}% Utilization
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 12,
                      background: statusBadge.bg,
                      color: statusBadge.color,
                      border: `1px solid ${statusBadge.border}`,
                    }}
                  >
                    {statusBadge.label}
                  </span>
                </div>
              </header>

              {/* Progress Utilization Meter */}
              <div
                style={{
                  width: "100%",
                  height: 8,
                  borderRadius: 4,
                  background: "#f1f5f9",
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, utilization)}%`,
                    background: statusBadge.barColor,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {row.unestimatedCount > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#b45309",
                    marginBottom: 12,
                    background: "#fef3c7",
                    padding: "4px 10px",
                    borderRadius: 6,
                  }}
                >
                  <AlertCircle size={14} />
                  <span>
                    Workload confidence is reduced: {row.unestimatedCount} of {row.tasks.length} tasks have no effort estimate.
                  </span>
                </div>
              )}

              <div
                className="workload-tasks"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {row.tasks.map((task) => {
                  const hasEst = typeof task.estimate_minutes === "number" && task.estimate_minutes > 0;
                  const hrs = hasEst ? Number((task.estimate_minutes! / 60).toFixed(1)) : 0;

                  return (
                    <Link
                      key={task.id}
                      href={`/projects/${projectId}/tasks/${task.id}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: "8px 12px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        textDecoration: "none",
                        color: "#0f172a",
                        fontSize: 13,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{task.title}</span>
                      <small style={{ color: "#64748b", fontSize: 11 }}>
                        {hasEst ? `${hrs}h estimated` : "No estimate"} · Due: {task.due_date ? String(task.due_date).slice(0, 10) : "Not set"}
                      </small>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        <div className="empty-tasks" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          <Users size={32} style={{ margin: "0 auto 12px", color: "#94a3b8" }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>No workload to show</h3>
          <p style={{ fontSize: 13 }}>Tasks appear here when they match the selected filters.</p>
        </div>
      )}
    </div>
  );
}
