import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Kanban, Layers3, ShieldCheck } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Project Management Software | Kanban, Gantt, Subtasks & Custom Views",
  description:
    "Discover Orbitwork project management capabilities: Kanban boards, spreadsheet list views, Gantt charts, subtasks, progress tracking, custom fields, and role permissions.",
  path: "/services/project-management",
  keywords: [
    "project management software",
    "Kanban board",
    "Gantt timeline",
    "task management platform",
    "custom fields and subtasks",
  ],
});

export default function ProjectManagementPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="pm" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <Link href="/services">Solutions</Link>
              <span>/</span>
              <span>Project Management</span>
            </nav>
            <h1 className="hp-subpage-title">
              Flexible Project Management Built for How Your Team Actually Works
            </h1>
            <p className="hp-subpage-lead">
              Every role sees work differently. Orbitwork synchronizes List
              sheets, Kanban boards, Gantt timelines, Calendar schedules,
              Workload views, Whiteboards, and Flowcharts over one source of
              truth.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/signup" className="hp-btn-primary">
                Launch Free Workspace <ArrowRight size={16} />
              </Link>
              <Link href="/projects-case-studies" className="hp-btn-secondary">
                Explore Team Use Cases
              </Link>
            </div>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "52px 24px" }}>
          <div className="hp-section-header" style={{ marginBottom: 32 }}>
            <span className="hp-section-tag">Core Capabilities</span>
            <h2 className="hp-section-title">
              Structured control from personal tasks to multi-workspace portfolios
            </h2>
          </div>

          <div className="hp-three-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={22} />
              </div>
              <h3>Personalizable Project Views</h3>
              <p>
                Each team member—including Viewers—can reorder their own project
                tabs and customize List table columns independently without
                disrupting teammates.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Layers3 size={22} />
              </div>
              <h3>Deep Task Hierarchy</h3>
              <p>
                Break deliverables into subtasks with independent assignees and
                editable statuses, dynamic checklists, progress bars, and
                multi-value custom fields.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={22} />
              </div>
              <h3>Smart Alerts &amp; Email Updates</h3>
              <p>
                Keep everyone accountable with email notifications when tasks are
                assigned, reassigned, mentioned, completed, due today, or nearing
                budget hours.
              </p>
            </article>
          </div>

          <div
            className="hp-info-card"
            style={{ marginTop: 28, padding: 30, gap: 16 }}
          >
            <h2 style={{ margin: 0, fontSize: 22 }}>
              Included in Every Orbitwork Project
            </h2>
            <div className="hp-two-col-grid">
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  Personal Command Dashboard
                </div>
                <p>
                  Monitor assigned tasks, urgent priorities, in-progress work,
                  billed hours, and pinned favorites on your own dedicated dashboard.
                </p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  Rich Task Descriptions &amp; Resizable Images
                </div>
                <p>
                  Paste screenshots directly into task descriptions, resize images
                  cleanly inline, and collaborate with @mentions in task comments.
                </p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  Visual Whiteboards &amp; Flowcharts
                </div>
                <p>
                  Map project workflows visually and convert whiteboard nodes
                  directly into tracked deliverables on your sprint board.
                </p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  Global Ctrl+K Search &amp; CSV Export
                </div>
                <p>
                  Jump instantaneously to any task, document, workspace, or team
                  member from the top command search bar or export lists to CSV.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              <Link href="/projects-case-studies" className="hp-btn-secondary">
                See Use Cases
              </Link>
              <Link href="/signup" className="hp-btn-primary">
                Create Your Free Workspace <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Built for Every Department</h3>
            <ul
              className="hp-feature-bullets"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 10,
              }}
            >
              <li>
                <Check size={15} /> Software &amp; Product Development Teams
              </li>
              <li>
                <Check size={15} /> Digital Agencies &amp; Client Services
              </li>
              <li>
                <Check size={15} /> Operations, PMO &amp; Cross-Functional Programs
              </li>
              <li>
                <Check size={15} /> Consulting &amp; Billable Delivery Teams
              </li>
            </ul>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
