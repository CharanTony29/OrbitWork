import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Check, Code2, Layers3, Users } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Use Cases & Case Studies | Orbitwork Project Management",
  description:
    "Explore how product teams, client service agencies, operations leaders, and distributed organizations deliver projects cleanly with Orbitwork.",
  path: "/projects-case-studies",
});

const USE_CASES = [
  {
    icon: Code2,
    sector: "Software & Product Teams",
    title: "Sprint Planning, Dependencies & Visual Roadmaps",
    challenge:
      "Product managers, developers, and QA engineers needed to view the same sprint milestones differently without maintaining separate tools.",
    architecture:
      "Configured per-user project tab ordering (Board first for engineers, Flowchart/Gantt for leads), subtask assignees, and automated status & completion alerts.",
    outcomes: [
      "Zero duplicate updates across Kanban, Sheet, and Gantt views",
      "Real-time chat threads turn directly into tracked sprint tasks",
      "Instant visibility into urgent blockers and open deliverables",
    ],
  },
  {
    icon: Briefcase,
    sector: "Consulting & Client Agencies",
    title: "Billable Time Tracking, Weekly Timesheets & Client Access",
    challenge:
      "Agencies struggled to reconcile separate time-tracking apps with active client project deliverables and external viewer permissions.",
    architecture:
      "Deployed isolated multi-tenant client workspaces with Viewer access, live task timers, billable hour warnings, and weekly manager timesheet approvals.",
    outcomes: [
      "Accurate billable hours tied directly to each project task",
      "Clean CSV/PDF timesheet exports for client invoicing",
      "Clients review progress safely with Viewer role isolation",
    ],
  },
  {
    icon: Users,
    sector: "Distributed & Remote Organizations",
    title: "Unified Team Chat, Country Holidays & PTO Coordination",
    challenge:
      "Remote teammates missed critical updates across disconnected messaging channels and lacked visibility into regional public holidays and leave.",
    architecture:
      "Enabled persistent Orbitwork team chat with instant desktop & toast popups, @mentions, country public holiday automation, and PTO leave calendars.",
    outcomes: [
      "Persistent channel, group, and DM conversations synced in real time",
      "Automatic national holiday calendars per organization country",
      "Balanced team capacity across Workload and Calendar views",
    ],
  },
  {
    icon: Layers3,
    sector: "Operations & Internal PMO",
    title: "Controlled Project Documentation & Cloud Storage Governance",
    challenge:
      "SOPs, project briefs, and attachments lived scattered across personal drives without version history or structured security.",
    architecture:
      "Connected Google Drive, Microsoft OneDrive, and SharePoint per workspace using encrypted OAuth tokens alongside versioned Markdown project docs.",
    outcomes: [
      "Living specifications linked directly to active execution tasks",
      "One-click HTML and PDF documentation exports for stakeholders",
      "Enterprise-grade PostgreSQL Row Level Security across organizations",
    ],
  },
];

export default function ProjectsCaseStudiesPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="projects" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Use Cases &amp; Case Studies</span>
            </nav>
            <h1 className="hp-subpage-title">
              Project Management Use Cases &amp; Workflow Blueprints
            </h1>
            <p className="hp-subpage-lead">
              See how cross-functional teams configure Orbitwork for software
              delivery, client agencies, PMO governance, and distributed
              collaboration.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/signup" className="hp-btn-primary">
                Try Orbitwork Free <ArrowRight size={16} />
              </Link>
              <Link href="/services/project-management" className="hp-btn-secondary">
                Explore Project Features
              </Link>
            </div>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "52px 24px" }}>
          <div className="hp-two-col-grid">
            {USE_CASES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="hp-info-card">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div className="hp-feature-icon-wrap" style={{ marginBottom: 0 }}>
                      <Icon size={22} />
                    </div>
                    <span className="hp-section-tag" style={{ marginBottom: 0 }}>
                      {item.sector}
                    </span>
                  </div>
                  <h2 style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 750 }}>
                    {item.title}
                  </h2>
                  <p>
                    <strong>Challenge:</strong> {item.challenge}
                  </p>
                  <p>
                    <strong>Solution:</strong> {item.architecture}
                  </p>
                  <ul className="hp-feature-bullets" style={{ marginTop: 4 }}>
                    {item.outcomes.map((out) => (
                      <li key={out}>
                        <Check size={15} /> {out}
                      </li>
                    ))}
                  </ul>
                  <Link href="/contact" className="hp-inline-link">
                    Ask how to set up this workflow <ArrowRight size={14} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
