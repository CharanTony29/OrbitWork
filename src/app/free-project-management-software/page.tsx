import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
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
  CANONICAL_HOME_URL,
  CANONICAL_LOGO_URL,
  CANONICAL_ORIGIN,
  buildCanonicalUrl,
  buildPublicMetadata,
} from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Free Project Management Software & Tool for Teams | Orbitwork",
  description:
    "Orbitwork is genuinely free project management software for startups and small teams. Manage projects, tasks, Kanban boards, Gantt timelines, docs, chat, and timesheets with zero upfront cost.",
  path: "/free-project-management-software",
  keywords: [
    "free project management tool",
    "free project management software",
    "free project management application",
    "free project management app",
    "free work management software",
    "free task management software",
    "free project management for small teams",
    "free project management for startups",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork Free Project Management Software",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: buildCanonicalUrl("/free-project-management-software"),
      image: CANONICAL_LOGO_URL,
      description:
        "Free project management tool and software for startups and teams. Features Kanban boards, Gantt timelines, task sheets, time tracking, live chat, Markdown docs, and cloud storage.",
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
          name: "Is Orbitwork really free project management software?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Orbitwork offers a genuinely free plan to create organizations, workspaces, projects, and tasks. You get full access to Kanban boards, spreadsheet task views, Gantt charts, built-in time tracking, timesheets, collaborative docs, and team chat without entering a credit card.",
          },
        },
        {
          "@type": "Question",
          name: "Are there artificial limits on projects or tasks on the free plan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Small teams and startups can create multiple workspaces, projects, tasks, checklists, and custom fields without artificial paywalls on core work execution.",
          },
        },
        {
          "@type": "Question",
          name: "Does Orbitwork include free time tracking and timesheets?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Team members can run live timers on tasks or log manual billable/non-billable hours and submit weekly timesheets for manager approval, completely free.",
          },
        },
        {
          "@type": "Question",
          name: "Can our team connect our existing Google Drive or Microsoft OneDrive?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Each workspace can link Google Drive, Microsoft OneDrive, SharePoint, or use built-in storage. Files stay under your own cloud drive governance.",
          },
        },
        {
          "@type": "Question",
          name: "Who is Orbitwork free project management software best suited for?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Orbitwork is ideal for small teams, startups, agencies, software engineering squads, marketing groups, and freelancers who need a fast, uncluttered tool that unites tasks, docs, and communication.",
          },
        },
      ],
    },
  ],
};

