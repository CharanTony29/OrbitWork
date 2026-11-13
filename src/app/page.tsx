import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Cloud,
  FileText,
  Kanban,
  MessageSquare,
  Share2,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import {
  HomeInteractiveTabs,
  HomeTeamPersonas,
  HomeFaqAccordion,
} from "./HomeInteractiveTabs";
import { BrandMark } from "./BrandMark";
import { HeroInteractiveMockup } from "./HeroInteractiveMockup";
import { PublicSiteHeader, PublicSiteFooter } from "./PublicSiteChrome";
import {
  CANONICAL_HOME_URL,
  CANONICAL_LOGO_URL,
  CANONICAL_ORIGIN,
  buildPublicMetadata,
} from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Orbitwork | Project Management & Team Collaboration Platform",
  absoluteTitle: true,
  description:
    "Orbitwork is a modern project management and work execution platform uniting Kanban boards, Gantt timelines, task sheets, docs, team chat, timesheets, and cloud storage.",
  path: "/",
  keywords: [
    "Orbitwork",
    "project management software",
    "work management platform",
    "Kanban board",
    "Gantt chart software",
    "team time tracking",
    "collaborative project docs",
    "team chat and tasks",
  ],
});

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${CANONICAL_ORIGIN}/#organization`,
      name: "Orbitwork",
      url: CANONICAL_HOME_URL,
      logo: {
        "@type": "ImageObject",
        url: CANONICAL_LOGO_URL,
        width: 512,
        height: 512,
      },
      image: CANONICAL_LOGO_URL,
      email: "orbitwork.admin@gmail.com",
      description:
        "Modern multi-tenant project management, time tracking, documentation, and team collaboration platform.",
    },
    {
      "@type": "WebSite",
      "@id": `${CANONICAL_ORIGIN}/#website`,
      url: CANONICAL_HOME_URL,
      name: "Orbitwork",
      publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "Orbitwork",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: CANONICAL_HOME_URL,
      image: CANONICAL_LOGO_URL,
      description:
        "All-in-one project management OS featuring Kanban boards, task sheets, Gantt timelines, workload calendars, timesheets, collaborative docs, team chat, and cloud drive sync.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    returnUrl?: string;
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
    error_description?: string;
  }>;
}) {
  const params = await searchParams;

  // 1. If auth exchange code or token_hash is in query, forward to callback route
  if (params.code || params.token_hash) {
    const cbQuery = new URLSearchParams();
    if (params.code) cbQuery.set("code", params.code);
    if (params.token_hash) cbQuery.set("token_hash", params.token_hash);
    if (params.type) cbQuery.set("type", params.type);
    if (params.next) cbQuery.set("next", params.next);
    if (params.error) cbQuery.set("error", params.error);
    if (params.error_description) cbQuery.set("error_description", params.error_description);
    redirect(`/auth/callback?${cbQuery.toString()}`);
  }

  // 2. If recovery flow landed on home page, forward immediately to reset-password page
  if (params.type === "recovery" || params.next?.includes("reset-password")) {
    redirect("/auth/reset-password");
  }

  // 3. If an error happened during recovery
  if (
    params.error &&
    (params.type === "recovery" ||
      params.next?.includes("reset-password") ||
      params.error.includes("recovery"))
  ) {
    redirect(`/reset-password?error=link_expired`);
  }

  let user = null;
  let configError: string | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("Home page initialization error:", err);
    configError = err instanceof Error ? err.message : String(err);
  }

  // Preserve authentication query forwarding for invite links or explicit callbacks
  const query = new URLSearchParams();
  if (params.returnUrl) query.set("returnUrl", params.returnUrl);
  if (params.error) query.set("error", params.error);
  if (params.message) query.set("message", params.message);
  const qStr = query.toString();

  if (qStr) {
    redirect(`/login?${qStr}`);
  }

  if (configError) {
    return (
      <main className="auth-shell">
        <section className="auth-card" style={{ maxWidth: 540 }}>
          <div
            className="brand"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            <BrandMark />Orbit<span>work</span>
          </div>
          <h1 style={{ marginTop: 16 }}>Configuration Required</h1>
          <p className="muted">
            Your deployment is live, but required Supabase environment variables
            are missing.
          </p>
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              padding: "14px 16px",
              borderRadius: 8,
              fontSize: 12.5,
              color: "#92400e",
              margin: "16px 0",
              lineHeight: 1.6,
            }}
          >
            <strong>How to configure:</strong>
            <ol style={{ paddingLeft: 18, marginTop: 8 }}>
              <li>
                Add <code>NEXT_PUBLIC_SUPABASE_URL</code> to your environment
                variables
              </li>
              <li>
                Add <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> or{" "}
                <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
              </li>
              <li>Restart your development server or redeploy</li>
            </ol>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="hp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      <PublicSiteHeader active="home" userEmail={user?.email ?? null} />

      <main>
        {/* Hero Section */}
        <section className="hp-hero">
          <div className="hp-hero-glow" />
          <div className="hp-container hp-hero-content">
            <div className="hp-pill-badge">
              <Sparkles size={14} />
              <span>All-in-One Project &amp; Work Management Platform</span>
            </div>

            <h1 className="hp-hero-title">
              Modern Project Management for{" "}
              <span className="hp-hero-highlight">
                Projects, People, and Progress
              </span>
            </h1>

            <p className="hp-hero-subtitle">
              Unify agile Kanban boards, interactive task spreadsheets, Gantt
              timelines, collaborative Markdown docs, real-time team chat, built-in
              time tracking, and multi-cloud storage inside one calm, distraction-free
              workspace.
            </p>

            <div className="hp-hero-cta-group">
              {user ? (
                <>
                  <Link href="/dashboard" className="hp-btn-primary">
                    Go to Your Dashboard <ArrowRight size={17} />
                  </Link>
                  <Link href="/services/project-management" className="hp-btn-secondary">
                    Explore Capabilities
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/signup" className="hp-btn-primary">
                    Get Started for Free <ArrowRight size={17} />
                  </Link>
                  <Link href="/services/project-management" className="hp-btn-secondary">
                    Explore Project Management
                  </Link>
                </>
              )}
            </div>

            <ul className="hp-hero-checklist">
              <li>Kanban, List, Gantt &amp; Calendar Views</li>
              <li>Built-in Timers &amp; Weekly Timesheets</li>
              <li>Team Chat, Mentions &amp; Docs</li>
              <li>Multi-Tenant Organization Hierarchy</li>
            </ul>

            {/* Product Hero Mockup Preview */}
            <div className="hp-preview-wrap">
              <div className="hp-float-card hp-float-card-1">
                <div className="hp-float-icon hp-icon-green">
                  <Timer size={20} />
                </div>
                <div className="hp-float-text">
                  <strong>38.5 Hours Logged</strong>
                  <span>Weekly Timesheet · Approved ✓</span>
                </div>
              </div>

              <div className="hp-float-card hp-float-card-2">
                <div className="hp-float-icon hp-icon-amber">
                  <Cloud size={20} />
                </div>
                <div className="hp-float-text">
                  <strong>Drive, OneDrive &amp; SharePoint</strong>
                  <span>Workspace cloud sync active</span>
                </div>
              </div>

              <HeroInteractiveMockup />
            </div>
          </div>
        </section>

        {/* Value Pillars Strip */}
        <section className="hp-value-strip">
          <div className="hp-container">
            <div className="hp-value-grid">
              <div className="hp-value-item">
                <div className="hp-value-icon">
                  <Zap size={22} />
                </div>
                <div>
                  <h4>Zero Context Switching</h4>
                  <p>
                    Tasks, boards, Gantt charts, docs, timesheets, and real-time
                    team chat live together in one coherent workspace.
                  </p>
                </div>
              </div>

              <div className="hp-value-item">
                <div className="hp-value-icon">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h4>Multi-Tenant Isolation</h4>
                  <p>
                    PostgreSQL Row Level Security keeps every organization,
                    workspace, client project, and file strictly isolated.
                  </p>
                </div>
              </div>

              <div className="hp-value-item">
                <div className="hp-value-icon">
                  <Cloud size={22} />
                </div>
                <div>
                  <h4>Your Choice of Cloud</h4>
                  <p>
                    Store project files in Google Drive, OneDrive, SharePoint, or
                    built-in encrypted local storage per workspace.
                  </p>
                </div>
              </div>

              <div className="hp-value-item">
                <div className="hp-value-icon">
                  <Clock size={22} />
                </div>
                <div>
                  <h4>Native Time &amp; Leave Tracking</h4>
                  <p>
                    Live task stopwatch timers, weekly timesheet approvals, and
                    country public holidays built directly into your workflow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solutions & Use Cases Overview */}
        <section
          className="hp-container"
          id="solutions"
          style={{ padding: "64px 24px 24px" }}
        >
          <div className="hp-section-header">
            <span className="hp-section-tag">Built for Modern Teams</span>
            <h2 className="hp-section-title">
              Project execution tailored to how real organizations work
            </h2>
            <p className="hp-section-desc">
              Whether managing client deliverables, software sprints, agency
              retainers, or cross-department operations, Orbitwork keeps every
              milestone, assignee, document, and logged hour aligned.
            </p>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Project &amp; Task Management</h3>
              <p>
                Plan work with customizable workflow statuses, subtasks with
                independent assignees, progress bars, checklists, dependencies,
                and personalizable per-user view tabs and sheet columns.
              </p>
              <Link href="/services/project-management" className="hp-inline-link">
                Explore Project Management <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <MessageSquare size={24} />
              </div>
              <h3>Real-Time Team Chat &amp; Channels</h3>
              <p>
                Collaborate via workspace channels, custom group chats, and direct
                messages with instant pop-up notifications, read receipts, image
                pasting, and 1-click task creation from any message.
              </p>
              <Link href="/services" className="hp-inline-link">
                See Platform Solutions <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Calendar size={24} />
              </div>
              <h3>Timesheets, Leave &amp; Public Holidays</h3>
              <p>
                Track billable and non-billable effort with live task timers,
                approve weekly timesheets, coordinate team PTO, and automatically
                populate public holidays for your selected country.
              </p>
              <Link href="/projects-case-studies" className="hp-inline-link">
                View Team Use Cases <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Users size={24} />
              </div>
              <h3>Organizations, Workspaces &amp; Client Access</h3>
              <p>
                Structure companies cleanly into Organizations, Workspaces, and
                Projects with Owner, Admin, Member, and Viewer permissions plus
                seamless password-less or Google sign-in.
              </p>
              <Link href="/about" className="hp-inline-link">
                Learn About Orbitwork <ArrowRight size={14} />
              </Link>
            </article>
          </div>
        </section>

        {/* Interactive Workspace Tabs Showcase */}
        <div className="hp-container">
          <HomeInteractiveTabs isUserLoggedIn={!!user} />
        </div>

        {/* Core Features Deep Dive Grid */}
        <section
          className="hp-container"
          id="features"
          style={{ padding: "56px 24px" }}
        >
          <div className="hp-section-header">
            <span className="hp-section-tag">Core Capabilities</span>
            <h2 className="hp-section-title">
              Everything required for calm, high-velocity execution
            </h2>
            <p className="hp-section-desc">
              Replace scattered trackers, chat apps, and billing sheets with one
              cohesive workspace.
            </p>
          </div>

          <div className="hp-features-grid">
            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={26} />
              </div>
              <h3>8 Synchronized Project Views</h3>
              <p>
                Switch effortlessly between List, Board, Calendar, Gantt
                Timeline, Workload, Whiteboard, Flowchart, and Project Channel
                tabs arranged in your preferred order.
              </p>
              <ul className="hp-feature-bullets">
                <li>Per-user custom tab &amp; column ordering</li>
                <li>Multi-value custom fields &amp; inline editing</li>
                <li>Subtasks, progress tracking &amp; dependencies</li>
              </ul>
            </div>

            <div className="hp-feature-card" id="timesheets">
              <div className="hp-feature-icon-wrap">
                <Clock size={26} />
              </div>
              <h3>Integrated Time Tracking</h3>
              <p>
                Accurate, pain-free time logging inside every task. Submit weekly
                timesheets for manager approval and monitor remaining budget hours.
              </p>
              <ul className="hp-feature-bullets">
                <li>Live task stopwatch timers &amp; manual logs</li>
                <li>Billable vs non-billable categorization</li>
                <li>One-click CSV export &amp; PDF reports</li>
              </ul>
            </div>

            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <FileText size={26} />
              </div>
              <h3>Living Project Docs &amp; Wikis</h3>
              <p>
                Write project specs, meeting notes, and team SOPs with inline
                images, task references, revision history snapshots, and PDF
                export.
              </p>
              <ul className="hp-feature-bullets">
                <li>Rich Markdown formatting &amp; resizable images</li>
                <li>Version history &amp; restore checkpoints</li>
                <li>Instant HTML and PDF export anytime</li>
              </ul>
            </div>

            <div className="hp-feature-card" id="storage">
              <div className="hp-feature-icon-wrap">
                <Cloud size={26} />
              </div>
              <h3>Multi-Cloud Storage Freedom</h3>
              <p>
                You retain control of your files. Attach Google Drive, Microsoft
                OneDrive, SharePoint, or Orbitwork&apos;s encrypted database
                storage per workspace.
              </p>
              <ul className="hp-feature-bullets">
                <li>Encrypted OAuth credentials (AES-256-GCM)</li>
                <li>Workspace-level storage routing</li>
                <li>Zero vendor lock-in or extra hosting markup</li>
              </ul>
            </div>

            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <Building2 size={26} />
              </div>
              <h3>Multi-Tenant Hierarchy</h3>
              <p>
                Organize complex teams clearly: Organizations contain
                Workspaces, Workspaces house Projects, and Projects manage Tasks
                and Docs.
              </p>
              <ul className="hp-feature-bullets">
                <li>Owner, Admin, Member &amp; Viewer roles</li>
                <li>Bulk teammate email invitations</li>
                <li>Granular project &amp; workspace access</li>
              </ul>
            </div>

            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <Share2 size={26} />
              </div>
              <h3>Whiteboards &amp; Flowcharts</h3>
              <p>
                Brainstorm architectures, customer journeys, and workflow diagrams
                with interactive flowcharts and whiteboards linked directly to
                project tasks.
              </p>
              <ul className="hp-feature-bullets">
                <li>Convert canvas shapes into tracked tasks</li>
                <li>Visual dependency arrows &amp; milestones</li>
                <li>Share diagrams in team chat &amp; channels</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Team Personas Showcase */}
        <div className="hp-container">
          <HomeTeamPersonas />
        </div>

        {/* How the Workspace Fits Together */}
        <section className="hp-compare-section" id="comparison">
          <div className="hp-container">
            <div className="hp-section-header">
              <span className="hp-section-tag">Unified Architecture</span>
              <h2 className="hp-section-title">
                How Orbitwork brings every project workflow together
              </h2>
              <p className="hp-section-desc">
                Tasks, conversations, files, time logs, and project documentation
                stay synchronized in one place.
              </p>
            </div>

            <div className="hp-compare-table-wrap">
              <table className="hp-compare-table">
                <thead>
                  <tr>
                    <th style={{ width: "25%" }}>Capability</th>
                    <th style={{ width: "38%" }} className="hp-compare-highlight-col">
                      <div className="hp-compare-badge-orbit">
                        <BrandMark
                          size={22}
                          style={{
                            width: 22,
                            height: 22,
                            marginRight: 4,
                            borderRadius: 6,
                          }}
                        />
                        In Orbitwork
                      </div>
                    </th>
                    <th style={{ width: "37%" }}>Team Benefit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Task Planning</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        8 Flexible Views
                      </span>{" "}
                      — List, Board, Calendar, Timeline, Workload, Flowchart,
                      Whiteboard &amp; Channel
                    </td>
                    <td>
                      Every teammate views live project state in the format that
                      fits their role best.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Time &amp; Timesheets</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Built-in Timers
                      </span>{" "}
                      — Task stopwatches + weekly approval &amp; CSV/PDF export
                    </td>
                    <td>
                      Eliminates separate time trackers and tracks billable client
                      work accurately.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Team Messaging</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Integrated Chat
                      </span>{" "}
                      — Direct DMs, group chats, channels, read receipts &amp;
                      alerts
                    </td>
                    <td>
                      Keep project discussions searchable and turn any message into
                      an assigned task.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Project Documents</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Living Docs
                      </span>{" "}
                      — Markdown specs, embedded images &amp; version history
                    </td>
                    <td>
                      Requirements, meeting notes, and runbooks stay right alongside
                      tasks.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>File Storage</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Bring Your Cloud
                      </span>{" "}
                      — Google Drive, OneDrive, SharePoint or Local DB
                    </td>
                    <td>
                      Every workspace connects the storage provider your company
                      already governs.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="hp-faq-section" id="faq">
          <div className="hp-section-header">
            <span className="hp-section-tag">Frequently Asked Questions</span>
            <h2 className="hp-section-title">Everything you need to know</h2>
            <p className="hp-section-desc">
              Quick answers about Orbitwork project management features,
              workspaces, time tracking, and security.
            </p>
          </div>

          <HomeFaqAccordion />
        </section>

        {/* Final Call to Action Banner */}
        <div className="hp-container">
          <section className="hp-cta-banner">
            <h2>Bring clarity to your projects today</h2>
            <p>
              Organize workspaces, empower your team with unified views, and
              deliver meaningful results together in Orbitwork.
            </p>

            <div className="hp-cta-buttons">
              {user ? (
                <Link href="/dashboard" className="hp-btn-primary">
                  Open Your Dashboard <ArrowRight size={17} />
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="hp-btn-primary">
                    Get Started for Free <ArrowRight size={17} />
                  </Link>
                  <Link href="/contact" className="hp-btn-secondary">
                    Contact Us
                  </Link>
                </>
              )}
            </div>

            <div className="hp-cta-fineprint">
              <Link href="/about" style={{ color: "inherit" }}>
                About
              </Link>{" "}
              ·{" "}
              <Link href="/services" style={{ color: "inherit" }}>
                Solutions
              </Link>{" "}
              ·{" "}
              <Link href="/services/project-management" style={{ color: "inherit" }}>
                Project Management
              </Link>{" "}
              ·{" "}
              <Link href="/projects-case-studies" style={{ color: "inherit" }}>
                Use Cases
              </Link>{" "}
              ·{" "}
              <Link href="/contact" style={{ color: "inherit" }}>
                Contact
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
