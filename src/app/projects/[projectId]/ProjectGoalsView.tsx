"use client";

import React, { useMemo, useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  Circle,
  Flag,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";
import type { GoalAchievement, GoalMilestone } from "@/app/api/projects/[projectId]/goals/route";

export type ProjectGoalRecord = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  target_date: string | null;
  progress: number;
  status: "in_progress" | "completed";
  key_performer_id: string | null;
  milestones: GoalMilestone[];
  achievements: GoalAchievement[];
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
};

type MemberOption = {
  id: string;
  label: string;
};

export default function ProjectGoalsView({
  projectId,
  projectName,
  canEdit,
  members,
  initialGoals,
  schemaMissing: initialSchemaMissing,
}: {
  projectId: string;
  projectName: string;
  canEdit: boolean;
  members: MemberOption[];
  initialGoals: ProjectGoalRecord[];
  schemaMissing?: boolean;
}) {
  const [goals, setGoals] = useState<ProjectGoalRecord[]>(initialGoals);
  const [schemaMissing, setSchemaMissing] = useState(Boolean(initialSchemaMissing));
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [keyPerformerId, setKeyPerformerId] = useState("");
  const [draftMilestones, setDraftMilestones] = useState<string[]>([""]);
  const [draftAchievement, setDraftAchievement] = useState("");

  // Inline milestone & achievement add inputs keyed by goalId
  const [newMilestoneText, setNewMilestoneText] = useState<Record<string, string>>({});
  const [newAchievementText, setNewAchievementText] = useState<Record<string, string>>({});

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m.label])),
    [members]
  );

  const summary = useMemo(() => {
    const totalGoals = goals.length;
    const completedGoals = goals.filter((g) => g.status === "completed").length;
    const allMilestones = goals.flatMap((g) => g.milestones ?? []);
    const doneMilestones = allMilestones.filter((m) => m.completed).length;
    const totalAchievements = goals.reduce((s, g) => s + (g.achievements?.length ?? 0), 0);

    const performerCounts = new Map<string, number>();
    for (const g of goals) {
      if (g.status === "completed" && g.key_performer_id) {
        performerCounts.set(
          g.key_performer_id,
          (performerCounts.get(g.key_performer_id) ?? 0) + 1
        );
      }
    }
    const topPerformers = [...performerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([uid, count]) => ({ uid, name: memberMap.get(uid) ?? "Teammate", count }));

    return {
      totalGoals,
      completedGoals,
      doneMilestones,
      totalMilestones: allMilestones.length,
      totalAchievements,
      topPerformers,
    };
  }, [goals, memberMap]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setErrorMsg(null);

    const milestones: GoalMilestone[] = draftMilestones
      .map((m) => m.trim())
      .filter(Boolean)
      .map((m, idx) => ({
        id: `ms-${Date.now()}-${idx}`,
        title: m,
        completed: false,
      }));

    const achievements: GoalAchievement[] = draftAchievement.trim()
      ? [
          {
            id: `ach-${Date.now()}`,
            title: draftAchievement.trim(),
            awardedAt: new Date().toISOString(),
          },
        ]
      : [];

    try {
      const res = await fetch(`/api/projects/${projectId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          targetDate: targetDate || null,
          keyPerformerId: keyPerformerId || null,
          milestones,
          achievements,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.schemaMissing) setSchemaMissing(true);
        setErrorMsg(data.error || "Could not create goal.");
      } else if (data.goal) {
        setGoals((prev) => [data.goal as ProjectGoalRecord, ...prev]);
        setTitle("");
        setDescription("");
        setTargetDate("");
        setKeyPerformerId("");
        setDraftMilestones([""]);
        setDraftAchievement("");
        setShowCreateForm(false);
      }
    } catch {
      setErrorMsg("Network error creating goal.");
    }
    setCreating(false);
  };

  const patchGoal = async (
    goalId: string,
    payload: {
      action?: "complete" | "reopen" | "update";
      milestones?: GoalMilestone[];
      achievements?: GoalAchievement[];
      keyPerformerId?: string | null;
    }
  ) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/goals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Could not update goal.");
        return;
      }
      if (data.goal) {
        setGoals((prev) => prev.map((g) => (g.id === goalId ? (data.goal as ProjectGoalRecord) : g)));
        if (data.completedJustNow) {
          const updatedGoal = data.goal as ProjectGoalRecord;
          const kp = updatedGoal.key_performer_id
            ? memberMap.get(updatedGoal.key_performer_id) ?? "Teammate"
            : null;
          setCelebrationMsg(
            kp
              ? `Goal "${updatedGoal.title}" completed! ${kp} recognized as Key Performer and team notified.`
              : `Goal "${updatedGoal.title}" completed! Achievement unlocked and team notified.`
          );
        }
      }
    } catch {
      setErrorMsg("Network error updating goal.");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/goals?goalId=${encodeURIComponent(goalId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
      }
    } catch {
      setErrorMsg("Could not delete goal.");
    }
  };

  return (
    <section className="project-goals-view" style={{ padding: "18px 22px 48px", display: "grid", gap: "18px", alignContent: "start" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ margin: "0 0 4px" }}>OUTCOMES &amp; RECOGNITION · {projectName.toUpperCase()}</p>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
            <Target size={20} style={{ color: "var(--green, #167c58)" }} />
            Project Goals, Milestones &amp; Achievements
          </h2>
        </div>
        {canEdit && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => setShowCreateForm((v) => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={15} />
            {showCreateForm ? "Close" : "New Goal"}
          </button>
        )}
      </header>

      {schemaMissing && (
        <p className="error" role="alert">
          Run migration <code>supabase/migrations/202611120003_platform_enhancements.sql</code> in Supabase SQL Editor to enable project goals.
        </p>
      )}
      {errorMsg && <p className="error" role="alert">{errorMsg}</p>}
      {celebrationMsg && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "10px",
            background: "linear-gradient(90deg, rgba(22,124,88,0.14), rgba(245,158,11,0.12))",
            border: "1px solid rgba(22,124,88,0.35)",
            color: "var(--ink)",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} style={{ color: "#d97706" }} />
            {celebrationMsg}
          </span>
          <button
            type="button"
            className="mini-save"
            onClick={() => setCelebrationMsg(null)}
            style={{ fontSize: "11px" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary & Key Performer Spotlight */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <div className="report-stat-grid" style={{ display: "contents" }}>
          <article style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "14px", background: "var(--surface, #fff)" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Total Goals</span>
            <strong style={{ display: "block", fontSize: "22px", marginTop: "4px" }}>{summary.totalGoals}</strong>
          </article>
          <article style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "14px", background: "var(--surface, #fff)" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Completed Goals</span>
            <strong style={{ display: "block", fontSize: "22px", marginTop: "4px", color: "var(--green, #167c58)" }}>
              {summary.completedGoals}
            </strong>
          </article>
          <article style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "14px", background: "var(--surface, #fff)" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Milestones Achieved</span>
            <strong style={{ display: "block", fontSize: "22px", marginTop: "4px" }}>
              {summary.doneMilestones} / {summary.totalMilestones}
            </strong>
          </article>
          <article style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "14px", background: "var(--surface, #fff)" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Achievements Unlocked</span>
            <strong style={{ display: "block", fontSize: "22px", marginTop: "4px", color: "#d97706" }}>
              {summary.totalAchievements}
            </strong>
          </article>
        </div>
      </div>

      {summary.topPerformers.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            background: "var(--surface, #fff)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#b45309" }}>
            <Trophy size={15} /> Key Performers Spotlight:
          </span>
          {summary.topPerformers.map((tp) => (
            <span
              key={tp.uid}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "999px",
                background: "rgba(245, 158, 11, 0.14)",
                color: "var(--ink)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <Award size={13} style={{ color: "#d97706" }} />
              {tp.name} · {tp.count} goal{tp.count === 1 ? "" : "s"}
            </span>
          ))}
        </div>
      )}

      {/* Create Goal Form */}
      {showCreateForm && canEdit && (
        <form
          onSubmit={handleCreateGoal}
          style={{
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "16px",
            background: "var(--surface, #fff)",
            display: "grid",
            gap: "12px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Define a new project goal</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "10px" }}>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", fontWeight: 600 }}>
              Goal title *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g., Launch v2.0 Production Release"
                style={{ padding: "8px 10px", borderRadius: "7px", border: "1px solid var(--line)" }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", fontWeight: 600 }}>
              Target date
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "7px", border: "1px solid var(--line)" }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", fontWeight: 600 }}>
              Key Performer
              <select
                value={keyPerformerId}
                onChange={(e) => setKeyPerformerId(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "7px", border: "1px solid var(--line)" }}
              >
                <option value="">Select teammate…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: "4px", fontSize: "11px", fontWeight: 600 }}>
            Description &amp; success criteria
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="What measurable outcomes define success?"
              style={{ padding: "8px 10px", borderRadius: "7px", border: "1px solid var(--line)" }}
            />
          </label>

          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontWeight: 600 }}>Milestones</span>
              <button
                type="button"
                className="mini-save"
                onClick={() => setDraftMilestones((prev) => [...prev, ""])}
              >
                + Add milestone
              </button>
            </div>
            {draftMilestones.map((ms, idx) => (
              <div key={idx} style={{ display: "flex", gap: "6px" }}>
                <input
                  value={ms}
                  onChange={(e) =>
                    setDraftMilestones((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                  }
                  placeholder={`Milestone ${idx + 1} (e.g., Security audit sign-off)`}
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--line)", fontSize: "12px" }}
                />
                {draftMilestones.length > 1 && (
                  <button
                    type="button"
                    className="mini-remove"
                    onClick={() => setDraftMilestones((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ width: "auto", padding: "0 10px", fontSize: "12px" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <label style={{ display: "grid", gap: "4px", fontSize: "11px", fontWeight: 600 }}>
            Target achievement / reward milestone (optional)
            <input
              value={draftAchievement}
              onChange={(e) => setDraftAchievement(e.target.value)}
              maxLength={200}
              placeholder="e.g., Zero-downtime launch badge"
              style={{ padding: "8px 10px", borderRadius: "7px", border: "1px solid var(--line)" }}
            />
          </label>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" className="button button-secondary" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={creating}>
              {creating ? "Creating…" : "Create Goal"}
            </button>
          </div>
        </form>
      )}

      {/* Goals Cards */}
      {goals.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--line)",
            borderRadius: "12px",
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          <Target size={28} style={{ opacity: 0.5, marginBottom: "8px" }} />
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--ink)" }}>No project goals yet</p>
          <p style={{ margin: 0, fontSize: "12.5px" }}>
            Define goals, track milestones, highlight your Key Performer, and unlock achievements on completion.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {goals.map((goal) => {
            const isCompleted = goal.status === "completed";
            const milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
            const achievements = Array.isArray(goal.achievements) ? goal.achievements : [];
            const performerName = goal.key_performer_id
              ? memberMap.get(goal.key_performer_id) ?? "Teammate"
              : null;

            return (
              <article
                key={goal.id}
                style={{
                  border: isCompleted ? "1.5px solid rgba(22,124,88,0.45)" : "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  background: "var(--surface, #fff)",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        className={`timesheet-status ${isCompleted ? "state-approved" : "state-pending"}`}
                        style={{ fontSize: "10.5px" }}
                      >
                        {isCompleted ? "Completed" : "In Progress"}
                      </span>
                      {goal.target_date && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--muted)" }}>
                          <Calendar size={12} /> Target: {new Date(`${goal.target_date}T00:00:00Z`).toLocaleDateString()}
                        </span>
                      )}
                      {performerName && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            background: "rgba(245, 158, 11, 0.14)",
                            color: "#b45309",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          <Trophy size={12} /> Key Performer: {performerName}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: "6px 0 4px", fontSize: "16px", fontWeight: 800 }}>{goal.title}</h3>
                    {goal.description && (
                      <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5 }}>
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {canEdit && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <select
                        aria-label={`Key performer for ${goal.title}`}
                        value={goal.key_performer_id ?? ""}
                        onChange={(e) =>
                          void patchGoal(goal.id, { keyPerformerId: e.target.value || null })
                        }
                        style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "11.5px" }}
                      >
                        <option value="">Key Performer…</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>

                      {!isCompleted ? (
                        <button
                          type="button"
                          className="mini-save"
                          onClick={() => void patchGoal(goal.id, { action: "complete" })}
                          style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        >
                          <CheckCircle2 size={13} /> Complete Goal
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => void patchGoal(goal.id, { action: "reopen" })}
                          style={{ padding: "5px 10px", fontSize: "11.5px", minHeight: "28px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <RotateCcw size={12} /> Reopen
                        </button>
                      )}

                      <button
                        type="button"
                        className="mini-remove"
                        onClick={() => void handleDeleteGoal(goal.id)}
                        title="Delete goal"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ display: "grid", gap: "5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", fontWeight: 700 }}>
                    <span>Goal Progress</span>
                    <span style={{ color: isCompleted ? "var(--green, #167c58)" : "var(--ink)" }}>{goal.progress}%</span>
                  </div>
                  <div style={{ height: "8px", borderRadius: "999px", background: "var(--soft, #eef2ef)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${goal.progress}%`,
                        background: isCompleted ? "#16a34a" : "var(--green, #167c58)",
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Milestones & Achievements Two Columns */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", paddingTop: "6px", borderTop: "1px solid var(--line)" }}>
                  {/* Milestones */}
                  <div style={{ display: "grid", gap: "8px", alignContent: "start" }}>
                    <strong style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Flag size={13} style={{ color: "var(--green)" }} /> Milestones ({milestones.filter((m) => m.completed).length}/{milestones.length})
                    </strong>
                    {milestones.map((m) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px" }}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            const updated = milestones.map((item) =>
                              item.id === m.id
                                ? {
                                    ...item,
                                    completed: !item.completed,
                                    completedAt: !item.completed ? new Date().toISOString() : null,
                                  }
                                : item
                            );
                            void patchGoal(goal.id, { milestones: updated });
                          }}
                          style={{
                            border: 0,
                            background: "transparent",
                            padding: 0,
                            cursor: canEdit ? "pointer" : "default",
                            color: m.completed ? "#16a34a" : "var(--muted)",
                            display: "inline-flex",
                          }}
                        >
                          {m.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <span style={{ flex: 1, textDecoration: m.completed ? "line-through" : "none", opacity: m.completed ? 0.72 : 1 }}>
                          {m.title}
                        </span>
                      </div>
                    ))}
                    {canEdit && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                        <input
                          value={newMilestoneText[goal.id] ?? ""}
                          onChange={(e) =>
                            setNewMilestoneText((prev) => ({ ...prev, [goal.id]: e.target.value }))
                          }
                          placeholder="Add milestone…"
                          style={{ flex: 1, padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "11.5px" }}
                        />
                        <button
                          type="button"
                          className="mini-save"
                          onClick={() => {
                            const val = (newMilestoneText[goal.id] ?? "").trim();
                            if (!val) return;
                            const nextMs = [...milestones, { id: `ms-${Date.now()}`, title: val, completed: false }];
                            setNewMilestoneText((prev) => ({ ...prev, [goal.id]: "" }));
                            void patchGoal(goal.id, { milestones: nextMs });
                          }}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Achievements */}
                  <div style={{ display: "grid", gap: "8px", alignContent: "start" }}>
                    <strong style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Award size={13} style={{ color: "#d97706" }} /> Achievements ({achievements.length})
                    </strong>
                    {achievements.length > 0 ? (
                      achievements.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            background: "rgba(245, 158, 11, 0.09)",
                            border: "1px solid rgba(245, 158, 11, 0.25)",
                            fontSize: "12px",
                          }}
                        >
                          <Trophy size={14} style={{ color: "#d97706", flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <strong>{a.title}</strong>
                            {a.note && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{a.note}</div>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted small" style={{ margin: 0 }}>
                        Complete the goal or add an achievement milestone.
                      </p>
                    )}
                    {canEdit && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                        <input
                          value={newAchievementText[goal.id] ?? ""}
                          onChange={(e) =>
                            setNewAchievementText((prev) => ({ ...prev, [goal.id]: e.target.value }))
                          }
                          placeholder="Record achievement…"
                          style={{ flex: 1, padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "11.5px" }}
                        />
                        <button
                          type="button"
                          className="mini-save"
                          onClick={() => {
                            const val = (newAchievementText[goal.id] ?? "").trim();
                            if (!val) return;
                            const nextAch = [
                              ...achievements,
                              { id: `ach-${Date.now()}`, title: val, awardedAt: new Date().toISOString() },
                            ];
                            setNewAchievementText((prev) => ({ ...prev, [goal.id]: "" }));
                            void patchGoal(goal.id, { achievements: nextAch });
                          }}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