export default function FreeProjectManagementPage() {
  return (
    <div className="hp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <PublicSiteHeader active="free-pm" />

      <main>
        {/* Hero Section */}
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Free Project Management Software</span>
            </nav>

            <span className="hp-pill-tag" style={{ marginBottom: 16 }}>
              <Sparkles size={14} /> 100% Free to Start · No Credit Card Required
            </span>

            <h1 className="hp-subpage-title">
              Free Project Management Software Built for High-Velocity Teams
            </h1>

            <p className="hp-subpage-lead">
              Orbitwork is a modern, free project management tool and application that replaces fragmented stacks of task trackers, separate timer apps, and disconnected chat tools. Get your projects, boards, timelines, docs, and team collaboration into one cohesive workspace.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/signup" className="hp-btn-primary">
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link href="/project-management-software" className="hp-btn-secondary">
                Explore All Capabilities
              </Link>
            </div>
          </div>
        </section>

        {/* What Orbitwork Provides for Free */}
        <section className="hp-container" style={{ padding: "48px 24px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Genuinely Useful Features</span>
            <h2 className="hp-section-title">What Orbitwork provides for free</h2>
            <p className="hp-section-desc" style={{ margin: "8px 0 0" }}>
              Unlike tools that lock basic views behind high enterprise tiers, Orbitwork provides the full project execution engine out of the box.
            </p>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <FolderGit2 size={24} />
              </div>
              <h3>Create &amp; Manage Projects</h3>
              <p>
                Organize work into organizations, workspaces, and distinct projects. Customize status workflows, project leads, priority levels, and member permissions with PostgreSQL Row Level Security (RLS).
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Flexible Task Management</h3>
              <p>
                Switch instantly between interactive spreadsheet task sheets, visual drag-and-drop Kanban boards, and calendar schedules. Break complex deliverables into nested subtasks and actionable checklists.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Layers3 size={24} />
              </div>
              <h3>Project Planning &amp; Gantt Timelines</h3>
              <p>
                Plan milestones, visualize schedules on interactive Gantt timelines, and spot deadline conflicts before they impact delivery. Understand team workload and plan realistic sprint capacities.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Built-In Time Tracking &amp; Timesheets</h3>
              <p>
                Start live stopwatch timers directly from task rows or log manual hours. Team members submit weekly timesheets for approval, complete with CSV export and hour-exhaustion alerts against estimates.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <FileText size={24} />
              </div>
              <h3>Living Project Documentation</h3>
              <p>
                Write specs, SOPs, sprint plans, and meeting notes with rich Markdown docs. Embed resizeable diagrams, link documents directly to task rows, and keep documentation right beside execution.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <MessageSquare size={24} />
              </div>
              <h3>Real-Time Team Chat &amp; Collaboration</h3>
              <p>
                Communicate through project channels, direct 1:1 messages, and task comments. Mention teammates with @mentions, trigger automated email notifications, and share updates without switching to Slack.
              </p>
            </article>
          </div>
        </section>

        {/* Free Plan Capabilities & Honest Scope */}
        <section className="hp-container" style={{ padding: "16px 24px 48px" }}>
          <div className="hp-callout-box">
            <h4>Honest Transparency: What is included free and workspace limits</h4>
            <p>
              Orbitwork is free to start. You can invite your team, create projects, track time, and manage tasks without arbitrary trials or hidden payment walls. When connecting cloud storage (Google Drive, Microsoft OneDrive, SharePoint), files are stored directly in your own cloud account so you never pay markup on storage. Self-hosted database file attachments remain available with standard system limits.
            </p>
          </div>
        </section>

        {/* Who Orbitwork is Suitable For */}
        <section className="hp-container" style={{ padding: "24px 24px 56px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Target Audiences</span>
            <h2 className="hp-section-title">Who is Orbitwork free project management software for?</h2>
          </div>

          <div className="hp-three-col-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            <div className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Zap size={22} />
              </div>
              <h3>Startups &amp; Founders</h3>
              <p>
                Ship MVPs without wasting runway on enterprise software licenses. Keep product roadmaps, sprint backlogs, bug tracking, and release notes in one fast, centralized tool.
              </p>
            </div>

            <div className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Users size={22} />
              </div>
              <h3>Small Teams &amp; Agencies</h3>
              <p>
                Manage client deliverables, track billable hours accurately with timesheets, invite external viewers or contractors safely, and export client-ready reports.
              </p>
            </div>

            <div className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={22} />
              </div>
              <h3>Software Engineering Squads</h3>
              <p>
                Agile Kanban workflows, custom task types (Epic, Story, Bug, Task), estimation in hours or story points, and Git-friendly documentation side by side with task boards.
              </p>
            </div>
          </div>
        </section>

        {/* How to Get Started */}
        <section className="hp-container" style={{ padding: "24px 24px 64px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 32 }}>
            <span className="hp-section-tag">Quick Onboarding</span>
            <h2 className="hp-section-title">How to get started in 3 simple steps</h2>
          </div>

          <div className="hp-three-col-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <div className="hp-info-card">
              <span style={{ fontSize: 28, fontWeight: 900, color: "var(--hp-green)", marginBottom: 8 }}>01</span>
              <h3>Create Your Free Account</h3>
              <p>Sign up with your work email in seconds. No credit card, complicated sales demo, or lengthy onboarding forms.</p>
            </div>

            <div className="hp-info-card">
              <span style={{ fontSize: 28, fontWeight: 900, color: "var(--hp-green)", marginBottom: 8 }}>02</span>
              <h3>Set Up Your Workspace</h3>
              <p>Name your workspace, invite your teammates by email, and choose your preferred view: Kanban board, interactive sheet, or Gantt chart.</p>
            </div>

            <div className="hp-info-card">
              <span style={{ fontSize: 28, fontWeight: 900, color: "var(--hp-green)", marginBottom: 8 }}>03</span>
              <h3>Execute &amp; Collaborate</h3>
              <p>Assign tasks, log hours, chat with colleagues in real time, and keep your entire team aligned toward successful delivery.</p>
            </div>
          </div>
        </section>

        {/* Comparison Links / Internal Links */}
        <section className="hp-container" style={{ padding: "0 24px 64px" }}>
          <div className="hp-section-header" style={{ textAlign: "left", marginBottom: 24 }}>
            <span className="hp-section-tag">Explore Comparisons</span>
            <h2 className="hp-section-title">Looking for an alternative to traditional tools?</h2>
            <p className="hp-section-desc" style={{ margin: "8px 0 0" }}>
              See how Orbitwork compares honestly against other market leaders:
            </p>
          </div>

          <div className="hp-internal-links-grid">
            <Link href="/jira-alternative" className="hp-link-card">
              <strong>Jira Alternative <ArrowRight size={14} /></strong>
              <span>Faster, cleaner agile project management without complex enterprise configuration bloat.</span>
            </Link>
            <Link href="/free-jira-alternative" className="hp-link-card">
              <strong>Free Jira Alternative <ArrowRight size={14} /></strong>
              <span>Generous free project execution without aggressive seat tier paywalls.</span>
            </Link>
            <Link href="/asana-alternative" className="hp-link-card">
              <strong>Asana Alternative <ArrowRight size={14} /></strong>
              <span>Combines task management with built-in time tracking, timesheets, and team chat.</span>
            </Link>
            <Link href="/clickup-alternative" className="hp-link-card">
              <strong>ClickUp Alternative <ArrowRight size={14} /></strong>
              <span>All-in-one productivity with a fast, uncluttered interface that stays responsive.</span>
            </Link>
            <Link href="/monday-alternative" className="hp-link-card">
              <strong>Monday.com Alternative <ArrowRight size={14} /></strong>
              <span>Straightforward project boards and sheets without multi-tier subscription locks.</span>
            </Link>
            <Link href="/project-management-software" className="hp-link-card">
              <strong>Project Management Software <ArrowRight size={14} /></strong>
              <span>Full overview of Orbitwork architecture, features, and multi-tenant security.</span>
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
                <summary>Is Orbitwork really free project management software?</summary>
                <p>
                  Yes. Orbitwork provides a free tier for organizations and small teams. You can create workspaces, projects, Kanban boards, Gantt timelines, track time, manage timesheets, and collaborate in real-time chat with no credit card required.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>How does Orbitwork compare to other free task management apps?</summary>
                <p>
                  Many free project management tools restrict core views (like Gantt charts or time tracking) to expensive premium tiers. Orbitwork includes Kanban, List sheets, Gantt charts, built-in time tracking, timesheets, and documentation in one cohesive experience.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Can small teams and startups collaborate with external clients?</summary>
                <p>
                  Yes. Orbitwork includes role-based access control (Owner, Admin, Member, Viewer). You can invite clients or contractors as Viewers so they can track progress without altering project plans or accessing private team settings.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>What are the file storage limits on the free plan?</summary>
                <p>
                  Orbitwork lets each workspace connect its own cloud storage provider (Google Drive, Microsoft OneDrive, SharePoint) using standard OAuth. This means your file storage uses your existing cloud quotas with zero per-gigabyte markups from Orbitwork.
                </p>
              </details>

              <details className="hp-faq-item">
                <summary>Can I upgrade or export my data at any time?</summary>
                <p>
                  Yes. Orbitwork supports CSV exports for tasks and timesheets, and respects DPDP/GDPR data subject rights including complete account erasure when requested.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="hp-container" style={{ margin: "56px auto" }}>
          <section className="hp-cta-banner">
            <h2>Ready to streamline your team&apos;s projects for free?</h2>
            <p>
              Join startups and high-clarity teams using Orbitwork for fast, unified project execution.
            </p>
            <div className="hp-cta-buttons">
              <Link href="/signup" className="hp-btn-primary">
                Create Free Workspace <ArrowRight size={17} />
              </Link>
              <Link href="/services/project-management" className="hp-btn-secondary">
                Learn More About Features
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
