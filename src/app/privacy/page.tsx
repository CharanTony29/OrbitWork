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
          Orbitwork respects your privacy. This policy outlines how we handle your data, including Google Drive integrations.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>1. Information We Access</h2>
        <p>
          When you connect Google Drive to an Orbitwork workspace, we request access using the <code>drive.file</code> scope.
          This grants Orbitwork permission to create, upload, and manage <strong>only the files created by or opened with Orbitwork</strong>.
          We never inspect, read, or modify your personal files or files created outside Orbitwork.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>2. Storage &amp; Workspace Isolation</h2>
        <p>
          Each workspace manages its own dedicated storage location. Files uploaded within a workspace are stored directly in the connected Google Drive for that workspace and are accessible only to authorized members of that workspace.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>3. Data Security &amp; Revocation</h2>
        <p>
          Google OAuth refresh tokens are encrypted using AES-256-GCM. You may disconnect your Google Drive connection at any time from Workspace Settings or directly through your Google Account Security settings.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "10px 0 4px" }}>4. Contact</h2>
        <p>
          For privacy inquiries, contact the team at <code>orbitwork.admin@gmail.com</code>.
        </p>
      </section>
    </main>
  );
}
