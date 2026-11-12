import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Cpu, Factory, ShieldCheck, Workflow } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Projects & Case Studies | PLM Engineering Blueprints",
  description:
    "Explore Orbitwork engineering engagements and architecture blueprints across Teamcenter BOM alignment, ECN/ECO automation, multi-CAD vault migration, and NPI governance.",
  path: "/projects-case-studies",
});

const ENGAGEMENT_BLUEPRINTS = [
  {
    icon: Cpu,
    sector: "EV & Powertrain Systems",
    title: "Multi-Site eBOM to mBOM Alignment & Change Governance",
    challenge:
      "Electrical battery enclosures and mechanical chassis assemblies lived across disconnected regional vaults, causing delayed ECO handoffs to assembly plants.",
    architecture:
      "Designed unified BMIDE revision rules, automated ECN/ECO impact matrices, and connected engineering gate sign-offs with Orbitwork program schedules.",
    outcomes: [
      "Eliminated manual spreadsheet BOM reconciliations between R&D and manufacturing",
      "Unified mechanical + harness revision traceability under single release gates",
      "Real-time engineering task visibility across supplier and internal leads",
    ],
  },
  {
    icon: Workflow,
    sector: "Industrial Robotics & Automation",
    title: "Legacy PDM Consolidation to Modern Enterprise PLM",
    challenge:
      "Years of duplicated part numbers and unlinked CAD drawings slowed quoting cycles and increased procurement scrap across custom tooling lines.",
    architecture:
      "Executed scripted metadata normalization, duplicate-part deduplication, checksum-verified CAD vault migration, and Active Workspace role dashboards.",
    outcomes: [
      "Preserved 100% of historical revision lineage during staged weekend cutover",
      "Automated standard-part reuse rules across SolidWorks and NX teams",
      "Integrated design review SOPs and engineering time logs in Orbitwork",
    ],
  },
  {
    icon: Factory,
    sector: "Precision Manufacturing",
    title: "Bi-Directional PLM-to-ERP Release Automation",
    challenge:
      "Re-keying released BOM items and approved deviations into ERP introduced transcription errors and lengthened NPI production readiness.",
    architecture:
      "Implemented idempotent REST/SOA integration payloads triggered upon final ECO approval with dead-letter retry logging and discrepancy notifications.",
    outcomes: [
      "Zero manual BOM transcription after ECO sign-off",
      "Automatic plant-specific effectivity propagation to procurement teams",
      "Clear audit history for engineering change approvers and IT admins",
    ],
  },
  {
    icon: ShieldCheck,
    sector: "Regulated Hardware & Compliance",
    title: "Supplier Portal & Audit-Ready Technical Documentation",
    challenge:
      "Sharing drawings and engineering deviations with external contract manufacturers via email attachments created version sprawl and IP exposure.",
    architecture:
      "Configured isolated multi-tenant Orbitwork vendor workspaces backed by encrypted SharePoint/OneDrive routing and time-stamped document version history.",
    outcomes: [
      "Scoped external vendor access restricted solely to assigned programs",
      "Centralized Markdown DFM reviews, test evidence, and PDF exports",
      "Complete revision audit trail for ISO and regulatory reviews",
    ],
  },
];

export default function ProjectsCaseStudiesPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="projects" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Projects &amp; Case Studies</span>
            </nav>
            <h1 className="hp-subpage-title">
              PLM Engineering Projects &amp; Solution Case Studies
            </h1>
            <p className="hp-subpage-lead">
              Representative architectures and delivery blueprints showing how
              engineering organizations streamline BOM governance, PDM
              migrations, ERP synchronization, and NPI program tracking with
              Orbitwork.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/contact" className="hp-btn-primary">
                Discuss Your Program <ArrowRight size={16} />
              </Link>
              <Link href="/services/plm-engineering" className="hp-btn-secondary">
                View PLM Capabilities
              </Link>
            </div>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "52px 24px" }}>
          <div className="hp-two-col-grid">
            {ENGAGEMENT_BLUEPRINTS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="hp-info-card">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div className="hp-feature-icon-wrap" style={{ marginBottom: 0 }}>
                      <Icon size={22} />
                    </div>
                    <span className="hp-section-tag" style={{ marginBottom: 0 }}>
                      {item.sector}
                    </span>
                  </div>
                  <h2 style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 750 }}>
                    {item.title}
                  </h2>
                  <p>
                    <strong>Challenge:</strong> {item.challenge}
                  </p>
                  <p>
                    <strong>Architecture:</strong> {item.architecture}
                  </p>
                  <ul className="hp-feature-bullets" style={{ marginTop: 4 }}>
                    {item.outcomes.map((out) => (
                      <li key={out}>
                        <Check size={15} /> {out}
                      </li>
                    ))}
                  </ul>
                  <Link href="/contact" className="hp-inline-link">
                    Request similar solution walkthrough <ArrowRight size={14} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
