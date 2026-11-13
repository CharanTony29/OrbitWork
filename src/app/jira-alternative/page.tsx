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
  title: "Jira Alternative for Fast Teams | Simple & Powerful | Orbitwork",
  description:
    "Looking for a modern Jira alternative? Orbitwork delivers fast, clutter-free project and agile task management with built-in time tracking, docs, and team chat.",
  path: "/jira-alternative",
  keywords: [
    "Jira alternative",
    "best Jira alternatives",
    "simple Jira alternative",
    "agile project management tool",
    "lightweight Jira alternative",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork Jira Alternative",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: buildCanonicalUrl("/jira-alternative"),
      image: CANONICAL_LOGO_URL,
      description:
        "Fast, modern Jira alternative offering Kanban boards, Gantt timelines, built-in time tracking, docs, and real-time chat without administrative complexity.",
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
          name: "Why do teams look for a Jira alternative?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Many teams find Jira over-engineered, slow to navigate, and complex to configure for daily work. Orbitwork offers a fast, clean alternative that combines agile boards with built-in time tracking, documentation, and chat without requiring a full-time Jira administrator.",
          },
        },
        {
          "@type": "Question",
          name: "Does Orbitwork support agile workflows like Kanban and sprint planning?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork includes drag-and-drop Kanban boards, spreadsheet task sheets, task estimation (in hours or days), custom task types (Task, Bug, Story, Epic), and subtask checklists.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need a separate time tracking plugin like in Jira?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. While Jira typically requires third-party plugins (like Tempo or Harvest) for robust time tracking, Orbitwork includes built-in live timers, time logging, and weekly timesheet approvals at no extra cost.",
          },
        },
        {
          "@type": "Question",
          name: "Can non-developers use Orbitwork alongside engineering teams?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork's intuitive design allows designers, marketers, and operations staff to collaborate seamlessly with engineers using views that suit their preferences (List sheets, Calendars, Timelines).",
          },
        },
      ],
    },
  ],
};

