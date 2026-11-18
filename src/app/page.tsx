import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Bot,
  Brain,
  Building2,
  Clock,
  Cloud,
  FileText,
  Globe2,
  Kanban,
  Layers,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { PublicSiteHeader, PublicSiteFooter } from "./PublicSiteChrome";
import { Hero3DWorkspaceStage } from "./_components/home/Hero3DWorkspaceStage";
import {
  HowItWorksReel,
  ProductShowcase,
  ProjectBrainFlow,
} from "./_components/home/LazyHomeSections";
import {
  CANONICAL_HOME_URL,
  CANONICAL_LOGO_URL,
  CANONICAL_ORIGIN,
  buildPublicMetadata,
} from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Orbitwork — AI Project Management Software, Docs & Team Collaboration",
  absoluteTitle: true,
  description:
    "Orbitwork is AI project management software that brings task management, project planning, living project documentation, team collaboration, autonomous AI agents, and Project Brain into one unified workspace.",
  path: "/",
  keywords: [
    "Orbitwork",
    "project management software",
    "project management tool",
    "AI project management",
    "team collaboration",
    "task management",
    "project planning",
    "project documentation",
    "AI agents for teams",
    "Project Brain",
    "Kanban board",
    "Gantt timeline",
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
        "AI-powered project management software uniting task management, living project documentation, team collaboration, time tracking, and Project Brain in one workspace.",
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
      applicationSubCategory: "Project Management Software",
      operatingSystem: "Web",
      url: CANONICAL_HOME_URL,
      image: CANONICAL_LOGO_URL,
      description:
        "Unified AI project management tool combining List, Board, Calendar, Gantt Timeline, Workload, Whiteboard, Flowchart, Living Docs, Team Chat, Timesheets, Custom AI Agents, and Project Brain.",
      featureList: [
        "12 synchronized project views including List, Kanban Board, Gantt Timeline, Calendar, Workload, Whiteboard, and Flowchart",
        "Living Markdown project documentation linked directly to tasks with version snapshots and PDF export",
        "Custom AI Agents Hub with event-driven triggers and AI Subtask Planner",
        "Project Brain for health diagnostics, preventive risk detection, change impact simulation, and decision memory",
        "Built-in task timers, weekly timesheet approvals, leave requests, and country holiday calendars",
        "Multi-tenant Organizations and Workspaces secured by PostgreSQL Row Level Security",
        "Workspace-level cloud storage routing for Google Drive, OneDrive, SharePoint, or encrypted database storage",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "HowTo",
      name: "How Orbitwork Works: Plan, Collaborate, Execute, and Improve",
      description:
        "Manage projects, documentation, team collaboration, and AI-assisted delivery inside one Orbitwork workspace.",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Plan",
          text: "Create projects, decompose goals or meeting notes into tasks and subtasks with AI, and schedule milestones on Gantt timelines.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Collaborate",
          text: "Link living Markdown project documentation directly to tasks, discuss updates in real-time Project Channels, and share workspace cloud files.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Execute",
          text: "Track delivery across Kanban boards, task sheets, and calendars while running live task timers and event-driven AI Agents.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Improve",
          text: "Use Project Brain to monitor project health, detect schedule and workload risks early, simulate deadline changes, and record team decisions.",
        },
      ],
    },
  ],
};

