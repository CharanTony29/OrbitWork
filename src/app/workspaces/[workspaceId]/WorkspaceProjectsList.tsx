"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Archive, CheckCircle, RotateCcw } from "lucide-react";
import { createProject, toggleProjectActiveStatus } from "@/app/actions";

type ProjectItem = {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
};

export default function WorkspaceProjectsList({
  workspaceId,
  projects,
  canManage,
}: {
  workspaceId: string;
  projects: ProjectItem[];
  canManage: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [showCreateBar, setShowCreateBar] = useState(false);

  const activeProjects = projects.filter((p) => p.status === "active");
  const inactiveProjects = projects.filter((p) => p.status === "archived" || p.status === "on_hold" || p.status === "completed");

  const filteredProjects =
    filter === "all"
      ? projects
      : filter === "active"
      ? activeProjects
      : inactiveProjects;

  return (
    <div className="workspace-projects-container">
      {/* Top Header Row with Status Tabs and Add Project Button */}
      <div className="project-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ margin: "0 0 4px" }}>PROJECT DIRECTORY</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Projects <span className="count-pill">{projects.length}</span>
            </h2>

            {/* Filter Tabs */}
            <div className="project-status-filter-tabs" style={{ display: "inline-flex", background: "var(--soft, #f1f5f2)", padding: 3, borderRadius: 8, gap: 3 }}>
              <button
                type="button"
                onClick={() => setFilter("active")}
                className={`proj-tab-btn ${filter === "active" ? "is-active" : ""}`}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filter === "active" ? "var(--paper, #fff)" : "transparent",
                  color: filter === "active" ? "var(--green, #167c58)" : "var(--muted, #64748b)",
                  boxShadow: filter === "active" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Active ({activeProjects.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("inactive")}
                className={`proj-tab-btn ${filter === "inactive" ? "is-active" : ""}`}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filter === "inactive" ? "var(--paper, #fff)" : "transparent",
                  color: filter === "inactive" ? "var(--green, #167c58)" : "var(--muted, #64748b)",
                  boxShadow: filter === "inactive" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Inactive ({inactiveProjects.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`proj-tab-btn ${filter === "all" ? "is-active" : ""}`}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filter === "all" ? "var(--paper, #fff)" : "transparent",
                  color: filter === "all" ? "var(--green, #167c58)" : "var(--muted, #64748b)",
                  boxShadow: filter === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                All ({projects.length})
              </button>
            </div>
          </div>
        </div>

        {/* Quick Add Project Toggle Button */}
        {canManage && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => setShowCreateBar((v) => !v)}
            style={{ minHeight: 34, height: 34, fontSize: 12, padding: "0 14px", gap: 6 }}
          >
            <Plus size={14} />
            <span>{showCreateBar ? "Cancel" : "Add Project"}</span>
          </button>
        )}
      </div>

      {/* Compact Inline Project Creator (matches normal task creation row) */}
      {showCreateBar && (
        <form
          action={createProject}
          className="compact-project-creator"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 9,
            border: "1px solid var(--green, #167c58)",
            background: "var(--soft, #f8fafc)",
            marginBottom: 16,
            flexWrap: "wrap",
            boxShadow: "0 2px 8px rgba(22, 124, 88, 0.08)",
          }}
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <FolderKanban size={16} color="var(--green, #167c58)" style={{ flexShrink: 0 }} />
          <input
            name="name"
            placeholder="Project name (e.g. Website Revamp, Mobile App)..."
            minLength={2}
            maxLength={120}
            required
            autoFocus
            style={{
              flex: "2 1 200px",
              height: 34,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--line, #cbd5e1)",
              background: "var(--paper, #fff)",
              fontSize: 12.5,
              outline: "none",
              color: "var(--ink)",
            }}
          />
          <input
            name="description"
            placeholder="Short description (optional)..."
            maxLength={2000}
            style={{
              flex: "3 1 250px",
              height: 34,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--line, #cbd5e1)",
              background: "var(--paper, #fff)",
              fontSize: 12.5,
              outline: "none",
              color: "var(--ink)",
            }}
          />
          <button
            type="submit"
            className="button button-primary"
            style={{ minHeight: 34, height: 34, fontSize: 12, padding: "0 14px", whiteSpace: "nowrap" }}
          >
            Create
          </button>
        </form>
      )}

      {/* Projects Grid */}
      {filteredProjects.length ? (
        <div className="project-grid">
          {filteredProjects.map((project) => {
            const isInactive = project.status === "archived" || project.status === "on_hold";
            return (
              <div
                key={project.id}
                className="project-card-wrapper"
                style={{
                  position: "relative",
                  borderRadius: 12,
                  border: "1px solid var(--line, #e2e8f0)",
                  background: isInactive ? "var(--soft, #f8fafc)" : "var(--paper, #fff)",
                  opacity: isInactive ? 0.85 : 1,
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <Link
                  className="project-card"
                  href={`/projects/${project.id}`}
                  style={{
                    padding: "16px 16px 12px",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div className="project-card-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span className="project-symbol">
                      <FolderKanban size={17} />
                    </span>
                    <span className={`project-state state-${project.status}`}>
                      {project.status === "archived" ? "Inactive" : project.status.replace("_", " ")}
                    </span>
                  </div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>{project.name}</h3>
                  <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)", flex: 1, lineHeight: 1.5 }}>
                    {project.description || "No project description yet."}
                  </p>
                  <div className="project-card-meta" style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)" }}>
                    <span>{project.priority} priority</span>
                    {project.due_date && (
                      <span>Due {new Date(`${project.due_date}T00:00:00`).toLocaleDateString()}</span>
                    )}
                  </div>
                </Link>

                {/* Inactive / Reactivate Action for Managers */}
                {canManage && (
                  <div
                    style={{
                      padding: "6px 14px 10px",
                      borderTop: "1px solid var(--line, #f1f5f9)",
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <form action={toggleProjectActiveStatus}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      {project.status === "active" ? (
                        <>
                          <input type="hidden" name="status" value="archived" />
                          <button
                            type="submit"
                            title="Mark project as inactive"
                            style={{
                              background: "transparent",
                              border: "1px solid var(--line, #cbd5e1)",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 10.5,
                              color: "var(--muted, #64748b)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Archive size={11} />
                            <span>Make Inactive</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <input type="hidden" name="status" value="active" />
                          <button
                            type="submit"
                            title="Reactivate project"
                            style={{
                              background: "rgba(22, 124, 88, 0.08)",
                              border: "1px solid var(--green, #167c58)",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 10.5,
                              color: "var(--green, #167c58)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontWeight: 600,
                            }}
                          >
                            <RotateCcw size={11} />
                            <span>Reactivate</span>
                          </button>
                        </>
                      )}
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-projects" style={{ padding: "36px 20px", textAlign: "center", border: "1px dashed var(--line, #cbd5e1)", borderRadius: 12 }}>
          <div className="empty-icon" style={{ margin: "0 auto 12px" }}>
            <FolderKanban size={21} />
          </div>
          <h3 style={{ margin: "0 0 6px" }}>
            {filter === "inactive" ? "No inactive projects" : "No projects yet"}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            {filter === "inactive"
              ? "All projects in this workspace are currently active."
              : "Create the first project in this workspace using the button above."}
          </p>
        </div>
      )}
    </div>
  );
}