export default function JiraAlternativePage() {
  return (
    <div className="hp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <PublicSiteHeader active="jira-alt" />

      <main>
        {/* Hero Section */}
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Jira Alternative</span>
            </nav>

            <span className="hp-pill-tag" style={{ marginBottom: 16 }}>
              <Zap size={14} /> Modern, Agile &amp; High-Velocity
            </span>

            <h1 className="hp-subpage-title">
              A Calmer, Faster Jira Alternative Built for Focused Modern Teams
            </h1>

            <p className="hp-subpage-lead">
              Tired of complex ticket schemes, slow page loads, and needing an administrator just to update a project workflow? Orbitwork delivers the agile execution you need with zero configuration bloat, built-in time tracking, and living documentation.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/signup" className="hp-btn-primary">
                Switch to Orbitwork Free <ArrowRight size={16} />
              </Link>
              <Link href="/free-jira-alternative" className="hp-btn-secondary">
                Explore Free Jira Alternative
              </Link>
            </div>
          </div>
        </section>

        {/* Honest Comparison Overview */}
        <section className="hp-container" style={{ padding: "48px 24px" }}>
          <div className="hp-callout-box">
            <h4>An Honest Comparison: When Jira Makes Sense vs. When Orbitwork Excels</h4>
            <p>
              Jira is a powerful legacy enterprise platform designed for massive corporations with complex compliance rules, legacy IT departments, and custom workflow schemes. However, for fast-moving startups, agile tech companies, and agencies, Jira often slows teams down. Orbitwork provides a nimble, all-in-one alternative that gives you boards, timelines, time tracking, docs, and chat out of the box—with lightning-fast performance.
            </p>
          </div>
        </section>

        {/* Feature-by-Feature Comparison Table */}
        <section className="hp-container" style={{ padding: "16px 24px 48px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Direct Comparison</span>
            <h2 className="hp-section-title">Orbitwork vs. Atlassian Jira</h2>
            <p className="hp-section-desc" style={{ margin: "8px 0 0" }}>
              Side-by-side comparison across day-to-day workflow requirements.
            </p>
          </div>

          <div className="hp-table-container">
            <table className="hp-comparison-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th className="hp-highlight-col">Orbitwork</th>
                  <th>Atlassian Jira</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Speed &amp; User Experience</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Instant, lightweight Next.js UI</td>
                  <td>Heavy, complex interface with frequent loading states</td>
                </tr>
                <tr>
                  <td><strong>Time Tracking &amp; Timesheets</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Built-in live stopwatch &amp; weekly approvals</td>
                  <td>Requires expensive marketplace plugins (e.g., Tempo)</td>
                </tr>
                <tr>
                  <td><strong>Team Chat &amp; Messaging</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Native project channels and direct messages</td>
                  <td>None (requires external Slack/Teams integration)</td>
                </tr>
                <tr>
                  <td><strong>Project Documentation</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Living Markdown docs linked to tasks</td>
                  <td>Requires separate Confluence subscription</td>
                </tr>
                <tr>
                  <td><strong>Cloud Storage Choice</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Connect Google Drive, OneDrive, SharePoint</td>
                  <td>Locked to Atlassian Cloud storage limits</td>
                </tr>
                <tr>
                  <td><strong>Configuration Complexity</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Zero setup required; instant onboarding</td>
                  <td>Requires dedicated Jira admin and custom schema setup</td>
                </tr>
                <tr>
                  <td><strong>Non-Developer Accessibility</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Loved by design, ops, and marketing</td>
                  <td>Frequently disliked or avoided by non-technical staff</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Why Teams Switch */}
        <section className="hp-container" style={{ padding: "24px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Key Advantages</span>
            <h2 className="hp-section-title">Why teams choose Orbitwork as their Jira alternative</h2>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Zap size={24} />
              </div>
              <h3>Fast Agile Execution Without the Overhead</h3>
              <p>
                Get straight to work with Kanban boards, customizable task statuses, subtask checklists, and priority tagging. No spending hours configuring issue types, permission schemes, or complex workflow validators.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Built-In Time Tracking Without Marketplace Add-Ons</h3>
              <p>
                In Jira, tracking billable client time usually requires paying an extra $5–$10 per user for third-party marketplace apps. Orbitwork gives your entire team native stopwatch timers and weekly timesheet approval workflows included.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <FileText size={24} />
              </div>
              <h3>Docs Integrated with Tasks, Not in a Disconnected Wiki</h3>
              <p>
                Forget jumping between Jira and Confluence tabs. Orbitwork docs live right inside your project, allowing engineers and product managers to draft architecture decisions, specs, and release plans right next to the work.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Users size={24} />
              </div>
              <h3>A Tool That Your Entire Company Enjoys Using</h3>
              <p>
                Jira is notorious for creating silos where engineers work in Jira while marketing, sales, and executives avoid it. Orbitwork’s clean, modern interface welcomes every discipline to collaborate together seamlessly.
              </p>
            </article>
          </div>
        </section>

        {/* Internal Links Navigation */}
        <section className="hp-container" style={{ padding: "0 24px 64px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Compare More Tools</span>
            <h2 className="hp-section-title">Explore other popular comparisons &amp; guides</h2>
          </div>

          <div className="hp-internal-links-grid">
            <Link href="/free-jira-alternative" className="hp-link-card">
              <strong>Free Jira Alternative <ArrowRight size={14} /></strong>
              <span>Compare free agile task management without expensive user seat tiers.</span>
            </Link>
            <Link href="/free-project-management-software" className="hp-link-card">
              <strong>Free Project Management Software <ArrowRight size={14} /></strong>
              <span>Discover Orbitwork free capabilities for startups and small teams.</span>
            </Link>
            <Link href="/project-management-software" className="hp-link-card">
              <strong>Project Management Software <ArrowRight size={14} /></strong>
              <span>Read the comprehensive overview of Orbitwork architecture and features.</span>
            </Link>
            <Link href="/asana-alternative" className="hp-link-card">
              <strong>Asana Alternative <ArrowRight size={14} /></strong>
              <span>See how Orbitwork compares to Asana for task and work management.</span>
            </Link>
            <Link href="/clickup-alternative" className="hp-link-card">
              <strong>ClickUp Alternative <ArrowRight size={14} /></strong>
              <span>Compare all-in-one productivity with a focus on speed and reliability.</span>
            </Link>
            <Link href="/monday-alternative" className="hp-link-card">
              <strong>Monday.com Alternative <ArrowRight size={14} /></strong>
              <span>Compare visual boards and spreadsheets without complicated enterprise pricing.</span>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="hp-faq-section" style={{ borderTop: "1px solid var(--hp-line)", paddingTop: 56 }}>
          <div className="hp-container">
            <div className="hp-section-header">
              <span className="hp-section-tag">Questions &amp; Answers</span>
              <h2 className="hp-section-title">Frequently Asked Questions</h2>
            </div>

            <div className="hp-faq-list">
              <details className="hp-faq-item">
                <summary>Can Orbitwork handle software development tasks like Jira?</summary>
                <p>
                  Yes. Orbitwork supports custom task types (Task, Bug, Story, Epic), work estimation in hours or story points, assignees, subtasks, priority levels, and progress tracking on agile Kanban boards.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Is Orbitwork easier to configure than Jira?</summary>
                <p>
                  Much easier. There is zero need to configure complex issue type schemes, screen schemes, or permission validators. Workspaces and projects work intuitively right out of the box.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Does Orbitwork cost less than Jira?</summary>
                <p>
                  Yes. Orbitwork offers a generous free plan, and because it includes built-in time tracking, timesheets, and documentation, you avoid paying for additional Jira Marketplace plugins and separate Confluence licenses.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>How do we migrate our projects to Orbitwork?</summary>
                <p>
                  You can set up workspaces and projects in minutes. Orbitwork supports CSV exports and imports, allowing quick transition of active task lists.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="hp-container" style={{ margin: "56px auto" }}>
          <section className="hp-cta-banner">
            <h2>Ready for a faster, simpler Jira alternative?</h2>
            <p>
              Join teams shipping software faster with Orbitwork. Free to start, no credit card required.
            </p>
            <div className="hp-cta-buttons">
              <Link href="/signup" className="hp-btn-primary">
                Get Started Free <ArrowRight size={17} />
              </Link>
              <Link href="/free-jira-alternative" className="hp-btn-secondary">
                View Free Jira Alternative
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
