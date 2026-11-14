import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle, Mail, MessageSquare, Search, ShieldCheck, UserCheck, HardDrive, Clock, ExternalLink } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
import "./support.css";

export const metadata: Metadata = {
  title: "Support & Help Center | OrbitWork",
  description: "Find answers, explore troubleshooting guides, and get in touch with the OrbitWork customer support team.",
};

const SUPPORT_CATEGORIES = [
  {
    icon: UserCheck,
    title: "Account & Authentication",
    description: "Manage login credentials, password resets, Google OAuth, and profile settings.",
    slug: "account-and-login",
  },
  {
    icon: ShieldCheck,
    title: "Workspaces & Permissions",
    description: "Configure organization roles, workspace privacy, member invites, and team access.",
    slug: "workspaces-and-roles",
  },
  {
    icon: HardDrive,
    title: "Cloud Storage Integration",
    description: "Set up and troubleshoot Google Drive, OneDrive, and SharePoint attachments.",
    slug: "cloud-storage-setup",
  },
  {
    icon: Clock,
    title: "Time Tracking & Approvals",
    description: "Learn how to record task timers, billable hours, and submit weekly timesheets.",
    slug: "timesheet-approvals",
  },
  {
    icon: MessageSquare,
    title: "Chat & Collaboration",
    description: "Set up real-time project channels, 1:1 direct messages, and notification preferences.",
    slug: "chat-and-notifications",
  },
  {
    icon: HelpCircle,
    title: "Billing & Subscriptions",
    description: "Inquiries regarding plans, workspace quotas, invoice receipts, and renewals.",
    slug: "billing-and-plans",
  },
];

export default function SupportPage() {
  return (
    <div className="support-shell">
      <header className="support-header">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Link href="/" className="brand" aria-label="OrbitWork Home" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800, color: "var(--ink)" }}>
            <BrandMark size={26} />
            <span>Orbit<span style={{ color: "var(--green)" }}>Work</span></span>
          </Link>
          <span className="support-badge">Help Center</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="https://docs.orbitwork.org" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>Docs</a>
          <a href="https://status.orbitwork.org" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>System Status</a>
          <a href="https://app.orbitwork.org" style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 8, background: "var(--green)", color: "#fff", fontSize: "12.5px", fontWeight: 650, textDecoration: "none" }}>Open App</a>
        </div>
      </header>

      <section className="support-hero">
        <div className="support-hero-content">
          <h1>How can we help you today?</h1>
          <p>Search our knowledge base or browse help topics below to troubleshoot questions.</p>
          <div className="support-search">
            <Search size={18} style={{ color: "var(--muted)" }} />
            <input type="text" placeholder="Search topics, e.g. 'invite members', 'Google Drive', 'timesheets'..." readOnly />
          </div>
        </div>
      </section>

      <main className="support-container">
        <div className="support-grid">
          {SUPPORT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link key={cat.slug} href={`/${cat.slug}`} className="support-card">
                <div className="support-card-icon">
                  <Icon size={20} />
                </div>
                <h3>{cat.title}</h3>
                <p>{cat.description}</p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "12.5px", fontWeight: 700, color: "var(--green)", marginTop: "auto" }}>
                  Learn more <ArrowRight size={13} />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="support-contact-banner">
          <div className="support-contact-copy">
            <h3>Still need help?</h3>
            <p>Our dedicated support team is available to assist you with any workspace questions.</p>
          </div>
          <a href="mailto:orbitwork.admin@gmail.com" className="support-contact-btn">
            <Mail size={16} /> Contact Support
          </a>
        </div>
      </main>
    </div>
  );
}
