"use client";

import React, { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";

export default function ContactInquiryClient() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [focus, setFocus] = useState("Teamcenter & PLM Implementation");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const composedBody = [
    `Name: ${name || "(Not provided)"}`,
    `Organization: ${company || "(Not provided)"}`,
    `Work Email: ${email || "(Not provided)"}`,
    `Focus Area: ${focus}`,
    "",
    "Project Scope & Timeline:",
    notes || "(Please share a brief overview of your CAD/PLM tools, team size, and goals.)",
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
      <h2 style={{ margin: 0, fontSize: 20 }}>Prepare a Project Brief</h2>
      <p>
        Fill in your technical focus area below to launch a pre-formatted email
        or copy the brief directly.
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
          Company / Engineering Team
          <input
            type="text"
            placeholder="e.g. Apex Powertrain Systems"
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
          Service Area
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
            <option value="Teamcenter & PLM Implementation">
              Teamcenter &amp; PLM Implementation
            </option>
            <option value="CAD, eBOM/mBOM & ECO Governance">
              CAD, eBOM/mBOM &amp; ECO Governance
            </option>
            <option value="PDM Data Migration & ERP Integration">
              PDM Data Migration &amp; ERP Integration
            </option>
            <option value="Orbitwork Workspaces & Enterprise Onboarding">
              Orbitwork Workspaces &amp; Enterprise Onboarding
            </option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Scope &amp; Goals
          <textarea
            rows={4}
            placeholder="Share your CAD tools, PLM environment, target go-live window, or workspace requirements..."
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
          <span>{copied ? "Brief Copied!" : "Copy Brief"}</span>
        </button>
      </div>
    </div>
  );
}
