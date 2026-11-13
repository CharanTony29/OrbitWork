import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  FolderGit2,
  Kanban,
  Layers3,
  MessageSquare,
  ShieldCheck,
  Sparkles,
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
  title: "Asana Alternative | Task & Project Management with Native Timers | Orbitwork",
  description:
    "Looking for an honest Asana alternative? Orbitwork brings tasks, Kanban boards, Gantt timelines, native time tracking, timesheets, and docs together without expensive tiers.",
  path: "/asana-alternative",
  keywords: [
    "Asana alternative",
    "best Asana alternatives",
    "free Asana alternative",
    "Asana competitors",
    "work management tool",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork Asana Alternative",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: buildCanonicalUrl("/asana-alternative"),
      image: CANONICAL_LOGO_URL,
      description:
        "Modern Asana alternative providing Kanban boards, task sheets, Gantt timelines, built-in time tracking, timesheet approvals, and integrated team chat.",
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
          name: "Why choose Orbitwork over Asana?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Asana places key features like native time tracking, advanced timeline views, and workflow rules behind higher-priced premium and business tiers. Orbitwork includes Kanban boards, spreadsheet task sheets, Gantt timelines, live time tracking, weekly timesheets, and team chat without steep tier paywalls.",
          },
        },
        {
          "@type": "Question",
          name: "Does Orbitwork offer built-in time tracking?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Unlike Asana, which historically relied heavily on third-party timer integrations or higher tiers, Orbitwork provides native live timers and weekly timesheet approval workflows.",
          },
        },
        {
          "@type": "Question",
          name: "Can our team organize tasks into boards, lists, and timelines?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork lets you switch instantly between spreadsheet Task Sheets, Kanban Boards, Gantt Timelines, and Workload schedules.",
          },
        },
      ],
    },
  ],
};

