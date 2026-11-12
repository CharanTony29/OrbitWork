"use client";

import { useState } from "react";
import {
  Kanban,
  Clock,
  FileText,
  Cloud,
  Share2,
  CheckCircle2,
  Play,
  Pause,
  ArrowRight,
  ShieldCheck,
  FolderGit2,
  Calendar,
  Sparkles,
  ChevronDown,
  Menu,
  X,
  Code,
  Palette,
  Briefcase,
  UsersRound,
  Check,
  ExternalLink
} from "lucide-react";
import Link from "next/link";

interface TabData {
  id: string;
  label: string;
  icon: React.ElementType;
  title: string;
  description: string;
  highlights: string[];
  ctaLabel: string;
  ctaHref: string;
  preview: React.ReactNode;
}

export function HomeInteractiveTabs({ isUserLoggedIn }: { isUserLoggedIn: boolean }) {
  const [activeTab, setActiveTab] = useState<string>("views");
  const [selectedStorage, setSelectedStorage] = useState<"drive" | "onedrive" | "sharepoint" | "local">("drive");

  const tabs: TabData[] = [
    {
      id: "views",
      label: "Task Views",
      icon: Kanban,
      title: "Work your way: Kanban, Sheet, Gantt & Calendar",
      description:
        "Every team member works differently. Engineers prefer Kanban boards, managers love spreadsheet sheets, and executives require timeline Gantt roadmaps. Orbitwork synchronizes all views seamlessly with zero lag.",
      highlights: [
        "Drag-and-drop workflow status columns (To Do, In Progress, Review, Done)",
        "Spreadsheet-like List view with rapid inline editing & custom fields",
        "Interactive Gantt Timeline with dependency arrows and milestone tracking",
        "Team workload capacity and scheduled calendar events"
      ],
      ctaLabel: isUserLoggedIn ? "Open Task Board" : "Try Kanban & Sheet Views",
      ctaHref: isUserLoggedIn ? "/dashboard" : "/signup",
      preview: (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line, #e4e9e5)", paddingBottom: 10 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="hp-tag hp-tag-green">Sprint 14</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Mobile Checkout Redesign</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <span className="hp-mockup-view-tab active" style={{ fontSize: 10 }}>Board</span>
              <span className="hp-mockup-view-tab" style={{ fontSize: 10 }}>Sheet</span>
              <span className="hp-mockup-view-tab" style={{ fontSize: 10 }}>Gantt</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--line, #e4e9e5)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="hp-tag hp-tag-amber">In Progress</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Due Tomorrow</span>
              </div>
              <strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Apple Pay &amp; Stripe Elements</strong>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span className="hp-mockup-timer-pill"><Clock size={10} /> 02:14:00</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>3 subtasks</span>
              </div>
            </div>
            <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--line, #e4e9e5)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="hp-tag hp-tag-purple">Under Review</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Milestone</span>
              </div>
              <strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Biometric Fingerprint Auth</strong>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span className="hp-tag hp-tag-green">Passed CI</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>Lead dev</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "timesheets",
      label: "Time & Timesheets",
      icon: Clock,
      title: "Built-in time tracking, billables & manager review",
      description:
        "Say goodbye to disjointed time tracking software. Orbitwork includes one-click task timers, daily duration logging, billable vs non-billable splits, and weekly submitted timesheets ready for manager sign-off.",
      highlights: [
        "1-click start/stop timers directly on task cards and headers",
        "Weekly timesheet submission with instant status (Pending, Approved, Rejected)",
        "Overtime and hour burnout exhaustion notifications",
        "One-click CSV & PDF export for team billing and payroll"
      ],
      ctaLabel: isUserLoggedIn ? "View My Timesheets" : "Explore Timesheet Workflows",
      ctaHref: isUserLoggedIn ? "/dashboard" : "/signup",
      preview: (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Week 45 Summary</span>
            <span className="hp-tag hp-tag-green" style={{ fontSize: 11 }}>Status: Approved ✓</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>Total Logged</span>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>40h 00m</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>Billable</span>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--green)", marginTop: 2 }}>36h 30m</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>Tasks</span>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>12 Tasks</div>
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="hp-icon-green" style={{ width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center" }}>
                <Clock size={14} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>API Optimization &amp; Indexing</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700 }}>4h 15m</span>
          </div>
        </div>
      )
    },
    {
      id: "docs",
      label: "ClickUp-Style Docs",
      icon: FileText,
      title: "Rich collaborative docs embedded directly in projects",
      description:
        "Keep specifications, product requirement docs, and team wikis where the actual work happens. Create Markdown-powered documents, embed live task references, track version histories, and download styled PDFs.",
      highlights: [
        "Rich formatting controls: headings, code blocks, tables, task lists",
        "Version history snapshots with one-click restore and revision diffs",
        "Link documents directly to workspace tasks and project workflows",
        "Clean, professional PDF export for sharing with external stakeholders"
      ],
      ctaLabel: isUserLoggedIn ? "Open Documents" : "Start Documenting Free",
      ctaHref: isUserLoggedIn ? "/dashboard" : "/signup",
      preview: (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            <FileText size={16} color="var(--green)" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Architecture Spec: v2.4</span>
            <span className="hp-tag hp-tag-blue" style={{ marginLeft: "auto", fontSize: 9 }}>Published</span>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--muted)" }}>
            <p style={{ margin: "0 0 6px" }}><strong>1. Authentication &amp; Sessions</strong></p>
            <p style={{ margin: "0 0 6px" }}>Supabase SSR cookies with strict encryption. User roles enforced at database row level security.</p>
            <div style={{ background: "var(--surface-subtle)", padding: "6px 10px", borderRadius: 6, fontFamily: "monospace", fontSize: 10.5 }}>
              export async function updateSession(req) &#123; ... &#125;
            </div>
          </div>
        </div>
      )
    },
    {
      id: "storage",
      label: "Cloud Storage",
      icon: Cloud,
      title: "Bring your own storage: Google Drive, OneDrive & SharePoint",
      description:
        "You should always own your team's files. Orbitwork allows each workspace to choose where attachments live: native secure local database storage, Google Drive, Microsoft OneDrive, or SharePoint with AES-256 token encryption.",
      highlights: [
        "Google Drive integration with scoped drive.file permission",
        "Microsoft OneDrive and SharePoint document library support",
        "Local built-in encrypted database storage for instant zero-setup use",
        "Granular per-workspace isolation—no accidental cross-tenant data leakage"
      ],
      ctaLabel: isUserLoggedIn ? "Manage Workspace Storage" : "See Storage Integrations",
      ctaHref: isUserLoggedIn ? "/dashboard" : "/signup",
      preview: (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Workspace Storage Provider (Interactive)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => setSelectedStorage("drive")}
              style={{
                background: "var(--surface)",
                border: selectedStorage === "drive" ? "2px solid var(--green)" : "1px solid var(--line)",
                borderRadius: 8,
                padding: 10,
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Cloud size={14} color="var(--green)" />
                <strong style={{ fontSize: 12 }}>Google Drive</strong>
              </div>
              <span className="hp-tag hp-tag-green" style={{ fontSize: 9 }}>
                {selectedStorage === "drive" ? "Selected · Active" : "Connect"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStorage("onedrive")}
              style={{
                background: "var(--surface)",
                border: selectedStorage === "onedrive" ? "2px solid #0078d4" : "1px solid var(--line)",
                borderRadius: 8,
                padding: 10,
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Cloud size={14} color="#0078d4" />
                <strong style={{ fontSize: 12 }}>OneDrive</strong>
              </div>
              <span className={selectedStorage === "onedrive" ? "hp-tag hp-tag-blue" : ""} style={{ fontSize: 9, color: "var(--muted)" }}>
                {selectedStorage === "onedrive" ? "Selected · Active" : "Available"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStorage("sharepoint")}
              style={{
                background: "var(--surface)",
                border: selectedStorage === "sharepoint" ? "2px solid #0369a1" : "1px solid var(--line)",
                borderRadius: 8,
                padding: 10,
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Cloud size={14} color="#0369a1" />
                <strong style={{ fontSize: 12 }}>SharePoint</strong>
              </div>
              <span className={selectedStorage === "sharepoint" ? "hp-tag hp-tag-blue" : ""} style={{ fontSize: 9, color: "var(--muted)" }}>
                {selectedStorage === "sharepoint" ? "Selected · Active" : "Available"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStorage("local")}
              style={{
                background: "var(--surface)",
                border: selectedStorage === "local" ? "2px solid #b45309" : "1px solid var(--line)",
                borderRadius: 8,
                padding: 10,
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Cloud size={14} color="#b45309" />
                <strong style={{ fontSize: 12 }}>Local DB</strong>
              </div>
              <span className={selectedStorage === "local" ? "hp-tag hp-tag-amber" : ""} style={{ fontSize: 9, color: "var(--muted)" }}>
                {selectedStorage === "local" ? "Selected · Built-in" : "Built-in"}
              </span>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
            <ShieldCheck size={14} color="var(--green)" />
            <span>OAuth tokens encrypted via AES-256-GCM. Zero third-party inspection.</span>
          </div>
        </div>
      )
    },
    {
      id: "whiteboard",
      label: "Visual Whiteboards",
      icon: Share2,
      title: "Freeform whiteboards & flowchart diagrams",
      description:
        "Brainstorm architecture, design user flows, and wireframe complex state machines. Convert whiteboard flowchart shapes into real project tasks in a single click.",
      highlights: [
        "Infinite whiteboard canvas with shapes, stickies, arrows, and text",
        "Project flowchart view linking task dependencies visually",
        "Multi-user zoom, pan, and real-time state persistence",
        "Export diagrams to SVG and PNG for design review"
      ],
      ctaLabel: isUserLoggedIn ? "Open Whiteboard" : "Explore Whiteboards",
      ctaHref: isUserLoggedIn ? "/dashboard" : "/signup",
      preview: (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Visual Architecture Flow</span>
            <span className="hp-tag hp-tag-amber" style={{ fontSize: 9 }}>Canvas: 100% Zoom</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 0" }}>
            <div style={{ background: "#eaf4ed", border: "1px solid var(--green)", borderRadius: 6, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--green)" }}>
              User Signup
            </div>
            <ArrowRight size={14} color="var(--muted)" />
            <div style={{ background: "#fef3c7", border: "1px solid #b45309", borderRadius: 6, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#b45309" }}>
              Auth RPC
            </div>
            <ArrowRight size={14} color="var(--muted)" />
            <div style={{ background: "#e0f2fe", border: "1px solid #0369a1", borderRadius: 6, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#0369a1" }}>
              Create Org
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)" }}>
            ⚡ 3 nodes automatically linked to Sprint Tasks
          </div>
        </div>
      )
    }
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className="hp-tabs-section" id="views">
      <div className="hp-section-header">
        <span className="hp-section-tag">Interactive Workspace</span>
        <h2 className="hp-section-title">Everything your team needs, unified in one tab</h2>
        <p className="hp-section-desc">
          Click through Orbitwork&apos;s primary workflows to see how each module connects effortlessly.
        </p>
      </div>

      <div className="hp-tabs-nav">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`hp-tab-button ${isActive ? "active" : ""}`}
              type="button"
            >
              <IconComponent size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hp-tab-panel">
        <div className="hp-tab-info">
          <h3>{currentTab.title}</h3>
          <p>{currentTab.description}</p>
          <ul className="hp-tab-highlights">
            {currentTab.highlights.map((item, idx) => (
              <li key={idx}>
                <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0 }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link href={currentTab.ctaHref} className="hp-btn-primary">
            {currentTab.ctaLabel}
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="hp-tab-visual-wrap">
          {currentTab.preview}
        </div>
      </div>
    </div>
  );
}

export function HomeTeamPersonas() {
  const [activePersona, setActivePersona] = useState<"eng" | "design" | "agency" | "ops">("eng");

  const personas = {
    eng: {
      title: "Built for High-Velocity Engineering Teams",
      desc: "Fast, distraction-free sprint planning without the enterprise lag. Manage backlogs, link pull requests, review flowchart architecture, and track bug fixes with pinpoint accuracy.",
      bullets: [
        "Kanban sprint boards with customized lifecycle columns",
        "Subtasks, blockers, dependencies, and checklists",
        "Code snippets in specs with markdown syntax highlights",
        "Zero slow loading spinners — near-instant interactions"
      ]
    },
    design: {
      title: "Designed for Product & Creative Designers",
      desc: "Connect user stories and mockups directly to work items. Use infinite whiteboard canvases to wireframe flows and convert them into engineering tasks in a single click.",
      bullets: [
        "Infinite whiteboard canvases for brainstorming & flows",
        "ClickUp-style living PRD specifications and wikis",
        "Direct integration with Google Drive and OneDrive folders",
        "Visual feedback threads on task comments"
      ]
    },
    agency: {
      title: "Tailored for Agencies & Consultancies",
      desc: "Stop leaking billable hours across multiple third-party tools. Run distinct client workspaces with strict tenant isolation, record stopwatch hours, and export approved timesheets.",
      bullets: [
        "Independent workspace silos per client or engagement",
        "Live stopwatch timers + manual billable hour entry",
        "Weekly timesheet submission with manager approvals",
        "One-click branded PDF and CSV client invoices & exports"
      ]
    },
    ops: {
      title: "Engineered for Operations & People Leadership",
      desc: "Maintain organization-wide clarity with central holiday calendars, PTO/leave requests, workload balancing, and multi-organization directory management.",
      bullets: [
        "Company-wide holiday schedule and team availability",
        "Leave request submission, review, and approval logs",
        "Member directory with role-based access control (Owner, Admin, Member, Viewer)",
        "Secure one-time invitation links for employees & contractors"
      ]
    }
  };

  const current = personas[activePersona];

  return (
    <section className="hp-personas-section" style={{ padding: "60px 0 70px" }}>
      <div className="hp-section-header">
        <span className="hp-section-tag">Versatile By Design</span>
        <h2 className="hp-section-title">Designed for how your entire team works</h2>
        <p className="hp-section-desc">
          Whether you build software, deliver client work, or coordinate company operations, Orbitwork adapts to you.
        </p>
      </div>

      <div className="hp-personas-nav" style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        <button
          type="button"
          onClick={() => setActivePersona("eng")}
          className={`hp-tab-button ${activePersona === "eng" ? "active" : ""}`}
        >
          <Code size={16} />
          <span>Engineering</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePersona("design")}
          className={`hp-tab-button ${activePersona === "design" ? "active" : ""}`}
        >
          <Palette size={16} />
          <span>Product &amp; Design</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePersona("agency")}
          className={`hp-tab-button ${activePersona === "agency" ? "active" : ""}`}
        >
          <Briefcase size={16} />
          <span>Agencies &amp; Consultancies</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePersona("ops")}
          className={`hp-tab-button ${activePersona === "ops" ? "active" : ""}`}
        >
          <UsersRound size={16} />
          <span>Operations &amp; HR</span>
        </button>
      </div>

      <div className="hp-persona-card" style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "36px",
        maxWidth: 920,
        margin: "0 auto",
        boxShadow: "0 10px 30px rgba(0,0,0,0.05)"
      }}>
        <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", fontFamily: "Manrope, sans-serif" }}>
          {current.title}
        </h3>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--muted)", margin: "0 0 24px" }}>
          {current.desc}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {current.bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600 }}>
              <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0 }} />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeFaqAccordion() {
  const faqs = [
    {
      q: "What is Orbitwork and how does it compare to other project management tools?",
      a: "Orbitwork is a unified project management and work collaboration platform designed to replace fragmented tool stacks (like Jira + Toggl + Google Docs + Slack). It combines multi-tenant organizations and workspaces, Kanban boards, interactive task sheets, Gantt timelines, built-in time tracking, weekly timesheet approvals, ClickUp-style Markdown docs, real-time team chat, and cloud storage integrations."
    },
    {
      q: "Is Orbitwork free to start for small and growing teams?",
      a: "Yes. Orbitwork is designed to get your organization up and running quickly with workspaces, projects, task views, checklists, custom fields, and timesheets with zero artificial paywalls blocking collaboration."
    },
    {
      q: "How does multi-tenant organization and workspace security work?",
      a: "Orbitwork uses PostgreSQL Row Level Security (RLS) to enforce strict isolation across every organization, workspace, and project. Owners and admins manage roles (Owner, Admin, Member, Viewer) so internal teams, contractors, and clients only see the projects assigned to them."
    },
    {
      q: "Can we connect Google Drive, Microsoft OneDrive, or SharePoint?",
      a: "Yes. Each workspace can choose its own storage provider—Google Drive, Microsoft OneDrive, SharePoint, or Orbitwork's encrypted built-in database storage—using minimal OAuth 2.0 scopes and AES-256-GCM encryption for credentials at rest."
    },
    {
      q: "How do built-in time tracking, timesheets, and holidays work?",
      a: "Team members can start live stopwatch timers directly on tasks or log manual billable hours, then submit weekly timesheets for manager review and CSV/PDF export. Organizations can also manage PTO leave requests and auto-import country public holidays."
    },
    {
      q: "Can users customize project view tabs, table columns, and chat alerts?",
      a: "Yes. Every user can reorder project view tabs (List, Board, Calendar, Timeline, Workload, Whiteboard, Flowchart, Channel) and customize table column layouts independently without affecting teammates, while receiving real-time team chat messages, notifications, and email alerts."
    }
  ];

  return (
    <div className="hp-faq-list">
      {faqs.map((faq, i) => (
        <details className="hp-faq-item" key={i}>
          <summary>
            <span>{faq.q}</span>
            <ChevronDown size={18} color="var(--green)" />
          </summary>
          <p>{faq.a}</p>
        </details>
      ))}
    </div>
  );
}

export function HomeMobileNav({ isUserLoggedIn }: { isUserLoggedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="hp-mobile-nav-wrap">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hp-mobile-menu-btn"
        aria-label="Toggle navigation menu"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {isOpen && (
        <div className="hp-mobile-drawer">
          <nav className="hp-mobile-drawer-links" aria-label="Mobile Navigation">
            <Link href="/" onClick={() => setIsOpen(false)}>Home</Link>
            <Link href="/services" onClick={() => setIsOpen(false)}>Solutions</Link>
            <Link href="/services/project-management" onClick={() => setIsOpen(false)}>Project Management</Link>
            <Link href="/projects-case-studies" onClick={() => setIsOpen(false)}>Use Cases</Link>
            <Link href="/about" onClick={() => setIsOpen(false)}>About</Link>
            <Link href="/contact" onClick={() => setIsOpen(false)}>Contact</Link>
          </nav>
          <div className="hp-mobile-drawer-actions">
            {isUserLoggedIn ? (
              <Link href="/dashboard" className="hp-btn-primary" onClick={() => setIsOpen(false)}>
                Go to Dashboard <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hp-btn-secondary" onClick={() => setIsOpen(false)}>
                  Sign In
                </Link>
                <Link href="/signup" className="hp-btn-primary" onClick={() => setIsOpen(false)}>
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
