import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, Mail, ShieldCheck } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";
import ContactInquiryClient from "./ContactInquiryClient";

export const metadata: Metadata = buildPublicMetadata({
  title: "Contact Orbitwork | PLM Engineering & Workspace Consultation",
  description:
    "Contact Orbitwork for PLM engineering consulting, Teamcenter architecture reviews, BOM/change workflow implementation, or enterprise workspace onboarding.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="hp-page">
      <PublicSiteHeader active="contact" />

      <main>
        <section className="hp-subpage-hero">
          <div className="hp-container">
            <nav className="hp-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Contact</span>
            </nav>
            <h1 className="hp-subpage-title">
              Connect with Orbitwork PLM Engineering &amp; Product Specialists
            </h1>
            <p className="hp-subpage-lead">
              Planning a Teamcenter upgrade, legacy PDM migration, ECO workflow
              standardization, or multi-tenant workspace rollout? Share your
              goals and we will respond within one business day.
            </p>
          </div>
        </section>

        <section className="hp-container" style={{ padding: "52px 24px" }}>
          <div className="hp-two-col-grid">
            <ContactInquiryClient />

            <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
              <article className="hp-info-card">
                <div className="hp-feature-icon-wrap">
                  <Mail size={22} />
                </div>
                <h3>Direct Engineering Desk</h3>
                <p>
                  Email us directly for consulting scopes, architectural reviews,
                  security questionnaires, or enterprise support:
                </p>
                <a
                  href="mailto:orbitwork.admin@gmail.com"
                  className="hp-inline-link"
                  style={{ fontSize: 15 }}
                >
                  orbitwork.admin@gmail.com
                </a>
              </article>

              <article className="hp-info-card">
                <div className="hp-feature-icon-wrap">
                  <Clock size={22} />
                </div>
                <h3>What Happens Next</h3>
                <ul className="hp-feature-bullets">
                  <li>
                    <Check size={15} /> Discovery session covering CAD, BOM, and ERP landscape
                  </li>
                  <li>
                    <Check size={15} /> Phased implementation &amp; risk mitigation roadmap
                  </li>
                  <li>
                    <Check size={15} /> Live walkthrough of Orbitwork workspaces &amp; portals
                  </li>
                </ul>
              </article>

              <article className="hp-info-card">
                <div className="hp-feature-icon-wrap">
                  <ShieldCheck size={22} />
                </div>
                <h3>Start Self-Serve Immediately</h3>
                <p>
                  Want to evaluate Orbitwork&apos;s Kanban, Gantt, Engineering
                  Docs, Timesheets, and Team Chat right now? Launch a free
                  organization workspace in under two minutes.
                </p>
                <Link href="/signup" className="hp-inline-link">
                  Create Free Workspace
                </Link>
              </article>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
