import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Check, Compass, ShieldCheck, Users } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "About Orbitwork | PLM Engineering & Work Management Team",
  description:
    "Learn how Orbitwork helps manufacturing and engineering organizations align PLM implementation, BOM & change governance, and cross-functional project execution.",
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
              Built for engineering precision from BOM architecture to sprint delivery
            </h1>
            <p className="hp-subpage-lead">
              Orbitwork bridges enterprise Product Lifecycle Management (PLM)
              engineering consulting with a calm, multi-tenant project management
              workspace designed specifically for hardware, software, and
              manufacturing teams.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/services/plm-engineering" className="hp-btn-primary">
                Explore PLM Engineering <ArrowRight size={16} />
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
                Modern engineering teams frequently run heavy PDM/PLM vaults for
                CAD revisions while coordinating releases, vendor sign-offs, and
                engineering hours across disconnected spreadsheets and chat
                threads. We built Orbitwork to give engineering organizations
                both rigorous lifecycle consulting and a unified execution OS.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h3>Enterprise Security &amp; Data Sovereignty</h3>
              <p>
                Every workspace runs with PostgreSQL Row Level Security (RLS),
                AES-256-GCM encrypted OAuth storage integrations (Google Drive,
                Microsoft OneDrive, and SharePoint), and clear Organization,
                Workspace, and Project boundaries suitable for Tier-1 suppliers.
              </p>
            </article>
          </div>

          <div className="hp-metric-strip">
            <div className="hp-metric-box">
              <strong>eBOM -&gt; mBOM</strong>
              <span>End-to-end engineering bill alignment &amp; change control</span>
            </div>
            <div className="hp-metric-box">
              <strong>Multi-CAD</strong>
              <span>Siemens NX, SolidWorks, PTC Creo &amp; AutoCAD workflows</span>
            </div>
            <div className="hp-metric-box">
              <strong>AES-256-GCM</strong>
              <span>Encrypted cloud drive &amp; enterprise token protection</span>
            </div>
            <div className="hp-metric-box">
              <strong>5 Task Views</strong>
              <span>Board, Sheet, Gantt, Calendar &amp; Flowchart synchronized</span>
            </div>
          </div>

          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Users size={24} />
              </div>
              <h3>How We Partner With Teams</h3>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Discovery workshops &amp; current-state PDM audit
                </li>
                <li>
                  <Check size={15} /> Target Teamcenter / PLM data model architecture
                </li>
                <li>
                  <Check size={15} /> Phased migration, UAT, and engineer training
                </li>
                <li>
                  <Check size={15} /> Long-term managed administration &amp; enhancement
                </li>
              </ul>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Building2 size={24} />
              </div>
              <h3>Explore Further</h3>
              <p>
                Review our core capabilities, inspect delivery case studies, or
                start an Orbitwork workspace at no cost.
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <Link href="/services" className="hp-inline-link">
                  View All Services <ArrowRight size={14} />
                </Link>
                <Link href="/services/plm-engineering" className="hp-inline-link">
                  PLM Engineering Practice <ArrowRight size={14} />
                </Link>
                <Link href="/projects-case-studies" className="hp-inline-link">
                  Projects &amp; Case Studies <ArrowRight size={14} />
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
