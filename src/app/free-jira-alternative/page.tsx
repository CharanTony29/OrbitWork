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
  title: "Free Jira Alternative for Startups & Small Teams | Orbitwork",
  description:
    "Looking for a free Jira alternative? Orbitwork gives agile software teams and startups free Kanban boards, Gantt timelines, time tracking, docs, and chat without artificial user locks.",
  path: "/free-jira-alternative",
  keywords: [
    "free Jira alternative",
    "best free Jira alternative",
    "free agile project management",
    "free bug tracking software",
    "free alternative to Jira",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork Free Jira Alternative",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: buildCanonicalUrl("/free-jira-alternative"),
      image: CANONICAL_LOGO_URL,
      description:
        "Free Jira alternative designed for agile startups and software teams. Features free Kanban boards, task sheets, Gantt charts, time tracking, timesheets, and collaborative docs.",
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
          name: "Why is Orbitwork a great free Jira alternative?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Jira's free plan restricts user limits, locks advanced roadmaps, and lacks native time tracking without paid third-party add-ons. Orbitwork gives small teams free agile Kanban boards, interactive task sheets, Gantt timelines, built-in time tracking, timesheets, docs, and team chat at zero cost.",
          },
        },
        {
          "@type": "Question",
          name: "Can our team track bugs, stories, and tasks for free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork includes custom task types (Task, Bug, Story, Epic), estimation, priority flagging, and subtasks on its free tier.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a credit card required to use Orbitwork free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No credit card is required. You can sign up with your email and immediately create your workspace.",
          },
        },
      ],
    },
  ],
};

