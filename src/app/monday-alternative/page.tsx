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
  title: "Monday.com Alternative | Honest Work Management & Timers | Orbitwork",
  description:
    "Looking for a Monday.com alternative with transparent capabilities, built-in time tracking, and living docs? Discover Orbitwork for modern project teams.",
  path: "/monday-alternative",
  keywords: [
    "Monday.com alternative",
    "best Monday alternatives",
    "Monday project management alternative",
    "free Monday.com alternative",
    "work OS alternative",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork Monday.com Alternative",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: buildCanonicalUrl("/monday-alternative"),
      image: CANONICAL_LOGO_URL,
      description:
        "Modern Monday.com alternative offering task sheets, Kanban boards, Gantt timelines, native time tracking, timesheets, and team chat without restrictive user tier minimums.",
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
          name: "Why do teams look for a Monday.com alternative?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Monday.com enforces minimum user-seat purchases (e.g. 3-seat increments) and locks key features like time tracking, chart views, and integrations behind higher-tier plans. Orbitwork provides flexible project execution with native timers, timesheets, and docs included.",
          },
        },
        {
          "@type": "Question",
          name: "Does Orbitwork support spreadsheet and board views like Monday.com?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork features powerful interactive spreadsheet Task Sheets, visual Kanban Boards, Gantt Timelines, and Workload schedules.",
          },
        },
        {
          "@type": "Question",
          name: "Can teams track billable client time in Orbitwork?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork includes live stopwatch timers, manual time logging, weekly timesheet approvals, and one-click CSV export.",
          },
        },
      ],
    },
  ],
};

