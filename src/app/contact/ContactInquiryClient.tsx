"use client";

import React, { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";

export default function ContactInquiryClient() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [focus, setFocus] = useState("Team Onboarding & Workspaces");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const composedBody = [
    `Name: ${name || "(Not provided)"}`,
    `Organization: ${company || "(Not provided)"}`,
    `Work Email: ${email || "(Not provided)"}`,
    `Topic: ${focus}`,
    "",
    "Project Details & Team Needs:",
    notes || "(Share your team size, workspace goals, or questions about Orbitwork.)",
  ].join("\n");

  const mailtoHref = `mailto:orbitwork.admin@gmail.com?subject=${encodeURIComponent(
    `[Orbitwork Inquiry] ${focus}${company ? ` — ${company}` : ""}`
  )}&body=${encodeURIComponent(composedBody)}`;

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(
        `To: orbitwork.admin@gmail.com\n\n${composedBody}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="hp-info-card" style={{ gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Send Us a Message</h2>
      <p>
        Prepare your inquiry below to open it in your email client or copy it
        directly to send to our team.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Your Name
          <input
            type="text"
            placeholder="e.g. Priya Nair"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--hp-line)",
              background: "var(--hp-bg)",
              color: "var(--hp-ink)",
              fontSize: 13.5,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Organization / Team Name
          <input
            type="text"
            placeholder="e.g. Northstar Operations"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--hp-line)",
              background: "var(--hp-bg)",
              color: "var(--hp-ink)",
              fontSize: 13.5,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Work Email
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--hp-line)",
              background: "var(--hp-bg)",
              color: "var(--hp-ink)",
              fontSize: 13.5,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Topic
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--hp-line)",
              background: "var(--hp-bg)",
              color: "var(--hp-ink)",
              fontSize: 13.5,
            }}
          >
            <option value="Team Onboarding & Workspaces">
              Team Onboarding &amp; Workspaces
            </option>
            <option value="Project Views, Tasks & Timesheets">
              Project Views, Tasks &amp; Timesheets
            </option>
            <option value="Cloud Storage Integrations (Drive / OneDrive / SharePoint)">
              Cloud Storage Integrations (Drive / OneDrive / SharePoint)
            </option>
            <option value="Account Support & Security">
              Account Support &amp; Security
            </option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Message &amp; Requirements
          <textarea
            rows={4}
            placeholder="Tell us about your team size, project workflow requirements, or questions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--hp-line)",
              background: "var(--hp-bg)",
              color: "var(--hp-ink)",
              fontSize: 13.5,
              resize: "vertical",
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
        <a href={mailtoHref} className="hp-btn-primary">
          <Mail size={15} /> Open in Email Client
        </a>
        <button
          type="button"
          onClick={() => void handleCopyBrief()}
          className="hp-btn-secondary"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          <span>{copied ? "Copied!" : "Copy Message"}</span>
        </button>
      </div>
    </div>
  );
}
