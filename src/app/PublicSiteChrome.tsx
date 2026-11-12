import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeMobileNav } from "./HomeInteractiveTabs";

export type PublicNavKey =
  | "home"
  | "services"
  | "plm"
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
            Services
          </Link>
          <Link
            href="/services/plm-engineering"
            className={`hp-nav-link ${active === "plm" ? "is-active" : ""}`}
          >
            PLM Engineering
          </Link>
          <Link
            href="/projects-case-studies"
            className={`hp-nav-link ${active === "projects" ? "is-active" : ""}`}
          >
            Projects &amp; Case Studies
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
              PLM engineering consulting, CAD &amp; BOM change governance, and a
              unified product lifecycle &amp; project management platform built
              for modern engineering organizations.
            </p>
          </div>

          <div className="hp-footer-col">
            <h5>Engineering &amp; Services</h5>
            <ul>
              <li>
                <Link href="/services">All Services</Link>
              </li>
              <li>
                <Link href="/services/plm-engineering">PLM Engineering</Link>
              </li>
              <li>
                <Link href="/projects-case-studies">Projects &amp; Case Studies</Link>
              </li>
              <li>
                <Link href="/about">About Orbitwork</Link>
              </li>
              <li>
                <Link href="/contact">Contact Engineering Team</Link>
              </li>
            </ul>
          </div>

          <div className="hp-footer-col">
            <h5>Platform &amp; Workspaces</h5>
            <ul>
              <li>
                <Link href="/#features">Platform Capabilities</Link>
              </li>
              <li>
                <Link href="/#views">Kanban, Sheet &amp; Gantt</Link>
              </li>
              <li>
                <Link href="/#timesheets">Engineering Timesheets</Link>
              </li>
              <li>
                <Link href="/#storage">Drive, OneDrive &amp; SharePoint</Link>
              </li>
              <li>
                <Link href="/signup">Start Free Workspace</Link>
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
          <div>PLM Engineering &amp; Collaborative Product Lifecycle Platform</div>
        </div>
      </div>
    </footer>
  );
}
