import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeMobileNav } from "./HomeInteractiveTabs";

export type PublicNavKey =
  | "home"
  | "services"
  | "pm"
  | "projects"
  | "about"
  | "contact";

export function PublicSiteHeader({
  active = "home",
  userEmail = null,
}: {
  active?: PublicNavKey;
  userEmail?: string | null;
}) {
  const isLoggedIn = Boolean(userEmail);

  return (
    <header className="hp-nav">
      <div className="hp-container hp-nav-inner">
        <Link className="brand" href="/" aria-label="Orbitwork home">
          <span className="brand-mark">O</span>Orbit<span>work</span>
        </Link>

        <nav className="hp-nav-links" aria-label="Main Navigation">
          <Link
            href="/"
            className={`hp-nav-link ${active === "home" ? "is-active" : ""}`}
          >
            Home
          </Link>
          <Link
            href="/services"
            className={`hp-nav-link ${active === "services" ? "is-active" : ""}`}
          >
            Solutions
          </Link>
          <Link
            href="/services/project-management"
            className={`hp-nav-link ${active === "pm" ? "is-active" : ""}`}
          >
            Project Management
          </Link>
          <Link
            href="/projects-case-studies"
            className={`hp-nav-link ${active === "projects" ? "is-active" : ""}`}
          >
            Use Cases
          </Link>
          <Link
            href="/about"
            className={`hp-nav-link ${active === "about" ? "is-active" : ""}`}
          >
            About
          </Link>
          <Link
            href="/contact"
            className={`hp-nav-link ${active === "contact" ? "is-active" : ""}`}
          >
            Contact
          </Link>
        </nav>

        <div className="hp-nav-actions">
          {isLoggedIn ? (
            <>
              <span className="hp-user-badge" title={userEmail ?? ""}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--hp-green)",
                  }}
                />
                {userEmail?.split("@")[0]}
              </span>
              <Link href="/dashboard" className="hp-btn-primary">
                Dashboard <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hp-btn-text">
                Sign In
              </Link>
              <Link href="/signup" className="hp-btn-primary">
                Get Started Free
              </Link>
            </>
          )}
          <HomeMobileNav isUserLoggedIn={isLoggedIn} />
        </div>
      </div>
    </header>
  );
}

export function PublicSiteFooter() {
  return (
    <footer className="hp-footer">
      <div className="hp-container">
        <div className="hp-footer-top">
          <div className="hp-footer-brand">
            <Link className="brand" href="/" aria-label="Orbitwork home">
              <span className="brand-mark">O</span>Orbit<span>work</span>
            </Link>
            <p>
              The modern, multi-tenant project management and work collaboration
              platform uniting tasks, boards, Gantt timelines, docs, team chat,
              timesheets, and cloud storage.
            </p>
          </div>

          <div className="hp-footer-col">
            <h5>Solutions &amp; Company</h5>
            <ul>
              <li>
                <Link href="/services">Platform Solutions</Link>
              </li>
              <li>
                <Link href="/services/project-management">Project Management</Link>
              </li>
              <li>
                <Link href="/projects-case-studies">Use Cases &amp; Case Studies</Link>
              </li>
              <li>
                <Link href="/about">About Orbitwork</Link>
              </li>
              <li>
                <Link href="/contact">Contact Us</Link>
              </li>
            </ul>
          </div>

          <div className="hp-footer-col">
            <h5>Platform Capabilities</h5>
            <ul>
              <li>
                <Link href="/#features">Task Views &amp; Custom Fields</Link>
              </li>
              <li>
                <Link href="/#views">Kanban, Sheet &amp; Gantt</Link>
              </li>
              <li>
                <Link href="/#timesheets">Time Tracking &amp; Timesheets</Link>
              </li>
              <li>
                <Link href="/#storage">Drive, OneDrive &amp; SharePoint</Link>
              </li>
              <li>
                <Link href="/signup">Create Free Workspace</Link>
              </li>
            </ul>
          </div>

          <div className="hp-footer-col">
            <h5>Account &amp; Compliance</h5>
            <ul>
              <li>
                <Link href="/login">Sign In</Link>
              </li>
              <li>
                <Link href="/dashboard">Workspace Overview</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms">Terms of Service</Link>
              </li>
              <li>
                <a href="mailto:orbitwork.admin@gmail.com">
                  orbitwork.admin@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="hp-footer-bottom">
          <div>&copy; {new Date().getFullYear()} Orbitwork. All rights reserved.</div>
          <div>Project Management, Time Tracking &amp; Team Collaboration</div>
        </div>
      </div>
    </footer>
  );
}
