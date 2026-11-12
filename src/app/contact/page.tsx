import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, Mail, ShieldCheck } from "lucide-react";
import { PublicSiteHeader, PublicSiteFooter } from "@/app/PublicSiteChrome";
import { buildPublicMetadata } from "@/lib/seo";
import ContactInquiryClient from "./ContactInquiryClient";

export const metadata: Metadata = buildPublicMetadata({
  title: "Contact Orbitwork | Project Management Support & Demos",
  description:
    "Get in touch with the Orbitwork team for workspace onboarding, product questions, cloud storage setup, or team demo requests.",
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
              Contact Orbitwork Support &amp; Workspace Specialists
            </h1>
            <p className="hp-subpage-lead">
              Have questions about rolling out Orbitwork across your
              organization, connecting Google Drive or OneDrive, or setting up
              workflows? Reach out anytime.
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
                <h3>Direct Email</h3>
                <p>
                  Reach our team directly for workspace assistance, onboarding
                  questions, security inquiries, or feedback:
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
                <h3>How We Help</h3>
                <ul className="hp-feature-bullets">
                  <li>
                    <Check size={15} /> Organization &amp; workspace role setup guidance
                  </li>
                  <li>
                    <Check size={15} /> Google Drive, OneDrive &amp; SharePoint storage configuration
                  </li>
                  <li>
                    <Check size={15} /> Live walkthroughs for project teams
                  </li>
                </ul>
              </article>

              <article className="hp-info-card">
                <div className="hp-feature-icon-wrap">
                  <ShieldCheck size={22} />
                </div>
                <h3>Start Self-Serve Immediately</h3>
                <p>
                  Ready to try Kanban boards, Gantt charts, time tracking, docs,
                  and team chat right away? Create your free workspace in under
                  two minutes.
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