const AUDIENCE_ITEMS = [
  {
    icon: Building2,
    title: "Small & Growing Businesses",
    description:
      "Replace scattered spreadsheets, chat threads, and disconnected time trackers with one structured workspace.",
  },
  {
    icon: Rocket,
    title: "Startups",
    description:
      "Move from roadmap specs to shipped sprints fast—without enterprise bloat or stitching five tools together.",
  },
  {
    icon: Layers,
    title: "Project & Product Teams",
    description:
      "Keep PRDs, Kanban boards, task sheets, dependencies, Gantt timelines, and releases continuously aligned.",
  },
  {
    icon: Globe2,
    title: "Remote & Distributed Teams",
    description:
      "Stay coordinated across time zones with built-in channels, living docs, workload views, and holiday calendars.",
  },
  {
    icon: Sparkles,
    title: "Teams Unifying PM + Docs + AI",
    description:
      "Run task management, project documentation, and autonomous AI agents in one shared context.",
  },
];

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

  // 1. If auth exchange code or token_hash is in query, forward to callback route on app.orbitwork.org
  if (params.code || params.token_hash) {
    const cbQuery = new URLSearchParams();
    if (params.code) cbQuery.set("code", params.code);
    if (params.token_hash) cbQuery.set("token_hash", params.token_hash);
    if (params.type) cbQuery.set("type", params.type);
    if (params.next) cbQuery.set("next", params.next);
    if (params.error) cbQuery.set("error", params.error);
    if (params.error_description) cbQuery.set("error_description", params.error_description);
    const targetOrigin =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_APP_URL?.includes("orbitwork.org")
        ? "https://app.orbitwork.org"
        : "";
    redirect(`${targetOrigin}/auth/callback?${cbQuery.toString()}`);
  }

  // 2. If recovery flow landed on home page, forward immediately to reset-password page on app.orbitwork.org
  if (params.type === "recovery" || params.next?.includes("reset-password")) {
    const targetOrigin =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_APP_URL?.includes("orbitwork.org")
        ? "https://app.orbitwork.org"
        : "";
    redirect(`${targetOrigin}/auth/reset-password`);
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

  const isLoggedIn = Boolean(user);

  return (
    <div className="hp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      <PublicSiteHeader active="home" userEmail={user?.email ?? null} />

      <main>
        {/* 1. HERO SECTION */}
        <section className="hp-hero" aria-labelledby="hero-heading">
          <div className="hp-hero-bg-grid" aria-hidden="true" />
          <div className="hp-hero-orb hp-hero-orb-1" aria-hidden="true" />
          <div className="hp-hero-orb hp-hero-orb-2" aria-hidden="true" />

          <div className="hp-container hp-hero-content">
            <div className="hp-pill-badge">
              <Sparkles size={14} className="hp-badge-sparkle" aria-hidden="true" />
              <span>AI Project Management · Docs · Team Collaboration</span>
            </div>

            <h1 className="hp-hero-title" id="hero-heading">
              Project Management, Docs &amp; AI —{" "}
              <span className="hp-hero-highlight">Built as One Workspace</span>
            </h1>

            <p className="hp-hero-subtitle">
              Orbitwork is modern project management software for startups, growing businesses, and distributed product teams—uniting task management, project planning, living documentation, AI agents, and Project Brain in one place.
            </p>

            <div className="hp-hero-cta-group">
              {isLoggedIn ? (
                <>
                  <Link href="/my-dashboard" className="hp-btn-primary hp-btn-lg">
                    Open Your Dashboard <ArrowRight size={17} />
                  </Link>
                  <a href="#how-it-works" className="hp-btn-secondary hp-btn-lg">
                    See How It Works
                  </a>
                </>
              ) : (
                <>
                  <Link href="/signup" className="hp-btn-primary hp-btn-lg">
                    Start Free Workspace <ArrowRight size={17} />
                  </Link>
                  <a href="#how-it-works" className="hp-btn-secondary hp-btn-lg">
                    See How It Works
                  </a>
                </>
              )}
            </div>

            <ul className="hp-hero-capabilities" aria-label="Core platform capabilities">
              <li>12 Synchronized Views</li>
              <li>Living Project Docs</li>
              <li>Autonomous AI Agents &amp; Project Brain</li>
              <li>Free to Start · No Card Required</li>
            </ul>

            {/* Interactive 3D Product Workspace Stage */}
            <Hero3DWorkspaceStage />
          </div>
        </section>

        {/* 2. TARGET AUDIENCE */}
        <section className="hp-audience-section" aria-labelledby="audience-heading">
          <div className="hp-container">
            <div className="hp-audience-header">
              <span className="hp-section-tag">Who Orbitwork Is Built For</span>
              <h2 className="hp-audience-title" id="audience-heading">
                One project management tool built for modern teams at every stage
              </h2>
            </div>

            <div className="hp-audience-grid">
              {AUDIENCE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="hp-audience-card">
                    <div className="hp-audience-icon" aria-hidden="true">
                      <Icon size={19} />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. HOW ORBITWORK WORKS (Plan → Collaborate → Execute → Improve) */}
        <HowItWorksReel />

        {/* 4. PRODUCT SHOWCASE (Projects, List/Board/Timeline, Tasks, Docs, AI Agents, Project Brain, Collaboration) */}
        <div id="views" />
        <ProductShowcase isUserLoggedIn={isLoggedIn} />

        {/* 5. AI + PROJECT BRAIN (Animated Data-Flow Visualization) */}
        <ProjectBrainFlow />

        {/* 6. WHY ORBITWORK (Projects + Knowledge + AI in One Workspace) */}
        <section
          className="hp-section hp-why-section"
          id="features"
          aria-labelledby="why-orbitwork-heading"
        >
          <div className="hp-container">
            <div className="hp-section-header">
              <span className="hp-section-tag">Why Orbitwork</span>
              <h2 className="hp-section-title" id="why-orbitwork-heading">
                Projects, knowledge, and AI belong in the same workspace
              </h2>
              <p className="hp-section-desc">
                When planning, project documentation, team collaboration, and AI share one live data layer, teams spend less time copying context and more time delivering.
              </p>
            </div>

            <div className="hp-bento-grid">
              {/* Featured Wide Bento Card */}
              <article className="hp-bento-card hp-bento-wide">
                <div className="hp-bento-wide-copy">
                  <div className="hp-bento-icon hp-bi-emerald" aria-hidden="true">
                    <Zap size={20} />
                  </div>
                  <h3>Projects + Knowledge + AI — Zero Context Switching</h3>
                  <p>
                    Tasks link straight to living project specs, team channels convert messages into tracked work, and Project Brain reads it all in real time—no fragile sync plugins between separate apps.
                  </p>
                </div>

                {/* Visual Convergence Pill Diagram */}
                <div
                  className="hp-convergence-visual"
                  role="img"
                  aria-label="Diagram showing Projects, Knowledge Docs, and AI Agents converging into one unified Orbitwork workspace"
                >
                  <div className="hp-conv-pill">
                    <Kanban size={14} /> Projects &amp; Tasks
                  </div>
                  <span className="hp-conv-plus" aria-hidden="true">+</span>
                  <div className="hp-conv-pill">
                    <FileText size={14} /> Living Docs
                  </div>
                  <span className="hp-conv-plus" aria-hidden="true">+</span>
                  <div className="hp-conv-pill hp-conv-pill-ai">
                    <Brain size={14} /> Project Brain &amp; AI
                  </div>
                  <span className="hp-conv-eq" aria-hidden="true">→</span>
                  <div className="hp-conv-result">
                    <BrandMark size={18} />
                    <span>One Shared Source of Truth</span>
                  </div>
                </div>
              </article>

              <article className="hp-bento-card">
                <div className="hp-bento-icon hp-bi-violet" aria-hidden="true">
                  <Bot size={20} />
                </div>
                <h3>AI Agents Built Into Real Events</h3>
                <p>
                  Trigger acceptance checklists, subtask assignee inheritance, effort estimates, or custom plain-English agents automatically on task creation or status changes.
                </p>
              </article>

              <article className="hp-bento-card">
                <div className="hp-bento-icon hp-bi-emerald" aria-hidden="true">
                  <ShieldCheck size={20} />
                </div>
                <h3>Multi-Tenant Security via PostgreSQL RLS</h3>
                <p>
                  Organizations, Workspaces, and Projects are isolated at the database row level with Owner, Admin, Member, and Viewer access roles.
                </p>
              </article>

              <article className="hp-bento-card" id="timesheets">
                <div className="hp-bento-icon hp-bi-amber" aria-hidden="true">
                  <Clock size={20} />
                </div>
                <h3>Built-In Time Tracking, Timesheets &amp; Leave</h3>
                <p>
                  Run live task stopwatches, submit weekly timesheets for manager approval, export CSV/PDF reports, and coordinate team leave and country holidays.
                </p>
              </article>

              <article className="hp-bento-card" id="storage">
                <div className="hp-bento-icon hp-bi-sky" aria-hidden="true">
                  <Cloud size={20} />
                </div>
                <h3>Your Cloud, Your Files</h3>
                <p>
                  Route workspace attachments to Google Drive, Microsoft OneDrive, SharePoint, or built-in encrypted database storage with AES-256-GCM credential protection.
                </p>
              </article>

              <article className="hp-bento-card">
                <div className="hp-bento-icon hp-bi-emerald" aria-hidden="true">
                  <Users size={20} />
                </div>
                <h3>Flexible Views for Every Role</h3>
                <p>
                  Let every teammate reorder tabs across 12 views—from Live Tracker and Kanban to Gantt Timeline, Whiteboard, Flowchart, and Goals—without disrupting others.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 7. FINAL CTA */}
        <section className="hp-final-cta-wrap" aria-labelledby="final-cta-heading">
          <div className="hp-container">
            <div className="hp-final-cta">
              {/* Lightweight Animated Orbital Visual Backdrop */}
              <div className="hp-cta-orbit-bg" aria-hidden="true">
                <span className="hp-orbit-ring hp-orbit-r1" />
                <span className="hp-orbit-ring hp-orbit-r2" />
                <span className="hp-orbit-ring hp-orbit-r3" />
                <span className="hp-orbit-glow" />
              </div>

              <div className="hp-final-cta-inner">
                <span className="hp-cta-kicker">Ready in Minutes · Free to Start</span>
                <h2 id="final-cta-heading">
                  Bring your projects, docs, and AI into Orbit
                </h2>
                <p>
                  Create your organization, launch your first workspace, and experience unified project planning, team collaboration, and Project Brain today.
                </p>

                <div className="hp-cta-buttons">
                  {isLoggedIn ? (
                    <Link href="/my-dashboard" className="hp-btn-primary hp-btn-lg">
                      Open Your Dashboard <ArrowRight size={17} />
                    </Link>
                  ) : (
                    <>
                      <Link href="/signup" className="hp-btn-primary hp-btn-lg">
                        Create Free Workspace <ArrowRight size={17} />
                      </Link>
                      <Link href="/contact" className="hp-btn-secondary hp-btn-lg">
                        Contact Our Team
                      </Link>
                    </>
                  )}
                </div>

                <nav className="hp-cta-links" aria-label="Explore Orbitwork pages">
                  <Link href="/project-management-software">Project Management Software</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/free-project-management-software">Free Project Management</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/services/project-management">Platform Features</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/jira-alternative">Jira Alternative</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/asana-alternative">Asana Alternative</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/clickup-alternative">ClickUp Alternative</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/projects-case-studies">Use Cases</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/about">About</Link>
                </nav>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
