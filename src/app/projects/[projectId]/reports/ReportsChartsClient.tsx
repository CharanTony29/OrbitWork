"use client";

import React, { useState } from "react";
import { AlertTriangle, BarChart3, Clock, Gauge, PieChart, Users } from "lucide-react";

type StatusMetric = {
  status_id: string;
  status_name: string;
  status_color: string;
  task_count: number;
};

type PersonMetric = {
  id: string;
  name: string;
  assignedCount: number;
  completedCount: number;
  totalMinutes: number;
  billableMinutes: number;
};

type PriorityCounts = {
  urgent: number;
  high: number;
  normal: number;
  low: number;
};

type ChartMode = "bar" | "pie";

type PieSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
  meta?: string;
};

function SvgPieChart({
  slices,
  centerValue,
  centerLabel,
  emptyLabel,
}: {
  slices: PieSlice[];
  centerValue: string;
  centerLabel: string;
  emptyLabel: string;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const nonZero = slices.filter((s) => s.value > 0);
  const sum = nonZero.reduce((acc, s) => acc + s.value, 0);

  if (sum === 0) {
    return <p className="muted small">{emptyLabel}</p>;
  }

  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  const segments = nonZero.map((slice) => {
    const fraction = slice.value / sum;
    const dash = fraction * circumference;
    const offset = -cumulative * circumference;
    cumulative += fraction;
    return {
      ...slice,
      pct: Math.round(fraction * 100),
      dash,
      offset,
    };
  });

  const hovered = segments.find((s) => s.key === hoveredKey) ?? null;

  return (
    <div className="report-pie-wrap">
      <div className="report-pie-svg-box">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--line, #e2e8f0)"
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map((seg) => (
              <circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={hoveredKey === seg.key ? strokeWidth + 5 : strokeWidth}
                strokeDasharray={`${seg.dash} ${circumference}`}
                strokeDashoffset={seg.offset}
                style={{ cursor: "pointer", transition: "stroke-width 0.15s ease" }}
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
              >
                <title>{`${seg.label}: ${seg.value} (${seg.pct}%)`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="report-pie-center">
          <strong>{hovered ? `${hovered.pct}%` : centerValue}</strong>
          <span>{hovered ? hovered.label : centerLabel}</span>
        </div>
      </div>

      <div className="report-pie-legend">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`report-pie-legend-row${hoveredKey === seg.key ? " is-active" : ""}`}
            onMouseEnter={() => setHoveredKey(seg.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <span className="report-pie-dot" style={{ backgroundColor: seg.color }} />
            <span className="report-pie-label">{seg.label}</span>
            <span className="report-pie-val">
              {seg.meta ?? seg.value} <em>({seg.pct}%)</em>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModeSwitcher({
  mode,
  onChange,
  label,
}: {
  mode: ChartMode;
  onChange: (next: ChartMode) => void;
  label: string;
}) {
  return (
    <div className="report-chart-toggle" role="group" aria-label={`${label} chart view`}>
      <button
        type="button"
        className={mode === "bar" ? "is-active" : ""}
        onClick={() => onChange("bar")}
        title="Bar chart"
      >
        <BarChart3 size={13} />
        <span>Bar</span>
      </button>
      <button
        type="button"
        className={mode === "pie" ? "is-active" : ""}
        onClick={() => onChange("pie")}
        title="Pie chart"
      >
        <PieChart size={13} />
        <span>Pie</span>
      </button>
    </div>
  );
}

const PERSON_COLORS = ["#167c58", "#0284c7", "#7c3aed", "#d97706", "#db2777", "#0f766e", "#4f46e5"];

export default function ReportsChartsClient({
  total,
  completed,
  metrics,
  peopleList,
  totalBillableMinutes,
  totalNonBillableMinutes,
  totalTrackedMinutes,
  billablePercent,
  priorityCounts,
}: {
  total: number;
  completed: number;
  metrics: StatusMetric[];
  peopleList: PersonMetric[];
  totalBillableMinutes: number;
  totalNonBillableMinutes: number;
  totalTrackedMinutes: number;
  billablePercent: number;
  priorityCounts: PriorityCounts;
}) {
  const [globalMode, setGlobalMode] = useState<ChartMode>("bar");
  const [statusMode, setStatusMode] = useState<ChartMode>("bar");
  const [peopleMode, setPeopleMode] = useState<ChartMode>("bar");
  const [timeMode, setTimeMode] = useState<ChartMode>("bar");
  const [priorityMode, setPriorityMode] = useState<ChartMode>("bar");

  const setAllModes = (next: ChartMode) => {
    setGlobalMode(next);
    setStatusMode(next);
    setPeopleMode(next);
    setTimeMode(next);
    setPriorityMode(next);
  };

  const priorityRows = [
    { key: "urgent", label: "Urgent", count: priorityCounts.urgent, color: "#dc2626", className: "priority-urgent-pill" },
    { key: "high", label: "High", count: priorityCounts.high, color: "#d97706", className: "priority-high-pill" },
    { key: "normal", label: "Normal", count: priorityCounts.normal, color: "#0284c7", className: "priority-normal-pill" },
    { key: "low", label: "Low", count: priorityCounts.low, color: "#64748b", className: "priority-low-pill" },
  ] as const;

  const peopleMetricSum = peopleList.reduce(
    (sum, p) => sum + (p.totalMinutes > 0 ? p.totalMinutes : p.assignedCount),
    0
  );
  const peopleUseHours = peopleList.some((p) => p.totalMinutes > 0);
  const maxPersonVal = Math.max(
    1,
    ...peopleList.map((p) => (peopleUseHours ? p.totalMinutes : p.assignedCount))
  );

  return (
    <>
      <div className="report-global-controls">
        <span className="report-global-label">Chart style across reports:</span>
        <ModeSwitcher mode={globalMode} onChange={setAllModes} label="All reports" />
      </div>

      <div className="report-categories-grid">
        {/* Category 1: Workflow & Statuses */}
        <section className="report-card">
          <header>
            <div>
              <p className="eyebrow">WORKFLOW</p>
              <h2>Tasks by status</h2>
            </div>
            <div className="report-card-actions">
              <ModeSwitcher mode={statusMode} onChange={setStatusMode} label="Tasks by status" />
              <Gauge size={18} />
            </div>
          </header>

          {statusMode === "pie" ? (
            <SvgPieChart
              slices={metrics.map((row) => ({
                key: row.status_id,
                label: row.status_name,
                value: row.task_count,
                color: row.status_color || "#167c58",
                meta: `${row.task_count} task${row.task_count === 1 ? "" : "s"}`,
              }))}
              centerValue={String(total)}
              centerLabel="Tasks"
              emptyLabel="No tasks in statuses yet."
            />
          ) : (
            <div className="report-status-feed">
              {metrics.map((row) => {
                const pct = total ? Math.round((row.task_count * 100) / total) : 0;
                return (
                  <div className="report-status-row" key={row.status_id}>
                    <div>
                      <i style={{ backgroundColor: row.status_color }} />
                      <strong>{row.status_name}</strong>
                      <span>
                        {row.task_count} task{row.task_count === 1 ? "" : "s"} ({pct}%)
                      </span>
                    </div>
                    <div className="report-status-meter">
                      <i style={{ width: `${pct}%`, backgroundColor: row.status_color }} />
                    </div>
                  </div>
                );
              })}
              {!metrics.length && <p className="muted small">No task statuses available.</p>}
            </div>
          )}
        </section>

        {/* Category 2: People & Workload */}
        <section className="report-card">
          <header>
            <div>
              <p className="eyebrow">TEAM WORKLOAD</p>
              <h2>People &amp; Performance</h2>
            </div>
            <div className="report-card-actions">
              <ModeSwitcher mode={peopleMode} onChange={setPeopleMode} label="People performance" />
              <Users size={18} />
            </div>
          </header>

          {peopleMode === "pie" ? (
            <SvgPieChart
              slices={peopleList.map((person, idx) => {
                const val = peopleUseHours ? person.totalMinutes : person.assignedCount;
                const hrs = `${Math.floor(person.totalMinutes / 60)}h ${person.totalMinutes % 60}m`;
                return {
                  key: person.id,
                  label: person.name,
                  value: val,
                  color: PERSON_COLORS[idx % PERSON_COLORS.length],
                  meta: peopleUseHours ? hrs : `${person.assignedCount} tasks`,
                };
              })}
              centerValue={String(peopleList.length)}
              centerLabel={peopleUseHours ? "Time share" : "Task share"}
              emptyLabel="No members have been assigned tasks or logged time yet."
            />
          ) : (
            <div className="report-people-feed">
              {peopleList.map((person, idx) => {
                const totalH = Math.floor(person.totalMinutes / 60);
                const totalM = person.totalMinutes % 60;
                const billableH = Math.floor(person.billableMinutes / 60);
                const billableM = person.billableMinutes % 60;
                const completionRate = person.assignedCount
                  ? Math.round((person.completedCount * 100) / person.assignedCount)
                  : 0;
                const barVal = peopleUseHours ? person.totalMinutes : person.assignedCount;
                const barPct = peopleMetricSum > 0 ? Math.round((barVal * 100) / maxPersonVal) : 0;

                return (
                  <div className="report-people-row is-with-bar" key={person.id}>
                    <div className="report-people-main">
                      <div className="report-person-avatar">{person.name.charAt(0).toUpperCase()}</div>
                      <div className="report-person-info">
                        <div className="report-person-name">{person.name}</div>
                        <div className="report-person-meta">
                          <span>
                            {person.assignedCount} assigned · {person.completedCount} done ({completionRate}%)
                          </span>
                        </div>
                      </div>
                      <div className="report-person-stats">
                        <div className="report-person-hours">
                          {totalH}h {totalM}m
                        </div>
                        <div className="report-person-billable">
                          {billableH}h {billableM}m billable
                        </div>
                      </div>
                    </div>
                    <div className="report-status-meter">
                      <i
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: PERSON_COLORS[idx % PERSON_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {peopleList.length === 0 && (
                <p className="muted small">No members have been assigned tasks or logged time yet.</p>
              )}
            </div>
          )}
        </section>

        {/* Category 3: Time & Billable Breakdown */}
        <section className="report-card">
          <header>
            <div>
              <p className="eyebrow">TIME TRACKING</p>
              <h2>Billable vs Non-Billable</h2>
            </div>
            <div className="report-card-actions">
              <ModeSwitcher mode={timeMode} onChange={setTimeMode} label="Billable time" />
              <Clock size={18} />
            </div>
          </header>

          {timeMode === "pie" ? (
            <SvgPieChart
              slices={[
                {
                  key: "billable",
                  label: "Billable",
                  value: totalBillableMinutes,
                  color: "#167c58",
                  meta: `${Math.floor(totalBillableMinutes / 60)}h ${totalBillableMinutes % 60}m`,
                },
                {
                  key: "nonbillable",
                  label: "Non-billable",
                  value: totalNonBillableMinutes,
                  color: "#94a3b8",
                  meta: `${Math.floor(totalNonBillableMinutes / 60)}h ${totalNonBillableMinutes % 60}m`,
                },
              ]}
              centerValue={`${billablePercent}%`}
              centerLabel="Billable"
              emptyLabel="No tracked time recorded yet."
            />
          ) : (
            <div className="time-split-card">
              <div className="time-split-bar">
                <div
                  className="time-bar-billable"
                  style={{ width: `${billablePercent}%` }}
                  title={`Billable: ${billablePercent}%`}
                />
                <div
                  className="time-bar-nonbillable"
                  style={{ width: `${100 - billablePercent}%` }}
                  title={`Non-billable: ${100 - billablePercent}%`}
                />
              </div>

              <div className="time-split-legend">
                <div className="time-legend-item">
                  <span className="time-legend-dot billable" />
                  <span>
                    <strong>Billable:</strong> {Math.floor(totalBillableMinutes / 60)}h{" "}
                    {totalBillableMinutes % 60}m ({billablePercent}%)
                  </span>
                </div>
                <div className="time-legend-item">
                  <span className="time-legend-dot nonbillable" />
                  <span>
                    <strong>Non-billable:</strong> {Math.floor(totalNonBillableMinutes / 60)}h{" "}
                    {totalNonBillableMinutes % 60}m ({100 - billablePercent}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              paddingTop: "12px",
              marginTop: "12px",
              borderTop: "1px solid var(--line, #edf0ed)",
            }}
          >
            <div>
              <small style={{ color: "var(--muted)", fontSize: "11px" }}>Total Time Tracked</small>
              <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
                {Math.floor(totalTrackedMinutes / 60)}h {totalTrackedMinutes % 60}m
              </p>
            </div>
            <div>
              <small style={{ color: "var(--muted)", fontSize: "11px" }}>Average Per Done Task</small>
              <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
                {completed > 0
                  ? `${Math.floor(totalTrackedMinutes / completed / 60)}h ${Math.round((totalTrackedMinutes / completed) % 60)}m`
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Category 4: Priority Distribution */}
        <section className="report-card">
          <header>
            <div>
              <p className="eyebrow">RISK &amp; PRIORITY</p>
              <h2>Priority Breakdown</h2>
            </div>
            <div className="report-card-actions">
              <ModeSwitcher mode={priorityMode} onChange={setPriorityMode} label="Priority breakdown" />
              <AlertTriangle size={18} />
            </div>
          </header>

          {priorityMode === "pie" ? (
            <SvgPieChart
              slices={priorityRows.map((p) => ({
                key: p.key,
                label: p.label,
                value: p.count,
                color: p.color,
                meta: `${p.count} task${p.count === 1 ? "" : "s"}`,
              }))}
              centerValue={String(total)}
              centerLabel="Prioritized"
              emptyLabel="No prioritized tasks yet."
            />
          ) : (
            <div className="priority-report-feed">
              {priorityRows.map((p) => {
                const pct = total ? Math.round((p.count * 100) / total) : 0;
                return (
                  <div className="priority-report-row" key={p.key}>
                    <div className="priority-report-header">
                      <span className={`priority-pill-mini ${p.className}`}>{p.label}</span>
                      <span>
                        <strong>{p.count}</strong> ({pct}%)
                      </span>
                    </div>
                    <div className="report-status-meter">
                      <i style={{ width: `${pct}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
