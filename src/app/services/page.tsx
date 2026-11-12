import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Cog, Database, Kanban, Workflow } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Services | PLM Engineering, Integrations & Program Delivery",
  description:
    "Explore Orbitwork services across PLM engineering consulting, Teamcenter configuration, CAD/BOM change governance, legacy PDM migrations, and enterprise work management.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="services" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Services</span>
            </nav>
            <h1 className="hp-subpage-title">
              PLM Engineering &amp; Enterprise Work Management Services
            </h1>
            <p className="hp-subpage-lead">
              From configuring enterprise Teamcenter backbones and BOM change
              workflows to rolling out unified project execution workspaces,
              Orbitwork helps engineering teams ship reliable products faster.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/services/plm-engineering" className="hp-btn-primary">
                Deep Dive: PLM Engineering <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="hp-btn-secondary">
                Schedule Scoping Call
              </Link>
            </div>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "52px 24px" }}>
          <div className="hp-two-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Cog size={24} />
              </div>
              <h3>PLM Engineering &amp; Teamcenter Consulting</h3>
              <p>
                End-to-end PLM architecture, BMIDE data modeling, Active
                Workspace customization, security rule hardening, and global
                multi-site deployments.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> BMIDE schemas, LOVs &amp; naming rules
                </li>
                <li>
                  <Check size={15} /> Active Workspace UI &amp; role tailoring
                </li>
                <li>
                  <Check size={15} /> Multi-site replication &amp; upgrade planning
                </li>
              </ul>
              <Link href="/services/plm-engineering" className="hp-inline-link">
                Explore PLM Engineering <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Workflow size={24} />
              </div>
              <h3>CAD, BOM &amp; Change Management (ECR/ECN/ECO)</h3>
              <p>
                Standardize revision policies and eliminate downstream
                manufacturing scrap by connecting CAD structures with closed-loop
                change governance.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Multi-CAD integration (NX, SolidWorks, Creo)
                </li>
                <li>
                  <Check size={15} /> eBOM-to-mBOM reconciliation workflows
                </li>
                <li>
                  <Check size={15} /> Automated CCB review &amp; effectivity sign-off
                </li>
              </ul>
              <Link href="/projects-case-studies" className="hp-inline-link">
                See BOM &amp; ECO outcomes <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Database size={24} />
              </div>
              <h3>PDM Data Migration &amp; ERP Integration</h3>
              <p>
                Cleanse, map, and migrate legacy engineering vaults without
                losing revision lineage, and connect released BOMs into ERP and
                MES systems cleanly.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Pre-migration metadata cleansing &amp; dry runs
                </li>
                <li>
                  <Check size={15} /> SAP, NetSuite &amp; Oracle REST/SOA connectors
                </li>
                <li>
                  <Check size={15} /> Checksum audit verification reports
                </li>
              </ul>
              <Link href="/contact" className="hp-inline-link">
                Discuss migration assessment <ArrowRight size={14} />
              </Link>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Kanban size={24} />
              </div>
              <h3>Orbitwork Program Execution Platform</h3>
              <p>
                Equip program managers, suppliers, and engineering leads with
                Kanban boards, Gantt schedules, technical Markdown docs, team
                chat, and timesheet approvals.
              </p>
              <ul className="hp-feature-bullets">
                <li>
                  <Check size={15} /> Multi-tenant supplier &amp; vendor portals
                </li>
                <li>
                  <Check size={15} /> Drive, OneDrive &amp; SharePoint storage sync
                </li>
                <li>
                  <Check size={15} /> Weekly engineering timesheets &amp; CSV/PDF exports
                </li>
              </ul>
              <Link href="/signup" className="hp-inline-link">
                Launch free workspace <ArrowRight size={14} />
              </Link>
            </article>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
