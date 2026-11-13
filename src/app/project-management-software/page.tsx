import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Cloud,
  FileText,
  FolderGit2,
  Kanban,
  Layers3,
  MessageSquare,
  ShieldCheck,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import {
  CANONICAL_LOGO_URL,
  buildCanonicalUrl,
  buildPublicMetadata,
} from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Project Management Software & Work Management Tool | Orbitwork",
  description:
    "Orbitwork is all-in-one project management software and work execution platform. Replace fragmented tools with Kanban boards, Gantt timelines, task sheets, docs, timesheets, and team chat.",
  path: "/project-management-software",
  keywords: [
    "project management software",
    "project management tool",
    "project management application",
    "project management app",
    "work management software",
    "task management platform",
    "collaborative project planning",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork Project Management Software",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: buildCanonicalUrl("/project-management-software"),
      image: CANONICAL_LOGO_URL,
      description:
        "Modern project management software and work execution platform uniting Kanban boards, Gantt charts, task sheets, time tracking, live chat, Markdown docs, and cloud storage.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What makes Orbitwork different from traditional project management software?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Orbitwork brings project planning, task management, time tracking, weekly timesheet approvals, real-time team chat, and living documentation into one coherent platform, eliminating the friction and subscription costs of multi-tool fragmentation.",
          },
        },
        {
          "@type": "Question",
          name: "What task views are supported in Orbitwork?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Orbitwork provides synchronized views for every working style: interactive spreadsheet Task Sheets, visual Kanban Boards, Gantt Timelines, Calendar schedules, Workload capacity planners, collaborative Whiteboards, and Flowcharts.",
          },
        },
        {
          "@type": "Question",
          name: "Can teams track billable hours and export timesheets?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork features integrated live stopwatch timers and manual duration entry, weekly timesheet approval workflows, balance tracking against task estimates, and one-click CSV export.",
          },
        },
        {
          "@type": "Question",
          name: "How does Orbitwork ensure enterprise data security and privacy?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Orbitwork utilizes PostgreSQL Row Level Security (RLS) for multi-tenant isolation, AES-256-GCM encryption for cloud credentials, granular role-based permissions (Owner, Admin, Member, Viewer), and full compliance with data privacy regulations.",
          },
        },
      ],
    },
  ],
};

