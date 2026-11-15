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

function getAvatarColor(id?: string | null) {
  if (!id || typeof id !== "string") return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const TASK_COL_WIDTH = 280;
const DAY_COL_WIDTH = 38;

export default function TaskGantt({
  projectId,
  tasks = [],
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
  try {
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
    
    // Fixed day column widths so items never expand or distort the grid
    const columns = `${TASK_COL_WIDTH}px repeat(${days}, ${DAY_COL_WIDTH}px)`;

    // Map day-of-month (1..days) -> holiday names for vertical column highlights
    const holidayByDay = new Map<number, string[]>();
    for (const event of events) {
      if (event.kind !== "holiday" || !event.start || typeof event.start !== "string") continue;
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

    const monthHolidays = events.filter(
      (e) => e.kind === "holiday" && typeof e.start === "string" && e.start.startsWith(key)
    );

    // Filter and prepare leaves for the current month
    const monthLeaves = events.filter((e) => {
      if (e.kind !== "leave" || !e.start || typeof e.start !== "string") return false;
      const end = e.end ?? e.start;
      const startDay = e.start.startsWith(key)
        ? Number(e.start.slice(8, 10))
        : e.start < `${key}-01`
        ? 1
        : days + 1;
      const endDay = end.startsWith(key)
        ? Number(end.slice(8, 10))
        : end > `${key}-${String(days).padStart(2, "0")}`
        ? days
        : 0;
      return startDay <= days && endDay >= 1;
    });

    // Build recursive hierarchy tree: top-level parents followed immediately by nested subtasks
    const subtasksByParent = new Map<string, Task[]>();
    const topParents: Task[] = [];
    const taskIdSet = new Set((tasks ?? []).map((t) => t.id));

    for (const task of tasks ?? []) {
      if (task.parent_task_id && taskIdSet.has(task.parent_task_id)) {
        const list = subtasksByParent.get(task.parent_task_id) ?? [];
        list.push(task);
        subtasksByParent.set(task.parent_task_id, list);
      } else {
        topParents.push(task);
      }
    }

    const hierarchicalList: Array<{ task: Task; depth: number }> = [];
    const visited = new Set<string>();

    function addNode(t: Task, depth: number) {
      if (visited.has(t.id)) return;
      visited.add(t.id);
      hierarchicalList.push({ task: t, depth });
      const children = subtasksByParent.get(t.id) ?? [];
      for (const c of children) {
        addNode(c, depth + 1);
      }
    }

    for (const p of topParents) {
      addNode(p, 0);
    }
    // Safety fallback: any unvisited tasks (e.g. cycle or orphan parent)
    for (const t of tasks ?? []) {
      if (!visited.has(t.id)) {
        hierarchicalList.push({ task: t, depth: t.parent_task_id ? 1 : 0 });
      }
    }

    return (
      <section className="gantt-view">
        <header className="gantt-header">
          <Link href={`/projects/${projectId}?view=gantt&month=${fmt(previous)}`}>← Previous</Link>
          <h3 style={{ margin: 0, fontWeight: 700 }}>
            {first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
          </h3>
          <Link href={`/projects/${projectId}?view=gantt&month=${fmt(next)}`}>Next →</Link>
        </header>

        {/* Top Summary Strip: Holidays and Team Leaves */}
        {(monthHolidays.length > 0 || monthLeaves.length > 0) && (
          <div
            className="gantt-holiday-strip"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {monthHolidays.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 11, color: "#475569" }}>Holidays:</strong>
                {monthHolidays.map((h) => {
                  const dayNum = Number(h.start.slice(8, 10));
                  return (
                    <span
                      key={`pill-${h.id}`}
                      className="calendar-event calendar-event-holiday"
                      style={{
                        marginTop: 0,
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "#fef3c7",
                        color: "#92400e",
                        border: "1px solid #fde68a",
                        fontWeight: 600,
                      }}
                    >
                      🎉 {dayNum} {first.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} · {h.label}
                    </span>
                  );
                })}
              </div>
            )}

            {monthLeaves.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 11, color: "#1d4ed8" }}>Team Time Off:</strong>
                {monthLeaves.map((l) => {
                  const sDay = Number(l.start.slice(8, 10));
                  const eDay = l.end ? Number(l.end.slice(8, 10)) : sDay;
                  const dateText = sDay === eDay ? `${sDay}` : `${sDay}–${eDay}`;
                  const isSick = l.label.toLowerCase().includes("sick");
                  return (
                    <span
                      key={`pill-leave-${l.id}`}
                      className="calendar-event calendar-event-leave"
                      style={{
                        marginTop: 0,
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: isSick ? "#eff6ff" : "#f5f3ff",
                        color: isSick ? "#1e40af" : "#6d28d9",
                        border: isSick ? "1px solid #bfdbfe" : "1px solid #ddd6fe",
                        fontWeight: 600,
                      }}
                    >
                      {isSick ? "🤒" : "🏖️"} {dateText} {first.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ·{" "}
                      {l.person || "Team member"} ({l.label})
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Timeline Scale Header */}
        <div className="gantt-scale" style={{ gridTemplateColumns: columns }}>
          <span
            style={{
              width: TASK_COL_WIDTH,
              minWidth: TASK_COL_WIDTH,
              maxWidth: TASK_COL_WIDTH,
              boxSizing: "border-box",
              padding: "0 12px",
              justifyContent: "flex-start",
              fontWeight: 700,
              fontSize: 11,
              color: "#334155",
              position: "sticky",
              left: 0,
              zIndex: 6,
              background: "#f7f9f7",
              borderRight: "2px solid #cbd5e1",
            }}
          >
            Task / Member
          </span>
          {Array.from({ length: days }, (_, index) => {
            const d = index + 1;
            const hLabels = holidayByDay.get(d);
            const isToday =
              year === now.getFullYear() &&
              monthNumber === now.getMonth() + 1 &&
              d === now.getDate();
            return (
              <span
                className={`gantt-day${hLabels ? " is-holiday" : ""}${isToday ? " is-today" : ""}`}
                key={index}
                title={
                  hLabels
                    ? `Holiday: ${hLabels.join(", ")}`
                    : isToday
                    ? "Today"
                    : undefined
                }
                style={{
                  width: DAY_COL_WIDTH,
                  minWidth: DAY_COL_WIDTH,
                  maxWidth: DAY_COL_WIDTH,
                  boxSizing: "border-box",
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? "#167c58" : undefined,
                }}
              >
                {d}
              </span>
            );
          })}
        </div>

        {/* Team Leave Rows placed right at the TOP of the grid (above tasks) */}
        {monthLeaves.length > 0 && (
          <div className="gantt-leaves-container">
            {/* Section Banner */}
            <div
              className="gantt-row"
              style={{
                gridTemplateColumns: columns,
                background: "#f0f7ff",
                borderBottom: "1px solid #bfdbfe",
                minHeight: 28,
              }}
            >
              <div
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 5,
                  background: "#f0f7ff",
                  padding: "4px 12px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#1d4ed8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderRight: "2px solid #cbd5e1",
                  width: TASK_COL_WIDTH,
                  minWidth: TASK_COL_WIDTH,
                  maxWidth: TASK_COL_WIDTH,
                  boxSizing: "border-box",
                }}
              >
                🏖️ Team Time Off ({monthLeaves.length})
              </div>
              {Array.from({ length: days }, (_, i) => (
                <span
                  key={`leave-head-${i}`}
                  style={{
                    width: DAY_COL_WIDTH,
                    borderRight: "1px solid #e0e7ff",
                    height: "100%",
                  }}
                />
              ))}
            </div>

            {monthLeaves.map((event) => {
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
              const personName = event.person || "Team member";
              const isSick = event.label.toLowerCase().includes("sick");
              const spanDays = to - from + 1;

              return (
                <div
                  className="gantt-row gantt-event-row"
                  key={`event-${event.id}`}
                  style={{
                    gridTemplateColumns: columns,
                    background: "#fafcff",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {/* Sticky Person Info Column */}
                  <div
                    className="gantt-task-name"
                    style={{
                      width: TASK_COL_WIDTH,
                      minWidth: TASK_COL_WIDTH,
                      maxWidth: TASK_COL_WIDTH,
                      boxSizing: "border-box",
                      padding: "0 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      overflow: "hidden",
                      background: "#fafcff",
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      borderRight: "2px solid #cbd5e1",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        overflow: "hidden",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        backgroundColor: isSick ? "#3b82f6" : "#8b5cf6",
                        color: "#ffffff",
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      {event.avatarUrl ? (
                        <img
                          src={event.avatarUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        (personName.charAt(0) || "?").toUpperCase()
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 650,
                        color: isSick ? "#1e40af" : "#6d28d9",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={`${personName} · ${event.label}`}
                    >
                      {isSick ? "🤒" : "🏖️"} {personName}
                      <span
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                          fontWeight: 500,
                          marginLeft: 4,
                        }}
                      >
                        ({event.label})
                      </span>
                    </span>
                  </div>

                  {/* Empty Day Grid Cells */}
                  {Array.from({ length: days }, (_, index) => {
                    const hLabels = holidayByDay.get(index + 1);
                    return (
                      <span
                        className={`gantt-cell${hLabels ? " is-holiday" : ""}`}
                        key={index}
                        style={{
                          width: DAY_COL_WIDTH,
                          boxSizing: "border-box",
                          background: hLabels ? "rgba(245,158,11,0.06)" : "transparent",
                        }}
                      />
                    );
                  })}

                  {/* Sick Leave / Holiday Timeline Bar exactly at [from+1 / to+2] */}
                  <span
                    className="gantt-event-bar gantt-event-leave"
                    style={{
                      gridColumn: `${from + 1} / ${to + 2}`,
                      gridRow: 1,
                      alignSelf: "center",
                      height: 24,
                      borderRadius: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "0 6px",
                      overflow: "hidden",
                      minWidth: 0,
                      color: "#ffffff",
                      fontSize: 10,
                      fontWeight: 650,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      zIndex: 3,
                      background: isSick
                        ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                        : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                    }}
                    title={`${personName} · ${event.label} (${event.start}${event.end ? ` to ${event.end}` : ""})`}
                  >
                    <span style={{ flexShrink: 0, fontSize: 10 }}>{isSick ? "🤒" : "🏖️"}</span>
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: 10,
                      }}
                    >
                      {spanDays > 1 ? `${personName}: ${event.label}` : event.label.replace(" leave", "")}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Section Banner for Tasks */}
        <div
          className="gantt-row"
          style={{
            gridTemplateColumns: columns,
            background: "#f8fafc",
            borderBottom: "1px solid #cbd5e1",
            minHeight: 28,
            marginTop: monthLeaves.length > 0 ? 8 : 0,
          }}
        >
          <div
            style={{
              position: "sticky",
              left: 0,
              zIndex: 5,
              background: "#f8fafc",
              padding: "4px 12px",
              fontSize: 10,
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderRight: "2px solid #cbd5e1",
              width: TASK_COL_WIDTH,
              minWidth: TASK_COL_WIDTH,
              maxWidth: TASK_COL_WIDTH,
              boxSizing: "border-box",
            }}
          >
            📋 Tasks ({tasks.length})
          </div>
          {Array.from({ length: days }, (_, i) => (
            <span
              key={`task-head-${i}`}
              style={{
                width: DAY_COL_WIDTH,
                borderRight: "1px solid #f1f5f9",
                height: "100%",
              }}
            />
          ))}
        </div>

        {/* Task Rows in Hierarchical Order */}
        {hierarchicalList.map(({ task, depth }) => {
          const isSubtask = depth > 0;
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
          const isDone = task.status_category === "completed";
          const progress =
            task.progress > 0
              ? task.progress
              : task.status_category === "active" || task.status_category === "completed"
              ? 100
              : 0;

          const assigneeId = (task.assigneeIds ?? []).find(
            (id) => typeof id === "string" && id.trim().length > 0
          );
          const assigneeName = assigneeId ? people?.get(assigneeId) ?? "Team member" : "";
          const assigneeAvatar = assigneeId ? profileAvatars?.get(assigneeId) : null;

          return (
            <div
              className={`gantt-row${isSubtask ? " is-subtask-row" : ""}`}
              key={task.id}
              style={{
                gridTemplateColumns: columns,
                background: isSubtask ? "#fafbfa" : "#ffffff",
                borderBottom: "1px solid var(--line, #e2e8f0)",
              }}
            >
              {/* Sticky Task Name Column with Hierarchy Tree Indentation & Avatars */}
              <div
                className="gantt-task-name"
                style={{
                  width: TASK_COL_WIDTH,
                  minWidth: TASK_COL_WIDTH,
                  maxWidth: TASK_COL_WIDTH,
                  boxSizing: "border-box",
                  paddingLeft: 10 + depth * 16,
                  paddingRight: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  overflow: "hidden",
                  background: isSubtask ? "#f8faf8" : "#ffffff",
                  position: "sticky",
                  left: 0,
                  zIndex: 5,
                  borderRight: "2px solid #cbd5e1",
                }}
              >
                {isSubtask && (
                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: 12,
                      fontWeight: 700,
                      marginRight: -2,
                      flexShrink: 0,
                    }}
                    title="Subtask"
                  >
                    ↳
                  </span>
                )}

                {assigneeId ? (
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
                      />
                    ) : (
                      (assigneeName?.charAt(0) || "?").toUpperCase()
                    )}
                  </span>
                ) : (
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "1px dashed #cbd5e1",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 8,
                      color: "#94a3b8",
                    }}
                    title="Unassigned"
                  >
                    —
                  </span>
                )}

                <Link
                  href={`/projects/${projectId}/tasks/${task.id}`}
                  title={task.title}
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: isSubtask ? "#475569" : "#0f172a",
                    fontSize: isSubtask ? 11 : 12,
                    fontWeight: isSubtask ? 550 : 700,
                    textDecoration: "none",
                  }}
                >
                  {task.title}
                </Link>

                {isSubtask && (
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: "#64748b",
                      background: "#e2e8f0",
                      padding: "1px 4px",
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  >
                    sub
                  </span>
                )}
              </div>

              {/* Day Cells with Holiday Shading */}
              {Array.from({ length: days }, (_, index) => {
                const hLabels = holidayByDay.get(index + 1);
                return (
                  <span
                    className={`gantt-cell${hLabels ? " is-holiday" : ""}`}
                    key={index}
                    title={hLabels ? `Holiday: ${hLabels.join(", ")}` : undefined}
                    style={{
                      width: DAY_COL_WIDTH,
                      boxSizing: "border-box",
                    }}
                  />
                );
              })}

              {/* Timeline Bar with User Avatar & Task Title Inside the Bar */}
              {visible && (
                <Link
                  className={`gantt-bar${late ? " is-overdue" : ""}`}
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
                      minWidth: 0,
                      zIndex: 3,
                      textDecoration: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      background: isDone
                        ? "linear-gradient(135deg, #167c58, #10b981)"
                        : late
                        ? "linear-gradient(135deg, #dc2626, #ef4444)"
                        : isSubtask
                        ? "linear-gradient(135deg, #0284c7, #38bdf8)"
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
                        />
                      ) : (
                        (assigneeName?.charAt(0) || "?").toUpperCase()
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

              {/* Unscheduled Indicator aligned cleanly to Day 1 column */}
              {!visible && (
                <span
                  className="gantt-unscheduled"
                  style={{
                    gridColumn: "2 / 6",
                    gridRow: 1,
                    zIndex: 2,
                    color: "#94a3b8",
                    fontSize: 10,
                    fontStyle: "italic",
                    paddingLeft: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  No schedule
                </span>
              )}
            </div>
          );
        })}

        {!tasks.length && (
          <p className="muted small" style={{ padding: 16 }}>
            No tasks match the current filters.
          </p>
        )}
      </section>
    );
  } catch (err) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h4 style={{ color: "#dc2626", margin: "0 0 8px 0" }}>Unable to render timeline</h4>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px 0" }}>
          An issue occurred while laying out the timeline calendar. Please refresh or check date filters.
        </p>
        <Link
          href={`/projects/${projectId}?view=gantt`}
          style={{
            padding: "6px 14px",
            background: "#167c58",
            color: "#fff",
            borderRadius: 6,
            fontSize: 12,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Reset Timeline View
        </Link>
      </div>
    );
  }
}
