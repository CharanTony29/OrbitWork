import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  Cloud,
  Cog,
  Cpu,
  FileText,
  GitBranch,
  Kanban,
  Layers3,
  Share2,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  Zap,
} from "lucide-react";
import {
  HomeInteractiveTabs,
  HomeTeamPersonas,
  HomeFaqAccordion,
} from "./HomeInteractiveTabs";
import { HeroInteractiveMockup } from "./HeroInteractiveMockup";
import { PublicSiteHeader, PublicSiteFooter } from "./PublicSiteChrome";
import { CANONICAL_HOME_URL, CANONICAL_ORIGIN, buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Orbitwork | PLM Engineering & Product Lifecycle Management",
  absoluteTitle: true,
  description:
    "Orbitwork provides PLM engineering, Teamcenter implementation, CAD & BOM integration, and product lifecycle management solutions for modern engineering organizations.",
  path: "/",
  keywords: [
    "PLM engineering",
    "Product Lifecycle Management",
    "Teamcenter consulting",
    "BOM management",
    "ECN ECO change management",
    "CAD data management",
    "engineering project management",
    "Orbitwork",
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
      email: "orbitwork.admin@gmail.com",
      description:
        "PLM engineering consulting and collaborative product lifecycle & project management software for engineering teams.",
    },
    {
      "@type": "WebSite",
      "@id": `${CANONICAL_ORIGIN}/#website`,
      url: CANONICAL_HOME_URL,
      name: "Orbitwork",
      publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
    },
    {
      "@type": "Service",
      name: "PLM Engineering & Product Lifecycle Management Solutions",
      provider: { "@id": `${CANONICAL_ORIGIN}/#organization` },
      serviceType: [
        "PLM Engineering Consulting",
        "Teamcenter Implementation & BMIDE Configuration",
        "CAD, eBOM & mBOM Integration",
        "Engineering Change Management (ECN/ECO)",
        "Collaborative Engineering Workspaces",
      ],
      areaServed: "Global",
      url: `${CANONICAL_ORIGIN}/services/plm-engineering`,
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
            <span className="brand-mark">O</span>Orbit<span>work</span>
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
              <span>PLM Engineering Consulting &amp; Work Execution OS</span>
            </div>

            <h1 className="hp-hero-title">
              PLM Engineering &amp;{" "}
              <span className="hp-hero-highlight">
                Product Lifecycle Management Solutions
              </span>
            </h1>

            <p className="hp-hero-subtitle">
              Orbitwork helps manufacturing and technology organizations unify
              PLM engineering, Teamcenter workflows, CAD and BOM revision
              control, engineering change management (ECN/ECO), and day-to-day
              project delivery inside one secure platform.
            </p>

            <div className="hp-hero-cta-group">
              <Link href="/services/plm-engineering" className="hp-btn-primary">
                Explore PLM Engineering <ArrowRight size={17} />
              </Link>
              {user ? (
                <Link href="/dashboard" className="hp-btn-secondary">
                  Go to Your Dashboard
                </Link>
              ) : (
                <Link href="/contact" className="hp-btn-secondary">
                  Book a PLM Consultation
                </Link>
              )}
            </div>

            <ul className="hp-hero-checklist">
              <li>
                <Check size={16} /> Teamcenter &amp; BMIDE Architecture
              </li>
              <li>
                <Check size={16} /> eBOM / mBOM &amp; ECO Governance
              </li>
              <li>
                <Check size={16} /> Multi-CAD &amp; ERP Integration
              </li>
              <li>
                <Check size={16} /> Unified Workspace &amp; Timesheets
              </li>
            </ul>

            {/* Product Hero Mockup Preview */}
            <div className="hp-preview-wrap">
              <div className="hp-float-card hp-float-card-1">
                <div className="hp-float-icon hp-icon-green">
                  <Timer size={20} />
                </div>
                <div className="hp-float-text">
                  <strong>38.5 Engineering Hours</strong>
                  <span>NPI Release Gate · Approved ✓</span>
                </div>
              </div>

              <div className="hp-float-card hp-float-card-2">
                <div className="hp-float-icon hp-icon-amber">
                  <Cloud size={20} />
                </div>
                <div className="hp-float-text">
                  <strong>Drive, OneDrive &amp; SharePoint</strong>
                  <span>Controlled engineering doc sync</span>
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
                  <Workflow size={22} />
                </div>
                <div>
                  <h4>End-to-End PLM Delivery</h4>
                  <p>
                    From BMIDE data model design and Active Workspace rollouts to
                    production ERP synchronization.
                  </p>
                </div>
              </div>

              <div className="hp-value-item">
                <div className="hp-value-icon">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h4>Traceable Change Control</h4>
                  <p>
                    Eliminate broken BOM handoffs with structured ECR, ECN, and
                    ECO approval workflows.
                  </p>
                </div>
              </div>

              <div className="hp-value-item">
                <div className="hp-value-icon">
                  <Zap size={22} />
                </div>
                <div>
                  <h4>Connected Execution OS</h4>
                  <p>
                    Link PLM milestones directly to Kanban boards, Gantt charts,
                    living specs, chat, and timesheets.
                  </p>
                </div>
              </div>

              <div className="hp-value-item">
                <div className="hp-value-icon">
                  <Cloud size={22} />
                </div>
                <div>
                  <h4>Multi-Tenant Cloud Choice</h4>
                  <p>
                    Keep engineering artifacts in Google Drive, OneDrive,
                    SharePoint, or isolated database storage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLM Engineering Services & Capabilities */}
        <section
          className="hp-container"
          id="plm-services"
          style={{ padding: "64px 24px 24px" }}
        >
          <div className="hp-section-header">
            <span className="hp-section-tag">Core Practice Areas</span>
            <h2 className="hp-section-title">
              PLM engineering expertise tailored to complex products
            </h2>
            <p className="hp-section-desc">
              We partner with discrete manufacturing, automotive, electronics, and
              industrial engineering teams to modernize product data lifecycles
              and accelerate New Product Introduction (NPI).
            </p>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Cog size={24} />
              </div>
              <h3>Teamcenter Implementation &amp; Upgrade</h3>
              <p>
                Architecture planning, BMIDE custom object and revision rule
                design, Active Workspace configuration, access control lists, and
                zero-downtime version upgrades across global sites.
              </p>
              <Link href="/services/plm-engineering" className="hp-inline-link">
                Read PLM implementation scope <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <GitBranch size={24} />
              </div>
              <h3>CAD, BOM &amp; Change Governance (ECN/ECO)</h3>
              <p>
                Align mechanical and electrical CAD structures (Siemens NX,
                SolidWorks, Creo, AutoCAD) with governed eBOM-to-mBOM
                transformation and closed-loop engineering change orders.
              </p>
              <Link href="/services/plm-engineering" className="hp-inline-link">
                Explore BOM &amp; ECO governance <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Layers3 size={24} />
              </div>
              <h3>Legacy PDM Migration &amp; ERP Integration</h3>
              <p>
                Automated ETL validation for migrating legacy vault data, custom
                attributes, and multi-revision CAD assemblies into modern PLM
                with bi-directional REST/SOA connectors to SAP and NetSuite.
              </p>
              <Link href="/services" className="hp-inline-link">
                Browse integration services <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Cpu size={24} />
              </div>
              <h3>Industries &amp; Program Case Studies</h3>
              <p>
                Proven engineering workflows across EV powertrain, industrial
                robotics, aerospace compliance, and medical hardware programs.
                Explore measurable cycle-time and audit outcomes.
              </p>
              <Link href="/projects-case-studies" className="hp-inline-link">
                View projects &amp; case studies <ArrowRight size={14} />
              </Link>
            </article>
          </div>
        </section>

        {/* Interactive Workspace Tabs Showcase */}
        <div className="hp-container">
          <HomeInteractiveTabs isUserLoggedIn={!!user} />
        </div>

        {/* Platform Capabilities Deep Dive Grid */}
        <section
          className="hp-container"
          id="features"
          style={{ padding: "56px 24px" }}
        >
          <div className="hp-section-header">
            <span className="hp-section-tag">Orbitwork Platform</span>
            <h2 className="hp-section-title">
              Everything engineered for program execution clarity
            </h2>
            <p className="hp-section-desc">
              Complement your core PLM backbone with calm project management,
              engineering time tracking, and live cross-functional
              collaboration.
            </p>
          </div>

          <div className="hp-features-grid">
            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={26} />
              </div>
              <h3>Dynamic Task Views</h3>
              <p>
                Switch between agile Kanban boards, Excel-like sheet tables,
                interactive Gantt timelines, and workload schedules in a single
                click.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Custom workflow stages &amp; priorities
                </li>
                <li>
                  <Check size={15} /> Inline rapid task creation &amp; editing
                </li>
                <li>
                  <Check size={15} /> Subtasks, checklists &amp; dependencies
                </li>
              </ul>
            </div>

            <div className="hp-feature-card" id="timesheets">
              <div className="hp-feature-icon-wrap">
                <Clock size={26} />
              </div>
              <h3>Engineering Timesheets</h3>
              <p>
                Track engineering R&amp;D and consulting effort directly inside
                every task. Submit weekly timesheets with approval audit trails.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Live task stopwatch timers &amp; manual logs
                </li>
                <li>
                  <Check size={15} /> Billable vs non-billable categorization
                </li>
                <li>
                  <Check size={15} /> One-click CSV export &amp; PDF reports
                </li>
              </ul>
            </div>

            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <FileText size={26} />
              </div>
              <h3>Technical Specifications &amp; Docs</h3>
              <p>
                Write living engineering specifications, ECR impact assessments,
                and SOP runbooks with revision snapshots next to project tasks.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Markdown formatting &amp; inline diagrams
                </li>
                <li>
                  <Check size={15} /> Historical snapshots &amp; version restore
                </li>
                <li>
                  <Check size={15} /> Instant professional PDF download
                </li>
              </ul>
            </div>

            <div className="hp-feature-card" id="storage">
              <div className="hp-feature-icon-wrap">
                <Cloud size={26} />
              </div>
              <h3>Multi-Cloud Storage Freedom</h3>
              <p>
                Connect Google Drive, Microsoft OneDrive, SharePoint, or use
                Orbitwork’s encrypted database storage per engineering
                workspace.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Encrypted OAuth credentials (AES-256-GCM)
                </li>
                <li>
                  <Check size={15} /> Workspace-level storage routing
                </li>
                <li>
                  <Check size={15} /> Zero vendor lock-in or extra file fees
                </li>
              </ul>
            </div>

            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <Building2 size={26} />
              </div>
              <h3>Multi-Tenant Supplier Isolation</h3>
              <p>
                Isolate internal programs from external vendors using strict
                Organization, Workspace, and Project role-based access control.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Owner, Admin, Member &amp; Viewer roles
                </li>
                <li>
                  <Check size={15} /> Secure email tokens for vendor invitations
                </li>
                <li>
                  <Check size={15} /> PostgreSQL Row Level Security isolation
                </li>
              </ul>
            </div>

            <div className="hp-feature-card">
              <div className="hp-feature-icon-wrap">
                <Share2 size={26} />
              </div>
              <h3>Whiteboards &amp; Architecture Flows</h3>
              <p>
                Map complex PLM interfaces, BOM workflows, and system diagrams
                on infinite whiteboards linked directly to executable sprint
                tasks.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Convert diagram nodes into project tasks
                </li>
                <li>
                  <Check size={15} /> Visual dependency arrows &amp; critical paths
                </li>
                <li>
                  <Check size={15} /> Export high-res vector graphics anytime
                </li>
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
              <span className="hp-section-tag">Unified Work Architecture</span>
              <h2 className="hp-section-title">
                How Orbitwork bridges PLM systems and project delivery
              </h2>
              <p className="hp-section-desc">
                Engineering specifications, tasks, change approvals, files, and
                billable hours stay connected under every project.
              </p>
            </div>

            <div className="hp-compare-table-wrap">
              <table className="hp-compare-table">
                <thead>
                  <tr>
                    <th style={{ width: "25%" }}>Discipline</th>
                    <th style={{ width: "38%" }} className="hp-compare-highlight-col">
                      <div className="hp-compare-badge-orbit">
                        <span
                          className="brand-mark"
                          style={{
                            width: 22,
                            height: 22,
                            fontSize: 13,
                            marginRight: 4,
                          }}
                        >
                          O
                        </span>
                        In Orbitwork
                      </div>
                    </th>
                    <th style={{ width: "37%" }}>Engineering Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>PLM &amp; Change Workflows</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Structured Gates
                      </span>{" "}
                      — ECR/ECO milestones, dependencies &amp; audit logs
                    </td>
                    <td>
                      Clear sign-off accountability across mechanical, electrical,
                      and manufacturing teams.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Task Management</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        5 Synchronized Views
                      </span>{" "}
                      — Board, Sheet, Gantt, Calendar &amp; Flowchart
                    </td>
                    <td>
                      Program managers and engineers view live deliverables
                      without manual status slide decks.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Time &amp; R&amp;D Costing</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Built-in Timers
                      </span>{" "}
                      — Live task stopwatch + weekly approval &amp; CSV/PDF export
                    </td>
                    <td>
                      Accurate engineering utilization tracking across internal
                      NPI and client engagements.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Engineering Docs</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Living Specs
                      </span>{" "}
                      — Markdown specs, embedded images &amp; version history
                    </td>
                    <td>
                      Keep DFM reviews, test plans, and deployment SOPs alongside
                      the tasks that implement them.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Enterprise Storage</strong>
                    </td>
                    <td className="hp-compare-highlight-col">
                      <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>
                        Bring Your Cloud
                      </span>{" "}
                      — Google Drive, OneDrive, SharePoint or Local DB
                    </td>
                    <td>
                      Files remain under corporate IT governance with AES-256-GCM
                      encrypted OAuth tokens.
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
              Answers about Orbitwork PLM engineering services, Teamcenter
              consulting, multi-tenancy, and security.
            </p>
          </div>

          <HomeFaqAccordion />
        </section>

        {/* Final Call to Action Banner */}
        <div className="hp-container">
          <section className="hp-cta-banner">
            <h2>Ready to modernize your PLM and engineering workflows?</h2>
            <p>
              Speak with our PLM engineering architects or launch a collaborative
              Orbitwork workspace for your team today.
            </p>

            <div className="hp-cta-buttons">
              <Link href="/contact" className="hp-btn-primary">
                Request a PLM Consultation <ArrowRight size={17} />
              </Link>
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="hp-btn-secondary"
              >
                {user ? "Open Your Dashboard" : "Get Started for Free"}
              </Link>
            </div>

            <div className="hp-cta-fineprint">
              <Link href="/services" style={{ color: "inherit" }}>
                Services
              </Link>{" "}
              ·{" "}
              <Link href="/services/plm-engineering" style={{ color: "inherit" }}>
                PLM Engineering
              </Link>{" "}
              ·{" "}
              <Link href="/projects-case-studies" style={{ color: "inherit" }}>
                Case Studies
              </Link>{" "}
              ·{" "}
              <Link href="/about" style={{ color: "inherit" }}>
                About Orbitwork
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