export default function ProjectManagementSoftwarePage() {
  return (
    <div className="hp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <PublicSiteHeader active="pm-software" />

      <main>
        {/* Hero Section */}
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Project Management Software</span>
            </nav>

            <span className="hp-pill-tag" style={{ marginBottom: 16 }}>
              <Layers3 size={14} /> Comprehensive Work Management Platform
            </span>

            <h1 className="hp-subpage-title">
              Modern Project Management Software for Teams That Need Clarity, Not Chaos
            </h1>

            <p className="hp-subpage-lead">
              Orbitwork is the modern project management tool and application designed to replace disjointed software stacks. Plan projects, execute tasks across flexible views, track team hours, write documentation, and communicate in real time without endless context switching.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/signup" className="hp-btn-primary">
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link href="/free-project-management-software" className="hp-btn-secondary">
                View Free Plan
              </Link>
            </div>
          </div>
        </section>

        {/* The Problem with Fragmented Stacks */}
        <section className="hp-container" style={{ padding: "48px 24px" }}>
          <div className="hp-callout-box">
            <h4>The Problem: The Fragmented Tool Stack Tax</h4>
            <p>
              Most teams juggle Jira for tickets, Toggl or Harvest for time tracking, Google Docs or Notion for project specs, Slack for messaging, and Dropbox for files. Every handoff creates blind spots, lost updates, and duplicate software licenses. Orbitwork bridges these pillars into a single intuitive work management system where every task, message, doc, and hour spent connects to the same project deliverable.
            </p>
          </div>
        </section>

        {/* Major Capabilities */}
        <section className="hp-container" style={{ padding: "16px 24px 48px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Core Engine</span>
            <h2 className="hp-section-title">Major Capabilities of Orbitwork</h2>
            <p className="hp-section-desc" style={{ margin: "8px 0 0" }}>
              Explore the key pillars that power seamless collaboration across organizations.
            </p>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Multi-Perspective Task Views</h3>
              <p>
                Every project member works differently. Engineers prefer visual Kanban boards, finance and operations teams prefer structured spreadsheet tables, and project managers rely on Gantt timelines and workload charts. In Orbitwork, all views reflect real-time updates seamlessly.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Timer size={24} />
              </div>
              <h3>Integrated Time Tracking &amp; Weekly Timesheets</h3>
              <p>
                Track hours with a single click. Compare actual time against task estimates, prevent budget burnout with automated remaining-time alerts, and submit weekly timesheets for manager approval with zero third-party timer apps needed.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <FileText size={24} />
              </div>
              <h3>Living Project Documentation</h3>
              <p>
                Draft technical specifications, project briefs, and SOPs directly inside your project workspace. Rich Markdown support allows code snippets, resizable images, checklist items, and direct links to actionable task tickets.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <MessageSquare size={24} />
              </div>
              <h3>Built-In Team Chat &amp; Communication</h3>
              <p>
                Keep project discussions right where work happens. Use project-dedicated channels, direct messages, and contextual task comment threads with @mentions and automated email alerts.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Cloud size={24} />
              </div>
              <h3>Bring Your Own Cloud Storage</h3>
              <p>
                Connect Google Drive, Microsoft OneDrive, SharePoint, or use Orbitwork’s encrypted database storage. Your organization retains full control and governance over intellectual property and documents.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h3>Multi-Tenant Governance &amp; Security</h3>
              <p>
                Enterprise-grade architecture with PostgreSQL Row Level Security (RLS). Manage role permissions (Owner, Admin, Member, Viewer) with confidence across distinct organizations and workspaces.
              </p>
            </article>
          </div>
        </section>

        {/* Who Orbitwork Is Built For */}
        <section className="hp-container" style={{ padding: "24px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Audience Fit</span>
            <h2 className="hp-section-title">Who is Orbitwork project management software for?</h2>
          </div>

          <div className="hp-three-col-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            <div className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Zap size={22} />
              </div>
              <h3>Fast-Growing Startups</h3>
              <p>
                Move fast without drowning in configuration screens. Orbitwork provides sensible defaults, rapid project setup, and lightweight agile workflows that keep velocity high.
              </p>
            </div>

            <div className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Building2 size={22} />
              </div>
              <h3>Professional Services &amp; Agencies</h3>
              <p>
                Deliver client work on schedule and within budget. Accurately capture billable time, manage client stakeholder permissions, and export transparent timesheet records.
              </p>
            </div>

            <div className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Users size={22} />
              </div>
              <h3>Cross-Functional Product Teams</h3>
              <p>
                Align designers, product managers, engineers, and marketers under a single shared source of truth. Eliminate status meeting fatigue with real-time project dashboards.
              </p>
            </div>
          </div>
        </section>

        {/* Comparison Matrix with Other Tools */}
        <section className="hp-container" style={{ padding: "16px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Market Comparison</span>
            <h2 className="hp-section-title">Orbitwork vs. Fragmented Project Software</h2>
            <p className="hp-section-desc" style={{ margin: "8px 0 0" }}>
              See why teams choose Orbitwork over juggling separate specialized subscriptions.
            </p>
          </div>

          <div className="hp-table-container">
            <table className="hp-comparison-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th className="hp-highlight-col">Orbitwork</th>
                  <th>Fragmented Tool Stacks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Core Task Management</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Kanban, Sheet, Gantt, Calendar</td>
                  <td>Scattered across Jira or Trello</td>
                </tr>
                <tr>
                  <td><strong>Time Tracking &amp; Timesheets</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Native stopwatch &amp; weekly approval</td>
                  <td>Requires Harvest, Toggl, or Clockify add-on ($9–$15/user)</td>
                </tr>
                <tr>
                  <td><strong>Team Chat &amp; DMs</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Project channels &amp; direct chat built in</td>
                  <td>Requires separate Slack or Teams workspace</td>
                </tr>
                <tr>
                  <td><strong>Document Collaboration</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Markdown project docs linked to tasks</td>
                  <td>Detached Google Docs, Confluence, or Notion pages</td>
                </tr>
                <tr>
                  <td><strong>Cloud Storage</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Google Drive, OneDrive, SharePoint sync</td>
                  <td>Forced proprietary storage silos with costly upgrades</td>
                </tr>
                <tr>
                  <td><strong>Pricing &amp; Accessibility</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Generous free tier with full features</td>
                  <td>Tiered enterprise paywalls on basic views</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Internal Links Navigation */}
        <section className="hp-container" style={{ padding: "0 24px 64px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Related Guides &amp; Alternatives</span>
            <h2 className="hp-section-title">Explore Orbitwork Solutions &amp; Comparisons</h2>
          </div>

          <div className="hp-internal-links-grid">
            <Link href="/free-project-management-software" className="hp-link-card">
              <strong>Free Project Management Software <ArrowRight size={14} /></strong>
              <span>Start managing tasks, boards, and timesheets at zero upfront cost.</span>
            </Link>
            <Link href="/jira-alternative" className="hp-link-card">
              <strong>Jira Alternative <ArrowRight size={14} /></strong>
              <span>A faster, more intuitive platform for agile teams seeking relief from complexity.</span>
            </Link>
            <Link href="/free-jira-alternative" className="hp-link-card">
              <strong>Free Jira Alternative <ArrowRight size={14} /></strong>
              <span>Agile task management and sprint boards without steep user-tier license costs.</span>
            </Link>
            <Link href="/asana-alternative" className="hp-link-card">
              <strong>Asana Alternative <ArrowRight size={14} /></strong>
              <span>Complete work management with integrated timers, timesheets, and docs.</span>
            </Link>
            <Link href="/clickup-alternative" className="hp-link-card">
              <strong>ClickUp Alternative <ArrowRight size={14} /></strong>
              <span>Clean, high-performance all-in-one productivity without the UI lag.</span>
            </Link>
            <Link href="/services/project-management" className="hp-link-card">
              <strong>Project Management Deep Dive <ArrowRight size={14} /></strong>
              <span>Explore technical features: custom fields, checklists, and RLS data security.</span>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="hp-faq-section" style={{ borderTop: "1px solid var(--hp-line)", paddingTop: 56 }}>
          <div className="hp-container">
            <div className="hp-section-header">
              <span className="hp-section-tag">Knowledge Base</span>
              <h2 className="hp-section-title">Frequently Asked Questions</h2>
            </div>

            <div className="hp-faq-list">
              <details className="hp-faq-item">
                <summary>What is Orbitwork and how does it compare to other tools?</summary>
                <p>
                  Orbitwork is a unified project management and work collaboration platform that consolidates task management, Kanban boards, Gantt timelines, time tracking, weekly timesheet approvals, collaborative documentation, and team chat into one unified environment.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Can our team import or export project data?</summary>
                <p>
                  Yes. Orbitwork supports CSV export for tasks and weekly timesheets, allowing easy integration with internal reporting, payroll, or business intelligence tools.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>How does Orbitwork support project planning and deadlines?</summary>
                <p>
                  You can set task priorities (Low, Medium, High, Urgent), assign due dates and start dates, establish work estimates in hours or story points, and visualize deadlines on interactive Gantt timelines and workload calendars.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Is Orbitwork suitable for non-technical teams?</summary>
                <p>
                  Absolutely. Marketing agencies, operations departments, and HR teams love Orbitwork for its spreadsheet-like Task Sheets, visual Kanban boards, and built-in chat channels that require zero technical configuration.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="hp-container" style={{ margin: "56px auto" }}>
          <section className="hp-cta-banner">
            <h2>Experience high-clarity project management today</h2>
            <p>
              Get started with Orbitwork in seconds. Build workspaces, organize tasks, and unite your team.
            </p>
            <div className="hp-cta-buttons">
              <Link href="/signup" className="hp-btn-primary">
                Create Free Workspace <ArrowRight size={17} />
              </Link>
              <Link href="/free-project-management-software" className="hp-btn-secondary">
                Explore Free Plan
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