export default function MondayAlternativePage() {
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
              <span>Monday.com Alternative</span>
            </nav>

            <span className="hp-pill-tag" style={{ marginBottom: 16 }}>
              <Layers3 size={14} /> Clear, Honest Work Management
            </span>

            <h1 className="hp-subpage-title">
              The Monday.com Alternative Without Rigid Seat Minimums &amp; Tier Locks
            </h1>

            <p className="hp-subpage-lead">
              Love visual spreadsheets and status boards, but frustrated by Monday.com&apos;s 3-seat minimum packages and locking time tracking into expensive Pro tiers? Orbitwork provides full-featured work management built for real teams.
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

        {/* Honest Comparison Callout */}
        <section className="hp-container" style={{ padding: "48px 24px" }}>
          <div className="hp-callout-box">
            <h4>An Honest Assessment: Orbitwork vs. Monday.com</h4>
            <p>
              Monday.com is widely recognized for colorful visual tables, but its pricing policy forces teams into purchasing seats in 3-seat or 5-seat blocks. Furthermore, time tracking and private boards are reserved for high-priced Pro plans ($16–$24+/user/mo). Orbitwork provides an honest, transparent work management experience with native timers, timesheets, docs, and chat built in from the start.
            </p>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="hp-container" style={{ padding: "16px 24px 48px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Direct Comparison</span>
            <h2 className="hp-section-title">Orbitwork vs. Monday.com</h2>
          </div>

          <div className="hp-table-container">
            <table className="hp-comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="hp-highlight-col">Orbitwork</th>
                  <th>Monday.com</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Time Tracking &amp; Timesheets</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Native stopwatch &amp; weekly approvals</td>
                  <td>Locked behind Pro tier ($16–$24/user/mo)</td>
                </tr>
                <tr>
                  <td><strong>Minimum Seat Purchase</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> No artificial seat minimums</td>
                  <td>Strict 3-seat minimum requirement</td>
                </tr>
                <tr>
                  <td><strong>Task Sheets &amp; Kanban Boards</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Full interactive views included</td>
                  <td>Available, but advanced views gated by tier</td>
                </tr>
                <tr>
                  <td><strong>Real-Time Team Chat</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Dedicated project channels &amp; direct messages</td>
                  <td>Item update threads only; no real-time team chat</td>
                </tr>
                <tr>
                  <td><strong>Living Documentation</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Rich Markdown project docs linked to tasks</td>
                  <td>Monday Workdocs (separate document system)</td>
                </tr>
                <tr>
                  <td><strong>Cloud Storage Sync</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Google Drive, OneDrive, SharePoint</td>
                  <td>Third-party app integration required</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Key Advantages */}
        <section className="hp-container" style={{ padding: "24px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Why Switch</span>
            <h2 className="hp-section-title">Why teams choose Orbitwork over Monday.com</h2>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Native Time Tracking Without the Pro Tier Markup</h3>
              <p>
                In Monday.com, tracking hours on tasks requires upgrading your entire workspace to their Pro tier. Orbitwork includes live stopwatch timers and weekly timesheets for your whole team.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Custom Spreadsheet &amp; Board Views</h3>
              <p>
                Get the clarity of customizable spreadsheet sheets alongside drag-and-drop Kanban boards, Gantt timelines, and workload schedules.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <MessageSquare size={24} />
              </div>
              <h3>Integrated Team Chat &amp; DMs</h3>
              <p>
                Discuss projects in dedicated channels or 1:1 direct messages without leaving Orbitwork or paying for extra communication tools.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h3>Secure Multi-Tenant Architecture</h3>
              <p>
                Robust PostgreSQL Row Level Security (RLS) ensures clean isolation across your internal organizations, workspaces, and client accounts.
              </p>
            </article>
          </div>
        </section>

        {/* Internal Links Navigation */}
        <section className="hp-container" style={{ padding: "0 24px 64px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Explore Comparisons</span>
            <h2 className="hp-section-title">Discover other tool comparisons</h2>
          </div>

          <div className="hp-internal-links-grid">
            <Link href="/jira-alternative" className="hp-link-card">
              <strong>Jira Alternative <ArrowRight size={14} /></strong>
              <span>Compare agile workflows and issue tracking with zero configuration overhead.</span>
            </Link>
            <Link href="/free-jira-alternative" className="hp-link-card">
              <strong>Free Jira Alternative <ArrowRight size={14} /></strong>
              <span>Agile task management and sprint boards without steep user-tier license costs.</span>
            </Link>
            <Link href="/asana-alternative" className="hp-link-card">
              <strong>Asana Alternative <ArrowRight size={14} /></strong>
              <span>Work management with built-in time tracking, timesheets, and docs.</span>
            </Link>
            <Link href="/clickup-alternative" className="hp-link-card">
              <strong>ClickUp Alternative <ArrowRight size={14} /></strong>
              <span>All-in-one productivity with a focus on speed, clarity, and reliability.</span>
            </Link>
            <Link href="/free-project-management-software" className="hp-link-card">
              <strong>Free Project Management Software <ArrowRight size={14} /></strong>
              <span>Discover Orbitwork free capabilities for startups and small teams.</span>
            </Link>
            <Link href="/project-management-software" className="hp-link-card">
              <strong>Project Management Software <ArrowRight size={14} /></strong>
              <span>Read the comprehensive overview of Orbitwork architecture and features.</span>
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
                <summary>Can our team use Orbitwork like a spreadsheet work tracker?</summary>
                <p>
                  Yes. Orbitwork features an interactive Task Sheet view that provides spreadsheet-like ease for editing titles, priorities, assignees, dates, and estimates with one click.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Do I have to buy seats in packs of 3 or 5?</summary>
                <p>
                  No. Orbitwork does not force rigid multi-seat package minimums. You can start free and invite exactly the number of team members you need.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Can we connect our corporate Google Drive or OneDrive?</summary>
                <p>
                  Yes. Each workspace can link Google Drive, Microsoft OneDrive, SharePoint, or use built-in storage.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="hp-container" style={{ margin: "56px auto" }}>
          <section className="hp-cta-banner">
            <h2>Experience visual project management without the gimmicks</h2>
            <p>
              Get started with Orbitwork in seconds. Transparent, fast, and built for team clarity.
            </p>
            <div className="hp-cta-buttons">
              <Link href="/signup" className="hp-btn-primary">
                Get Started Free <ArrowRight size={17} />
              </Link>
              <Link href="/free-project-management-software" className="hp-btn-secondary">
                View Free Plan
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
