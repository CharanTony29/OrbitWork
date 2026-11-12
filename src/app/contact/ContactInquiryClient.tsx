"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

export default function ContactInquiryClient() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [focus, setFocus] = useState("Feedback & Suggestions");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedInfo, setSubmittedInfo] = useState<{
    name: string;
    email: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedName) {
      setErrorMsg("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address (for example: name@company.com).");
      return;
    }
    if (trimmedNotes.length < 2) {
      setErrorMsg("Please enter your message or feedback before sending.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          organization: company.trim(),
          email: trimmedEmail,
          topic: focus,
          message: trimmedNotes,
          website,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErrorMsg(
          data.error || "Could not send your message. Please try again."
        );
        return;
      }

      setSubmittedInfo({ name: trimmedName, email: trimmedEmail });
      setNotes("");
    } catch {
      setErrorMsg("Network error while sending. Please check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedInfo) {
    return (
      <div
        className="hp-info-card"
        style={{
          gap: 14,
          borderColor: "rgba(22, 124, 88, 0.45)",
          background: "var(--hp-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--hp-green)" }}>
          <CheckCircle2 size={24} />
          <h2 style={{ margin: 0, fontSize: 20 }}>Message Received!</h2>
        </div>
        <p style={{ color: "var(--hp-ink)" }}>
          Thank you, <strong>{submittedInfo.name}</strong>. Your feedback has
          been sent directly to the Orbitwork team without needing an account.
          If a response is requested, we will reply to{" "}
          <strong>{submittedInfo.email}</strong>.
        </p>
        <div>
          <button
            type="button"
            className="hp-btn-secondary"
            onClick={() => setSubmittedInfo(null)}
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="hp-info-card" style={{ gap: 14 }} onSubmit={handleSubmit} noValidate>
      <h2 style={{ margin: 0, fontSize: 20 }}>Send Us Feedback or a Message</h2>
      <p>
        No sign-in required. Submit your feedback, product question, or demo
        request below and it goes straight to our team.
      </p>

      {/* Honeypot hidden field */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
        aria-hidden="true"
      />

      {errorMsg && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(220, 38, 38, 0.35)",
            background: "rgba(220, 38, 38, 0.08)",
            color: "#ef4444",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 600 }}>
          Your Name *
          <input
            type="text"
            required
            placeholder="e.g. Charan"
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
          Organization / Team Name (Optional)
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
          Your Email Address *
          <input
            type="email"
            required
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
            <option value="Feedback & Suggestions">
              Feedback &amp; Suggestions
            </option>
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
          Feedback / Message *
          <textarea
            rows={4}
            required
            placeholder="Share your feedback, feature request, or question..."
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
        <button
          type="submit"
          className="hp-btn-primary"
          disabled={submitting}
          style={{ border: 0, cursor: submitting ? "wait" : "pointer" }}
        >
          <Send size={15} />
          <span>{submitting ? "Sending Message..." : "Send Message"}</span>
        </button>
      </div>
    </form>
  );
}
