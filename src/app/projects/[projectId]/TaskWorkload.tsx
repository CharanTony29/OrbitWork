"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, CheckCircle2, Clock, Users, Info, ShieldCheck, Zap } from "lucide-react";
import { calculatePeriodCapacity, DEFAULT_EXPERIENCE_CONFIG, type ExperienceConfig } from "@/lib/workload/engine";

type Task = {
  id: string;
  generated_key: string;
  title: string;
  estimate_minutes: number | null;
  primary_assignee_id: string | null;
  secondary_assignee_id: string | null;
  due_date: string | null;
};

type ScheduleEvent = {
  id: string;
  label: string;
  start: string;
  end?: string;
  kind: "holiday" | "leave";
  userId?: string;
};

type Member = {
  id: string;
  label: string;
  role?: string;
  designations?: string[];
};

export default function TaskWorkload({
  projectId,
  tasks,
  people,
  profileAvatars,
  events = [],
  members = [],
  startDate: projectStartDate,
  dueDate: projectDueDate,
}: {
  projectId: string;
  tasks: Task[];
  people: Map<string, string>;
  profileAvatars?: Map<string, string | null>;
  events?: ScheduleEvent[];
  members?: Member[];
  startDate?: string;
  dueDate?: string;
}) {
  const [period, setPeriod] = useState<"monthly" | "sprint" | "weekly" | "daily">("monthly");

  // Determine today and date bounds based on selected period
  const todayStr = useMemo(() => {
    // If project has dates in 2026, default reference to 2026-11-20
    const now = new Date();
    if (now.getFullYear() < 2026) return "2026-11-20";
    return now.toISOString().slice(0, 10);
  }, []);

  const { periodStart, periodEnd, periodLabel } = useMemo(() => {
    const year = Number(todayStr.slice(0, 4));
    const month = Number(todayStr.slice(5, 7));

    if (period === "monthly") {
      const pStart = `${todayStr.slice(0, 7)}-01`;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const pEnd = `${todayStr.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
      const monthName = new Date(`${pStart}T00:00:00Z`).toLocaleString("en-US", { month: "long" });
      return { periodStart: pStart, periodEnd: pEnd, periodLabel: `Monthly (${monthName} ${year})` };
    }

    if (period === "sprint") {
      const pStart = projectStartDate?.slice(0, 10) || `${todayStr.slice(0, 7)}-01`;
      const pEnd = projectDueDate?.slice(0, 10) || `${todayStr.slice(0, 7)}-30`;
      return { periodStart: pStart, periodEnd: pEnd, periodLabel: "Sprint 01 Period" };
    }

    if (period === "weekly") {
      const d = new Date(todayStr);
      const day = d.getDay(); // 0 is Sun
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diffToMon);
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4);
      return {
        periodStart: mon.toISOString().slice(0, 10),
        periodEnd: fri.toISOString().slice(0, 10),
        periodLabel: `This Week (${mon.toISOString().slice(5, 10)} to ${fri.toISOString().slice(5, 10)})`,
      };
    }

    // Daily
    return { periodStart: todayStr, periodEnd: todayStr, periodLabel: `Today (${todayStr})` };
  }, [period, todayStr, projectStartDate, projectDueDate]);

  // Aggregate assigned effort per user
  const rows = useMemo(() => {
    const map = new Map<string, { minutes: number; tasks: Task[]; unestimatedCount: number }>();

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
        const entry = map.get(id) ?? { minutes: 0, tasks: [], unestimatedCount: 0 };
        entry.minutes += estMins;
        if (!hasEst) entry.unestimatedCount += 1;
        entry.tasks.push(task);
        map.set(id, entry);
      }
    }
    return map;
  }, [tasks]);

  // Sort by estimated minutes descending
  const sortedRows = useMemo(() => {
    return [...rows.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
  }, [rows]);

  // Holidays in current period
  const holidaysList = useMemo(() => {
    return events
      .filter((e) => e.kind === "holiday")
      .map((e) => ({ holiday_date: e.start.slice(0, 10), name: e.label }));
  }, [events]);

  return (
    <div
      className="workload-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "16px 20px 40px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Top Planning Period & Capacity Control Bar */}
      <div
        className="workload-control-bar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid #cbd5e1",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#e8f4ed",
              color: "#167c58",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 750, color: "#0f172a" }}>
              Effort &amp; Capacity Workload Engine
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              Workload = Total Estimated Hours ÷ Effective Working Capacity (Excluding Org Holidays &amp; Approved Leaves)
            </div>
          </div>
        </div>

        {/* Planning Period Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", padding: 3, borderRadius: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", padding: "0 6px" }}>Period:</span>
          {(
            [
              { key: "monthly", label: "Monthly" },
              { key: "sprint", label: "Sprint" },
              { key: "weekly", label: "Weekly" },
              { key: "daily", label: "Daily" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setPeriod(btn.key)}
              style={{
                border: 0,
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: period === btn.key ? 750 : 600,
                background: period === btn.key ? "#167c58" : "transparent",
                color: period === btn.key ? "#ffffff" : "#334155",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Period Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          fontSize: 11,
          color: "#334155",
        }}
      >
        <span>
          Planning Window: <strong>{periodLabel}</strong> ({periodStart} to {periodEnd})
        </span>
        <span>
          Formula: <strong>Effective Capacity = (Gross Weekdays − Holidays − Leaves) × Experience Factor</strong>
        </span>
      </div>

      {/* Team Member Workload Cards */}
      {sortedRows.length ? (
        sortedRows.map(([id, row]) => {
          const avatar = id ? profileAvatars?.get(id) : null;
          const rawName = id ? people.get(id) : null;
          const name = rawName && rawName.trim() ? rawName : id ? "Team Member" : "Unassigned Backlog";

          const memberInfo = (members || []).find((m) => m.id === id);
          const desigText = (memberInfo?.designations || []).join(" ") + " " + (memberInfo?.role || "");

          let experienceLevel: "junior" | "mid" | "senior" | "lead" = "mid";
          if (/lead|principal|architect|director|head/i.test(desigText)) {
            experienceLevel = "lead";
          } else if (/senior|sr\./i.test(desigText)) {
            experienceLevel = "senior";
          } else if (/junior|jr\.|intern|associate/i.test(desigText)) {
            experienceLevel = "junior";
          }

          // User leaves for this period
          const leaveRequests = events
            .filter((e) => e.kind === "leave" && (e.userId === id || (!e.userId && id === "")))
            .map((e) => ({
              user_id: e.userId || id,
              start_date: e.start.slice(0, 10),
              end_date: (e.end || e.start).slice(0, 10),
              status: "approved",
            }));

          // Calculate precise capacity
          const capResult = calculatePeriodCapacity({
            userId: id,
            period: period === "sprint" ? "custom" : period,
            startDate: periodStart,
            endDate: periodEnd,
            workingHoursPerDay: 8,
            holidays: holidaysList,
            leaveRequests,
          });

          const expMultiplier = DEFAULT_EXPERIENCE_CONFIG[`${experienceLevel}Factor` as keyof ExperienceConfig] ?? 1.0;
          const grossCapacityHours = capResult.totalWorkingDays * 8;
          const effectiveCap = id
            ? Math.max(8, Math.round(capResult.rawCapacityHours * expMultiplier))
            : Math.max(8, capResult.rawCapacityHours);
          const rawCap = capResult.rawCapacityHours;
          const estimatedHours = Number((row.minutes / 60).toFixed(1));
          const utilization = Math.round((estimatedHours / Math.max(1, effectiveCap)) * 100);

          let statusBadge = {
            label: "HEALTHY",
            bg: "#dcfce7",
            color: "#166534",
            border: "#bbf7d0",
            barColor: "#16a34a",
          };

          if (utilization > 120) {
            statusBadge = {
              label: "OVERLOADED",
              bg: "#fee2e2",
              color: "#991b1b",
              border: "#fecaca",
              barColor: "#dc2626",
            };
          } else if (utilization > 100) {
            statusBadge = {
              label: "OVER CAP",
              bg: "#fef2f2",
              color: "#b91c1c",
              border: "#fca5a5",
              barColor: "#ef4444",
            };
          } else if (utilization > 80) {
            statusBadge = {
              label: "HIGH",
              bg: "#fef3c7",
              color: "#92400e",
              border: "#fde68a",
              barColor: "#d97706",
            };
          } else if (utilization >= 60) {
            statusBadge = {
              label: "BALANCED",
              bg: "#eff6ff",
              color: "#1e40af",
              border: "#bfdbfe",
              barColor: "#2563eb",
            };
          }

          return (
            <section
              className="workload-person-card"
              key={id || "unassigned"}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "16px 20px",
                boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
                color: "#0f172a",
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
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      overflow: "hidden",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#e2e8f0",
                      fontWeight: 750,
                      color: "#1e293b",
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      (name.charAt(0) || "?").toUpperCase()
                    )}
                  </span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 15, color: "#0f172a", fontWeight: 750 }}>
                        {name}
                      </strong>
                      {memberInfo?.designations?.[0] && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#475569",
                            background: "#f1f5f9",
                            padding: "1px 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          {memberInfo.designations[0]}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      Assigned: <strong>{row.tasks.length} tasks</strong> · Seniority Factor:{" "}
                      <strong>×{expMultiplier.toFixed(2)}</strong> ({experienceLevel})
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                      {estimatedHours}h / {effectiveCap}h
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 750, color: statusBadge.color }}>
                      {utilization}% Utilization
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      padding: "5px 12px",
                      borderRadius: 14,
                      background: statusBadge.bg,
                      color: statusBadge.color,
                      border: `1.5px solid ${statusBadge.border}`,
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
                  height: 10,
                  borderRadius: 5,
                  background: "#e2e8f0",
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

              {/* Exact Formula & Deduction Breakdown */}
              {id && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    fontSize: 11,
                    color: "#334155",
                    background: "#f8fafc",
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    marginBottom: 12,
                  }}
                >
                  <span>
                    Gross Weekdays: <strong>{grossCapacityHours}h</strong> ({capResult.totalWorkingDays} days)
                  </span>
                  <span>•</span>
                  <span>
                    Org Holidays: <strong style={{ color: capResult.holidayHours > 0 ? "#dc2626" : "#475569" }}>−{capResult.holidayHours}h</strong> ({capResult.holidayDays} days)
                  </span>
                  <span>•</span>
                  <span>
                    Approved Leave: <strong style={{ color: capResult.leaveHours > 0 ? "#ea580c" : "#475569" }}>−{capResult.leaveHours}h</strong> ({capResult.leaveDays} days)
                  </span>
                  <span>•</span>
                  <span>
                    Net Base: <strong>{rawCap}h</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Effective Available: <strong style={{ color: "#167c58" }}>{effectiveCap}h</strong>
                  </span>
                </div>
              )}

              {/* Reduced Confidence Warning */}
              {row.unestimatedCount > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "#92400e",
                    marginBottom: 12,
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    padding: "5px 10px",
                    borderRadius: 6,
                  }}
                >
                  <AlertCircle size={14} color="#b45309" />
                  <span>
                    Confidence reduced: <strong>{row.unestimatedCount}</strong> of {row.tasks.length} assigned tasks lack estimated hours.
                  </span>
                </div>
              )}

              {/* Tasks Grid with High-Contrast Text */}
              <div
                className="workload-tasks-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 8,
                  marginTop: 6,
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
                        gap: 3,
                        padding: "8px 12px",
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        textDecoration: "none",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f1f5f9";
                        e.currentTarget.style.borderColor = "#94a3b8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#f8fafc";
                        e.currentTarget.style.borderColor = "#cbd5e1";
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </span>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#475569" }}>
                        <span style={{ fontWeight: 650, color: hasEst ? "#167c58" : "#d97706" }}>
                          {hasEst ? `${hrs}h estimated` : "No estimate"}
                        </span>
                        <span>Due: {task.due_date ? String(task.due_date).slice(0, 10) : "Not set"}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        <div style={{ padding: 48, textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: 12, border: "1px solid #cbd5e1" }}>
          <Users size={36} style={{ margin: "0 auto 12px", color: "#94a3b8" }} />
          <h3 style={{ fontSize: 16, fontWeight: 750, color: "#0f172a", margin: "0 0 6px" }}>No workload to show</h3>
          <p style={{ fontSize: 12, margin: 0 }}>Tasks appear here when they match the current project filters.</p>
        </div>
      )}
    </div>
  );
}
