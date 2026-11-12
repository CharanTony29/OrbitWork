import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Layers3, ShieldCheck, Workflow } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "PLM Engineering & Teamcenter Consulting Services",
  description:
    "Comprehensive PLM engineering services: Teamcenter architecture, BMIDE configuration, Multi-CAD data management, eBOM/mBOM alignment, ECN/ECO workflows, and ERP integration.",
  path: "/services/plm-engineering",
  keywords: [
    "PLM Engineering",
    "Teamcenter Implementation",
    "BMIDE Configuration",
    "ECN ECO Workflow",
    "eBOM mBOM Management",
    "PDM Migration",
  ],
});

export default function PlmEngineeringPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="plm" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <Link href="/services">Services</Link>
              <span>/</span>
              <span>PLM Engineering</span>
            </nav>
            <h1 className="hp-subpage-title">
              PLM Engineering, BOM Governance &amp; Lifecycle Implementation
            </h1>
            <p className="hp-subpage-lead">
              We help engineering organizations architect resilient PLM systems,
              eliminate revision drift across CAD and manufacturing BOMs, and
              deliver clean, auditable change management from concept to
              production release.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/contact" className="hp-btn-primary">
                Request Architecture Review <ArrowRight size={16} />
              </Link>
              <Link href="/projects-case-studies" className="hp-btn-secondary">
                Explore Delivery Case Studies
              </Link>
            </div>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "52px 24px" }}>
          <div className="hp-section-header" style={{ marginBottom: 32 }}>
            <span className="hp-section-tag">Technical Capabilities</span>
            <h2 className="hp-section-title">
              Core pillars of our PLM engineering practice
            </h2>
          </div>

          <div className="hp-three-col-grid">
            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Layers3 size={22} />
              </div>
              <h3>Data Model &amp; BMIDE Architecture</h3>
              <p>
                Design clean item types, classification hierarchies, custom
                properties, revision schemes, and naming conventions built to
                scale cleanly over multi-decade product lifecycles.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <Workflow size={22} />
              </div>
              <h3>Closed-Loop ECR / ECN / ECO</h3>
              <p>
                Configure parallel Change Control Board (CCB) sign-offs,
                automated impact analysis routing, role-based access locks, and
                time-stamped compliance trails.
              </p>
            </article>

            <article className="hp-info-card">
              <div className="hp-feature-icon-wrap">
                <ShieldCheck size={22} />
              </div>
              <h3>Multi-CAD &amp; ERP Continuity</h3>
              <p>
                Synchronize mechanical and electrical assemblies (NX,
                SolidWorks, Creo, Altium) directly with plant-specific mBOMs and
                SAP/ERP material masters.
              </p>
            </article>
          </div>

          <div
            className="hp-info-card"
            style={{ marginTop: 28, padding: 30, gap: 16 }}
          >
            <h2 style={{ margin: 0, fontSize: 22 }}>
              Structured 4-Phase PLM Implementation Methodology
            </h2>
            <p style={{ maxWidth: 820 }}>
              Every deployment follows measurable checkpoints so engineering
              teams adopt workflows smoothly without stalling active NPI
              schedules:
            </p>
            <div className="hp-two-col-grid">
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  1. Discovery &amp; Process Blueprint
                </div>
                <p>
                  Audit existing CAD vaults, part numbering, change velocity,
                  and cross-plant BOM handoffs to establish target KPIs.
                </p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  2. Core Configuration &amp; Integration
                </div>
                <p>
                  Build data models, workflow templates, Active Workspace tiles,
                  and automated REST/SOA ERP connectors in staging.
                </p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  3. Trial Migration &amp; UAT Validation
                </div>
                <p>
                  Run repeatable ETL validation checks on historical assemblies,
                  permissions, and drawing watermarks with key leads.
                </p>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                  <CheckCircle2 size={16} color="var(--hp-green)" />
                  4. Cutover, Training &amp; Hypercare
                </div>
                <p>
                  Execute controlled production cutover backed by Orbitwork runbooks,
                  role training, and rapid post-launch engineering support.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              <Link href="/projects-case-studies" className="hp-btn-secondary">
                See Case Studies
              </Link>
              <Link href="/contact" className="hp-btn-primary">
                Talk to a PLM Architect <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Related Industries Supported</h3>
            <ul
              className="hp-feature-bullets"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 10,
              }}
            >
              <li>
                <Check size={15} /> Automotive &amp; EV Powertrain Engineering
              </li>
              <li>
                <Check size={15} /> Industrial Machinery &amp; Automation Systems
              </li>
              <li>
                <Check size={15} /> Aerospace, Defense &amp; Regulatory Traceability
              </li>
              <li>
                <Check size={15} /> Consumer Electronics &amp; Medical Devices
              </li>
            </ul>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
