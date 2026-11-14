import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
import "../support.css";

type Props = {
  params: Promise<{ slug: string[] }>;
};

const TOPIC_DETAILS: Record<string, { title: string; content: string[] }> = {
  "account-and-login": {
    title: "Account, Authentication & Password Resets",
    content: [
      "To sign in to your workspace, head to https://app.orbitwork.org/login.",
      "If you signed up with Google OAuth, click 'Continue with Google' to authenticate directly.",
      "If you forgot your password, visit https://app.orbitwork.org/auth/reset-password to request a secure reset email.",
    ],
  },
  "workspaces-and-roles": {
    title: "Configuring Workspaces, Roles & Access",
    content: [
      "OrbitWork provides four primary roles: Owner, Admin, Member, and Guest.",
      "Owners and Admins can create new workspaces, configure storage providers, and invite teammates.",
      "Workspace privacy can be toggled to restrict access to specific invited members only.",
    ],
  },
  "cloud-storage-setup": {
    title: "Connecting Cloud Storage (Google Drive & OneDrive)",
    content: [
      "Navigate to your Workspace Settings > Storage Providers to configure integrations.",
      "Authorize your Google Drive or Microsoft OneDrive account securely.",
      "Team members can then attach cloud files directly into task attachments without file size limitations.",
    ],
  },
  "timesheet-approvals": {
    title: "Recording Time & Submitting Timesheets",
    content: [
      "Use the interactive timer in task cards or spreadsheet rows to log worked hours.",
      "At the end of your billing cycle, managers can review time logs in the Workspace Timesheets module.",
      "Export timesheet summaries to CSV for client billing or team payroll.",
    ],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const key = slug[slug.length - 1];
  const topic = TOPIC_DETAILS[key];
  return {
    title: `${topic?.title ?? "Support Topic"} | OrbitWork Help Center`,
  };
}

export default async function SupportTopicPage({ params }: Props) {
  const { slug } = await params;
  const key = slug[slug.length - 1];
  const topic = TOPIC_DETAILS[key] ?? {
    title: key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    content: [
      "Browse our help documentation or contact our support team for specialized guidance on this topic.",
      "For live assistance, you can email us at orbitwork.admin@gmail.com anytime.",
    ],
  };

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
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>All Topics</Link>
          <a href="https://app.orbitwork.org" style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 8, background: "var(--green)", color: "#fff", fontSize: "12.5px", fontWeight: 650, textDecoration: "none" }}>Open App</a>
        </div>
      </header>

      <main className="support-container" style={{ maxWidth: 760 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", textDecoration: "none", fontSize: "13px", fontWeight: 600, marginBottom: 20 }}>
          <ArrowLeft size={15} /> Back to Help Center
        </Link>
        <h1 style={{ font: "800 clamp(24px, 3.5vw, 32px)/1.25 Manrope, sans-serif", letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 24px" }}>
          {topic.title}
        </h1>

        <div style={{ display: "grid", gap: 16, marginBottom: 40 }}>
          {topic.content.map((paragraph, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px", background: "var(--surface-subtle, #f6faf7)", borderRadius: 10, border: "1px solid var(--line, #e2e8e0)" }}>
              <CheckCircle2 size={18} style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.6, color: "var(--ink)" }}>{paragraph}</p>
            </div>
          ))}
        </div>

        <div className="support-contact-banner">
          <div className="support-contact-copy">
            <h3>Need more help?</h3>
            <p>Our support team can assist you with specific questions.</p>
          </div>
          <a href="mailto:orbitwork.admin@gmail.com" className="support-contact-btn">
            <Mail size={16} /> Contact Support
          </a>
        </div>
      </main>
    </div>
  );
}
