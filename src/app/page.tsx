import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Kanban,
  Clock,
  FileText,
  Cloud,
  Layers3,
  Users,
  ShieldCheck,
  Sparkles,
  Zap,
  Timer,
  Building2,
  Share2,
  Lock,
  ChevronRight
} from "lucide-react";
import {
  HomeInteractiveTabs,
  HomeTeamPersonas,
  HomeFaqAccordion,
  HomeMobileNav
} from "./HomeInteractiveTabs";
import { HeroInteractiveMockup } from "./HeroInteractiveMockup";

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
  if (params.error && (params.type === "recovery" || params.next?.includes("reset-password") || params.error.includes("recovery"))) {
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
          <div className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 18 }}>
            <span className="brand-mark">O</span>Orbit<span>work</span>
          </div>
          <h1 style={{ marginTop: 16 }}>Configuration Required</h1>
          <p className="muted">
            Your deployment is live, but required Supabase environment variables are missing.
          </p>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "14px 16px", borderRadius: 8, fontSize: 12.5, color: "#92400e", margin: "16px 0", lineHeight: 1.6 }}>
            <strong>How to configure:</strong>
            <ol style={{ paddingLeft: 18, marginTop: 8 }}>
              <li>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> to your environment variables</li>
              <li>Add <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> or <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></li>
              <li>Restart your development server or redeploy</li>
            </ol>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="hp-page">
      {/* Navigation Bar */}
      <header className="hp-nav">
        <div className="hp-container hp-nav-inner">
          <Link className="brand" href="/" aria-label="Orbitwork home">
            <span className="brand-mark">O</span>Orbit<span>work</span>
          </Link>

          <nav className="hp-nav-links" aria-label="Main Navigation">
            <a href="#features" className="hp-nav-link">Features</a>
            <a href="#views" className="hp-nav-link">Task Views</a>
            <a href="#timesheets" className="hp-nav-link">Timesheets</a>
            <a href="#storage" className="hp-nav-link">Cloud Storage</a>
            <a href="#comparison" className="hp-nav-link">Workflows</a>
            <a href="#faq" className="hp-nav-link">FAQ</a>
          </nav>

          <div className="hp-nav-actions">
            {user ? (
              <>
                <span className="hp-user-badge" title={user.email ?? ""}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--hp-green)" }} />
                  {user.email?.split("@")[0]}
                </span>
                <Link href="/dashboard" className="hp-btn-primary">
                  Dashboard <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hp-btn-text">
                  Sign In
                </Link>
                <Link href="/signup" className="hp-btn-primary">
                  Get Started Free
                </Link>
              </>
            )}
            <HomeMobileNav isUserLoggedIn={!!user} />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hp-hero">
        <div className="hp-hero-glow" />
        <div className="hp-container hp-hero-content">
          <div className="hp-pill-badge">
            <Sparkles size={14} />
            <span>The All-in-One Work &amp; Project Management OS</span>
          </div>

          <h1 className="hp-hero-title">
            One thoughtful workspace for your{" "}
            <span className="hp-hero-highlight">projects, people, and progress.</span>
          </h1>

          <p className="hp-hero-subtitle">
            Unify agile Kanban workflows, interactive spreadsheet sheets, Gantt timelines, rich ClickUp-style docs, built-in time tracking, and multi-cloud storage into one cohesive, distraction-free platform.
          </p>

          <div className="hp-hero-cta-group">
            {user ? (
              <>
                <Link href="/dashboard" className="hp-btn-primary">
                  Go to Your Dashboard <ArrowRight size={17} />
                </Link>
                <a href="#views" className="hp-btn-secondary">
                  Explore Workspaces
                </a>
              </>
            ) : (
              <>
                <Link href="/signup" className="hp-btn-primary">
                  Get Started for Free <ArrowRight size={17} />
                </Link>
                <Link href="/login" className="hp-btn-secondary">
                  Sign in to Account
                </Link>
              </>
            )}
          </div>

          <ul className="hp-hero-checklist">
            <li>
              <Check size={16} /> Free forever tier
            </li>
            <li>
              <Check size={16} /> No credit card required
            </li>
            <li>
              <Check size={16} /> Multi-tenant workspaces
            </li>
            <li>
              <Check size={16} /> Built-in time tracking
            </li>
          </ul>

          {/* Product Hero Mockup Preview */}
          <div className="hp-preview-wrap">
            {/* Floating Metric 1 */}
            <div className="hp-float-card hp-float-card-1">
              <div className="hp-float-icon hp-icon-green">
                <Timer size={20} />
              </div>
              <div className="hp-float-text">
                <strong>38.5 Hours Logged</strong>
                <span>Weekly Timesheet · Approved ✓</span>
              </div>
            </div>

            {/* Floating Metric 2 */}
            <div className="hp-float-card hp-float-card-2">
              <div className="hp-float-icon hp-icon-amber">
                <Cloud size={20} />
              </div>
              <div className="hp-float-text">
                <strong>Google Drive &amp; OneDrive</strong>
                <span>Workspace cloud sync active</span>
              </div>
            </div>

            {/* Interactive Hero Mockup Component */}
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
                <p>Tasks, boards, sheets, docs, timesheets, and chats live together in one coherent environment.</p>
              </div>
            </div>

            <div className="hp-value-item">
              <div className="hp-value-icon">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h4>Multi-Tenant Security</h4>
                <p>Strict PostgreSQL Row Level Security keeps organizations, workspaces, and files completely isolated.</p>
              </div>
            </div>

            <div className="hp-value-item">
              <div className="hp-value-icon">
                <Cloud size={22} />
              </div>
              <div>
                <h4>Your Choice of Cloud</h4>
                <p>Store project attachments in Google Drive, OneDrive, SharePoint, or built-in Local encrypted storage.</p>
              </div>
            </div>

            <div className="hp-value-item">
              <div className="hp-value-icon">
                <Clock size={22} />
              </div>
              <div>
                <h4>Native Time Tracking</h4>
                <p>Stop paying for Toggl or Harvest. Built-in live task stopwatch timers and weekly approval timesheets.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tabs Showcase */}
      <div className="hp-container">
        <HomeInteractiveTabs isUserLoggedIn={!!user} />
      </div>

      {/* Core Features Deep Dive Grid */}
      <section className="hp-container" id="features" style={{ padding: "60px 24px" }}>
        <div className="hp-section-header">
          <span className="hp-section-tag">Built for High-Velocity Teams</span>
          <h2 className="hp-section-title">Everything engineered for maximum clarity</h2>
          <p className="hp-section-desc">
            Discover why modern teams replace cumbersome enterprise tools with Orbitwork.
          </p>
        </div>

        <div className="hp-features-grid">
          {/* Card 1 */}
          <div className="hp-feature-card">
            <div className="hp-feature-icon-wrap">
              <Kanban size={26} />
            </div>
            <h3>Dynamic Task Views</h3>
            <p>
              Switch between agile Kanban boards, Excel-like sheet tables, interactive Gantt timelines, and team workload schedules in a single click.
            </p>
            <ul className="hp-feature-bullets">
              <li><Check size={15} /> Custom workflow stages &amp; priorities</li>
              <li><Check size={15} /> Inline rapid task creation &amp; editing</li>
              <li><Check size={15} /> Subtasks, checklists &amp; dependencies</li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="hp-feature-card" id="timesheets">
            <div className="hp-feature-icon-wrap">
              <Clock size={26} />
            </div>
            <h3>Integrated Timesheets</h3>
            <p>
              Accurate, pain-free time tracking directly inside every task. Submit weekly timesheets for manager review with approval audit trails.
            </p>
            <ul className="hp-feature-bullets">
              <li><Check size={15} /> Live task stopwatch timers &amp; manual logs</li>
              <li><Check size={15} /> Billable vs non-billable categorization</li>
              <li><Check size={15} /> One-click CSV export &amp; PDF reports</li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="hp-feature-card">
            <div className="hp-feature-icon-wrap">
              <FileText size={26} />
            </div>
            <h3>ClickUp-Style Rich Docs</h3>
            <p>
              Create living specifications and team knowledge bases. Embed task widgets, track revision histories, and collaborate seamlessly.
            </p>
            <ul className="hp-feature-bullets">
              <li><Check size={15} /> Full Markdown formatting &amp; code highlights</li>
              <li><Check size={15} /> Historical snapshots &amp; version restore</li>
              <li><Check size={15} /> Instant professional PDF download</li>
            </ul>
          </div>

          {/* Card 4 */}
          <div className="hp-feature-card" id="storage">
            <div className="hp-feature-icon-wrap">
              <Cloud size={26} />
            </div>
            <h3>Multi-Cloud Storage Freedom</h3>
            <p>
              You own your data. Attach Google Drive, Microsoft OneDrive, SharePoint, or use Orbitwork’s built-in local database storage per workspace.
            </p>
            <ul className="hp-feature-bullets">
              <li><Check size={15} /> Encrypted OAuth credentials (AES-256-GCM)</li>
              <li><Check size={15} /> Workspace-level storage routing</li>
              <li><Check size={15} /> Zero vendor lock-in or extra file hosting fees</li>
            </ul>
          </div>

          {/* Card 5 */}
          <div className="hp-feature-card">
            <div className="hp-feature-icon-wrap">
              <Building2 size={26} />
            </div>
            <h3>Multi-Tenant Hierarchy</h3>
            <p>
              Organize your entire company: Organizations contain Workspaces, Workspaces house Projects, and Projects hold Tasks.
            </p>
            <ul className="hp-feature-bullets">
              <li><Check size={15} /> Owner, Admin, Member &amp; Viewer roles</li>
              <li><Check size={15} /> Secure email tokens for member invitations</li>
              <li><Check size={15} /> Granular team permissions &amp; access control</li>
            </ul>
          </div>

          {/* Card 6 */}
          <div className="hp-feature-card">
            <div className="hp-feature-icon-wrap">
              <Share2 size={26} />
            </div>
            <h3>Whiteboards &amp; Flowcharts</h3>
            <p>
              Map complex flows and sketch system architecture with interactive flowcharts and infinite canvas whiteboards that link to real work.
            </p>
            <ul className="hp-feature-bullets">
              <li><Check size={15} /> Convert whiteboard nodes directly into tasks</li>
              <li><Check size={15} /> Visual dependency arrows &amp; critical paths</li>
              <li><Check size={15} /> Export high-res vector graphics anytime</li>
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
            <h2 className="hp-section-title">How Orbitwork organizes project work</h2>
            <p className="hp-section-desc">
              All tools, files, time logs, and documentation remain connected under your project.
            </p>
          </div>

          <div className="hp-compare-table-wrap">
            <table className="hp-compare-table">
              <thead>
                <tr>
                  <th style={{ width: "25%" }}>Module</th>
                  <th style={{ width: "38%" }} className="hp-compare-highlight-col">
                    <div className="hp-compare-badge-orbit">
                      <span className="brand-mark" style={{ width: 22, height: 22, fontSize: 13, marginRight: 4 }}>O</span>
                      In Orbitwork
                    </div>
                  </th>
                  <th style={{ width: "37%" }}>Workflow Integration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Task Management</strong></td>
                  <td className="hp-compare-highlight-col">
                    <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>5 Synchronized Views</span> — Board, Sheet, Gantt, Calendar &amp; Flowchart
                  </td>
                  <td>Switch between views instantly; all members view the same live project tasks.</td>
                </tr>
                <tr>
                  <td><strong>Time &amp; Timesheets</strong></td>
                  <td className="hp-compare-highlight-col">
                    <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>Built-in Timers</span> — Live stopwatch on tasks + weekly review &amp; export
                  </td>
                  <td>Logged hours attach directly to tasks, with billable tracking and CSV/PDF export.</td>
                </tr>
                <tr>
                  <td><strong>Project Documents</strong></td>
                  <td className="hp-compare-highlight-col">
                    <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>Living Docs</span> — Markdown, task links &amp; version history
                  </td>
                  <td>Write specifications, requirements, and meeting notes right where tasks are executed.</td>
                </tr>
                <tr>
                  <td><strong>File Storage</strong></td>
                  <td className="hp-compare-highlight-col">
                    <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>Bring Your Storage</span> — Google Drive, OneDrive, SharePoint or Local DB
                  </td>
                  <td>Each workspace selects its own storage provider with encrypted OAuth tokens.</td>
                </tr>
                <tr>
                  <td><strong>Visual Planning</strong></td>
                  <td className="hp-compare-highlight-col">
                    <span style={{ color: "var(--hp-green)", fontWeight: 700 }}>Whiteboard Canvas</span> — Infinite canvas &amp; task flowcharts
                  </td>
                  <td>Sketch flows, map architecture, and link visual nodes directly to sprint tasks.</td>
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
            Quick answers about Orbitwork features, multi-tenancy, integrations, and security.
          </p>
        </div>

        <HomeFaqAccordion />
      </section>

      {/* Final Call to Action Banner */}
      <div className="hp-container">
        <section className="hp-cta-banner">
          <h2>Bring clarity to your projects today</h2>
          <p>
            Experience a calmer, faster way to organize work, manage team capacity, and ship meaningful results together.
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
                <Link href="/login" className="hp-btn-secondary">
                  Sign In to Account
                </Link>
              </>
            )}
          </div>

          <div className="hp-cta-fineprint">
            Free forever tier · No credit card required · Instant setup in under 2 minutes
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="hp-footer">
        <div className="hp-container">
          <div className="hp-footer-top">
            <div className="hp-footer-brand">
              <Link className="brand" href="/" aria-label="Orbitwork home">
                <span className="brand-mark">O</span>Orbit<span>work</span>
              </Link>
              <p>
                The modern, thoughtful project and work management platform designed for high-velocity teams and calm execution.
              </p>
            </div>

            <div className="hp-footer-col">
              <h5>Product</h5>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#views">Task Views</a></li>
                <li><a href="#timesheets">Timesheets</a></li>
                <li><a href="#storage">Cloud Storage</a></li>
                <li><a href="#comparison">Workflows</a></li>
              </ul>
            </div>

            <div className="hp-footer-col">
              <h5>Workspaces</h5>
              <ul>
                <li><Link href="/login">Sign In</Link></li>
                <li><Link href="/signup">Create Account</Link></li>
                <li><Link href="/dashboard">Dashboard</Link></li>
                <li><a href="#faq">Help &amp; FAQ</a></li>
              </ul>
            </div>

            <div className="hp-footer-col">
              <h5>Legal &amp; Privacy</h5>
              <ul>
                <li><Link href="/terms">Terms of Service</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><a href="mailto:orbitwork.admin@gmail.com">Security &amp; Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="hp-footer-bottom">
            <div>
              &copy; {new Date().getFullYear()} Orbitwork. All rights reserved.
            </div>
            <div>
              Designed for focus, simplicity, and speed.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
