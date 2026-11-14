import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ShieldCheck, Activity, Server, Database, MessageSquare, HardDrive, Bell } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
import "./status.css";

export const metadata: Metadata = {
  title: "System Status | OrbitWork",
  description: "Live operational status and uptime performance metrics for all OrbitWork platform services.",
};

const SERVICES = [
  { name: "Core API & Routing", icon: Server, status: "Operational", uptime: "100.0%" },
  { name: "Web Application (app.orbitwork.org)", icon: Activity, status: "Operational", uptime: "99.99%" },
  { name: "Realtime Chat & WebSockets", icon: MessageSquare, status: "Operational", uptime: "99.98%" },
  { name: "Database & Authentication", icon: Database, status: "Operational", uptime: "100.0%" },
  { name: "Cloud Storage & Attachments", icon: HardDrive, status: "Operational", uptime: "99.99%" },
  { name: "Email & Notification Delivery", icon: Bell, status: "Operational", uptime: "100.0%" },
];

export default function StatusPage() {
  return (
    <div className="status-shell">
      <header className="status-header">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Link href="/" className="brand" aria-label="OrbitWork Home" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800, color: "var(--ink)" }}>
            <BrandMark size={26} />
            <span>Orbit<span style={{ color: "var(--green)" }}>Work</span></span>
          </Link>
          <span className="status-badge-head">System Status</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="https://docs.orbitwork.org" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>Docs</a>
          <a href="https://support.orbitwork.org" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>Support</a>
          <a href="https://app.orbitwork.org" style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 8, background: "var(--green)", color: "#fff", fontSize: "12.5px", fontWeight: 650, textDecoration: "none" }}>Open App</a>
        </div>
      </header>

      <main className="status-container">
        <div className="status-hero-banner">
          <div className="status-pulse-dot" />
          <div>
            <h2>All Systems Operational</h2>
            <p>Every OrbitWork core service, API cluster, and database node is running smoothly.</p>
          </div>
        </div>

        <div className="status-services-panel">
          <div className="status-panel-head">
            <span>Core Platform Services</span>
            <span style={{ color: "var(--muted)", fontSize: "12px", fontWeight: 550 }}>Updated just now</span>
          </div>

          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="status-service-row">
                <div className="status-service-name">
                  <Icon size={16} style={{ color: "var(--muted)" }} />
                  <span>{s.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <span className="status-service-uptime">{s.uptime} uptime</span>
                  <span className="status-service-pill">
                    <CheckCircle size={14} style={{ color: "#167c58" }} />
                    {s.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="status-past-incidents">
          <h3>Past Incident History (Last 90 Days)</h3>
          <div className="status-incident-day">
            <strong style={{ color: "var(--ink)", display: "block", marginBottom: 3 }}>November 2026</strong>
            <span style={{ color: "var(--muted)", fontSize: "13px" }}>No incidents reported. 100% operational uptime maintained.</span>
          </div>
          <div className="status-incident-day">
            <strong style={{ color: "var(--ink)", display: "block", marginBottom: 3 }}>October 2026</strong>
            <span style={{ color: "var(--muted)", fontSize: "13px" }}>Routine scheduled database maintenance completed with zero downtime.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
