import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Layers, Kanban, Clock, Shield, Terminal, LifeBuoy } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
import { DOC_CATEGORIES } from "./docsData";
import "./docs.css";

export const metadata: Metadata = {
  title: "Documentation | OrbitWork",
  description: "Learn how to use OrbitWork to manage projects, track time, automate workflows, and collaborate with your team.",
};

export default function DocsHomePage() {
  return (
    <div className="docs-shell">
      <header className="docs-header">
        <div className="docs-header-left">
          <Link href="/" className="brand" aria-label="OrbitWork Home" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800, color: "var(--ink)" }}>
            <BrandMark size={26} />
            <span>Orbit<span style={{ color: "var(--green)" }}>Work</span></span>
          </Link>
          <span className="docs-badge">Docs</span>
        </div>
        <div className="docs-header-right">
          <Link href="/getting-started" className="docs-nav-link">Quickstart</Link>
          <a href="https://support.orbitwork.org" className="docs-nav-link">Support</a>
          <a href="https://status.orbitwork.org" className="docs-nav-link">Status</a>
          <a href="https://app.orbitwork.org" className="docs-btn-app">Open App</a>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div className="docs-search-box">
            <BookOpen size={15} />
            <input type="text" placeholder="Search documentation..." readOnly />
          </div>
          {DOC_CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <div className="docs-nav-group-title">{cat.title}</div>
              <ul className="docs-nav-list">
                {cat.items.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/${item.slug}`} className="docs-nav-item">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <main className="docs-content">
          <div className="docs-eyebrow">OrbitWork Knowledge Base</div>
          <h1 className="docs-title">OrbitWork Documentation</h1>
          <p className="docs-lead">
            Welcome to the official OrbitWork documentation. Explore guides, tutorials, and API references
            to help your team get the most out of OrbitWork.
          </p>

          <div className="docs-quickstart-grid">
            <Link href="/getting-started" className="docs-quickstart-card">
              <Layers size={22} style={{ color: "var(--green)" }} />
              <h4>Quickstart Guide</h4>
              <p>Set up your organization, create your first workspace, and invite teammates.</p>
            </Link>
            <Link href="/kanban-boards" className="docs-quickstart-card">
              <Kanban size={22} style={{ color: "var(--green)" }} />
              <h4>Kanban &amp; Tasks</h4>
              <p>Master drag-and-drop boards, custom workflows, and detailed task drawers.</p>
            </Link>
            <Link href="/time-tracking" className="docs-quickstart-card">
              <Clock size={22} style={{ color: "var(--green)" }} />
              <h4>Time Tracking</h4>
              <p>Capture billable hours, record live task timers, and export timesheets.</p>
            </Link>
            <Link href="/api-overview" className="docs-quickstart-card">
              <Terminal size={22} style={{ color: "var(--green)" }} />
              <h4>REST API</h4>
              <p>Integrate with OrbitWork programmatically using our high-speed REST API.</p>
            </Link>
          </div>

          <div className="docs-section">
            <h2>Core Platform Concepts</h2>
            <p>
              OrbitWork is designed around a scalable multi-tenant model. Everything belongs to an
              Organization, which contains Workspaces, which in turn contain Projects and Tasks.
            </p>
            <div className="docs-callout">
              <strong>Need immediate technical support?</strong> You can visit our{" "}
              <a href="https://support.orbitwork.org" style={{ color: "var(--green)", fontWeight: 650 }}>Help Center</a> or check live{" "}
              <a href="https://status.orbitwork.org" style={{ color: "var(--green)", fontWeight: 650 }}>System Status</a> anytime.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
