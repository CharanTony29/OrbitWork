import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Sparkles } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
import { BLOG_POSTS } from "../blogData";
import "../blog.css";

type Props = {
  params: Promise<{ slug: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const postSlug = slug.join("/");
  const post =
    BLOG_POSTS.find((p) => p.slug === postSlug) ||
    BLOG_POSTS.find((p) => p.slug === slug[slug.length - 1]);

  if (!post) {
    return { title: "Article Not Found | OrbitWork Blog" };
  }

  return {
    title: `${post.title} | OrbitWork Blog`,
    description: post.description,
  };
}

export default async function BlogPostDetailPage({ params }: Props) {
  const { slug } = await params;
  const postSlug = slug.join("/");
  const post =
    BLOG_POSTS.find((p) => p.slug === postSlug) ||
    BLOG_POSTS.find((p) => p.slug === slug[slug.length - 1]);

  if (!post) {
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
            <span className="blog-badge">Blog</span>
          </div>
        </header>
        <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
          <h2 style={{ font: "800 28px Manrope, sans-serif" }}>Article Not Found</h2>
          <p style={{ color: "var(--muted, #64748b)", margin: "14px 0 24px" }}>
            The requested article could not be found or may have been archived.
          </p>
          <Link
            href="/"
            style={{
              color: "var(--green, #167c58)",
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ArrowLeft size={16} /> Back to all articles
          </Link>
        </main>
      </div>
    );
  }

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
          <span className="blog-badge">Blog</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted, #64748b)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ArrowLeft size={14} /> All Articles
          </Link>
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

      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 750,
              color: "var(--green, #167c58)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            <span>{post.category}</span>
            <span>•</span>
            <span style={{ color: "var(--muted, #64748b)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calendar size={12} /> {post.date}
            </span>
            <span>•</span>
            <span style={{ color: "var(--muted, #64748b)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> {post.readTime}
            </span>
          </div>

          <h1
            style={{
              font: "800 clamp(28px, 4vw, 38px)/1.2 Manrope, sans-serif",
              letterSpacing: "-0.025em",
              color: "var(--ink, #17231f)",
              margin: "0 0 16px",
            }}
          >
            {post.title}
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 0",
              borderTop: "1px solid var(--line, #e2e8e0)",
              borderBottom: "1px solid var(--line, #e2e8e0)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(22, 124, 88, 0.12)",
                color: "var(--green, #167c58)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 750,
                fontSize: 14,
              }}
            >
              OW
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink, #17231f)" }}>
                {post.author.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted, #64748b)" }}>
                {post.author.role}
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 16.5, lineHeight: 1.75, color: "var(--ink, #17231f)" }}>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              color: "var(--muted, #334155)",
              fontWeight: 500,
              marginBottom: 32,
            }}
          >
            {post.content.lead}
          </p>

          {post.content.sections.map((section, idx) => (
            <section key={idx} style={{ marginBottom: 32 }}>
              {section.heading && (
                <h2
                  style={{
                    font: "750 22px/1.3 Manrope, sans-serif",
                    color: "var(--ink, #17231f)",
                    margin: "28px 0 14px",
                  }}
                >
                  {section.heading}
                </h2>
              )}
              {section.body.map((p, pIdx) => (
                <p key={pIdx} style={{ margin: "0 0 16px", color: "var(--ink, #17231f)" }}>
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div
          style={{
            marginTop: 48,
            padding: 24,
            borderRadius: 12,
            background: "rgba(22, 124, 88, 0.05)",
            border: "1px solid rgba(22, 124, 88, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 750, fontSize: 15, color: "var(--ink, #17231f)" }}>
              Ready to experience modern project management?
            </div>
            <div style={{ fontSize: 13, color: "var(--muted, #64748b)", marginTop: 4 }}>
              Join thousands of teams shipping faster on OrbitWork.
            </div>
          </div>
          <a
            href="https://app.orbitwork.org"
            style={{
              padding: "10px 18px",
              background: "var(--green, #167c58)",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Get Started Free
          </a>
        </div>
      </article>
    </div>
  );
}
