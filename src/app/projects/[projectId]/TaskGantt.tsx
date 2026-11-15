import Link from "next/link";

type Task = {
  id: string;
  generated_key: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  created_at?: string;
  status_id?: string;
  status_category?: string;
  parent_task_id?: string | null;
  assigneeIds?: string[];
};

type ScheduleEvent = {
  id: string;
  label: string;
  start: string;
  end?: string;
  kind: "holiday" | "leave";
  person?: string;
  avatarUrl?: string | null;
};

const AVATAR_COLORS = [
  "#167c58",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#9333ea",
  "#0891b2",
  "#4f46e5",
  "#e11d48",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const TASK_COL_WIDTH = 270;

export default function TaskGantt({
  projectId,
  tasks,
  month,
  events = [],
  people,
  profileAvatars,
}: {
  projectId: string;
  tasks: Task[];
  month?: string;
  events?: ScheduleEvent[];
  people?: Map<string, string>;
  profileAvatars?: Map<string, string | null>;
}) {
  const now = new Date();
  const [year, monthNumber] =
    month && /^\d{4}-\d{2}$/.test(month)
      ? month.split("-").map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const key = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const fmt = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const columns = `${TASK_COL_WIDTH}px repeat(${days}, minmax(32px, 1fr))`;

  // Map day-of-month (1..days) -> holiday names for vertical column highlights in Timeline
  const holidayByDay = new Map<number, string[]>();
  for (const event of events) {
    if (event.kind !== "holiday") continue;
    const end = event.end ?? event.start;
    const startDay = event.start.startsWith(key)
      ? Number(event.start.slice(8, 10))
      : event.start < `${key}-01`
      ? 1
      : days + 1;
    const endDay = end.startsWith(key)
      ? Number(end.slice(8, 10))
      : end > `${key}-${String(days).padStart(2, "0")}`
      ? days
      : 0;
    if (startDay <= days && endDay >= 1) {
      for (let d = Math.max(1, startDay); d <= Math.min(days, endDay); d++) {
        holidayByDay.set(d, [...(holidayByDay.get(d) ?? []), event.label]);
      }
    }
  }
  const monthHolidays = events.filter((e) => e.kind === "holiday" && e.start.startsWith(key));

  // Build hierarchy tree: Parent tasks first, followed immediately by their subtasks indented
  const subtasksByParent = new Map<string, Task[]>();
  const parentTasks: Task[] = [];
  const taskIdSet = new Set(tasks.map((t) => t.id));

  for (const task of tasks) {
    if (task.parent_task_id && taskIdSet.has(task.parent_task_id)) {
      const list = subtasksByParent.get(task.parent_task_id) ?? [];
      list.push(task);
      subtasksByParent.set(task.parent_task_id, list);
    } else {
      parentTasks.push(task);
    }
  }

  const hierarchicalList: Array<{ task: Task; isSubtask: boolean }> = [];
  for (const parent of parentTasks) {
    hierarchicalList.push({ task: parent, isSubtask: false });
    const children = subtasksByParent.get(parent.id) ?? [];
    for (const child of children) {
      hierarchicalList.push({ task: child, isSubtask: true });
    }
  }

  return (
    <section className="gantt-view">
      <header className="gantt-header">
        <Link href={`/projects/${projectId}?view=gantt&month=${fmt(previous)}`}>← Previous</Link>
        <h3>{first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</h3>
        <Link href={`/projects/${projectId}?view=gantt&month=${fmt(next)}`}>Next →</Link>
      </header>

      {monthHolidays.length > 0 && (
        <div className="gantt-holiday-strip">
          <strong>Holidays:</strong>
          {monthHolidays.map((h) => (
            <span key={`pill-${h.id}`} className="calendar-event calendar-event-holiday" style={{ marginTop: 0 }}>
              {new Date(`${h.start}T00:00:00Z`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}{" "}
              · {h.label}
            </span>
          ))}
        </div>
      )}

      <div className="gantt-scale" style={{ gridTemplateColumns: columns }}>
        <span style={{ width: TASK_COL_WIDTH, maxWidth: TASK_COL_WIDTH, padding: "0 10px", justifyContent: "flex-start", fontWeight: 700 }}>
          Task Name
        </span>
        {Array.from({ length: days }, (_, index) => {
          const d = index + 1;
          const hLabels = holidayByDay.get(d);
          return (
            <span
              className={`gantt-day${hLabels ? " is-holiday" : ""}`}
              key={index}
              title={hLabels ? `Holiday: ${hLabels.join(", ")}` : undefined}
            >
              {d}
            </span>
          );
        })}
      </div>

      {hierarchicalList.map(({ task, isSubtask }) => {
        const start = task.start_date ?? task.created_at?.slice(0, 10) ?? task.due_date;
        const today = new Date().toISOString().slice(0, 10);
        const late =
          !!task.due_date &&
          task.due_date < today &&
          !["completed", "cancelled"].includes(task.status_category ?? "");
        const end = late ? today : task.due_date ?? task.start_date;
        const startDay = start?.startsWith(key)
          ? Number(start.slice(8, 10))
          : start && start < `${key}-01`
          ? 1
          : days + 1;
        const endDay = end?.startsWith(key)
          ? Number(end.slice(8, 10))
          : end && end > `${key}-${String(days).padStart(2, "0")}`
          ? days
          : 0;
        const visible = !!start && !!end && startDay <= days && endDay >= 1;
        const clampedStart = Math.max(1, Math.min(days, startDay ?? 1));
        const clampedEnd = Math.max(clampedStart, Math.min(days, endDay ?? clampedStart));
        const planned = task.status_category === "not_started";
        const isDone = task.status_category === "completed";
        const progress =
          task.progress > 0
            ? task.progress
            : task.status_category === "active" || task.status_category === "completed"
            ? 100
            : 0;

        const assigneeId = task.assigneeIds?.[0];
        const assigneeName = assigneeId ? people?.get(assigneeId) ?? "Team member" : "";
        const assigneeAvatar = assigneeId ? profileAvatars?.get(assigneeId) : null;

        return (
          <div className="gantt-row" key={task.id} style={{ gridTemplateColumns: columns }}>
            <div
              className="gantt-task-name"
              style={{
                width: TASK_COL_WIDTH,
                maxWidth: TASK_COL_WIDTH,
                paddingLeft: isSubtask ? 26 : 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
                overflow: "hidden",
                borderBottom: "1px solid var(--line, #e2e8f0)",
              }}
            >
              {isSubtask && (
                <span
                  style={{
                    color: "var(--muted, #94a3b8)",
                    fontSize: 11,
                    fontWeight: 700,
                    marginRight: -2,
                    flexShrink: 0,
                  }}
                >
                  ↳
                </span>
              )}

              {assigneeId && (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: getAvatarColor(assigneeId),
                    color: "#ffffff",
                    fontSize: 8.5,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                  title={assigneeName}
                >
                  {assigneeAvatar ? (
                    <img
                      src={assigneeAvatar}
                      alt={assigneeName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    assigneeName.charAt(0).toUpperCase()
                  )}
                </span>
              )}

              <Link
                href={`/projects/${projectId}/tasks/${task.id}`}
                title={task.title}
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: isSubtask ? "var(--muted-ink, #475569)" : "var(--ink, #0f172a)",
                  fontSize: isSubtask ? 11 : 12,
                  fontWeight: isSubtask ? 550 : 700,
                  textDecoration: "none",
                }}
              >
                {task.title}
              </Link>
            </div>

            {Array.from({ length: days }, (_, index) => {
              const hLabels = holidayByDay.get(index + 1);
              return (
                <span
                  className={`gantt-cell${hLabels ? " is-holiday" : ""}`}
                  key={index}
                  title={hLabels ? `Holiday: ${hLabels.join(", ")}` : undefined}
                />
              );
            })}

            {visible && (
              <Link
                className={`gantt-bar${planned ? " is-planned" : ""}${late ? " is-overdue" : ""}`}
                href={`/projects/${projectId}/tasks/${task.id}`}
                style={
                  {
                    gridColumn: `${clampedStart + 1} / ${clampedEnd + 2}`,
                    gridRow: 1,
                    left: 0,
                    height: 24,
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 8px",
                    overflow: "hidden",
                    zIndex: 3,
                    textDecoration: "none",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    background: isDone
                      ? "linear-gradient(135deg, #167c58, #10b981)"
                      : late
                      ? "linear-gradient(135deg, #dc2626, #ef4444)"
                      : "linear-gradient(135deg, #2563eb, #3b82f6)",
                    "--bar-progress": `${Math.max(0, Math.min(100, progress))}%`,
                  } as React.CSSProperties
                }
                title={`${task.title} · ${start} to ${task.due_date ?? end}${late ? " (Overdue)" : ""}`}
              >
                {assigneeId && (
                  <span
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: "50%",
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                      border: "1px solid rgba(255, 255, 255, 0.4)",
                    }}
                    title={assigneeName}
                  >
                    {assigneeAvatar ? (
                      <img
                        src={assigneeAvatar}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      assigneeName.charAt(0).toUpperCase()
                    )}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 650,
                    color: "#ffffff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                  }}
                >
                  {task.title}
                </span>
              </Link>
            )}

            {!visible && (
              <span
                className="gantt-unscheduled"
                style={{
                  position: "absolute",
                  left: TASK_COL_WIDTH + 14,
                  gridRow: 1,
                  color: "#94a3b8",
                  fontSize: 10,
                  fontStyle: "italic",
                }}
              >
                No schedule
              </span>
            )}
          </div>
        );
      })}

      {events.map((event) => {
        const end = event.end ?? event.start;
        const startDay = event.start.startsWith(key)
          ? Number(event.start.slice(8, 10))
          : event.start < `${key}-01`
          ? 1
          : days + 1;
        const endDay = end.startsWith(key)
          ? Number(end.slice(8, 10))
          : end > `${key}-${String(days).padStart(2, "0")}`
          ? days
          : 0;
        if (startDay > days || endDay < 1) return null;
        const from = Math.max(1, startDay);
        const to = Math.max(from, Math.min(days, endDay));

        return (
          <div
            className="gantt-row gantt-event-row"
            key={`event-${event.id}`}
            style={{ gridTemplateColumns: columns }}
          >
            <div
              className="gantt-task-name"
              style={{
                width: TASK_COL_WIDTH,
                maxWidth: TASK_COL_WIDTH,
                padding: "0 10px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                overflow: "hidden",
                borderBottom: "1px solid var(--line, #e2e8f0)",
              }}
            >
              {event.avatarUrl && (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    overflow: "hidden",
                    display: "inline-flex",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={event.avatarUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 650,
                  color: event.kind === "leave" ? "#3b82f6" : "#d97706",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${event.label}${event.person ? ` · ${event.person}` : ""}`}
              >
                {event.kind === "leave" ? "🏖️ " : "🎉 "}
                {event.label}
                {event.person ? ` · ${event.person}` : ""}
              </span>
            </div>

            {Array.from({ length: days }, (_, index) => (
              <span className="gantt-cell" key={index} />
            ))}

            <span
              className={`gantt-event-bar gantt-event-${event.kind}`}
              style={{
                gridColumn: `${from + 1} / ${to + 2}`,
                gridRow: 1,
                alignSelf: "center",
                height: 24,
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0 8px",
                overflow: "hidden",
                color: "#ffffff",
                fontSize: 10.5,
                fontWeight: 650,
                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                zIndex: 3,
                background:
                  event.kind === "leave"
                    ? "linear-gradient(135deg, #60a5fa, #3b82f6)"
                    : "linear-gradient(135deg, #fbbf24, #f59e0b)",
              }}
              title={`${event.label} (${event.start}${event.end ? ` to ${event.end}` : ""})`}
            >
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {event.label}
                {event.person ? ` · ${event.person}` : ""}
              </span>
            </span>
          </div>
        );
      })}

      {!tasks.length && <p className="muted small" style={{ padding: 16 }}>No tasks match the current filters.</p>}
    </section>
  );
}
