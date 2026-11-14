import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock, Sparkles } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
import { BLOG_POSTS } from "./blogData";
import "./blog.css";

export const metadata: Metadata = {
  title: "Blog & Updates | OrbitWork",
  description: "Product updates, engineering deep dives, release notes, and industry insights from the OrbitWork team.",
};

export default function BlogHomePage() {
  return (
    <div className="blog-shell">
      <header className="blog-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/"
            aria-label="OrbitWork Home"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontWeight: 800,
              color: "var(--ink, #17231f)",
            }}
          >
            <BrandMark size={26} />
            <span>
              Orbit<span style={{ color: "var(--green, #167c58)" }}>Work</span>
            </span>
          </Link>
          <span className="blog-badge">Blog &amp; Updates</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="https://www.orbitwork.org"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted, #64748b)",
              textDecoration: "none",
            }}
          >
            Marketing Home
          </a>
          <a
            href="https://docs.orbitwork.org"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted, #64748b)",
              textDecoration: "none",
            }}
          >
            Docs
          </a>
          <a
            href="https://app.orbitwork.org"
            style={{
              padding: "7px 14px",
              background: "var(--green, #167c58)",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open App
          </a>
        </div>
      </header>

      <div className="blog-container">
        <div className="blog-hero">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--green, #167c58)",
              fontWeight: 750,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
            }}
          >
            <Sparkles size={14} /> Product News &amp; Engineering
          </div>
          <h1>OrbitWork Blog &amp; Release Notes</h1>
          <p>
            Stay up to date with new features, engineering insights, and platform
            announcements from the OrbitWork team.
          </p>
        </div>

        <div className="blog-grid">
          {BLOG_POSTS.map((post) => (
            <Link key={post.slug} href={`/${post.slug}`} className="blog-card">
              <div className="blog-card-cover">
                <div style={{ textAlign: "center", padding: "0 20px" }}>
                  <span
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      opacity: 0.9,
                      fontWeight: 700,
                    }}
                  >
                    {post.category}
                  </span>
                  <div
                    style={{
                      font: "700 16px/1.3 Manrope, sans-serif",
                      marginTop: 6,
                    }}
                  >
                    {post.title}
                  </div>
                </div>
              </div>

              <div className="blog-card-body">
                <div className="blog-meta-row">
                  <span className="blog-category-tag">{post.category}</span>
                  <span>•</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} /> {post.date}
                  </span>
                  <span>•</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} /> {post.readTime}
                  </span>
                </div>

                <h3>{post.title}</h3>
                <p>{post.description}</p>

                <div className="blog-read-more">
                  Read Article <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
