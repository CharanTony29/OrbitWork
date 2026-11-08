import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="app-shell" style={{ padding: "40px 20px", maxWidth: 800, margin: "0 auto", lineHeight: 1.7 }}>
      <Link href="/dashboard" style={{ color: "#167c58", fontWeight: 700, textDecoration: "none", display: "inline-block", marginBottom: 20 }}>
        &larr; Back to Orbitwork
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Privacy Policy</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>Last updated: November 2026</p>

      <section style={{ display: "grid", gap: 18, fontSize: 14, color: "var(--ink)" }}>
        <p>
          Orbitwork respects your privacy. This policy outlines how we handle your data, including our storage integrations: <strong>Local Storage (Built-in)</strong>, <strong>Google Drive</strong>, <strong>Microsoft OneDrive</strong>, and <strong>Microsoft SharePoint</strong>.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>1. Storage Providers &amp; Scopes</h2>
        <p>
          Orbitwork allows each workspace to choose its preferred storage provider:
        </p>
        <ul style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
          <li>
            <strong>Local Storage (Built-in):</strong> Files and attachments are stored directly in encrypted database storage isolated to your workspace. No third-party accounts or cloud APIs are accessed.
          </li>
          <li>
            <strong>Google Drive:</strong> We request access using the <code>drive.file</code> scope. This grants Orbitwork permission to create, upload, and manage <em>only the files created by or opened with Orbitwork</em> in a dedicated workspace folder. We never inspect, read, or modify your personal files outside Orbitwork.
          </li>
          <li>
            <strong>Microsoft OneDrive:</strong> We request scoped file access (<code>Files.ReadWrite</code>) to save and organize attachments into your dedicated <code>OneDrive / Orbitwork / [Workspace]</code> directory.
          </li>
          <li>
            <strong>Microsoft SharePoint:</strong> When connected, files and documents are stored in your team&apos;s specified SharePoint Document Library.
          </li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>2. Storage &amp; Workspace Isolation</h2>
        <p>
          Each workspace manages its own dedicated storage location. Files uploaded within a workspace are accessible only to authorized members of that workspace and organization, preventing accidental data sharing across teams.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>3. Data Security &amp; Revocation</h2>
        <p>
          Third-party OAuth tokens and secrets are encrypted at rest using AES-256-GCM. You may disconnect your Google Drive, OneDrive, or SharePoint connections at any time from Workspace Settings or directly through your third-party account security center.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>4. Contact</h2>
        <p>
          For privacy inquiries, contact the team at <code>orbitwork.admin@gmail.com</code>.
        </p>
      </section>
    </main>
  );
}