export default function FreeJiraAlternativePage() {
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
              <Link href="/jira-alternative">Jira Alternative</Link>
              <span>/</span>
              <span>Free Jira Alternative</span>
            </nav>

            <span className="hp-pill-tag" style={{ marginBottom: 16 }}>
              <Sparkles size={14} /> 100% Free to Use · No Credit Card Required
            </span>

            <h1 className="hp-subpage-title">
              The Free Jira Alternative That Won&apos;t Slow Your Team Down
            </h1>

            <p className="hp-subpage-lead">
              Need agile boards, sprint tracking, and project planning without Jira&apos;s steep subscription costs and administrative headaches? Orbitwork delivers the core power of agile work execution for free.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/signup" className="hp-btn-primary">
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link href="/jira-alternative" className="hp-btn-secondary">
                Read Detailed Jira Comparison
              </Link>
            </div>
          </div>
        </section>

        {/* Callout Box */}
        <section className="hp-container" style={{ padding: "48px 24px" }}>
          <div className="hp-callout-box">
            <h4>Why Early-Stage Teams Avoid Jira&apos;s Free Plan</h4>
            <p>
              While Atlassian offers a basic free tier for Jira, it quickly hits friction: user caps, lack of cross-project roadmaps, no built-in time tracking, and constant upsells for paid marketplace plugins like Tempo or Confluence. Orbitwork delivers an open, all-in-one experience where task boards, Gantt timelines, time tracking, timesheets, and docs work seamlessly together from day one.
            </p>
          </div>
        </section>

        {/* Free Agile Capabilities */}
        <section className="hp-container" style={{ padding: "16px 24px 48px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Agile Without The Price Tag</span>
            <h2 className="hp-section-title">What you get with Orbitwork for free</h2>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Free Kanban &amp; Sprint Boards</h3>
              <p>
                Organize sprint backlogs, track work in progress, and drag tasks across customizable workflow columns. Reorder boards easily and view tickets with clear assignees, labels, and deadlines.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Free Built-In Time Tracking</h3>
              <p>
                Never pay for a separate time logging tool again. Start live timers directly on issue cards or log hours manually. Generate weekly timesheets with exportable CSVs for client billing or payroll.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Layers3 size={24} />
              </div>
              <h3>Gantt Charts &amp; Timeline Views</h3>
              <p>
                Visualize milestones and roadmap dependencies without paying for Jira Advanced Roadmaps or expensive enterprise add-ons.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <FileText size={24} />
              </div>
              <h3>Embedded Project Docs (No Confluence Needed)</h3>
              <p>
                Write specs, release notes, and sprint retro documents inside your project. Markdown formatting, image embeds, and checklists link directly to tasks.
              </p>
            </article>
          </div>
        </section>

        {/* Free Comparison Table */}
        <section className="hp-container" style={{ padding: "16px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Feature Comparison</span>
            <h2 className="hp-section-title">Free Plan Comparison: Orbitwork vs. Jira Free</h2>
          </div>

          <div className="hp-table-container">
            <table className="hp-comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="hp-highlight-col">Orbitwork (Free)</th>
                  <th>Jira (Free Plan)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Time Tracking &amp; Stopwatch</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Included Free</td>
                  <td>Requires paid 3rd-party plugin</td>
                </tr>
                <tr>
                  <td><strong>Weekly Timesheet Approvals</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Included Free</td>
                  <td>Requires paid enterprise add-on</td>
                </tr>
                <tr>
                  <td><strong>Project Documentation</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Built-in Markdown docs</td>
                  <td>Separate Confluence app required</td>
                </tr>
                <tr>
                  <td><strong>Real-Time Team Chat</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Project channels &amp; DMs</td>
                  <td>Not available (requires Slack/Teams)</td>
                </tr>
                <tr>
                  <td><strong>UI Speed &amp; Simplicity</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> Fast &amp; Modern</td>
                  <td>Heavy, slow to load complex views</td>
                </tr>
                <tr>
                  <td><strong>Credit Card Required</strong></td>
                  <td className="hp-highlight-col"><span className="hp-text-check">✓</span> No</td>
                  <td>No (but aggressive upsell prompts)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Internal Links Navigation */}
        <section className="hp-container" style={{ padding: "0 24px 64px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Explore More Options</span>
            <h2 className="hp-section-title">Discover other Orbitwork tools and alternatives</h2>
          </div>

          <div className="hp-internal-links-grid">
            <Link href="/jira-alternative" className="hp-link-card">
              <strong>Jira Alternative Overview <ArrowRight size={14} /></strong>
              <span>Detailed comparison of features, workflows, and administrative differences.</span>
            </Link>
            <Link href="/free-project-management-software" className="hp-link-card">
              <strong>Free Project Management Software <ArrowRight size={14} /></strong>
              <span>Explore all free project management capabilities across Orbitwork.</span>
            </Link>
            <Link href="/project-management-software" className="hp-link-card">
              <strong>Project Management Software <ArrowRight size={14} /></strong>
              <span>In-depth review of Orbitwork platform architecture and multi-tenant security.</span>
            </Link>
            <Link href="/asana-alternative" className="hp-link-card">
              <strong>Asana Alternative <ArrowRight size={14} /></strong>
              <span>Compare Orbitwork with Asana for cross-functional project management.</span>
            </Link>
            <Link href="/clickup-alternative" className="hp-link-card">
              <strong>ClickUp Alternative <ArrowRight size={14} /></strong>
              <span>Discover why teams choose Orbitwork for speed, reliability, and ease of use.</span>
            </Link>
            <Link href="/monday-alternative" className="hp-link-card">
              <strong>Monday.com Alternative <ArrowRight size={14} /></strong>
              <span>Explore transparent project management without tiered enterprise pricing.</span>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="hp-faq-section" style={{ borderTop: "1px solid var(--hp-line)", paddingTop: 56 }}>
          <div className="hp-container">
            <div className="hp-section-header">
              <span className="hp-section-tag">Common Inquiries</span>
              <h2 className="hp-section-title">Frequently Asked Questions</h2>
            </div>

            <div className="hp-faq-list">
              <details className="hp-faq-item">
                <summary>Can our startup use Orbitwork as our primary bug tracker?</summary>
                <p>
                  Yes. Orbitwork includes custom task types including Bug, Task, Story, and Epic. You can assign bugs, set urgent priorities, attach logs and screenshots, and track status through to resolution.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Is there a time limit or trial expiration on the free plan?</summary>
                <p>
                  No. The Orbitwork free plan does not expire after 14 or 30 days. It is built to support your team as you grow.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Can we invite external contractors or clients?</summary>
                <p>
                  Yes. Using Orbitwork&apos;s role permissions (Viewer, Member, Admin, Owner), you can invite external stakeholders to review progress without exposing internal admin controls.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="hp-container" style={{ margin: "56px auto" }}>
          <section className="hp-cta-banner">
            <h2>Experience a truly free Jira alternative</h2>
            <p>
              Say goodbye to sluggish ticket software and expensive add-on subscriptions.
            </p>
            <div className="hp-cta-buttons">
              <Link href="/signup" className="hp-btn-primary">
                Create Free Account <ArrowRight size={17} />
              </Link>
              <Link href="/jira-alternative" className="hp-btn-secondary">
                Learn More About Jira Differences
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
