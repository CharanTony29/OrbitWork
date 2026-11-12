import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Check, Compass, ShieldCheck, Users } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "About Orbitwork | Project Management & Work Collaboration Platform",
  description:
    "Learn how Orbitwork brings tasks, Kanban boards, Gantt charts, docs, team chat, timesheets, and cloud storage together for focused project teams.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="about" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>About Orbitwork</span>
            </nav>
            <h1 className="hp-subpage-title">
              A calmer, unified workspace built for high-clarity project teams
            </h1>
            <p className="hp-subpage-lead">
              Orbitwork replaces scattered task trackers, separate time-logging
              tools, isolated chat apps, and disconnected document drives with
              one structured, multi-tenant project management platform.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/services/project-management" className="hp-btn-primary">
                Explore Project Management <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="hp-btn-secondary">
                Contact Our Team
              </Link>
            </div>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "48px 24px" }}>
          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Compass size={24} />
              </div>
              <h3>Why We Built Orbitwork</h3>
              <p>
                Modern teams waste hours switching between task boards,
                timesheets, shared drives, wikis, and messaging channels.
                Orbitwork unifies every stage of project delivery under clean
                Organizations, Workspaces, and Projects so teams stay focused on
                shipping meaningful work.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h3>Enterprise Security &amp; Data Isolation</h3>
              <p>
                Every tenant workspace uses PostgreSQL Row Level Security (RLS),
                AES-256-GCM encrypted OAuth tokens for Google Drive, Microsoft
                OneDrive, and SharePoint, and role-based permissions across
                Owners, Admins, Members, and Viewers.
              </p>
            </article>
          </div>

          <div className="hp-metric-strip">
            <div className="hp-metric-box">
              <strong>8 Views</strong>
              <span>List, Board, Calendar, Gantt, Workload, Whiteboard, Flowchart &amp; Channel</span>
            </div>
            <div className="hp-metric-box">
              <strong>Real-Time</strong>
              <span>Direct DMs, group chats, live read receipts &amp; instant notifications</span>
            </div>
            <div className="hp-metric-box">
              <strong>AES-256-GCM</strong>
              <span>Encrypted cloud drive tokens &amp; multi-tenant RLS isolation</span>
            </div>
            <div className="hp-metric-box">
              <strong>Built-in Time</strong>
              <span>Live task stopwatches, weekly timesheets &amp; country holidays</span>
            </div>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Users size={24} />
              </div>
              <h3>Designed for Real Team Collaboration</h3>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Per-user customizable project tabs and sheet columns
                </li>
                <li>
                  <Check size={15} /> Subtasks, progress tracking, checklists &amp; dependencies
                </li>
                <li>
                  <Check size={15} /> Resizable inline images &amp; versioned Markdown docs
                </li>
                <li>
                  <Check size={15} /> Fast password-less sign-in &amp; Google OAuth
                </li>
              </ul>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Building2 size={24} />
              </div>
              <h3>Explore Further</h3>
              <p>
                Review Orbitwork&apos;s full feature suite, explore team use cases,
                or launch a free workspace in seconds.
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <Link href="/services" className="hp-inline-link">
                  View Platform Solutions <ArrowRight size={14} />
                </Link>
                <Link href="/services/project-management" className="hp-inline-link">
                  Project Management Deep Dive <ArrowRight size={14} />
                </Link>
                <Link href="/projects-case-studies" className="hp-inline-link">
                  Use Cases &amp; Case Studies <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
