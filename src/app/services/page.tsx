import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Cloud, Clock, Kanban, MessageSquare } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Solutions | Project Management, Time Tracking, Docs & Team Chat",
  description:
    "Explore Orbitwork solutions for agile task execution, time tracking and weekly timesheets, real-time team chat, living Markdown docs, and encrypted cloud storage.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="services" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Solutions</span>
            </nav>
            <h1 className="hp-subpage-title">
              Everything Your Team Needs to Plan, Track &amp; Deliver Projects
            </h1>
            <p className="hp-subpage-lead">
              Orbitwork brings project planning, real-time team communication,
              billable time tracking, and cloud document storage into a single,
              unified workspace built for speed and clarity.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/services/project-management" className="hp-btn-primary">
                Deep Dive: Project Management <ArrowRight size={16} />
              </Link>
              <Link href="/signup" className="hp-btn-secondary">
                Get Started Free
              </Link>
            </div>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "52px 24px" }}>
          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Project &amp; Task Management</h3>
              <p>
                Switch between List sheets, Kanban boards, Gantt timelines,
                Calendars, Workload capacity, Whiteboards, and Flowcharts with
                custom user layouts.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Subtasks with dedicated assignees &amp; status editing
                </li>
                <li>
                  <Check size={15} /> Multi-value custom fields, checklists &amp; progress bars
                </li>
                <li>
                  <Check size={15} /> Dependency mapping &amp; automated task notifications
                </li>
              </ul>
              <Link href="/services/project-management" className="hp-inline-link">
                Explore Project Management <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <MessageSquare size={24} />
              </div>
              <h3>Team Chat &amp; Project Channels</h3>
              <p>
                Keep conversations organized in persistent workspace channels,
                custom group chats, and direct messages with instant desktop &amp;
                in-app popups.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Direct screenshot paste (Ctrl+V) &amp; file sharing
                </li>
                <li>
                  <Check size={15} /> Share Orbitwork tasks, projects &amp; docs inline
                </li>
                <li>
                  <Check size={15} /> Convert any chat message into a task in 1 click
                </li>
              </ul>
              <Link href="/projects-case-studies" className="hp-inline-link">
                See Collaboration Use Cases <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Time Tracking, Timesheets &amp; Holidays</h3>
              <p>
                Track live task timers, separate billable vs. non-billable
                hours, submit weekly timesheets for manager sign-off, and sync
                country public holidays.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Real-time stopwatches &amp; remaining estimate alerts
                </li>
                <li>
                  <Check size={15} /> Team PTO leave calendar &amp; country holidays
                </li>
                <li>
                  <Check size={15} /> Instant CSV and PDF utilization exports
                </li>
              </ul>
              <Link href="/contact" className="hp-inline-link">
                Talk to Our Team <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Cloud size={24} />
              </div>
              <h3>Living Docs &amp; Multi-Cloud Storage</h3>
              <p>
                Create Markdown project documentation with full version history
                and store attachments in Google Drive, OneDrive, SharePoint, or
                built-in local storage.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Resizable inline images &amp; task widget embeds
                </li>
                <li>
                  <Check size={15} /> AES-256-GCM encrypted workspace cloud credentials
                </li>
                <li>
                  <Check size={15} /> Download any specification cleanly as HTML or PDF
                </li>
              </ul>
              <Link href="/signup" className="hp-inline-link">
                Start Free Workspace <ArrowRight size={14} />
              </Link>
            </article>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
