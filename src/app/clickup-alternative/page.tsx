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
  title: "ClickUp Alternative | Fast & Focused Project Management | Orbitwork",
  description:
    "Looking for a ClickUp alternative without the feature bloat or slow loading? Orbitwork offers fast, unified task management, Gantt charts, timesheets, and chat.",
  path: "/clickup-alternative",
  keywords: [
    "ClickUp alternative",
    "best ClickUp alternatives",
    "simple ClickUp alternative",
    "fast project management software",
    "all in one productivity alternative",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork ClickUp Alternative",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: buildCanonicalUrl("/clickup-alternative"),
      image: CANONICAL_LOGO_URL,
      description:
        "Fast, uncluttered ClickUp alternative offering Kanban boards, Gantt timelines, built-in time tracking, timesheet approvals, and team chat without UI lag.",
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
          name: "Why do teams look for a ClickUp alternative?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "While ClickUp offers a vast number of features, many users experience significant interface lag, complex menu hierarchies, and frequent buggy updates. Orbitwork focuses on high performance, clarity, and dependable execution without feature overwhelm.",
          },
        },
        {
          "@type": "Question",
          name: "Does Orbitwork include time tracking and documentation like ClickUp?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork features integrated live stopwatch timers, weekly timesheet approvals, and rich Markdown documentation that connects directly to project tasks.",
          },
        },
        {
          "@type": "Question",
          name: "How does Orbitwork perform in terms of speed and responsiveness?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Orbitwork is built on modern Next.js architecture with optimized state caching and minimal bundle overhead, delivering snappy page transitions and instant updates.",
          },
        },
      ],
    },
  ],
};

export default function ClickUpAlternativePage() {
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
              <span>ClickUp Alternative</span>
            </nav>

            <span className="hp-pill-tag" style={{ marginBottom: 16 }}>
              <Zap size={14} /> Fast, Responsive &amp; Intuitive
            </span>

            <h1 className="hp-subpage-title">
              The Fast ClickUp Alternative That Won&apos;t Overwhelm Your Team
            </h1>

            <p className="hp-subpage-lead">
              Love the idea of an &quot;all-in-one&quot; workspace, but frustrated by slow load times, cluttered navigation, and endless toggles? Orbitwork delivers the unified power of tasks, boards, timelines, time tracking, and chat with lightning speed.
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
            <h4>An Honest Assessment: Orbitwork vs. ClickUp</h4>
            <p>
              ClickUp promises to be the &quot;one app to replace them all,&quot; packing in hundreds of settings, views, and integrations. For many teams, however, this results in sluggish performance, confusing sub-menus, and team members struggling to find basic tasks. Orbitwork provides a carefully curated workspace with the essential tools teams actually use daily—Kanban boards, task sheets, Gantt timelines, time tracking, timesheets, docs, and chat—built for pure speed and simplicity.
            </p>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="hp-container" style={{ padding: "16px 24px 48px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Feature Comparison</span>
            <h2 className="hp-section-title">Orbitwork vs. ClickUp</h2>
          </div>

          <div className="hp-table-container">
            <table className="hp-comparison-table">
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th className="hp-highlight-col">Orbitwork</th>
                  <th>ClickUp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Interface Speed &amp; Responsiveness</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Fast, lightweight Next.js app</td>
                  <td>Frequently reported as slow or laggy on large projects</td>
                </tr>
                <tr>
                  <td><strong>Ease of Use &amp; Onboarding</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Clean hierarchy: Org → Workspace → Project</td>
                  <td>Complex nested hierarchy (Spaces, Folders, Lists, Tasks)</td>
                </tr>
                <tr>
                  <td><strong>Time Tracking &amp; Timesheets</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Built-in live stopwatch &amp; weekly approvals</td>
                  <td>Available, but can feel cluttered with excessive options</td>
                </tr>
                <tr>
                  <td><strong>Team Chat &amp; Communication</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Dedicated project channels &amp; direct messages</td>
                  <td>Basic chat view; often secondary to ticket views</td>
                </tr>
                <tr>
                  <td><strong>Cloud Storage Integration</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Connect Google Drive, OneDrive, SharePoint</td>
                  <td>Proprietary storage tiers with upgrade limits</td>
                </tr>
                <tr>
                  <td><strong>Bug Frequency &amp; Stability</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Rock-solid Postgres RLS foundation</td>
                  <td>Frequent UI changes and reported interface glitches</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Why Teams Choose Orbitwork */}
        <section className="hp-container" style={{ padding: "24px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Key Advantages</span>
            <h2 className="hp-section-title">Why teams switch from ClickUp to Orbitwork</h2>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Zap size={24} />
              </div>
              <h3>Clarity Over Clutter</h3>
              <p>
                Orbitwork gives you the exact tools your team needs without burying them under thousands of toggle switches and configuration panels.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Seamless Time Tracking &amp; Weekly Approvals</h3>
              <p>
                Log hours, measure actuals against estimates, and submit weekly timesheets for approval with zero friction.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <FileText size={24} />
              </div>
              <h3>Living Project Documentation</h3>
              <p>
                Create clean Markdown documents linked directly to your tasks, ensuring technical specs and SOPs are always up to date.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h3>Bring Your Own Cloud Storage</h3>
              <p>
                Keep project files inside your company&apos;s existing Google Drive or Microsoft 365 environment, maintaining compliance and avoiding storage markups.
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
              <span>Compare agile task execution without heavy enterprise administration.</span>
            </Link>
            <Link href="/free-jira-alternative" className="hp-link-card">
              <strong>Free Jira Alternative <ArrowRight size={14} /></strong>
              <span>Agile task management and sprint boards without steep user-tier license costs.</span>
            </Link>
            <Link href="/asana-alternative" className="hp-link-card">
              <strong>Asana Alternative <ArrowRight size={14} /></strong>
              <span>Task management with built-in time tracking, timesheets, and docs.</span>
            </Link>
            <Link href="/monday-alternative" className="hp-link-card">
              <strong>Monday.com Alternative <ArrowRight size={14} /></strong>
              <span>Straightforward boards and sheets without multi-tier subscription locks.</span>
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
                <summary>Is Orbitwork really faster than ClickUp?</summary>
                <p>
                  Yes. Orbitwork avoids unnecessary client-side overhead and bloated feature bundles, ensuring rapid page loading and responsive interactions even on large projects.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Can I manage multiple client workspaces separately?</summary>
                <p>
                  Yes. Orbitwork is a multi-tenant platform with organization and workspace boundaries protected by PostgreSQL Row Level Security (RLS).
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>What views does Orbitwork offer?</summary>
                <p>
                  Orbitwork provides List sheets, Kanban boards, Gantt timelines, Calendar schedules, Workload capacity planners, Whiteboards, and Flowcharts.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="hp-container" style={{ margin: "56px auto" }}>
          <section className="hp-cta-banner">
            <h2>Experience high-performance work management</h2>
            <p>
              Say goodbye to interface lag and complex menus with Orbitwork.
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
