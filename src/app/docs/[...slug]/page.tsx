import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
import { DOC_CATEGORIES, DOC_ARTICLES } from "../docsData";
import "../docs.css";

type Props = {
  params: Promise<{ slug: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const key = slug.join("/");
  const article = DOC_ARTICLES[key] || DOC_ARTICLES[slug[slug.length - 1]];
  if (!article) {
    return { title: "Documentation | OrbitWork" };
  }
  return {
    title: `${article.title} | OrbitWork Docs`,
    description: article.description,
  };
}

export default async function DocArticlePage({ params }: Props) {
  const { slug } = await params;
  const key = slug.join("/");
  const article = DOC_ARTICLES[key] || DOC_ARTICLES[slug[slug.length - 1]];

  if (!article) {
    return (
      <div className="docs-shell">
        <header className="docs-header">
          <div className="docs-header-left">
            <Link href="/" className="brand" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800, color: "var(--ink)" }}>
              <BrandMark size={26} />
              <span>Orbit<span style={{ color: "var(--green)" }}>Work</span></span>
            </Link>
            <span className="docs-badge">Docs</span>
          </div>
        </header>
        <main className="docs-content" style={{ margin: "40px auto", maxWidth: 600, textAlign: "center" }}>
          <h2>Article Not Found</h2>
          <p>The documentation page you requested does not exist or has been moved.</p>
          <Link href="/" style={{ color: "var(--green)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16 }}>
            <ArrowLeft size={16} /> Back to Documentation Home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="docs-shell">
      <header className="docs-header">
        <div className="docs-header-left">
          <Link href="/" className="brand" aria-label="OrbitWork Home" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800, color: "var(--ink)" }}>
            <BrandMark size={26} />
            <span>Orbit<span style={{ color: "var(--green)" }}>Work</span></span>
          </Link>
          <span className="docs-badge">Docs</span>
        </div>
        <div className="docs-header-right">
          <Link href="/" className="docs-nav-link">All Docs</Link>
          <a href="https://support.orbitwork.org" className="docs-nav-link">Support</a>
          <a href="https://status.orbitwork.org" className="docs-nav-link">Status</a>
          <a href="https://app.orbitwork.org" className="docs-btn-app">Open App</a>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div className="docs-search-box">
            <BookOpen size={15} />
            <input type="text" placeholder="Search documentation..." readOnly />
          </div>
          {DOC_CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <div className="docs-nav-group-title">{cat.title}</div>
              <ul className="docs-nav-list">
                {cat.items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/${item.slug}`}
                      className={`docs-nav-item ${item.slug === article.slug ? "is-active" : ""}`}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <main className="docs-content">
          <div className="docs-eyebrow">{article.category}</div>
          <h1 className="docs-title">{article.title}</h1>
          <p className="docs-lead">{article.description}</p>

          <div className="docs-article-body" style={{ whiteSpace: "pre-line", fontSize: "15px", lineHeight: 1.7, color: "var(--ink)" }}>
            {article.content}
          </div>

          <div className="docs-callout" style={{ marginTop: 36 }}>
            <strong>Ready to put this into practice?</strong> Head to your{" "}
            <a href="https://app.orbitwork.org/dashboard" style={{ color: "var(--green)", fontWeight: 700 }}>
              OrbitWork Dashboard <ExternalLink size={13} style={{ display: "inline", verticalAlign: "middle" }} />
            </a>{" "}
            to manage your projects.
          </div>
        </main>
      </div>
    </div>
  );
}