export default function AsanaAlternativePage() {
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
              <span>Asana Alternative</span>
            </nav>

            <span className="hp-pill-tag" style={{ marginBottom: 16 }}>
              <Layers3 size={14} /> Full-Featured Work Management
            </span>

            <h1 className="hp-subpage-title">
              The Asana Alternative with Built-In Time Tracking &amp; Team Chat
            </h1>

            <p className="hp-subpage-lead">
              Love organized task lists and clean boards, but tired of hitting Asana&apos;s paywalls for timelines and time tracking? Orbitwork brings projects, Kanban boards, Gantt timelines, timers, timesheets, and docs together seamlessly.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/signup" className="hp-btn-primary">
                Try Orbitwork Free <ArrowRight size={16} />
              </Link>
              <Link href="/free-project-management-software" className="hp-btn-secondary">
                Explore Free Plan
              </Link>
            </div>
          </div>
        </section>

        {/* Comparison Callout */}
        <section className="hp-container" style={{ padding: "48px 24px" }}>
          <div className="hp-callout-box">
            <h4>An Honest Assessment: Orbitwork vs. Asana</h4>
            <p>
              Asana is a polished project management tool, but its pricing structure frequently pushes small teams and startups into expensive Business plans ($24.99+/user/mo) just to access time tracking, workload views, and advanced timelines. Orbitwork was built from the ground up to give teams comprehensive execution tools—including live stopwatch tracking, timesheets, living Markdown docs, and real-time chat—without ballooning your software budget.
            </p>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="hp-container" style={{ padding: "16px 24px 48px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Direct Comparison</span>
            <h2 className="hp-section-title">Orbitwork vs. Asana</h2>
          </div>

          <div className="hp-table-container">
            <table className="hp-comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="hp-highlight-col">Orbitwork</th>
                  <th>Asana</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Time Tracking &amp; Timesheets</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Native live stopwatch &amp; weekly approvals</td>
                  <td>Limited on basic plans; requires higher tiers or third-party add-ons</td>
                </tr>
                <tr>
                  <td><strong>Gantt &amp; Timeline Views</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Available out of the box</td>
                  <td>Locked behind paid tiers</td>
                </tr>
                <tr>
                  <td><strong>Real-Time Team Chat</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Dedicated project channels &amp; direct messages</td>
                  <td>None (must integrate with Slack or Microsoft Teams)</td>
                </tr>
                <tr>
                  <td><strong>Cloud Storage Choice</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Connect Google Drive, OneDrive, SharePoint</td>
                  <td>Third-party links only; files stored separately</td>
                </tr>
                <tr>
                  <td><strong>Collaborative Docs</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Rich Markdown docs linked to project tasks</td>
                  <td>Basic task descriptions; lacks integrated document editor</td>
                </tr>
                <tr>
                  <td><strong>Free Accessibility</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Generous free plan with core capabilities</td>
                  <td>Restricted free plan with frequent upgrade triggers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Key Advantages */}
        <section className="hp-container" style={{ padding: "24px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Why Switch</span>
            <h2 className="hp-section-title">Why teams choose Orbitwork over Asana</h2>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Native Time Tracking for Agencies &amp; Consultants</h3>
              <p>
                If you bill clients by the hour or need to monitor project margins, Orbitwork gives you built-in timers and weekly timesheet approval workflows without buying extra software.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Flexible Task Views Without Paywalls</h3>
              <p>
                Switch between List sheets, Kanban boards, Gantt timelines, and Workload planners smoothly. Every teammate can customize their view without disrupting others.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <MessageSquare size={24} />
              </div>
              <h3>Unified Chat &amp; Work Execution</h3>
              <p>
                Eliminate the disconnect between discussion and execution. Chat with colleagues directly within project context and turn conversations into actionable tasks.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h3>Multi-Tenant Data Privacy</h3>
              <p>
                Orbitwork isolates client workspaces securely using PostgreSQL Row Level Security (RLS), giving agencies peace of mind when managing multiple client engagements.
              </p>
            </article>
          </div>
        </section>

        {/* Internal Links Navigation */}
        <section className="hp-container" style={{ padding: "0 24px 64px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Explore Comparisons</span>
            <h2 className="hp-section-title">Compare other project management alternatives</h2>
          </div>

          <div className="hp-internal-links-grid">
            <Link href="/jira-alternative" className="hp-link-card">
              <strong>Jira Alternative <ArrowRight size={14} /></strong>
              <span>Compare Orbitwork with Jira for agile development and sprint planning.</span>
            </Link>
            <Link href="/free-jira-alternative" className="hp-link-card">
              <strong>Free Jira Alternative <ArrowRight size={14} /></strong>
              <span>Explore free agile task management without costly user license fees.</span>
            </Link>
            <Link href="/clickup-alternative" className="hp-link-card">
              <strong>ClickUp Alternative <ArrowRight size={14} /></strong>
              <span>All-in-one productivity with a focus on speed, clarity, and reliability.</span>
            </Link>
            <Link href="/monday-alternative" className="hp-link-card">
              <strong>Monday.com Alternative <ArrowRight size={14} /></strong>
              <span>Visual boards and spreadsheets without complicated enterprise pricing.</span>
            </Link>
            <Link href="/free-project-management-software" className="hp-link-card">
              <strong>Free Project Management Software <ArrowRight size={14} /></strong>
              <span>Discover Orbitwork free capabilities for startups and small teams.</span>
            </Link>
            <Link href="/project-management-software" className="hp-link-card">
              <strong>Project Management Software <ArrowRight size={14} /></strong>
              <span>Learn about Orbitwork platform capabilities and system architecture.</span>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="hp-faq-section" style={{ borderTop: "1px solid var(--hp-line)", paddingTop: 56 }}>
          <div className="hp-container">
            <div className="hp-section-header">
              <span className="hp-section-tag">Questions</span>
              <h2 className="hp-section-title">Frequently Asked Questions</h2>
            </div>

            <div className="hp-faq-list">
              <details className="hp-faq-item">
                <summary>Is Orbitwork easier for small teams than Asana?</summary>
                <p>
                  Yes. Orbitwork includes the tools small teams need—task boards, timelines, time tracking, timesheets, and docs—in a straightforward interface without aggressive upsell prompts.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Can I import existing tasks into Orbitwork?</summary>
                <p>
                  Yes. Orbitwork allows you to export your data to CSV and easily import tasks into your new workspaces.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Does Orbitwork support custom task priorities and due dates?</summary>
                <p>
                  Yes. You can assign priorities (Low, Medium, High, Urgent), start dates, due dates, estimates, and checklist items to any task.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="hp-container" style={{ margin: "56px auto" }}>
          <section className="hp-cta-banner">
            <h2>Experience a smarter Asana alternative today</h2>
            <p>
              Consolidate your tasks, timers, and team chat in one clean workspace.
            </p>
            <div className="hp-cta-buttons">
              <Link href="/signup" className="hp-btn-primary">
                Get Started Free <ArrowRight size={17} />
              </Link>
              <Link href="/free-project-management-software" className="hp-btn-secondary">
                View Free Features
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
