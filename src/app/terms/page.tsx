import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicMetadata({
  title: "Terms of Service",
  description:
    "Orbitwork Terms of Service covering collaborative project management workspaces, cloud storage integrations, and tenant security responsibilities.",
  path: "/terms",
});

export default function TermsOfServicePage() {
  return (
    <main className="app-shell" style={{ padding: "40px 20px", maxWidth: 800, margin: "0 auto", lineHeight: 1.7 }}>
      <Link href="/dashboard" style={{ color: "#167c58", fontWeight: 700, textDecoration: "none", display: "inline-block", marginBottom: 20 }}>
        &larr; Back to Orbitwork
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Terms of Service</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>Last updated: November 2026</p>

      <section style={{ display: "grid", gap: 18, fontSize: 14, color: "var(--ink)" }}>
        <p>
          Welcome to Orbitwork. By using our services, you agree to these terms.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>1. Use of Services</h2>
        <p>
          Orbitwork provides collaborative work management, project tracking, and storage integrations for teams and organizations. You agree to use the service in compliance with all applicable laws.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>2. Storage Providers &amp; Integrations</h2>
        <p>
          Orbitwork supports Local Storage (Built-in), Google Drive, Microsoft OneDrive, and Microsoft SharePoint. When you connect third-party services such as Google Drive, OneDrive, or SharePoint, you agree to comply with the respective provider&apos;s Terms of Service and API policies. Orbitwork is not responsible for third-party provider availability, quotas, or service disruptions.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>3. Workspace Ownership &amp; Storage Management</h2>
        <p>
          Workspace Owners and Managers are responsible for maintaining access permissions and managing connected storage providers for their workspaces.
        </p>
      </section>
    </main>
  );
}
